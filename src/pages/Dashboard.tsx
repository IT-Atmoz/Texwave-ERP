'use client';

import { useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  IndianRupee,
  FileText,
  TrendingUp,
  UserCheck,
  ArrowUpCircle,
  ArrowDownCircle,
  Landmark,
  Receipt,
  TicketCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { database } from '@/services/firebase';
import { ref, onValue } from 'firebase/database';
import { getAllRecords } from '@/services/firebase';

export default function Dashboard() {
  const navigate = useNavigate();
  const ticketActivityRef = useRef<any[]>([]);
  const expenseActivityRef = useRef<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Financial KPIs
  const [totalReceivables, setTotalReceivables] = useState(0);
  const [totalPayables, setTotalPayables] = useState(0);
  const [cashAndBank, setCashAndBank] = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);

  // HR snapshot
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);
  const [pendingExpenseRequests, setPendingExpenseRequests] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // Lists
  const [topUnpaidInvoices, setTopUnpaidInvoices] = useState<any[]>([]);
  const [topUnpaidBills, setTopUnpaidBills] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);

  // Chart data (last 6 months)
  const [monthlyChart, setMonthlyChart] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);

  const mergeActivity = () => {
    const combined = [...ticketActivityRef.current, ...expenseActivityRef.current]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);
    setRecentActivity(combined);
  };

  useEffect(() => {
    loadFinancials();

    const today = new Date().toISOString().split('T')[0];
    const employeesRef = ref(database, 'hr/employees');
    const attendanceRef = ref(database, `hr/attendance/${today}`);
    const leavesRef = ref(database, 'hr/leaves');

    const unsubEmployees = onValue(employeesRef, (snapshot) => {
      setTotalEmployees(snapshot.val() ? Object.keys(snapshot.val()).length : 0);
    });
    const unsubAttendance = onValue(attendanceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const present = (Object.values(data) as any[]).filter((a) => a.status === 'Present').length;
        setPresentToday(present);
      } else {
        setPresentToday(0);
      }
    });
    const unsubLeaves = onValue(leavesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const pending = (Object.values(data) as any[]).filter((l) => l.status === 'Pending').length;
        setPendingLeaves(pending);
      } else {
        setPendingLeaves(0);
      }
    });

    // Tickets listener
    const ticketsRef = ref(database, 'hr/tickets');
    const unsubTickets = onValue(ticketsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tickets = Object.values(data) as any[];
        setOpenTickets(tickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length);
        ticketActivityRef.current = tickets.map((t: any) => ({
          type: 'ticket',
          name: t.employeeName,
          detail: `[${t.category}] ${t.subject}`,
          status: t.status,
          createdAt: t.createdAt,
        }));
        mergeActivity();
      } else {
        setOpenTickets(0);
        ticketActivityRef.current = [];
        mergeActivity();
      }
    });

    // Expense requests listener
    const expReqRef = ref(database, 'hr/expenseRequests');
    const unsubExpReq = onValue(expReqRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const expReqs = Object.values(data) as any[];
        setPendingExpenseRequests(expReqs.filter((e: any) => e.status === 'pending').length);
        expenseActivityRef.current = expReqs.map((e: any) => ({
          type: 'expense',
          name: e.employeeName,
          detail: `${e.expenseType} — ₹${(e.amount || 0).toLocaleString('en-IN')}`,
          status: e.status,
          createdAt: e.createdAt,
        }));
        mergeActivity();
      } else {
        setPendingExpenseRequests(0);
        expenseActivityRef.current = [];
        mergeActivity();
      }
    });

    return () => {
      unsubEmployees();
      unsubAttendance();
      unsubLeaves();
      unsubTickets();
      unsubExpReq();
    };
  }, []);

  const loadFinancials = async () => {
    setIsLoading(true);
    try {
      const [invoices, bills, bankAccounts, expenses] = await Promise.all([
        getAllRecords('sales/invoices'),
        getAllRecords('purchases/bills'),
        getAllRecords('banking/accounts'),
        getAllRecords('expenses/records'),
      ]);

      // Receivables: unpaid invoices
      const unpaidInvoices = invoices.filter((inv: any) =>
        ['Unpaid', 'Partial', 'Draft', 'Final'].includes(inv.paymentStatus)
      );
      const receivables = unpaidInvoices.reduce(
        (s: number, inv: any) => s + Math.max(0, (inv.grandTotal || 0) - (inv.paidAmount || 0)),
        0
      );
      setTotalReceivables(receivables);
      setTopUnpaidInvoices(
        unpaidInvoices
          .sort((a: any, b: any) => (b.grandTotal || 0) - (a.grandTotal || 0))
          .slice(0, 5)
      );

      // Payables: unpaid bills
      const unpaidBills = bills.filter((b: any) => b.paymentStatus !== 'Paid');
      const payables = unpaidBills.reduce(
        (s: number, b: any) => s + Math.max(0, (b.total || 0) - (b.paidAmount || 0)),
        0
      );
      setTotalPayables(payables);
      setTopUnpaidBills(
        unpaidBills
          .sort((a: any, b: any) => (b.total || 0) - (a.total || 0))
          .slice(0, 5)
      );

      // Cash & Bank
      const cashBank = bankAccounts.reduce((s: number, acc: any) => s + (acc.currentBalance || 0), 0);
      setCashAndBank(cashBank);

      // Revenue this month
      const now = new Date();
      const monthRevenue = invoices
        .filter((inv: any) => {
          if (!inv.invoiceDate) return false;
          const d = new Date(inv.invoiceDate);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((s: number, inv: any) => s + (inv.grandTotal || 0), 0);
      setRevenueThisMonth(monthRevenue);

      // Recent expenses
      setRecentExpenses(
        [...expenses].sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5)
      );

      // Build last 6 months chart
      const months: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        const m = d.getMonth();
        const y = d.getFullYear();

        const income = invoices
          .filter((inv: any) => {
            if (!inv.invoiceDate) return false;
            const dd = new Date(inv.invoiceDate);
            return dd.getMonth() === m && dd.getFullYear() === y;
          })
          .reduce((s: number, inv: any) => s + (inv.grandTotal || 0), 0);

        const billsAmt = bills
          .filter((b: any) => {
            if (!b.billDate) return false;
            const dd = new Date(b.billDate);
            return dd.getMonth() === m && dd.getFullYear() === y;
          })
          .reduce((s: number, b: any) => s + (b.total || 0), 0);

        const expAmt = expenses
          .filter((e: any) => {
            if (!e.date) return false;
            const dd = new Date(e.date);
            return dd.getMonth() === m && dd.getFullYear() === y;
          })
          .reduce((s: number, e: any) => s + (e.amount || 0), 0);

        months.push({ name: label, Income: income, Expenses: billsAmt + expAmt });
      }
      setMonthlyChart(months);

      setPieData([
        { name: 'Receivables', value: receivables },
        { name: 'Payables', value: payables },
        { name: 'Cash & Bank', value: cashBank },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const PIE_COLORS = ['#3d9e1a', '#ef4444', '#22c55e'];

  const kpiCards = [
    {
      title: 'Total Receivables',
      value: `₹${totalReceivables.toLocaleString('en-IN')}`,
      icon: ArrowUpCircle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      border: 'border-l-amber-500',
      sub: 'Unpaid invoices',
    },
    {
      title: 'Total Payables',
      value: `₹${totalPayables.toLocaleString('en-IN')}`,
      icon: ArrowDownCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      border: 'border-l-red-500',
      sub: 'Unpaid bills',
    },
    {
      title: 'Cash & Bank',
      value: `₹${cashAndBank.toLocaleString('en-IN')}`,
      icon: Landmark,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      border: 'border-l-green-500',
      sub: 'Bank account balances',
    },
    {
      title: 'Revenue This Month',
      value: `₹${revenueThisMonth.toLocaleString('en-IN')}`,
      icon: IndianRupee,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      border: 'border-l-primary',
      sub: 'Net invoiced amount',
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Financial overview — Receivables, Payables, Banking & HR</p>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-10 rounded-lg" />
                  </CardHeader>
                  <CardContent><Skeleton className="h-9 w-28" /></CardContent>
                </Card>
              ))
            : kpiCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <Card key={i} className={`hover:shadow-lg transition-all border-l-4 ${card.border}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                      <div className={`p-2 rounded-lg ${card.bgColor}`}>
                        <Icon className={`h-5 w-5 ${card.color}`} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-foreground">{card.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                    </CardContent>
                  </Card>
                );
              })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart: Income vs Expenses */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Income vs Expenses (Last 6 Months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(val: number) => `₹${val.toLocaleString('en-IN')}`} />
                    <Legend />
                    <Bar dataKey="Income" fill="#3d9e1a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart: Receivables vs Payables vs Cash */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                Financial Position
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <div>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData.filter((d) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => `₹${val.toLocaleString('en-IN')}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1 mt-2">
                    {pieData.map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                          <span className="text-muted-foreground">{d.name}</span>
                        </div>
                        <span className="font-mono font-medium">₹{(d.value || 0).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Unpaid Invoices */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-amber-500" />
                Top Unpaid Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : topUnpaidInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">All invoices paid</p>
              ) : (
                <div className="space-y-2">
                  {topUnpaidInvoices.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                      <div>
                        <p className="text-sm font-medium">{inv.customerName}</p>
                        <p className="text-xs text-muted-foreground">{inv.invoiceNumber} · Due: {inv.dueDate || '—'}</p>
                      </div>
                      <span className="text-sm font-mono font-bold text-amber-600">
                        ₹{((inv.grandTotal || 0) - (inv.paidAmount || 0)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Unpaid Bills */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4 text-red-500" />
                Top Unpaid Bills
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : topUnpaidBills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">All bills paid</p>
              ) : (
                <div className="space-y-2">
                  {topUnpaidBills.map((bill: any) => (
                    <div key={bill.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                      <div>
                        <p className="text-sm font-medium">{bill.vendorName}</p>
                        <p className="text-xs text-muted-foreground">{bill.billNumber} · Due: {bill.dueDate || '—'}</p>
                      </div>
                      <span className="text-sm font-mono font-bold text-red-600">
                        ₹{((bill.total || 0) - (bill.paidAmount || 0)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Expenses */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowDownCircle className="h-4 w-4 text-orange-500" />
                Recent Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : recentExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No expenses recorded</p>
              ) : (
                <div className="space-y-2">
                  {recentExpenses.map((exp: any) => (
                    <div key={exp.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                      <div>
                        <p className="text-sm font-medium">{exp.category}</p>
                        <p className="text-xs text-muted-foreground">{exp.date} · {exp.vendor || exp.paidThrough}</p>
                      </div>
                      <span className="text-sm font-mono font-bold text-orange-600">
                        ₹{(exp.amount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* HR Snapshot */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-rose-600" />
              HR Snapshot (Today)
            </CardTitle>
            <button onClick={() => navigate('/hr/dashboard')} className="text-xs text-primary hover:underline">Go to HR →</button>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-rose-50 flex flex-col gap-1 items-center text-center">
              <Users className="h-5 w-5 text-rose-400 mb-1" />
              <span className="text-xs text-muted-foreground">Total Employees</span>
              <span className="text-3xl font-bold">{totalEmployees}</span>
            </div>
            <div className="p-4 rounded-lg bg-green-50 flex flex-col gap-1 items-center text-center">
              <UserCheck className="h-5 w-5 text-green-400 mb-1" />
              <span className="text-xs text-muted-foreground">Present Today</span>
              <span className="text-3xl font-bold">{presentToday}</span>
            </div>
            <div className="p-4 rounded-lg bg-amber-50 flex flex-col gap-1 items-center text-center">
              <FileText className="h-5 w-5 text-amber-400 mb-1" />
              <span className="text-xs text-muted-foreground">Pending Leaves</span>
              <span className="text-3xl font-bold">{pendingLeaves}</span>
            </div>
            <div
              className="p-4 rounded-lg bg-blue-50 flex flex-col gap-1 items-center text-center cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => navigate('/hr/tickets')}
            >
              <TicketCheck className="h-5 w-5 text-blue-400 mb-1" />
              <span className="text-xs text-muted-foreground">Open Tickets</span>
              <span className={`text-3xl font-bold ${openTickets > 0 ? 'text-blue-600' : ''}`}>{openTickets}</span>
            </div>
            <div
              className="p-4 rounded-lg bg-orange-50 flex flex-col gap-1 items-center text-center cursor-pointer hover:bg-orange-100 transition-colors"
              onClick={() => navigate('/hr/expense-approvals')}
            >
              <Receipt className="h-5 w-5 text-orange-400 mb-1" />
              <span className="text-xs text-muted-foreground">Pending Expenses</span>
              <span className={`text-3xl font-bold ${pendingExpenseRequests > 0 ? 'text-orange-600' : ''}`}>{pendingExpenseRequests}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Employee Activity */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TicketCheck className="h-5 w-5 text-primary" />
              Recent Employee Activity (Tickets &amp; Expenses)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
            ) : (
              <div className="divide-y divide-border">
                {recentActivity.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(item.type === 'ticket' ? '/hr/tickets' : '/hr/expense-approvals')}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${item.type === 'ticket' ? 'bg-blue-100' : 'bg-orange-100'}`}>
                      {item.type === 'ticket'
                        ? <TicketCheck className="h-4 w-4 text-blue-600" />
                        : <Receipt className="h-4 w-4 text-orange-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.detail}</p>
                      <p className="text-xs text-muted-foreground">{item.name} · {new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                      item.status === 'open' || item.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      item.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      item.status === 'approved' || item.status === 'resolved' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
