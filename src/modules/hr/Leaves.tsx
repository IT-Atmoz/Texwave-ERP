import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, onValue, update, increment, get } from 'firebase/database';
import { Check, X, Search, Download, Clock, CheckCircle, XCircle, CalendarDays, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { sendNotification, notifyAdminFeed } from '@/services/notifications';

interface LeaveApplication {
  id: string;
  employeeId: string;
  employeeFirebaseKey?: string;
  employeeName: string;
  type: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: number;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: number;
}

const LEAVE_TYPE_COLORS: Record<string, string> = {
  Casual: 'bg-blue-100 text-blue-700',
  Sick: 'bg-red-100 text-red-700',
  Earned: 'bg-green-100 text-green-700',
  Compensatory: 'bg-purple-100 text-purple-700',
  Marriage: 'bg-pink-100 text-pink-700',
  OnDuty: 'bg-amber-100 text-amber-700',
};

export default function Leaves() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));

  // Review dialog
  const [reviewTarget, setReviewTarget] = useState<LeaveApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canApprove = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';

  // Real-time listener on hr/leaveApplications
  useEffect(() => {
    const unsub = onValue(ref(database, 'hr/leaveApplications'), snap => {
      if (!snap.exists()) { setApplications([]); return; }
      const list: LeaveApplication[] = Object.entries(snap.val())
        .map(([id, v]: any) => ({ ...v, id }))
        .sort((a: any, b: any) => b.appliedAt - a.appliedAt);
      setApplications(list);
    });
    return () => unsub();
  }, []);

  const openReview = (app: LeaveApplication, action: 'approved' | 'rejected') => {
    setReviewTarget(app);
    setReviewAction(action);
    setReviewNote('');
  };

  const handleReview = async () => {
    if (!reviewTarget) return;
    setSubmitting(true);
    try {
      const reviewer = user?.name || user?.username || 'HR';

      // 1. Update leave application status
      await update(ref(database, `hr/leaveApplications/${reviewTarget.id}`), {
        status: reviewAction,
        reviewNote: reviewNote.trim() || null,
        reviewedBy: reviewer,
        reviewedAt: Date.now(),
      });

      // 2. If approved → deduct from leave balance
      if (reviewAction === 'approved') {
        await update(
          ref(database, `hr/leaveBalances/${reviewTarget.employeeId}/${reviewTarget.type}`),
          { taken: increment(reviewTarget.days) },
        );
      }

      // 3. Resolve employee notification key: prefer stored firebaseKey,
      //    fallback to looking up in users/ by employeeId
      let empNotifKey = reviewTarget.employeeFirebaseKey || '';
      if (!empNotifKey || empNotifKey === reviewTarget.employeeId) {
        // Try to find the real Firebase key from users/ node
        const usersSnap = await get(ref(database, 'users'));
        if (usersSnap.exists()) {
          const usersData = usersSnap.val();
          for (const key of Object.keys(usersData)) {
            if (usersData[key].employeeId === reviewTarget.employeeId) {
              empNotifKey = key;
              break;
            }
          }
        }
      }
      if (!empNotifKey) empNotifKey = reviewTarget.employeeId;

      await sendNotification(
        empNotifKey,
        `Leave ${reviewAction === 'approved' ? 'Approved ✓' : 'Rejected ✗'}`,
        `Your ${reviewTarget.type} leave (${reviewTarget.fromDate} – ${reviewTarget.toDate}) has been ${reviewAction} by ${reviewer}${reviewNote.trim() ? `. Note: ${reviewNote.trim()}` : ''}`,
        'leave',
      );

      // 4. Notify admin feed so all staff see the action
      await notifyAdminFeed(
        `Leave ${reviewAction === 'approved' ? 'Approved' : 'Rejected'} — ${reviewTarget.employeeName}`,
        `${reviewTarget.type} leave (${reviewTarget.fromDate} – ${reviewTarget.toDate}, ${reviewTarget.days} day${reviewTarget.days > 1 ? 's' : ''}) ${reviewAction} by ${reviewer}`,
        'leave',
      );

      toast.success(`Leave ${reviewAction} — balance updated & employee notified`);
      setReviewTarget(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update leave status');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    return applications.filter(a => {
      const matchSearch = a.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.type.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchType = typeFilter === 'all' || a.type === typeFilter;
      const matchMonth = !monthFilter || a.fromDate.startsWith(monthFilter);
      return matchSearch && matchStatus && matchType && matchMonth;
    });
  }, [applications, searchTerm, statusFilter, typeFilter, monthFilter]);

  const stats = useMemo(() => ({
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  }), [applications]);

  const exportCSV = () => {
    const headers = ['Employee', 'Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Reviewed By', 'Applied On'];
    const rows = filtered.map(a => [
      a.employeeName,
      a.type,
      a.fromDate,
      a.toDate,
      a.days,
      `"${a.reason.replace(/"/g, '""')}"`,
      a.status,
      a.reviewedBy || '',
      new Date(a.appliedAt).toLocaleDateString('en-IN'),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LeaveApplications_${monthFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allTypes = [...new Set(applications.map(a => a.type))];

  return (
    <div className="space-y-5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Leave Applications</h2>
          <p className="text-sm text-muted-foreground">Review and approve employee leave requests — real-time</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-amber-700">{stats.pending}</p>
            <p className="text-xs text-amber-600 mt-0.5">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-green-700">{stats.approved}</p>
            <p className="text-xs text-green-600 mt-0.5">Approved</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-3xl font-bold text-red-700">{stats.rejected}</p>
            <p className="text-xs text-red-600 mt-0.5">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employee, reason..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              type="month"
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="w-40"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {allTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No leave applications found</p>
              <p className="text-xs mt-1 opacity-60">Employees can apply for leave from the employee portal</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-center">Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    {canApprove && <TableHead className="text-center">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(app => (
                    <TableRow key={app.id} className={app.status === 'pending' ? 'bg-amber-50/30' : ''}>
                      <TableCell className="font-medium">{app.employeeName}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] border-0 ${LEAVE_TYPE_COLORS[app.type] || 'bg-gray-100 text-gray-700'}`}>
                          {app.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{app.fromDate}</TableCell>
                      <TableCell className="text-sm">{app.toDate}</TableCell>
                      <TableCell className="text-center font-bold">{app.days}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate text-sm">{app.reason}</p>
                        {app.reviewNote && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic truncate">Note: {app.reviewNote}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          app.status === 'approved' ? 'bg-green-100 text-green-800 border-0' :
                          app.status === 'rejected' ? 'bg-red-100 text-red-800 border-0' :
                          'bg-amber-100 text-amber-800 border-0'
                        }>
                          {app.status === 'pending' ? (
                            <><Clock className="h-3 w-3 mr-1 inline" />Pending</>
                          ) : app.status === 'approved' ? (
                            <><CheckCircle className="h-3 w-3 mr-1 inline" />Approved</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1 inline" />Rejected</>
                          )}
                        </Badge>
                        {app.reviewedBy && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">by {app.reviewedBy}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(app.appliedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </TableCell>
                      {canApprove && (
                        <TableCell>
                          {app.status === 'pending' ? (
                            <div className="flex gap-1.5 justify-center">
                              <Button
                                size="sm"
                                className="h-7 px-2 bg-green-600 hover:bg-green-700 gap-1"
                                onClick={() => openReview(app, 'approved')}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 gap-1"
                                onClick={() => openReview(app, 'rejected')}
                              >
                                <X className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={v => { if (!v) setReviewTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={reviewAction === 'approved' ? 'text-green-700' : 'text-red-700'}>
              {reviewAction === 'approved' ? 'Approve' : 'Reject'} Leave Request
            </DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/40 space-y-1 text-sm">
                <p><span className="font-semibold">Employee:</span> {reviewTarget.employeeName}</p>
                <p><span className="font-semibold">Type:</span> {reviewTarget.type}</p>
                <p><span className="font-semibold">Period:</span> {reviewTarget.fromDate} → {reviewTarget.toDate} ({reviewTarget.days} day{reviewTarget.days > 1 ? 's' : ''})</p>
                <p><span className="font-semibold">Reason:</span> {reviewTarget.reason}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Review Note (optional)</Label>
                <Textarea
                  placeholder={reviewAction === 'approved' ? 'Any note for the employee...' : 'Reason for rejection...'}
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)}>Cancel</Button>
            <Button
              onClick={handleReview}
              disabled={submitting}
              className={reviewAction === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {submitting ? 'Saving...' : (reviewAction === 'approved' ? 'Confirm Approve' : 'Confirm Reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
