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
import { Search, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createRecord, updateRecord, deleteRecord, getAllRecords } from '@/services/firebase';

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

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    try {
      const data = await getAllRecords('expenses/records');
      setExpenses(data.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch { toast.error('Failed to load expenses'); }
  };

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditId(exp.id);
    setForm({
      date: exp.date,
      category: exp.category,
      amount: String(exp.amount),
      paidThrough: exp.paidThrough,
      vendor: exp.vendor || '',
      reference: exp.reference || '',
      notes: exp.notes || '',
      status: exp.status || 'Recorded',
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.category) { toast.error('Select a category'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter valid amount'); return; }

    setSaving(true);
    try {
      const payload = {
        date: form.date,
        category: form.category,
        amount: parseFloat(form.amount),
        paidThrough: form.paidThrough,
        vendor: form.vendor,
        reference: form.reference,
        notes: form.notes,
        status: form.status,
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

  const f = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const filtered = expenses.filter((e) => {
    const s = search.toLowerCase();
    return (
      e.category?.toLowerCase().includes(s) ||
      e.vendor?.toLowerCase().includes(s) ||
      e.paidThrough?.toLowerCase().includes(s) ||
      e.notes?.toLowerCase().includes(s)
    );
  });

  const total = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">All Expenses</h2>
          <p className="text-muted-foreground text-sm">Total: ₹{total.toLocaleString('en-IN')}</p>
        </div>
        <Button onClick={openAdd} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Add Expense
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by category, vendor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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
                  filtered.map((exp) => (
                    <TableRow key={exp.id} className="hover:bg-muted/50">
                      <TableCell>{exp.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{exp.category}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{exp.vendor || '—'}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ₹{(exp.amount || 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>{exp.paidThrough}</TableCell>
                      <TableCell className="text-muted-foreground">{exp.reference || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={exp.status === 'Reimbursed' ? 'default' : 'secondary'}>
                          {exp.status}
                        </Badge>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => f('date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => f('category', v)}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {DEFAULT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Amount (₹) *</Label>
                <Input type="number" value={form.amount} onChange={(e) => f('amount', e.target.value)} min={0} />
              </div>
              <div className="space-y-1">
                <Label>Paid Through</Label>
                <Select value={form.paidThrough} onValueChange={(v) => f('paidThrough', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAID_THROUGH.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Vendor / Payee</Label>
                <Input value={form.vendor} onChange={(e) => f('vendor', e.target.value)} placeholder="Vendor name" />
              </div>
              <div className="space-y-1">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => f('reference', e.target.value)} placeholder="Invoice / Receipt no." />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => f('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Recorded">Recorded</SelectItem>
                  <SelectItem value="Reimbursed">Reimbursed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => f('notes', e.target.value)} rows={2} />
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
