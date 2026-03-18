import { useEffect, useState } from 'react';
import { database } from '@/services/firebase';
import { ref, onValue, update } from 'firebase/database';
import { sendNotification } from '@/services/notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { TicketCheck, Clock, CheckCircle, XCircle, AlertCircle, MessageSquare } from 'lucide-react';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

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
}

const statusConfig: Record<TicketStatus, { label: string; cls: string; icon: any }> = {
  open:        { label: 'Open',        cls: 'bg-blue-100 text-blue-700',   icon: Clock },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  resolved:    { label: 'Resolved',    cls: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed:      { label: 'Closed',      cls: 'bg-gray-100 text-gray-600',   icon: XCircle },
};

export default function AdminTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onValue(ref(database, 'hr/tickets'), snap => {
      if (!snap.exists()) { setTickets([]); return; }
      const list: Ticket[] = Object.entries(snap.val())
        .map(([id, v]: any) => ({ ...v, id }))
        .sort((a: any, b: any) => b.createdAt - a.createdAt);
      setTickets(list);
    });
    return () => unsub();
  }, []);

  const handleUpdate = async (id: string, status: TicketStatus) => {
    const ticket = tickets.find(t => t.id === id);
    setUpdating(id);
    try {
      const updates: any = { status };
      const reply = replyText[id]?.trim();
      if (reply) updates.adminReply = reply;
      if (status === 'resolved' || status === 'closed') updates.resolvedAt = Date.now();
      await update(ref(database, `hr/tickets/${id}`), updates);
      setReplyText(prev => { const n = { ...prev }; delete n[id]; return n; });
      toast({ title: 'Ticket updated' });
      // Notify employee
      if (ticket) {
        await sendNotification(
          ticket.employeeId,
          `Ticket ${status === 'resolved' ? 'Resolved' : 'Updated'}: ${ticket.subject}`,
          reply ? `HR replied: ${reply}` : `Your ticket status changed to ${status.replace('_', ' ')}.`,
          'ticket',
        );
      }
    } catch {
      toast({ title: 'Failed to update ticket', variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  const open = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  const closed = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TicketCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Employee Tickets</h1>
          <p className="text-sm text-muted-foreground">
            {open.length} open · {closed.length} resolved
          </p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <TicketCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No tickets raised yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Open / In Progress */}
          {open.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active Tickets</h2>
              {open.map(ticket => {
                const cfg = statusConfig[ticket.status];
                const Icon = cfg.icon;
                return (
                  <Card key={ticket.id} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{ticket.subject}</span>
                            <Badge variant="outline" className="text-xs">{ticket.category}</Badge>
                            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>
                              <Icon className="h-3 w-3" />{cfg.label}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            By <span className="font-medium">{ticket.employeeName}</span> ({ticket.employeeId}) ·{' '}
                            {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground bg-muted/40 rounded p-2">{ticket.description}</p>
                      {ticket.adminReply && (
                        <div className="p-2 bg-green-50 rounded border border-green-200 text-xs text-green-800">
                          <span className="font-semibold">Previous reply: </span>{ticket.adminReply}
                        </div>
                      )}
                      <div className="flex gap-2 items-start">
                        <Textarea
                          placeholder="Type your reply (optional)..."
                          value={replyText[ticket.id] || ''}
                          onChange={e => setReplyText(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                          rows={2}
                          className="text-sm flex-1"
                        />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Select
                          value={ticket.status}
                          onValueChange={(v) => handleUpdate(ticket.id, v as TicketStatus)}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={updating === ticket.id || !replyText[ticket.id]?.trim()}
                          onClick={() => handleUpdate(ticket.id, ticket.status)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {updating === ticket.id ? 'Saving...' : 'Send Reply'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Closed */}
          {closed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Resolved Tickets</h2>
              {closed.map(ticket => {
                const cfg = statusConfig[ticket.status];
                const Icon = cfg.icon;
                return (
                  <Card key={ticket.id} className="opacity-70">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{ticket.subject}</span>
                            <Badge variant="outline" className="text-xs">{ticket.category}</Badge>
                            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>
                              <Icon className="h-3 w-3" />{cfg.label}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {ticket.employeeName} · {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </div>
                          {ticket.adminReply && (
                            <p className="text-xs text-green-700 mt-1">
                              <span className="font-semibold">Reply: </span>{ticket.adminReply}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => handleUpdate(ticket.id, 'open')}
                        >
                          Reopen
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
