"use client"
import { useState, useEffect } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createRecord, getAllRecords, getRecordById, updateRecord } from "@/services/firebase"
import { invoiceToCreditNote } from "./utils/documentConversion"

const REASONS = ["Goods Returned", "Invoice Overcharge", "Damaged Goods", "Quality Issue", "Discount Applied", "Other"]

interface CreditNoteItem {
  sNo: number
  description: string
  qty: number
  rate: number
  taxPercent: number
  amount: number
}

export default function CreateCreditNote() {
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const fromInvoice = searchParams.get("fromInvoice")
  const navigate = useNavigate()
  const isEditMode = !!id

  const [customers, setCustomers] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    cnNumber: "",
    customerId: "",
    customerName: "",
    invoiceId: "",
    invoiceNumber: "",
    date: new Date().toISOString().split("T")[0],
    reason: "",
    notes: "",
    status: "Open" as string,
  })

  const [items, setItems] = useState<CreditNoteItem[]>([{ sNo: 1, description: "", qty: 1, rate: 0, taxPercent: 18, amount: 0 }])

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (fromInvoice) loadFromInvoice(fromInvoice) }, [fromInvoice, invoices])
  useEffect(() => { if (id) loadForEdit(id) }, [id])

  const loadData = async () => {
    try {
      const [cust, inv, cn] = await Promise.all([
        getAllRecords("sales/customers"),
        getAllRecords("sales/invoices"),
        getAllRecords("sales/creditNotes"),
      ])
      setCustomers(cust)
      setInvoices(inv)
      if (!isEditMode) {
        const count = cn.length + 1
        setForm(prev => ({ ...prev, cnNumber: `CN-${new Date().getFullYear()}-${String(count).padStart(4, "0")}` }))
      }
    } catch { toast.error("Failed to load data") }
    finally { setLoading(false) }
  }

  const loadFromInvoice = (invId: string) => {
    const invoice = invoices.find(i => i.id === invId)
    if (!invoice) return
    const mapped = invoiceToCreditNote(invoice)
    setForm(prev => ({
      ...prev,
      customerId: mapped.customerId,
      customerName: mapped.customerName,
      invoiceId: mapped.invoiceId,
      invoiceNumber: mapped.invoiceNumber,
    }))
    if (mapped.items?.length) setItems(mapped.items)
  }

  const loadForEdit = async (cnId: string) => {
    try {
      const cn = await getRecordById("sales/creditNotes", cnId) as any
      if (!cn) { toast.error("Credit note not found"); navigate("/sales/credit-notes"); return }
      setForm({
        cnNumber: cn.cnNumber || "",
        customerId: cn.customerId || "",
        customerName: cn.customerName || "",
        invoiceId: cn.invoiceId || "",
        invoiceNumber: cn.invoiceNumber || "",
        date: cn.date || "",
        reason: cn.reason || "",
        notes: cn.notes || "",
        status: cn.status || "Open",
      })
      setItems(cn.items?.length ? cn.items : [{ sNo: 1, description: "", qty: 1, rate: 0, taxPercent: 18, amount: 0 }])
    } catch { toast.error("Failed to load credit note") }
  }

  const handleCustomerChange = (custId: string) => {
    const cust = customers.find(c => c.id === custId)
    setForm(prev => ({ ...prev, customerId: custId, customerName: cust?.companyName || "" }))
  }

  const handleInvoiceChange = (invId: string) => {
    const inv = invoices.find(i => i.id === invId)
    setForm(prev => ({ ...prev, invoiceId: invId, invoiceNumber: inv?.invoiceNumber || "" }))
  }

  const updateItem = (idx: number, field: keyof CreditNoteItem, value: any) => {
    setItems(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      const it = updated[idx]
      const taxable = it.qty * it.rate
      updated[idx].amount = taxable + (taxable * it.taxPercent) / 100
      return updated
    })
  }

  const addItem = () => setItems(prev => [...prev, { sNo: prev.length + 1, description: "", qty: 1, rate: 0, taxPercent: 18, amount: 0 }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sNo: i + 1 })))

  const subTotal = items.reduce((s, it) => s + it.qty * it.rate, 0)
  const taxAmount = items.reduce((s, it) => s + (it.qty * it.rate * it.taxPercent) / 100, 0)
  const total = subTotal + taxAmount

  const handleSave = async () => {
    if (!form.customerId) { toast.error("Select a customer"); return }
    if (!form.reason) { toast.error("Select a reason"); return }
    if (items.some(it => !it.description.trim())) { toast.error("All items must have descriptions"); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        items,
        subTotal,
        taxAmount,
        total,
        balanceAmount: total,
      }

      if (isEditMode) {
        await updateRecord("sales/creditNotes", id!, payload)
        toast.success("Credit note updated")
      } else {
        await createRecord("sales/creditNotes", payload)
        toast.success("Credit note created")
      }
      navigate("/sales/credit-notes")
    } catch { toast.error("Failed to save") }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-10 text-center">Loading...</div>

  const customerInvoices = invoices.filter((i: any) => i.customerId === form.customerId)

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-900">
            {isEditMode ? "Edit Credit Note" : "New Credit Note"} {form.cnNumber && `- ${form.cnNumber}`}
          </h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/sales/credit-notes")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
              {saving ? "Saving..." : isEditMode ? "Update" : "Create"} Credit Note
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Credit Note Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>CN Number</Label>
                <Input value={form.cnNumber} onChange={e => setForm(p => ({ ...p, cnNumber: e.target.value }))} />
              </div>
              <div>
                <Label>Customer *</Label>
                <Select value={form.customerId} onValueChange={handleCustomerChange}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Linked Invoice</Label>
                <Select value={form.invoiceId} onValueChange={handleInvoiceChange}>
                  <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {customerInvoices.map((i: any) => (
                      <SelectItem key={i.id} value={i.id}>{i.invoiceNumber} - ₹{(i.grandTotal || 0).toLocaleString("en-IN")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <Label>Reason *</Label>
                <Select value={form.reason} onValueChange={v => setForm(p => ({ ...p, reason: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Applied">Applied</SelectItem>
                    <SelectItem value="Partially Applied">Partially Applied</SelectItem>
                    <SelectItem value="Void">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Items</CardTitle>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-1" />Add Item</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-28">Rate</TableHead>
                    <TableHead className="w-20">Tax %</TableHead>
                    <TableHead className="w-28 text-right">Amount</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.sNo}</TableCell>
                      <TableCell>
                        <Input value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="Description" className="min-w-[160px]" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.qty} onChange={e => updateItem(idx, "qty", Number(e.target.value))} className="w-20" min={0} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", Number(e.target.value))} className="w-28" min={0} step={0.01} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.taxPercent} onChange={e => updateItem(idx, "taxPercent", Number(e.target.value))} className="w-20" min={0} max={100} />
                      </TableCell>
                      <TableCell className="text-right font-mono">₹{item.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        {items.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end mt-4">
                <div className="w-56 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span>Sub Total</span><span className="font-mono">₹{subTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span>Tax</span><span className="font-mono">₹{taxAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between font-bold text-base border-t pt-2 text-red-600"><span>Credit Total</span><span className="font-mono">₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Internal notes..." />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
