import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, push, set, onValue, update } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TicketCheck, Plus, Clock, CheckCircle, XCircle, AlertCircle, Megaphone, MessageSquare, Send } from 'lucide-react';
import { notifyAdminFeed } from '@/services/notifications';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type TicketCategory = 'Attendance' | 'Salary' | 'Leave' | 'Documents' | 'IT Support' | 'HR Query' | 'Other';

interface Ticket {
  id: string;
  category: string;
  subject: string;
  description: string;
  status: TicketStatus;
  employeeId: string;
  employeeName: string;
  createdAt: number;
  adminReply?: string;
  resolvedAt?: number;
  // Admin-created ticket fields
  createdByAdmin?: boolean;
  createdByName?: string;
  targetEmployeeId?: string;
  targetEmployeeName?: string;
  isGlobal?: boolean;
  employeeReply?: string;
  employeeRepliedAt?: number;
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
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [adminTickets, setAdminTickets] = useState<Ticket[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<TicketCategory>('HR Query');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Reply state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const empKey = user?.firebaseKey || user?.employeeId || '';

  useEffect(() => {
    if (!empKey) return;
    const unsub = onValue(ref(database, 'hr/tickets'), snap => {
      if (!snap.exists()) {
        setMyTickets([]);
        setAdminTickets([]);
        return;
      }
      const data = snap.val();
      const all: Ticket[] = Object.entries(data)
        .map(([id, v]: any) => ({ ...v, id }));

      // Tickets raised by this employee
      const mine = all
        .filter((t) => !t.createdByAdmin && (t.employeeId === empKey || t.employeeId === user?.employeeId))
        .sort((a, b) => b.createdAt - a.createdAt);

      // Tickets sent by admin to this employee (targeted or global)
      const fromAdmin = all
        .filter((t) => t.createdByAdmin && (t.isGlobal || t.targetEmployeeId === empKey))
        .sort((a, b) => b.createdAt - a.createdAt);

      setMyTickets(mine);
      setAdminTickets(fromAdmin);
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
      await notifyAdminFeed(
        `New Ticket — ${user?.name || 'Employee'}`,
        `[${category}] ${subject.trim()}`,
        'ticket',
      );
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

  const handleReply = async (ticketId: string) => {
    if (!replyText.trim()) { toast.error('Reply cannot be empty'); return; }
    setSendingReply(true);
    try {
      await update(ref(database, `hr/tickets/${ticketId}`), {
        employeeReply: replyText.trim(),
        employeeRepliedAt: Date.now(),
      });
      await notifyAdminFeed(
        `Employee Reply — ${user?.name || 'Employee'}`,
        replyText.trim().slice(0, 80),
        'ticket',
      );
      toast.success('Reply sent to HR/Admin.');
      setReplyingTo(null);
      setReplyText('');
    } catch {
      toast.error('Failed to send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const unreadAdminCount = adminTickets.filter(t => !t.employeeReply && t.status === 'open').length;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Tickets</h1>
          <p className="text-sm text-muted-foreground">Submit issues or view notices from HR / Admin</p>
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

      {/* Notices from Admin/HR */}
      {adminTickets.length > 0 && (
        <Card className="border-purple-200">
          <CardHeader className="pb-3 bg-purple-50/50 rounded-t-lg">
            <CardTitle className="text-sm flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-purple-600" />
              <span className="text-purple-700">Notices from Admin / HR</span>
              {unreadAdminCount > 0 && (
                <Badge className="ml-auto bg-purple-600 text-white text-[10px]">{unreadAdminCount} new</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {adminTickets.map(ticket => {
                const cfg = statusConfig[ticket.status] || statusConfig.open;
                const Icon = cfg.icon;
                const isReplying = replyingTo === ticket.id;
                return (
                  <div key={ticket.id} className="p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{ticket.subject}</span>
                          <Badge variant="outline" className="text-xs border-purple-300 text-purple-600">{ticket.category}</Badge>
                          {ticket.isGlobal && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">Broadcast</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{ticket.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          From: <span className="font-medium text-purple-600">{ticket.createdByName || 'Admin/HR'}</span>
                          {' · '}
                          {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>

                        {/* Employee's existing reply */}
                        {ticket.employeeReply && (
                          <div className="mt-2 p-2 bg-green-50 rounded border border-green-200 text-xs text-green-800">
                            <span className="font-semibold">Your Reply: </span>{ticket.employeeReply}
                            {ticket.employeeRepliedAt && (
                              <span className="ml-2 text-green-600 opacity-70">
                                · {new Date(ticket.employeeRepliedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Admin reply (if any) */}
                        {ticket.adminReply && (
                          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200 text-xs text-blue-800">
                            <span className="font-semibold">HR Reply: </span>{ticket.adminReply}
                          </div>
                        )}

                        {/* Reply form */}
                        {isReplying ? (
                          <div className="mt-3 space-y-2">
                            <Textarea
                              value={replyText}
                              onChange={e => setReplyText(e.target.value)}
                              placeholder="Type your reply..."
                              rows={3}
                              className="text-xs"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="gap-1 h-7 text-xs"
                                onClick={() => handleReply(ticket.id)}
                                disabled={sendingReply || !replyText.trim()}
                              >
                                <Send className="h-3 w-3" />
                                {sendingReply ? 'Sending...' : 'Send Reply'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => { setReplyingTo(null); setReplyText(''); }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs gap-1 border-purple-200 text-purple-600 hover:bg-purple-50"
                            onClick={() => { setReplyingTo(ticket.id); setReplyText(''); }}
                          >
                            <MessageSquare className="h-3 w-3" />
                            {ticket.employeeReply ? 'Update Reply' : 'Reply'}
                          </Button>
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
          </CardContent>
        </Card>
      )}

      {/* My Tickets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TicketCheck className="h-4 w-4 text-primary" />
            My Tickets
            <Badge variant="secondary" className="ml-auto">{myTickets.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {myTickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TicketCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No tickets raised yet</p>
              <Button size="sm" className="mt-3 gap-1" onClick={() => setShowForm(true)}>
                <Plus className="h-3.5 w-3.5" /> Raise your first ticket
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {myTickets.map(ticket => {
                const cfg = statusConfig[ticket.status] || statusConfig.open;
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
