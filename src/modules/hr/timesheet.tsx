// src/modules/hr/EmployeeTimesheet.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sun,
  Download,
  Edit2,
  Save,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ref, onValue, set, get, remove } from 'firebase/database';
import { database } from '@/services/firebase';
import { getAllRecords } from '@/services/firebase';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// --- Constants ---
const FULL_WORKING_DAY_AMOUNT = 400;
const SUNDAY_ALLOWANCE_STAFF = 500;
const OT_RATE_PER_HOUR_WORKER = 70;

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
  const m = Math.round((Math.abs(hours) % 1) * 60);
  return `${hours < 0 ? '-' : ''}${h}:${m.toString().padStart(2, '0')}`;
};

// Parse 12-hour time string → decimal hours (0-24)
const parseTimeString = (timeStr?: string): number | null => {
  if (!timeStr || timeStr.trim() === '') return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hour = parseInt(match[1]);
  const minute = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour + minute / 60;
};

const toTimeString = (hour?: string, minute?: string, period?: string) => {
  if (!hour || !minute || !period) return '';
  return `${parseInt(hour, 10)}:${minute} ${period}`;
};

const convertTimeToDecimal = (t?: string): number => {
  const p = parseTimeString(t);
  return p ? Number(p.toFixed(2)) : 0;
};

// UPDATED OT Slab Logic
const calculateOTFromExtraMinutes = (extraMin: number): number => {
  if (extraMin < 30) return 0;
  if (extraMin >= 30 && extraMin < 45) return 30;
  if (extraMin >= 45 && extraMin < 60) return 60;
  
  const fullHours = Math.floor(extraMin / 60);
  const remainingMinutes = extraMin % 60;
  
  let otMinutes = fullHours * 60;
  
  if (remainingMinutes >= 45) {
    otMinutes += 45;
  } else if (remainingMinutes >= 30) {
    otMinutes += 30;
  } else if (remainingMinutes >= 15) {
    otMinutes += 15;
  }
  
  return otMinutes;
};

// Core Work / OT / Pending calculation
const calculateWorkHours = (
  checkIn: string,
  lunchIn: string,
  lunchOut: string,
  checkOut: string,
  shiftType: 'day' | 'night' | 'sunday',
  status?: string
) => {
  const config = SHIFT_CONFIGS[shiftType];

  if (status && ['Leave', 'Holiday', 'Week Off', 'Absent'].includes(status)) {
    return { workHrs: 0, otHrs: 0, pendingHrs: 0 };
  }

  const ci = parseTimeString(checkIn);
  const li = parseTimeString(lunchIn);
  const lo = parseTimeString(lunchOut);
  const coRaw = parseTimeString(checkOut);

  if (ci == null || coRaw == null) {
    return { workHrs: 0, otHrs: 0, pendingHrs: config.targetHours };
  }

  let co = coRaw;
  if (shiftType === 'night' && coRaw <= ci) {
    co = coRaw + 24;
  }

  if (co <= ci) {
    return { workHrs: 0, otHrs: 0, pendingHrs: config.targetHours };
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
  let otHrs = 0;

  if (net > target) {
    const extraMinutes = (net - target) * 60;
    const otMinutes = calculateOTFromExtraMinutes(extraMinutes);
    otHrs = otMinutes / 60;
  }

  return {
    workHrs: Number(workHrs.toFixed(4)),
    otHrs: Number(otHrs.toFixed(4)),
    pendingHrs: Number(pendingHrs.toFixed(4)),
  };
};

const formatMonthYear = (ym: string) => {
  const [y, m] = ym.split('-');
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'short' }) + '-' + y.slice(2);
};

interface TimesheetRecord {
  date: string;
  status: string;
  checkIn?: string;
  lunchIn?: string;
  lunchOut?: string;
  checkOut?: string;
  workHrs: number;
  otHrs: number;
  pendingHrs: number;
  department?: string;
  shiftType?: 'day' | 'night' | 'sunday';
  isMarked?: boolean;
}

interface MonthlySummary {
  fullWorkingDays: number;
  sundayAllowance: number;
  sundayOtHours: number;
  sundayPresentCount: number;
  sundayWorkHours: number;
}

export default function EmployeeTimesheet() {
  const { employeeId, month } = useParams();
  const navigate = useNavigate();

  const [currentMonth, setCurrentMonth] = useState(month || new Date().toISOString().slice(0, 7));
  const [employeeName, setEmployeeName] = useState('Loading...');
  const [employeeFirebaseId, setEmployeeFirebaseId] = useState<string | null>(null);
  const [department, setDepartment] = useState<string>('');
  const [records, setRecords] = useState<TimesheetRecord[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary>({
    fullWorkingDays: 0,
    sundayAllowance: 0,
    sundayOtHours: 0,
    sundayPresentCount: 0,
    sundayWorkHours: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<Record<string, any>>({});

  const [year, mon] = currentMonth.split('-');
  const daysInMonth = new Date(+year, +mon, 0).getDate();

  // Fetch employee details
  useEffect(() => {
    getAllRecords('hr/employees').then((emps: any[]) => {
      const emp = emps.find(e => e.employeeId === employeeId);
      if (emp) {
        setEmployeeName(emp.name);
        setEmployeeFirebaseId(emp.id);
        setDepartment(emp.department || 'Staff');
      } else {
        setEmployeeName('Employee Not Found');
      }
    });
  }, [employeeId]);

  // Fetch attendance + monthly summary
  useEffect(() => {
    if (!employeeFirebaseId) return;

    const attendanceRef = ref(database, 'hr/attendance');
    const summaryRef = ref(database, `hr/timesheetSummary/${employeeFirebaseId}/${currentMonth}`);

    const unsub = onValue(attendanceRef, async snap => {
      const allData = snap.val() || {};
      const list: TimesheetRecord[] = [];

      let fullDays = 0;
      let sundayOtHours = 0;
      let sundayPresentCount = 0;
      let sundayWorkHours = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayData = allData[dateStr] || {};

        let latestRecord: any = null;
        let latestTimestamp = 0;

        Object.entries(dayData).forEach(([, rec]: any) => {
          if (rec.employeeId === employeeFirebaseId) {
            const timestamp = rec.updatedAt || rec.createdAt || 0;
            if (timestamp > latestTimestamp) {
              latestTimestamp = timestamp;
              latestRecord = rec;
            }
          }
        });

        const dt = new Date(dateStr);
        const isSunday = dt.getDay() === 0;

        if (latestRecord) {
          const rec = latestRecord;
          const shiftType: 'day' | 'night' | 'sunday' =
            rec.shiftType || (isSunday ? 'sunday' : 'day');

          const hrs = calculateWorkHours(
            rec.checkIn || '',
            rec.lunchIn || '',
            rec.lunchOut || '',
            rec.checkOut || '',
            shiftType,
            rec.status
          );

          list.push({
            date: dateStr,
            status: rec.status || 'Absent',
            checkIn: rec.checkIn || '',
            lunchIn: rec.lunchIn || '',
            lunchOut: rec.lunchOut || '',
            checkOut: rec.checkOut || '',
            workHrs: hrs.workHrs,
            otHrs: hrs.otHrs,
            pendingHrs: hrs.pendingHrs,
            department,
            shiftType,
            isMarked: true,
          });

          if (rec.status === 'Present' && hrs.pendingHrs === 0) {
            fullDays++;
          }

          if (isSunday && rec.status === 'Present') {
            if (department === 'Staff') {
              sundayPresentCount++;
            } else {
              sundayWorkHours += hrs.workHrs;
              sundayOtHours += hrs.otHrs;
              sundayOtHours = sundayWorkHours + (hrs.otHrs || 0);
            }
          }
        } else {
          list.push({
            date: dateStr,
            status: isSunday ? 'Holiday' : 'Absent',
            checkIn: '',
            lunchIn: '',
            lunchOut: '',
            checkOut: '',
            workHrs: 0,
            otHrs: 0,
            pendingHrs: isSunday ? 0 : SHIFT_CONFIGS[isSunday ? 'sunday' : 'day'].targetHours,
            department,
            shiftType: isSunday ? 'sunday' : 'day',
            isMarked: false,
          });
        }
      }

      setRecords(list);

      const sundayAllowance = department === 'Staff' ? sundayPresentCount * SUNDAY_ALLOWANCE_STAFF : 0;

      const summaryPayload = {
        fullWorkingDays: fullDays,
        sundayAllowance,
        sundayOtHours: department === 'Staff' ? 0 : sundayOtHours,
        sundayPresentCount,
        sundayWorkHours,
      };

      await set(summaryRef, summaryPayload);

      setMonthlySummary(summaryPayload);
      setLoading(false);
    });

    return () => unsub();
  }, [employeeFirebaseId, currentMonth, department, daysInMonth, year, mon]);

  const changeMonth = (dir: number) => {
    const d = new Date(+year, +mon - 1 + dir, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newMonth);
    navigate(`/hr/attendance/${employeeId}/${newMonth}`);
  };

  const startEdit = (rec: TimesheetRecord) => {
    setEditingDate(rec.date);
    const isSunday = new Date(rec.date).getDay() === 0;

    const parseTime = (timeStr?: string) => {
      if (!timeStr) return { hour: '', minute: '', period: 'AM' };
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!match) return { hour: '', minute: '', period: 'AM' };
      return {
        hour: match[1].padStart(2, '0'),
        minute: match[2],
        period: match[3].toUpperCase(),
      };
    };

    const checkInParsed = parseTime(rec.checkIn);
    const lunchInParsed = parseTime(rec.lunchIn);
    const lunchOutParsed = parseTime(rec.lunchOut);
    const checkOutParsed = parseTime(rec.checkOut);

    setEditBuffer(prev => ({
      ...prev,
      [rec.date]: {
        status: rec.status,
        shiftType: rec.shiftType || (isSunday ? 'sunday' : 'day'),
        checkInHour: checkInParsed.hour,
        checkInMinute: checkInParsed.minute,
        checkInPeriod: checkInParsed.period,
        lunchInHour: lunchInParsed.hour || '01',
        lunchInMinute: lunchInParsed.minute || '00',
        lunchInPeriod: lunchInParsed.period || 'PM',
        lunchOutHour: lunchOutParsed.hour || '01',
        lunchOutMinute: lunchOutParsed.minute || '30',
        lunchOutPeriod: lunchOutParsed.period || 'PM',
        checkOutHour: checkOutParsed.hour,
        checkOutMinute: checkOutParsed.minute,
        checkOutPeriod: checkOutParsed.period || 'PM',
      },
    }));
  };

  const cancelEdit = () => setEditingDate(null);

  const saveEdit = async (date: string) => {
    const buf = editBuffer[date];
    if (!buf || !employeeFirebaseId) return;

    try {
      // STEP 1: Delete ALL existing records for this employee on this date
      const dateRef = ref(database, `hr/attendance/${date}`);
      const dateSnap = await get(dateRef);
      const dateData = dateSnap.val() || {};
      
      // Delete all records for this employee
      for (const recordKey in dateData) {
        if (dateData[recordKey]?.employeeId === employeeFirebaseId) {
          await remove(ref(database, `hr/attendance/${date}/${recordKey}`));
        }
      }

      // STEP 2: Create the new single record
      const checkIn =
        buf.checkInHour && buf.checkInMinute && buf.checkInPeriod
          ? toTimeString(buf.checkInHour, buf.checkInMinute, buf.checkInPeriod)
          : '';

      const isSunday = new Date(date).getDay() === 0;
      const existingRec = records.find(r => r.date === date);
      const shiftType: 'day' | 'night' | 'sunday' =
        buf.shiftType || existingRec?.shiftType || (isSunday ? 'sunday' : 'day');

      const config = SHIFT_CONFIGS[shiftType];

      let lunchIn = '';
      let lunchOut = '';

      if (config.hasLunch) {
        lunchIn =
          buf.lunchInHour && buf.lunchInMinute && buf.lunchInPeriod
            ? toTimeString(buf.lunchInHour, buf.lunchInMinute, buf.lunchInPeriod)
            : '';
        lunchOut =
          buf.lunchOutHour && buf.lunchOutMinute && buf.lunchOutPeriod
            ? toTimeString(buf.lunchOutHour, buf.lunchOutMinute, buf.lunchOutPeriod)
            : '';
      }

      const checkOut =
        buf.checkOutHour && buf.checkOutMinute && buf.checkOutPeriod
          ? toTimeString(buf.checkOutHour, buf.checkOutMinute, buf.checkOutPeriod)
          : '';

      const hrs = calculateWorkHours(
        checkIn,
        lunchIn,
        lunchOut,
        checkOut,
        shiftType,
        buf.status
      );

      const payload: any = {
        employeeId: employeeFirebaseId,
        employeeName,
        date,
        status: buf.status,
        shiftType,
        checkIn,
        lunchIn: config.hasLunch ? (lunchIn || '1:00 PM') : '',
        lunchOut: config.hasLunch ? (lunchOut || '1:30 PM') : '',
        checkOut,
        workHrs: hrs.workHrs,
        otHrs: hrs.otHrs,
        pendingHrs: hrs.pendingHrs,
        totalHours: Number((hrs.workHrs + hrs.otHrs).toFixed(4)),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save the new record with employeeFirebaseId as key (ensures single record)
      await set(ref(database, `hr/attendance/${date}/${employeeFirebaseId}`), payload);
      
      toast({ title: 'Timesheet updated successfully' });
      setEditingDate(null);
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to save', variant: 'destructive' });
    }
  };

  const handleSuperSave = async () => {
    if (!employeeFirebaseId) return;

    const markedDaysCount = records.filter(r => r.isMarked === true).length;

    if (markedDaysCount < 26) {
      toast({
        title: 'Marking Incomplete',
        description: `You need to mark at least 26 days. Currently marked: ${markedDaysCount} days.`,
        variant: 'destructive',
      });
      return;
    }

    const sundays = records.filter(r => new Date(r.date).getDay() === 0);
    const unmarkedSundays = sundays.filter(r => !r.isMarked);

    if (unmarkedSundays.length > 0) {
      const sundayDates = unmarkedSundays.map(r => new Date(r.date).getDate()).join(', ');
      toast({
        title: 'Warning: Unmarked Sundays',
        description: `Sundays not marked: ${sundayDates}. Proceeding with save anyway.`,
        variant: 'default',
      });
    }

    try {
      const superSavePayload = {
        employeeId: employeeFirebaseId,
        employeeName,
        department,
        month: currentMonth,
        markedDays: markedDaysCount,
        totalDays: daysInMonth,
        fullWorkingDays: monthlySummary.fullWorkingDays,
        sundayAllowance: monthlySummary.sundayAllowance,
        sundayPresentCount: monthlySummary.sundayPresentCount,
        sundayOtHours: monthlySummary.sundayOtHours,
        sundayWorkHours: monthlySummary.sundayWorkHours,
        totalOT: records.reduce((s, r) => s + r.otHrs, 0),
        totalPending: records.filter(r => r.isMarked).reduce((s, r) => s + r.pendingHrs, 0),
        totalWorkHrs: records.reduce((s, r) => s + r.workHrs, 0),
        savedAt: Date.now(),
      };

      await set(
        ref(database, `hr/supersave/${employeeFirebaseId}/${currentMonth}`),
        superSavePayload
      );

      toast({
        title: 'Super Save Successful!',
        description: `Timesheet saved for ${employeeName} - ${currentMonth}`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Super Save Failed',
        description: 'Error saving to database',
        variant: 'destructive',
      });
    }
  };

  const exportXLSX = () => {
    const monthYear = formatMonthYear(currentMonth);
    const rows = records.map(r => {
      const d = new Date(r.date);
      const dateNum = d.getDate();
      const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });

      const timeIn = convertTimeToDecimal(r.checkIn);
      const timeOut = convertTimeToDecimal(r.checkOut);
      const lIn = convertTimeToDecimal(r.lunchIn);
      const lOut = convertTimeToDecimal(r.lunchOut);

      const bHrs = lOut - lIn > 0 ? Number((lOut - lIn).toFixed(2)) : 0;
      const aHrs = Number(r.workHrs.toFixed(2));
      const abHrs = Number((aHrs - bHrs).toFixed(2));

      return {
        Name: employeeName,
        MonthYear: monthYear,
        Date: dateNum,
        WeekDay: weekday,
        AttType: r.status,
        Shift: r.shiftType || 'day',
        TimeIN: timeIn || 0,
        TimeOut: timeOut || 0,
        AHrs: aHrs,
        LTimein: lIn || 0,
        LTimeout: lOut || 0,
        BHrs: bHrs,
        ABHrs: abHrs,
        WorkHrs: aHrs,
        OTHrs: Number(r.otHrs.toFixed(2)),
        Pending: Number(r.pendingHrs.toFixed(2)),
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheet');
    XLSX.writeFile(wb, `${employeeName}_Timesheet_${currentMonth}.xlsx`);
  };

  const present = records.filter(r => r.status === 'Present').length;
  const holiday = records.filter(r => r.status === 'Holiday').length;
  const leave = records.filter(r => r.status === 'Leave').length;
  const halfDay = records.filter(r => r.status === 'Half Day').length;
  const absent = records.filter(r => r.status === 'Absent').length;
  const totalOT = records.reduce((s, r) => s + r.otHrs, 0);
  
  // FIXED: Only count pending hours from marked dates
  const totalPending = records.filter(r => r.isMarked).reduce((s, r) => s + r.pendingHrs, 0);
  
  const netOT = totalOT - totalPending;
  const totalWorkHrs = records.reduce((s, r) => s + r.workHrs, 0);
  
  const sundayAllowanceAmount = monthlySummary.sundayAllowance;
  
  const sundayOtAmount = department !== 'Staff' 
    ? Math.round(monthlySummary.sundayOtHours * OT_RATE_PER_HOUR_WORKER)
    : 0;

  const markedDaysCount = records.filter(r => r.isMarked === true).length;
  const canSuperSave = markedDaysCount >= 26;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={() => navigate('/hr/attendance')}>
          <ArrowLeft className="mr-2 h-5 w-5" /> Back
        </Button>
        <h1 className="text-3xl font-bold">{employeeName} - Monthly Timesheet</h1>
        <div className="flex gap-2">
          <Button onClick={exportXLSX}>
            <Download className="mr-2 h-5 w-5" /> Export XLSX
          </Button>
          <Button
            onClick={handleSuperSave}
            disabled={!canSuperSave}
            className={canSuperSave ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            <CheckCircle className="mr-2 h-5 w-5" />
            Super Save {!canSuperSave && `(${markedDaysCount}/26)`}
          </Button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex justify-center items-center gap-6">
        <Button size="icon" variant="outline" onClick={() => changeMonth(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="px-8 py-4 bg-primary/10 rounded-xl flex items-center gap-3">
          <Calendar className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold">
            {new Date(`${currentMonth}-01`).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        <Button size="icon" variant="outline" onClick={() => changeMonth(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{daysInMonth}</div>
            <div className="text-sm">Total Days</div>
          </CardContent>
        </Card>
        <Card className="text-center bg-green-50">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-700">{present}</div>
            <div className="text-sm">Present</div>
          </CardContent>
        </Card>
        <Card className="text-center bg-blue-50">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-700">{leave}</div>
            <div className="text-sm">Leave</div>
          </CardContent>
        </Card>
        <Card className="text-center bg-amber-50">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-700">{halfDay}</div>
            <div className="text-sm">Half Day</div>
          </CardContent>
        </Card>
        <Card className="text-center bg-purple-50">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-purple-700">{holiday}</div>
            <div className="text-sm">Holiday</div>
          </CardContent>
        </Card>
        <Card className="text-center bg-red-50">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-red-700">{absent}</div>
            <div className="text-sm">Absent</div>
          </CardContent>
        </Card>
        <Card className="text-center bg-emerald-50">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-emerald-700">
              {formatHoursToHMM(totalOT)}
            </div>
            <div className="text-sm">Total OT</div>
          </CardContent>
        </Card>
        <Card className="text-center bg-slate-50">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-slate-700">
              {formatHoursToHMM(totalWorkHrs)}
            </div>
            <div className="text-sm">Total Work Hrs</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending & Net OT */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        <Card className="text-center bg-rose-50">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-rose-700">
              {totalPending > 0 ? formatHoursToHMM(totalPending) : '0:00'}
            </div>
            <div className="text-sm">Total Pending Hrs</div>
          </CardContent>
        </Card>
        <Card className="text-center bg-emerald-50">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-emerald-700">
              {netOT > 0 ? formatHoursToHMM(netOT) : '0:00'}
            </div>
            <div className="text-sm">Net OT</div>
          </CardContent>
        </Card>
        <Card className="text-center bg-indigo-50">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-indigo-700">{markedDaysCount}</div>
            <div className="text-sm">Marked Days</div>
          </CardContent>
        </Card>
      </div>

      {/* Allowances */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          

            {department === 'Staff' && (
              <div className="flex flex-col items-center">
                <label className="text-sm font-medium text-gray-600 mb-2">Sunday Allowance</label>
                <div className="text-3xl font-bold text-purple-700">₹{sundayAllowanceAmount}</div>
                <div className="text-sm text-gray-500">
                  {monthlySummary.sundayPresentCount} Sunday Present × ₹{SUNDAY_ALLOWANCE_STAFF}
                </div>
              </div>
            )}

            {department !== 'Staff' && (
              <div className="flex flex-col items-center">
                <label className="text-sm font-medium text-gray-600 mb-2">
                  Sunday OT (₹{OT_RATE_PER_HOUR_WORKER}/hr)
                </label>
                <div className="text-3xl font-bold text-green-700">
                  ₹{sundayOtAmount}
                </div>
                <div className="text-sm text-gray-500">
                  {formatHoursToHMM(monthlySummary.sundayOtHours)} hrs
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timesheet Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              {Array(10)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead>Shift</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Check In</TableHead>
                    <TableHead className="text-center">Lin</TableHead>
                    <TableHead className="text-center">Lout</TableHead>
                    <TableHead className="text-center">Check Out</TableHead>
                    <TableHead className="text-center">Work</TableHead>
                    <TableHead className="text-center">OT</TableHead>
                    <TableHead className="text-center">Pending</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(r => {
                    const d = new Date(r.date);
                    const isSunday = d.getDay() === 0;
                    const editing = editingDate === r.date;
                    const buf = editBuffer[r.date] || {};
                    const config = SHIFT_CONFIGS[r.shiftType || 'day'];

                    const statusClass =
                      r.status === 'Present'
                        ? 'bg-green-100 text-green-800'
                        : r.status === 'Half Day'
                        ? 'bg-yellow-100 text-yellow-800'
                        : r.status === 'Leave' || r.status === 'Absent'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-purple-100 text-purple-800';

                    return (
                      <TableRow key={r.date} className={isSunday ? 'bg-purple-50' : ''}>
                        <TableCell className="font-medium">
                          {d
                            .toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                            .replace(/\//g, '.')}
                        </TableCell>
                        <TableCell>{d.getDate()}</TableCell>
                        <TableCell className="flex items-center gap-1">
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                          {isSunday && <Sun className="h-4 w-4 text-purple-600" />}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{config.name}</Badge>
                        </TableCell>
                        <TableCell>
                          {editing ? (
                            <Select
                              value={buf.status || r.status}
                              onValueChange={v =>
                                setEditBuffer(prev => ({
                                  ...prev,
                                  [r.date]: { ...(prev[r.date] || {}), status: v },
                                }))
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {['Present', 'Absent', 'Half Day', 'Leave', 'Holiday', 'Week Off'].map(
                                  s => (
                                    <SelectItem key={s} value={s}>
                                      {s}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={statusClass}>{r.status}</Badge>
                          )}
                        </TableCell>

                        {/* Check In */}
                        <TableCell className="text-center">
                          {editing ? (
                            <div className="flex justify-center gap-1">
                              <select
                                value={buf.checkInHour || ''}
                                onChange={e =>
                                  setEditBuffer(prev => ({
                                    ...prev,
                                    [r.date]: {
                                      ...(prev[r.date] || {}),
                                      checkInHour: e.target.value,
                                    },
                                  }))
                                }
                                className="w-14 px-1 py-1 border rounded text-xs"
                              >
                                <option value="">--</option>
                                {HOURS.map(h => (
                                  <option key={h} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={buf.checkInMinute || ''}
                                onChange={e =>
                                  setEditBuffer(prev => ({
                                    ...prev,
                                    [r.date]: {
                                      ...(prev[r.date] || {}),
                                      checkInMinute: e.target.value,
                                    },
                                  }))
                                }
                                className="w-14 px-1 py-1 border rounded text-xs"
                              >
                                <option value="">--</option>
                                {MINUTES.map(m => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={buf.checkInPeriod || 'AM'}
                                onChange={e =>
                                  setEditBuffer(prev => ({
                                    ...prev,
                                    [r.date]: {
                                      ...(prev[r.date] || {}),
                                      checkInPeriod: e.target.value,
                                    },
                                  }))
                                }
                                className="w-14 px-1 py-1 border rounded text-xs"
                              >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                              </select>
                            </div>
                          ) : (
                            <span
                              className={
                                r.checkIn ? 'text-green-600 font-medium' : 'text-muted-foreground'
                              }
                            >
                              {r.checkIn || '-'}
                            </span>
                          )}
                        </TableCell>

                        {/* Lunch In */}
                        <TableCell className="text-center">
                          {config.hasLunch ? (
                            editing ? (
                              <div className="flex justify-center gap-1">
                                <select
                                  value={buf.lunchInHour || '01'}
                                  onChange={e =>
                                    setEditBuffer(prev => ({
                                      ...prev,
                                      [r.date]: {
                                        ...(prev[r.date] || {}),
                                        lunchInHour: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-14 px-1 py-1 border rounded text-xs"
                                >
                                  {HOURS.map(h => (
                                    <option key={h} value={h}>
                                      {h}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={buf.lunchInMinute || '00'}
                                  onChange={e =>
                                    setEditBuffer(prev => ({
                                      ...prev,
                                      [r.date]: {
                                        ...(prev[r.date] || {}),
                                        lunchInMinute: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-14 px-1 py-1 border rounded text-xs"
                                >
                                  {MINUTES.map(m => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={buf.lunchInPeriod || 'PM'}
                                  onChange={e =>
                                    setEditBuffer(prev => ({
                                      ...prev,
                                      [r.date]: {
                                        ...(prev[r.date] || {}),
                                        lunchInPeriod: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-14 px-1 py-1 border rounded text-xs"
                                >
                                  <option value="AM">AM</option>
                                  <option value="PM">PM</option>
                                </select>
                              </div>
                            ) : (
                              <span
                                className={
                                  r.lunchIn ? 'text-orange-600 font-medium' : 'text-muted-foreground'
                                }
                              >
                                {r.lunchIn || '1:00 PM'}
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Lunch Out */}
                        <TableCell className="text-center">
                          {config.hasLunch ? (
                            editing ? (
                              <div className="flex justify-center gap-1">
                                <select
                                  value={buf.lunchOutHour || '01'}
                                  onChange={e =>
                                    setEditBuffer(prev => ({
                                      ...prev,
                                      [r.date]: {
                                        ...(prev[r.date] || {}),
                                        lunchOutHour: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-14 px-1 py-1 border rounded text-xs"
                                >
                                  {HOURS.map(h => (
                                    <option key={h} value={h}>
                                      {h}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={buf.lunchOutMinute || '30'}
                                  onChange={e =>
                                    setEditBuffer(prev => ({
                                      ...prev,
                                      [r.date]: {
                                        ...(prev[r.date] || {}),
                                        lunchOutMinute: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-14 px-1 py-1 border rounded text-xs"
                                >
                                  {MINUTES.map(m => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={buf.lunchOutPeriod || 'PM'}
                                  onChange={e =>
                                    setEditBuffer(prev => ({
                                      ...prev,
                                      [r.date]: {
                                        ...(prev[r.date] || {}),
                                        lunchOutPeriod: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-14 px-1 py-1 border rounded text-xs"
                                >
                                  <option value="AM">AM</option>
                                  <option value="PM">PM</option>
                                </select>
                              </div>
                            ) : (
                              <span
                                className={
                                  r.lunchOut ? 'text-orange-600 font-medium' : 'text-muted-foreground'
                                }
                              >
                                {r.lunchOut || '1:30 PM'}
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Check Out */}
                        <TableCell className="text-center">
                          {editing ? (
                            <div className="flex justify-center gap-1">
                              <select
                                value={buf.checkOutHour || ''}
                                onChange={e =>
                                  setEditBuffer(prev => ({
                                    ...prev,
                                    [r.date]: {
                                      ...(prev[r.date] || {}),
                                      checkOutHour: e.target.value,
                                    },
                                  }))
                                }
                                className="w-14 px-1 py-1 border rounded text-xs"
                              >
                                <option value="">--</option>
                                {HOURS.map(h => (
                                  <option key={h} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={buf.checkOutMinute || ''}
                                onChange={e =>
                                  setEditBuffer(prev => ({
                                    ...prev,
                                    [r.date]: {
                                      ...(prev[r.date] || {}),
                                      checkOutMinute: e.target.value,
                                    },
                                  }))
                                }
                                className="w-14 px-1 py-1 border rounded text-xs"
                              >
                                <option value="">--</option>
                                {MINUTES.map(m => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={buf.checkOutPeriod || 'PM'}
                                onChange={e =>
                                  setEditBuffer(prev => ({
                                    ...prev,
                                    [r.date]: {
                                      ...(prev[r.date] || {}),
                                      checkOutPeriod: e.target.value,
                                    },
                                  }))
                                }
                                className="w-14 px-1 py-1 border rounded text-xs"
                              >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                              </select>
                            </div>
                          ) : (
                            <span
                              className={
                                r.checkOut ? 'text-blue-600 font-medium' : 'text-muted-foreground'
                              }
                            >
                              {r.checkOut || '-'}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-center font-semibold text-emerald-700">
                          {formatHoursToHMM(r.workHrs)}
                        </TableCell>
                        <TableCell className="text-center font-bold text-green-600">
                          {formatHoursToHMM(r.otHrs)}
                        </TableCell>
                        <TableCell className="text-center font-bold text-red-600">
                          {formatHoursToHMM(r.pendingHrs)}
                        </TableCell>

                        <TableCell>
                          {editing ? (
                            <div className="flex justify-center gap-2">
                              <Button size="sm" onClick={() => saveEdit(r.date)}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-center gap-2">
                              <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
