import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref as dbRef, onValue, set, update, get } from 'firebase/database';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Navigation, LogIn, LogOut, Clock, AlertTriangle,
  Camera, X, ShieldCheck, ShieldX, Loader2,
} from 'lucide-react';
import {
  format12h, msToHMS, msToHM,
  type AttendanceSession, type AttendanceRecord,
} from './EmployeeDashboard';
import { verifyFaceFromVideo, loadFaceModels, checkFacePosition, type FacePosition } from '@/utils/faceVerification';

type GpsStatus = 'idle' | 'getting' | 'got' | 'denied';
type CameraStep = 'idle' | 'preview' | 'verifying' | 'verified' | 'failed';

function accuracyColor(a: number | null) {
  if (a === null) return 'text-gray-400';
  if (a < 50) return 'text-green-600';
  if (a < 200) return 'text-amber-500';
  return 'text-red-500';
}

export default function WebCheckin() {
  const { user } = useAuth();
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState('00:00:00');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Camera + verification state
  const [cameraStep, setCameraStep] = useState<CameraStep>('idle');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'in' | 'out' | null>(null);
  const [pendingLoc, setPendingLoc] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState('');
  const [facePosition, setFacePosition] = useState<FacePosition>('none');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  // ── Live attendance record ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.employeeId) return;
    const unsub = onValue(dbRef(database, `hr/attendance/${today}/${user.employeeId}`), snap => {
      if (snap.exists()) {
        const val = snap.val();
        if (!val.sessions) {
          setRecord({
            ...val,
            sessions: val.checkIn ? [{
              checkIn: val.checkIn, checkInMs: val.createdAt ?? Date.now(),
              checkOut: val.checkOut, checkOutMs: val.checkOutAt,
              lat: val.lat, lng: val.lng,
            }] : [],
            totalWorkedMs: (val.checkIn && val.checkOut && val.createdAt && val.checkOutAt)
              ? val.checkOutAt - val.createdAt : 0,
          });
        } else {
          setRecord(val);
        }
      } else {
        setRecord(null);
      }
    });
    return () => unsub();
  }, [user?.employeeId, today]);

  // ── Load employee profile photo ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.firebaseKey) return;
    get(dbRef(database, `hr/employees/${user.firebaseKey}`)).then(snap => {
      if (snap.exists()) setProfilePhotoUrl(snap.val().profilePhoto ?? null);
    });
  }, [user?.firebaseKey]);

  // ── Pre-load face models in background ────────────────────────────────────
  useEffect(() => { loadFaceModels().catch(() => {}); }, []);

  // ── Stopwatch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    const sessions = record?.sessions ?? [];
    const lastSession = sessions[sessions.length - 1];
    const activeSession = lastSession && !lastSession.checkOut ? lastSession : null;
    const completedMs = record?.totalWorkedMs ?? 0;
    if (activeSession) {
      const startMs = activeSession.checkInMs;
      const tick = () => setTotalElapsed(msToHMS(completedMs + (Date.now() - startMs)));
      tick();
      tickRef.current = setInterval(tick, 1000);
    } else {
      setTotalElapsed(msToHMS(completedMs));
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [record]);

  // ── Attach stream to video element ────────────────────────────────────────
  useEffect(() => {
    if (cameraStep === 'preview' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [cameraStep]);

  useEffect(() => () => stopCamera(), []);

  // ── Real-time face position polling ───────────────────────────────────────
  useEffect(() => {
    if (cameraStep === 'preview') {
      faceCheckRef.current = setInterval(async () => {
        if (videoRef.current && videoRef.current.videoWidth) {
          const pos = await checkFacePosition(videoRef.current);
          setFacePosition(pos);
        }
      }, 600);
    } else {
      if (faceCheckRef.current) { clearInterval(faceCheckRef.current); faceCheckRef.current = null; }
      setFacePosition('none');
    }
    return () => { if (faceCheckRef.current) { clearInterval(faceCheckRef.current); faceCheckRef.current = null; } };
  }, [cameraStep]);

  // ── GPS ────────────────────────────────────────────────────────────────────
  const getLocation = (): Promise<{ lat: number; lng: number; accuracy: number } | null> =>
    new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }
      setGpsStatus('getting');
      navigator.geolocation.getCurrentPosition(
        pos => {
          setLat(pos.coords.latitude); setLng(pos.coords.longitude);
          setAccuracy(pos.coords.accuracy); setGpsStatus('got');
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        },
        () => { setGpsStatus('denied'); resolve(null); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  // ── Camera helpers ─────────────────────────────────────────────────────────
  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      }).catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
      streamRef.current = stream;
      setCameraStep('preview');
      // Attach directly — useEffect won't re-fire if step was already 'preview'
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
      setCameraStep('idle'); setPendingAction(null); setPendingLoc(null);
    }
  }, []);

  const cancelCamera = () => {
    stopCamera(); setCapturedPhoto(null); setVerifyMessage('');
    setCameraStep('idle'); setPendingAction(null); setPendingLoc(null); setGpsStatus('idle');
  };

  // ── Initiate: GPS + camera simultaneously ──────────────────────────────────
  const handleCheckIn = async () => {
    setPendingAction('in');
    getLocation().then(loc => setPendingLoc(loc)).catch(() => {});
    await startCamera();
  };

  const handleCheckOut = async () => {
    setPendingAction('out');
    getLocation().then(loc => setPendingLoc(loc)).catch(() => {});
    await startCamera();
  };

  // ── One-click: capture frame + verify + commit ─────────────────────────────
  const verifyAndSubmit = async () => {
    const video = videoRef.current;
    if (!video || !pendingAction) return;

    setCameraStep('verifying');
    setVerifyMessage('Verifying...');

    const { frame, result } = await verifyFaceFromVideo(video, profilePhotoUrl);

    // Show the captured frame as snapshot
    setCapturedPhoto(frame.toDataURL('image/jpeg', 0.85));

    if (!result.match) {
      setCameraStep('failed');
      setVerifyMessage(result.message);
      return;
    }

    // Matched (or skipped) — commit attendance
    setCameraStep('verified');
    setVerifyMessage(result.message);
    setLoading(true);
    stopCamera();

    let loc = pendingLoc;
    if (!loc && gpsStatus === 'getting') { loc = await getLocation(); setPendingLoc(loc); }

    try {
      if (pendingAction === 'in') await commitCheckIn(loc);
      else await commitCheckOut(loc);
    } catch (err) {
      console.error('Attendance write failed:', err);
      toast.error('Failed to save attendance. Please try again.');
    }

    // Reset after short delay so user sees the verified state
    setTimeout(() => {
      setCapturedPhoto(null); setCameraStep('idle');
      setPendingAction(null); setPendingLoc(null); setVerifyMessage('');
      setLoading(false);
    }, 1500);
  };

  // ── Retry after failure ────────────────────────────────────────────────────
  const retryVerify = async () => {
    setCapturedPhoto(null); setVerifyMessage('');
    await startCamera();
  };

  // ── Firebase writes ────────────────────────────────────────────────────────
  const commitCheckIn = async (loc: { lat: number; lng: number; accuracy: number } | null) => {
    if (!user?.employeeId) return;
    const now = new Date(); const nowMs = Date.now();
    const newSession: AttendanceSession = {
      checkIn: format12h(now), checkInMs: nowMs,
      lat: loc?.lat ?? null, lng: loc?.lng ?? null,
    };
    const existingSessions = record?.sessions ?? [];
    if (!record) {
      await set(dbRef(database, `hr/attendance/${today}/${user.employeeId}`), {
        employeeId: user.employeeId, employeeName: user.name,
        date: today, status: 'Present',
        sessions: [newSession], totalWorkedMs: 0,
        checkIn: format12h(now), createdAt: nowMs,
      });
    } else {
      await update(dbRef(database, `hr/attendance/${today}/${user.employeeId}`), {
        sessions: [...existingSessions, newSession], status: 'Present',
      });
    }
    toast.success(`Checked in at ${format12h(now)}`);
  };

  const commitCheckOut = async (loc: { lat: number; lng: number; accuracy: number } | null) => {
    if (!user?.employeeId || !record) return;
    const now = new Date(); const nowMs = Date.now();
    const sessions = [...(record.sessions ?? [])];
    const lastIdx = sessions.length - 1;
    const active = sessions[lastIdx];
    sessions[lastIdx] = {
      ...active, checkOut: format12h(now), checkOutMs: nowMs,
      checkOutLat: loc?.lat ?? null, checkOutLng: loc?.lng ?? null,
    };
    await update(dbRef(database, `hr/attendance/${today}/${user.employeeId}`), {
      sessions,
      totalWorkedMs: (record.totalWorkedMs ?? 0) + (nowMs - (active.checkInMs ?? nowMs)),
      checkOut: format12h(now), checkOutAt: nowMs, updatedAt: nowMs,
    });
    toast.success(`Checked out at ${format12h(now)}`);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const sessions = record?.sessions ?? [];
  const lastSession = sessions[sessions.length - 1];
  const isCheckedIn = sessions.length > 0 && !!lastSession && !lastSession.checkOut;
  const hasAnySession = sessions.length > 0;
  const isCameraOpen = cameraStep !== 'idle';
  const verifyFailed = cameraStep === 'failed';

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-muted-foreground text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Total time card */}
      <Card className={`border-2 ${isCheckedIn ? 'border-amber-300 bg-amber-50' : hasAnySession ? 'border-green-200 bg-green-50' : 'border-border'}`}>
        <CardContent className="pt-6 pb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Time Today</p>
          <div className={`text-5xl font-mono font-bold ${isCheckedIn ? 'text-amber-600' : hasAnySession ? 'text-green-600' : 'text-muted-foreground/30'}`}>
            {totalElapsed}
          </div>
          {isCheckedIn && (
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm text-amber-700">Checked in since {lastSession?.checkIn}</span>
            </div>
          )}
          {hasAnySession && !isCheckedIn && (
            <Badge className="mt-3 bg-green-600 text-white">
              {sessions.length} session{sessions.length > 1 ? 's' : ''} completed today
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* GPS status */}
      {gpsStatus !== 'idle' && !isCameraOpen && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Navigation className={`h-5 w-5 flex-shrink-0 ${gpsStatus === 'got' ? 'text-green-600' : gpsStatus === 'denied' ? 'text-red-500' : 'text-amber-500 animate-pulse'}`} />
              <div>
                <p className="text-sm font-medium">
                  {gpsStatus === 'getting' && 'Getting your location...'}
                  {gpsStatus === 'got' && 'Location acquired'}
                  {gpsStatus === 'denied' && 'Location access denied'}
                </p>
                {gpsStatus === 'got' && accuracy !== null && (
                  <p className={`text-xs ${accuracyColor(accuracy)}`}>
                    Accuracy: {Math.round(accuracy)}m · {lat?.toFixed(5)}, {lng?.toFixed(5)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Camera + verification card ─────────────────────────────────────────── */}
      {isCameraOpen && (
        <Card className={`border-2 ${verifyFailed ? 'border-red-400' : cameraStep === 'verified' ? 'border-green-400' : 'border-primary/40'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              {cameraStep === 'preview' && `${pendingAction === 'in' ? 'Check In' : 'Check Out'} — Face Verification`}
              {cameraStep === 'verifying' && 'Verifying identity...'}
              {cameraStep === 'verified' && 'Identity Verified'}
              {cameraStep === 'failed' && 'Verification Failed'}
              <button onClick={cancelCamera} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                <X className="h-4 w-4" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">

            {/* Live camera preview */}
            {cameraStep === 'preview' && (
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-52 h-64 rounded-2xl overflow-hidden bg-black shadow-lg">
                  <video ref={videoRef} autoPlay playsInline muted
                    className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                  {/* Oval face guide — color reflects position */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={`w-36 h-44 rounded-full border-[3px] transition-colors duration-300
                      ${facePosition === 'ready' ? 'border-green-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]'
                        : facePosition === 'off-center' || facePosition === 'too-small' ? 'border-red-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]'
                        : 'border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]'}`}
                    />
                  </div>
                  {/* Status hint at bottom */}
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors
                      ${facePosition === 'ready' ? 'bg-green-500/80 text-white'
                        : facePosition === 'off-center' ? 'bg-red-500/80 text-white'
                        : facePosition === 'too-small' ? 'bg-amber-500/80 text-white'
                        : 'bg-black/60 text-white/80'}`}>
                      {facePosition === 'ready' && '✓ Face centered — ready'}
                      {facePosition === 'off-center' && 'Center your face in the oval'}
                      {facePosition === 'too-small' && 'Move closer to the camera'}
                      {facePosition === 'none' && 'Align face inside oval'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Verifying spinner (no photo yet) */}
            {cameraStep === 'verifying' && !capturedPhoto && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Comparing faces...</p>
              </div>
            )}

            {/* Captured snapshot with overlay */}
            {capturedPhoto && (
              <div className="flex justify-center">
                <div className="relative w-52 h-64 rounded-2xl overflow-hidden shadow-lg bg-muted">
                  <img src={capturedPhoto} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
                  {cameraStep === 'verifying' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-10 w-10 text-white animate-spin" />
                    </div>
                  )}
                  {cameraStep === 'verified' && (
                    <div className="absolute inset-0 bg-green-900/40 flex items-center justify-center">
                      <div className="bg-green-600 text-white rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="font-semibold text-sm">Verified</span>
                      </div>
                    </div>
                  )}
                  {cameraStep === 'failed' && (
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

            {/* Verification message */}
            {verifyMessage && (
              <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${verifyFailed ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                {verifyFailed
                  ? <ShieldX className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  : <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                {verifyMessage}
              </div>
            )}

            {/* GPS inline */}
            <div className="flex items-center gap-2 text-xs px-1">
              <Navigation className={`h-3 w-3 flex-shrink-0 ${gpsStatus === 'got' ? 'text-green-600' : gpsStatus === 'denied' ? 'text-red-400' : 'text-amber-400 animate-pulse'}`} />
              <span className="text-muted-foreground">
                {gpsStatus === 'getting' && 'Acquiring GPS...'}
                {gpsStatus === 'got' && `GPS ready · ${lat?.toFixed(4)}, ${lng?.toFixed(4)}`}
                {gpsStatus === 'denied' && 'GPS unavailable'}
                {gpsStatus === 'idle' && 'GPS pending...'}
              </span>
            </div>

            {/* Action button */}
            {cameraStep === 'preview' && (
              <div className="flex justify-center">
                <Button
                  onClick={verifyAndSubmit}
                  disabled={loading || facePosition !== 'ready'}
                  className={`gap-2 text-white font-semibold px-8 transition-opacity
                    ${facePosition === 'ready'
                      ? pendingAction === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-500 hover:bg-amber-600'
                      : 'bg-gray-400 cursor-not-allowed'}`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Verify &amp; {pendingAction === 'in' ? 'Check In' : 'Check Out'}
                </Button>
              </div>
            )}

            {cameraStep === 'verifying' && (
              <Button disabled className="w-full gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />Verifying...
              </Button>
            )}

            {cameraStep === 'failed' && (
              <Button onClick={retryVerify} className="w-full gap-2">
                <Camera className="h-4 w-4" />Try Again
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main check-in/out button */}
      {!isCameraOpen && (
        isCheckedIn ? (
          <Button onClick={handleCheckOut} disabled={loading}
            className="w-full h-14 text-lg font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white gap-2">
            <LogOut className="h-5 w-5" />Check Out
          </Button>
        ) : (
          <Button onClick={handleCheckIn} disabled={loading}
            className="w-full h-14 text-lg font-semibold rounded-xl bg-green-600 hover:bg-green-700 text-white gap-2">
            <LogIn className="h-5 w-5" />{hasAnySession ? 'Check In Again' : 'Check In'}
          </Button>
        )
      )}

      {!hasAnySession && !isCameraOpen && (
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Face verification &amp; GPS required to check in
        </p>
      )}

      {/* Sessions list */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />Today's Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.map((s, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <LogIn className="h-2.5 w-2.5 text-white" />
                    </div>
                    <span className="text-sm font-medium">{s.checkIn}</span>
                    {s.checkOut && (
                      <>
                        <span className="text-muted-foreground">→</span>
                        <div className="h-4 w-4 rounded-full bg-red-400 flex items-center justify-center flex-shrink-0">
                          <LogOut className="h-2.5 w-2.5 text-white" />
                        </div>
                        <span className="text-sm font-medium">{s.checkOut}</span>
                      </>
                    )}
                  </div>
                  {s.checkInMs && s.checkOutMs && (
                    <p className="text-xs text-muted-foreground mt-0.5">Duration: {msToHM(s.checkOutMs - s.checkInMs)}</p>
                  )}
                  {s.lat && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-2.5 w-2.5" />Location recorded
                    </p>
                  )}
                </div>
                {!s.checkOut && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] flex-shrink-0">Active</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
