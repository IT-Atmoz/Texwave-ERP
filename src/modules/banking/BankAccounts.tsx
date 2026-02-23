import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Landmark, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { createRecord, updateRecord, deleteRecord, getAllRecords } from '@/services/firebase';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  openingBalance: number;
  currentBalance: number;
  currency: string;
  createdAt: number;
}

const emptyForm = () => ({
  accountName: '', bankName: '', accountNumber: '', ifsc: '',
  openingBalance: '', currency: 'INR',
});

export default function BankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    try {
      const data = await getAllRecords('banking/accounts');
      setAccounts(data.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch { toast.error('Failed to load accounts'); }
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm()); setOpen(true); };

  const openEdit = (acc: BankAccount) => {
    setEditId(acc.id);
    setForm({
      accountName: acc.accountName,
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      ifsc: acc.ifsc,
      openingBalance: String(acc.openingBalance),
      currency: acc.currency,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.accountName) { toast.error('Account name is required'); return; }
    if (!form.bankName) { toast.error('Bank name is required'); return; }

    setSaving(true);
    try {
      const bal = parseFloat(form.openingBalance) || 0;
      const payload = {
        accountName: form.accountName,
        bankName: form.bankName,
        accountNumber: form.accountNumber,
        ifsc: form.ifsc,
        openingBalance: bal,
        currentBalance: editId ? undefined : bal,
        currency: form.currency,
      };
      if (editId) {
        const { currentBalance: _, ...updatePayload } = payload;
        await updateRecord('banking/accounts', editId, updatePayload);
        toast.success('Account updated');
      } else {
        await createRecord('banking/accounts', { ...payload, currentBalance: bal });
        toast.success('Bank account added');
      }
      setOpen(false);
      loadAccounts();
    } catch { toast.error('Failed to save account'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete account "${name}"?`)) return;
    try {
      await deleteRecord('banking/accounts', id);
      toast.success('Account deleted');
      loadAccounts();
    } catch { toast.error('Failed to delete'); }
  };

  const f = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Bank Accounts</h2>
          <p className="text-muted-foreground text-sm">
            Total Cash & Bank: ₹{totalBalance.toLocaleString('en-IN')}
          </p>
        </div>
        <Button onClick={openAdd} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Add Account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="py-16 text-center text-muted-foreground">
          <CardContent className="flex flex-col items-center gap-3">
            <Landmark className="h-12 w-12 opacity-20" />
            <div className="text-xl">No bank accounts yet</div>
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add your first account</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <Card key={acc.id} className="hover:shadow-lg transition-all">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Landmark className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{acc.accountName}</CardTitle>
                    <p className="text-xs text-muted-foreground">{acc.bankName}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(acc)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id, acc.accountName)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Current Balance</span>
                    <div className="flex items-center gap-1 text-green-600">
                      <TrendingUp className="h-4 w-4" />
                      <span className="font-bold text-lg">
                        {acc.currency} {(acc.currentBalance || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  {acc.accountNumber && (
                    <p className="text-xs text-muted-foreground font-mono">
                      A/C: ****{acc.accountNumber.slice(-4)}
                    </p>
                  )}
                  {acc.ifsc && (
                    <p className="text-xs text-muted-foreground">IFSC: {acc.ifsc}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Account Name *</Label>
              <Input value={form.accountName} onChange={(e) => f('accountName', e.target.value)} placeholder="e.g. Main Current Account" />
            </div>
            <div className="space-y-1">
              <Label>Bank Name *</Label>
              <Input value={form.bankName} onChange={(e) => f('bankName', e.target.value)} placeholder="e.g. HDFC Bank" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Account Number</Label>
                <Input value={form.accountNumber} onChange={(e) => f('accountNumber', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>IFSC Code</Label>
                <Input value={form.ifsc} onChange={(e) => f('ifsc', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Opening Balance</Label>
                <Input type="number" value={form.openingBalance} onChange={(e) => f('openingBalance', e.target.value)} min={0} />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => f('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Update' : 'Add Account'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
