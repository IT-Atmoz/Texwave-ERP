import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, push, set, onValue } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { notifyAdminFeed } from '@/services/notifications';
import { Receipt, Plus, Clock, CheckCircle2, XCircle, IndianRupee, ChevronDown, ChevronRight } from 'lucide-react';

type ExpenseStatus = 'pending' | 'approved' | 'rejected';
type ExpenseType = 'Travel' | 'Food' | 'Accommodation' | 'Office Supplies' | 'Medical' | 'Other';

interface ExpenseRequest {
  id: string;
  expenseType: ExpenseType;
  amount: number;
  date: string;
  description: string;
  receiptRef: string;
  status: ExpenseStatus;
  employeeId: string;
  employeeName: string;
  createdAt: number;
  reviewNote?: string;
}

const EXPENSE_TYPES: ExpenseType[] = ['Travel', 'Food', 'Accommodation', 'Office Supplies', 'Medical', 'Other'];

const statusConfig: Record<ExpenseStatus, { label: string; cls: string; icon: any }> = {
  pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700',  icon: Clock },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700',      icon: XCircle },
};

const categoryColors: Record<string, string> = {
  Travel:           'bg-blue-50 border-blue-200 text-blue-700',
  Food:             'bg-orange-50 border-orange-200 text-orange-700',
  Accommodation:    'bg-purple-50 border-purple-200 text-purple-700',
  'Office Supplies':'bg-teal-50 border-teal-200 text-teal-700',
  Medical:          'bg-red-50 border-red-200 text-red-700',
  Other:            'bg-gray-50 border-gray-200 text-gray-700',
};

export default function MyExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expenseType, setExpenseType] = useState<ExpenseType>('Travel');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [receiptRef, setReceiptRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const empKey = user?.firebaseKey || user?.employeeId || '';

  useEffect(() => {
    if (!empKey) return;
    const unsub = onValue(ref(database, 'hr/expenseRequests'), snap => {
      if (!snap.exists()) { setExpenses([]); return; }
      const data = snap.val();
      const list: ExpenseRequest[] = Object.entries(data)
        .map(([id, v]: any) => ({ ...v, id }))
        .filter((e: any) => e.employeeId === empKey || e.employeeId === user?.employeeId)
        .sort((a: any, b: any) => b.createdAt - a.createdAt);
      setExpenses(list);
    });
    return () => unsub();
  }, [empKey, user?.employeeId]);

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!description.trim()) {
      toast.error('Please add a description');
      return;
    }
    setSubmitting(true);
    try {
      const newRef = push(ref(database, 'hr/expenseRequests'));
      await set(newRef, {
        expenseType,
        amount: Number(amount),
        date,
        description: description.trim(),
        receiptRef: receiptRef.trim(),
        status: 'pending',
        employeeId: empKey,
        employeeName: user?.name || '',
        createdAt: Date.now(),
      });
      // Notify HR/Admin
      await notifyAdminFeed(
        `New Expense Claim — ${user?.name || 'Employee'}`,
        `${expenseType}: ₹${Number(amount).toLocaleString('en-IN')} — ${description.trim()}`,
        'expense',
      );
      toast.success('Expense submitted for approval.');
      setAmount('');
      setDescription('');
      setReceiptRef('');
      setExpenseType('Travel');
      setDate(new Date().toISOString().split('T')[0]);
      setShowForm(false);
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // Group by category
  const grouped = EXPENSE_TYPES.reduce((acc, type) => {
    const items = expenses.filter(e => e.expenseType === type);
    if (items.length > 0) acc[type] = items;
    return acc;
  }, {} as Record<string, ExpenseRequest[]>);

  const totalApproved = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + e.amount, 0);
  const totalPending  = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">My Expenses</h1>
          <p className="text-sm text-muted-foreground">Submit and track your expense claims</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="gap-2">
          <Plus className="h-4 w-4" />
          {showForm ? 'Cancel' : 'New Expense'}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        {(['pending', 'approved', 'rejected'] as ExpenseStatus[]).map(s => {
          const count = expenses.filter(e => e.status === s).length;
          const cfg = statusConfig[s];
          const Icon = cfg.icon;
          return (
            <Card key={s} className="p-4 text-center">
              <Icon className="h-5 w-5 mx-auto mb-1 opacity-60" />
              <p className="text-xl font-bold">{count}</p>
              <p className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${cfg.cls}`}>{cfg.label}</p>
              {s === 'approved' && totalApproved > 0 && (
                <p className="text-xs text-green-600 mt-1 font-medium">₹{totalApproved.toLocaleString('en-IN')}</p>
              )}
              {s === 'pending' && totalPending > 0 && (
                <p className="text-xs text-amber-600 mt-1 font-medium">₹{totalPending.toLocaleString('en-IN')}</p>
              )}
            </Card>
          );
        })}
      </div>

      {/* New Expense Form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              New Expense Claim
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Expense Type</Label>
                <Select value={expenseType} onValueChange={v => setExpenseType(v as ExpenseType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹) *</Label>
                <Input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Receipt / Bill Number</Label>
                <Input value={receiptRef} onChange={e => setReceiptRef(e.target.value)} placeholder="e.g. INV-1234" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the expense..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting || !amount || !description.trim()}>
                {submitting ? 'Submitting...' : 'Submit Claim'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses grouped by category */}
      {expenses.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No expenses submitted yet</p>
            <Button size="sm" className="mt-3 gap-1" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" /> Submit your first expense
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, items]) => {
          const isCollapsed = collapsedCategories.has(category);
          const catTotal = items.reduce((s, e) => s + e.amount, 0);
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
                </div>
                <span className="flex items-center gap-1 text-xs font-bold">
                  <IndianRupee className="h-3 w-3" />
                  {catTotal.toLocaleString('en-IN')}
                </span>
              </button>

              {/* Category Items */}
              {!isCollapsed && (
                <Card className="overflow-hidden">
                  <div className="divide-y divide-border">
                    {items.map(expense => {
                      const cfg = statusConfig[expense.status];
                      const Icon = cfg.icon;
                      return (
                        <div key={expense.id} className="p-4 hover:bg-muted/20 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold flex items-center gap-0.5">
                                  <IndianRupee className="h-3.5 w-3.5" />{expense.amount.toLocaleString('en-IN')}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{expense.description}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>{expense.date}</span>
                                {expense.receiptRef && <span>Receipt: {expense.receiptRef}</span>}
                              </div>
                              {expense.reviewNote && (
                                <div className={`mt-2 p-2 rounded border text-xs ${expense.status === 'approved' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                  <span className="font-semibold">HR: </span>{expense.reviewNote}
                                </div>
                              )}
                            </div>
                            <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.cls}`}>
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
