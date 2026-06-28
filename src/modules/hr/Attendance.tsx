// src/modules/hr/Attendance.tsx
import { useEffect, useState, useMemo } from 'react';
import {
  Calendar, Search, Edit2, Save, XCircle, Download, Sun,
  ChevronLeft, ChevronRight, List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { ref, onValue, get, set } from 'firebase/database';
import { database } from '@/services/firebase';
import { createRecord, updateRecord, getAllRecords } from '@/services/firebase';
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval,
  addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth,
  getDay, isSameMonth, isToday
} from 'date-fns';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// Shift Configurations
const SHIFT_CONFIGS = {
  day: {
    name: 'Day Shift',
    start: 10.0,
    end: 18.5,
    lunchStart: 13.0,
    lunchEnd: 13.5,
    targetHours: 8.5,
    hasLunch: true,
  },
  night: {
    name: 'Night Shift',
    start: 16.0,
    end: 24.5,
    lunchStart: 20.0,
    lunchEnd: 20.5,
    targetHours: 8.5,
    hasLunch: true,
  },
  sunday: {
    name: 'Sunday Shift',
    start: 9.0,
    end: 13.0,
    targetHours: 4.0,
    hasLunch: false,
  },
};

// Helper: Convert decimal hours → "HH:MM" string
const formatHoursToHMM = (hours: number): string => {
  if (hours === 0) return '0:00';
  const h = Math.floor(Math.abs(hours));
  const m = Math.round(Math.abs(hours) % 1 * 60);
  return `${hours < 0 ? '-' : ''}${h}:${m.toString().padStart(2, '0')}`;
};

// Normalize time string — strip seconds from portal format "10:32:56 am" → "10:32 AM"
const normalizeTimeString = (t?: string): string => {
  if (!t || t.trim() === '') return '';
  const m = t.match(/^(\d{1,2}):(\d{2}):\d{2}\s*(AM|PM)$/i);
  if (m) return `${m[1]}:${m[2]} ${m[3].toUpperCase()}`;
  return t;
};

// Parse 12-hour time string → decimal hours (0-24)
// Handles both "10:32 AM" and portal format "10:32:56 am" (strips seconds)
const parseTimeString = (timeStr?: string): number | null => {
  if (!timeStr || timeStr.trim() === '') return null;
  const normalized = normalizeTimeString(timeStr);
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hour = parseInt(match[1]);
  const minute = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour + minute / 60;
};

// Convert decimal hours to 12-hour format time components
const decimalToTime12 = (decimalHour: number) => {
  const hour24 = Math.floor(decimalHour);
  const minute = Math.round((decimalHour % 1) * 60);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return {
    hour: String(hour12).padStart(2, '0'),
    minute: String(minute).padStart(2, '0'),
    period
  };
};

// Main calculation logic
const calculateWorkHours = (
  checkIn: string,
  lunchIn: string,
  lunchOut: string,
  checkOut: string,
  shiftType: 'day' | 'night' | 'sunday',
  manualStatus?: string
) => {
  const config = SHIFT_CONFIGS[shiftType];
  const ci = parseTimeString(checkIn);
  const li = parseTimeString(lunchIn);
  const lo = parseTimeString(lunchOut);
  const coRaw = parseTimeString(checkOut);

  // if in/out missing, treat as no work
  if (ci == null || coRaw == null) {
    return {
      workHrs: 0,
      otHrs: 0,
      pendingHrs: config.targetHours,
      actualWorkHrs: 0,
      autoStatus: null
    };
  }

  let co = coRaw;
  if (shiftType === 'night' && coRaw <= ci) {
    co = coRaw + 24;
  }

  if (co <= ci) {
    return {
      workHrs: 0,
      otHrs: 0,
      pendingHrs: config.targetHours,
      actualWorkHrs: 0,
      autoStatus: null
    };
  }

  let total = co - ci;

  let extraLunch = 0;
  if (config.hasLunch && li != null && lo != null) {
    let lunchInH = li;
    let lunchOutH = lo;

    if (shiftType === 'night' && lunchOutH <= lunchInH) {
      lunchOutH += 24;
    }

    if (lunchOutH > lunchInH) {
      const actualLunch = lunchOutH - lunchInH;
      extraLunch = Math.max(0, actualLunch - 0.5);
    }
  }

  let net = total - extraLunch;
  if (net < 0) net = 0;

  const target = config.targetHours;
  const workHrs = Math.min(net, target);
  const pendingHrs = net >= target ? 0 : target - net;

  return {
    workHrs: Number(workHrs.toFixed(4)),
    otHrs: 0,
    pendingHrs: Number(pendingHrs.toFixed(4)),
    actualWorkHrs: Number(net.toFixed(4)),
    autoStatus: null
  };
};

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  status: string;
}

interface AttendanceRecord {
  id?: string;
  employeeId: string;
  employeeName: string;
  status: string;
  shiftType: 'day' | 'night' | 'sunday';
  checkIn?: string;
  lunchIn?: string;
  lunchOut?: string;
  checkOut?: string;
  workHrs: number;
  otHrs: number;
  pendingHrs: number;
  totalHours: number;
  actualWorkHrs?: number;
  notes?: string;
  editing?: boolean;
  checkInHour?: string;
  checkInMinute?: string;
  checkInPeriod?: string;
  lunchInHour?: string;
  lunchInMinute?: string;
  lunchInPeriod?: string;
  lunchOutHour?: string;
  lunchOutMinute?: string;
  lunchOutPeriod?: string;
  checkOutHour?: string;
  checkOutMinute?: string;
  checkOutPeriod?: string;
}

// Map of dateStr → (employeeId → AttendanceRecord)
type DayAttendanceMap = Record<string, AttendanceRecord>;
type MultiDayData = Record<string, DayAttendanceMap>;

type ViewMode = 'daily' | 'week' | 'month';

const STATUS_CODES: Record<string, string> = {
  Present: 'P',
  Absent: 'A',
  'Half Day': 'HD',
  Leave: 'L',
  Holiday: 'HO',
  'Week Off': 'WO',
};

// ─── Admin Timeline (mirrors employee portal's TimelineBar) ───────────────────
const TL_START_H = 9;
const TL_END_H   = 21;
const TL_SPAN_M  = (TL_END_H - TL_START_H) * 60;
const TL_LABELS  = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function tlFmt12(h: number) {
  if (h === 12) return '12PM';
  if (h > 12)   return `${String(h - 12).padStart(2, '0')}PM`;
  return `${String(h).padStart(2, '0')}AM`;
}

function timeToTLPercent(t?: string): number | null {
  if (!t) return null;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const p = m[3].toUpperCase();
  if (p === 'PM' && h !== 12) h += 12;
  if (p === 'AM' && h === 12) h = 0;
  return Math.max(0, Math.min(100, ((h * 60 + min - TL_START_H * 60) / TL_SPAN_M) * 100));
}

interface AdminSession { checkIn: string; checkOut?: string; }

function AdminTimelineBar({ sessions, isWeekend }: { sessions: AdminSession[]; isWeekend: boolean }) {
  if (isWeekend) {
    return <div className="relative h-8 flex items-center w-full"><div className="absolute inset-x-0 h-px bg-gray-100 top-1/2" /></div>;
  }
  return (
    <div className="relative h-8 flex items-center w-full select-none">
      <div className="absolute inset-x-0 h-px bg-gray-200 top-1/2" />
      {TL_LABELS.map(h => {
        const pct = ((h - TL_START_H) / (TL_END_H - TL_START_H)) * 100;
        return <div key={h} className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 bg-gray-200" style={{ left: `${pct}%` }} />;
      })}
      {sessions.length === 0 ? (
        TL_LABELS.map(h => {
          const pct = ((h - TL_START_H) / (TL_END_H - TL_START_H)) * 100;
          return <div key={h} className="absolute h-2 w-2 rounded-full bg-gray-100 border border-gray-200 top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct}%` }} />;
        })
      ) : (
        sessions.map((s, i) => {
          const inPct  = timeToTLPercent(s.checkIn);
          const outPct = s.checkOut ? timeToTLPercent(s.checkOut) : null;
          return (
            <span key={i}>
              {inPct !== null && outPct !== null && (
                <span className="absolute h-0.5 bg-green-400 top-1/2 -translate-y-1/2" style={{ left: `${inPct}%`, width: `${Math.max(0.3, outPct - inPct)}%` }} />
              )}
              {inPct !== null && (
                <span className="absolute h-3 w-3 rounded-full bg-green-500 border-2 border-white shadow top-1/2 -translate-y-1/2 -translate-x-1/2 z-10" style={{ left: `${inPct}%` }} />
              )}
              {outPct !== null && (
                <span className="absolute h-3 w-3 rounded-full bg-rose-400 border-2 border-white shadow top-1/2 -translate-y-1/2 -translate-x-1/2 z-10" style={{ left: `${outPct}%` }} />
              )}
            </span>
          );
        })
      )}
    </div>
  );
}

export default function Attendance() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<any[]>([]);
  const [customHolidays, setCustomHolidays] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('daily');

  // Selected employee for week/month single-employee view
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');

  // Week view state
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [weekData, setWeekData] = useState<MultiDayData>({});
  const [weekLoading, setWeekLoading] = useState(false);

  // Month view state
  const [monthDate, setMonthDate] = useState<Date>(new Date());
  const [monthData, setMonthData] = useState<MultiDayData>({});
  const [monthLoading, setMonthLoading] = useState(false);

  const dateObj = new Date(selectedDate);
  const isSunday = dateObj.getDay() === 0;
  const currentShift = isSunday ? 'sunday' : 'day';

  // Fetch employees (real-time)
  useEffect(() => {
    const empRef = ref(database, 'hr/employees');
    const unsub = onValue(empRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.keys(data)
        .map(key => ({ ...data[key], id: key }))
        .filter((e: any) => e.status !== 'inactive');
      setEmployees(list);
    });
    return () => unsub();
  }, []);

  // Fetch approved leaves
  useEffect(() => {
    const leavesRef = ref(database, 'hr/leaves');
    const unsub = onValue(leavesRef, (snap) => {
      const data = snap.val() || {};
      const leaves: any[] = [];
      Object.values(data).forEach((l: any) => {
        if (l.status === 'Approved') {
          leaves.push({
            employeeId: l.employeeId,
            startDate: l.startDate,
            endDate: l.endDate,
            employeeName: l.employeeName
          });
        }
      });
      setApprovedLeaves(leaves);
    });
    return () => unsub();
  }, []);

  // Fetch ALL custom holidays across all months (real-time)
  useEffect(() => {
    const holidaysRef = ref(database, 'hr/holidays');
    const unsub = onValue(holidaysRef, (snap) => {
      const data = snap.val() || {};
      const list: any[] = [];
      Object.values(data).forEach((monthData: any) => {
        if (monthData && typeof monthData === 'object') {
          Object.values(monthData).forEach((holiday: any) => {
            if (holiday) list.push(holiday);
          });
        }
      });
      setCustomHolidays(list);
    });
    return () => unsub();
  }, []);

  // Auto-mark custom holidays
  useEffect(() => {
    if (employees.length === 0) return;

    const applyCustomHolidays = async () => {
      const holiday = customHolidays.find(h => h.date === selectedDate);
      if (!holiday) return;

      const attRef = ref(database, `hr/attendance/${selectedDate}`);
      const snapshot = await get(attRef);
      const existing = snapshot.val() || {};

      const applicableDepts = holiday.departments.includes('All')
        ? ['Staff', 'Worker', 'Other Workers']
        : holiday.departments;

      for (const emp of employees) {
        if (!applicableDepts.includes(emp.department)) continue;
        if (existing[emp.id]) continue;

        const payload = {
          employeeId: emp.id,
          employeeName: emp.name,
          date: selectedDate,
          status: 'Holiday',
          shiftType: currentShift,
          checkIn: '', lunchIn: '', lunchOut: '', checkOut: '',
          workHrs: 0, otHrs: 0, pendingHrs: 0, totalHours: 0,
          actualWorkHrs: 0,
          notes: holiday.name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await set(ref(database, `hr/attendance/${selectedDate}/${emp.id}`), payload);
      }
    };

    applyCustomHolidays();
  }, [selectedDate, customHolidays, employees, currentShift]);

  // Fetch attendance
  useEffect(() => {
    const attRef = ref(database, `hr/attendance/${selectedDate}`);
    const unsub = onValue(attRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setAttendance([]);
        return;
      }
      const list: AttendanceRecord[] = Object.entries(data).map(([id, val]: any) => {
        const rec: AttendanceRecord = {
          ...val,
          id,
          editing: false,
          shiftType: val.shiftType || (isSunday ? 'sunday' : 'day')
        };
        const parseTime = (t?: string) => {
          if (!t) return null;
          const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (!m) return null;
          return { hour: m[1].padStart(2, '0'), minute: m[2], period: m[3].toUpperCase() };
        };
        ['checkIn', 'lunchIn', 'lunchOut', 'checkOut'].forEach(time => {
          const parsed = parseTime(rec[time as keyof AttendanceRecord] as string);
          if (parsed) {
            rec[`${time}Hour` as keyof AttendanceRecord] = parsed.hour as any;
            rec[`${time}Minute` as keyof AttendanceRecord] = parsed.minute as any;
            rec[`${time}Period` as keyof AttendanceRecord] = parsed.period as any;
          }
        });
        return rec;
      });
      setAttendance(list);
    });
    return () => unsub();
  }, [selectedDate, isSunday]);

  // Load week data from Firebase (real-time listeners per day)
  useEffect(() => {
    if (viewMode !== 'week') return;
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    setWeekLoading(true);
    const result: MultiDayData = {};
    const unsubs: (() => void)[] = [];
    let initialLoads = 0;

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      result[dateStr] = {};
      let firstLoad = true;
      const unsub = onValue(ref(database, `hr/attendance/${dateStr}`), (snap) => {
        result[dateStr] = (snap.val() || {}) as DayAttendanceMap;
        if (firstLoad) {
          firstLoad = false;
          initialLoads++;
          if (initialLoads >= days.length) setWeekLoading(false);
        }
        setWeekData({ ...result });
      });
      unsubs.push(unsub);
    });

    return () => { unsubs.forEach(u => u()); };
  }, [viewMode, weekStart]);

  // Load month data from Firebase (real-time listeners per day)
  useEffect(() => {
    if (viewMode !== 'month') return;
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);
    const days = eachDayOfInterval({ start: mStart, end: mEnd });

    setMonthLoading(true);
    const result: MultiDayData = {};
    const unsubs: (() => void)[] = [];
    let initialLoads = 0;

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      result[dateStr] = {};
      let firstLoad = true;
      const unsub = onValue(ref(database, `hr/attendance/${dateStr}`), (snap) => {
        result[dateStr] = (snap.val() || {}) as DayAttendanceMap;
        if (firstLoad) {
          firstLoad = false;
          initialLoads++;
          if (initialLoads >= days.length) setMonthLoading(false);
        }
        setMonthData({ ...result });
      });
      unsubs.push(unsub);
    });

    return () => { unsubs.forEach(u => u()); };
  }, [viewMode, monthDate]);

  const isOnLeaveToday = (empId: string) => {
    return approvedLeaves.some(leave =>
      leave.employeeId === empId &&
      selectedDate >= leave.startDate &&
      selectedDate <= leave.endDate
    );
  };

  const isOnLeaveOnDate = (empId: string, dateStr: string) => {
    return approvedLeaves.some(leave =>
      leave.employeeId === empId &&
      dateStr >= leave.startDate &&
      dateStr <= leave.endDate
    );
  };

  const isHolidayOnDate = (empDepartment: string, dateStr: string) => {
    const holiday = customHolidays.find(h => h.date === dateStr);
    if (!holiday) return null;
    const applicable = holiday.departments.includes('All') || holiday.departments.includes(empDepartment);
    return applicable ? holiday.name : null;
  };

  const getHolidayDisplay = (empDepartment: string) => {
    const holiday = customHolidays.find(h => h.date === selectedDate);
    if (!holiday) return null;
    const applicable = holiday.departments.includes('All') || holiday.departments.includes(empDepartment);
    return applicable ? holiday.name : null;
  };

  const getCurrentTime12 = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return { hour: hour12.toString().padStart(2, '0'), minute: m.toString().padStart(2, '0'), period };
  };

  const markAttendance = async (
    empId: string,
    name: string,
    status: 'Present' | 'Absent' | 'Half Day' | 'Leave' | 'Holiday' | 'Week Off',
    shiftType: 'day' | 'night' | 'sunday',
    inH?: string, inM?: string, inP?: string,
    liH?: string, liM?: string, liP?: string,
    loH?: string, loM?: string, loP?: string,
    outH?: string, outM?: string, outP?: string
  ) => {
    try {
      const existing = attendance.find(a => a.employeeId === empId);
      const now = getCurrentTime12();
      const config = SHIFT_CONFIGS[shiftType];

      let finalCheckIn = '';
      let finalLunchIn = '';
      let finalLunchOut = '';
      let finalCheckOut = '';

      // Allow check-in/check-out for Present, Half Day, AND Absent
      if (status === 'Present' || status === 'Half Day' || status === 'Absent') {
        // Use provided times OR existing times OR current time as fallback
        finalCheckIn = inH && inM && inP
          ? `${parseInt(inH)}:${inM} ${inP}`
          : (existing?.checkIn || `${now.hour}:${now.minute} ${now.period}`);

        if (config.hasLunch) {
          const lunchInTime = decimalToTime12(config.lunchStart);
          const lunchOutTime = decimalToTime12(config.lunchEnd);
          finalLunchIn = liH && liM && liP
            ? `${parseInt(liH)}:${liM} ${liP}`
            : (existing?.lunchIn || `${parseInt(lunchInTime.hour)}:${lunchInTime.minute} ${lunchInTime.period}`);
          finalLunchOut = loH && loM && loP
            ? `${parseInt(loH)}:${loM} ${loP}`
            : (existing?.lunchOut || `${parseInt(lunchOutTime.hour)}:${lunchOutTime.minute} ${lunchOutTime.period}`);
        }

        finalCheckOut = outH && outM && outP
          ? `${parseInt(outH)}:${outM} ${outP}`
          : (existing?.checkOut || '');
      }

      const calculationResult = calculateWorkHours(
        finalCheckIn,
        finalLunchIn,
        finalLunchOut,
        finalCheckOut,
        shiftType,
        status
      );

      const finalStatus = status;
      let finalNotes = '';

      if (status === 'Absent' && finalCheckIn && finalCheckOut) {
        finalNotes = 'Absent with check-in/out times';
      } else if (status === 'Holiday') {
        finalNotes = getHolidayDisplay(name.split(' ')[0]) || 'Holiday';
      }

      const payload = {
        employeeId: empId,
        employeeName: name,
        date: selectedDate,
        status: finalStatus,
        shiftType,
        checkIn: finalCheckIn,
        lunchIn: finalLunchIn,
        lunchOut: finalLunchOut,
        checkOut: finalCheckOut,
        workHrs: calculationResult.workHrs,
        otHrs: 0,
        pendingHrs: calculationResult.pendingHrs,
        totalHours: calculationResult.workHrs,
        actualWorkHrs: calculationResult.actualWorkHrs,
        notes: finalNotes,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      if (existing?.id) {
        await updateRecord(`hr/attendance/${selectedDate}`, existing.id, payload);
        toast({ title: 'Attendance updated successfully' });
      } else {
        await createRecord(`hr/attendance/${selectedDate}`, payload);
        toast({ title: 'Attendance marked successfully' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to save attendance', variant: 'destructive' });
    }
  };

  const startEditing = (id: string) => {
    setAttendance(prev => prev.map(a => ({ ...a, editing: a.id === id })));
  };

  const cancelEditing = () => {
    setAttendance(prev => prev.map(a => ({ ...a, editing: false })));
  };

  const saveEdit = async (record: AttendanceRecord) => {
    await markAttendance(
      record.employeeId!,
      record.employeeName!,
      record.status as any,
      record.shiftType || currentShift,
      record.checkInHour, record.checkInMinute, record.checkInPeriod,
      record.lunchInHour, record.lunchInMinute, record.lunchInPeriod,
      record.lunchOutHour, record.lunchOutMinute, record.lunchOutPeriod,
      record.checkOutHour, record.checkOutMinute, record.checkOutPeriod
    );
    cancelEditing();
  };

  const getRecord = (empId: string) => attendance.find(a => a.employeeId === empId);

  // Fix 1: Match portal records (keyed by EMP0001) AND admin records (keyed by Firebase push key)
  const getRecordForEmployee = (emp: Employee) =>
    attendance.find(a => a.employeeId === emp.id || a.employeeId === emp.employeeId);

  // Fix 2: Use portal's totalWorkedMs when available (most accurate), else calculate from times
  const getWorkHours = (rec: AttendanceRecord | undefined, shiftType: 'day' | 'night' | 'sunday') => {
    const config = SHIFT_CONFIGS[shiftType];
    if (!rec) return { workHrs: 0, pendingHrs: config.targetHours, actualWorkHrs: 0 };
    const totalWorkedMs = (rec as any).totalWorkedMs;
    if (totalWorkedMs && totalWorkedMs > 0) {
      const actualHrs = Number((totalWorkedMs / 3600000).toFixed(4));
      const workHrs = Number(Math.min(actualHrs, config.targetHours).toFixed(4));
      const pendingHrs = Number(Math.max(0, config.targetHours - actualHrs).toFixed(4));
      return { workHrs, pendingHrs, actualWorkHrs: actualHrs };
    }
    if (!rec.checkIn || !rec.checkOut) return { workHrs: 0, pendingHrs: config.targetHours, actualWorkHrs: 0 };
    return calculateWorkHours(rec.checkIn, rec.lunchIn || '', rec.lunchOut || '', rec.checkOut, shiftType);
  };

  // Fix 3: Use portal sessions array for multi-session timeline bars
  const getSessionsForRecord = (rec: AttendanceRecord | undefined): AdminSession[] => {
    if (!rec?.checkIn) return [];
    const portalSessions = (rec as any).sessions;
    if (Array.isArray(portalSessions) && portalSessions.length > 0) {
      return portalSessions
        .filter((s: any) => s.checkIn)
        .map((s: any) => ({ checkIn: normalizeTimeString(s.checkIn), checkOut: s.checkOut ? normalizeTimeString(s.checkOut) : undefined }));
    }
    return [{ checkIn: normalizeTimeString(rec.checkIn), checkOut: rec.checkOut ? normalizeTimeString(rec.checkOut) : undefined }];
  };

  const getBadgeClass = (status?: string) => {
    const map: Record<string, string> = {
      Present: 'bg-emerald-100 text-emerald-800',
      Absent: 'bg-red-100 text-red-800',
      'Half Day': 'bg-amber-100 text-amber-800',
      Leave: 'bg-blue-100 text-blue-800',
      Holiday: 'bg-purple-100 text-purple-800',
      'Week Off': 'bg-gray-100 text-gray-700',
    };
    return map[status || ''] || 'bg-gray-100 text-gray-600';
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = emp.name.toLowerCase().includes(search) ||
        emp.employeeId.toLowerCase().includes(search) ||
        emp.department.toLowerCase().includes(search);
      const matchesDept = departmentFilter === 'all' || emp.department === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [employees, searchTerm, departmentFilter]);

  const presentCount = attendance.filter(a => a.status === 'Present').length;
  const absentCount = attendance.filter(a => a.status === 'Absent').length;
  const halfDayCount = attendance.filter(a => a.status === 'Half Day').length;
  const totalHours = attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0);
  const avgHours = presentCount > 0 ? totalHours / presentCount : 0;

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Shift', 'Status', 'Check In', 'Lunch In', 'Lunch Out', 'Check Out', 'Actual Hrs', 'Work Hrs', 'Pending Hrs'];
    const rows = filteredEmployees.map(emp => {
      const record = getRecordForEmployee(emp);
      const shiftType = ((record?.shiftType || currentShift) as 'day' | 'night' | 'sunday');
      const onLeave = isOnLeaveToday(emp.id);
      const holidayName = getHolidayDisplay(emp.department);
      const status = holidayName ? holidayName : onLeave ? 'Leave' : (record?.status || 'Not Marked');
      const hrs = getWorkHours(record, shiftType);
      return [
        emp.employeeId,
        emp.name,
        SHIFT_CONFIGS[shiftType].name,
        status,
        normalizeTimeString(record?.checkIn) || '',
        normalizeTimeString(record?.lunchIn) || '',
        normalizeTimeString(record?.lunchOut) || '',
        normalizeTimeString(record?.checkOut) || '',
        formatHoursToHMM(hrs.actualWorkHrs),
        formatHoursToHMM(hrs.workHrs),
        formatHoursToHMM(hrs.pendingHrs)
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Helpers for week/month cell status ─────────────────────────────────────
  const getCellStatus = (
    emp: Employee,
    dateStr: string,
    dataMap: MultiDayData
  ): { status: string | null; checkIn?: string; totalHours?: number } => {
    const dayRecords = dataMap[dateStr] || {};
    // Check by Firebase push key (admin records) AND by EMP000X (portal records)
    const rec = (dayRecords[emp.id] || dayRecords[emp.employeeId]) as AttendanceRecord | undefined;

    if (rec && rec.status) {
      const hrs = getWorkHours(rec, (rec.shiftType || 'day') as 'day' | 'night' | 'sunday');
      return { status: rec.status, checkIn: normalizeTimeString(rec.checkIn), totalHours: hrs.workHrs };
    }

    // Check leave
    if (isOnLeaveOnDate(emp.id, dateStr)) {
      return { status: 'Leave' };
    }

    // Check holiday
    const holiday = isHolidayOnDate(emp.department, dateStr);
    if (holiday) {
      return { status: 'Holiday' };
    }

    return { status: null };
  };

  const getWeekCellBadge = (emp: Employee, day: Date, dataMap: MultiDayData) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayTime = new Date(day);
    dayTime.setHours(0, 0, 0, 0);
    const dayOfWeek = getDay(day); // 0=Sunday only
    const isWeekend = dayOfWeek === 0;
    const isFuture = dayTime > today;

    if (isWeekend) {
      const { status, checkIn, totalHours: th } = getCellStatus(emp, dateStr, dataMap);
      if (status) {
        return { label: status, sub: checkIn || '', color: getBadgeClass(status), hours: th || 0 };
      }
      return { label: 'Weekend', sub: '', color: 'bg-gray-100 text-gray-500', hours: 0 };
    }

    const { status, checkIn, totalHours: th } = getCellStatus(emp, dateStr, dataMap);
    if (status) {
      return { label: status, sub: checkIn || '', color: getBadgeClass(status), hours: th || 0 };
    }

    if (isFuture) {
      return { label: '—', sub: '', color: 'bg-gray-50 text-gray-400', hours: 0 };
    }

    return { label: 'Not Marked', sub: '', color: 'bg-gray-100 text-gray-500', hours: 0 };
  };

  // ─── Week / Month shared ─────────────────────────────────────────────────────
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekLabel = `${format(weekStart, 'd MMM yyyy')} – ${format(weekEnd, 'd MMM yyyy')}`;

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthLabel = format(monthDate, 'MMMM yyyy');

  // Month stats helper (used by month view)
  const getEmployeeMonthStats = (emp: Employee, dataMap: MultiDayData) => {
    let present = 0, absent = 0, leave = 0, halfDay = 0;
    eachDayOfInterval({ start: monthStart, end: monthEnd }).forEach(day => {
      const { status } = getCellStatus(emp, format(day, 'yyyy-MM-dd'), dataMap);
      if (status === 'Present') present++;
      else if (status === 'Absent') absent++;
      else if (status === 'Leave') leave++;
      else if (status === 'Half Day') halfDay++;
    });
    return { present, absent, leave, halfDay };
  };

  // Resolve which employee to show in week/month single-employee views
  const empForView = employees.find(e => e.id === selectedEmpId) || employees[0];

  // ─── Week View (employee-portal timeline style) ───────────────────────────────
  const renderWeekView = () => {
    // Per-week stats for selected employee
    const FULL_DAY_HRS = 8;
    const HALF_DAY_HRS = 4;
    let fullDays = 0, halfDays = 0, absentDays = 0, leaveDays = 0;
    weekDays.forEach(day => {
      const dow = getDay(day);
      if (dow === 0) return;
      const ds = format(day, 'yyyy-MM-dd');
      const rec = empForView ? (weekData[ds] || {})[empForView.id] as AttendanceRecord | undefined : undefined;
      if (!rec) { absentDays++; return; }
      if (rec.status === 'Leave') leaveDays++;
      else if (rec.status === 'Present' || rec.status === 'Half Day') {
        if ((rec.workHrs || 0) >= FULL_DAY_HRS) fullDays++;
        else if ((rec.workHrs || 0) >= HALF_DAY_HRS) halfDays++;
        else absentDays++;
      }
    });

    return (
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Header: employee picker + week navigator */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600 shrink-0">Employee:</span>
            <Select value={empForView?.id || ''} onValueChange={setSelectedEmpId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">{weekLabel}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Today
            </Button>
          </div>
        </div>

        {/* Shift label */}
        <div className="flex items-center gap-3 px-5 py-2 bg-gray-50 border-b border-border">
          <span className="text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-md">
            General [ 10:00 AM – 7:00 PM ]
          </span>
          {empForView && (
            <span className="text-xs text-gray-400">{empForView.department}</span>
          )}
        </div>

        {weekLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
            <span className="ml-3 text-gray-500">Loading week data…</span>
          </div>
        ) : (
          <>
            {/* Day rows */}
            <div>
              {weekDays.map(day => {
                const ds = format(day, 'yyyy-MM-dd');
                const dow = getDay(day);
                const isWknd = dow === 0;
                const todayDay = isToday(day);
                // Check by both push key and EMP000X for portal records
                const dayMap = weekData[ds] || {};
                const rec = empForView
                  ? ((dayMap[empForView.id] || dayMap[empForView.employeeId]) as AttendanceRecord | undefined)
                  : undefined;
                const isLeaveDay = isOnLeaveOnDate(empForView?.id || '', ds);
                const holidayName = isHolidayOnDate(empForView?.department || '', ds);
                const sessions: AdminSession[] = (!holidayName && !isLeaveDay)
                  ? getSessionsForRecord(rec)
                  : [];
                const firstIn = rec?.checkIn ? normalizeTimeString(rec.checkIn) : null;
                const lastOut = rec?.checkOut ? normalizeTimeString(rec.checkOut) : null;

                // Late-by calculation (vs 10:00 AM)
                let lateStr: string | null = null;
                if (firstIn) {
                  const ciDecimal = parseTimeString(firstIn);
                  if (ciDecimal !== null) {
                    const diff = Math.round((ciDecimal - 10) * 60);
                    if (diff > 0) lateStr = `${String(Math.floor(diff / 60)).padStart(2, '0')}:${String(diff % 60).padStart(2, '0')}`;
                  }
                }

                return (
                  <div
                    key={ds}
                    className={`flex items-stretch border-b border-border/50 transition-colors ${
                      isWknd ? 'bg-gray-50/70'
                      : holidayName ? 'bg-purple-50/60'
                      : isLeaveDay || rec?.status === 'Leave' ? 'bg-amber-50/60'
                      : todayDay ? 'bg-blue-50/30'
                      : 'bg-white'
                    }`}
                  >
                    {/* Day label */}
                    <div className={`w-16 shrink-0 flex flex-col items-center justify-center py-3.5 ${isWknd ? 'opacity-40' : ''}`}>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {todayDay && !isWknd ? 'Today' : format(day, 'EEE')}
                      </span>
                      <div className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        todayDay && !isWknd ? 'bg-blue-600 text-white'
                        : holidayName ? 'bg-purple-100 text-purple-700'
                        : isLeaveDay || rec?.status === 'Leave' ? 'bg-amber-100 text-amber-700'
                        : 'text-foreground'
                      }`}>
                        {format(day, 'd')}
                      </div>
                    </div>

                    {/* Check-in info */}
                    <div className="w-28 shrink-0 flex flex-col justify-center py-3 px-1">
                      {holidayName ? (
                        <span className="text-[10px] font-semibold text-purple-600">Holiday</span>
                      ) : isLeaveDay || rec?.status === 'Leave' ? (
                        <span className="text-[10px] font-semibold text-amber-600">On Leave</span>
                      ) : !isWknd && firstIn ? (
                        <>
                          <span className="text-[10px] text-green-600 font-semibold">Office In</span>
                          <span className="text-xs font-bold text-foreground leading-tight">{firstIn}</span>
                          {lateStr && <span className="text-[10px] font-semibold text-amber-500">Late by {lateStr}</span>}
                        </>
                      ) : !isWknd ? (
                        <span className="text-xs text-muted-foreground/30">—</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/20 text-center">Weekend</span>
                      )}
                    </div>

                    {/* Timeline */}
                    <div className="flex-1 flex items-center py-3 px-2 min-w-0">
                      {holidayName ? (
                        <div className="w-full flex items-center gap-2">
                          <div className="flex-1 h-px bg-purple-200" />
                          <span className="text-xs text-purple-500 font-medium px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200 shrink-0">{holidayName}</span>
                          <div className="flex-1 h-px bg-purple-200" />
                        </div>
                      ) : isLeaveDay || rec?.status === 'Leave' ? (
                        <div className="w-full flex items-center gap-2">
                          <div className="flex-1 h-px bg-amber-200" />
                          <span className="text-xs text-amber-600 font-medium px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 shrink-0">Approved Leave</span>
                          <div className="flex-1 h-px bg-amber-200" />
                        </div>
                      ) : (
                        <AdminTimelineBar sessions={sessions} isWeekend={isWknd} />
                      )}
                    </div>

                    {/* Check-out info */}
                    <div className="w-28 shrink-0 flex flex-col justify-center py-3 px-1 text-right">
                      {!isWknd && !holidayName && !(isLeaveDay || rec?.status === 'Leave') && lastOut ? (
                        <>
                          <span className="text-[10px] text-rose-500 font-semibold">Office Out</span>
                          <span className="text-xs font-bold text-foreground leading-tight">{lastOut}</span>
                        </>
                      ) : null}
                    </div>

                    {/* Hours worked + badge */}
                    <div className="w-28 shrink-0 flex flex-col justify-center items-end py-3 pr-4 gap-0.5">
                      {!isWknd && (() => {
                        const recShift = (rec?.shiftType || 'day') as 'day' | 'night' | 'sunday';
                        const { workHrs: hrs } = getWorkHours(rec, recShift);
                        const badgeMap: Record<string, string> = {
                          full: 'bg-green-100 text-green-700 border-green-200',
                          half: 'bg-amber-100 text-amber-700 border-amber-200',
                          short: 'bg-red-100 text-red-600 border-red-200',
                        };
                        const badgeKey = hrs >= 8 ? 'full' : hrs >= 4 ? 'half' : hrs > 0 ? 'short' : '';
                        const badgeLabel = hrs >= 8 ? 'Full Day' : hrs >= 4 ? 'Half Day' : hrs > 0 ? 'Short' : '';
                        return (
                          <>
                            <span className={`text-sm font-bold leading-tight ${hrs > 0 ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                              {hrs > 0 ? formatHoursToHMM(hrs) : '00:00'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">Hrs worked</span>
                            {badgeLabel && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeMap[badgeKey]}`}>
                                {badgeLabel}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Timeline hour labels */}
            <div className="flex items-stretch border-t border-border bg-gray-50/50">
              <div className="w-16 shrink-0" />
              <div className="w-28 shrink-0" />
              <div className="flex-1 relative h-6 px-2">
                {TL_LABELS.map(h => {
                  const pct = ((h - TL_START_H) / (TL_END_H - TL_START_H)) * 100;
                  return (
                    <span key={h} className="absolute text-[9px] text-muted-foreground -translate-x-1/2 top-1.5" style={{ left: `${pct}%` }}>
                      {tlFmt12(h)}
                    </span>
                  );
                })}
              </div>
              <div className="w-28 shrink-0" />
              <div className="w-28 shrink-0" />
            </div>

            {/* Bottom stats bar */}
            <div className="flex items-center gap-0 border-t border-border bg-white px-4 py-2.5 overflow-x-auto">
              {[
                { label: 'Full Day',  val: fullDays,   dot: 'bg-green-500',  text: 'text-green-700' },
                { label: 'Half Day',  val: halfDays,   dot: 'bg-amber-400',  text: 'text-amber-700' },
                { label: 'Absent',    val: absentDays, dot: 'bg-red-400',    text: 'text-red-600'   },
                { label: 'Leave',     val: leaveDays,  dot: 'bg-purple-400', text: 'text-purple-700'},
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 shrink-0">
                  {i > 0 && <div className="h-3.5 w-px bg-border mx-2" />}
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${s.dot} shrink-0`} />
                    <div>
                      <p className={`text-xs font-bold ${s.text}`}>{s.val} {s.val === 1 ? 'Day' : 'Days'}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  // ─── Month View (calendar grid, light mode) ───────────────────────────────────
  const renderMonthView = () => {
    // Build calendar grid starting from Monday of the first week
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd   = endOfWeek(monthEnd,   { weekStartsOn: 1 });
    const calDays  = eachDayOfInterval({ start: calStart, end: calEnd });
    const calWeeks: Date[][] = [];
    for (let i = 0; i < calDays.length; i += 7) calWeeks.push(calDays.slice(i, i + 7));

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const getCalCellInfo = (day: Date) => {
      const ds  = format(day, 'yyyy-MM-dd');
      const dow = getDay(day);
      const isWknd = dow === 0;
      const inCurrentMonth = isSameMonth(day, monthDate);
      if (!inCurrentMonth) return { label: '', subLabel: '', color: '', isWknd };

      const holiday = isHolidayOnDate(empForView?.department || '', ds);
      if (holiday) return { label: holiday, subLabel: '', color: 'bg-purple-100 text-purple-700 border border-purple-200', isWknd };

      const isLeaveDay = isOnLeaveOnDate(empForView?.id || '', ds);
      if (isLeaveDay) return { label: 'On Leave', subLabel: '', color: 'bg-amber-100 text-amber-700 border border-amber-200', isWknd };

      if (isWknd) return { label: 'Weekend', subLabel: '', color: 'bg-gray-100 text-gray-400', isWknd };

      const dayMap = monthData[ds] || {};
      // Check both push key and EMP000X for portal records
      const rec = empForView
        ? ((dayMap[empForView.id] || dayMap[empForView.employeeId]) as AttendanceRecord | undefined)
        : undefined;
      if (rec?.status) {
        const recShift = (rec.shiftType || 'day') as 'day' | 'night' | 'sunday';
        const { workHrs: recWorkHrs } = getWorkHours(rec, recShift);
        const isShortHours = rec.status === 'Present' && recWorkHrs > 0 && recWorkHrs < 8;
        const colorMap: Record<string, string> = {
          Present:    isShortHours
                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        : 'bg-green-100 text-green-700 border border-green-200',
          Absent:     'bg-red-50 text-red-600 border border-red-100',
          'Half Day': 'bg-amber-100 text-amber-700 border border-amber-200',
          Leave:      'bg-amber-100 text-amber-700 border border-amber-200',
          Holiday:    'bg-purple-100 text-purple-700 border border-purple-200',
          'Week Off': 'bg-gray-100 text-gray-600 border border-gray-200',
        };
        const hoursLabel = recWorkHrs > 0 ? `${formatHoursToHMM(recWorkHrs)} hrs` : '';
        return {
          label: rec.status,
          subLabel: hoursLabel,
          color: colorMap[rec.status] || 'bg-gray-100 text-gray-600',
          isWknd,
        };
      }
      const isPast = ds < todayStr;
      return {
        label: isPast ? 'Absent' : '',
        subLabel: '',
        color: isPast ? 'bg-red-50 text-red-500 border border-red-100' : '',
        isWknd,
      };
    };

    const stats = empForView ? getEmployeeMonthStats(empForView, monthData) : null;

    return (
      <div className="space-y-4">
        {/* Employee picker + month navigator */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600 shrink-0">Employee:</span>
            <Select value={empForView?.id || ''} onValueChange={setSelectedEmpId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setMonthDate(subMonths(monthDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-gray-700 min-w-[140px] text-center text-lg">{monthLabel}</span>
            <Button variant="outline" size="sm" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMonthDate(new Date())}>Today</Button>
          </div>
        </div>

        {monthLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
            <span className="ml-3 text-gray-500">Loading month data…</span>
          </div>
        ) : (
          <Card>
            <CardContent className="p-4">
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1 border-b border-gray-100 pb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-500">{d}</div>
                ))}
              </div>

              {/* Calendar weeks */}
              {calWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7">
                  {week.map(day => {
                    const ds = format(day, 'yyyy-MM-dd');
                    const inCurrentMonth = isSameMonth(day, monthDate);
                    const isTodayCell = ds === todayStr;
                    const cell = getCalCellInfo(day);

                    return (
                      <div
                        key={ds}
                        className={`min-h-[80px] border border-gray-100 p-1.5 ${!inCurrentMonth ? 'bg-gray-50/40' : 'bg-white'}`}
                      >
                        {/* Date number */}
                        <div className="flex justify-start mb-1">
                          <span className={`text-xs font-semibold h-6 w-6 flex items-center justify-center rounded-full ${
                            isTodayCell ? 'bg-blue-600 text-white'
                            : inCurrentMonth ? 'text-gray-700'
                            : 'text-gray-300'
                          }`}>
                            {format(day, 'd')}
                          </span>
                        </div>

                        {/* Status pill */}
                        {cell.label && inCurrentMonth && (
                          <div className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md leading-tight ${cell.color}`}>
                            <div className="truncate font-semibold">{cell.label}</div>
                            {cell.subLabel && (
                              <div className="text-[10px] font-bold truncate mt-0.5">{cell.subLabel}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Employee month stats */}
        {stats && (
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Present',  val: stats.present,  bg: 'bg-green-50 border-green-100',  dot: 'bg-green-500',  text: 'text-green-700' },
              { label: 'Absent',   val: stats.absent,   bg: 'bg-red-50 border-red-100',       dot: 'bg-red-500',    text: 'text-red-700'   },
              { label: 'Leave',    val: stats.leave,    bg: 'bg-blue-50 border-blue-100',     dot: 'bg-blue-500',   text: 'text-blue-700'  },
              { label: 'Half Day', val: stats.halfDay,  bg: 'bg-amber-50 border-amber-100',   dot: 'bg-amber-500',  text: 'text-amber-700' },
            ].map(s => (
              <div key={s.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${s.bg}`}>
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                <span className={`font-semibold text-sm ${s.text}`}>{s.val}</span>
                <span className={`text-xs ${s.text}`}>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── Daily Timeline View ─────────────────────────────────────────────────────
  const renderDailyTimeline = () => (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      {filteredEmployees.length === 0 ? (
        <div className="flex justify-center items-center py-20 text-muted-foreground">No employees found</div>
      ) : (
        <>
          <div>
            {filteredEmployees.map(emp => {
              const record = getRecordForEmployee(emp);  // matches both push key & EMP000X
              const shiftType = (record?.shiftType || currentShift) as 'day' | 'night' | 'sunday';
              const config = SHIFT_CONFIGS[shiftType];
              const onLeave = isOnLeaveToday(emp.id);
              const holidayName = getHolidayDisplay(emp.department);
              const isHoliday = !!holidayName;
              const editing = record?.editing;

              const hrs = getWorkHours(record, shiftType);  // uses totalWorkedMs if available

              const sessions: AdminSession[] = (!isHoliday && !onLeave && !editing)
                ? getSessionsForRecord(record)  // uses portal sessions[] array
                : [];

              let lateStr: string | null = null;
              if (record?.checkIn) {
                const ciDecimal = parseTimeString(record.checkIn);  // handles seconds format
                if (ciDecimal !== null) {
                  const diff = Math.round((ciDecimal - config.start) * 60);
                  if (diff > 0) lateStr = `${String(Math.floor(diff / 60)).padStart(2, '0')}:${String(diff % 60).padStart(2, '0')}`;
                }
              }

              const workHrs = hrs.workHrs;
              const defaultLunchIn = decimalToTime12(config.lunchStart || 13);
              const defaultLunchOut = decimalToTime12(config.lunchEnd || 13.5);

              return (
                <div key={emp.id} className={`border-b border-border/50 transition-colors ${
                  isHoliday ? 'bg-purple-50/60'
                  : onLeave || record?.status === 'Leave' ? 'bg-amber-50/60'
                  : record?.status === 'Absent' ? 'bg-red-50/30'
                  : 'bg-white'
                }`}>
                  <div className="flex items-stretch">
                    {/* Employee info */}
                    <div className="w-44 shrink-0 flex flex-col justify-center py-3 px-3 border-r border-border/30">
                      <span className="text-sm font-semibold text-gray-800 leading-tight">{emp.name}</span>
                      <span className="text-[10px] text-muted-foreground">{emp.employeeId}</span>
                      <span className="text-[10px] text-muted-foreground/70">{config.name}</span>
                    </div>

                    {!editing ? (
                      <>
                        {/* Check-in info */}
                        <div className="w-28 shrink-0 flex flex-col justify-center py-3 px-2">
                          {isHoliday ? (
                            <span className="text-[10px] font-semibold text-purple-600">Holiday</span>
                          ) : onLeave || record?.status === 'Leave' ? (
                            <span className="text-[10px] font-semibold text-amber-600">On Leave</span>
                          ) : record?.checkIn ? (
                            <>
                              <span className="text-[10px] text-green-600 font-semibold">Check In</span>
                              <span className="text-xs font-bold text-foreground leading-tight">{normalizeTimeString(record.checkIn)}</span>
                              {lateStr && <span className="text-[10px] font-semibold text-amber-500">Late by {lateStr}</span>}
                            </>
                          ) : (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${getBadgeClass(record?.status)}`}>
                              {record?.status || '—'}
                            </span>
                          )}
                        </div>

                        {/* Timeline */}
                        <div className="flex-1 flex items-center py-3 px-2 min-w-0">
                          {isHoliday ? (
                            <div className="w-full flex items-center gap-2">
                              <div className="flex-1 h-px bg-purple-200" />
                              <span className="text-xs text-purple-500 font-medium px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200 shrink-0">{holidayName}</span>
                              <div className="flex-1 h-px bg-purple-200" />
                            </div>
                          ) : onLeave || record?.status === 'Leave' ? (
                            <div className="w-full flex items-center gap-2">
                              <div className="flex-1 h-px bg-amber-200" />
                              <span className="text-xs text-amber-600 font-medium px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 shrink-0">Approved Leave</span>
                              <div className="flex-1 h-px bg-amber-200" />
                            </div>
                          ) : (
                            <AdminTimelineBar sessions={sessions} isWeekend={false} />
                          )}
                        </div>

                        {/* Check-out info */}
                        <div className="w-28 shrink-0 flex flex-col justify-center py-3 px-2 text-right">
                          {!isHoliday && !(onLeave || record?.status === 'Leave') && record?.checkOut ? (
                            <>
                              <span className="text-[10px] text-rose-500 font-semibold">Check Out</span>
                              <span className="text-xs font-bold text-foreground leading-tight">{normalizeTimeString(record.checkOut)}</span>
                            </>
                          ) : null}
                        </div>

                        {/* Hours worked */}
                        <div className="w-24 shrink-0 flex flex-col justify-center items-end py-3 pr-3 gap-0.5">
                          {(() => {
                            const badgeMap: Record<string, string> = {
                              full:  'bg-green-100 text-green-700 border-green-200',
                              half:  'bg-amber-100 text-amber-700 border-amber-200',
                              short: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                            };
                            const badgeKey = workHrs >= 8 ? 'full' : workHrs >= 4 ? 'half' : workHrs > 0 ? 'short' : '';
                            const badgeLabel = workHrs >= 8 ? 'Full Day' : workHrs >= 4 ? 'Half Day' : workHrs > 0 ? 'Short' : '';
                            return (
                              <>
                                <span className={`text-sm font-bold leading-tight ${workHrs > 0 ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                                  {workHrs > 0 ? formatHoursToHMM(workHrs) : '00:00'}
                                </span>
                                <span className="text-[10px] text-muted-foreground">Hrs worked</span>
                                {badgeLabel && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeMap[badgeKey]}`}>
                                    {badgeLabel}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </>
                    ) : record ? (
                      /* Edit mode */
                      <div className="flex-1 flex flex-col justify-center py-2 px-3 gap-2">
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground w-16">Status:</span>
                            <Select value={record.status || ''} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, status: v } : a))}>
                              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{['Present','Absent','Half Day','Leave','Holiday','Week Off'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground w-16">Check In:</span>
                            <div className="flex gap-1">
                              <Select value={record.checkInHour || ''} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, checkInHour: v } : a))}>
                                <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                              </Select>
                              <Select value={record.checkInMinute || ''} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, checkInMinute: v } : a))}>
                                <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                              </Select>
                              <Select value={record.checkInPeriod || 'AM'} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, checkInPeriod: v } : a))}>
                                <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground w-16">Check Out:</span>
                            <div className="flex gap-1">
                              <Select value={record.checkOutHour || ''} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, checkOutHour: v } : a))}>
                                <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                              </Select>
                              <Select value={record.checkOutMinute || ''} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, checkOutMinute: v } : a))}>
                                <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                              </Select>
                              <Select value={record.checkOutPeriod || ''} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, checkOutPeriod: v } : a))}>
                                <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
                              </Select>
                            </div>
                          </div>
                          {config.hasLunch && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground w-16">Lunch In:</span>
                                <div className="flex gap-1">
                                  <Select value={record.lunchInHour || defaultLunchIn.hour} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, lunchInHour: v } : a))}>
                                    <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <Select value={record.lunchInMinute || defaultLunchIn.minute} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, lunchInMinute: v } : a))}>
                                    <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>{MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <Select value={record.lunchInPeriod || defaultLunchIn.period} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, lunchInPeriod: v } : a))}>
                                    <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground w-16">Lunch Out:</span>
                                <div className="flex gap-1">
                                  <Select value={record.lunchOutHour || defaultLunchOut.hour} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, lunchOutHour: v } : a))}>
                                    <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <Select value={record.lunchOutMinute || defaultLunchOut.minute} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, lunchOutMinute: v } : a))}>
                                    <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>{MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <Select value={record.lunchOutPeriod || defaultLunchOut.period} onValueChange={v => setAttendance(p => p.map(a => a.id === record.id ? { ...a, lunchOutPeriod: v } : a))}>
                                    <SelectTrigger className="h-7 w-14 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Actions */}
                    <div className="w-16 shrink-0 flex items-center justify-end py-3 pr-3">
                      {isHoliday || onLeave ? (
                        <Badge variant="secondary" className="text-[10px]">{isHoliday ? 'Holiday' : 'Leave'}</Badge>
                      ) : editing && record ? (
                        <>
                          <Button size="sm" onClick={() => saveEdit(record)} className="h-7"><Save className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-7"><XCircle className="h-3.5 w-3.5" /></Button>
                        </>
                      ) : record ? (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditing(record.id!)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timeline hour labels */}
          <div className="flex items-stretch border-t border-border bg-gray-50/50">
            <div className="w-44 shrink-0" />
            <div className="w-28 shrink-0" />
            <div className="flex-1 relative h-6 px-2">
              {TL_LABELS.map(h => {
                const pct = ((h - TL_START_H) / (TL_END_H - TL_START_H)) * 100;
                return (
                  <span key={h} className="absolute text-[9px] text-muted-foreground -translate-x-1/2 top-1.5" style={{ left: `${pct}%` }}>
                    {tlFmt12(h)}
                  </span>
                );
              })}
            </div>
            <div className="w-28 shrink-0" />
            <div className="w-24 shrink-0" />
            <div className="w-40 shrink-0" />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">
            {viewMode === 'daily' ? 'Daily Attendance' : viewMode === 'week' ? 'Weekly Attendance' : 'Monthly Attendance'}
          </h2>
          <p className="text-muted-foreground">
            {viewMode === 'daily'
              ? (isSunday
                ? 'Sunday Shift: 9:00 AM - 1:00 PM (4 hours, no lunch)'
                : 'Day: 10:00 AM - 6:30 PM | Night: 4:00 PM - 12:30 AM (8.5 hrs target)')
              : viewMode === 'week'
              ? `Week of ${weekLabel}`
              : monthLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'daily' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              <List className="h-4 w-4" />
              Daily
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 border-l border-gray-200 transition-colors ${viewMode === 'week' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              <Calendar className="h-4 w-4" />
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-2 text-sm flex items-center gap-1.5 border-l border-gray-200 transition-colors ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              <Calendar className="h-4 w-4" />
              Month
            </button>
          </div>
          {viewMode === 'daily' && (
            <Button onClick={exportCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* ─── Daily View ─────────────────────────────────────────────────────────── */}
      {viewMode === 'daily' && (
        <>
          {/* Holiday Alert */}
          {!isSunday && getHolidayDisplay('Staff') && (
            <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-300">
              <CardContent className="flex items-center gap-4 py-5">
                <Calendar className="h-12 w-12 text-orange-600" />
                <div>
                  <h3 className="text-xl font-bold text-orange-900">Today is {getHolidayDisplay('Staff')}</h3>
                  <p className="text-orange-700">Holiday applied to selected departments</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sunday Alert */}
          {isSunday && (
            <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-300">
              <CardContent className="flex items-center gap-4 py-5">
                <Sun className="h-12 w-12 text-purple-600" />
                <div>
                  <h3 className="text-xl font-bold text-purple-900">Today is Sunday</h3>
                  <p className="text-purple-700">Working hours: 9:00 AM - 1:00 PM (4 hours)</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{employees.length}</p><p className="text-sm text-muted-foreground">Total</p></CardContent></Card>
            <Card className="bg-emerald-50"><CardContent className="pt-6 text-center text-emerald-700"><p className="text-3xl font-bold">{presentCount}</p><p>Present</p></CardContent></Card>
            <Card className="bg-red-50"><CardContent className="pt-6 text-center text-red-700"><p className="text-3xl font-bold">{absentCount}</p><p>Absent</p></CardContent></Card>
            <Card className="bg-blue-50"><CardContent className="pt-6 text-center text-blue-700"><p className="text-3xl font-bold">{approvedLeaves.filter(l => selectedDate >= l.startDate && selectedDate <= l.endDate).length}</p><p>On Leave</p></CardContent></Card>
            <Card className="bg-amber-50"><CardContent className="pt-6 text-center text-amber-700"><p className="text-3xl font-bold">{halfDayCount}</p><p>Half Day</p></CardContent></Card>
            <Card className="bg-indigo-50"><CardContent className="pt-6 text-center text-indigo-700"><p className="text-3xl font-bold">{avgHours.toFixed(1)}h</p><p>Avg Hrs</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row gap-4 items-end">
                <div className="flex gap-4">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {Array.from(new Set(employees.map(e => e.department))).filter(d => !!d).map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex-1">
                  <Label>Search Employee</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Name, ID, Dept..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 pt-2">
              {renderDailyTimeline()}
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Week View ─────────────────────────────────────────────────────────── */}
      {viewMode === 'week' && renderWeekView()}

      {/* ─── Month View ────────────────────────────────────────────────────────── */}
      {viewMode === 'month' && renderMonthView()}
    </div>
  );
}
