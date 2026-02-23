import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { createRecord, updateRecord, getRecordById, getAllRecords } from '@/services/firebase';

interface LineItem {
  sNo: number;
  itemName: string;
  qty: number;
  uom: string;
  rate: number;
  taxPercent: number;
  amount: number;
}

const emptyLine = (): LineItem => ({
  sNo: 1, itemName: '', qty: 1, uom: 'Nos', rate: 0, taxPercent: 18, amount: 0,
});

export default function CreateBill() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [vendors, setVendors] = useState<{ id: string; companyName: string }[]>([]);
  const [pos, setPos] = useState<{ id: string; poNumber: string }[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [poId, setPoId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'Unpaid' | 'Partial' | 'Paid'>('Unpaid');
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllRecords('contacts/vendors').then((data) => setVendors(data));
    getAllRecords('purchases/purchaseOrders').then((data) => setPos(data));
    if (isEdit) {
      getRecordById('purchases/bills', id!).then((data) => {
        if (data) {
          setBillNumber(data.billNumber || '');
          setVendorId(data.vendorId || '');
          setVendorName(data.vendorName || '');
          setPoId(data.poId || '');
          setBillDate(data.billDate || '');
          setDueDate(data.dueDate || '');
          setPaymentStatus(data.paymentStatus || 'Unpaid');
          setPaidAmount(data.paidAmount || 0);
          setNotes(data.notes || '');
          setItems(data.items?.length ? data.items : [emptyLine()]);
        }
      });
    } else {
      generateBillNumber();
    }
  }, [id]);

  const generateBillNumber = async () => {
    const existing = await getAllRecords('purchases/bills').catch(() => []);
    const n = existing.length + 1;
    setBillNumber(`BILL-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`);
  };

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      const item = updated[idx];
      const taxable = item.qty * item.rate;
      updated[idx].amount = taxable + (taxable * item.taxPercent) / 100;
      return updated;
    });
  };

  const addItem = () => setItems((prev) => [...prev, { ...emptyLine(), sNo: prev.length + 1 }]);
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sNo: i + 1 })));

  const subTotal = items.reduce((s, it) => s + it.qty * it.rate, 0);
  const taxAmount = items.reduce((s, it) => s + (it.qty * it.rate * it.taxPercent) / 100, 0);
  const total = subTotal + taxAmount;

  const handleVendorChange = (vid: string) => {
    const v = vendors.find((x) => x.id === vid);
    setVendorId(vid);
    setVendorName(v?.companyName || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) { toast.error('Please select a vendor'); return; }

    setSaving(true);
    try {
      const status = paidAmount >= total ? 'Paid' : paidAmount > 0 ? 'Partially Paid' : 'Open';
      const payload = {
        billNumber,
        vendorId,
        vendorName,
        poId: poId || null,
        billDate,
        dueDate,
        items,
        subTotal,
        taxAmount,
        total,
        notes,
        status,
        paymentStatus,
        paidAmount,
      };

      if (isEdit) {
        await updateRecord('purchases/bills', id!, payload);
        toast.success('Bill updated');
      } else {
        await createRecord('purchases/bills', payload);
        toast.success('Bill created');
      }
      navigate('/purchases/bills');
    } catch { toast.error('Failed to save bill'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/purchases/bills"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Bill' : 'New Bill'}</h1>
          <p className="text-muted-foreground text-sm">{billNumber}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Bill Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Bill Number</Label>
              <Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Vendor *</Label>
              <Select value={vendorId} onValueChange={handleVendorChange}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Linked PO (optional)</Label>
              <Select value={poId} onValueChange={setPoId}>
                <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {pos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.poNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Bill Date</Label>
              <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={(v: any) => setPaymentStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Unpaid','Partial','Paid'].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {paymentStatus === 'Partial' && (
              <div className="space-y-1">
                <Label>Paid Amount (₹)</Label>
                <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)} min={0} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" />Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Rate (₹)</TableHead>
                    <TableHead>Tax %</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground text-sm">{item.sNo}</TableCell>
                      <TableCell>
                        <Input value={item.itemName} onChange={(e) => updateItem(idx, 'itemName', e.target.value)} placeholder="Item name" className="min-w-[140px]" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.qty} onChange={(e) => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)} className="w-20" />
                      </TableCell>
                      <TableCell>
                        <Input value={item.uom} onChange={(e) => updateItem(idx, 'uom', e.target.value)} className="w-20" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.rate} onChange={(e) => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)} className="w-28" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.taxPercent} onChange={(e) => updateItem(idx, 'taxPercent', parseFloat(e.target.value) || 0)} className="w-20" />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {items.length > 1 && (
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
            <div className="flex justify-end p-4">
              <div className="w-60 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sub Total</span>
                  <span className="font-mono">₹{subTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-mono">₹{taxAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>Total</span>
                  <span className="font-mono">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={3} />
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" asChild>
            <Link to="/purchases/bills">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Bill' : 'Create Bill'}
          </Button>
        </div>
      </form>
    </div>
  );
}
