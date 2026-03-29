import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;
  modelsLoading = Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]).then(() => { modelsLoaded = true; });
  return modelsLoading;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Capture current video frame (mirrored for front camera) */
export function captureFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const ctx = c.getContext('2d')!;
  ctx.save();
  ctx.translate(video.videoWidth, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);
  ctx.restore();
  return c;
}

function imgSize(input: HTMLImageElement | HTMLCanvasElement) {
  return input instanceof HTMLImageElement
    ? { w: input.naturalWidth || input.width, h: input.naturalHeight || input.height }
    : { w: input.width, h: input.height };
}

/** Load image from URL via fetch+blob (bypasses CORS), fallback to direct load */
async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(); };
      img.src = objectUrl;
    });
  } catch {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    });
  }
}

// ─── Core: face-only crop → descriptor ────────────────────────────────────────

/**
 * 1. Detect the face bounding box in the input image.
 * 2. Crop to just the face (+ 35% padding) — background ignored.
 * 3. Extract the 128-d descriptor from that face-only crop.
 *
 * Returns null if no face is detected.
 */
async function getFaceDescriptor(
  input: HTMLImageElement | HTMLCanvasElement,
): Promise<{ descriptor: Float32Array; box: faceapi.Box } | null> {
  const { w, h } = imgSize(input);

  // Step 1 — detect face in full image
  let detection: faceapi.FaceDetection | undefined;
  for (const [inputSize, score] of [[416, 0.3], [320, 0.2], [608, 0.15]] as [number, number][]) {
    detection = await faceapi.detectSingleFace(
      input,
      new faceapi.TinyFaceDetectorOptions({ inputSize: inputSize as 416 | 320 | 608, scoreThreshold: score }),
    );
    if (detection) break;
  }
  if (!detection) return null;

  const { x, y, width: fw, height: fh } = detection.box;

  // Step 2 — crop to face region + 35% padding on each side
  const pad = Math.max(fw, fh) * 0.35;
  const sx = Math.max(0, Math.round(x - pad));
  const sy = Math.max(0, Math.round(y - pad));
  const sw = Math.min(w - sx, Math.round(fw + pad * 2));
  const sh = Math.min(h - sy, Math.round(fh + pad * 2));

  const crop = document.createElement('canvas');
  crop.width = 224;
  crop.height = 224;
  crop.getContext('2d')!.drawImage(input, sx, sy, sw, sh, 0, 0, 224, 224);

  // Step 3 — extract descriptor from face-only crop
  for (const [inputSize, score] of [[224, 0.15], [160, 0.1], [320, 0.1]] as [number, number][]) {
    const result = await faceapi
      .detectSingleFace(crop, new faceapi.TinyFaceDetectorOptions({ inputSize: inputSize as 224 | 160 | 320, scoreThreshold: score }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (result?.descriptor) return { descriptor: result.descriptor, box: detection.box };
  }
  return null;
}

// ─── Real-time face position check ────────────────────────────────────────────

export type FacePosition = 'none' | 'off-center' | 'too-small' | 'ready';

/**
 * Lightweight check (detection only, no descriptor) for live oval feedback.
 * Runs every ~600ms from the component.
 */
export async function checkFacePosition(video: HTMLVideoElement): Promise<FacePosition> {
  if (!modelsLoaded) return 'none';

  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const ctx = c.getContext('2d')!;
  ctx.save();
  ctx.translate(video.videoWidth, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);
  ctx.restore();

  const det = await faceapi.detectSingleFace(
    c,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }),
  );
  if (!det) return 'none';

  const { x, y, width: fw, height: fh } = det.box;
  const w = c.width;
  const h = c.height;

  // Too small — person too far
  if ((fw * fh) / (w * h) < 0.05) return 'too-small';

  // Off-center — face center must be within ±18% of frame center
  const offX = Math.abs(x + fw / 2 - w / 2) / w;
  const offY = Math.abs(y + fh / 2 - h / 2) / h;
  if (offX > 0.18 || offY > 0.18) return 'off-center';

  return 'ready';
}

// ─── Verification ─────────────────────────────────────────────────────────────

export interface VerifyResult {
  match: boolean;
  distance: number;
  message: string;
  skipVerification?: boolean;
}

/**
 * Full verification pipeline:
 *   1. Capture video frame
 *   2. Check face is centered in the oval
 *   3. Extract face-only descriptor from live frame  (background ignored)
 *   4. Extract face-only descriptor from profile photo (background ignored)
 *   5. Compare — threshold 0.55
 */
export async function verifyFaceFromVideo(
  video: HTMLVideoElement,
  profilePhotoUrl: string | null | undefined,
): Promise<{ frame: HTMLCanvasElement; result: VerifyResult }> {
  await loadFaceModels();

  const frame = captureFrame(video);
  const w = frame.width;
  const h = frame.height;

  // ── 1. Get face descriptor from live frame ─────────────────────────────────
  const liveResult = await getFaceDescriptor(frame);

  if (!liveResult) {
    return {
      frame,
      result: { match: false, distance: 1, message: 'No face detected. Look straight at the camera.' },
    };
  }

  // ── 2. Enforce face is centered ────────────────────────────────────────────
  const { box } = liveResult;
  const offX = Math.abs(box.x + box.width / 2 - w / 2) / w;
  const offY = Math.abs(box.y + box.height / 2 - h / 2) / h;

  if (offX > 0.18 || offY > 0.18) {
    return {
      frame,
      result: { match: false, distance: 1, message: 'Face not centered. Align inside the oval and try again.' },
    };
  }
  if ((box.width * box.height) / (w * h) < 0.05) {
    return {
      frame,
      result: { match: false, distance: 1, message: 'Move closer to the camera.' },
    };
  }

  // ── 3. No profile photo — allow ────────────────────────────────────────────
  if (!profilePhotoUrl || !profilePhotoUrl.startsWith('http')) {
    return {
      frame,
      result: { match: true, distance: 0, skipVerification: true, message: 'No profile photo on file — check-in recorded.' },
    };
  }

  // ── 4. Load profile photo ──────────────────────────────────────────────────
  let profileImg: HTMLImageElement;
  try {
    profileImg = await loadImageFromUrl(profilePhotoUrl);
  } catch {
    return {
      frame,
      result: { match: true, distance: 0, skipVerification: true, message: 'Profile photo unavailable — check-in recorded.' },
    };
  }

  // ── 5. Get face-only descriptor from profile photo ─────────────────────────
  const profileResult = await getFaceDescriptor(profileImg);

  if (!profileResult) {
    return {
      frame,
      result: { match: true, distance: 0, skipVerification: true, message: 'Could not detect face in profile photo — check-in recorded. Ask HR to update your photo.' },
    };
  }

  // ── 6. Compare face descriptors ────────────────────────────────────────────
  const distance = faceapi.euclideanDistance(liveResult.descriptor, profileResult.descriptor);
  const THRESHOLD = 0.55;
  const match = distance < THRESHOLD;
  const similarity = Math.round((1 - Math.min(distance, 1)) * 100);

  console.log(`[FaceVerify] distance=${distance.toFixed(3)} threshold=${THRESHOLD} match=${match}`);

  return {
    frame,
    result: {
      match, distance,
      message: match
        ? `Identity verified ✓ (${similarity}% match)`
        : `Face did not match your profile (${similarity}% similarity). Please retake.`,
    },
  };
}
