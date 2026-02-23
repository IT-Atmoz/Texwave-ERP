import { useEffect, useState } from 'react';
import { database } from '@/services/firebase';
import { ref, onValue, update } from 'firebase/database';
import { getAllRecords } from '@/services/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ClipboardList, Search, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';

interface TimeLog {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  taskDescription: string;
  hoursWorked: number;
  status: 'pending' | 'approved' | 'rejected';
  reportingTo: string;
  submittedAt: number;
}

const statusConfig = {
  pending:  { cls: 'bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-400' },
  approved: { cls: 'bg-green-100 text-green-700 border-green-200',  dot: 'bg-green-500' },
  rejected: { cls: 'bg-red-100 text-red-700 border-red-200',        dot: 'bg-red-500' },
};

export default function WorkLogs() {
  const [allLogs, setAllLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading]  = useState(true);
  const [search, setSearch]    = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    // Load all employees first to get their IDs, then listen for logs
    getAllRecords('hr/employees').then(emps => {
      if (!emps.length) { setLoading(false); return; }

      const combined: TimeLog[] = [];
      let resolved = 0;

      emps.forEach(emp => {
        const logsRef = ref(database, `hr/timeLogs/${emp.id}`);
        onValue(logsRef, snap => {
          // Remove old entries for this employee
          const others = combined.filter(l => l.employeeId !== emp.id);
          if (snap.exists()) {
            const data = snap.val();
            const empLogs: TimeLog[] = Object.keys(data).map(k => ({
              ...data[k],
              id: k,
              employeeId: emp.id,
            }));
            others.push(...empLogs);
          }
          others.sort((a, b) => b.submittedAt - a.submittedAt);
          combined.length = 0;
          combined.push(...others);
          setAllLogs([...combined]);
          resolved++;
          if (resolved === emps.length) setLoading(false);
        });
      });
    });
  }, []);

  const updateStatus = async (log: TimeLog, status: 'approved' | 'rejected') => {
    try {
      await update(ref(database, `hr/timeLogs/${log.employeeId}/${log.id}`), {
        status,
        reviewedAt: Date.now(),
      });
      toast.success(`Log ${status}`);
    } catch {
      toast.error('Failed to update');
    }
  };

  const filtered = allLogs.filter(l => {
    const matchSearch = l.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      l.taskDescription.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = allLogs.reduce(
    (acc, l) => { acc[l.status]++; return acc; },
    { pending: 0, approved: 0, rejected: 0 } as Record<string, number>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Employee Work Logs
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Review and approve daily task submissions</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employee or task..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 w-56"
            />
          </div>
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
            <SelectTrigger className="h-9 w-32 gap-1">
              <Filter className="h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending Review', val: counts.pending,  bg: 'bg-amber-500', icon: Clock },
          { label: 'Approved',       val: counts.approved, bg: 'bg-green-500', icon: CheckCircle },
          { label: 'Rejected',       val: counts.rejected, bg: 'bg-red-500',   icon: XCircle },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="overflow-hidden border-0 shadow-sm">
              <div className={`${s.bg} text-white px-4 py-3 flex items-center gap-3`}>
                <Icon className="h-5 w-5 opacity-80 shrink-0" />
                <div>
                  <p className="text-xl font-bold leading-none">{s.val}</p>
                  <p className="text-xs opacity-80 mt-0.5">{s.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Log Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              Loading work logs...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No work logs found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(log => {
                const cfg = statusConfig[log.status];
                return (
                  <div key={`${log.employeeId}-${log.id}`} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                    {/* Status dot */}
                    <div className={`mt-2 h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{log.employeeName}</span>
                        <span className="text-xs text-muted-foreground">{log.date}</span>
                        <span className="text-xs font-semibold text-primary">{log.hoursWorked}h</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{log.taskDescription}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted {new Date(log.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>

                    {/* Status + Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </span>
                      {log.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 border-green-300 text-green-700 hover:bg-green-50 gap-1"
                            onClick={() => updateStatus(log, 'approved')}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 border-red-300 text-red-600 hover:bg-red-50 gap-1"
                            onClick={() => updateStatus(log, 'rejected')}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
