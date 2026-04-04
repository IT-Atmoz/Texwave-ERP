/**
 * CameraVerifyModal
 * Self-contained camera + face-verification overlay.
 * Used on both WebCheckin and MyAttendance pages.
 *
 * Props:
 *   action         – 'in' | 'out'
 *   profilePhotoUrl – URL of the employee's stored photo (may be null)
 *   onVerified     – called with GPS coords (or null) when face matches
 *   onCancel       – called when user closes / cancels
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Camera, X, ShieldCheck, ShieldX, Loader2, Navigation,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  verifyFaceFromVideo,
  loadFaceModels,
  checkFacePosition,
  type FacePosition,
} from '@/utils/faceVerification';

type CameraStep = 'preview' | 'verifying' | 'verified' | 'failed';
type GpsStatus  = 'getting' | 'got' | 'denied' | 'idle';

interface Props {
  action: 'in' | 'out';
  profilePhotoUrl: string | null;
  onVerified: (loc: { lat: number; lng: number; accuracy: number } | null) => void;
  onCancel: () => void;
}

export function CameraVerifyModal({ action, profilePhotoUrl, onVerified, onCancel }: Props) {
  const [step, setStep]                 = useState<CameraStep>('preview');
  const [capturedPhoto, setCaptured]    = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg]       = useState('');
  const [facePos, setFacePos]           = useState<FacePosition>('none');
  const [gpsStatus, setGpsStatus]       = useState<GpsStatus>('idle');
  const [loc, setLoc]                   = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const faceTimer   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-load models
  useEffect(() => { loadFaceModels().catch(() => {}); }, []);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Face-position polling
  useEffect(() => {
    if (step === 'preview') {
      faceTimer.current = setInterval(async () => {
        if (videoRef.current?.videoWidth) {
          setFacePos(await checkFacePosition(videoRef.current));
        }
      }, 600);
    } else {
      if (faceTimer.current) { clearInterval(faceTimer.current); faceTimer.current = null; }
      setFacePos('none');
    }
    return () => { if (faceTimer.current) { clearInterval(faceTimer.current); faceTimer.current = null; } };
  }, [step]);

  // GPS (fire immediately)
  useEffect(() => {
    if (!navigator.geolocation) return;
    setGpsStatus('getting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsStatus('got');
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
        .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
      streamRef.current = stream;
      setStep('preview');
      // Attach stream directly — can't rely on useEffect re-run if step is already 'preview'
      const attach = () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        } else {
          requestAnimationFrame(attach);
        }
      };
      requestAnimationFrame(attach);
    } catch {
      toast.error('Camera access denied. Please allow camera permissions.');
      onCancel();
    }
  }, [onCancel]);

  const handleVerify = async () => {
    const video = videoRef.current;
    if (!video) return;

    setStep('verifying');
    setVerifyMsg('Verifying...');

    const { frame, result } = await verifyFaceFromVideo(video, profilePhotoUrl);
    setCaptured(frame.toDataURL('image/jpeg', 0.85));

    if (!result.match) {
      setStep('failed');
      setVerifyMsg(result.message);
      return;
    }

    setStep('verified');
    setVerifyMsg(result.message);
    stopCamera();

    // Short delay so user sees the "Verified" state
    setTimeout(() => onVerified(loc), 1200);
  };

  const handleRetry = async () => {
    setCaptured(null);
    setVerifyMsg('');
    await startCamera();
  };

  const borderColor =
    step === 'failed'   ? 'border-red-400'
    : step === 'verified' ? 'border-green-400'
    : 'border-primary/40';

  return (
    /* Full-screen overlay */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-sm border-2 ${borderColor} overflow-hidden`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">
              {step === 'preview'   && `${action === 'in' ? 'Check In' : 'Check Out'} — Face Verification`}
              {step === 'verifying' && 'Verifying identity...'}
              {step === 'verified'  && 'Identity Verified ✓'}
              {step === 'failed'    && 'Verification Failed'}
            </span>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Live camera preview */}
          {step === 'preview' && (
            <div className="flex justify-center">
              <div className="relative w-52 h-64 rounded-2xl overflow-hidden bg-black shadow-lg">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {/* Oval face guide */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-36 h-44 rounded-full border-[3px] transition-colors duration-300
                    ${facePos === 'ready'
                      ? 'border-green-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]'
                      : facePos === 'off-center' || facePos === 'too-small'
                        ? 'border-red-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]'
                        : 'border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]'}`}
                  />
                </div>
                {/* Hint */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors
                    ${facePos === 'ready'      ? 'bg-green-500/80 text-white'
                    : facePos === 'off-center' ? 'bg-red-500/80 text-white'
                    : facePos === 'too-small'  ? 'bg-amber-500/80 text-white'
                    : 'bg-black/60 text-white/80'}`}>
                    {facePos === 'ready'      && '✓ Face centered — ready'}
                    {facePos === 'off-center' && 'Center your face in the oval'}
                    {facePos === 'too-small'  && 'Move closer to the camera'}
                    {facePos === 'none'       && 'Align face inside oval'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Spinner while verifying (before frame captured) */}
          {step === 'verifying' && !capturedPhoto && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Comparing faces...</p>
            </div>
          )}

          {/* Captured snapshot */}
          {capturedPhoto && (
            <div className="flex justify-center">
              <div className="relative w-52 h-64 rounded-2xl overflow-hidden shadow-lg bg-muted">
                <img src={capturedPhoto} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
                {step === 'verifying' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 text-white animate-spin" />
                  </div>
                )}
                {step === 'verified' && (
                  <div className="absolute inset-0 bg-green-900/40 flex items-center justify-center">
                    <div className="bg-green-600 text-white rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg">
                      <ShieldCheck className="h-5 w-5" />
                      <span className="font-semibold text-sm">Verified</span>
                    </div>
                  </div>
                )}
                {step === 'failed' && (
                  <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center">
                    <div className="bg-red-600 text-white rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg">
                      <ShieldX className="h-5 w-5" />
                      <span className="font-semibold text-sm">Not Matched</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Verify message */}
          {verifyMsg && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
              step === 'failed'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {step === 'failed'
                ? <ShieldX className="h-4 w-4 mt-0.5 shrink-0" />
                : <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />}
              {verifyMsg}
            </div>
          )}

          {/* GPS status */}
          <div className="flex items-center gap-2 text-xs">
            <Navigation className={`h-3.5 w-3.5 shrink-0 ${
              gpsStatus === 'got'     ? 'text-green-600'
              : gpsStatus === 'denied' ? 'text-red-400'
              : 'text-amber-400 animate-pulse'}`}
            />
            <span className="text-muted-foreground">
              {gpsStatus === 'getting' && 'Acquiring GPS...'}
              {gpsStatus === 'got'     && `GPS ready · ±${loc ? Math.round(loc.accuracy) : '?'}m`}
              {gpsStatus === 'denied'  && 'GPS unavailable (location won\'t be recorded)'}
              {gpsStatus === 'idle'    && 'GPS pending...'}
            </span>
          </div>

          {/* Action buttons */}
          {step === 'preview' && (
            <Button
              onClick={handleVerify}
              disabled={facePos !== 'ready'}
              className={`w-full gap-2 font-semibold ${
                facePos === 'ready'
                  ? action === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Verify &amp; {action === 'in' ? 'Check In' : 'Check Out'}
            </Button>
          )}

          {step === 'verifying' && (
            <Button disabled className="w-full gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
            </Button>
          )}

          {step === 'failed' && (
            <Button onClick={handleRetry} className="w-full gap-2">
              <Camera className="h-4 w-4" /> Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
