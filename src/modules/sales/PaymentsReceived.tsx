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
import { Search, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createRecord, deleteRecord, getAllRecords } from '@/services/firebase';

const paymentModes = ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'NEFT', 'RTGS', 'IMPS'];

export default function PaymentsReceived() {
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customerId: '', customerName: '', invoiceId: '', amount: '',
    paymentDate: new Date().toISOString().split('T')[0], mode: 'Bank Transfer', reference: '', notes: '',
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [pay, cust, inv] = await Promise.all([
        getAllRecords('sales/paymentsReceived'),
        getAllRecords('sales/customers'),
        getAllRecords('sales/invoices'),
      ]);
      setPayments(pay.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)));
      setCustomers(cust);
      setInvoices(inv);
    } catch { toast.error('Failed to load payments'); }
  };

  const handleCustomerChange = (cid: string) => {
    const c = customers.find((x: any) => x.id === cid);
    setForm((f) => ({ ...f, customerId: cid, customerName: c?.companyName || '' }));
  };

  const generatePaymentNumber = async () => {
    const existing = await getAllRecords('sales/paymentsReceived').catch(() => []);
    return `RCPT-${new Date().getFullYear()}-${String(existing.length + 1).padStart(4, '0')}`;
  };

  const handleSave = async () => {
    if (!form.customerId) { toast.error('Select a customer'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter valid amount'); return; }

    setSaving(true);
    try {
      const invoice = invoices.find((i: any) => i.id === form.invoiceId);
      const paymentNumber = await generatePaymentNumber();
      await createRecord('sales/paymentsReceived', {
        paymentNumber,
        customerId: form.customerId,
        customerName: form.customerName,
        invoiceId: form.invoiceId || null,
        invoiceNumber: invoice?.invoiceNumber || null,
        amount: parseFloat(form.amount),
        paymentDate: form.paymentDate,
        mode: form.mode,
        reference: form.reference,
        notes: form.notes,
      });
      toast.success('Payment received recorded');
      setOpen(false);
      setForm({ customerId: '', customerName: '', invoiceId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0], mode: 'Bank Transfer', reference: '', notes: '' });
      loadAll();
    } catch { toast.error('Failed to save payment'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, num: string) => {
    if (!confirm(`Delete payment ${num}?`)) return;
    try {
      await deleteRecord('sales/paymentsReceived', id);
      toast.success('Payment deleted');
      loadAll();
    } catch { toast.error('Failed to delete'); }
  };

  const filtered = payments.filter((p) => {
    const s = search.toLowerCase();
    return (
      p.paymentNumber?.toLowerCase().includes(s) ||
      p.customerName?.toLowerCase().includes(s) ||
      p.mode?.toLowerCase().includes(s)
    );
  });

  const customerInvoices = invoices.filter((i: any) => i.customerId === form.customerId);
  const totalReceived = filtered.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Payments Received</h2>
          <p className="text-muted-foreground text-sm">Total: ₹{totalReceived.toLocaleString('en-IN')}</p>
        </div>
        <Button onClick={() => setOpen(true)} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Record Payment
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search payments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="text-sm text-muted-foreground">{filtered.length} of {payments.length} payments</div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice Ref</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                      {search ? <>No results for "{search}"</> : 'No payments received yet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/50">
                      <TableCell><Badge variant="secondary" className="font-mono">{p.paymentNumber}</Badge></TableCell>
                      <TableCell className="font-medium">{p.customerName}</TableCell>
                      <TableCell>{p.invoiceNumber || '—'}</TableCell>
                      <TableCell>{p.paymentDate}</TableCell>
                      <TableCell className="text-right font-mono text-green-600 font-semibold">
                        ₹{(p.amount || 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>{p.mode}</TableCell>
                      <TableCell className="text-muted-foreground">{p.reference || '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id, p.paymentNumber)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
            <DialogTitle>Record Payment Received</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Customer *</Label>
              <Select value={form.customerId} onValueChange={handleCustomerChange}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Link to Invoice (optional)</Label>
              <Select value={form.invoiceId} onValueChange={(v) => setForm((f) => ({ ...f, invoiceId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {customerInvoices.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>{i.invoiceNumber} — ₹{i.grandTotal?.toLocaleString('en-IN')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Amount (₹) *</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} min={0} />
              </div>
              <div className="space-y-1">
                <Label>Payment Date</Label>
                <Input type="date" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Payment Mode</Label>
                <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentModes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="UTR / Cheque no." />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Record Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
