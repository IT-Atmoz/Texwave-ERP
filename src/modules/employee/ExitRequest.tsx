import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, push, set, onValue } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { LogOut, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

type ExitStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'completed';

interface ExitRequest {
  id: string;
  reason: string;
  lastWorkingDatePreferred: string;
  noticePeriodDays: number;
  additionalNotes: string;
  status: ExitStatus;
  employeeId: string;
  employeeName: string;
  createdAt: number;
  hrNote?: string;
  actualLastWorkingDate?: string;
  settlementStatus?: string;
}

const statusConfig: Record<ExitStatus, { label: string; cls: string; icon: any }> = {
  submitted:    { label: 'Submitted',     cls: 'bg-blue-100 text-blue-700',   icon: Clock },
  under_review: { label: 'Under Review',  cls: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  approved:     { label: 'Approved',      cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected:     { label: 'Rejected',      cls: 'bg-red-100 text-red-700',     icon: XCircle },
  completed:    { label: 'Completed',     cls: 'bg-gray-100 text-gray-600',   icon: CheckCircle2 },
};

export default function ExitRequest() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState('');
  const [lastWorkingDate, setLastWorkingDate] = useState('');
  const [noticeDays, setNoticeDays] = useState('30');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const empKey = user?.firebaseKey || user?.employeeId || '';

  useEffect(() => {
    if (!empKey) return;
    const unsub = onValue(ref(database, 'hr/exitRequests'), snap => {
      if (!snap.exists()) { setRequests([]); return; }
      const data = snap.val();
      const list: ExitRequest[] = Object.entries(data)
        .map(([id, v]: any) => ({ ...v, id }))
        .filter((r: any) => r.employeeId === empKey || r.employeeId === user?.employeeId)
        .sort((a: any, b: any) => b.createdAt - a.createdAt);
      setRequests(list);
    });
    return () => unsub();
  }, [empKey, user?.employeeId]);

  const hasActiveRequest = requests.some(r =>
    r.status === 'submitted' || r.status === 'under_review' || r.status === 'approved'
  );

  const handleSubmit = async () => {
    if (!reason.trim()) { toast.error('Please provide a reason'); return; }
    if (!lastWorkingDate) { toast.error('Please select preferred last working date'); return; }
    if (hasActiveRequest) {
      toast.error('You already have an active exit request');
      return;
    }
    setSubmitting(true);
    try {
      const newRef = push(ref(database, 'hr/exitRequests'));
      await set(newRef, {
        reason: reason.trim(),
        lastWorkingDatePreferred: lastWorkingDate,
        noticePeriodDays: Number(noticeDays) || 30,
        additionalNotes: additionalNotes.trim(),
        status: 'submitted',
        employeeId: empKey,
        employeeName: user?.name || '',
        createdAt: Date.now(),
      });
      toast.success('Exit request submitted. HR will review and respond shortly.');
      setReason('');
      setLastWorkingDate('');
      setAdditionalNotes('');
      setNoticeDays('30');
      setShowForm(false);
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Exit Request</h1>
          <p className="text-sm text-muted-foreground">Submit your resignation and track the exit process</p>
        </div>
        {!hasActiveRequest && (
          <Button variant="destructive" onClick={() => setShowForm(v => !v)} className="gap-2">
            <LogOut className="h-4 w-4" />
            {showForm ? 'Cancel' : 'Raise Exit Request'}
          </Button>
        )}
      </div>

      {hasActiveRequest && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Active exit request exists</p>
            <p className="text-xs mt-0.5">You cannot raise a new request until the current one is resolved.</p>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && !hasActiveRequest && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <LogOut className="h-4 w-4" />
              Resignation Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Reason for Leaving *</Label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Please provide your reason for leaving..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Preferred Last Working Date *</Label>
                <Input
                  type="date"
                  value={lastWorkingDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setLastWorkingDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Notice Period (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={noticeDays}
                  onChange={e => setNoticeDays(e.target.value)}
                  placeholder="30"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Additional Notes</Label>
              <Textarea
                value={additionalNotes}
                onChange={e => setAdditionalNotes(e.target.value)}
                placeholder="Any handover notes, pending work details..."
                rows={2}
              />
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              <strong>Note:</strong> Submitting this request will initiate the exit process. HR will review and confirm your last working date.
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleSubmit} disabled={submitting || !reason.trim() || !lastWorkingDate}>
                {submitting ? 'Submitting...' : 'Submit Exit Request'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <LogOut className="h-4 w-4 text-primary" />
            Exit Request History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LogOut className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No exit requests raised</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.map(req => {
                const cfg = statusConfig[req.status];
                const Icon = cfg.icon;
                return (
                  <div key={req.id} className="p-4 hover:bg-muted/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">Resignation Request</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{req.reason}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>Submitted: {new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          <span>Preferred LWD: {req.lastWorkingDatePreferred}</span>
                          <span>Notice: {req.noticePeriodDays} days</span>
                        </div>
                        {req.actualLastWorkingDate && (
                          <p className="text-xs font-medium text-green-700 mt-1">
                            Confirmed LWD: {req.actualLastWorkingDate}
                          </p>
                        )}
                        {req.settlementStatus && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Settlement: {req.settlementStatus}
                          </p>
                        )}
                        {req.hrNote && (
                          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200 text-xs text-blue-800">
                            <span className="font-semibold">HR Note: </span>{req.hrNote}
                          </div>
                        )}
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.cls}`}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
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
