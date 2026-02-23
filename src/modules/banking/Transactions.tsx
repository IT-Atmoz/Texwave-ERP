import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createRecord, getAllRecords } from '@/services/firebase';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  'Sales Receipt', 'Purchase Payment', 'Expense', 'Salary', 'Rent', 'Utilities', 'Transfer', 'Other',
];

export default function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    accountId: '', type: 'Credit', date: new Date().toISOString().split('T')[0],
    amount: '', description: '', reference: '', category: '',
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [txns, accs] = await Promise.all([
        getAllRecords('banking/transactions'),
        getAllRecords('banking/accounts'),
      ]);
      setTransactions(txns.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)));
      setAccounts(accs);
    } catch { toast.error('Failed to load transactions'); }
  };

  const f = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!form.accountId) { toast.error('Select an account'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter valid amount'); return; }
    if (!form.description.trim()) { toast.error('Enter description'); return; }

    setSaving(true);
    try {
      await createRecord('banking/transactions', {
        accountId: form.accountId,
        accountName: accounts.find((a) => a.id === form.accountId)?.accountName || '',
        type: form.type,
        date: form.date,
        amount: parseFloat(form.amount),
        description: form.description,
        reference: form.reference,
        category: form.category,
      });
      toast.success('Transaction added');
      setOpen(false);
      setForm({ accountId: '', type: 'Credit', date: new Date().toISOString().split('T')[0], amount: '', description: '', reference: '', category: '' });
      loadAll();
    } catch { toast.error('Failed to save transaction'); }
    finally { setSaving(false); }
  };

  const filtered = transactions.filter((t) => {
    const s = search.toLowerCase();
    return (
      t.description?.toLowerCase().includes(s) ||
      t.accountName?.toLowerCase().includes(s) ||
      t.category?.toLowerCase().includes(s) ||
      t.reference?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Transactions</h2>
          <p className="text-muted-foreground text-sm">All bank account transactions</p>
        </div>
        <Button onClick={() => setOpen(true)} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Add Transaction
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="text-sm text-muted-foreground">{filtered.length} transactions</div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                      {search ? <>No results for "{search}"</> : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="text-2xl">No transactions yet</div>
                          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add transaction</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/50">
                      <TableCell>{t.date}</TableCell>
                      <TableCell className="font-medium">{t.accountName}</TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell>
                        {t.category && <Badge variant="outline">{t.category}</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className={cn('flex items-center gap-1 font-medium', t.type === 'Credit' ? 'text-green-600' : 'text-red-600')}>
                          {t.type === 'Credit'
                            ? <ArrowUpCircle className="h-4 w-4" />
                            : <ArrowDownCircle className="h-4 w-4" />}
                          {t.type}
                        </div>
                      </TableCell>
                      <TableCell className={cn('text-right font-mono font-semibold', t.type === 'Credit' ? 'text-green-600' : 'text-red-600')}>
                        {t.type === 'Credit' ? '+' : '-'}₹{(t.amount || 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.reference || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Account *</Label>
              <Select value={form.accountId} onValueChange={(v) => f('accountId', v)}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.accountName} — {a.bankName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => f('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Credit">Credit (In)</SelectItem>
                    <SelectItem value="Debit">Debit (Out)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => f('date', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Amount (₹) *</Label>
              <Input type="number" value={form.amount} onChange={(e) => f('amount', e.target.value)} min={0} />
            </div>
            <div className="space-y-1">
              <Label>Description *</Label>
              <Input value={form.description} onChange={(e) => f('description', e.target.value)} placeholder="Transaction description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => f('category', v)}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => f('reference', e.target.value)} placeholder="UTR / Ref no." />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Add Transaction'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
