import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { database } from '@/services/firebase';
import { ref, onValue, set, update, get } from 'firebase/database';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  MapPin, User, FolderOpen, CheckCircle, XCircle,
  CalendarDays, ArrowRight, FileText, Sunrise, Navigation,
  LogIn, LogOut, Clock, Plus, Calendar,
  Camera, X, ShieldCheck, ShieldX, Loader2,
} from 'lucide-react';
import { verifyFaceFromVideo, loadFaceModels, checkFacePosition, type FacePosition } from '@/utils/faceVerification';

type CameraStep = 'idle' | 'preview' | 'verifying' | 'verified' | 'failed';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AttendanceSession {
  checkIn: string;
  checkInMs: number;
  checkOut?: string;
  checkOutMs?: number;
  lat?: number | null;
  lng?: number | null;
  checkOutLat?: number | null;
  checkOutLng?: number | null;
  checkInPhotoUrl?: string | null;
  checkOutPhotoUrl?: string | null;
}

export interface AttendanceRecord {
  employeeId: string;
  employeeName: string;
  date: string;
  status: string;
  sessions: AttendanceSession[];
  totalWorkedMs: number;
  // Backward-compat top-level fields
  checkIn?: string;
  checkOut?: string;
  createdAt?: number;
  checkOutAt?: number;
  updatedAt?: number;
}

interface TimeLog {
  id: string;
  date: string;
  taskDescription: string;
  hoursWorked: number;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: number;
}

type GpsStatus = 'idle' | 'getting' | 'got' | 'denied';
type PendingAction = 'in' | 'out' | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function format12h(d: Date) {
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

export function msToHMS(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function msToHM(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = format(new Date(), 'yyyy-MM-dd');

  // Attendance state
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Camera + verification state
  const [cameraStep, setCameraStep] = useState<CameraStep>('idle');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [pendingLoc, setPendingLoc] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState('');
  const [facePosition, setFacePosition] = useState<FacePosition>('none');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stopwatch — total time worked today (completed + current)
  const [totalElapsed, setTotalElapsed] = useState('00:00:00');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Monthly summary
  const [summary, setSummary] = useState({ present: 0, absent: 0, leave: 0 });

  // Recent logs
  const [recentLogs, setRecentLogs] = useState<TimeLog[]>([]);

  // ── Live attendance record ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.employeeId) return;
    const unsub = onValue(ref(database, `hr/attendance/${today}/${user.employeeId}`), snap => {
      if (snap.exists()) {
        const val = snap.val();
        // Migrate old single-session format → sessions array
        if (!val.sessions) {
          const migrated: AttendanceRecord = {
            ...val,
            sessions: val.checkIn ? [{
              checkIn: val.checkIn,
              checkInMs: val.createdAt ?? Date.now(),
              checkOut: val.checkOut,
              checkOutMs: val.checkOutAt,
              lat: val.lat,
              lng: val.lng,
              checkOutLat: val.checkOutLat,
              checkOutLng: val.checkOutLng,
            }] : [],
            totalWorkedMs: (val.checkIn && val.checkOut && val.createdAt && val.checkOutAt)
              ? val.checkOutAt - val.createdAt : 0,
          };
          setRecord(migrated);
        } else {
          setRecord(val);
        }
      } else {
        setRecord(null);
      }
    });
    return () => unsub();
  }, [user?.employeeId, today]);

  // ── Stopwatch: total time including current active session ─────────────────
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

  // ── Monthly summary ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.employeeId) return;
    (async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const days = new Date(year, month, 0).getDate();
      let present = 0, absent = 0, leave = 0;
      const snaps = await Promise.all(
        Array.from({ length: days }, (_, i) => {
          const d = String(i + 1).padStart(2, '0');
          return get(ref(database, `hr/attendance/${year}-${String(month).padStart(2, '0')}-${d}/${user.employeeId}`));
        })
      );
      snaps.forEach(s => {
        if (!s.exists()) return;
        const st = s.val().status;
        if (st === 'Present') present++;
        else if (st === 'Absent') absent++;
        else if (st === 'Leave') leave++;
      });
      setSummary({ present, absent, leave });
    })();
  }, [user?.employeeId]);

  // ── Recent time logs ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.employeeId) return;
    const unsub = onValue(ref(database, `hr/timeLogs/${user.employeeId}`), snap => {
      if (snap.exists()) {
        const data = snap.val();
        setRecentLogs(
          Object.keys(data).map(k => ({ ...data[k], id: k }))
            .sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 3)
        );
      } else setRecentLogs([]);
    });
    return () => unsub();
  }, [user?.employeeId]);

  // ── Load employee profile photo & pre-load face models ────────────────────
  useEffect(() => {
    if (!user?.firebaseKey) return;
    get(ref(database, `hr/employees/${user.firebaseKey}`)).then(snap => {
      if (snap.exists()) setProfilePhotoUrl(snap.val().profilePhoto ?? null);
    });
    loadFaceModels().catch(() => {});
  }, [user?.firebaseKey]);

  // ── Camera: attach stream after video element mounts ──────────────────────
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
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setAccuracy(pos.coords.accuracy);
          setGpsStatus('got');
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        },
        () => { setGpsStatus('denied'); resolve(null); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  // ── Camera helpers ─────────────────────────────────────────────────────────
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setCameraStep('preview');
    } catch (err) {
      console.error('Camera error:', err);
      toast.error('Camera access denied. Please allow camera permissions.');
      setCameraStep('idle');
      setPendingAction(null);
      setPendingLoc(null);
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
    setCapturedPhoto(frame.toDataURL('image/jpeg', 0.85));

    if (!result.match) {
      setCameraStep('failed');
      setVerifyMessage(result.message);
      return;
    }

    // Matched — commit
    setCameraStep('verified');
    setVerifyMessage(result.message);
    setActionLoading(true);
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

    setTimeout(() => {
      setCapturedPhoto(null); setCameraStep('idle');
      setPendingAction(null); setPendingLoc(null); setVerifyMessage('');
      setActionLoading(false);
    }, 1500);
  };

  const retryVerify = async () => { setCapturedPhoto(null); setVerifyMessage(''); await startCamera(); };

  const commitCheckIn = async (loc: { lat: number; lng: number; accuracy: number } | null) => {
    if (!user?.employeeId) return;
    const now = new Date(); const nowMs = Date.now();
    const newSession: AttendanceSession = {
      checkIn: format12h(now), checkInMs: nowMs,
      lat: loc?.lat ?? null, lng: loc?.lng ?? null,
    };
    const existingSessions = record?.sessions ?? [];
    if (!record) {
      await set(ref(database, `hr/attendance/${today}/${user.employeeId}`), {
        employeeId: user.employeeId, employeeName: user.name,
        date: today, status: 'Present',
        sessions: [newSession], totalWorkedMs: 0,
        checkIn: format12h(now), createdAt: nowMs,
      });
    } else {
      await update(ref(database, `hr/attendance/${today}/${user.employeeId}`), {
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
    await update(ref(database, `hr/attendance/${today}/${user.employeeId}`), {
      sessions, totalWorkedMs: (record.totalWorkedMs ?? 0) + (nowMs - (active.checkInMs ?? nowMs)),
      checkOut: format12h(now), checkOutAt: nowMs, updatedAt: nowMs,
    });
    toast.success(`Checked out at ${format12h(now)}`);
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const sessions = record?.sessions ?? [];
  const lastSession = sessions[sessions.length - 1];
  const isCheckedIn = sessions.length > 0 && !!lastSession && !lastSession.checkOut;
  const hasAnySession = sessions.length > 0;
  const isCameraOpen = cameraStep !== 'idle';
  const verifyFailed = cameraStep === 'failed';

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const logStatusBadge = (s: TimeLog['status']) =>
    s === 'approved' ? 'bg-green-100 text-green-700'
      : s === 'rejected' ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── Greeting banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-emerald-600 p-5 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-56 h-56 rounded-full bg-white translate-x-16 -translate-y-16" />
          <div className="absolute bottom-0 left-24 w-40 h-40 rounded-full bg-white translate-y-12" />
        </div>
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1 opacity-80">
              <Sunrise className="h-3.5 w-3.5" />
              <span className="text-xs">{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <h1 className="text-xl font-bold">{greeting()}, {user?.name?.split(' ')[0]}!</h1>
            <p className="text-xs opacity-60 mt-0.5">Have a productive day!</p>
            <p className="text-xs opacity-40 mt-0.5">{user?.employeeId} · Employee Portal</p>
          </div>
          <Badge className="bg-white/20 text-white border-white/30 text-xs hidden sm:flex">
            {record?.status ?? 'Not marked'}
          </Badge>
        </div>
      </div>

      {/* ── ATTENDANCE CLOCK CARD ── */}
      <Card className={`border-2 shadow-md transition-all ${isCheckedIn
        ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50'
        : hasAnySession
          ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50'
          : 'border-border bg-white'
        }`}>
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row items-center gap-0 sm:gap-6 p-6">

            {/* Left: total time display */}
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left mb-5 sm:mb-0">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                {isCheckedIn ? 'Currently Working' : hasAnySession ? 'Total Time Today' : "Today's Attendance"}
              </p>

              {/* Big clock */}
              <div className={`relative flex items-center gap-2 ${isCheckedIn ? 'text-amber-600' : hasAnySession ? 'text-green-600' : 'text-muted-foreground/50'}`}>
                {isCheckedIn && (
                  <span className="absolute -left-4 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
                )}
                <span className={`font-mono font-bold tracking-tight ${isCheckedIn || hasAnySession ? 'text-5xl' : 'text-4xl text-muted-foreground/30'}`}>
                  {totalElapsed}
                </span>
              </div>

              {/* Session count */}
              {hasAnySession && (
                <div className="mt-2 flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                  <Badge variant="outline" className="text-xs">
                    {sessions.length} session{sessions.length > 1 ? 's' : ''} today
                  </Badge>
                  {isCheckedIn && lastSession && (
                    <span className="text-xs text-amber-600 font-medium">
                      Since {lastSession.checkIn}
                    </span>
                  )}
                </div>
              )}

              {/* GPS indicator — only shown when camera card is not open */}
              {!isCameraOpen && gpsStatus === 'getting' && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
                  <Navigation className="h-3 w-3 animate-pulse" /> Getting location...
                </div>
              )}
              {!isCameraOpen && gpsStatus === 'got' && accuracy !== null && (
                <div className={`flex items-center gap-1.5 mt-2 text-xs ${accuracy < 50 ? 'text-green-600' : accuracy < 200 ? 'text-amber-500' : 'text-red-500'}`}>
                  <Navigation className="h-3 w-3" /> GPS ±{Math.round(accuracy)}m
                </div>
              )}
              {!isCameraOpen && gpsStatus === 'denied' && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
                  <Navigation className="h-3 w-3" /> Location denied
                </div>
              )}
            </div>

            {/* Right: action buttons */}
            <div className="sm:ml-auto flex flex-col items-center gap-3 w-full sm:w-auto">
              {cameraStep === 'idle' && (
                <>
                  {isCheckedIn ? (
                    <Button
                      onClick={handleCheckOut}
                      disabled={actionLoading}
                      className="h-16 w-48 text-base font-bold rounded-2xl shadow-lg bg-amber-500 hover:bg-amber-600 text-white gap-2"
                    >
                      <LogOut className="h-5 w-5" />Check Out
                    </Button>
                  ) : (
                    <Button
                      onClick={handleCheckIn}
                      disabled={actionLoading}
                      className="h-16 w-48 text-base font-bold rounded-2xl shadow-lg bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                      <LogIn className="h-5 w-5" />{hasAnySession ? 'Check In Again' : 'Check In'}
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground text-center">
                    Face verification &amp; GPS required
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Today's sessions timeline */}
          {sessions.length > 0 && (
            <div className="border-t border-border/50 px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Today's Sessions
              </p>
              <div className="space-y-2">
                {sessions.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16">Session {i + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                        <LogIn className="h-2.5 w-2.5 text-white" />
                      </div>
                      <span className="text-xs font-semibold">{s.checkIn}</span>
                    </div>
                    {s.checkOut ? (
                      <>
                        <span className="text-muted-foreground text-xs">→</span>
                        <div className="flex items-center gap-1.5">
                          <div className="h-4 w-4 rounded-full bg-red-400 flex items-center justify-center">
                            <LogOut className="h-2.5 w-2.5 text-white" />
                          </div>
                          <span className="text-xs font-semibold">{s.checkOut}</span>
                        </div>
                        {s.checkInMs && s.checkOutMs && (
                          <Badge variant="outline" className="text-[10px] ml-auto">
                            {msToHM(s.checkOutMs - s.checkInMs)}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <Badge className="ml-auto text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                        Active
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Camera + face verification card ── */}
      {cameraStep !== 'idle' && (
        <Card className={`border-2 shadow-md ${verifyFailed ? 'border-red-400' : cameraStep === 'verified' ? 'border-green-400' : 'border-primary/40'}`}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Camera className="h-4 w-4 text-primary" />
                {cameraStep === 'preview' && `Face verification — ${pendingAction === 'in' ? 'Check In' : 'Check Out'}`}
                {cameraStep === 'captured' && 'Confirm your photo'}
                {cameraStep === 'verifying' && !capturedPhoto && 'Extracting face...'}
                {cameraStep === 'verifying' && capturedPhoto && 'Verifying identity...'}
                {cameraStep === 'verified' && 'Identity verified'}
                {cameraStep === 'failed' && 'Verification failed'}
              </div>
              <button onClick={cancelCamera} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

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
                  {/* Status hint */}
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
                        <ShieldCheck className="h-5 w-5" /><span className="font-semibold text-sm">Verified</span>
                      </div>
                    </div>
                  )}
                  {cameraStep === 'failed' && (
                    <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center">
                      <div className="bg-red-600 text-white rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg">
                        <ShieldX className="h-5 w-5" /><span className="font-semibold text-sm">Not Matched</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Verification message */}
            {verifyMessage && (
              <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${verifyFailed ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                {verifyFailed ? <ShieldX className="h-4 w-4 mt-0.5 flex-shrink-0" /> : <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />}
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

            {cameraStep === 'preview' && (
              <div className="flex justify-center">
                <Button
                  onClick={verifyAndSubmit}
                  disabled={actionLoading || facePosition !== 'ready'}
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

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Present', val: summary.present, bg: 'from-green-500 to-emerald-600', icon: CheckCircle },
          { label: 'Absent', val: summary.absent, bg: 'from-red-500 to-rose-600', icon: XCircle },
          { label: 'Leave', val: summary.leave, bg: 'from-amber-400 to-orange-500', icon: CalendarDays },
        ].map(c => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="overflow-hidden border-0 shadow-sm">
              <div className={`bg-gradient-to-br ${c.bg} p-4 text-white flex items-center gap-3`}>
                <Icon className="h-5 w-5 opacity-80 shrink-0" />
                <div>
                  <p className="text-2xl font-bold leading-none">{c.val}</p>
                  <p className="text-xs opacity-75 mt-0.5">{c.label} · This month</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Quick links + recent logs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Quick links */}
        <div className="lg:col-span-2 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quick Links</p>
          {[
            { label: 'Log Work', desc: 'Submit task log', icon: FileText, bg: 'bg-blue-600', card: 'bg-blue-50 border-blue-200 text-blue-700', path: '/employee/timesheet' },
            { label: 'Attendance', desc: 'View attendance history', icon: Calendar, bg: 'bg-teal-600', card: 'bg-teal-50 border-teal-200 text-teal-700', path: '/employee/attendance' },
            { label: 'Leave Tracker', desc: 'Leaves & holidays', icon: CalendarDays, bg: 'bg-purple-600', card: 'bg-purple-50 border-purple-200 text-purple-700', path: '/employee/leaves' },
            { label: 'My Profile', desc: 'View your details', icon: User, bg: 'bg-indigo-600', card: 'bg-indigo-50 border-indigo-200 text-indigo-700', path: '/employee/profile' },
            { label: 'Documents', desc: 'View uploaded files', icon: FolderOpen, bg: 'bg-amber-500', card: 'bg-amber-50 border-amber-200 text-amber-700', path: '/employee/documents' },
          ].map(a => {
            const Icon = a.icon;
            return (
              <button key={a.path} onClick={() => navigate(a.path)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border ${a.card} hover:shadow-sm transition-all text-left`}>
                <div className={`h-9 w-9 rounded-lg ${a.bg} flex items-center justify-center shrink-0`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-none">{a.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{a.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 opacity-40 shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Recent logs */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Recent Work Logs
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 text-primary gap-1"
                onClick={() => navigate('/employee/timesheet')}>
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recentLogs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-10 w-10 text-muted-foreground/25 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No work logs yet</p>
                <Button size="sm" className="mt-2 h-8 text-xs"
                  onClick={() => navigate('/employee/timesheet')}>Log your first task</Button>
              </div>
            ) : recentLogs.map(log => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{log.taskDescription}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{log.date} · {log.hoursWorked}h</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${logStatusBadge(log.status)}`}>
                  {log.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
