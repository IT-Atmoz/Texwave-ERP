"use client"
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { createRecord, getAllRecords, getRecordById, updateRecord } from "@/services/firebase"

const paymentModes = ["Cash", "Bank Transfer", "Cheque", "UPI", "NEFT", "RTGS", "IMPS", "Credit Card"]

interface InvoiceRow {
  invoiceId: string
  invoiceNumber: string
  invoiceDate: string
  total: number
  paidAmount: number
  balance: number
  allocatedAmount: number
}

export default function CreatePaymentReceived() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEditMode = !!id

  const [customers, setCustomers] = useState<any[]>([])
  const [allInvoices, setAllInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    paymentNumber: "",
    customerId: "",
    customerName: "",
    paymentDate: new Date().toISOString().split("T")[0],
    amount: 0,
    mode: "Bank Transfer",
    reference: "",
    notes: "",
    bankCharges: 0,
  })

  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([])

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (id) loadForEdit(id) }, [id])

  const loadData = async () => {
    try {
      const [cust, inv, payments] = await Promise.all([
        getAllRecords("sales/customers"),
        getAllRecords("sales/invoices"),
        getAllRecords("sales/paymentsReceived"),
      ])
      setCustomers(cust)
      setAllInvoices(inv)
      if (!isEditMode) {
        const count = payments.length + 1
        setForm(prev => ({ ...prev, paymentNumber: `RCPT-${new Date().getFullYear()}-${String(count).padStart(4, "0")}` }))
      }
    } catch { toast.error("Failed to load data") }
    finally { setLoading(false) }
  }

  const loadForEdit = async (payId: string) => {
    try {
      const payment = await getRecordById("sales/paymentsReceived", payId) as any
      if (!payment) { toast.error("Payment not found"); navigate("/sales/payments-received"); return }
      setForm({
        paymentNumber: payment.paymentNumber || "",
        customerId: payment.customerId || "",
        customerName: payment.customerName || "",
        paymentDate: payment.paymentDate || "",
        amount: payment.amount || 0,
        mode: payment.mode || "Bank Transfer",
        reference: payment.reference || "",
        notes: payment.notes || "",
        bankCharges: payment.bankCharges || 0,
      })
      if (payment.invoiceAllocations) {
        setInvoiceRows(payment.invoiceAllocations.map((a: any) => ({
          invoiceId: a.invoiceId,
          invoiceNumber: a.invoiceNumber,
          invoiceDate: "",
          total: a.invoiceTotal || 0,
          paidAmount: 0,
          balance: a.invoiceBalance || 0,
          allocatedAmount: a.allocatedAmount || 0,
        })))
      }
    } catch { toast.error("Failed to load payment") }
  }

  const handleCustomerChange = (custId: string) => {
    const cust = customers.find(c => c.id === custId)
    setForm(prev => ({ ...prev, customerId: custId, customerName: cust?.companyName || "" }))

    const customerInvoices = allInvoices.filter((inv: any) =>
      inv.customerId === custId && ["Unpaid", "Partial", "Draft", "Final", "Overdue", "Partially Paid"].includes(inv.paymentStatus)
    )
    setInvoiceRows(customerInvoices.map((inv: any) => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber || "",
      invoiceDate: inv.invoiceDate || "",
      total: inv.grandTotal || 0,
      paidAmount: inv.paidAmount || 0,
      balance: Math.max(0, (inv.grandTotal || 0) - (inv.paidAmount || 0)),
      allocatedAmount: 0,
    })))
  }

  const updateAllocation = (idx: number, amount: number) => {
    setInvoiceRows(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], allocatedAmount: Math.min(amount, updated[idx].balance) }
      return updated
    })
  }

  const totalAllocated = invoiceRows.reduce((sum, r) => sum + (r.allocatedAmount || 0), 0)
  const excessAmount = Math.max(0, form.amount - totalAllocated - (form.bankCharges || 0))

  const handleSave = async () => {
    if (!form.customerId) { toast.error("Select a customer"); return }
    if (!form.amount || form.amount <= 0) { toast.error("Enter valid amount"); return }

    setSaving(true)
    try {
      const allocations = invoiceRows.filter(r => r.allocatedAmount > 0).map(r => ({
        invoiceId: r.invoiceId,
        invoiceNumber: r.invoiceNumber,
        allocatedAmount: r.allocatedAmount,
        invoiceTotal: r.total,
        invoiceBalance: r.balance,
      }))

      const payload = {
        paymentNumber: form.paymentNumber,
        customerId: form.customerId,
        customerName: form.customerName,
        paymentDate: form.paymentDate,
        amount: form.amount,
        mode: form.mode,
        reference: form.reference,
        notes: form.notes,
        bankCharges: form.bankCharges,
        invoiceAllocations: allocations,
        excessAmount,
      }

      if (isEditMode) {
        await updateRecord("sales/paymentsReceived", id!, payload)
      } else {
        await createRecord("sales/paymentsReceived", payload)
      }

      // Update invoice paid amounts
      for (const alloc of allocations) {
        const inv = allInvoices.find(i => i.id === alloc.invoiceId) as any
        if (inv) {
          const newPaidAmount = (inv.paidAmount || 0) + alloc.allocatedAmount
          const newStatus = newPaidAmount >= (inv.grandTotal || 0) ? "Paid" : "Partial"
          await updateRecord("sales/invoices", alloc.invoiceId, {
            paidAmount: newPaidAmount,
            paymentStatus: newStatus,
          })
        }
      }

      toast.success(isEditMode ? "Payment updated" : "Payment recorded")
      navigate("/sales/payments-received")
    } catch { toast.error("Failed to save") }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-10 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-900">
            {isEditMode ? "Edit Payment" : "Record Payment"}
          </h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/sales/payments-received")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
              {saving ? "Saving..." : isEditMode ? "Update" : "Record"} Payment
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Payment Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Payment Number</Label>
                <Input value={form.paymentNumber} onChange={e => setForm(p => ({ ...p, paymentNumber: e.target.value }))} />
              </div>
              <div>
                <Label>Customer *</Label>
                <Select value={form.customerId} onValueChange={handleCustomerChange}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Date</Label>
                <Input type="date" value={form.paymentDate} onChange={e => setForm(p => ({ ...p, paymentDate: e.target.value }))} />
              </div>
              <div>
                <Label>Amount *</Label>
                <Input type="number" value={form.amount || ""} onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))} min={0} step={0.01} />
              </div>
              <div>
                <Label>Payment Mode</Label>
                <Select value={form.mode} onValueChange={v => setForm(p => ({ ...p, mode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentModes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference</Label>
                <Input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="UTR / Cheque no." />
              </div>
              <div>
                <Label>Bank Charges</Label>
                <Input type="number" value={form.bankCharges || ""} onChange={e => setForm(p => ({ ...p, bankCharges: Number(e.target.value) }))} min={0} step={0.01} />
              </div>
            </CardContent>
          </Card>

          {form.customerId && invoiceRows.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Allocate to Invoices</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Allocate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceRows.map((row, idx) => (
                      <TableRow key={row.invoiceId}>
                        <TableCell className="font-mono font-semibold">{row.invoiceNumber}</TableCell>
                        <TableCell>{row.invoiceDate}</TableCell>
                        <TableCell className="text-right">₹{row.total.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">₹{row.paidAmount.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right font-semibold text-orange-600">₹{row.balance.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={row.allocatedAmount || ""}
                            onChange={e => updateAllocation(idx, Number(e.target.value))}
                            className="w-28 text-right"
                            min={0}
                            max={row.balance}
                            step={0.01}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-end mt-4 space-x-6 text-sm">
                  <div>Total Allocated: <strong className="text-green-600">₹{totalAllocated.toLocaleString("en-IN")}</strong></div>
                  <div>Excess: <strong className="text-blue-600">₹{excessAmount.toLocaleString("en-IN")}</strong></div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Internal notes..." />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
