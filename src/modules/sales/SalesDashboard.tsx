'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  FileText,
  Receipt,
  IndianRupee,
  Clock,
  Users,
  FileMinus,
  Wallet,
  Plus,
  Trash2,
  ListTodo,
  ArrowRight,
} from 'lucide-react';
import { database } from '@/services/firebase';
import { ref, onValue, set } from 'firebase/database';
import { Link } from 'react-router-dom';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  dueDate?: string;
}

export default function SalesDashboard() {
  const [stats, setStats] = useState({
    totalEstimates: 0,
    estimatesThisMonth: 0,
    pendingEstimates: 0,
    totalSalesOrders: 0,
    confirmedOrders: 0,
    totalInvoices: 0,
    invoicesThisMonth: 0,
    outstandingAmount: 0,
    revenueThisMonth: 0,
    totalCustomers: 0,
    creditNotesCount: 0,
    paymentsReceived: 0,
    conversionRate: 0,
    topCustomers: [] as { name: string; amount: number }[],
    recentUnpaidInvoices: [] as any[],
  });

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState('');

  // Load TODOs
  useEffect(() => {
    const todoRef = ref(database, 'todos/sales');
    const unsub = onValue(todoRef, (snap) => {
      const data = snap.val();
      if (data) {
        setTodos((Object.values(data) as TodoItem[]).sort((a, b) => b.createdAt - a.createdAt));
      } else {
        setTodos([]);
      }
    });
    return () => unsub();
  }, []);

  const saveTodos = (updated: TodoItem[]) => {
    const obj: Record<string, TodoItem> = {};
    updated.forEach((t) => { obj[t.id] = t; });
    set(ref(database, 'todos/sales'), obj);
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;
    const todo: TodoItem = { id: `todo-${Date.now()}`, text: newTodo.trim(), completed: false, createdAt: Date.now(), dueDate: newTodoDueDate || undefined };
    const updated = [todo, ...todos];
    setTodos(updated);
    saveTodos(updated);
    setNewTodo('');
    setNewTodoDueDate('');
  };

  const toggleTodo = (id: string) => {
    const updated = todos.map((t) => t.id === id ? { ...t, completed: !t.completed } : t);
    setTodos(updated);
    saveTodos(updated);
  };

  const deleteTodo = (id: string) => {
    const updated = todos.filter((t) => t.id !== id);
    setTodos(updated);
    saveTodos(updated);
  };

  // Load sales data
  useEffect(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const qRef = ref(database, 'sales/quotations');
    const oaRef = ref(database, 'sales/orderAcknowledgements');
    const invRef = ref(database, 'sales/invoices');
    const custRef = ref(database, 'sales/customers');
    const cnRef = ref(database, 'sales/creditNotes');
    const prRef = ref(database, 'sales/paymentsReceived');

    const unsubQ = onValue(qRef, (snap) => {
      const arr = Object.values(snap.val() || {}) as any[];
      const thisMonth = arr.filter((q) => {
        const d = new Date(q.quoteDate || 0);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      const pending = arr.filter((q) => ['Draft', 'Sent'].includes(q.status));
      const accepted = arr.filter((q) => ['Accepted', 'Approved'].includes(q.status)).length;
      setStats((p) => ({
        ...p,
        totalEstimates: arr.length,
        estimatesThisMonth: thisMonth.length,
        pendingEstimates: pending.length,
        conversionRate: arr.length > 0 ? (accepted / arr.length) * 100 : 0,
      }));
    });

    const unsubOA = onValue(oaRef, (snap) => {
      const orders = Object.values(snap.val() || {}) as any[];
      const confirmed = orders.filter((o) => !['Draft', 'Cancelled'].includes(o.status));
      setStats((p) => ({ ...p, totalSalesOrders: orders.length, confirmedOrders: confirmed.length }));
    });

    const unsubInv = onValue(invRef, (snap) => {
      const arr = Object.values(snap.val() || {}) as any[];
      const thisMonth = arr.filter((i) => {
        const d = new Date(i.invoiceDate || 0);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      const revenueThisMonth = thisMonth.reduce((s, i) => s + (i.grandTotal || 0), 0);
      const unpaid = arr.filter((i) => ['Unpaid', 'Partial', 'Draft', 'Final'].includes(i.paymentStatus));
      const outstanding = unpaid.reduce((s, i) => s + Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0)), 0);

      const customerMap = new Map<string, number>();
      arr.forEach((i) => {
        const cur = customerMap.get(i.customerName) || 0;
        customerMap.set(i.customerName, cur + (i.grandTotal || 0));
      });
      const topCustomers = Array.from(customerMap.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const recentUnpaid = unpaid
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 5);

      setStats((p) => ({
        ...p,
        totalInvoices: arr.length,
        invoicesThisMonth: thisMonth.length,
        revenueThisMonth,
        outstandingAmount: outstanding,
        topCustomers,
        recentUnpaidInvoices: recentUnpaid,
      }));
    });

    const unsubCust = onValue(custRef, (snap) => {
      setStats((p) => ({ ...p, totalCustomers: snap.val() ? Object.keys(snap.val()).length : 0 }));
    });

    const unsubCN = onValue(cnRef, (snap) => {
      setStats((p) => ({ ...p, creditNotesCount: snap.val() ? Object.keys(snap.val()).length : 0 }));
    });

    const unsubPR = onValue(prRef, (snap) => {
      const arr = Object.values(snap.val() || {}) as any[];
      const total = arr.reduce((s, p) => s + (p.amount || 0), 0);
      setStats((p) => ({ ...p, paymentsReceived: total }));
    });

    return () => { unsubQ(); unsubOA(); unsubInv(); unsubCust(); unsubCN(); unsubPR(); };
  }, []);

  const kpiCards = [
    { title: 'Estimates', value: stats.totalEstimates, sub: `${stats.estimatesThisMonth} this month`, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', link: '/sales/quotations' },
    { title: 'Sales Orders', value: stats.totalSalesOrders, sub: `${stats.confirmedOrders} confirmed`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', link: '/sales/orders' },
    { title: 'Invoices', value: stats.totalInvoices, sub: `${stats.invoicesThisMonth} this month`, icon: Receipt, color: 'text-purple-600', bg: 'bg-purple-50', link: '/sales/invoices' },
    { title: 'Outstanding', value: `₹${stats.outstandingAmount.toLocaleString('en-IN')}`, sub: 'Pending collections', icon: IndianRupee, color: 'text-orange-600', bg: 'bg-orange-50', link: '/sales/invoices' },
    { title: 'Revenue This Month', value: `₹${stats.revenueThisMonth.toLocaleString('en-IN')}`, sub: 'Invoiced amount', icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50', link: '/sales/invoices' },
    { title: 'Customers', value: stats.totalCustomers, sub: 'Total customers', icon: Users, color: 'text-cyan-600', bg: 'bg-cyan-50', link: '/sales/customers' },
    { title: 'Credit Notes', value: stats.creditNotesCount, sub: 'Issued', icon: FileMinus, color: 'text-red-500', bg: 'bg-red-50', link: '/sales/credit-notes' },
    { title: 'Payments Received', value: `₹${stats.paymentsReceived.toLocaleString('en-IN')}`, sub: 'Total collected', icon: Wallet, color: 'text-teal-600', bg: 'bg-teal-50', link: '/sales/payments-received' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Sales Overview</h2>
        <p className="text-muted-foreground text-sm mt-1">Real-time metrics across the entire sales pipeline</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link to={card.link} key={card.title}>
              <Card className="hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
                  <div className={`p-1.5 rounded-lg ${card.bg}`}>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-foreground">{card.value}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Pipeline summary bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {[
              { label: 'Pending Estimates', value: stats.pendingEstimates, color: 'bg-yellow-100 text-yellow-800' },
              { label: 'Conversion Rate', value: `${stats.conversionRate.toFixed(1)}%`, color: 'bg-blue-100 text-blue-800' },
              { label: 'Open Orders', value: stats.totalSalesOrders - stats.confirmedOrders, color: 'bg-purple-100 text-purple-800' },
              { label: 'Unpaid Invoices', value: stats.recentUnpaidInvoices.length, color: 'bg-orange-100 text-orange-800' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1 flex-1 min-w-[100px]">
                <span className={`text-2xl font-bold px-3 py-1 rounded-lg ${item.color}`}>{item.value}</span>
                <span className="text-xs text-muted-foreground text-center">{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Top Customers
              </CardTitle>
              <Link to="/sales/customers" className="text-xs text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats.topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No invoice data yet</p>
            ) : (
              <div className="space-y-3">
                {stats.topCustomers.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                    </div>
                    <span className="text-sm font-mono font-bold text-primary">
                      ₹{c.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Unpaid Invoices */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Unpaid Invoices
              </CardTitle>
              <Link to="/sales/invoices" className="text-xs text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentUnpaidInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">All invoices paid</p>
            ) : (
              <div className="space-y-2">
                {stats.recentUnpaidInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{inv.customerName}</p>
                      <p className="text-xs text-muted-foreground">{inv.invoiceNumber}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                        ₹{((inv.grandTotal || 0) - (inv.paidAmount || 0)).toLocaleString('en-IN')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* TODO List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-primary" />
              To-Do
            </CardTitle>
            <span className="text-xs text-muted-foreground">{todos.filter((t) => !t.completed).length} pending</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Add task..."
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                className="flex-1 h-8 text-sm"
              />
              <Input
                type="date"
                value={newTodoDueDate}
                onChange={(e) => setNewTodoDueDate(e.target.value)}
                className="w-32 h-8 text-sm"
              />
              <Button onClick={addTodo} size="icon" className="h-8 w-8">
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {todos.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">No tasks yet</p>
              ) : (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${todo.completed ? 'bg-green-50 border-green-200' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <Checkbox checked={todo.completed} onCheckedChange={() => toggleTodo(todo.id)} />
                    <div className={`flex-1 min-w-0 ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                      <span className="truncate block">{todo.text}</span>
                      {todo.dueDate && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          todo.completed ? 'bg-green-100 text-green-700'
                            : new Date(todo.dueDate) < new Date(new Date().toISOString().split('T')[0])
                              ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {new Date(todo.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteTodo(todo.id)} className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="h-3 w-3" />
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
