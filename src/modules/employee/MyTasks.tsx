import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, onValue, update } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ClipboardList, CheckCircle2, Clock, Loader2, X, AlertCircle } from 'lucide-react';

type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  assignedBy: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: number;
  updatedAt?: number;
}

const priorityConfig: Record<TaskPriority, { label: string; cls: string }> = {
  low:    { label: 'Low',    cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  medium: { label: 'Medium', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  high:   { label: 'High',   cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700 border-red-200' },
};

const statusConfig: Record<TaskStatus, { label: string; cls: string; icon: any }> = {
  pending:    { label: 'Pending',     cls: 'bg-gray-100 text-gray-600',   icon: Clock },
  in_progress:{ label: 'In Progress', cls: 'bg-blue-100 text-blue-700',   icon: Loader2 },
  done:       { label: 'Done',        cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled',   cls: 'bg-red-100 text-red-600',     icon: X },
};

const EMPLOYEE_UPDATABLE: TaskStatus[] = ['pending', 'in_progress', 'done'];

export default function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const empKey = user?.firebaseKey || user?.employeeId || '';

  useEffect(() => {
    if (!empKey) return;
    const unsub = onValue(ref(database, 'tasks'), snap => {
      if (!snap.exists()) { setTasks([]); return; }
      const list: Task[] = Object.entries(snap.val())
        .map(([id, v]: any) => ({ ...v, id }))
        .filter((t: any) => t.assignedTo === empKey || t.assignedTo === user?.employeeId)
        .sort((a: any, b: any) => {
          // Sort by priority then by due date
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
    setUpdatingId(id);
    try {
      await update(ref(database, `tasks/${id}`), { status: newStatus, updatedAt: Date.now() });
      toast.success(`Task marked as ${statusConfig[newStatus].label}`);
    } catch {
      toast.error('Failed to update task status');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = tasks.filter(t => {
    if (filter === 'active') return t.status === 'pending' || t.status === 'in_progress';
    if (filter === 'done') return t.status === 'done';
    return true;
  });

  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled' && t.dueDate < today);
  const dueTodayTasks = tasks.filter(t => t.status !== 'done' && t.dueDate === today);

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">My Tasks</h1>
        <p className="text-sm text-muted-foreground">Tasks assigned to you by HR / Admin</p>
      </div>

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
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: 'pending',    label: 'Pending',     color: 'text-gray-600' },
          { key: 'in_progress',label: 'In Progress', color: 'text-blue-600' },
          { key: 'done',       label: 'Done',        color: 'text-green-600' },
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
            <p className="text-sm">No tasks {filter === 'active' ? 'pending' : filter === 'done' ? 'completed' : 'assigned'} yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => {
            const sCfg = statusConfig[task.status];
            const pCfg = priorityConfig[task.priority];
            const Icon = sCfg.icon;
            const isOverdue = task.status !== 'done' && task.status !== 'cancelled' && task.dueDate < today;

            return (
              <Card key={task.id} className={
                isOverdue ? 'border-red-300' :
                task.dueDate === today ? 'border-amber-300' :
                task.status === 'done' ? 'opacity-70' : ''
              }>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    {/* Priority color bar */}
                    <div className={`w-1 self-stretch rounded-full shrink-0 ${
                      task.priority === 'urgent' ? 'bg-red-500' :
                      task.priority === 'high' ? 'bg-orange-400' :
                      task.priority === 'medium' ? 'bg-blue-400' : 'bg-gray-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`text-sm font-semibold ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${pCfg.cls}`}>
                              {pCfg.label}
                            </span>
                            <span className={`flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.cls}`}>
                              <Icon className="h-3 w-3" />
                              {sCfg.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{task.description}</p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>By: {task.assignedBy}</span>
                        <span className={isOverdue ? 'text-red-600 font-semibold' : task.dueDate === today ? 'text-amber-600 font-semibold' : ''}>
                          {isOverdue ? '⚠ Overdue: ' : 'Due: '}{task.dueDate}
                        </span>
                      </div>

                      {/* Status Update — employee can mark in_progress or done */}
                      {task.status !== 'done' && task.status !== 'cancelled' && (
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
