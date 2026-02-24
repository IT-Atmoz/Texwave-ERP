"use client"
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, Trash2, Info } from "lucide-react"
import { toast } from "sonner"
import { createRecord, getAllRecords, getRecordById, updateRecord } from "@/services/firebase"
import { salesOrderToDC } from "./utils/documentConversion"

interface DCLineItem {
  sNo: number
  productCode: string
  description: string
  hsnCode: string
  qty: number
  uom: string
}

export default function CreateDeliveryChallan() {
  const { id, orderId } = useParams<{ id?: string; orderId?: string }>()
  const navigate = useNavigate()
  const isEditMode = !!id

  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    dcNumber: `DC-${new Date().getFullYear().toString().slice(-2)}-${String(Date.now()).slice(-5)}`,
    dcDate: new Date().toISOString().split("T")[0],
    customerId: "",
    customerName: "",
    customerGST: "",
    challanType: "Delivery" as string,
    vehicleNo: "",
    transporterName: "",
    placeOfSupply: "Tamil Nadu",
    salesOrderId: "",
    salesOrderNumber: "",
    status: "Draft" as string,
    terms: "",
    remarks: "",
    salespersonId: "",
    salespersonName: "",
  })

  const [lineItems, setLineItems] = useState<DCLineItem[]>([])

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (orderId && !isEditMode) loadFromOrder(orderId)
  }, [orderId])

  useEffect(() => {
    if (id) loadForEdit(id)
  }, [id, customers])

  const loadData = async () => {
    try {
      const cust = await getAllRecords("sales/customers")
      setCustomers(cust)
    } catch { toast.error("Failed to load data") }
    finally { setLoading(false) }
  }

  const loadFromOrder = async (oId: string) => {
    try {
      const order = await getRecordById("sales/orderAcknowledgements", oId) as any
      if (!order) { toast.error("Order not found"); return }
      const mapped = salesOrderToDC(order)
      setForm(prev => ({
        ...prev,
        customerId: mapped.customerId,
        customerName: mapped.customerName,
        customerGST: mapped.customerGST,
        salesOrderId: order.id,
        salesOrderNumber: order.soNumber,
        salespersonId: mapped.salespersonId,
        salespersonName: mapped.salespersonName,
      }))
      setLineItems(mapped.lineItems)
    } catch { toast.error("Failed to load order") }
  }

  const loadForEdit = async (dcId: string) => {
    try {
      const dc = await getRecordById("sales/deliveryChallans", dcId) as any
      if (!dc) { toast.error("DC not found"); navigate("/sales/delivery-challans"); return }
      setForm({
        dcNumber: dc.dcNumber || "",
        dcDate: dc.dcDate || "",
        customerId: dc.customerId || "",
        customerName: dc.customerName || "",
        customerGST: dc.customerGST || "",
        challanType: dc.challanType || "Delivery",
        vehicleNo: dc.vehicleNo || "",
        transporterName: dc.transporterName || "",
        placeOfSupply: dc.placeOfSupply || "Tamil Nadu",
        salesOrderId: dc.salesOrderId || "",
        salesOrderNumber: dc.salesOrderNumber || "",
        status: dc.status || "Draft",
        terms: dc.terms || "",
        remarks: dc.remarks || "",
        salespersonId: dc.salespersonId || "",
        salespersonName: dc.salespersonName || "",
      })
      setLineItems((dc.lineItems || []).map((item: any, idx: number) => ({
        sNo: idx + 1,
        productCode: item.productCode || "",
        description: item.description || "",
        hsnCode: item.hsnCode || "",
        qty: item.qty || 0,
        uom: item.uom || "Nos",
      })))
    } catch { toast.error("Failed to load DC") }
  }

  const handleCustomerChange = (custId: string) => {
    const cust = customers.find(c => c.id === custId)
    if (!cust) return
    setForm(prev => ({
      ...prev,
      customerId: custId,
      customerName: cust.companyName || "",
      customerGST: cust.gst || "",
    }))
  }

  const addLineItem = () => {
    setLineItems(prev => [...prev, { sNo: prev.length + 1, productCode: "", description: "", hsnCode: "", qty: 1, uom: "Nos" }])
  }

  const updateLineItem = (idx: number, field: keyof DCLineItem, value: any) => {
    setLineItems(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      return updated
    })
  }

  const removeLineItem = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, sNo: i + 1 })))
  }

  const totalQty = lineItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)

  const handleSave = async () => {
    if (!form.customerId) { toast.error("Select a customer"); return }
    if (lineItems.length === 0) { toast.error("Add at least one item"); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        lineItems,
        totalQty,
        subtotal: 0,
        taxAmount: 0,
        grandTotal: 0,
      }

      if (isEditMode) {
        await updateRecord("sales/deliveryChallans", id!, payload)
        toast.success("Delivery Challan updated")
      } else {
        await createRecord("sales/deliveryChallans", payload)
        if (form.salesOrderId) {
          const order = await getRecordById("sales/orderAcknowledgements", form.salesOrderId) as any
          const existingDCIds = order?.convertedToDCIds || []
          await updateRecord("sales/orderAcknowledgements", form.salesOrderId, {
            convertedToDCIds: [...existingDCIds, "new"],
            shippedStatus: "Partially Shipped",
          })
        }
        toast.success("Delivery Challan created")
      }
      navigate("/sales/delivery-challans")
    } catch { toast.error("Failed to save") }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-10 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">
              {isEditMode ? "Edit Delivery Challan" : "Create Delivery Challan"}
            </h1>
            {form.salesOrderNumber && (
              <div className="flex items-center gap-2 mt-2">
                <Info className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-blue-700">From Sales Order <strong>{form.salesOrderNumber}</strong></span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/sales/delivery-challans")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
              {saving ? "Saving..." : isEditMode ? "Update" : "Save"} DC
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Challan Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>DC Number</Label>
                <Input value={form.dcNumber} onChange={e => setForm(p => ({ ...p, dcNumber: e.target.value }))} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.dcDate} onChange={e => setForm(p => ({ ...p, dcDate: e.target.value }))} />
              </div>
              <div>
                <Label>Challan Type</Label>
                <Select value={form.challanType} onValueChange={v => setForm(p => ({ ...p, challanType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Supply">Supply</SelectItem>
                    <SelectItem value="Job Work">Job Work</SelectItem>
                    <SelectItem value="Delivery">Delivery</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                    <SelectItem value="Returned">Returned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vehicle No</Label>
                <Input value={form.vehicleNo} onChange={e => setForm(p => ({ ...p, vehicleNo: e.target.value }))} />
              </div>
              <div>
                <Label>Transporter</Label>
                <Input value={form.transporterName} onChange={e => setForm(p => ({ ...p, transporterName: e.target.value }))} />
              </div>
              <div>
                <Label>Place of Supply</Label>
                <Input value={form.placeOfSupply} onChange={e => setForm(p => ({ ...p, placeOfSupply: e.target.value }))} />
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
                <div key={i} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-gray-50">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                    <div>
                      <Label>Product Code</Label>
                      <Input value={item.productCode} onChange={e => updateLineItem(i, "productCode", e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <Label>Description</Label>
                      <Input value={item.description} onChange={e => updateLineItem(i, "description", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>HSN</Label>
                        <Input value={item.hsnCode} onChange={e => updateLineItem(i, "hsnCode", e.target.value)} />
                      </div>
                      <div>
                        <Label>Qty</Label>
                        <Input type="number" value={item.qty} onChange={e => updateLineItem(i, "qty", Number(e.target.value))} min={0} />
                      </div>
                      <div>
                        <Label>UOM</Label>
                        <Input value={item.uom} onChange={e => updateLineItem(i, "uom", e.target.value)} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button size="icon" variant="ghost" onClick={() => removeLineItem(i)}>
                        <Trash2 className="h-5 w-5 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {lineItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Button onClick={addLineItem}><Plus className="h-4 w-4 mr-2" />Add First Item</Button>
                </div>
              )}
              <div className="text-right font-semibold text-lg pt-4 border-t">
                Total Qty: {totalQty}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>Remarks</Label>
                <Textarea value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} rows={3} />
              </div>
              <div>
                <Label>Terms & Conditions</Label>
                <Textarea value={form.terms} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))} rows={3} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
