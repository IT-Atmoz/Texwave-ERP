import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, onValue, update, get, set } from 'firebase/database';
import { format } from 'date-fns';
import { CheckCircle, XCircle, AlertCircle, Clock, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { sendNotification } from '@/services/notifications';

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
  reviewedAt?: number;
  reviewNote?: string;
}

function to12h(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function Regularization() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RegRequest[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [reviewTarget, setReviewTarget] = useState<RegRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(database, 'hr/regularizationRequests'), snap => {
      if (!snap.exists()) { setRequests([]); return; }
      const list: RegRequest[] = Object.entries(snap.val())
        .map(([id, v]: any) => ({ ...v, id }))
        .sort((a: RegRequest, b: RegRequest) => b.submittedAt - a.submittedAt);
      setRequests(list);
    });
    return () => unsub();
  }, []);

  const openReview = (req: RegRequest, action: 'approved' | 'rejected') => {
    setReviewTarget(req);
    setReviewAction(action);
    setReviewNote('');
  };

  const handleReview = async () => {
    if (!reviewTarget) return;
    setSubmitting(true);
    try {
      const reviewer = user?.name || user?.username || 'HR';

      await update(ref(database, `hr/regularizationRequests/${reviewTarget.id}`), {
        status: reviewAction,
        reviewedBy: reviewer,
        reviewedAt: Date.now(),
        reviewNote: reviewNote.trim() || null,
      });

      // If approved → patch the actual attendance record
      if (reviewAction === 'approved') {
        const attPath = `hr/attendance/${reviewTarget.date}/${reviewTarget.employeeId}`;
        const snap = await get(ref(database, attPath));
        const existing = snap.exists() ? snap.val() : null;

        const checkIn = reviewTarget.requestedCheckIn ? to12h(reviewTarget.requestedCheckIn) : null;
        const checkOut = reviewTarget.requestedCheckOut ? to12h(reviewTarget.requestedCheckOut) : null;

        if (existing) {
          const patch: Record<string, any> = { status: 'Present' };
          if (checkIn) {
            patch.checkIn = checkIn;
            const sessions = existing.sessions ?? [];
            if (sessions.length === 0) {
              patch.sessions = [{ checkIn, checkInMs: Date.now(), checkOut: checkOut ?? null }];
            } else if (reviewTarget.type === 'missed-checkin') {
              patch.sessions = [{ checkIn, checkInMs: Date.now(), checkOut: sessions[0]?.checkOut ?? null }, ...sessions.slice(1)];
            }
          }
          if (checkOut) {
            patch.checkOut = checkOut;
            const sessions = (patch.sessions ?? existing.sessions ?? []) as any[];
            if (sessions.length > 0) {
              const last = { ...sessions[sessions.length - 1], checkOut, checkOutMs: Date.now() };
              patch.sessions = [...sessions.slice(0, -1), last];
            }
          }
          patch.regularized = true;
          await update(ref(database, attPath), patch);
        } else {
          // No record existed — create one
          await set(ref(database, attPath), {
            employeeId: reviewTarget.employeeId,
            employeeName: reviewTarget.employeeName,
            date: reviewTarget.date,
            status: 'Present',
            checkIn: checkIn ?? '',
            checkOut: checkOut ?? null,
            sessions: checkIn ? [{ checkIn, checkInMs: Date.now(), checkOut: checkOut ?? null }] : [],
            totalWorkedMs: 0,
            regularized: true,
          });
        }
      }

      // Notify the employee
      const usersSnap = await get(ref(database, 'users'));
      let empKey = '';
      if (usersSnap.exists()) {
        const usersData = usersSnap.val();
        for (const key of Object.keys(usersData)) {
          if (usersData[key].employeeId === reviewTarget.employeeId) { empKey = key; break; }
        }
      }
      if (empKey) {
        await sendNotification(
          empKey,
          `Regularization ${reviewAction === 'approved' ? 'Approved ✓' : 'Rejected ✗'}`,
          `Your regularization for ${reviewTarget.date} (${REG_TYPE_LABELS[reviewTarget.type]}) has been ${reviewAction} by ${reviewer}${reviewNote.trim() ? `. Note: ${reviewNote.trim()}` : ''}.`,
          'attendance',
        );
      }

      toast.success(`Request ${reviewAction}`);
      setReviewTarget(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update request');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = requests.filter(r => {
    const matchSearch = r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.date.includes(search) || r.reason.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pending = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Regularization Requests</h2>
          <p className="text-sm text-muted-foreground">Review and action employee attendance regularization requests</p>
        </div>
        {pending > 0 && (
          <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-sm font-semibold rounded-full">
            {pending} pending
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, date, reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <Clock className="h-10 w-10 opacity-20" />
          <p className="text-sm">No regularization requests found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(req => (
            <div key={req.id} className="bg-white border border-border rounded-lg px-5 py-4 flex items-start gap-4 hover:border-primary/30 transition-colors">
              {/* Status icon */}
              <div className="shrink-0 mt-0.5">
                {req.status === 'approved' ? <CheckCircle className="h-5 w-5 text-green-500" />
                  : req.status === 'rejected' ? <XCircle className="h-5 w-5 text-red-500" />
                  : <AlertCircle className="h-5 w-5 text-amber-500" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{req.employeeName}</span>
                  <span className="text-xs text-muted-foreground">{req.employeeId}</span>
                  <Badge variant="outline" className="text-[10px] py-0">{REG_TYPE_LABELS[req.type]}</Badge>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    req.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200'
                    : req.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="font-medium text-foreground">{format(new Date(req.date), 'dd MMM yyyy, EEEE')}</span>
                  {req.requestedCheckIn && <span>Check-in: <strong className="text-blue-600">{to12h(req.requestedCheckIn)}</strong></span>}
                  {req.requestedCheckOut && <span>Check-out: <strong className="text-blue-600">{to12h(req.requestedCheckOut)}</strong></span>}
                </div>

                <p className="text-xs text-muted-foreground mt-1">{req.reason}</p>

                {req.reviewedBy && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {req.status === 'approved' ? 'Approved' : 'Rejected'} by {req.reviewedBy}
                    {req.reviewNote ? ` — "${req.reviewNote}"` : ''}
                    {req.reviewedAt ? ` on ${format(new Date(req.reviewedAt), 'dd MMM, hh:mm a')}` : ''}
                  </p>
                )}
              </div>

              {/* Meta + Actions */}
              <div className="shrink-0 flex flex-col items-end gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(req.submittedAt), 'dd MMM, hh:mm a')}
                </span>
                {req.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => openReview(req, 'rejected')}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => openReview(req, 'approved')}
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={open => !open && setReviewTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approved' ? 'Approve' : 'Reject'} Regularization
            </DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-4 py-1">
              <div className="bg-muted/50 rounded-md px-3 py-2.5 text-sm space-y-0.5">
                <p className="font-semibold">{reviewTarget.employeeName}</p>
                <p className="text-muted-foreground text-xs">{format(new Date(reviewTarget.date), 'dd MMM yyyy')} · {REG_TYPE_LABELS[reviewTarget.type]}</p>
                <p className="text-xs text-muted-foreground mt-1">{reviewTarget.reason}</p>
              </div>
              {reviewAction === 'approved' && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  Approving will update the attendance record for this employee on {reviewTarget.date}.
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Note (optional)</Label>
                <Textarea
                  placeholder="Add a note for the employee..."
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  rows={2}
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
              {submitting ? 'Saving...' : reviewAction === 'approved' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
