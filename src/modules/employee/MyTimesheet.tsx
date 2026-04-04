import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, get, push, set, onValue } from 'firebase/database';
import { format, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Clock,
  Calendar,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayRecord {
  date: string;
  weekday: string;
  status: string | null;
  checkIn: string | null;
  checkOut: string | null;
  hours: string | null;
}

interface TimeLog {
  id: string;
  date: string;
  clientName: string;
  department: string;
  category: string;
  projectName: string;
  jobType: string;
  taskDescription: string;
  hoursWorked: number;
  billableStatus: 'billable' | 'non-billable';
  status: 'pending' | 'approved' | 'rejected';
  reportingTo: string;
  employeeId: string;
  employeeName: string;
  submittedAt: number;
}

interface LogForm {
  clientName: string;
  department: string;
  category: string;
  projectName: string;
  jobType: string;
  taskDescription: string;
  hoursWorked: string;
  billableStatus: 'billable' | 'non-billable';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Fallback when no attendance record exists (no cap applied)
const FALLBACK_WORK_HOURS = 8;

const DEPARTMENTS = [
  'Production', 'Quality', 'HR', 'Sales', 'Stores', 'Finance',
  'IT', 'Operations', 'Marketing', 'Design', 'Development',
];

const CATEGORIES = [
  'Development', 'Design', 'Testing', 'Meeting', 'Documentation',
  'Support', 'Research', 'Training', 'Review', 'Other',
];

const JOB_TYPES = [
  'Full-Time', 'Part-Time', 'Contract', 'Freelance', 'Internship',
];

const statusColor: Record<string, string> = {
  Present:   'bg-green-100 text-green-700',
  Absent:    'bg-red-100 text-red-700',
  Leave:     'bg-amber-100 text-amber-700',
  Holiday:   'bg-blue-100 text-blue-700',
  'Half Day':'bg-purple-100 text-purple-700',
  'Week Off':'bg-gray-100 text-gray-600',
};

const logStatusConfig = {
  pending:  { cls: 'bg-amber-100 text-amber-700 border-amber-200',  icon: AlertCircle,  label: 'Pending' },
  approved: { cls: 'bg-green-100 text-green-700 border-green-200',  icon: CheckCircle,  label: 'Approved' },
  rejected: { cls: 'bg-red-100 text-red-700 border-red-200',        icon: XCircle,      label: 'Rejected' },
};

const billableColors = {
  billable:     'bg-emerald-100 text-emerald-700',
  'non-billable': 'bg-gray-100 text-gray-500',
};

// Parses "10:30 AM" → minutes since midnight
const parseTime = (t: string): number => {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1]);
  const mins = parseInt(m[2]);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + mins;
};

const emptyForm = (): LogForm => ({
  clientName: '',
  department: '',
  category: '',
  projectName: '',
  jobType: '',
  taskDescription: '',
  hoursWorked: '',
  billableStatus: 'billable',
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function MyTimesheet() {
  const { user } = useAuth();
  const now = new Date();

  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const month = currentDate.getMonth() + 1;
  const year  = currentDate.getFullYear();

  // Attendance state
  const [records, setRecords]           = useState<DayRecord[]>([]);
  const [attLoading, setAttLoading]     = useState(false);
  // actual worked hours per date from check-in/out (decimal, e.g. 6.5)
  const [attendanceHoursByDate, setAttendanceHoursByDate] = useState<Record<string, number>>({});

  // Time-log state
  const [logs, setLogs]             = useState<TimeLog[]>([]);
  const [reportingTo, setReportingTo] = useState('');

  // Modal state
  const [modalOpen, setModalOpen]   = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [form, setForm]             = useState<LogForm>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // ── Load attendance for the month ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.employeeId) return;
    loadMonth();
  }, [month, year, user?.employeeId]);

  const loadMonth = async () => {
    if (!user?.employeeId) return;
    setAttLoading(true);
    const days = getDaysInMonth(new Date(year, month - 1));
    const results = await Promise.all(
      Array.from({ length: days }, (_, i) => {
        const d  = String(i + 1).padStart(2, '0');
        const ds = `${year}-${String(month).padStart(2, '0')}-${d}`;
        return get(ref(database, `hr/attendance/${ds}/${user!.employeeId}`)).then(snap => ({
          dateStr: ds,
          val: snap.exists() ? snap.val() : null,
        }));
      })
    );

    const attHours: Record<string, number> = {};

    setRecords(results.map(({ dateStr, val }) => {
      const d = new Date(dateStr + 'T00:00:00');
      let hours: string | null = null;
      if (val?.checkIn && val?.checkOut) {
        const diff = parseTime(val.checkOut) - parseTime(val.checkIn);
        if (diff > 0) {
          hours = `${Math.floor(diff / 60)}h ${diff % 60}m`;
          // store as decimal hours (e.g. 6h 30m → 6.5)
          attHours[dateStr] = diff / 60;
        }
      }
      return {
        date: format(d, 'dd MMM'),
        weekday: format(d, 'EEE'),
        status: val?.status ?? null,
        checkIn: val?.checkIn ?? null,
        checkOut: val?.checkOut ?? null,
        hours,
      };
    }));

    setAttendanceHoursByDate(attHours);
    setAttLoading(false);
  };

  // ── Load employee info + live logs ────────────────────────────────────────
  useEffect(() => {
    if (!user?.employeeId) return;

    const fetchReportingTo = async () => {
      if (user.firebaseKey) {
        const snap = await get(ref(database, `hr/employees/${user.firebaseKey}`));
        if (snap.exists()) { setReportingTo(snap.val().reportingTo ?? ''); return; }
      }
      const allSnap = await get(ref(database, 'hr/employees'));
      if (allSnap.exists()) {
        const found: any = Object.values(allSnap.val()).find(
          (e: any) => e.employeeId === user.employeeId
        );
        if (found) setReportingTo(found.reportingTo ?? '');
      }
    };
    fetchReportingTo();

    const logsRef = ref(database, `hr/timeLogs/${user.employeeId}`);
    const unsub = onValue(logsRef, snap => {
      if (snap.exists()) {
        const data = snap.val();
        setLogs(
          Object.keys(data)
            .map(k => ({ ...data[k], id: k }))
            .sort((a, b) => b.submittedAt - a.submittedAt)
        );
      } else {
        setLogs([]);
      }
    });
    return () => unsub();
  }, [user?.employeeId]);

  // ── Calendar helpers ──────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const firstDay  = startOfMonth(currentDate);
    const startOffset = getDay(firstDay); // 0=Sun
    const daysInMonth = getDaysInMonth(currentDate);
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) return null;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      return { dayNum, dateStr };
    });
  }, [currentDate]);

  const logsByDate = useMemo(() => {
    const map: Record<string, TimeLog[]> = {};
    logs.forEach(log => {
      if (!map[log.date]) map[log.date] = [];
      map[log.date].push(log);
    });
    return map;
  }, [logs]);

  const hoursLoggedByDate = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(log => {
      map[log.date] = (map[log.date] ?? 0) + log.hoursWorked;
    });
    return map;
  }, [logs]);

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = records.reduce(
    (acc, r) => {
      if (r.status === 'Present')      acc.present++;
      else if (r.status === 'Absent')  acc.absent++;
      else if (r.status === 'Leave')   acc.leave++;
      else if (r.status === 'Holiday') acc.holiday++;
      return acc;
    },
    { present: 0, absent: 0, leave: 0, holiday: 0 }
  );

  const totalLoggedHours = logs
    .filter(l => {
      const d = new Date(l.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    })
    .reduce((s, l) => s + l.hoursWorked, 0);

  // ── Open modal ────────────────────────────────────────────────────────────
  const openModal = (dateStr: string) => {
    setSelectedDate(dateStr);
    setForm(emptyForm());
    setModalOpen(true);
  };

  // ── Submit log ────────────────────────────────────────────────────────────
  const submitLog = async () => {
    const { clientName, department, category, projectName, jobType, taskDescription, hoursWorked, billableStatus } = form;

    if (!clientName.trim() || !department || !projectName.trim() || !jobType || !taskDescription.trim() || !hoursWorked) {
      toast.error('Please fill in all required fields');
      return;
    }

    const hrs = parseFloat(hoursWorked);
    if (isNaN(hrs) || hrs <= 0) {
      toast.error('Enter a valid number of hours');
      return;
    }

    const alreadyLogged = hoursLoggedByDate[selectedDate] ?? 0;
    const attendanceHrs = attendanceHoursByDate[selectedDate];
    const maxHrs = attendanceHrs ?? FALLBACK_WORK_HOURS;
    const available = Math.max(0, maxHrs - alreadyLogged);

    if (hrs > available) {
      if (attendanceHrs !== undefined) {
        toast.error(
          `You can only log ${available.toFixed(1)}h more. Your attendance for this day is ${attendanceHrs.toFixed(1)}h and ${alreadyLogged}h is already logged.`
        );
      } else {
        toast.error(`Only ${available}h available for this day (${alreadyLogged}h already logged)`);
      }
      return;
    }

    setSubmitting(true);
    try {
      const newRef = push(ref(database, `hr/timeLogs/${user!.employeeId}`));
      await set(newRef, {
        date: selectedDate,
        clientName: clientName.trim(),
        department,
        category: category.trim(),
        projectName: projectName.trim(),
        jobType,
        taskDescription: taskDescription.trim(),
        hoursWorked: hrs,
        billableStatus,
        status: 'pending',
        reportingTo,
        employeeId: user!.employeeId,
        employeeName: user!.name,
        submittedAt: Date.now(),
      });
      toast.success('Work log submitted!');
      setModalOpen(false);
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateForm = (key: keyof LogForm, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Timesheet</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track attendance and log daily work</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Present',    val: summary.present,        bg: 'bg-green-500' },
          { label: 'Absent',     val: summary.absent,         bg: 'bg-red-500' },
          { label: 'Leave',      val: summary.leave,          bg: 'bg-amber-500' },
          { label: 'Holiday',    val: summary.holiday,        bg: 'bg-blue-500' },
          { label: 'Hrs Logged', val: `${totalLoggedHours}h`, bg: 'bg-primary' },
        ].map(s => (
          <Card key={s.label} className="overflow-hidden border-0 shadow-sm">
            <div className={`${s.bg} text-white px-4 py-3 text-center`}>
              <p className="text-xl font-bold leading-none">{s.val}</p>
              <p className="text-xs opacity-80 mt-1">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timesheet">
        <TabsList className="grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="timesheet" className="gap-2">
            <Calendar className="h-3.5 w-3.5" />
            My Timesheet
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <Clock className="h-3.5 w-3.5" />
            Attendance
          </TabsTrigger>
        </TabsList>

        {/* ── Timesheet (Calendar) Tab ── */}
        <TabsContent value="timesheet" className="mt-5">
          <Card className="shadow-sm">
            {/* Month navigation */}
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentDate(d => subMonths(d, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-3">
                  <Select
                    value={String(month)}
                    onValueChange={v => setCurrentDate(new Date(year, Number(v) - 1, 1))}
                  >
                    <SelectTrigger className="w-36 h-8 text-sm font-semibold border-0 shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(year)}
                    onValueChange={v => setCurrentDate(new Date(Number(v), month - 1, 1))}
                  >
                    <SelectTrigger className="w-20 h-8 text-sm font-semibold border-0 shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentDate(d => addMonths(d, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b">
                {WEEKDAYS.map(d => (
                  <div
                    key={d}
                    className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} className="min-h-[110px] border-r border-b bg-muted/20" />;
                  }

                  const { dayNum, dateStr } = day;
                  const isToday = dateStr === format(now, 'yyyy-MM-dd');
                  const dayLogs = logsByDate[dateStr] ?? [];
                  const loggedHrs = hoursLoggedByDate[dateStr] ?? 0;
                  const isWeekend = new Date(dateStr + 'T00:00:00').getDay() === 0 || new Date(dateStr + 'T00:00:00').getDay() === 6;

                  return (
                    <div
                      key={dateStr}
                      className={`group relative min-h-[110px] border-r border-b p-1.5 ${
                        isWeekend ? 'bg-muted/30' : 'bg-background'
                      } ${idx % 7 === 6 ? 'border-r-0' : ''} hover:bg-accent/20 transition-colors`}
                    >
                      {/* Day number + add button */}
                      <div className="flex items-start justify-between mb-1">
                        <span
                          className={`text-sm font-semibold leading-none w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground'
                          }`}
                        >
                          {dayNum}
                        </span>
                        <button
                          onClick={() => openModal(dateStr)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full flex items-center justify-center text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600"
                          title="Add work log"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Hours logged indicator */}
                      {loggedHrs > 0 && (
                        <div className="text-[10px] text-muted-foreground mb-1 font-medium">
                          {loggedHrs}h / {AVAILABLE_WORK_HOURS_PER_DAY}h
                        </div>
                      )}

                      {/* Log entries (show up to 2, then "+N more") */}
                      <div className="space-y-0.5">
                        {dayLogs.slice(0, 2).map(log => {
                          const cfg = logStatusConfig[log.status];
                          return (
                            <div
                              key={log.id}
                              className={`text-[10px] leading-tight px-1.5 py-0.5 rounded border font-medium truncate ${cfg.cls}`}
                              title={`${log.projectName} — ${log.hoursWorked}h`}
                            >
                              {log.projectName || log.taskDescription} · {log.hoursWorked}h
                            </div>
                          );
                        })}
                        {dayLogs.length > 2 && (
                          <div className="text-[10px] text-muted-foreground pl-1">
                            +{dayLogs.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Attendance Tab ── */}
        <TabsContent value="attendance" className="mt-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{MONTHS[month - 1]} {year} — Attendance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {attLoading ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <span className="inline-block h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2 align-middle" />
                  Loading...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                        <th className="text-left py-3 px-4 font-semibold">Date</th>
                        <th className="text-left py-3 px-4 font-semibold">Day</th>
                        <th className="text-left py-3 px-4 font-semibold">Status</th>
                        <th className="text-left py-3 px-4 font-semibold">Check In</th>
                        <th className="text-left py-3 px-4 font-semibold">Check Out</th>
                        <th className="text-left py-3 px-4 font-semibold">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-4 font-medium">{r.date}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">{r.weekday}</td>
                          <td className="py-2.5 px-4">
                            {r.status ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                {r.status}
                              </span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">{r.checkIn ?? '—'}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">{r.checkOut ?? '—'}</td>
                          <td className="py-2.5 px-4">
                            {r.hours ? (
                              <span className="text-xs font-semibold text-primary">{r.hours}</span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Log Time Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Log Time
              {selectedDate && (
                <span className="text-muted-foreground font-normal text-sm ml-1">
                  · {format(new Date(selectedDate + 'T00:00:00'), 'd MMM yyyy, EEE')}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Available hours info */}
          {selectedDate && (() => {
            const attHrs = attendanceHoursByDate[selectedDate];
            const logged = hoursLoggedByDate[selectedDate] ?? 0;
            const maxHrs = attHrs ?? FALLBACK_WORK_HOURS;
            const remaining = Math.max(0, maxHrs - logged);
            return (
              <div className={`flex items-center gap-2 text-xs rounded-md px-3 py-2 ${
                attHrs !== undefined
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-amber-50 text-amber-700'
              }`}>
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {attHrs !== undefined ? (
                    <>
                      Attendance: <span className="font-semibold">{attHrs.toFixed(1)}h</span>
                      {' · '}Logged: <span className="font-semibold">{logged}h</span>
                      {' · '}Remaining:{' '}
                      <span className="font-semibold">{remaining.toFixed(1)}h</span>
                    </>
                  ) : (
                    <>No attendance record for this day — limit set to {FALLBACK_WORK_HOURS}h</>
                  )}
                </span>
              </div>
            );
          })()}

          <div className="space-y-4 py-1">
            {/* Client Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Client Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Enter client name"
                value={form.clientName}
                onChange={e => updateForm('clientName', e.target.value)}
                className="h-9"
              />
            </div>

            {/* Department + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Department <span className="text-destructive">*</span>
                </Label>
                <Select value={form.department} onValueChange={v => updateForm('department', v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Category
                </Label>
                <Select value={form.category} onValueChange={v => updateForm('category', v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Project Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Enter project name"
                value={form.projectName}
                onChange={e => updateForm('projectName', e.target.value)}
                className="h-9"
              />
            </div>

            {/* Job Type + Hours */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Job Type <span className="text-destructive">*</span>
                </Label>
                <Select value={form.jobType} onValueChange={v => updateForm('jobType', v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map(j => (
                      <SelectItem key={j} value={j}>{j}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Hours <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min="0.5"
                  max={Math.max(0, (attendanceHoursByDate[selectedDate] ?? FALLBACK_WORK_HOURS) - (hoursLoggedByDate[selectedDate] ?? 0))}
                  step="0.5"
                  placeholder="e.g. 2"
                  value={form.hoursWorked}
                  onChange={e => updateForm('hoursWorked', e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={3}
                placeholder="Describe the work done..."
                value={form.taskDescription}
                onChange={e => updateForm('taskDescription', e.target.value)}
                className="resize-none text-sm"
              />
              <p className="text-xs text-muted-foreground">{form.taskDescription.length} / 500</p>
            </div>

            {/* Billable Status */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Billable Status
              </Label>
              <div className="flex gap-2">
                {(['billable', 'non-billable'] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updateForm('billableStatus', opt)}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-all ${
                      form.billableStatus === opt
                        ? opt === 'billable'
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-gray-500 text-white border-gray-500'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
                    }`}
                  >
                    {opt === 'billable' ? 'Billable' : 'Non-Billable'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitLog} disabled={submitting} className="gap-2">
              {submitting ? (
                <>
                  <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
