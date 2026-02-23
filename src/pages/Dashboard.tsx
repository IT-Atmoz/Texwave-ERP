'use client';

import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { LiveClock } from '@/components/layout/LiveClock';
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
} from 'lucide-react';
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

  // Lists
  const [topUnpaidInvoices, setTopUnpaidInvoices] = useState<any[]>([]);
  const [topUnpaidBills, setTopUnpaidBills] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);

  // Chart data (last 6 months)
  const [monthlyChart, setMonthlyChart] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);

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

    return () => {
      unsubEmployees();
      unsubAttendance();
      unsubLeaves();
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
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Financial overview — Receivables, Payables, Banking & HR</p>
          </div>
          <LiveClock />
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
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-rose-50 flex flex-col gap-1 items-center text-center">
              <span className="text-xs text-muted-foreground">Total Employees</span>
              <span className="text-3xl font-bold">{totalEmployees}</span>
            </div>
            <div className="p-4 rounded-lg bg-green-50 flex flex-col gap-1 items-center text-center">
              <span className="text-xs text-muted-foreground">Present Today</span>
              <span className="text-3xl font-bold">{presentToday}</span>
            </div>
            <div className="p-4 rounded-lg bg-amber-50 flex flex-col gap-1 items-center text-center">
              <span className="text-xs text-muted-foreground">Pending Leave Requests</span>
              <span className="text-3xl font-bold">{pendingLeaves}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
