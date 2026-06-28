import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, onValue, get, set, update, push } from 'firebase/database';
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval,
  addWeeks, subWeeks, isToday, getDay,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, LogIn, LogOut,
  Calendar, X, Clock, MapPin, ExternalLink,
  Plus, FileText, CheckCircle, XCircle, AlertCircle,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  format12h, msToHMS, msToHM,
  type AttendanceSession, type AttendanceRecord,
} from './EmployeeDashboard';
import { CameraVerifyModal } from './CameraVerifyModal';
import { notifyAdminFeed } from '@/services/notifications';

// ─── Regularization types ─────────────────────────────────────────────────────
type RegType = 'missed-checkin' | 'missed-checkout' | 'incorrect-time' | 'late-arrival' | 'early-departure';

const REG_TYPE_LABELS: Record<RegType, string> = {
  'missed-checkin':   'Missed Check-in',
  'missed-checkout':  'Missed Check-out',
  'incorrect-time':   'Incorrect Time',
  'late-arrival':     'Late Arrival',
  'early-departure':  'Early Departure',
};

interface RegRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  type: RegType;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: number;
  reviewedBy?: string;
  reviewNote?: string;
}

// ─── Reverse geocoding (Nominatim – free, no API key) ────────────────────────
const _geoCache = new Map<string, string>();

async function reverseGeocode(lat?: number | null, lng?: number | null): Promise<string | null> {
  if (!lat || !lng) return null;
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (_geoCache.has(key)) return _geoCache.get(key)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'TexwaveERP/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    // Pick the most useful level: neighbourhood → suburb → city_district → city → town → county → state
    const name =
      a.neighbourhood || a.suburb || a.city_district ||
      a.city || a.town || a.village || a.county || a.state || 'Unknown';
    _geoCache.set(key, name);
    return name;
  } catch {
    return null;
  }
}

// ─── Timeline constants ───────────────────────────────────────────────────────
const TL_START_H = 9;
const TL_END_H   = 21;
const TL_SPAN    = (TL_END_H - TL_START_H) * 60;
const TL_LABELS  = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function fmt12Label(h: number) {
  if (h === 12) return '12PM';
  if (h > 12)   return `${String(h - 12).padStart(2, '0')}PM`;
  return `${String(h).padStart(2, '0')}AM`;
}

function timeStrToMins(t: string): number | null {
  const m = t.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)/i);
  if (!m) return null;
  let h   = parseInt(m[1]);
  const min = parseInt(m[2]);
  const p   = m[3].toUpperCase();
  if (p === 'PM' && h !== 12) h += 12;
  if (p === 'AM' && h === 12) h  = 0;
  return h * 60 + min;
}

function toPercent(t: string): number | null {
  const mins = timeStrToMins(t);
  if (mins === null) return null;
  return Math.max(0, Math.min(100, ((mins - TL_START_H * 60) / TL_SPAN) * 100));
}

function nowPercent(): number {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, Math.min(100, ((mins - TL_START_H * 60) / TL_SPAN) * 100));
}

function getSessions(rec: AttendanceRecord): AttendanceSession[] {
  if (rec.sessions?.length) return rec.sessions;
  if (rec.checkIn) {
    return [{
      checkIn: rec.checkIn,
      checkInMs: rec.createdAt ?? 0,
      checkOut:    rec.checkOut,
      checkOutMs:  rec.checkOutAt,
    }];
  }
  return [];
}

function totalWorked(rec: AttendanceRecord | null): number {
  if (!rec) return 0;
  if (rec.totalWorkedMs) return rec.totalWorkedMs;
  if (rec.createdAt && rec.checkOutAt) return rec.checkOutAt - rec.createdAt;
  return 0;
}

// ─── Day type based on hours worked ──────────────────────────────────────────
const FULL_DAY_MS = 8 * 60 * 60 * 1000;  // 8 hours
const HALF_DAY_MS = 4 * 60 * 60 * 1000;  // 4 hours

type DayType = 'Full Day' | 'Half Day' | 'Short' | null;

function getDayType(workedMs: number): DayType {
  if (workedMs <= 0) return null;
  if (workedMs >= FULL_DAY_MS) return 'Full Day';
  if (workedMs >= HALF_DAY_MS) return 'Half Day';
  return 'Short';  // worked but < 4 hrs
}

const DAY_TYPE_STYLE: Record<NonNullable<DayType>, string> = {
  'Full Day': 'bg-green-100 text-green-700 border-green-200',
  'Half Day': 'bg-amber-100 text-amber-700 border-amber-200',
  'Short':    'bg-red-100   text-red-600   border-red-200',
};

const SHIFT_START_MINS = 10 * 60; // 10:00 AM

function lateBy(rec: AttendanceRecord | null): string | null {
  const sessions = rec ? getSessions(rec) : [];
  if (!sessions.length) return null;
  const mins = timeStrToMins(sessions[0].checkIn);
  if (mins === null || mins <= SHIFT_START_MINS) return null;
  const diff = mins - SHIFT_START_MINS;
  return `${String(Math.floor(diff / 60)).padStart(2, '0')}:${String(diff % 60).padStart(2, '0')}`;
}

// ─── Timeline bar ─────────────────────────────────────────────────────────────
function TimelineBar({
  sessions, isWeekend, isLiveToday,
}: {
  sessions: AttendanceSession[];
  isWeekend: boolean;
  isLiveToday: boolean;
}) {
  // For live today — animate the active session right edge
  const [livePct, setLivePct] = useState(nowPercent());
  useEffect(() => {
    if (!isLiveToday) return;
    const t = setInterval(() => setLivePct(nowPercent()), 30000);
    return () => clearInterval(t);
  }, [isLiveToday]);

  if (isWeekend) {
    return (
      <div className="relative h-8 flex items-center w-full">
        <div className="absolute inset-x-0 h-px bg-gray-100 top-1/2" />
      </div>
    );
  }

  return (
    <div className="relative h-8 flex items-center w-full select-none">
      {/* Background track */}
      <div className="absolute inset-x-0 h-px bg-gray-200 top-1/2" />

      {/* Hour ticks */}
      {TL_LABELS.map(h => {
        const pct = ((h - TL_START_H) / (TL_END_H - TL_START_H)) * 100;
        return (
          <div
            key={h}
            className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 bg-gray-200"
            style={{ left: `${pct}%` }}
          />
        );
      })}

      {sessions.length === 0 ? (
        // Empty state: faint dots at each hour
        TL_LABELS.map(h => {
          const pct = ((h - TL_START_H) / (TL_END_H - TL_START_H)) * 100;
          return (
            <div
              key={h}
              className="absolute h-2 w-2 rounded-full bg-gray-100 border border-gray-200 top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${pct}%` }}
            />
          );
        })
      ) : (
        sessions.map((s, i) => {
          const inPct  = toPercent(s.checkIn);
          const outPct = s.checkOut ? toPercent(s.checkOut) : null;
          const isActive = !s.checkOut;

          return (
            <span key={i}>
              {/* Green filled bar (completed session) */}
              {inPct !== null && outPct !== null && (
                <span
                  className="absolute h-0.5 bg-green-400 top-1/2 -translate-y-1/2"
                  style={{ left: `${inPct}%`, width: `${Math.max(0.3, outPct - inPct)}%` }}
                />
              )}
              {/* Active session — green bar expanding to live now */}
              {inPct !== null && isActive && (
                <span
                  className="absolute h-0.5 bg-green-400 top-1/2 -translate-y-1/2"
                  style={{ left: `${inPct}%`, width: `${Math.max(0.3, livePct - inPct)}%` }}
                />
              )}
              {/* Check-in dot (green) */}
              {inPct !== null && (
                <span
                  className="absolute h-3 w-3 rounded-full bg-green-500 border-2 border-white shadow top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                  style={{ left: `${inPct}%` }}
                />
              )}
              {/* Check-out dot (rose) */}
              {outPct !== null && (
                <span
                  className="absolute h-3 w-3 rounded-full bg-rose-400 border-2 border-white shadow top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                  style={{ left: `${outPct}%` }}
                />
              )}
              {/* Active pulse dot at live position */}
              {isActive && inPct !== null && (
                <span
                  className="absolute h-3 w-3 rounded-full bg-green-400 border-2 border-white shadow top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 animate-pulse"
                  style={{ left: `${livePct}%` }}
                />
              )}
            </span>
          );
        })
      )}
    </div>
  );
}

// ─── Detail side panel ────────────────────────────────────────────────────────
function DayDetailPanel({
  dateStr, record, onClose,
}: {
  dateStr: string;
  record: AttendanceRecord | null;
  onClose: () => void;
}) {
  const sessions = record ? getSessions(record) : [];
  const worked   = totalWorked(record);
  const firstIn  = sessions[0]?.checkIn ?? '—';
  const lastOut  = sessions.filter(s => s.checkOut).at(-1)?.checkOut ?? '—';
  const date     = new Date(dateStr + 'T00:00:00');

  // Location names keyed by "in-{i}" and "out-{i}"
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});
  const [locationLoading, setLocationLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Fetch location names for every session's lat/lng
    sessions.forEach(async (s, i) => {
      // Check-in location
      if (s.lat && s.lng) {
        const inKey = `in-${i}`;
        setLocationLoading(p => ({ ...p, [inKey]: true }));
        const name = await reverseGeocode(s.lat, s.lng);
        if (name) setLocationNames(p => ({ ...p, [inKey]: name }));
        setLocationLoading(p => ({ ...p, [inKey]: false }));
      }
      // Check-out location
      if (s.checkOutLat && s.checkOutLng) {
        const outKey = `out-${i}`;
        setLocationLoading(p => ({ ...p, [outKey]: true }));
        const name = await reverseGeocode(s.checkOutLat, s.checkOutLng);
        if (name) setLocationNames(p => ({ ...p, [outKey]: name }));
        setLocationLoading(p => ({ ...p, [outKey]: false }));
      }
    });
  }, [dateStr]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 h-full w-[380px] bg-white shadow-2xl z-50 flex flex-col border-l border-border">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="font-bold text-sm text-foreground">
              {format(date, 'EEE, dd MMM yyyy')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              General (10:00 AM – 7:00 PM)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-xs text-primary font-medium hover:underline">Audit History</button>
            <button
              onClick={onClose}
              className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Break info */}
        <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50 border-b border-border">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Break – 60 Mins
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-border" />
            Automatic Break
          </label>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Clock className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">No attendance recorded</p>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Column headers */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-500" /> Check In
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Check Out
                </p>
              </div>

              {/* Session pairs */}
              {sessions.map((s, i) => (
                <div key={i} className="grid grid-cols-2 gap-3 py-3 border-b border-border/50 last:border-0">

                  {/* ── Check-in cell ── */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                        <LogIn className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <span className="text-sm font-bold text-foreground">{s.checkIn}</span>
                    </div>

                    {/* Location */}
                    {s.lat && s.lng ? (
                      <div className="pl-10 flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 text-green-500 shrink-0" />
                          {locationLoading[`in-${i}`] ? (
                            <span className="text-[10px] text-muted-foreground animate-pulse">Locating…</span>
                          ) : locationNames[`in-${i}`] ? (
                            <span className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">
                              {locationNames[`in-${i}`]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                              Location recorded
                            </span>
                          )}
                        </div>
                        {/* View on map link */}
                        <a
                          href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 hover:underline w-fit"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          View on map
                        </a>
                      </div>
                    ) : (
                      <div className="pl-10">
                        <span className="text-[10px] text-muted-foreground/40">No location</span>
                      </div>
                    )}
                  </div>

                  {/* ── Check-out cell ── */}
                  <div className="flex flex-col gap-1">
                    {s.checkOut ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                            <LogOut className="h-3.5 w-3.5 text-rose-500" />
                          </div>
                          <div>
                            <span className="text-sm font-bold text-foreground">{s.checkOut}</span>
                            {s.checkInMs && s.checkOutMs && (
                              <p className="text-[10px] text-muted-foreground">{msToHM(s.checkOutMs - s.checkInMs)}</p>
                            )}
                          </div>
                        </div>

                        {/* Checkout location */}
                        {s.checkOutLat && s.checkOutLng ? (
                          <div className="pl-10 flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5 text-rose-400 shrink-0" />
                              {locationLoading[`out-${i}`] ? (
                                <span className="text-[10px] text-muted-foreground animate-pulse">Locating…</span>
                              ) : locationNames[`out-${i}`] ? (
                                <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">
                                  {locationNames[`out-${i}`]}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                  Location recorded
                                </span>
                              )}
                            </div>
                            <a
                              href={`https://www.google.com/maps?q=${s.checkOutLat},${s.checkOutLng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 hover:underline w-fit"
                              onClick={e => e.stopPropagation()}
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                              View on map
                            </a>
                          </div>
                        ) : (
                          <div className="pl-10">
                            <span className="text-[10px] text-muted-foreground/40">No location</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-8 w-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                        </div>
                        <span className="text-sm text-amber-600 font-medium">Active</span>
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom summary */}
        <div className="border-t border-border bg-gray-50 px-5 py-3 space-y-3">
          {/* Day type banner */}
          {(() => {
            const dayType = getDayType(worked);
            if (!dayType) return null;
            return (
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${DAY_TYPE_STYLE[dayType]}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${
                    dayType === 'Full Day' ? 'bg-green-500'
                    : dayType === 'Half Day' ? 'bg-amber-400'
                    : 'bg-red-400'
                  }`} />
                  <span className="text-xs font-bold">{dayType}</span>
                </div>
                <span className="text-[10px]">
                  {dayType === 'Full Day'  && '≥ 8 hrs worked'}
                  {dayType === 'Half Day'  && '≥ 4 hrs · counted as 0.5 day'}
                  {dayType === 'Short'     && '< 4 hrs · not counted'}
                </span>
              </div>
            );
          })()}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">First Check-In</p>
              <p className="text-xs font-bold text-foreground mt-0.5">{firstIn}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Last Check-Out</p>
              <p className="text-xs font-bold text-foreground mt-0.5">{lastOut}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Total Hours</p>
              <p className="text-xs font-bold text-foreground mt-0.5">
                {worked > 0 ? msToHM(worked) : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MyAttendance() {
  const { user } = useAuth();

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [weekRecords, setWeekRecords] = useState<Record<string, AttendanceRecord | null>>({});
  const [holidays, setHolidays] = useState<Record<string, string>>({});

  // Today's live record
  const [todayRecord, setTodayRecord]   = useState<AttendanceRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsed, setElapsed]           = useState('00:00:00');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Camera verification
  const [cameraAction, setCameraAction]     = useState<'in' | 'out' | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  // Selected day for detail panel
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Tab
  const [activeTab, setActiveTab] = useState<'summary' | 'regularization'>('summary');

  // Regularization
  const [regRequests, setRegRequests] = useState<RegRequest[]>([]);
  const [regDialogOpen, setRegDialogOpen] = useState(false);
  const [regDate, setRegDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [regType, setRegType] = useState<RegType>('missed-checkin');
  const [regCheckIn, setRegCheckIn] = useState('');
  const [regCheckOut, setRegCheckOut] = useState('');
  const [regReason, setRegReason] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays  = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // ── Live today record ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.employeeId) return;
    const unsub = onValue(ref(database, `hr/attendance/${today}/${user.employeeId}`), snap => {
      if (snap.exists()) {
        const v = snap.val();
        const rec: AttendanceRecord = !v.sessions
          ? { ...v, sessions: v.checkIn ? [{ checkIn: v.checkIn, checkInMs: v.createdAt ?? Date.now(), checkOut: v.checkOut, checkOutMs: v.checkOutAt, lat: v.lat, lng: v.lng }] : [], totalWorkedMs: (v.checkIn && v.checkOut && v.createdAt && v.checkOutAt) ? v.checkOutAt - v.createdAt : 0 }
          : v;
        setTodayRecord(rec);
      } else {
        setTodayRecord(null);
      }
    });
    return () => unsub();
  }, [user?.employeeId, today]);

  // ── Stopwatch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    const sessions  = todayRecord?.sessions ?? [];
    const last      = sessions[sessions.length - 1];
    const active    = last && !last.checkOut ? last : null;
    const completed = todayRecord?.totalWorkedMs ?? 0;
    if (active) {
      const start = active.checkInMs;
      const tick  = () => setElapsed(msToHMS(completed + (Date.now() - start)));
      tick();
      tickRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(msToHMS(completed));
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [todayRecord]);

  // ── Load week ─────────────────────────────────────────────────────────────
  const loadWeek = useCallback(async () => {
    if (!user?.employeeId) return;
    const records: Record<string, AttendanceRecord | null> = {};
    await Promise.all(weekDays.map(async d => {
      const ds   = format(d, 'yyyy-MM-dd');
      const snap = await get(ref(database, `hr/attendance/${ds}/${user.employeeId}`));
      if (snap.exists()) {
        const v = snap.val();
        records[ds] = !v.sessions
          ? { ...v, sessions: v.checkIn ? [{ checkIn: v.checkIn, checkInMs: v.createdAt ?? 0, checkOut: v.checkOut, checkOutMs: v.checkOutAt }] : [], totalWorkedMs: (v.checkIn && v.checkOut && v.createdAt && v.checkOutAt) ? v.checkOutAt - v.createdAt : 0 }
          : v;
      } else {
        records[ds] = null;
      }
    }));
    setWeekRecords(records);
  }, [user?.employeeId, format(weekStart, 'yyyy-MM-dd')]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  // ── Load holidays for visible week ────────────────────────────────────────
  useEffect(() => {
    const months = [...new Set(weekDays.map(d => format(d, 'yyyy-MM')))];
    Promise.all(months.map(async (month) => {
      const snap = await get(ref(database, `hr/holidays/${month}`));
      if (!snap.exists()) return {} as Record<string, string>;
      const data = snap.val();
      const result: Record<string, string> = {};
      Object.values(data).forEach((h: any) => {
        if (h.date && h.name) result[h.date] = h.name;
      });
      return result;
    })).then(results => {
      const merged: Record<string, string> = {};
      results.forEach(r => Object.assign(merged, r));
      setHolidays(merged);
    });
  }, [format(weekStart, 'yyyy-MM-dd')]);

  // Keep today live in week records
  useEffect(() => {
    if (todayRecord) setWeekRecords(p => ({ ...p, [today]: todayRecord }));
  }, [todayRecord, today]);

  // ── Load profile photo for face verification ──────────────────────────────
  useEffect(() => {
    if (!user?.firebaseKey) return;
    get(ref(database, `hr/employees/${user.firebaseKey}`)).then(snap => {
      if (snap.exists()) setProfilePhotoUrl(snap.val().profilePhoto ?? null);
    });
  }, [user?.firebaseKey]);

  // ── Load this employee's regularization requests ───────────────────────────
  useEffect(() => {
    if (!user?.employeeId) return;
    const unsub = onValue(ref(database, 'hr/regularizationRequests'), snap => {
      if (!snap.exists()) { setRegRequests([]); return; }
      const list: RegRequest[] = Object.entries(snap.val())
        .map(([id, v]: any) => ({ ...v, id }))
        .filter((r: RegRequest) => r.employeeId === user.employeeId)
        .sort((a: RegRequest, b: RegRequest) => b.submittedAt - a.submittedAt);
      setRegRequests(list);
    });
    return () => unsub();
  }, [user?.employeeId]);

  const handleRegSubmit = async () => {
    if (!user?.employeeId || !regReason.trim()) {
      toast.error('Please fill in a reason');
      return;
    }
    setRegSubmitting(true);
    try {
      const payload: Omit<RegRequest, 'id'> = {
        employeeId: user.employeeId,
        employeeName: user.name || '',
        date: regDate,
        type: regType,
        requestedCheckIn: regCheckIn || undefined,
        requestedCheckOut: regCheckOut || undefined,
        reason: regReason.trim(),
        status: 'pending',
        submittedAt: Date.now(),
      };
      await push(ref(database, 'hr/regularizationRequests'), payload);
      await notifyAdminFeed(
        `Regularization Request — ${user.name}`,
        `${REG_TYPE_LABELS[regType]} on ${regDate}. Reason: ${regReason.trim()}`,
        'attendance',
      );
      toast.success('Regularization request submitted');
      setRegDialogOpen(false);
      setRegReason('');
      setRegCheckIn('');
      setRegCheckOut('');
    } catch {
      toast.error('Failed to submit request');
    } finally {
      setRegSubmitting(false);
    }
  };

  // ── After camera verification passes — do the Firebase write ──────────────
  const handleVerified = async (loc: { lat: number; lng: number; accuracy: number } | null) => {
    const action = cameraAction;
    setCameraAction(null);
    if (!user?.employeeId || !action) return;
    setActionLoading(true);
    const now = new Date(); const nowMs = Date.now();

    try {
      if (action === 'in') {
        const newSession: AttendanceSession = { checkIn: format12h(now), checkInMs: nowMs, lat: loc?.lat ?? null, lng: loc?.lng ?? null };
        const existing = todayRecord?.sessions ?? [];
        if (!todayRecord) {
          await set(ref(database, `hr/attendance/${today}/${user.employeeId}`), {
            employeeId: user.employeeId, employeeName: user.name, date: today, status: 'Present',
            sessions: [newSession], totalWorkedMs: 0, checkIn: format12h(now), createdAt: nowMs,
          });
        } else {
          await update(ref(database, `hr/attendance/${today}/${user.employeeId}`), { sessions: [...existing, newSession], status: 'Present' });
        }
        toast.success(`Checked in at ${format12h(now)}`);
      } else if (action === 'out' && todayRecord) {
        const sessions = [...(todayRecord.sessions ?? [])];
        const lastIdx  = sessions.length - 1;
        const active   = sessions[lastIdx];
        const sesMs    = nowMs - (active.checkInMs ?? nowMs);
        sessions[lastIdx] = { ...active, checkOut: format12h(now), checkOutMs: nowMs, checkOutLat: loc?.lat ?? null, checkOutLng: loc?.lng ?? null };
        await update(ref(database, `hr/attendance/${today}/${user.employeeId}`), {
          sessions, totalWorkedMs: (todayRecord.totalWorkedMs ?? 0) + sesMs,
          checkOut: format12h(now), checkOutAt: nowMs, updatedAt: nowMs,
        });
        toast.success(`Checked out at ${format12h(now)}`);
      }
    } catch (err) {
      console.error('Attendance write failed:', err);
      toast.error('Failed to save attendance. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const todaySessions = todayRecord?.sessions ?? [];
  const lastSession   = todaySessions[todaySessions.length - 1];
  const isCheckedIn   = todaySessions.length > 0 && !!lastSession && !lastSession.checkOut;

  // Week stats
  let fullDays = 0, halfDays = 0, shortDays = 0, leave = 0, weekends = 0;
  weekDays.forEach(d => {
    if (getDay(d) === 0) { weekends++; return; }
    const rec = weekRecords[format(d, 'yyyy-MM-dd')];
    if (rec?.status === 'Leave') { leave++; return; }
    if (rec?.status === 'Present') {
      const type = getDayType(totalWorked(rec));
      if (type === 'Full Day') fullDays++;
      else if (type === 'Half Day') halfDays++;
      else if (type === 'Short') shortDays++;
    }
  });
  // Payable = full days + half days as 0.5 each
  const payableDays = fullDays + halfDays * 0.5;

  const dateRangeLabel = `${format(weekStart, 'dd MMM yyyy')} – ${format(weekEnd, 'dd MMM yyyy')}`;

  return (
    <div className="flex flex-col bg-white rounded-xl border border-border shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>

      {/* ── Tabs ── */}
      <div className="flex items-center border-b border-border px-5 pt-3 gap-6 shrink-0">
        <button
          onClick={() => setActiveTab('summary')}
          className={`text-sm pb-2.5 -mb-px transition-colors ${activeTab === 'summary' ? 'font-semibold text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Attendance Summary
        </button>
        <button
          onClick={() => setActiveTab('regularization')}
          className={`text-sm pb-2.5 -mb-px transition-colors flex items-center gap-1.5 ${activeTab === 'regularization' ? 'font-semibold text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Regularization
          {regRequests.filter(r => r.status === 'pending').length > 0 && (
            <span className="h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
              {regRequests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* ── Regularization tab ── */}
      {activeTab === 'regularization' && (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">My Regularization Requests</h3>
              <p className="text-xs text-muted-foreground">Raise a request for missed or incorrect attendance entries</p>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => { setRegDate(format(new Date(), 'yyyy-MM-dd')); setRegDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5" /> Raise Request
            </Button>
          </div>

          {regRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <FileText className="h-8 w-8 opacity-30" />
              <p className="text-sm">No regularization requests yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {regRequests.map(req => (
                <div key={req.id} className="border border-border rounded-lg px-4 py-3 flex items-start gap-4 bg-white hover:bg-gray-50/50 transition-colors">
                  <div className="shrink-0 mt-0.5">
                    {req.status === 'approved' ? <CheckCircle className="h-4 w-4 text-green-500" />
                      : req.status === 'rejected' ? <XCircle className="h-4 w-4 text-red-500" />
                      : <AlertCircle className="h-4 w-4 text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{format(new Date(req.date), 'dd MMM yyyy')}</span>
                      <Badge variant="outline" className="text-[10px] py-0">{REG_TYPE_LABELS[req.type]}</Badge>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        req.status === 'approved' ? 'bg-green-100 text-green-700'
                        : req.status === 'rejected' ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                      }`}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{req.reason}</p>
                    {(req.requestedCheckIn || req.requestedCheckOut) && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        {req.requestedCheckIn && `In: ${req.requestedCheckIn}`}
                        {req.requestedCheckIn && req.requestedCheckOut && '  •  '}
                        {req.requestedCheckOut && `Out: ${req.requestedCheckOut}`}
                      </p>
                    )}
                    {req.reviewedBy && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Reviewed by {req.reviewedBy}{req.reviewNote ? ` — "${req.reviewNote}"` : ''}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-[10px] text-muted-foreground">
                    {format(new Date(req.submittedAt), 'dd MMM, hh:mm a')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Week navigator ── */}
      {activeTab === 'summary' && <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentWeek(w => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{dateRangeLabel}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentWeek(w => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {actionLoading && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <span className="h-3 w-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            Saving...
          </span>
        )}
      </div>}

      {/* ── Shift bar + Check In/Out button ── */}
      {activeTab === 'summary' && <div className="flex items-center gap-3 px-5 py-2.5 bg-gray-50 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-md shrink-0">
          General [ 10:00 AM – 7:00 PM ]
        </span>
        <input
          type="text"
          placeholder="Add notes for check-in"
          className="flex-1 text-xs text-muted-foreground bg-transparent outline-none placeholder:text-gray-400 min-w-0"
        />
        <button
          onClick={() => setCameraAction(isCheckedIn ? 'out' : 'in')}
          disabled={actionLoading}
          className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-60 whitespace-nowrap ${
            isCheckedIn
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {actionLoading ? (
            <>
              <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {isCheckedIn ? 'Checking out...' : 'Checking in...'}
            </>
          ) : isCheckedIn ? (
            <>
              <LogOut className="h-3.5 w-3.5" />
              Check Out&nbsp;<span className="font-mono">{elapsed}</span>&nbsp;Hrs
            </>
          ) : (
            <>
              <span className={`h-2 w-2 rounded-full ${todaySessions.length > 0 ? 'bg-green-300' : 'bg-green-300 animate-pulse'}`} />
              <LogIn className="h-3.5 w-3.5" />
              Check in&nbsp;<span className="font-mono">{elapsed}</span>&nbsp;Hrs
            </>
          )}
        </button>
      </div>}

      {/* ── Day rows ── */}
      {activeTab === 'summary' && <div className="flex-1 overflow-y-auto min-h-0">
        {weekDays.map(day => {
          const ds        = format(day, 'yyyy-MM-dd');
          const rec       = weekRecords[ds] ?? null;
          const isWknd    = getDay(day) === 0;
          const isHoliday = !isWknd && (rec?.status === 'Holiday' || !!holidays[ds]);
          const isLeave   = !isWknd && !isHoliday && rec?.status === 'Leave';
          const todayDay  = isToday(day);
          const sessions  = (!isHoliday && !isLeave && rec) ? getSessions(rec) : [];
          const worked    = totalWorked(rec);
          const late      = lateBy(rec);
          const firstIn   = sessions[0]?.checkIn ?? null;
          const lastOut   = sessions.filter(s => s.checkOut).at(-1)?.checkOut ?? null;
          const hasActiveSession = sessions.some(s => !s.checkOut);
          const holidayName = holidays[ds] ?? rec?.notes?.replace('Auto: ', '') ?? 'Holiday';

          return (
            <div
              key={ds}
              onClick={() => !isWknd && !isHoliday && !isLeave && setSelectedDay(ds)}
              className={`flex items-stretch border-b border-border/50 transition-colors group ${
                isWknd    ? 'bg-gray-50/70 cursor-default'
                : isHoliday ? 'bg-purple-50/60 cursor-default'
                : isLeave   ? 'bg-amber-50/60 cursor-default'
                : 'cursor-pointer hover:bg-blue-50/40 active:bg-blue-50/60'
              } ${todayDay && !isWknd ? 'bg-blue-50/30' : ''}`}
            >
              {/* Day label */}
              <div className={`w-16 shrink-0 flex flex-col items-center justify-center py-3.5 ${isWknd ? 'opacity-40' : ''}`}>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {todayDay && !isWknd ? 'Today' : format(day, 'EEE')}
                </span>
                <div className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold ${
                  todayDay && !isWknd ? 'bg-primary text-white'
                  : isHoliday ? 'bg-purple-100 text-purple-700'
                  : isLeave   ? 'bg-amber-100 text-amber-700'
                  : 'text-foreground'
                }`}>
                  {format(day, 'd')}
                </div>
              </div>

              {/* Check-in / Holiday / Leave info */}
              <div className="w-28 shrink-0 flex flex-col justify-center py-3 px-1">
                {isHoliday ? (
                  <span className="text-[10px] font-semibold text-purple-600">🎉 Holiday</span>
                ) : isLeave ? (
                  <span className="text-[10px] font-semibold text-amber-600">🌴 On Leave</span>
                ) : !isWknd && firstIn ? (
                  <>
                    <span className="text-[10px] text-green-600 font-semibold">Office In</span>
                    <span className="text-xs font-bold text-foreground leading-tight">{firstIn}</span>
                    {late && (
                      <span className="text-[10px] font-semibold text-amber-500">Late by {late}</span>
                    )}
                  </>
                ) : !isWknd ? (
                  <span className="text-xs text-muted-foreground/30">—</span>
                ) : (
                  <span className="text-xs text-muted-foreground/20 text-center">Weekend</span>
                )}
              </div>

              {/* Timeline */}
              <div className="flex-1 flex items-center py-3 px-2 min-w-0">
                {isHoliday ? (
                  <div className="w-full flex items-center gap-2">
                    <div className="flex-1 h-px bg-purple-200" />
                    <span className="text-xs text-purple-500 font-medium px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200 shrink-0">
                      {holidayName}
                    </span>
                    <div className="flex-1 h-px bg-purple-200" />
                  </div>
                ) : isLeave ? (
                  <div className="w-full flex items-center gap-2">
                    <div className="flex-1 h-px bg-amber-200" />
                    <span className="text-xs text-amber-600 font-medium px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 shrink-0">
                      Approved Leave
                    </span>
                    <div className="flex-1 h-px bg-amber-200" />
                  </div>
                ) : (
                  <TimelineBar
                    sessions={sessions}
                    isWeekend={isWknd}
                    isLiveToday={todayDay && hasActiveSession}
                  />
                )}
              </div>

              {/* Check-out info */}
              <div className="w-28 shrink-0 flex flex-col justify-center py-3 px-1 text-right">
                {!isWknd && !isHoliday && !isLeave && lastOut ? (
                  <>
                    <span className="text-[10px] text-rose-500 font-semibold">Office Out</span>
                    <span className="text-xs font-bold text-foreground leading-tight">{lastOut}</span>
                  </>
                ) : !isWknd && !isHoliday && !isLeave && hasActiveSession ? (
                  <span className="text-[10px] text-amber-500 font-semibold animate-pulse">Active</span>
                ) : null}
              </div>

              {/* Hours worked + Day type badge */}
              <div className="w-28 shrink-0 flex flex-col justify-center items-end py-3 pr-4 gap-0.5">
                {!isWknd && (() => {
                  const dayType = getDayType(worked);
                  return (
                    <>
                      <span className={`text-sm font-bold leading-tight ${worked > 0 ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                        {worked > 0 ? msToHM(worked) : '00:00'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Hrs worked</span>
                      {/* Day type badge */}
                      {dayType && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${DAY_TYPE_STYLE[dayType]}`}>
                          {dayType}
                        </span>
                      )}
                      {sessions.length > 1 && (
                        <span className="text-[10px] text-blue-500">
                          {sessions.length} sessions
                        </span>
                      )}
                    </>
                  );
                })()}
                {!isWknd && !isHoliday && !isLeave && !isToday(day) && ds < today && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setRegDate(ds);
                      setRegDialogOpen(true);
                    }}
                    className="text-[9px] font-semibold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-700 hover:underline mt-0.5"
                  >
                    Regularize
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>}

      {/* ── Timeline hour labels ── */}
      {activeTab === 'summary' && <div className="flex items-stretch border-t border-border bg-gray-50/50 shrink-0">
        <div className="w-16 shrink-0" />
        <div className="w-28 shrink-0" />
        <div className="flex-1 relative h-6 px-2">
          {TL_LABELS.map(h => {
            const pct = ((h - TL_START_H) / (TL_END_H - TL_START_H)) * 100;
            return (
              <span key={h} className="absolute text-[9px] text-muted-foreground -translate-x-1/2 top-1.5" style={{ left: `${pct}%` }}>
                {fmt12Label(h)}
              </span>
            );
          })}
        </div>
        <div className="w-28 shrink-0" />
        <div className="w-28 shrink-0" />
      </div>}

      {/* ── Bottom stats bar ── */}
      {activeTab === 'summary' && <div className="flex items-center gap-0 border-t border-border bg-white px-4 py-2.5 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1.5 mr-5 shrink-0">
          <button className="text-xs font-bold text-primary border-b-2 border-primary pb-0.5">Days</button>
          <span className="text-muted-foreground/40 text-xs">|</span>
          <button className="text-xs text-muted-foreground hover:text-foreground">Hours</button>
        </div>

        {/* Payable (full + half*0.5) */}
        <div className="shrink-0">
          <p className="text-xs font-bold text-foreground">{payableDays} Days</p>
          <p className="text-[9px] text-muted-foreground">Payable Days</p>
        </div>

        {[
          { label: 'Full Day',  val: fullDays,  dot: 'bg-green-500',  text: 'text-green-700'  },
          { label: 'Half Day',  val: halfDays,  dot: 'bg-amber-400',  text: 'text-amber-700'  },
          { label: 'Short',     val: shortDays, dot: 'bg-red-400',    text: 'text-red-600'    },
          { label: 'Leave',     val: leave,     dot: 'bg-purple-400', text: 'text-purple-700' },
          { label: 'Weekend',   val: weekends,  dot: 'bg-gray-300',   text: 'text-gray-500'   },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-3 shrink-0">
            <div className="h-3.5 w-px bg-border mx-2" />
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${s.dot} shrink-0`} />
              <div>
                <p className={`text-xs font-bold ${s.text}`}>
                  {s.val} {s.val === 1 ? 'Day' : 'Days'}
                </p>
                <p className="text-[9px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Criteria legend */}
        <div className="ml-auto shrink-0 flex items-center gap-3">
          <div className="text-[9px] text-muted-foreground leading-relaxed border border-border rounded px-2 py-1 bg-gray-50">
            <span className="font-semibold text-green-600">≥ 8h</span> Full ·{' '}
            <span className="font-semibold text-amber-600">≥ 4h</span> Half ·{' '}
            <span className="font-semibold text-red-500">&lt; 4h</span> Short
          </div>
          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">
            General [10:00 AM...]
          </span>
        </div>
      </div>}

      {/* ── Day detail side panel ── */}
      {selectedDay && (
        <DayDetailPanel
          dateStr={selectedDay}
          record={weekRecords[selectedDay] ?? null}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {/* ── Camera verification modal ── */}
      {cameraAction && (
        <CameraVerifyModal
          action={cameraAction}
          profilePhotoUrl={profilePhotoUrl}
          onVerified={handleVerified}
          onCancel={() => setCameraAction(null)}
        />
      )}

      {/* ── Raise Regularization Request dialog ── */}
      <Dialog open={regDialogOpen} onOpenChange={setRegDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Raise Regularization Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={regDate}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => setRegDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={regType} onValueChange={v => setRegType(v as RegType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(REG_TYPE_LABELS) as [RegType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Requested Check-in</Label>
                <Input type="time" value={regCheckIn} onChange={e => setRegCheckIn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Requested Check-out</Label>
                <Input type="time" value={regCheckOut} onChange={e => setRegCheckOut(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Explain why regularization is needed..."
                value={regReason}
                onChange={e => setRegReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRegSubmit} disabled={regSubmitting || !regReason.trim()}>
              {regSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
