import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, get, push, set, onValue } from 'firebase/database';
import { format, getDaysInMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Calendar, Plus, CheckCircle, XCircle, AlertCircle, Send } from 'lucide-react';

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
  taskDescription: string;
  hoursWorked: number;
  status: 'pending' | 'approved' | 'rejected';
  reportingTo: string;
  employeeId: string;
  employeeName: string;
  submittedAt: number;
  notes?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
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
  pending:  { cls: 'bg-amber-100 text-amber-700',  icon: AlertCircle,   label: 'Pending' },
  approved: { cls: 'bg-green-100 text-green-700',  icon: CheckCircle,   label: 'Approved' },
  rejected: { cls: 'bg-red-100 text-red-700',      icon: XCircle,       label: 'Rejected' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MyTimesheet() {
  const { user } = useAuth();
  const now = new Date();

  // Attendance tab state
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [year, setYear]       = useState(now.getFullYear());
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [attLoading, setAttLoading] = useState(false);

  // Time-log tab state
  const [logs, setLogs]           = useState<TimeLog[]>([]);
  const [logDate, setLogDate]     = useState(format(now, 'yyyy-MM-dd'));
  const [logHours, setLogHours]   = useState('');
  const [logDesc, setLogDesc]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reportingTo, setReportingTo] = useState('');

  // Auto-fill from attendance
  const [autoFillInfo, setAutoFillInfo] = useState<{ checkIn: string; checkOut: string; hours: number } | null>(null);

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // ── Load attendance month ──────────────────────────────────────────────────
  useEffect(() => {
    if (user?.employeeId) loadMonth();
  }, [month, year, user?.employeeId]);

  const loadMonth = async () => {
    if (!user?.employeeId) return;
    setAttLoading(true);
    const days = getDaysInMonth(new Date(year, month - 1));
    const results = await Promise.all(
      Array.from({ length: days }, (_, i) => {
        const d   = String(i + 1).padStart(2, '0');
        const ds  = `${year}-${String(month).padStart(2, '0')}-${d}`;
        return get(ref(database, `hr/attendance/${ds}/${user.employeeId}`)).then(snap => ({
          dateStr: ds,
          val: snap.exists() ? snap.val() : null,
        }));
      })
    );

    const parseTime = (t: string) => {
      const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!m) return 0;
      let h = parseInt(m[1]);
      const mins = parseInt(m[2]);
      const ap = m[3].toUpperCase();
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return h * 60 + mins;
    };

    setRecords(results.map(({ dateStr, val }) => {
      const d = new Date(dateStr + 'T00:00:00');
      let hours: string | null = null;
      if (val?.checkIn && val?.checkOut) {
        const diff = parseTime(val.checkOut) - parseTime(val.checkIn);
        if (diff > 0) hours = `${Math.floor(diff / 60)}h ${diff % 60}m`;
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
    setAttLoading(false);
  };

  // ── Load reporting-to + time logs (real-time) ──────────────────────────────
  useEffect(() => {
    if (!user?.employeeId) return;

    // Fetch employee record for reportingTo
    get(ref(database, `hr/employees/${user.employeeId}`)).then(snap => {
      if (snap.exists()) setReportingTo(snap.val().reportingTo ?? '');
    });

    // Live logs
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

  // ── Submit time log ────────────────────────────────────────────────────────
  const submitLog = async () => {
    if (!logDate || !logHours || !logDesc.trim()) {
      toast.error('Please fill in date, hours and task description');
      return;
    }
    const hrs = parseFloat(logHours);
    if (isNaN(hrs) || hrs <= 0 || hrs > 24) {
      toast.error('Enter a valid number of hours (0–24)');
      return;
    }
    setSubmitting(true);
    try {
      const newRef = push(ref(database, `hr/timeLogs/${user!.employeeId}`));
      await set(newRef, {
        date: logDate,
        taskDescription: logDesc.trim(),
        hoursWorked: hrs,
        status: 'pending',
        reportingTo,
        employeeId: user!.employeeId,
        employeeName: user!.name,
        submittedAt: Date.now(),
      });
      toast.success('Work log submitted successfully!');
      setLogDesc('');
      setLogHours('');
      setLogDate(format(new Date(), 'yyyy-MM-dd'));
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Summary ────────────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Timesheet</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track attendance and log daily work</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Present',  val: summary.present,       bg: 'bg-green-500' },
          { label: 'Absent',   val: summary.absent,        bg: 'bg-red-500' },
          { label: 'Leave',    val: summary.leave,         bg: 'bg-amber-500' },
          { label: 'Holiday',  val: summary.holiday,       bg: 'bg-blue-500' },
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
      <Tabs defaultValue="log">
        <TabsList className="grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="log" className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Log Work
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <Calendar className="h-3.5 w-3.5" />
            Attendance
          </TabsTrigger>
        </TabsList>

        {/* ── Log Work Tab ── */}
        <TabsContent value="log" className="space-y-5 mt-5">
          {/* Submit Form */}
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                Submit Today's Work Log
                {reportingTo && (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    Sends to: <span className="font-semibold text-foreground">{reportingTo}</span>
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</Label>
                  <Input
                    type="date"
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hours Worked</Label>
                  <Input
                    type="number"
                    min="0.5"
                    max="24"
                    step="0.5"
                    placeholder="e.g. 8"
                    value={logHours}
                    onChange={e => setLogHours(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  What did you work on? *
                </Label>
                <Textarea
                  rows={4}
                  placeholder="Describe your tasks in detail — e.g. Completed the dashboard redesign for the HR module, fixed bug in payroll calculation, attended team standup..."
                  value={logDesc}
                  onChange={e => setLogDesc(e.target.value)}
                  className="resize-none text-sm"
                />
                <p className="text-xs text-muted-foreground">{logDesc.length} / 500 characters</p>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={submitLog}
                  disabled={submitting}
                  className="gap-2 h-10 px-6"
                >
                  {submitting ? (
                    <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
                  ) : (
                    <><Send className="h-4 w-4" />Submit Work Log</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Log History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Submitted Logs
                <Badge variant="secondary" className="ml-auto">{logs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {logs.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No work logs yet. Submit one above!</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {logs.map(log => {
                    const cfg = logStatusConfig[log.status];
                    const Icon = cfg.icon;
                    return (
                      <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cfg.cls}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-snug">{log.taskDescription}</p>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted-foreground">{log.date}</span>
                            <span className="text-xs font-semibold text-primary">{log.hoursWorked}h</span>
                            {log.reportingTo && (
                              <span className="text-xs text-muted-foreground">→ {log.reportingTo}</span>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
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
    </div>
  );
}
