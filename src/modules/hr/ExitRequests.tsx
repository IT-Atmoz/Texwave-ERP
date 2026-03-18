import { useEffect, useState } from 'react';
import { database } from '@/services/firebase';
import { ref, onValue, update } from 'firebase/database';
import { sendNotification } from '@/services/notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LogOut, Clock, CheckCircle2, XCircle, AlertTriangle, Search } from 'lucide-react';

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

const STATUS_OPTIONS: { value: ExitStatus; label: string }[] = [
  { value: 'submitted',    label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved',     label: 'Approved' },
  { value: 'rejected',     label: 'Rejected' },
  { value: 'completed',    label: 'Completed' },
];

const SETTLEMENT_OPTIONS = ['Pending', 'In Progress', 'Completed', 'On Hold'];

const statusConfig: Record<ExitStatus, { label: string; cls: string; icon: any }> = {
  submitted:    { label: 'Submitted',    cls: 'bg-blue-100 text-blue-700',   icon: Clock },
  under_review: { label: 'Under Review', cls: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  approved:     { label: 'Approved',     cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected:     { label: 'Rejected',     cls: 'bg-red-100 text-red-700',     icon: XCircle },
  completed:    { label: 'Completed',    cls: 'bg-gray-100 text-gray-600',   icon: CheckCircle2 },
};

export default function ExitRequests() {
  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editStates, setEditStates] = useState<Record<string, {
    hrNote: string;
    actualLWD: string;
    settlementStatus: string;
    newStatus: ExitStatus;
  }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onValue(ref(database, 'hr/exitRequests'), snap => {
      if (!snap.exists()) { setRequests([]); return; }
      const data = snap.val();
      const list: ExitRequest[] = Object.entries(data)
        .map(([id, v]: any) => ({ ...v, id }))
        .sort((a: any, b: any) => b.createdAt - a.createdAt);
      setRequests(list);
      // Init edit state for each
      const states: typeof editStates = {};
      list.forEach(r => {
        states[r.id] = {
          hrNote: r.hrNote || '',
          actualLWD: r.actualLastWorkingDate || '',
          settlementStatus: r.settlementStatus || '',
          newStatus: r.status,
        };
      });
      setEditStates(states);
    });
    return () => unsub();
  }, []);

  const handleSave = async (id: string) => {
    const state = editStates[id];
    const req = requests.find(r => r.id === id);
    if (!state || !req) return;
    setSaving(id);
    try {
      await update(ref(database, `hr/exitRequests/${id}`), {
        status: state.newStatus,
        hrNote: state.hrNote.trim(),
        actualLastWorkingDate: state.actualLWD,
        settlementStatus: state.settlementStatus,
        updatedAt: Date.now(),
      });
      toast.success('Exit request updated');
      // Notify employee if status changed
      if (state.newStatus !== req.status) {
        const statusLabels: Record<string, string> = {
          under_review: 'is now under review',
          approved: 'has been approved',
          rejected: 'has been rejected',
          completed: 'has been marked as completed',
        };
        await sendNotification(
          req.employeeId,
          'Exit Request Update',
          `Your exit request ${statusLabels[state.newStatus] || 'was updated'}.${state.actualLWD ? ` Last working date: ${state.actualLWD}.` : ''}${state.hrNote ? ` HR note: ${state.hrNote}` : ''}`,
          'exit',
        );
      }
      setExpandedId(null);
    } catch {
      toast.error('Failed to update');
    } finally {
      setSaving(null);
    }
  };

  const updateEditState = (id: string, key: string, value: string) => {
    setEditStates(prev => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  };

  const filtered = requests.filter(r => {
    const matchesSearch = !search ||
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.reason.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const activeCount = requests.filter(r => r.status === 'submitted' || r.status === 'under_review').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Exit Requests</h1>
          <p className="text-sm text-muted-foreground">Manage employee resignations and exit processes</p>
        </div>
        {activeCount > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">
            {activeCount} Active
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by employee or reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              <LogOut className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No exit requests found</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(req => {
            const cfg = statusConfig[req.status];
            const Icon = cfg.icon;
            const isExpanded = expandedId === req.id;
            const edit = editStates[req.id];

            return (
              <Card key={req.id} className={req.status === 'submitted' ? 'border-amber-200' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">{req.employeeName}</span>
                        <span className="text-xs text-muted-foreground">({req.employeeId})</span>
                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </div>
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
                        <p className="text-xs text-muted-foreground">Settlement: {req.settlementStatus}</p>
                      )}
                      {req.hrNote && !isExpanded && (
                        <p className="text-xs italic text-muted-foreground mt-1">Note: {req.hrNote}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    >
                      {isExpanded ? 'Close' : 'Manage'}
                    </Button>
                  </div>

                  {isExpanded && edit && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Status</Label>
                          <Select
                            value={edit.newStatus}
                            onValueChange={v => updateEditState(req.id, 'newStatus', v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(s => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Confirmed Last Working Date</Label>
                          <Input
                            type="date"
                            className="h-9"
                            value={edit.actualLWD}
                            onChange={e => updateEditState(req.id, 'actualLWD', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Settlement Status</Label>
                          <Select
                            value={edit.settlementStatus}
                            onValueChange={v => updateEditState(req.id, 'settlementStatus', v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {SETTLEMENT_OPTIONS.map(o => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">HR Note</Label>
                        <Textarea
                          rows={2}
                          className="text-sm"
                          value={edit.hrNote}
                          onChange={e => updateEditState(req.id, 'hrNote', e.target.value)}
                          placeholder="Add notes for the employee..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={saving === req.id}
                          onClick={() => handleSave(req.id)}
                        >
                          {saving === req.id ? 'Saving...' : 'Save Changes'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setExpandedId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
