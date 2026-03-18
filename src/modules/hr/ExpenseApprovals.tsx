import { useEffect, useState } from 'react';
import { database } from '@/services/firebase';
import { ref, onValue, update } from 'firebase/database';
import { sendNotification } from '@/services/notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Receipt, CheckCircle2, XCircle, Clock, Search, IndianRupee, Download, ChevronDown, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';

type ExpenseStatus = 'pending' | 'approved' | 'rejected';

interface ExpenseRequest {
  id: string;
  expenseType: string;
  amount: number;
  date: string;
  description: string;
  receiptRef: string;
  status: ExpenseStatus;
  employeeId: string;
  employeeName: string;
  createdAt: number;
  reviewNote?: string;
  reviewedAt?: number;
}

const EXPENSE_TYPES = ['Travel', 'Food', 'Accommodation', 'Office Supplies', 'Medical', 'Other'];

const statusConfig: Record<ExpenseStatus, { label: string; cls: string }> = {
  pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
};

const categoryColors: Record<string, string> = {
  Travel:           'bg-blue-50 border-blue-200 text-blue-700',
  Food:             'bg-orange-50 border-orange-200 text-orange-700',
  Accommodation:    'bg-purple-50 border-purple-200 text-purple-700',
  'Office Supplies':'bg-teal-50 border-teal-200 text-teal-700',
  Medical:          'bg-red-50 border-red-200 text-red-700',
  Other:            'bg-gray-50 border-gray-200 text-gray-700',
};

export default function ExpenseApprovals() {
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onValue(ref(database, 'hr/expenseRequests'), snap => {
      if (!snap.exists()) { setExpenses([]); return; }
      const data = snap.val();
      const list: ExpenseRequest[] = Object.entries(data)
        .map(([id, v]: any) => ({ ...v, id }))
        .sort((a: any, b: any) => b.createdAt - a.createdAt);
      setExpenses(list);
    });
    return () => unsub();
  }, []);

  const handleReview = async (id: string, newStatus: 'approved' | 'rejected') => {
    const expense = expenses.find(e => e.id === id);
    setSaving(id);
    try {
      await update(ref(database, `hr/expenseRequests/${id}`), {
        status: newStatus,
        reviewNote: reviewNotes[id]?.trim() || '',
        reviewedAt: Date.now(),
      });
      toast.success(`Expense ${newStatus}`);
      if (expense) {
        await sendNotification(
          expense.employeeId,
          `Expense ${newStatus === 'approved' ? 'Approved ✓' : 'Rejected ✗'}`,
          `Your ₹${expense.amount.toLocaleString('en-IN')} ${expense.expenseType} expense claim has been ${newStatus}.${reviewNotes[id] ? ` Note: ${reviewNotes[id]}` : ''}`,
          'expense',
        );
      }
      setReviewNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch {
      toast.error('Failed to update. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const downloadExcel = () => {
    const rows = expenses.map(e => ({
      'Employee Name': e.employeeName,
      'Employee ID': e.employeeId,
      'Category': e.expenseType,
      'Amount (₹)': e.amount,
      'Date': e.date,
      'Description': e.description,
      'Receipt Ref': e.receiptRef || '',
      'Status': e.status.charAt(0).toUpperCase() + e.status.slice(1),
      'HR Note': e.reviewNote || '',
      'Submitted On': new Date(e.createdAt).toLocaleDateString('en-IN'),
      'Reviewed On': e.reviewedAt ? new Date(e.reviewedAt).toLocaleDateString('en-IN') : '',
    }));

    // Summary by category
    const categorySummary = EXPENSE_TYPES.map(cat => ({
      'Category': cat,
      'Total Claims': expenses.filter(e => e.expenseType === cat).length,
      'Pending': expenses.filter(e => e.expenseType === cat && e.status === 'pending').length,
      'Approved': expenses.filter(e => e.expenseType === cat && e.status === 'approved').length,
      'Rejected': expenses.filter(e => e.expenseType === cat && e.status === 'rejected').length,
      'Total Amount (₹)': expenses.filter(e => e.expenseType === cat).reduce((s, e) => s + e.amount, 0),
      'Approved Amount (₹)': expenses.filter(e => e.expenseType === cat && e.status === 'approved').reduce((s, e) => s + e.amount, 0),
    }));

    const wb = XLSX.utils.book_new();
    const wsAll = XLSX.utils.json_to_sheet(rows);
    const wsSummary = XLSX.utils.json_to_sheet(categorySummary);

    // Auto column widths
    const maxWidths = (data: any[]) =>
      Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)) + 2,
      }));

    if (rows.length > 0) wsAll['!cols'] = maxWidths(rows);
    if (categorySummary.length > 0) wsSummary['!cols'] = maxWidths(categorySummary);

    XLSX.utils.book_append_sheet(wb, wsAll, 'All Expenses');
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Category Summary');
    XLSX.writeFile(wb, `expense_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel downloaded');
  };

  const filtered = expenses.filter(e => {
    const matchesSearch = !search ||
      e.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      e.expenseType.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pendingTotal  = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const approvedTotal = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + e.amount, 0);

  // Group filtered by category
  const grouped = EXPENSE_TYPES.reduce((acc, type) => {
    const items = filtered.filter(e => e.expenseType === type);
    if (items.length > 0) acc[type] = items;
    return acc;
  }, {} as Record<string, ExpenseRequest[]>);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Expense Approvals</h1>
          <p className="text-sm text-muted-foreground">Review and approve employee expense claims</p>
        </div>
        <Button onClick={downloadExcel} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Download Excel
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{expenses.filter(e => e.status === 'pending').length}</p>
          <p className="text-xs text-amber-500 font-medium">₹{pendingTotal.toLocaleString('en-IN')}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Approved</p>
          <p className="text-2xl font-bold text-green-600">{expenses.filter(e => e.status === 'approved').length}</p>
          <p className="text-xs text-green-500 font-medium">₹{approvedTotal.toLocaleString('en-IN')}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Rejected</p>
          <p className="text-2xl font-bold text-red-600">{expenses.filter(e => e.status === 'rejected').length}</p>
          <p className="text-xs text-muted-foreground">Total: {expenses.length}</p>
        </Card>
      </div>

      {/* Category Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {EXPENSE_TYPES.map(type => {
          const typeExpenses = expenses.filter(e => e.expenseType === type);
          if (typeExpenses.length === 0) return null;
          const total = typeExpenses.reduce((s, e) => s + e.amount, 0);
          const colorCls = categoryColors[type] || categoryColors.Other;
          return (
            <div key={type} className={`rounded-lg border px-3 py-2 text-center ${colorCls}`}>
              <p className="text-xs font-semibold truncate">{type}</p>
              <p className="text-sm font-bold">₹{total.toLocaleString('en-IN')}</p>
              <p className="text-[10px] opacity-70">{typeExpenses.length} claims</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name or type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grouped by Category */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No expense requests found</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, items]) => {
          const isCollapsed = collapsedCategories.has(category);
          const catTotal = items.reduce((s, e) => s + e.amount, 0);
          const pendingInCat = items.filter(e => e.status === 'pending').length;
          const colorCls = categoryColors[category] || categoryColors.Other;

          return (
            <div key={category}>
              {/* Category Heading */}
              <button
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-semibold mb-2 transition-colors ${colorCls}`}
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {category}
                  <span className="font-normal opacity-70 text-xs">({items.length} claim{items.length > 1 ? 's' : ''})</span>
                  {pendingInCat > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {pendingInCat} pending
                    </span>
                  )}
                </div>
                <span className="flex items-center gap-1 text-xs font-bold">
                  <IndianRupee className="h-3 w-3" />
                  {catTotal.toLocaleString('en-IN')}
                </span>
              </button>

              {/* Items in category */}
              {!isCollapsed && (
                <div className="space-y-2 mb-4">
                  {items.map(expense => {
                    const cfg = statusConfig[expense.status];
                    return (
                      <Card key={expense.id} className={expense.status === 'pending' ? 'border-amber-200' : ''}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-base font-bold flex items-center gap-1">
                                  <IndianRupee className="h-4 w-4" />
                                  {expense.amount.toLocaleString('en-IN')}
                                </span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>
                                  {cfg.label}
                                </span>
                              </div>
                              <p className="text-sm font-medium mt-1">{expense.employeeName}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{expense.description}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>{expense.date}</span>
                                {expense.receiptRef && <span>Receipt: {expense.receiptRef}</span>}
                                <span>Submitted: {new Date(expense.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              </div>
                              {expense.reviewNote && (
                                <p className="text-xs mt-1 text-muted-foreground italic">Note: {expense.reviewNote}</p>
                              )}
                            </div>
                          </div>

                          {expense.status === 'pending' && (
                            <div className="mt-3 pt-3 border-t space-y-2">
                              <Textarea
                                rows={2}
                                placeholder="Add a note (optional)..."
                                value={reviewNotes[expense.id] || ''}
                                onChange={e => setReviewNotes(prev => ({ ...prev, [expense.id]: e.target.value }))}
                                className="text-sm"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="gap-1 bg-green-600 hover:bg-green-700"
                                  disabled={saving === expense.id}
                                  onClick={() => handleReview(expense.id, 'approved')}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="gap-1"
                                  disabled={saving === expense.id}
                                  onClick={() => handleReview(expense.id, 'rejected')}
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Reject
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
