"use client"
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { createRecord, getAllRecords, getRecordById, updateRecord } from "@/services/firebase"

export default function CreateRetainerInvoice() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEditMode = !!id

  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    retainerNumber: "",
    customerId: "",
    customerName: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: "",
    amount: 0,
    description: "",
    notes: "",
    terms: "",
    status: "Draft" as string,
    paidAmount: 0,
    drawnAmount: 0,
    unusedBalance: 0,
    salespersonId: "",
    salespersonName: "",
  })

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (id) loadForEdit(id) }, [id])

  const loadData = async () => {
    try {
      const [cust, existing] = await Promise.all([
        getAllRecords("sales/customers"),
        getAllRecords("sales/retainerInvoices"),
      ])
      setCustomers(cust)
      if (!isEditMode) {
        const count = existing.length + 1
        setForm(prev => ({ ...prev, retainerNumber: `RET-${new Date().getFullYear()}-${String(count).padStart(4, "0")}` }))
      }
    } catch { toast.error("Failed to load data") }
    finally { setLoading(false) }
  }

  const loadForEdit = async (retId: string) => {
    try {
      const ret = await getRecordById("sales/retainerInvoices", retId) as any
      if (!ret) { toast.error("Not found"); navigate("/sales/retainer-invoices"); return }
      setForm({
        retainerNumber: ret.retainerNumber || "",
        customerId: ret.customerId || "",
        customerName: ret.customerName || "",
        date: ret.date || "",
        dueDate: ret.dueDate || "",
        amount: ret.amount || 0,
        description: ret.description || "",
        notes: ret.notes || "",
        terms: ret.terms || "",
        status: ret.status || "Draft",
        paidAmount: ret.paidAmount || 0,
        drawnAmount: ret.drawnAmount || 0,
        unusedBalance: ret.unusedBalance || 0,
        salespersonId: ret.salespersonId || "",
        salespersonName: ret.salespersonName || "",
      })
    } catch { toast.error("Failed to load") }
  }

  const handleCustomerChange = (custId: string) => {
    const cust = customers.find(c => c.id === custId)
    setForm(prev => ({ ...prev, customerId: custId, customerName: cust?.companyName || "" }))
  }

  const handleSave = async () => {
    if (!form.customerId) { toast.error("Select a customer"); return }
    if (!form.amount || form.amount <= 0) { toast.error("Enter valid amount"); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        unusedBalance: form.amount - form.drawnAmount,
      }

      if (isEditMode) {
        await updateRecord("sales/retainerInvoices", id!, payload)
        toast.success("Retainer invoice updated")
      } else {
        await createRecord("sales/retainerInvoices", payload)
        toast.success("Retainer invoice created")
      }
      navigate("/sales/retainer-invoices")
    } catch { toast.error("Failed to save") }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-10 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-900">
            {isEditMode ? "Edit Retainer Invoice" : "New Retainer Invoice"}
          </h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/sales/retainer-invoices")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
              {saving ? "Saving..." : isEditMode ? "Update" : "Create"} Retainer
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Retainer Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Retainer Number</Label>
                <Input value={form.retainerNumber} onChange={e => setForm(p => ({ ...p, retainerNumber: e.target.value }))} />
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
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
              </div>
              <div>
                <Label>Amount *</Label>
                <Input type="number" value={form.amount || ""} onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))} min={0} step={0.01} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Sent">Sent</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                    <SelectItem value="Drawn">Drawn</SelectItem>
                    <SelectItem value="Partially Drawn">Partially Drawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Description & Notes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe what this retainer is for..." />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
              <div>
                <Label>Terms & Conditions</Label>
                <Textarea value={form.terms} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))} rows={2} />
              </div>
            </CardContent>
          </Card>

          {isEditMode && (
            <Card>
              <CardHeader><CardTitle>Balance Summary</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-muted-foreground">Paid Amount</div>
                  <div className="text-xl font-bold text-green-600">₹{form.paidAmount.toLocaleString("en-IN")}</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-sm text-muted-foreground">Drawn Amount</div>
                  <div className="text-xl font-bold text-purple-600">₹{form.drawnAmount.toLocaleString("en-IN")}</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-muted-foreground">Unused Balance</div>
                  <div className="text-xl font-bold text-blue-600">₹{(form.amount - form.drawnAmount).toLocaleString("en-IN")}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
