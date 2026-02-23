import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, onValue, set, update } from 'firebase/database';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, CheckCircle, AlertTriangle, Clock, Navigation } from 'lucide-react';

type GpsStatus = 'idle' | 'getting' | 'got' | 'denied';

interface AttendanceRecord {
  employeeId: string;
  employeeName: string;
  date: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  lat?: number;
  lng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  createdAt?: number;
  updatedAt?: number;
}

function format12h(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function accuracyColor(accuracy: number | null): string {
  if (accuracy === null) return 'text-gray-400';
  if (accuracy < 50) return 'text-green-600';
  if (accuracy < 200) return 'text-amber-500';
  return 'text-red-500';
}

function accuracyLabel(accuracy: number | null): string {
  if (accuracy === null) return 'Unknown';
  if (accuracy < 50) return 'High';
  if (accuracy < 200) return 'Medium';
  return 'Low';
}

export default function WebCheckin() {
  const { user } = useAuth();
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user?.employeeId) return;
    const attRef = ref(database, `hr/attendance/${today}/${user.employeeId}`);
    const unsub = onValue(attRef, (snap) => {
      setTodayRecord(snap.exists() ? snap.val() : null);
    });
    return () => unsub();
  }, [user?.employeeId, today]);

  const getLocation = (): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      setGpsStatus('getting');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy: acc } = pos.coords;
          setLat(latitude);
          setLng(longitude);
          setAccuracy(acc);
          setGpsStatus('got');
          resolve({ lat: latitude, lng: longitude, accuracy: acc });
        },
        () => {
          setGpsStatus('denied');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  };

  const doCheckIn = async () => {
    if (!user?.employeeId) return;
    setLoading(true);
    const location = await getLocation();
    if (!location) {
      toast.warning('Location unavailable — checking in without GPS');
    }
    const now = new Date();
    await set(ref(database, `hr/attendance/${today}/${user.employeeId}`), {
      employeeId: user.employeeId,
      employeeName: user.name,
      date: today,
      status: 'Present',
      checkIn: format12h(now),
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      createdAt: Date.now(),
    });
    toast.success('Checked in successfully!');
    setLoading(false);
  };

  const doCheckOut = async () => {
    if (!user?.employeeId) return;
    setLoading(true);
    const location = await getLocation();
    if (!location) {
      toast.warning('Location unavailable — checking out without GPS');
    }
    const now = new Date();
    await update(ref(database, `hr/attendance/${today}/${user.employeeId}`), {
      checkOut: format12h(now),
      checkOutLat: location?.lat ?? null,
      checkOutLng: location?.lng ?? null,
      updatedAt: Date.now(),
    });
    toast.success('Checked out successfully!');
    setLoading(false);
  };

  const alreadyDone = !!(todayRecord?.checkIn && todayRecord?.checkOut);
  const checkedIn = !!(todayRecord?.checkIn && !todayRecord?.checkOut);

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Attendance Check-In</h1>
        <p className="text-muted-foreground text-sm mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* GPS Status */}
      {gpsStatus !== 'idle' && (
        <Card className="border-border">
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
                    Accuracy: {accuracyLabel(accuracy)} ({Math.round(accuracy)}m)
                    · {lat?.toFixed(5)}, {lng?.toFixed(5)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Check-In Status Card */}
      {alreadyDone ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 pb-6 text-center">
            <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-green-800">Attendance Complete</h2>
            <p className="text-sm text-green-700 mt-1">
              Checked in: <span className="font-semibold">{todayRecord?.checkIn}</span>
            </p>
            <p className="text-sm text-green-700">
              Checked out: <span className="font-semibold">{todayRecord?.checkOut}</span>
            </p>
            <Badge className="mt-3 bg-green-600">Present</Badge>
          </CardContent>
        </Card>
      ) : checkedIn ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 pb-6 text-center">
            <Clock className="h-14 w-14 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-amber-800">Currently Checked In</h2>
            <p className="text-sm text-amber-700 mt-1">
              Since <span className="font-semibold">{todayRecord?.checkIn}</span>
            </p>
            {todayRecord?.lat && (
              <p className="text-xs text-amber-600 mt-1 flex items-center justify-center gap-1">
                <MapPin className="h-3 w-3" />
                Location recorded
              </p>
            )}
            <Button
              onClick={doCheckOut}
              disabled={loading || gpsStatus === 'getting'}
              className="mt-4 bg-amber-500 hover:bg-amber-600 text-white w-full h-14 text-lg font-semibold rounded-xl"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Checking out...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Check Out
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <MapPin className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-lg font-bold">Not Checked In Yet</h2>
            <p className="text-sm text-muted-foreground mt-1">Tap the button below to mark your attendance</p>
            <Button
              onClick={doCheckIn}
              disabled={loading || gpsStatus === 'getting'}
              className="mt-4 bg-green-600 hover:bg-green-700 text-white w-full h-14 text-lg font-semibold rounded-xl"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Checking in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Check In
                </span>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Your GPS location will be recorded
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
