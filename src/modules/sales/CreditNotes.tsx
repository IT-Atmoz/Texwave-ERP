import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

// A Credit Note is issued when: goods are returned, invoice was overcharged, or discount is given post-invoice.

interface CreditNoteItem {
  sNo: number;
  description: string;
  qty: number;
  rate: number;
  taxPercent: number;
  amount: number;
}

const emptyItem = (): CreditNoteItem => ({ sNo: 1, description: '', qty: 1, rate: 0, taxPercent: 18, amount: 0 });

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Open: 'default',
  Applied: 'secondary',
  Void: 'destructive',
};

const REASONS = [
  'Goods Returned',
  'Invoice Overcharge',
  'Damaged Goods',
  'Quality Issue',
  'Discount Applied',
  'Other',
];

export default function CreditNotes() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    cnNumber: '',
    customerId: '',
    customerName: '',
    invoiceId: '',
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    notes: '',
    status: 'Open',
    items: [emptyItem()],
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [cn, cust, inv] = await Promise.all([
        getAllRecords('sales/creditNotes'),
        getAllRecords('sales/customers'),
        getAllRecords('sales/invoices'),
      ]);
      setNotes(cn.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)));
      setCustomers(cust);
      setInvoices(inv);
    } catch { toast.error('Failed to load credit notes'); }
  };

  const generateCNNumber = async () => {
    const existing = await getAllRecords('sales/creditNotes').catch(() => []);
    return `CN-${new Date().getFullYear()}-${String(existing.length + 1).padStart(4, '0')}`;
  };

  const openAdd = async () => {
    const cnNumber = await generateCNNumber();
    setEditId(null);
    setForm({
      cnNumber,
      customerId: '', customerName: '', invoiceId: '', invoiceNumber: '',
      date: new Date().toISOString().split('T')[0],
      reason: '', notes: '', status: 'Open', items: [emptyItem()],
    });
    setOpen(true);
  };

  const openEdit = (cn: any) => {
    setEditId(cn.id);
    setForm({
      cnNumber: cn.cnNumber || '',
      customerId: cn.customerId || '',
      customerName: cn.customerName || '',
      invoiceId: cn.invoiceId || '',
      invoiceNumber: cn.invoiceNumber || '',
      date: cn.date || '',
      reason: cn.reason || '',
      notes: cn.notes || '',
      status: cn.status || 'Open',
      items: cn.items?.length ? cn.items : [emptyItem()],
    });
    setOpen(true);
  };

  const handleCustomerChange = (cid: string) => {
    const c = customers.find((x: any) => x.id === cid);
    setForm((f) => ({ ...f, customerId: cid, customerName: c?.companyName || '' }));
  };

  const handleInvoiceChange = (iid: string) => {
    const inv = invoices.find((x: any) => x.id === iid);
    setForm((f) => ({ ...f, invoiceId: iid, invoiceNumber: inv?.invoiceNumber || '' }));
  };

  const updateItem = (idx: number, field: keyof CreditNoteItem, value: any) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      const it = items[idx];
      const taxable = it.qty * it.rate;
      items[idx].amount = taxable + (taxable * it.taxPercent) / 100;
      return { ...f, items };
    });
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { ...emptyItem(), sNo: f.items.length + 1 }] }));
  const removeItem = (idx: number) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sNo: i + 1 })) }));

  const subTotal = form.items.reduce((s, it) => s + it.qty * it.rate, 0);
  const taxAmount = form.items.reduce((s, it) => s + (it.qty * it.rate * it.taxPercent) / 100, 0);
  const total = subTotal + taxAmount;

  const handleSave = async () => {
    if (!form.customerId) { toast.error('Select a customer'); return; }
    if (!form.reason) { toast.error('Select a reason'); return; }
    if (form.items.some((it) => !it.description.trim())) { toast.error('All items must have a description'); return; }

    setSaving(true);
    try {
      const payload = {
        cnNumber: form.cnNumber,
        customerId: form.customerId,
        customerName: form.customerName,
        invoiceId: form.invoiceId || null,
        invoiceNumber: form.invoiceNumber || null,
        date: form.date,
        reason: form.reason,
        notes: form.notes,
        status: form.status,
        items: form.items,
        subTotal,
        taxAmount,
        total,
      };

      if (editId) {
        await updateRecord('sales/creditNotes', editId, payload);
        toast.success('Credit note updated');
      } else {
        await createRecord('sales/creditNotes', payload);
        toast.success('Credit note created');
      }
      setOpen(false);
      loadAll();
    } catch { toast.error('Failed to save credit note'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, num: string) => {
    if (!confirm(`Delete credit note ${num}?`)) return;
    try {
      await deleteRecord('sales/creditNotes', id);
      toast.success('Credit note deleted');
      loadAll();
    } catch { toast.error('Failed to delete'); }
  };

  const filtered = notes.filter((n) => {
    const s = search.toLowerCase();
    return (
      n.cnNumber?.toLowerCase().includes(s) ||
      n.customerName?.toLowerCase().includes(s) ||
      n.reason?.toLowerCase().includes(s) ||
      n.status?.toLowerCase().includes(s)
    );
  });

  const customerInvoices = invoices.filter((i: any) => i.customerId === form.customerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Credit Notes</h2>
          <p className="text-muted-foreground text-sm">Issue credit notes for returns, overcharges or adjustments</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate('/sales/credit-notes/create')} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            New Credit Note
          </Button>
          <Button variant="outline" onClick={openAdd} size="lg">
            Quick Entry
          </Button>
        </div>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by CN number, customer, reason..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="text-sm text-muted-foreground">{filtered.length} of {notes.length} credit notes</div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CN Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice Ref</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                      {search ? (
                        <>No credit notes matching "{search}"</>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="text-xl">No credit notes yet</div>
                          <p className="text-sm max-w-sm text-center">Issue a credit note when a customer returns goods, an invoice is overcharged, or a discount needs to be applied after invoicing.</p>
                          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Create Credit Note</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((cn) => (
                    <TableRow key={cn.id} className="hover:bg-muted/50">
                      <TableCell><Badge variant="secondary" className="font-mono">{cn.cnNumber}</Badge></TableCell>
                      <TableCell className="font-medium">{cn.customerName}</TableCell>
                      <TableCell className="text-muted-foreground">{cn.invoiceNumber || '—'}</TableCell>
                      <TableCell>{cn.date}</TableCell>
                      <TableCell><Badge variant="outline">{cn.reason}</Badge></TableCell>
                      <TableCell className="text-right font-mono font-semibold text-red-600">
                        ₹{(cn.total || 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[cn.status] || 'secondary'}>{cn.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(cn)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(cn.id, cn.cnNumber)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Credit Note' : 'New Credit Note'} — {form.cnNumber}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Header fields */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Customer *</Label>
                <Select value={form.customerId} onValueChange={handleCustomerChange}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Linked Invoice (optional)</Label>
                <Select value={form.invoiceId} onValueChange={handleInvoiceChange}>
                  <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {customerInvoices.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.invoiceNumber} — ₹{(i.grandTotal || 0).toLocaleString('en-IN')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Reason *</Label>
                <Select value={form.reason} onValueChange={(v) => setForm((f) => ({ ...f, reason: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Applied">Applied</SelectItem>
                    <SelectItem value="Void">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />Add Item
                </Button>
              </div>
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-28">Rate (₹)</TableHead>
                      <TableHead className="w-20">Tax %</TableHead>
                      <TableHead className="w-28 text-right">Amount (₹)</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-muted-foreground text-sm">{item.sNo}</TableCell>
                        <TableCell>
                          <Input value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} placeholder="Item / service description" className="min-w-[160px]" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.qty} onChange={(e) => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)} className="w-20" min={0} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.rate} onChange={(e) => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)} className="w-28" min={0} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={item.taxPercent} onChange={(e) => updateItem(idx, 'taxPercent', parseFloat(e.target.value) || 0)} className="w-20" min={0} max={100} />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {form.items.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-56 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sub Total</span>
                    <span className="font-mono">₹{subTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-mono">₹{taxAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t pt-2 text-red-600">
                    <span>Credit Total</span>
                    <span className="font-mono">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Internal notes or customer message..." rows={2} />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Update' : 'Create Credit Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
