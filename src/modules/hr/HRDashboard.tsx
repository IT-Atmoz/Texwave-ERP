import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  AlertCircle,
  Plus,
  Trash2,
  ListTodo,
  CalendarCheck,
  IndianRupee,
  UserPlus,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { getAllRecords } from '@/services/firebase';
import { database } from '@/services/firebase';
import { ref, onValue, set } from 'firebase/database';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { LiveClock } from '@/components/layout/LiveClock';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  dueDate?: string;
}

interface Employee {
  id: string;
  status?: string;
  department?: string;
}

interface AttendanceEntry {
  status?: string;
  otHrs?: number;
  workHrs?: number;
  pendingHrs?: number;
}

interface Loan {
  status?: string;
}

interface Bonus {
  status?: string;
}

interface AttendanceApproval {
  status?: 'pending' | 'accepted' | 'rejected';
}

interface PayrollCreditedMonth {
  [empId: string]: boolean;
}

const DONUT_COLORS = ['#22c55e', '#ef4444', '#f59e0b'];

export default function HRDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    presentToday: 0,
    pendingApprovals: 0,
    pendingPayroll: 0,
    leaveToday: 0,
    absentToday: 0,
  });

  const [userName, setUserName] = useState('HR Manager');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');

  useEffect(() => {
    try {
      const userData = localStorage.getItem('erp_user');
      if (userData) {
        const user = JSON.parse(userData);
        if (user?.name) setUserName(user.name);
      }
    } catch {}

    fetchDashboardData();
  }, []);

  // Load TODOs from Firebase
  useEffect(() => {
    const todoRef = ref(database, 'todos/hr');
    const unsubscribe = onValue(todoRef, (snap) => {
      const data = snap.val();
      if (data) {
        const todoList = Object.values(data) as TodoItem[];
        setTodos(todoList.sort((a, b) => b.createdAt - a.createdAt));
      } else {
        setTodos([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Save TODOs to Firebase
  const saveTodos = (updatedTodos: TodoItem[]) => {
    const todoRef = ref(database, 'todos/hr');
    const todoObj: Record<string, TodoItem> = {};
    updatedTodos.forEach(todo => {
      todoObj[todo.id] = todo;
    });
    set(todoRef, todoObj);
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;
    const todo: TodoItem = {
      id: `todo-${Date.now()}`,
      text: newTodo.trim(),
      completed: false,
      createdAt: Date.now(),
      dueDate: newTodoDueDate || undefined,
    };
    const updated = [todo, ...todos];
    setTodos(updated);
    saveTodos(updated);
    setNewTodo('');
    setNewTodoDueDate('');
  };

  const toggleTodo = (id: string) => {
    const updated = todos.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    setTodos(updated);
    saveTodos(updated);
  };

  const deleteTodo = (id: string) => {
    const updated = todos.filter(t => t.id !== id);
    setTodos(updated);
    saveTodos(updated);
  };

  const fetchDashboardData = async () => {
    try {
      // hr/employees is an object keyed by firebase employee id
      const employeesData = await getAllRecords('hr/employees');
      const employees: Employee[] = employeesData
        ? Object.values(employeesData)
        : [];

      const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

      // Attendance for today: hr/attendance/<date> or {}
      const todayAttendanceData = await getAllRecords(
        `hr/attendance/${today}`,
      );
      const todayAttendance: AttendanceEntry[] = todayAttendanceData
        ? Object.values(todayAttendanceData)
        : [];

      // Optional: loans and bonuses for "pending approvals"
      const loansData = await getAllRecords('hr/loans');
      const loans: Loan[] = loansData
        ? Object.values(loansData)
        : [];

      const bonusesData = await getAllRecords('hr/bonuses');
      const bonuses: Bonus[] = bonusesData
        ? Object.values(bonusesData)
        : [];

      // Attendance approvals for "pending approvals"
      const attendanceApprovalsData =
        await getAllRecords('hr/attendanceApprovals');
      const attendanceApprovals: AttendanceApproval[] =
        attendanceApprovalsData
          ? Object.values(attendanceApprovalsData).flatMap(
              (empMap: any) => Object.values(empMap),
            )
          : [];

      // Payroll credited for current month to estimate "pending payroll"
      const currentMonth = today.slice(0, 7); // "YYYY-MM"
      const payrollCreditedData = await getAllRecords(
        `hr/payrollCredited/${currentMonth}`,
      );
      const payrollCredited: PayrollCreditedMonth =
        payrollCreditedData || {};

      const totalEmployees = employees.length;
      const activeEmployees = employees.filter(
        (e) => (e.status || '').toLowerCase() === 'active',
      ).length;

      const presentToday = todayAttendance.filter(
        (a) => a.status === 'Present' || a.status === 'Half Day',
      ).length;
      const leaveToday = todayAttendance.filter(
        (a) => a.status === 'Leave',
      ).length;
      const absentToday = todayAttendance.filter(
        (a) => a.status === 'Absent',
      ).length;
      // Pending approvals: pending loans + pending bonuses + pending attendance approvals
      const pendingLoanApprovals = loans.filter(
        (l) => l.status === 'Pending',
      ).length;
      const pendingBonusApprovals = bonuses.filter(
        (b) => b.status === 'Pending',
      ).length;
      const pendingAttendanceApprovals = attendanceApprovals.filter(
        (aa) => aa.status === 'pending',
      ).length;

      const pendingApprovals =
        pendingLoanApprovals +
        pendingBonusApprovals +
        pendingAttendanceApprovals;

      // Pending payroll: active employees that are not yet credited this month
      const creditedEmpIds = new Set(Object.keys(payrollCredited));
      const pendingPayroll = employees.filter(
        (e: any) =>
          (e.status || '').toLowerCase() === 'active' &&
          !creditedEmpIds.has(e.id),
      ).length;

      setStats({
        totalEmployees,
        activeEmployees,
        presentToday,
        pendingApprovals,
        pendingPayroll,
        leaveToday,
        absentToday,
      });
    } catch (error) {
      console.error('Error fetching HR dashboard:', error);
    }
  };

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateStr = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const donutData = [
    { name: 'Present', value: stats.presentToday },
    { name: 'Absent', value: stats.absentToday },
    { name: 'On Leave', value: stats.leaveToday },
  ].filter(d => d.value > 0);

  const quickActions = [
    {
      icon: UserPlus,
      label: 'Add Employee',
      path: '/hr/employees/new',
      color: 'bg-primary/10 text-primary hover:bg-primary/20',
    },
    {
      icon: CalendarCheck,
      label: 'Mark Attendance',
      path: '/hr/attendance',
      color: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    },
    {
      icon: UserCheck,
      label: 'Approve Leaves',
      path: '/hr/approval-attendance',
      color: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
    },
    {
      icon: IndianRupee,
      label: 'Run Payroll',
      path: '/hr/payroll',
      color: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Row 1: Greeting Banner + LiveClock */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-border px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}, {userName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dateStr}</p>
        </div>
        <LiveClock />
      </div>

      {/* Row 2: 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Employees</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{stats.totalEmployees}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Active</p>
                <p className="text-3xl font-bold mt-1 text-primary">{stats.activeEmployees}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Present Today</p>
                <p className="text-3xl font-bold mt-1 text-primary">{stats.presentToday}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarCheck className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Approvals</p>
                <p className="text-3xl font-bold mt-1 text-destructive">{stats.pendingApprovals}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Attendance Donut + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut Chart — spans 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Attendance Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              {/* Donut with center overlay */}
              <div className="relative h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData.length > 0 ? donutData : [{ name: 'No Data', value: 1 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {donutData.length > 0
                        ? donutData.map((_, i) => (
                            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))
                        : <Cell fill="#e5e7eb" />
                      }
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [`${v} employees`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Centered text overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-foreground">{stats.presentToday}</span>
                  <span className="text-xs text-muted-foreground">/ {stats.totalEmployees}</span>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-3">
                {[
                  { label: 'Present', count: stats.presentToday, color: DONUT_COLORS[0] },
                  { label: 'Absent', count: stats.absentToday, color: DONUT_COLORS[1] },
                  { label: 'On Leave', count: stats.leaveToday, color: DONUT_COLORS[2] },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-muted-foreground w-16">{item.label}</span>
                    <span className="text-sm font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions — 1 column */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {quickActions.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl p-4 transition-colors cursor-pointer ${action.color}`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: HR TODO full-width */}
      <div>
        {/* HR TODO List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ListTodo className="h-4 w-4 text-primary" />
              HR TODO List
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {todos.filter(t => !t.completed).length} pending
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Add new TODO */}
            <div className="flex gap-2">
              <Input
                placeholder="Add a new task..."
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                className="flex-1"
              />
              <Input
                type="date"
                value={newTodoDueDate}
                onChange={(e) => setNewTodoDueDate(e.target.value)}
                className="w-36"
              />
              <Button onClick={addTodo} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* TODO Items */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {todos.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  No tasks yet. Add one above!
                </p>
              ) : (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                      todo.completed
                        ? 'bg-muted/50 border-border'
                        : 'bg-background hover:bg-muted/30 border-border'
                    }`}
                  >
                    <Checkbox
                      checked={todo.completed}
                      onCheckedChange={() => toggleTodo(todo.id)}
                    />
                    <div className={`flex-1 min-w-0 ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                      <span className="text-sm truncate block">{todo.text}</span>
                      {todo.dueDate && (
                        <span className={`text-xs ${
                          todo.completed
                            ? 'text-muted-foreground'
                            : new Date(todo.dueDate) < new Date(new Date().toISOString().split('T')[0])
                              ? 'text-destructive'
                              : 'text-primary'
                        }`}>
                          {new Date(todo.dueDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteTodo(todo.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

