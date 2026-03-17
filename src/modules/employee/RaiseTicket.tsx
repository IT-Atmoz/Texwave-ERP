import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, push, set, onValue } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TicketCheck, Plus, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type TicketCategory = 'Attendance' | 'Salary' | 'Leave' | 'Documents' | 'IT Support' | 'HR Query' | 'Other';

interface Ticket {
  id: string;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  employeeId: string;
  employeeName: string;
  createdAt: number;
  adminReply?: string;
  resolvedAt?: number;
}

const CATEGORIES: TicketCategory[] = ['Attendance', 'Salary', 'Leave', 'Documents', 'IT Support', 'HR Query', 'Other'];

const statusConfig: Record<TicketStatus, { label: string; cls: string; icon: any }> = {
  open:        { label: 'Open',        cls: 'bg-blue-100 text-blue-700',   icon: Clock },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  resolved:    { label: 'Resolved',    cls: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed:      { label: 'Closed',      cls: 'bg-gray-100 text-gray-600',   icon: XCircle },
};

export default function RaiseTicket() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<TicketCategory>('HR Query');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const empKey = user?.firebaseKey || user?.employeeId || '';

  useEffect(() => {
    if (!empKey) return;
    const unsub = onValue(ref(database, 'hr/tickets'), snap => {
      if (!snap.exists()) { setTickets([]); return; }
      const data = snap.val();
      const list: Ticket[] = Object.entries(data)
        .map(([id, v]: any) => ({ ...v, id }))
        .filter((t: any) => t.employeeId === empKey || t.employeeId === user?.employeeId)
        .sort((a: any, b: any) => b.createdAt - a.createdAt);
      setTickets(list);
    });
    return () => unsub();
  }, [empKey, user?.employeeId]);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast.error('Please fill in subject and description');
      return;
    }
    setSubmitting(true);
    try {
      const newRef = push(ref(database, 'hr/tickets'));
      await set(newRef, {
        category,
        subject: subject.trim(),
        description: description.trim(),
        status: 'open',
        employeeId: empKey,
        employeeName: user?.name || '',
        createdAt: Date.now(),
      });
      toast.success('Ticket raised successfully! HR will respond shortly.');
      setSubject('');
      setDescription('');
      setCategory('HR Query');
      setShowForm(false);
    } catch {
      toast.error('Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Raise a Ticket</h1>
          <p className="text-sm text-muted-foreground">Submit issues or requests to HR / Admin</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="gap-2">
          <Plus className="h-4 w-4" />
          {showForm ? 'Cancel' : 'New Ticket'}
        </Button>
      </div>

      {/* New Ticket Form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TicketCheck className="h-4 w-4 text-primary" />
              New Support Ticket
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={v => setCategory(v as TicketCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief subject of the issue" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe your issue or request in detail..."
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting || !subject.trim() || !description.trim()}>
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tickets list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TicketCheck className="h-4 w-4 text-primary" />
            My Tickets
            <Badge variant="secondary" className="ml-auto">{tickets.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TicketCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No tickets raised yet</p>
              <Button size="sm" className="mt-3 gap-1" onClick={() => setShowForm(true)}>
                <Plus className="h-3.5 w-3.5" /> Raise your first ticket
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tickets.map(ticket => {
                const cfg = statusConfig[ticket.status];
                const Icon = cfg.icon;
                return (
                  <div key={ticket.id} className="p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{ticket.subject}</span>
                          <Badge variant="outline" className="text-xs">{ticket.category}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        {ticket.adminReply && (
                          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200 text-xs text-blue-800">
                            <span className="font-semibold">HR Reply: </span>{ticket.adminReply}
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
