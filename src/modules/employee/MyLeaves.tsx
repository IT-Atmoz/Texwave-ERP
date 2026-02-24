import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, onValue, push, set } from 'firebase/database';
import { format, addDays, differenceInCalendarDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Umbrella, Plus, CalendarDays, Clock, CheckCircle, XCircle,
  Briefcase, Heart, Star, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type LeaveType = 'Casual' | 'Sick' | 'Earned' | 'Compensatory' | 'Marriage' | 'OnDuty';

interface LeaveBalance {
  available: number;
  taken: number;
}

interface LeaveBalances {
  Casual: LeaveBalance;
  Sick: LeaveBalance;
  Earned: LeaveBalance;
  Compensatory: LeaveBalance;
  Marriage: LeaveBalance;
  OnDuty: LeaveBalance;
}

interface LeaveApplication {
  id: string;
  type: LeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: number;
}

interface Holiday {
  id?: string;
  name: string;
  date: string;
  day?: string;
}

const DEFAULT_BALANCES: LeaveBalances = {
  Casual: { available: 6, taken: 0 },
  Sick: { available: 6, taken: 0 },
  Earned: { available: 15, taken: 0 },
  Compensatory: { available: 0, taken: 0 },
  Marriage: { available: 3, taken: 0 },
  OnDuty: { available: 0, taken: 0 },
};

const LEAVE_META: Record<LeaveType, { label: string; icon: any; color: string; bg: string; border: string }> = {
  Casual:       { label: 'Casual Leaves',       icon: Umbrella,     color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  Sick:         { label: 'Sick Leaves',          icon: Heart,        color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
  Earned:       { label: 'Earned Leaves',        icon: Star,         color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  Compensatory: { label: 'Compensatory Off',     icon: Clock,        color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  Marriage:     { label: 'Marriage Leave',       icon: Heart,        color: 'text-pink-600',   bg: 'bg-pink-50',   border: 'border-pink-200' },
  OnDuty:       { label: 'On Duty',             icon: Briefcase,    color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
};

function statusBadge(s: string) {
  if (s === 'approved') return 'bg-green-100 text-green-700 border-green-200';
  if (s === 'rejected') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MyLeaves() {
  const { user } = useAuth();
  // Raw taken counts per employee from Firebase
  const [takenBalances, setTakenBalances] = useState<Partial<Record<LeaveType, number>>>({});
  // Admin-configured quota (available days) from hr/leavePolicy
  const [policy, setPolicy] = useState<Partial<Record<LeaveType, number>>>({});
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  // Apply leave dialog
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyType, setApplyType] = useState<LeaveType>('Casual');
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [applying, setApplying] = useState(false);

  const leaveDays = Math.max(1, differenceInCalendarDays(new Date(toDate), new Date(fromDate)) + 1);

  // ── Load admin leave policy (quota per type) ──────────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(database, 'hr/leavePolicy'), snap => {
      if (snap.exists()) setPolicy(snap.val());
    });
    return () => unsub();
  }, []);

  // ── Load employee's taken days from their balance record ───────────────────
  useEffect(() => {
    if (!user?.employeeId) return;
    const unsub = onValue(ref(database, `hr/leaveBalances/${user.employeeId}`), snap => {
      if (snap.exists()) {
        const val = snap.val();
        // val may be { Casual: { available, taken }, ... } or { Casual: number }
        const taken: Partial<Record<LeaveType, number>> = {};
        Object.entries(val).forEach(([k, v]: any) => {
          taken[k as LeaveType] = typeof v === 'object' ? (v.taken ?? 0) : 0;
        });
        setTakenBalances(taken);
      }
    });
    return () => unsub();
  }, [user?.employeeId]);

  // ── Load leave applications ────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.employeeId) return;
    const unsub = onValue(ref(database, `hr/leaveApplications`), snap => {
      if (snap.exists()) {
        const data = snap.val();
        const apps: LeaveApplication[] = Object.entries(data)
          .map(([id, v]: any) => ({ ...v, id }))
          .filter((a: any) => a.employeeId === user.employeeId)
          .sort((a: any, b: any) => b.appliedAt - a.appliedAt);
        setApplications(apps);
      } else {
        setApplications([]);
      }
    });
    return () => unsub();
  }, [user?.employeeId]);

  // ── Load holidays (nested: hr/holidays/YYYY-MM/id) ────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(database, 'hr/holidays'), snap => {
      if (!snap.exists()) { setHolidays([]); return; }
      const data = snap.val();
      // Structure: { 'YYYY-MM': { id: { date, name, departments } } }
      const list: Holiday[] = [];
      Object.values(data).forEach((monthObj: any) => {
        if (monthObj && typeof monthObj === 'object') {
          Object.values(monthObj).forEach((h: any) => {
            if (h?.date && h?.name) list.push(h as Holiday);
          });
        }
      });
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      setHolidays(
        list
          .filter(h => h.date >= todayStr)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 8)
      );
    });
    return () => unsub();
  }, []);

  // ── Apply leave ────────────────────────────────────────────────────────────
  const handleApply = async () => {
    if (!user?.employeeId || !reason.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setApplying(true);
    try {
      const newApp = {
        employeeId: user.employeeId,
        employeeName: user.name,
        type: applyType,
        fromDate,
        toDate,
        days: leaveDays,
        reason: reason.trim(),
        status: 'pending',
        appliedAt: Date.now(),
      };
      await push(ref(database, 'hr/leaveApplications'), newApp);
      toast.success(`Leave application submitted for ${leaveDays} day${leaveDays > 1 ? 's' : ''}`);
      setApplyOpen(false);
      setReason('');
    } catch {
      toast.error('Failed to submit leave application');
    }
    setApplying(false);
  };

  const leaveTypes = Object.keys(LEAVE_META) as LeaveType[];

  // Merge policy quota + taken to get effective balance per type
  const balances: LeaveBalances = leaveTypes.reduce((acc, type) => {
    const quota   = policy[type] ?? DEFAULT_BALANCES[type].available;
    const taken   = takenBalances[type] ?? 0;
    acc[type] = { available: Math.max(0, quota - taken), taken };
    return acc;
  }, {} as LeaveBalances);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Leave Tracker</h1>
          <p className="text-sm text-muted-foreground">Manage your leaves and view balances</p>
        </div>
        <Button className="gap-2" onClick={() => setApplyOpen(true)}>
          <Plus className="h-4 w-4" /> Apply Leave
        </Button>
      </div>

      {/* Leave balance cards */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Leave Summary · {new Date().getFullYear()}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {leaveTypes.map(type => {
            const meta = LEAVE_META[type];
            const bal = balances[type];
            const Icon = meta.icon;
            const usedPct = bal.available > 0 ? Math.min(100, (bal.taken / bal.available) * 100) : 0;
            return (
              <Card key={type} className={`border ${meta.border}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`h-7 w-7 rounded-lg ${meta.bg} flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </div>
                    <p className={`text-xs font-semibold ${meta.color}`}>{meta.label}</p>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <p className="text-2xl font-bold text-foreground">{bal.available}</p>
                      <p className="text-[10px] text-muted-foreground">Available</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-muted-foreground">{bal.taken}</p>
                      <p className="text-[10px] text-muted-foreground">Booked</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${usedPct > 75 ? 'bg-red-400' : usedPct > 50 ? 'bg-amber-400' : meta.color.replace('text-', 'bg-')}`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Leave applications + Upcoming holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Applications */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Leave Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <div className="text-center py-10">
                <CalendarDays className="h-10 w-10 text-muted-foreground/25 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No leave applications yet</p>
                <Button size="sm" className="mt-2 h-8 text-xs gap-1" onClick={() => setApplyOpen(true)}>
                  <Plus className="h-3 w-3" /> Apply Leave
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map(app => {
                  const meta = LEAVE_META[app.type];
                  const Icon = meta.icon;
                  return (
                    <div key={app.id} className={`flex items-start gap-3 p-3 rounded-xl border ${meta.border} ${meta.bg}`}>
                      <div className={`h-8 w-8 rounded-lg bg-white flex items-center justify-center shrink-0`}>
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
                          <Badge variant="outline" className={`text-[10px] ${statusBadge(app.status)}`}>
                            {app.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {app.fromDate === app.toDate
                            ? app.fromDate
                            : `${app.fromDate} → ${app.toDate}`} · {app.days} day{app.days > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{app.reason}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming holidays */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              Upcoming Holidays
            </CardTitle>
          </CardHeader>
          <CardContent>
            {holidays.length === 0 ? (
              <div className="text-center py-8">
                <Star className="h-8 w-8 text-muted-foreground/25 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No upcoming holidays</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {holidays.map((h, i) => {
                  const hDate = new Date(h.date + 'T00:00:00');
                  const daysLeft = differenceInCalendarDays(hDate, new Date());
                  return (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                      <div className="h-9 w-9 rounded-lg bg-amber-100 flex flex-col items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-amber-700">{format(hDate, 'd')}</span>
                        <span className="text-[9px] text-amber-600 uppercase">{format(hDate, 'MMM')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-900 truncate">{h.name}</p>
                        <p className="text-xs text-amber-600">{format(hDate, 'EEEE')}</p>
                      </div>
                      {daysLeft >= 0 && (
                        <Badge className="text-[10px] bg-amber-200 text-amber-800 border-0 shrink-0">
                          {daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Apply Leave Dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Leave Type</Label>
              <Select value={applyType} onValueChange={v => setApplyType(v as LeaveType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map(t => (
                    <SelectItem key={t} value={t}>{LEAVE_META[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From Date</Label>
                <Input type="date" value={fromDate}
                  onChange={e => { setFromDate(e.target.value); if (e.target.value > toDate) setToDate(e.target.value); }} />
              </div>
              <div className="space-y-1.5">
                <Label>To Date</Label>
                <Input type="date" value={toDate} min={fromDate}
                  onChange={e => setToDate(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-sm text-blue-700">
                <strong>{leaveDays}</strong> day{leaveDays > 1 ? 's' : ''} leave will be applied
              </span>
            </div>

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea
                placeholder="Enter reason for leave..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button onClick={handleApply} disabled={applying || !reason.trim()}>
              {applying ? 'Submitting...' : 'Submit Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
