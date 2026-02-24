import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, onValue, set, update } from 'firebase/database';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Navigation, LogIn, LogOut, Clock, AlertTriangle,
} from 'lucide-react';
import {
  format12h, msToHMS, msToHM,
  type AttendanceSession, type AttendanceRecord,
} from './EmployeeDashboard';

type GpsStatus = 'idle' | 'getting' | 'got' | 'denied';

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

  const today = format(new Date(), 'yyyy-MM-dd');

  // ── Live record ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.employeeId) return;
    const unsub = onValue(ref(database, `hr/attendance/${today}/${user.employeeId}`), snap => {
      if (snap.exists()) {
        const val = snap.val();
        if (!val.sessions) {
          // Migrate old format
          setRecord({
            ...val,
            sessions: val.checkIn ? [{
              checkIn: val.checkIn,
              checkInMs: val.createdAt ?? Date.now(),
              checkOut: val.checkOut,
              checkOutMs: val.checkOutAt,
              lat: val.lat,
              lng: val.lng,
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
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });

  // ── Check In ───────────────────────────────────────────────────────────────
  const doCheckIn = async () => {
    if (!user?.employeeId) return;
    setLoading(true);
    const loc = await getLocation();
    if (!loc) toast.warning('Location unavailable — checking in without GPS');

    const now = new Date();
    const nowMs = Date.now();
    const newSession: AttendanceSession = {
      checkIn: format12h(now),
      checkInMs: nowMs,
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
    };

    const existingSessions = record?.sessions ?? [];

    if (!record) {
      await set(ref(database, `hr/attendance/${today}/${user.employeeId}`), {
        employeeId: user.employeeId,
        employeeName: user.name,
        date: today,
        status: 'Present',
        sessions: [newSession],
        totalWorkedMs: 0,
        checkIn: format12h(now),
        createdAt: nowMs,
      });
    } else {
      await update(ref(database, `hr/attendance/${today}/${user.employeeId}`), {
        sessions: [...existingSessions, newSession],
        status: 'Present',
      });
    }

    toast.success(`Checked in at ${format12h(now)}`);
    setLoading(false);
  };

  // ── Check Out ──────────────────────────────────────────────────────────────
  const doCheckOut = async () => {
    if (!user?.employeeId || !record) return;
    setLoading(true);
    const loc = await getLocation();
    if (!loc) toast.warning('Location unavailable — checking out without GPS');

    const now = new Date();
    const nowMs = Date.now();
    const sessions = [...(record.sessions ?? [])];
    const lastIdx = sessions.length - 1;
    const active = sessions[lastIdx];
    const sessionMs = nowMs - (active.checkInMs ?? nowMs);

    sessions[lastIdx] = {
      ...active,
      checkOut: format12h(now),
      checkOutMs: nowMs,
      checkOutLat: loc?.lat ?? null,
      checkOutLng: loc?.lng ?? null,
    };

    await update(ref(database, `hr/attendance/${today}/${user.employeeId}`), {
      sessions,
      totalWorkedMs: (record.totalWorkedMs ?? 0) + sessionMs,
      checkOut: format12h(now),
      checkOutAt: nowMs,
      updatedAt: nowMs,
    });

    toast.success(`Checked out at ${format12h(now)}`);
    setLoading(false);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const sessions = record?.sessions ?? [];
  const lastSession = sessions[sessions.length - 1];
  const isCheckedIn = sessions.length > 0 && !!lastSession && !lastSession.checkOut;
  const hasAnySession = sessions.length > 0;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-muted-foreground text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Total time card */}
      <Card className={`border-2 ${isCheckedIn
        ? 'border-amber-300 bg-amber-50'
        : hasAnySession
          ? 'border-green-200 bg-green-50'
          : 'border-border'
        }`}>
        <CardContent className="pt-6 pb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Total Time Today
          </p>
          <div className={`text-5xl font-mono font-bold ${isCheckedIn ? 'text-amber-600' : hasAnySession ? 'text-green-600' : 'text-muted-foreground/30'}`}>
            {totalElapsed}
          </div>
          {isCheckedIn && (
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm text-amber-700">Currently checked in since {lastSession?.checkIn}</span>
            </div>
          )}
          {hasAnySession && !isCheckedIn && (
            <Badge className="mt-3 bg-green-600 text-white">
              {sessions.length} session{sessions.length > 1 ? 's' : ''} completed today
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* GPS Status */}
      {gpsStatus !== 'idle' && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Navigation className={`h-5 w-5 ${gpsStatus === 'got' ? 'text-green-600' : gpsStatus === 'denied' ? 'text-red-500' : 'text-amber-500 animate-pulse'}`} />
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

      {/* Action button */}
      {isCheckedIn ? (
        <Button
          onClick={doCheckOut}
          disabled={loading || gpsStatus === 'getting'}
          className="w-full h-14 text-lg font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white gap-2"
        >
          {loading
            ? <><span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Checking out...</>
            : <><LogOut className="h-5 w-5" />Check Out</>}
        </Button>
      ) : (
        <Button
          onClick={doCheckIn}
          disabled={loading || gpsStatus === 'getting'}
          className="w-full h-14 text-lg font-semibold rounded-xl bg-green-600 hover:bg-green-700 text-white gap-2"
        >
          {loading
            ? <><span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Checking in...</>
            : <><LogIn className="h-5 w-5" />{hasAnySession ? 'Check In Again' : 'Check In'}</>}
        </Button>
      )}

      {!hasAnySession && (
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Your GPS location will be recorded
        </p>
      )}

      {/* Today's sessions list */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Today's Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                <div className="flex flex-col items-center">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                      <LogIn className="h-2.5 w-2.5 text-white" />
                    </div>
                    <span className="text-sm font-medium">{s.checkIn}</span>
                    {s.checkOut && (
                      <>
                        <span className="text-muted-foreground">→</span>
                        <div className="h-4 w-4 rounded-full bg-red-400 flex items-center justify-center">
                          <LogOut className="h-2.5 w-2.5 text-white" />
                        </div>
                        <span className="text-sm font-medium">{s.checkOut}</span>
                      </>
                    )}
                  </div>
                  {s.checkInMs && s.checkOutMs && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Duration: {msToHM(s.checkOutMs - s.checkInMs)}
                    </p>
                  )}
                  {s.lat && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-2.5 w-2.5" />
                      Location recorded
                    </p>
                  )}
                </div>
                {!s.checkOut && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Active</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
