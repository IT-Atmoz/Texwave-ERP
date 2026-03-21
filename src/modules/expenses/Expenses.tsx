import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Edit, Trash2, Receipt, CheckCircle2, XCircle, Clock, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import { createRecord, updateRecord, deleteRecord, getAllRecords } from '@/services/firebase';
import { database } from '@/services/firebase';
import { ref, onValue, update } from 'firebase/database';
import { sendNotification } from '@/services/notifications';

const DEFAULT_CATEGORIES = [
  'Travel', 'Food & Entertainment', 'Office Supplies', 'Utilities', 'Rent', 'Salaries',
  'Marketing', 'Maintenance', 'Professional Services', 'Insurance', 'Miscellaneous',
];

const PAID_THROUGH = ['Cash', 'Bank Account', 'Credit Card', 'Petty Cash'];

interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  paidThrough: string;
  vendor: string;
  reference: string;
  notes: string;
  status: string;
  createdAt: number;
}

interface EmployeeExpense {
  id: string;
  expenseType: string;
  amount: number;
  date: string;
  description: string;
  receiptRef: string;
  status: 'pending' | 'approved' | 'rejected';
  employeeId: string;
  employeeName: string;
  createdAt: number;
  reviewNote?: string;
  reviewedAt?: number;
}

const emptyForm = () => ({
  date: new Date().toISOString().split('T')[0],
  category: '',
  amount: '',
  paidThrough: 'Cash',
  vendor: '',
  reference: '',
  notes: '',
  status: 'Recorded',
});

const statusColors: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function Expenses() {
  const [activeTab, setActiveTab] = useState<'business' | 'employee'>('business');

  // Business Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Employee Claims state
  const [empExpenses, setEmpExpenses] = useState<EmployeeExpense[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [empFilter, setEmpFilter] = useState('all');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Load business expenses
  useEffect(() => { loadExpenses(); }, []);

  // Real-time employee expense claims
  useEffect(() => {
    const unsub = onValue(ref(database, 'hr/expenseRequests'), snap => {
      if (!snap.exists()) { setEmpExpenses([]); return; }
      const list: EmployeeExpense[] = Object.entries(snap.val())
        .map(([id, v]: any) => ({ ...v, id }))
        .sort((a: any, b: any) => b.createdAt - a.createdAt);
      setEmpExpenses(list);
    });
    return () => unsub();
  }, []);

  const loadExpenses = async () => {
    try {
      const data = await getAllRecords('expenses/records');
      setExpenses(data.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch { toast.error('Failed to load expenses'); }
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (exp: Expense) => {
    setEditId(exp.id);
    setForm({
      date: exp.date, category: exp.category, amount: String(exp.amount),
      paidThrough: exp.paidThrough, vendor: exp.vendor || '',
      reference: exp.reference || '', notes: exp.notes || '', status: exp.status || 'Recorded',
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.category) { toast.error('Select a category'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter valid amount'); return; }
    setSaving(true);
    try {
      const payload = {
        date: form.date, category: form.category, amount: parseFloat(form.amount),
        paidThrough: form.paidThrough, vendor: form.vendor, reference: form.reference,
        notes: form.notes, status: form.status,
      };
      if (editId) {
        await updateRecord('expenses/records', editId, payload);
        toast.success('Expense updated');
      } else {
        await createRecord('expenses/records', payload);
        toast.success('Expense recorded');
      }
      setOpen(false);
      loadExpenses();
    } catch { toast.error('Failed to save expense'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await deleteRecord('expenses/records', id);
      toast.success('Expense deleted');
      loadExpenses();
    } catch { toast.error('Failed to delete'); }
  };

  const handleReview = async (id: string, newStatus: 'approved' | 'rejected') => {
    const expense = empExpenses.find(e => e.id === id);
    setSavingId(id);
    try {
      await update(ref(database, `hr/expenseRequests/${id}`), {
        status: newStatus,
        reviewNote: reviewNotes[id]?.trim() || '',
        reviewedAt: Date.now(),
      });
      if (expense) {
        await sendNotification(
          expense.employeeId,
          `Expense ${newStatus === 'approved' ? 'Approved ✓' : 'Rejected ✗'}`,
          `Your ₹${expense.amount.toLocaleString('en-IN')} ${expense.expenseType} claim has been ${newStatus}.${reviewNotes[id] ? ` Note: ${reviewNotes[id]}` : ''}`,
          'expense',
        );
      }
      toast.success(`Expense ${newStatus}`);
      setReviewNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch { toast.error('Failed to update'); }
    finally { setSavingId(null); }
  };

  const f = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const filtered = expenses.filter(e => {
    const s = search.toLowerCase();
    return e.category?.toLowerCase().includes(s) || e.vendor?.toLowerCase().includes(s) ||
      e.paidThrough?.toLowerCase().includes(s) || e.notes?.toLowerCase().includes(s);
  });

  const filteredEmp = empExpenses.filter(e => {
    const matchSearch = !empSearch ||
      e.employeeName.toLowerCase().includes(empSearch.toLowerCase()) ||
      e.expenseType.toLowerCase().includes(empSearch.toLowerCase()) ||
      e.description.toLowerCase().includes(empSearch.toLowerCase());
    const matchStatus = empFilter === 'all' || e.status === empFilter;
    return matchSearch && matchStatus;
  });

  const total = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);
  const empPendingCount = empExpenses.filter(e => e.status === 'pending').length;
  const empPendingTotal = empExpenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const empApprovedTotal = empExpenses.filter(e => e.status === 'approved').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Expenses</h2>
          <p className="text-muted-foreground text-sm">Track and manage business expenses</p>
        </div>
        {activeTab === 'business' && (
          <Button onClick={openAdd} size="lg">
            <Plus className="h-5 w-5 mr-2" /> Add Expense
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('business')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'business'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Business Expenses
        </button>
        <button
          onClick={() => setActiveTab('employee')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'employee'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Employee Claims
          {empPendingCount > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {empPendingCount}
            </span>
          )}
        </button>
      </div>

      {/* ── BUSINESS EXPENSES TAB ── */}
      {activeTab === 'business' && (
        <>
          <div className="text-sm text-muted-foreground font-medium">
            Total: ₹{total.toLocaleString('en-IN')} &nbsp;·&nbsp; {filtered.length} records
          </div>
          <Card className="shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by category, vendor..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="text-sm text-muted-foreground">{filtered.length} of {expenses.length} expenses</div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Vendor / Payee</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Paid Through</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                          {search ? <>No results for "{search}"</> : (
                            <div className="flex flex-col items-center gap-3">
                              <div className="text-2xl">No expenses recorded</div>
                              <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add your first expense</Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(exp => (
                        <TableRow key={exp.id} className="hover:bg-muted/50">
                          <TableCell>{exp.date}</TableCell>
                          <TableCell><Badge variant="outline">{exp.category}</Badge></TableCell>
                          <TableCell className="font-medium">{exp.vendor || '—'}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            ₹{(exp.amount || 0).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell>{exp.paidThrough}</TableCell>
                          <TableCell className="text-muted-foreground">{exp.reference || '—'}</TableCell>
                          <TableCell>
                            <Badge variant={exp.status === 'Reimbursed' ? 'default' : 'secondary'}>{exp.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(exp)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(exp.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── EMPLOYEE CLAIMS TAB ── */}
      {activeTab === 'employee' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
              <p className="text-2xl font-bold text-amber-600">{empExpenses.filter(e => e.status === 'pending').length}</p>
              <p className="text-xs text-muted-foreground mt-1">Pending</p>
              {empPendingTotal > 0 && <p className="text-xs text-amber-600 font-medium mt-1">₹{empPendingTotal.toLocaleString('en-IN')}</p>}
            </Card>
            <Card className="p-4 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold text-green-600">{empExpenses.filter(e => e.status === 'approved').length}</p>
              <p className="text-xs text-muted-foreground mt-1">Approved</p>
              {empApprovedTotal > 0 && <p className="text-xs text-green-600 font-medium mt-1">₹{empApprovedTotal.toLocaleString('en-IN')}</p>}
            </Card>
            <Card className="p-4 text-center">
              <XCircle className="h-5 w-5 mx-auto mb-1 text-red-400" />
              <p className="text-2xl font-bold text-red-600">{empExpenses.filter(e => e.status === 'rejected').length}</p>
              <p className="text-xs text-muted-foreground mt-1">Rejected</p>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name or type..."
                value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
              />
            </div>
            <Select value={empFilter} onValueChange={setEmpFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Claims list */}
          {filteredEmp.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No employee expense claims found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredEmp.map(expense => (
                <Card key={expense.id} className={expense.status === 'pending' ? 'border-amber-200' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold flex items-center gap-1">
                            <IndianRupee className="h-4 w-4" />
                            {expense.amount.toLocaleString('en-IN')}
                          </span>
                          <Badge variant="outline">{expense.expenseType}</Badge>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[expense.status]}`}>
                            {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
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
                          placeholder="Add a review note (optional)..."
                          value={reviewNotes[expense.id] || ''}
                          onChange={e => setReviewNotes(prev => ({ ...prev, [expense.id]: e.target.value }))}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gap-1 bg-green-600 hover:bg-green-700"
                            disabled={savingId === expense.id}
                            onClick={() => handleReview(expense.id, 'approved')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1"
                            disabled={savingId === expense.id}
                            onClick={() => handleReview(expense.id, 'rejected')}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {expense.status !== 'pending' && expense.reviewedAt && (
                      <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                        Reviewed on {new Date(expense.reviewedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => f('date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => f('category', v)}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {DEFAULT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Amount (₹) *</Label>
                <Input type="number" value={form.amount} onChange={e => f('amount', e.target.value)} min={0} />
              </div>
              <div className="space-y-1">
                <Label>Paid Through</Label>
                <Select value={form.paidThrough} onValueChange={v => f('paidThrough', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAID_THROUGH.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Vendor / Payee</Label>
                <Input value={form.vendor} onChange={e => f('vendor', e.target.value)} placeholder="Vendor name" />
              </div>
              <div className="space-y-1">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={e => f('reference', e.target.value)} placeholder="Invoice / Receipt no." />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => f('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Recorded">Recorded</SelectItem>
                  <SelectItem value="Reimbursed">Reimbursed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2} />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Update' : 'Add Expense'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
