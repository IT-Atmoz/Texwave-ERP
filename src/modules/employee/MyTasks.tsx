import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, onValue, update, push, set } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ClipboardList, CheckCircle2, Clock, Loader2, X, AlertCircle, Plus } from 'lucide-react';
import { notifyAdminFeed } from '@/services/notifications';

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
  isEmployeeCreated?: boolean;
  requestToAdmin?: boolean;
  createdAt: number;
  updatedAt?: number;
  adminApproved?: boolean;
  approvedAt?: number;
}

const priorityConfig: Record<TaskPriority, { label: string; cls: string }> = {
  low:     { label: 'Low',    cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  medium:  { label: 'Medium', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  high:    { label: 'High',   cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  urgent:  { label: 'Urgent', cls: 'bg-red-100 text-red-700 border-red-200' },
};

const statusConfig: Record<TaskStatus, { label: string; cls: string; icon: any }> = {
  pending:     { label: 'Pending',     cls: 'bg-gray-100 text-gray-600',   icon: Clock },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700',   icon: Loader2 },
  done:        { label: 'Done',        cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-100 text-red-600',     icon: X },
};

const emptyForm = () => ({
  title: '',
  description: '',
  priority: 'medium' as TaskPriority,
  dueDate: '',
  requestToAdmin: false,
});

export default function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  const empKey = user?.firebaseKey || user?.employeeId || '';

  useEffect(() => {
    if (!empKey) return;
    const unsub = onValue(ref(database, 'tasks'), snap => {
      if (!snap.exists()) { setTasks([]); return; }
      const list: Task[] = Object.entries(snap.val())
        .map(([id, v]: any) => ({ ...v, id }))
        .filter((t: any) =>
          t.assignedTo === empKey ||
          t.assignedTo === user?.employeeId ||
          t.createdBy === empKey ||
          t.createdBy === user?.employeeId
        )
        .sort((a: any, b: any) => {
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          const pDiff = (priorityOrder[a.priority as TaskPriority] ?? 2) - (priorityOrder[b.priority as TaskPriority] ?? 2);
          if (pDiff !== 0) return pDiff;
          return (a.dueDate || '').localeCompare(b.dueDate || '');
        });
      setTasks(list);
    });
    return () => unsub();
  }, [empKey, user?.employeeId]);

  const updateStatus = async (id: string, newStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === id);
    setUpdatingId(id);
    try {
      await update(ref(database, `tasks/${id}`), { status: newStatus, updatedAt: Date.now() });
      toast.success(`Task marked as ${statusConfig[newStatus].label}`);
      if (task) {
        if (newStatus === 'done') {
          await notifyAdminFeed(
            `Task Completed — ${user?.name || 'Employee'}`,
            `"${task.title}" has been marked as done. Please review and approve.`,
            'task',
          );
        } else if (newStatus === 'in_progress') {
          await notifyAdminFeed(
            `Task Started — ${user?.name || 'Employee'}`,
            `"${task.title}" is now in progress.`,
            'task',
          );
        }
      }
    } catch {
      toast.error('Failed to update task status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.dueDate) { toast.error('Please set a due date'); return; }
    setSubmitting(true);
    try {
      const newRef = push(ref(database, 'tasks'));
      await set(newRef, {
        title: form.title.trim(),
        description: form.description.trim(),
        assignedTo: empKey,
        assignedToName: user?.name || '',
        assignedBy: user?.name || 'Employee',
        createdBy: empKey,
        dueDate: form.dueDate,
        priority: form.priority,
        status: 'pending',
        isEmployeeCreated: true,
        requestToAdmin: form.requestToAdmin,
        createdAt: Date.now(),
      });

      if (form.requestToAdmin) {
        await notifyAdminFeed(
          `Task Request — ${user?.name || 'Employee'}`,
          `"${form.title.trim()}" — Needs admin attention. Due: ${form.dueDate}.`,
          'task',
        );
      }

      toast.success(form.requestToAdmin ? 'Task sent to Admin/HR for review' : 'Task created successfully');
      setForm(emptyForm());
      setShowForm(false);
    } catch {
      toast.error('Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = tasks.filter(t => {
    if (filter === 'active') return t.status === 'pending' || t.status === 'in_progress';
    if (filter === 'done') return t.status === 'done';
    return true;
  });

  const today = new Date().toISOString().split('T')[0];
  const overdueTasks  = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled' && t.dueDate < today);
  const dueTodayTasks = tasks.filter(t => t.status !== 'done' && t.dueDate === today);

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">My Tasks</h1>
          <p className="text-sm text-muted-foreground">Tasks assigned to you and tasks you created</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="gap-2">
          <Plus className="h-4 w-4" />
          {showForm ? 'Cancel' : 'New Task'}
        </Button>
      </div>

      {/* Create Task Form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Create New Task
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
                  min={today}
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
            {/* Request to Admin toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <input
                type="checkbox"
                id="requestToAdmin"
                checked={form.requestToAdmin}
                onChange={e => setForm(p => ({ ...p, requestToAdmin: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
              <label htmlFor="requestToAdmin" className="text-sm cursor-pointer">
                <span className="font-medium">Request Admin/HR attention</span>
                <span className="text-xs text-muted-foreground block">Admin will be notified and can take action on this task</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={submitting || !form.title.trim() || !form.dueDate}>
                {submitting ? 'Creating...' : form.requestToAdmin ? 'Send to Admin' : 'Create Task'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {overdueTasks.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span><strong>{overdueTasks.length}</strong> overdue task{overdueTasks.length > 1 ? 's' : ''}. Please update or complete them.</span>
        </div>
      )}
      {dueTodayTasks.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Clock className="h-4 w-4 shrink-0" />
          <span><strong>{dueTodayTasks.length}</strong> task{dueTodayTasks.length > 1 ? 's are' : ' is'} due today.</span>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'pending',     label: 'Pending',     color: 'text-gray-600' },
          { key: 'in_progress', label: 'In Progress', color: 'text-blue-600' },
          { key: 'done',        label: 'Done',        color: 'text-green-600' },
        ] as const).map(({ key, label, color }) => (
          <Card
            key={key}
            className="p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => setFilter(filter === key ? 'all' : key)}
          >
            <p className={`text-2xl font-bold ${color}`}>{tasks.filter(t => t.status === key).length}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </Card>
        ))}
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{tasks.filter(t => t.adminApproved).length}</p>
          <p className="text-xs text-muted-foreground mt-1">Admin Approved</p>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { value: 'active', label: 'Active' },
          { value: 'done',   label: 'Completed' },
          { value: 'all',    label: 'All' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Task Cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No tasks {filter === 'active' ? 'active' : filter === 'done' ? 'completed' : 'found'}</p>
            <Button size="sm" className="mt-3 gap-1" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" /> Create your first task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => {
            const sCfg = statusConfig[task.status];
            const pCfg = priorityConfig[task.priority];
            const Icon = sCfg.icon;
            const isOverdue = task.status !== 'done' && task.status !== 'cancelled' && task.dueDate < today;
            const awaitingApproval = task.status === 'done' && !task.adminApproved;
            const isMine = task.createdBy === empKey || task.createdBy === user?.employeeId;
            const isAssigned = task.assignedTo === empKey || task.assignedTo === user?.employeeId;

            return (
              <Card key={task.id} className={
                task.adminApproved ? 'border-green-300 bg-green-50/20' :
                awaitingApproval ? 'border-amber-300' :
                isOverdue ? 'border-red-300' :
                task.dueDate === today ? 'border-amber-200' : ''
              }>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    {/* Priority color bar */}
                    <div className={`w-1 self-stretch rounded-full shrink-0 ${
                      task.priority === 'urgent' ? 'bg-red-500' :
                      task.priority === 'high'   ? 'bg-orange-400' :
                      task.priority === 'medium' ? 'bg-blue-400' : 'bg-gray-300'
                    }`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${pCfg.cls}`}>
                              {pCfg.label}
                            </span>
                            <span className={`flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.cls}`}>
                              <Icon className="h-3 w-3" />{sCfg.label}
                            </span>
                            {isMine && !isAssigned && (
                              <Badge variant="outline" className="text-[10px] px-1.5">Created by you</Badge>
                            )}
                            {task.requestToAdmin && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                Admin requested
                              </span>
                            )}
                            {awaitingApproval && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                Awaiting admin approval
                              </span>
                            )}
                            {task.adminApproved && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                                ✓ Approved by Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{task.description}</p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        {task.assignedBy && <span>By: {task.assignedBy}</span>}
                        <span className={isOverdue ? 'text-red-600 font-semibold' : task.dueDate === today ? 'text-amber-600 font-semibold' : ''}>
                          {isOverdue ? '⚠ Overdue: ' : 'Due: '}{task.dueDate}
                        </span>
                        {task.approvedAt && (
                          <span className="text-green-600">
                            Approved: {new Date(task.approvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>

                      {/* Action buttons for active tasks */}
                      {task.status !== 'done' && task.status !== 'cancelled' && !task.adminApproved && (
                        <div className="flex gap-2 mt-3">
                          {task.status === 'pending' && (
                            <button
                              disabled={updatingId === task.id}
                              onClick={() => updateStatus(task.id, 'in_progress')}
                              className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium transition-colors disabled:opacity-50"
                            >
                              Start Working
                            </button>
                          )}
                          {(task.status === 'in_progress' || task.status === 'pending') && (
                            <button
                              disabled={updatingId === task.id}
                              onClick={() => updateStatus(task.id, 'done')}
                              className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors disabled:opacity-50"
                            >
                              Mark as Done
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
