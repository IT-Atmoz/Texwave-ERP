import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Edit, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { createRecord, updateRecord, deleteRecord, getAllRecords } from '@/services/firebase';

type AccountType = 'Asset' | 'Liability' | 'Income' | 'Expense' | 'Equity';

const TYPE_COLORS: Record<AccountType, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Asset: 'default',
  Liability: 'destructive',
  Income: 'default',
  Expense: 'outline',
  Equity: 'secondary',
};

const DEFAULT_ACCOUNTS = [
  { code: '1001', name: 'Cash', type: 'Asset', balance: 0 },
  { code: '1002', name: 'Bank Account', type: 'Asset', balance: 0 },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset', balance: 0 },
  { code: '2001', name: 'Accounts Payable', type: 'Liability', balance: 0 },
  { code: '2100', name: 'GST Payable', type: 'Liability', balance: 0 },
  { code: '3001', name: 'Owner Equity', type: 'Equity', balance: 0 },
  { code: '4001', name: 'Sales Revenue', type: 'Income', balance: 0 },
  { code: '5001', name: 'Cost of Goods Sold', type: 'Expense', balance: 0 },
  { code: '5100', name: 'Operating Expenses', type: 'Expense', balance: 0 },
  { code: '5200', name: 'Salary Expense', type: 'Expense', balance: 0 },
];

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'Asset' as AccountType, balance: '' });

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    try {
      const data = await getAllRecords('accounting/chartOfAccounts');
      setAccounts(data.sort((a: any, b: any) => (a.code || '').localeCompare(b.code || '')));
    } catch { toast.error('Failed to load accounts'); }
  };

  const seedDefaults = async () => {
    if (!confirm('This will seed default accounts. Continue?')) return;
    setSeeding(true);
    try {
      for (const acc of DEFAULT_ACCOUNTS) {
        await createRecord('accounting/chartOfAccounts', acc);
      }
      toast.success('Default accounts seeded');
      loadAccounts();
    } catch { toast.error('Failed to seed accounts'); }
    finally { setSeeding(false); }
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ code: '', name: '', type: 'Asset', balance: '' });
    setOpen(true);
  };

  const openEdit = (acc: any) => {
    setEditId(acc.id);
    setForm({ code: acc.code, name: acc.name, type: acc.type, balance: String(acc.balance || 0) });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) { toast.error('Account code is required'); return; }
    if (!form.name.trim()) { toast.error('Account name is required'); return; }

    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
        balance: parseFloat(form.balance) || 0,
      };
      if (editId) {
        await updateRecord('accounting/chartOfAccounts', editId, payload);
        toast.success('Account updated');
      } else {
        await createRecord('accounting/chartOfAccounts', payload);
        toast.success('Account created');
      }
      setOpen(false);
      loadAccounts();
    } catch { toast.error('Failed to save account'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete account "${name}"?`)) return;
    try {
      await deleteRecord('accounting/chartOfAccounts', id);
      toast.success('Account deleted');
      loadAccounts();
    } catch { toast.error('Failed to delete'); }
  };

  const f = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const filtered = accounts.filter((a) => {
    const s = search.toLowerCase();
    return a.code?.toLowerCase().includes(s) || a.name?.toLowerCase().includes(s) || a.type?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Chart of Accounts</h2>
          <p className="text-muted-foreground text-sm">{accounts.length} accounts configured</p>
        </div>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <Button variant="outline" onClick={seedDefaults} disabled={seeding}>
              <Sparkles className="h-4 w-4 mr-2" />
              {seeding ? 'Seeding...' : 'Seed Defaults'}
            </Button>
          )}
          <Button onClick={openAdd} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by code, name, type..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="text-sm text-muted-foreground">{filtered.length} accounts</div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                      {search ? <>No accounts matching "{search}"</> : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="text-xl">No accounts yet</div>
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={seedDefaults} disabled={seeding}>
                              <Sparkles className="h-4 w-4 mr-2" />Seed Defaults
                            </Button>
                            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Account</Button>
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((acc) => (
                    <TableRow key={acc.id} className="hover:bg-muted/50">
                      <TableCell><Badge variant="secondary" className="font-mono">{acc.code}</Badge></TableCell>
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell>
                        <Badge variant={TYPE_COLORS[acc.type as AccountType] || 'secondary'}>{acc.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">₹{(acc.balance || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(acc)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id, acc.name)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Account' : 'Add Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Code *</Label>
                <Input value={form.code} onChange={(e) => f('code', e.target.value)} placeholder="e.g. 1001" />
              </div>
              <div className="space-y-1">
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={(v) => f('type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['Asset','Liability','Income','Expense','Equity'] as AccountType[]).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Account Name *</Label>
              <Input value={form.name} onChange={(e) => f('name', e.target.value)} placeholder="e.g. Cash in Hand" />
            </div>
            <div className="space-y-1">
              <Label>Opening Balance (₹)</Label>
              <Input type="number" value={form.balance} onChange={(e) => f('balance', e.target.value)} min={0} />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editId ? 'Update' : 'Add Account'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
