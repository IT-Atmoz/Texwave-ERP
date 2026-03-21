import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, onValue, update, push, set } from 'firebase/database';
import { sendNotification } from '@/services/notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { TicketCheck, Clock, CheckCircle, XCircle, AlertCircle, MessageSquare, Plus, Search, Users } from 'lucide-react';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type TicketCategory = 'Attendance' | 'Salary' | 'Leave' | 'Documents' | 'IT Support' | 'HR Query' | 'Notice' | 'Warning' | 'Other';

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
  employeeReply?: string;
  employeeRepliedAt?: number;
  isGlobal?: boolean; // broadcast to all employees
}

interface Employee {
  firebaseKey: string;
  name: string;
  department?: string;
  employeeId?: string;
}

const ADMIN_CATEGORIES: TicketCategory[] = ['Attendance', 'Salary', 'Leave', 'Documents', 'IT Support', 'HR Query', 'Notice', 'Warning', 'Other'];

const statusConfig: Record<TicketStatus, { label: string; cls: string; icon: any }> = {
  open:        { label: 'Open',        cls: 'bg-blue-100 text-blue-700',   icon: Clock },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  resolved:    { label: 'Resolved',    cls: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed:      { label: 'Closed',      cls: 'bg-gray-100 text-gray-600',   icon: XCircle },
};

export default function AdminTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    subject: '',
    description: '',
    category: 'Notice' as TicketCategory,
    targetEmployeeId: '',
    isGlobal: false,
  });

  // Load all tickets
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

  // Load employees for targeting
  useEffect(() => {
    const unsub = onValue(ref(database, 'hr/employees'), snap => {
      if (!snap.exists()) { setEmployees([]); return; }
      const list: Employee[] = Object.entries(snap.val())
        .map(([key, v]: any) => ({ ...v, firebaseKey: key }))
        .filter((e: any) => e.name)
        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      setEmployees(list);
    });
    return () => unsub();
  }, []);

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error('Subject and description are required');
      return;
    }
    if (!form.isGlobal && !form.targetEmployeeId) {
      toast.error('Select an employee or enable "Send to All"');
      return;
    }

    setSubmitting(true);
    try {
      const targetEmp = employees.find(e => e.firebaseKey === form.targetEmployeeId);

      if (form.isGlobal) {
        // Create one ticket per employee (broadcast)
        for (const emp of employees) {
          const newRef = push(ref(database, 'hr/tickets'));
          await set(newRef, {
            category: form.category,
            subject: form.subject.trim(),
            description: form.description.trim(),
            status: 'open',
            employeeId: emp.firebaseKey,
            employeeName: emp.name,
            createdAt: Date.now(),
            createdByAdmin: true,
            createdByName: user?.name || 'Admin',
            targetEmployeeId: emp.firebaseKey,
            targetEmployeeName: emp.name,
            isGlobal: true,
          });
          await sendNotification(
            emp.firebaseKey,
            `Notice from Admin: ${form.subject.trim()}`,
            form.description.trim().slice(0, 120),
            'ticket',
          );
        }
        toast.success(`Notice sent to all ${employees.length} employees`);
      } else {
        // Single employee
        const newRef = push(ref(database, 'hr/tickets'));
        await set(newRef, {
          category: form.category,
          subject: form.subject.trim(),
          description: form.description.trim(),
          status: 'open',
          employeeId: form.targetEmployeeId,
          employeeName: targetEmp?.name || '',
          createdAt: Date.now(),
          createdByAdmin: true,
          createdByName: user?.name || 'Admin',
          targetEmployeeId: form.targetEmployeeId,
          targetEmployeeName: targetEmp?.name || '',
        });
        await sendNotification(
          form.targetEmployeeId,
          `New Ticket from Admin: ${form.subject.trim()}`,
          form.description.trim().slice(0, 120),
          'ticket',
        );
        toast.success(`Ticket sent to ${targetEmp?.name}`);
      }

      setForm({ subject: '', description: '', category: 'Notice', targetEmployeeId: '', isGlobal: false });
      setShowForm(false);
    } catch {
      toast.error('Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

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
      toast.success('Ticket updated');
      if (ticket) {
        await sendNotification(
          ticket.employeeId,
          `Ticket ${status === 'resolved' ? 'Resolved' : 'Updated'}: ${ticket.subject}`,
          reply ? `HR replied: ${reply}` : `Status changed to ${status.replace('_', ' ')}.`,
          'ticket',
        );
      }
    } catch {
      toast.error('Failed to update ticket');
    } finally {
      setUpdating(null);
    }
  };

  // Split: employee-raised vs admin-created
  const employeeRaised = tickets.filter(t => !t.createdByAdmin);
  const adminCreated   = tickets.filter(t => t.createdByAdmin);

  const applySearch = (list: Ticket[]) =>
    list.filter(t =>
      !search ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase())
    );

  const empOpen   = applySearch(employeeRaised.filter(t => t.status === 'open' || t.status === 'in_progress'));
  const empClosed = applySearch(employeeRaised.filter(t => t.status === 'resolved' || t.status === 'closed'));
  const adminOpen = applySearch(adminCreated.filter(t => t.status === 'open' || t.status === 'in_progress'));
  const adminClosed = applySearch(adminCreated.filter(t => t.status === 'resolved' || t.status === 'closed'));

  const renderTicketCard = (ticket: Ticket, isAdminCreated = false) => {
    const cfg = statusConfig[ticket.status];
    const Icon = cfg.icon;
    const isActive = ticket.status === 'open' || ticket.status === 'in_progress';

    return (
      <Card key={ticket.id} className={`${isActive ? (isAdminCreated ? 'border-l-4 border-l-purple-500' : 'border-l-4 border-l-blue-500') : 'opacity-75'}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{ticket.subject}</span>
                <Badge variant="outline" className="text-xs">{ticket.category}</Badge>
                <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>
                  <Icon className="h-3 w-3" />{cfg.label}
                </span>
                {isAdminCreated && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    Admin → Employee
                  </span>
                )}
                {ticket.isGlobal && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                    <Users className="h-2.5 w-2.5" /> All Employees
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {isAdminCreated
                  ? <>By <span className="font-medium">{ticket.createdByName}</span> → To <span className="font-medium">{ticket.targetEmployeeName}</span></>
                  : <>By <span className="font-medium">{ticket.employeeName}</span> ({ticket.employeeId})</>
                }
                {' · '}{new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground bg-muted/40 rounded p-2">{ticket.description}</p>

          {/* Employee reply (if admin-created ticket) */}
          {isAdminCreated && ticket.employeeReply && (
            <div className="p-2 bg-blue-50 rounded border border-blue-200 text-xs text-blue-800">
              <span className="font-semibold">Employee Reply: </span>{ticket.employeeReply}
              {ticket.employeeRepliedAt && (
                <span className="ml-2 text-blue-500">
                  · {new Date(ticket.employeeRepliedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>
          )}

          {ticket.adminReply && (
            <div className="p-2 bg-green-50 rounded border border-green-200 text-xs text-green-800">
              <span className="font-semibold">Your reply: </span>{ticket.adminReply}
            </div>
          )}

          {isActive && (
            <>
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
                <Select value={ticket.status} onValueChange={v => handleUpdate(ticket.id, v as TicketStatus)}>
                  <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
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
            </>
          )}

          {!isActive && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleUpdate(ticket.id, 'open')}>
                Reopen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <TicketCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Tickets</h1>
            <p className="text-sm text-muted-foreground">
              {employeeRaised.filter(t => t.status === 'open' || t.status === 'in_progress').length} employee open ·{' '}
              {adminCreated.filter(t => t.status === 'open' || t.status === 'in_progress').length} admin sent
            </p>
          </div>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="gap-2">
          <Plus className="h-4 w-4" />
          {showForm ? 'Cancel' : 'Create Ticket'}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{employeeRaised.filter(t => t.status === 'open').length}</p>
          <p className="text-xs text-muted-foreground mt-1">Employee Open</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{employeeRaised.filter(t => t.status === 'in_progress').length}</p>
          <p className="text-xs text-muted-foreground mt-1">In Progress</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{adminCreated.filter(t => t.status === 'open' || t.status === 'in_progress').length}</p>
          <p className="text-xs text-muted-foreground mt-1">Admin Sent (Active)</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}</p>
          <p className="text-xs text-muted-foreground mt-1">Resolved / Closed</p>
        </Card>
      </div>

      {/* Create Ticket Form */}
      {showForm && (
        <Card className="border-purple-200 bg-purple-50/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TicketCheck className="h-4 w-4 text-purple-600" />
              Create Ticket for Employee
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v as TicketCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ADMIN_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target Employee</Label>
                <Select
                  value={form.isGlobal ? 'all' : form.targetEmployeeId}
                  onValueChange={v => {
                    if (v === 'all') setForm(p => ({ ...p, isGlobal: true, targetEmployeeId: '' }));
                    else setForm(p => ({ ...p, isGlobal: false, targetEmployeeId: v }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select employee..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> All Employees (Broadcast)</span>
                    </SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.firebaseKey} value={emp.firebaseKey}>
                        {emp.name}{emp.department ? ` · ${emp.department}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Subject *</Label>
                <Input
                  value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="Brief subject of the ticket"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description / Message *</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Write your message or notice to the employee..."
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={submitting} className="bg-purple-600 hover:bg-purple-700">
                {submitting ? 'Sending...' : form.isGlobal ? `Send to All (${employees.length})` : 'Send Ticket'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Admin-Created Tickets Section */}
      {(adminOpen.length > 0 || adminClosed.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wide flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-500 inline-block" />
            Tickets Sent by Admin / HR
            <Badge className="bg-purple-100 text-purple-700 font-bold ml-1">{adminOpen.length} active</Badge>
          </h2>
          {adminOpen.map(t => renderTicketCard(t, true))}
          {adminClosed.length > 0 && (
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none py-1">
                Show {adminClosed.length} resolved admin tickets
              </summary>
              <div className="space-y-2 mt-2">
                {adminClosed.map(t => renderTicketCard(t, true))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Employee-Raised Tickets Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
          Tickets Raised by Employees
          <Badge className="bg-blue-100 text-blue-700 font-bold ml-1">{empOpen.length} active</Badge>
        </h2>

        {empOpen.length === 0 && empClosed.length === 0 ? (
          <Card>
            <CardContent className="pt-10 pb-10 text-center">
              <TicketCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">No employee tickets yet</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {empOpen.map(t => renderTicketCard(t, false))}
            {empClosed.length > 0 && (
              <details className="group">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none py-1">
                  Show {empClosed.length} resolved employee tickets
                </summary>
                <div className="space-y-2 mt-2">
                  {empClosed.map(t => renderTicketCard(t, false))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
