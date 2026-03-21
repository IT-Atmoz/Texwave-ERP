import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, push, set, onValue, update } from 'firebase/database';
import { sendNotification } from '@/services/notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ClipboardList, Plus, Search, CheckCircle2, Clock, AlertCircle, Loader2, Download, X } from 'lucide-react';
import * as XLSX from 'xlsx';

type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  assignedBy: string;
  createdBy?: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  notes?: string;
  isEmployeeCreated?: boolean;
  requestToAdmin?: boolean;
  createdAt: number;
  updatedAt?: number;
  adminApproved?: boolean;
  approvedAt?: number;
}

interface Employee {
  id: string;
  firebaseKey: string;
  name: string;
  department?: string;
  employeeId?: string;
}

const priorityConfig: Record<TaskPriority, { label: string; cls: string }> = {
  low:    { label: 'Low',    cls: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Medium', cls: 'bg-blue-100 text-blue-700' },
  high:   { label: 'High',   cls: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700' },
};

const statusConfig: Record<TaskStatus, { label: string; cls: string; icon: any }> = {
  pending:    { label: 'Pending',     cls: 'bg-gray-100 text-gray-600',   icon: Clock },
  in_progress:{ label: 'In Progress', cls: 'bg-blue-100 text-blue-700',   icon: Loader2 },
  done:       { label: 'Done',        cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled',   cls: 'bg-red-100 text-red-600',     icon: X },
};

export default function TaskAssignment() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: '',
    priority: 'medium' as TaskPriority,
  });

  useEffect(() => {
    // Load tasks
    const unsubTasks = onValue(ref(database, 'tasks'), snap => {
      if (!snap.exists()) { setTasks([]); return; }
      const list: Task[] = Object.entries(snap.val())
        .map(([id, v]: any) => ({ ...v, id }))
        .sort((a: any, b: any) => b.createdAt - a.createdAt);
      setTasks(list);
    });

    // Load employees for assignment dropdown
    const unsubEmps = onValue(ref(database, 'hr/employees'), snap => {
      if (!snap.exists()) { setEmployees([]); return; }
      const list: Employee[] = Object.entries(snap.val())
        .map(([key, v]: any) => ({ ...v, firebaseKey: key, id: key }))
        .filter((e: any) => e.name)
        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      setEmployees(list);
    });

    return () => { unsubTasks(); unsubEmps(); };
  }, []);

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.assignedTo) { toast.error('Please select an employee'); return; }
    if (!form.dueDate) { toast.error('Please set a due date'); return; }

    const emp = employees.find(e => e.firebaseKey === form.assignedTo);
    setSubmitting(true);
    try {
      const newRef = push(ref(database, 'tasks'));
      await set(newRef, {
        title: form.title.trim(),
        description: form.description.trim(),
        assignedTo: form.assignedTo,
        assignedToName: emp?.name || '',
        assignedBy: user?.name || 'Admin',
        dueDate: form.dueDate,
        priority: form.priority,
        status: 'pending',
        createdAt: Date.now(),
      });

      // Notify employee
      await sendNotification(
        form.assignedTo,
        `New Task Assigned: ${form.title.trim()}`,
        `Assigned by ${user?.name || 'Admin'}. Due: ${form.dueDate}. Priority: ${form.priority}.`,
        'task',
      );

      toast.success('Task created and employee notified');
      setForm({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium' });
      setShowForm(false);
    } catch {
      toast.error('Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const updateTaskStatus = async (id: string, newStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === id);
    setUpdatingId(id);
    try {
      await update(ref(database, `tasks/${id}`), { status: newStatus, updatedAt: Date.now() });
      toast.success('Task updated');
      // Notify employee when admin completes or changes status on their task
      if (task && task.assignedTo) {
        if (newStatus === 'done') {
          await sendNotification(
            task.assignedTo,
            `Task Completed — "${task.title}"`,
            `${user?.name || 'Admin'} has marked your task as done.`,
            'task',
          );
        } else if (newStatus === 'in_progress') {
          await sendNotification(
            task.assignedTo,
            `Task In Progress — "${task.title}"`,
            `${user?.name || 'Admin'} is working on your task.`,
            'task',
          );
        }
      }
    } catch {
      toast.error('Failed to update');
    } finally {
      setUpdatingId(null);
    }
  };

  const approveTask = async (task: Task) => {
    setUpdatingId(task.id);
    try {
      await update(ref(database, `tasks/${task.id}`), {
        adminApproved: true,
        approvedAt: Date.now(),
      });
      await sendNotification(
        task.assignedTo,
        `Task Approved ✓ — "${task.title}"`,
        `Your completed task has been approved by ${user?.name || 'Admin'}.`,
        'task',
      );
      toast.success('Task completion approved');
    } catch {
      toast.error('Failed to approve');
    } finally {
      setUpdatingId(null);
    }
  };

  const reopenTask = async (task: Task) => {
    setUpdatingId(task.id);
    try {
      await update(ref(database, `tasks/${task.id}`), {
        status: 'in_progress',
        adminApproved: false,
        updatedAt: Date.now(),
      });
      await sendNotification(
        task.assignedTo,
        `Task Reopened — "${task.title}"`,
        `${user?.name || 'Admin'} has reopened your task. Please review and resubmit.`,
        'task',
      );
      toast.success('Task reopened and employee notified');
    } catch {
      toast.error('Failed to reopen');
    } finally {
      setUpdatingId(null);
    }
  };

  const downloadExcel = () => {
    const rows = tasks.map(t => ({
      'Title': t.title,
      'Description': t.description,
      'Assigned To': t.assignedToName,
      'Assigned By': t.assignedBy,
      'Due Date': t.dueDate,
      'Priority': t.priority.charAt(0).toUpperCase() + t.priority.slice(1),
      'Status': statusConfig[t.status]?.label || t.status,
      'Created On': new Date(t.createdAt).toLocaleDateString('en-IN'),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String((r as any)[k] ?? '').length)) + 2,
    }));
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, `tasks_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel downloaded');
  };

  // Split: admin-assigned vs employee-created requests
  const employeeRequests = tasks.filter(t => t.requestToAdmin);
  const adminTasks = tasks.filter(t => !t.requestToAdmin);

  const applyFilters = (list: Task[]) => list.filter(t => {
    const matchSearch = !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.assignedToName.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'all' ? true :
      filterStatus === 'awaiting' ? (t.status === 'done' && !t.adminApproved) :
      t.status === filterStatus;
    const matchEmp = filterEmployee === 'all' || t.assignedTo === filterEmployee;
    return matchSearch && matchStatus && matchEmp;
  });

  const filtered = applyFilters(adminTasks);
  const filteredRequests = applyFilters(employeeRequests);

  const counts = {
    pending:    tasks.filter(t => t.status === 'pending').length,
    in_progress:tasks.filter(t => t.status === 'in_progress').length,
    done:       tasks.filter(t => t.status === 'done').length,
    awaiting:   tasks.filter(t => t.status === 'done' && !t.adminApproved).length,
    requests:   employeeRequests.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Task Assignment</h1>
          <p className="text-sm text-muted-foreground">Create and assign tasks to employees</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadExcel} className="gap-2">
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <Button onClick={() => setShowForm(v => !v)} className="gap-2">
            <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'New Task'}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([
          { key: 'pending',     label: 'Pending',     color: 'text-gray-600' },
          { key: 'in_progress', label: 'In Progress', color: 'text-blue-600' },
          { key: 'done',        label: 'Completed',   color: 'text-green-600' },
        ] as const).map(({ key, label, color }) => (
          <Card key={key} className="p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}>
            <p className={`text-2xl font-bold ${color}`}>{counts[key]}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </Card>
        ))}
        <Card
          className={`p-4 text-center cursor-pointer hover:border-amber-400 transition-colors ${counts.awaiting > 0 ? 'border-amber-300 bg-amber-50' : ''}`}
          onClick={() => setFilterStatus(filterStatus === 'awaiting' ? 'all' : 'awaiting')}
        >
          <p className={`text-2xl font-bold ${counts.awaiting > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{counts.awaiting}</p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting Approval</p>
        </Card>
        <Card className={`p-4 text-center cursor-pointer hover:border-purple-400 transition-colors ${counts.requests > 0 ? 'border-purple-300 bg-purple-50' : ''}`}>
          <p className={`text-2xl font-bold ${counts.requests > 0 ? 'text-purple-600' : 'text-gray-400'}`}>{counts.requests}</p>
          <p className="text-xs text-muted-foreground mt-1">Employee Requests</p>
        </Card>
      </div>

      {/* Create Task Form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              New Task
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Task Title *</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Brief task title"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assign To *</Label>
                <Select value={form.assignedTo} onValueChange={v => setForm(p => ({ ...p, assignedTo: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.firebaseKey} value={emp.firebaseKey}>
                        {emp.name} {emp.department ? `· ${emp.department}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v as TaskPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(priorityConfig) as TaskPriority[]).map(p => (
                      <SelectItem key={p} value={p}>{priorityConfig[p].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Describe what needs to be done..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? 'Creating...' : 'Assign Task'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {(Object.keys(statusConfig) as TaskStatus[]).map(s => (
              <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
            ))}
            <SelectItem value="awaiting">Awaiting Approval</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map(emp => (
              <SelectItem key={emp.firebaseKey} value={emp.firebaseKey}>{emp.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Employee Requests Section */}
      {filteredRequests.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wide">
              Employee Task Requests
            </h2>
            <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {filteredRequests.length}
            </span>
          </div>
          {filteredRequests.map(task => {
            const sCfg = statusConfig[task.status];
            const pCfg = priorityConfig[task.priority];
            const Icon = sCfg.icon;
            const isOverdue = task.status !== 'done' && task.status !== 'cancelled' && task.dueDate < new Date().toISOString().split('T')[0];
            const awaitingApproval = task.status === 'done' && !task.adminApproved;
            return (
              <Card key={task.id} className="border-purple-200 bg-purple-50/30">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{task.title}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pCfg.cls}`}>{pCfg.label}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                          Employee Request
                        </span>
                        {isOverdue && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Overdue</span>}
                        {awaitingApproval && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 animate-pulse">Awaiting Approval</span>}
                        {task.adminApproved && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">✓ Approved</span>}
                      </div>
                      {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span>Requested by: <strong>{task.assignedToName}</strong></span>
                        <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>Due: {task.dueDate}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.cls}`}>
                        <Icon className="h-3 w-3" />{sCfg.label}
                      </span>
                      {awaitingApproval ? (
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700" disabled={updatingId === task.id} onClick={() => approveTask(task)}>
                            <CheckCircle2 className="h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={updatingId === task.id} onClick={() => reopenTask(task)}>
                            Reopen
                          </Button>
                        </div>
                      ) : !task.adminApproved ? (
                        <Select value={task.status} onValueChange={v => updateTaskStatus(task.id, v as TaskStatus)} disabled={updatingId === task.id}>
                          <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(statusConfig) as TaskStatus[]).map(s => (
                              <SelectItem key={s} value={s} className="text-xs">{statusConfig[s].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Admin-Assigned Task List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No tasks found</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(task => {
            const sCfg = statusConfig[task.status];
            const pCfg = priorityConfig[task.priority];
            const Icon = sCfg.icon;
            const isOverdue = task.status !== 'done' && task.status !== 'cancelled' && task.dueDate < new Date().toISOString().split('T')[0];

            const awaitingApproval = task.status === 'done' && !task.adminApproved;

            return (
              <Card key={task.id} className={
                awaitingApproval ? 'border-amber-400 bg-amber-50/30' :
                task.adminApproved && task.status === 'done' ? 'border-green-300' :
                isOverdue ? 'border-red-200' : ''
              }>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{task.title}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pCfg.cls}`}>{pCfg.label}</span>
                        {isOverdue && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Overdue</span>}
                        {awaitingApproval && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 animate-pulse">
                            Awaiting Approval
                          </span>
                        )}
                        {task.adminApproved && task.status === 'done' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                            ✓ Approved
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        <span>→ <strong>{task.assignedToName}</strong></span>
                        <span>By: {task.assignedBy}</span>
                        <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>Due: {task.dueDate}</span>
                        {task.approvedAt && (
                          <span className="text-green-600">Approved: {new Date(task.approvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.cls}`}>
                        <Icon className="h-3 w-3" />
                        {sCfg.label}
                      </span>

                      {/* Approval actions for done tasks */}
                      {awaitingApproval ? (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
                            disabled={updatingId === task.id}
                            onClick={() => approveTask(task)}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={updatingId === task.id}
                            onClick={() => reopenTask(task)}
                          >
                            Reopen
                          </Button>
                        </div>
                      ) : (
                        /* Quick status update for non-done tasks */
                        !task.adminApproved && (
                          <Select
                            value={task.status}
                            onValueChange={v => updateTaskStatus(task.id, v as TaskStatus)}
                            disabled={updatingId === task.id}
                          >
                            <SelectTrigger className="h-7 text-xs w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(statusConfig) as TaskStatus[]).map(s => (
                                <SelectItem key={s} value={s} className="text-xs">{statusConfig[s].label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
