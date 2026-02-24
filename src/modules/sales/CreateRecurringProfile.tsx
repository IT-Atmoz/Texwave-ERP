"use client"
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createRecord, getAllRecords, getRecordById, updateRecord } from "@/services/firebase"

interface LineItem {
  sNo: number
  description: string
  qty: number
  rate: number
  amount: number
}

export default function CreateRecurringProfile() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEditMode = !!id

  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    profileName: "",
    customerId: "",
    customerName: "",
    frequency: "monthly" as string,
    customIntervalDays: 30,
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    nextInvoiceDate: new Date().toISOString().split("T")[0],
    paymentTerms: "30 Days",
    notes: "",
    terms: "",
    status: "Active" as string,
    salespersonId: "",
    salespersonName: "",
  })

  const [lineItems, setLineItems] = useState<LineItem[]>([{ sNo: 1, description: "", qty: 1, rate: 0, amount: 0 }])

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (id) loadForEdit(id) }, [id])

  const loadData = async () => {
    try {
      const cust = await getAllRecords("sales/customers")
      setCustomers(cust)
    } catch { toast.error("Failed to load data") }
    finally { setLoading(false) }
  }

  const loadForEdit = async (profileId: string) => {
    try {
      const profile = await getRecordById("sales/recurringInvoiceProfiles", profileId) as any
      if (!profile) { toast.error("Not found"); navigate("/sales/recurring-invoices"); return }
      setForm({
        profileName: profile.profileName || "",
        customerId: profile.customerId || "",
        customerName: profile.customerName || "",
        frequency: profile.frequency || "monthly",
        customIntervalDays: profile.customIntervalDays || 30,
        startDate: profile.startDate || "",
        endDate: profile.endDate || "",
        nextInvoiceDate: profile.nextInvoiceDate || "",
        paymentTerms: profile.paymentTerms || "30 Days",
        notes: profile.notes || "",
        terms: profile.terms || "",
        status: profile.status || "Active",
        salespersonId: profile.salespersonId || "",
        salespersonName: profile.salespersonName || "",
      })
      if (profile.lineItems?.length) {
        setLineItems(profile.lineItems.map((item: any, idx: number) => ({
          sNo: idx + 1,
          description: item.description || "",
          qty: item.qty || 1,
          rate: item.rate || 0,
          amount: (item.qty || 1) * (item.rate || 0),
        })))
      }
    } catch { toast.error("Failed to load profile") }
  }

  const handleCustomerChange = (custId: string) => {
    const cust = customers.find(c => c.id === custId)
    setForm(prev => ({ ...prev, customerId: custId, customerName: cust?.companyName || "" }))
  }

  const addLineItem = () => {
    setLineItems(prev => [...prev, { sNo: prev.length + 1, description: "", qty: 1, rate: 0, amount: 0 }])
  }

  const updateLineItem = (idx: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      updated[idx].amount = (updated[idx].qty || 0) * (updated[idx].rate || 0)
      return updated
    })
  }

  const removeLineItem = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, sNo: i + 1 })))
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)

  const handleSave = async () => {
    if (!form.profileName.trim()) { toast.error("Enter a profile name"); return }
    if (!form.customerId) { toast.error("Select a customer"); return }
    if (lineItems.some(it => !it.description.trim())) { toast.error("All items need descriptions"); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        lineItems,
        subtotal,
        taxAmount: 0,
        grandTotal: subtotal,
      }

      if (isEditMode) {
        await updateRecord("sales/recurringInvoiceProfiles", id!, payload)
        toast.success("Profile updated")
      } else {
        await createRecord("sales/recurringInvoiceProfiles", payload)
        toast.success("Recurring profile created")
      }
      navigate("/sales/recurring-invoices")
    } catch { toast.error("Failed to save") }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-10 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-900">
            {isEditMode ? "Edit Recurring Profile" : "New Recurring Invoice Profile"}
          </h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/sales/recurring-invoices")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
              {saving ? "Saving..." : isEditMode ? "Update" : "Create"} Profile
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Profile Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Profile Name *</Label>
                <Input value={form.profileName} onChange={e => setForm(p => ({ ...p, profileName: e.target.value }))} placeholder="e.g. Monthly AMC" />
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
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm(p => ({ ...p, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="half-yearly">Half-Yearly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.frequency === "custom" && (
                <div>
                  <Label>Interval (days)</Label>
                  <Input type="number" value={form.customIntervalDays} onChange={e => setForm(p => ({ ...p, customIntervalDays: Number(e.target.value) }))} min={1} />
                </div>
              )}
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value, nextInvoiceDate: e.target.value }))} />
              </div>
              <div>
                <Label>End Date (optional)</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Input value={form.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                    <SelectItem value="Stopped">Stopped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Line Items</CardTitle>
                <Button size="sm" onClick={addLineItem}><Plus className="h-4 w-4 mr-2" />Add Item</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {lineItems.map((item, i) => (
                <div key={i} className="border rounded-lg p-3 bg-gray-50 grid grid-cols-5 gap-3 items-end">
                  <div className="col-span-2">
                    <Label>Description</Label>
                    <Input value={item.description} onChange={e => updateLineItem(i, "description", e.target.value)} />
                  </div>
                  <div>
                    <Label>Qty</Label>
                    <Input type="number" value={item.qty} onChange={e => updateLineItem(i, "qty", Number(e.target.value))} min={0} />
                  </div>
                  <div>
                    <Label>Rate</Label>
                    <Input type="number" value={item.rate} onChange={e => updateLineItem(i, "rate", Number(e.target.value))} min={0} step={0.01} />
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="font-bold text-blue-700">₹{item.amount.toLocaleString("en-IN")}</span>
                    {lineItems.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => removeLineItem(i)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="text-right text-lg font-bold pt-3 border-t">
                Total per Invoice: ₹{subtotal.toLocaleString("en-IN")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
              <div>
                <Label>Terms</Label>
                <Textarea value={form.terms} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))} rows={2} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
