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
  description: string;
  qty: number;
  uom: string;
  rate: number;
  taxPercent: number;
  amount: number;
}

const emptyLine = (): LineItem => ({
  sNo: 1, itemName: '', description: '', qty: 1, uom: 'Nos', rate: 0, taxPercent: 18, amount: 0,
});

export default function CreatePurchaseOrder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [vendors, setVendors] = useState<{ id: string; companyName: string }[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Sent' | 'Received' | 'Cancelled'>('Draft');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [poNumber, setPoNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllRecords('contacts/vendors').then((data) => setVendors(data));
    if (isEdit) {
      getRecordById('purchases/purchaseOrders', id!).then((data) => {
        if (data) {
          setPoNumber(data.poNumber || '');
          setVendorId(data.vendorId || '');
          setVendorName(data.vendorName || '');
          setDate(data.date || '');
          setExpectedDate(data.expectedDate || '');
          setStatus(data.status || 'Draft');
          setNotes(data.notes || '');
          setItems(data.items?.length ? data.items : [emptyLine()]);
        }
      });
    } else {
      generatePONumber();
    }
  }, [id]);

  const generatePONumber = async () => {
    const existing = await getAllRecords('purchases/purchaseOrders').catch(() => []);
    const n = existing.length + 1;
    setPoNumber(`PO-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`);
  };

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      const item = updated[idx];
      const taxableAmt = item.qty * item.rate;
      updated[idx].amount = taxableAmt + (taxableAmt * item.taxPercent) / 100;
      return updated;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...emptyLine(), sNo: prev.length + 1 }]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sNo: i + 1 })));
  };

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
    if (items.some((it) => !it.itemName.trim())) { toast.error('All items must have a name'); return; }

    setSaving(true);
    try {
      const payload = {
        poNumber,
        vendorId,
        vendorName,
        date,
        expectedDate,
        items,
        subTotal,
        taxAmount,
        total,
        notes,
        status,
      };
      if (isEdit) {
        await updateRecord('purchases/purchaseOrders', id!, payload);
        toast.success('Purchase order updated');
      } else {
        await createRecord('purchases/purchaseOrders', payload);
        toast.success('Purchase order created');
      }
      navigate('/purchases/orders');
    } catch { toast.error('Failed to save purchase order'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/purchases/orders"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}</h1>
          <p className="text-muted-foreground text-sm">{poNumber}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>PO Number</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
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
              <Label>Status</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Draft','Sent','Received','Cancelled'].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Order Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Expected Delivery Date</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
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
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-20">UOM</TableHead>
                    <TableHead className="w-28">Rate (₹)</TableHead>
                    <TableHead className="w-20">Tax %</TableHead>
                    <TableHead className="w-28 text-right">Amount (₹)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground text-sm">{item.sNo}</TableCell>
                      <TableCell>
                        <Input
                          value={item.itemName}
                          onChange={(e) => updateItem(idx, 'itemName', e.target.value)}
                          placeholder="Item name"
                          className="min-w-[160px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateItem(idx, 'qty', parseFloat(e.target.value) || 0)}
                          min={0}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.uom}
                          onChange={(e) => updateItem(idx, 'uom', e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                          min={0}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.taxPercent}
                          onChange={(e) => updateItem(idx, 'taxPercent', parseFloat(e.target.value) || 0)}
                          min={0}
                          max={100}
                          className="w-20"
                        />
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

            {/* Totals */}
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

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={3} />
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" asChild>
            <Link to="/purchases/orders">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update PO' : 'Create PO'}
          </Button>
        </div>
      </form>
    </div>
  );
}
