"use client"
import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
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
import { quotationToSalesOrder } from "./utils/documentConversion"

interface LineItem {
  sNo: number
  itemCode: string
  itemDescription: string
  uom: string
  salesQty: number
  rate: number
  amount: number
  requiredDate?: string
}

export default function CreateSalesOrder() {
  const { id, quotationId } = useParams<{ id?: string; quotationId?: string }>()
  const navigate = useNavigate()
  const isEditMode = !!id

  const [customers, setCustomers] = useState<any[]>([])
  const [salespersons, setSalespersons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sourceQuotation, setSourceQuotation] = useState<any>(null)

  const [form, setForm] = useState({
    soNumber: `SO-${new Date().getFullYear().toString().slice(-2)}-${String(Date.now()).slice(-5)}`,
    soDate: new Date().toISOString().split("T")[0],
    shipmentDate: "",
    customerId: "",
    customerCode: "",
    customerName: "",
    shipToAddress: "",
    billToAddress: "",
    customerPONo: "",
    customerPODate: "",
    gstNoBillTo: "",
    gstNoShipTo: "",
    deliveryTerms: "",
    paymentTerms: "",
    deliveryMode: "",
    creditTerms: "",
    comments: "",
    salespersonId: "",
    salespersonName: "",
    convertedFromQuotationId: "",
    convertedFromQuotationNumber: "",
  })

  const [lineItems, setLineItems] = useState<LineItem[]>([])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (quotationId && !isEditMode) {
      loadFromQuotation(quotationId)
    }
  }, [quotationId])

  useEffect(() => {
    if (id) loadForEdit(id)
  }, [id, customers])

  const loadData = async () => {
    try {
      const [cust, settings] = await Promise.all([
        getAllRecords("sales/customers"),
        getRecordById("sales/settings", "default").catch(() => null),
      ])
      setCustomers(cust)
      if (settings && (settings as any).salespersons) {
        setSalespersons((settings as any).salespersons || [])
      }
    } catch {
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const loadFromQuotation = async (qId: string) => {
    try {
      const quotation = await getRecordById("sales/quotations", qId) as any
      if (!quotation) { toast.error("Quotation not found"); return }

      setSourceQuotation(quotation)
      const mapped = quotationToSalesOrder(quotation)
      setForm(prev => ({
        ...prev,
        ...mapped,
        soNumber: prev.soNumber,
        soDate: prev.soDate,
      }))
      setLineItems(mapped.lineItems)
    } catch {
      toast.error("Failed to load quotation")
    }
  }

  const loadForEdit = async (orderId: string) => {
    try {
      const order = await getRecordById("sales/orderAcknowledgements", orderId) as any
      if (!order) { toast.error("Order not found"); navigate("/sales/orders"); return }

      setForm({
        soNumber: order.soNumber || "",
        soDate: order.soDate || "",
        shipmentDate: order.shipmentDate || "",
        customerId: order.customerId || "",
        customerCode: order.customerCode || "",
        customerName: order.customerName || "",
        shipToAddress: order.shipToAddress || "",
        billToAddress: order.billToAddress || "",
        customerPONo: order.customerPONo || "",
        customerPODate: order.customerPODate || "",
        gstNoBillTo: order.gstNoBillTo || "",
        gstNoShipTo: order.gstNoShipTo || "",
        deliveryTerms: order.deliveryTerms || "",
        paymentTerms: order.paymentTerms || "",
        deliveryMode: order.deliveryMode || "",
        creditTerms: order.creditTerms || "",
        comments: order.comments || "",
        salespersonId: order.salespersonId || "",
        salespersonName: order.salespersonName || "",
        convertedFromQuotationId: order.convertedFromQuotationId || "",
        convertedFromQuotationNumber: order.convertedFromQuotationNumber || "",
      })
      setLineItems(
        (order.lineItems || []).map((item: any, idx: number) => ({
          sNo: idx + 1,
          itemCode: item.itemCode || "",
          itemDescription: item.itemDescription || "",
          uom: item.uom || "Nos",
          salesQty: item.salesQty || 0,
          rate: item.rate || 0,
          amount: item.amount || 0,
          requiredDate: item.requiredDate || "",
        }))
      )
    } catch {
      toast.error("Failed to load order")
    }
  }

  const handleCustomerChange = (custId: string) => {
    const cust = customers.find(c => c.id === custId)
    if (!cust) return
    const billing = cust.addresses?.find((a: any) => a.type === "billing" && a.isDefault) || cust.addresses?.find((a: any) => a.type === "billing")
    const shipping = cust.addresses?.find((a: any) => a.type === "shipping" && a.isDefault) || cust.addresses?.find((a: any) => a.type === "shipping")
    const fmtAddr = (a: any) => a ? `${a.street || ""}, ${a.city || ""}, ${a.state || ""} - ${a.pincode || ""}` : ""

    setForm(prev => ({
      ...prev,
      customerId: custId,
      customerCode: cust.customerCode || "",
      customerName: cust.companyName || "",
      billToAddress: fmtAddr(billing),
      shipToAddress: fmtAddr(shipping),
      gstNoBillTo: cust.gst || "",
      gstNoShipTo: cust.gst || "",
    }))
  }

  const addLineItem = () => {
    setLineItems(prev => [...prev, {
      sNo: prev.length + 1, itemCode: "", itemDescription: "", uom: "Nos", salesQty: 1, rate: 0, amount: 0,
    }])
  }

  const updateLineItem = (idx: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      const item = updated[idx]
      item.amount = (item.salesQty || 0) * (item.rate || 0)
      return updated
    })
  }

  const removeLineItem = (idx: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, sNo: i + 1 })))
  }

  const grandTotal = lineItems.reduce((sum, item) => sum + item.amount, 0)

  const handleSave = async () => {
    if (!form.customerId) { toast.error("Select a customer"); return }
    if (lineItems.length === 0) { toast.error("Add at least one item"); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        lineItems,
        total: grandTotal,
        grandTotal,
        status: "Draft",
        invoicedStatus: "Not Invoiced",
        shippedStatus: "Not Shipped",
      }

      if (isEditMode) {
        await updateRecord("sales/orderAcknowledgements", id!, payload)
        toast.success("Sales Order updated")
      } else {
        await createRecord("sales/orderAcknowledgements", payload)

        // Update source quotation if converting
        if (form.convertedFromQuotationId) {
          await updateRecord("sales/quotations", form.convertedFromQuotationId, {
            status: "Converted",
            convertedToSOId: id || "new",
          })
        }
        toast.success("Sales Order created")
      }
      navigate("/sales/orders")
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-10 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">
              {isEditMode ? "Edit Sales Order" : "Create Sales Order"}
            </h1>
            {sourceQuotation && (
              <div className="flex items-center gap-2 mt-2">
                <Info className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-blue-700">
                  Converted from Quotation{" "}
                  <Link to={`/sales/quotations/edit/${sourceQuotation.id}`} className="font-semibold underline">
                    {sourceQuotation.quoteNumber}
                  </Link>
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/sales/orders")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
              {saving ? "Saving..." : isEditMode ? "Update" : "Save"} Sales Order
            </Button>
          </div>
        </div>

        {form.convertedFromQuotationNumber && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
            <Badge variant="secondary">Source</Badge>
            <span className="text-sm">
              Converted from Quotation <strong>{form.convertedFromQuotationNumber}</strong>
            </span>
          </div>
        )}

        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer *</Label>
                  <Select value={form.customerId} onValueChange={handleCustomerChange}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.companyName} ({c.customerCode})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Salesperson</Label>
                  <Select value={form.salespersonId} onValueChange={(v) => {
                    const sp = salespersons.find((s: any) => s.id === v)
                    setForm(prev => ({ ...prev, salespersonId: v, salespersonName: sp?.name || "" }))
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select salesperson" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {salespersons.map((sp: any) => (
                        <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Billing Address</Label>
                  <Textarea value={form.billToAddress} onChange={e => setForm(prev => ({ ...prev, billToAddress: e.target.value }))} rows={2} />
                </div>
                <div>
                  <Label>Shipping Address</Label>
                  <Textarea value={form.shipToAddress} onChange={e => setForm(prev => ({ ...prev, shipToAddress: e.target.value }))} rows={2} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Details */}
          <Card>
            <CardHeader><CardTitle>Order Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>SO Number</Label>
                <Input value={form.soNumber} onChange={e => setForm(p => ({ ...p, soNumber: e.target.value }))} />
              </div>
              <div>
                <Label>SO Date</Label>
                <Input type="date" value={form.soDate} onChange={e => setForm(p => ({ ...p, soDate: e.target.value }))} />
              </div>
              <div>
                <Label>Expected Shipment Date</Label>
                <Input type="date" value={form.shipmentDate} onChange={e => setForm(p => ({ ...p, shipmentDate: e.target.value }))} />
              </div>
              <div>
                <Label>Customer PO No</Label>
                <Input value={form.customerPONo} onChange={e => setForm(p => ({ ...p, customerPONo: e.target.value }))} />
              </div>
              <div>
                <Label>Customer PO Date</Label>
                <Input type="date" value={form.customerPODate} onChange={e => setForm(p => ({ ...p, customerPODate: e.target.value }))} />
              </div>
              <div>
                <Label>Delivery Terms</Label>
                <Input value={form.deliveryTerms} onChange={e => setForm(p => ({ ...p, deliveryTerms: e.target.value }))} />
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Input value={form.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))} />
              </div>
              <div>
                <Label>Delivery Mode</Label>
                <Input value={form.deliveryMode} onChange={e => setForm(p => ({ ...p, deliveryMode: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Line Items</CardTitle>
                <Button size="sm" onClick={addLineItem}><Plus className="h-4 w-4 mr-2" />Add Item</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineItems.map((item, i) => (
                <div key={i} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-gray-50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div>
                      <Label>Item Code</Label>
                      <Input value={item.itemCode} onChange={e => updateLineItem(i, "itemCode", e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <Label>Description</Label>
                      <Input value={item.itemDescription} onChange={e => updateLineItem(i, "itemDescription", e.target.value)} />
                    </div>
                    <div>
                      <Label>UOM</Label>
                      <Input value={item.uom} onChange={e => updateLineItem(i, "uom", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 items-end">
                    <div>
                      <Label>Qty</Label>
                      <Input type="number" value={item.salesQty} onChange={e => updateLineItem(i, "salesQty", Number(e.target.value))} min={0} />
                    </div>
                    <div>
                      <Label>Rate</Label>
                      <Input type="number" value={item.rate} onChange={e => updateLineItem(i, "rate", Number(e.target.value))} min={0} step={0.01} />
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <div className="text-lg font-bold text-blue-700 pt-2">
                        ₹{item.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
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
                  <p>No items added yet</p>
                  <Button className="mt-2" onClick={addLineItem}><Plus className="h-4 w-4 mr-2" />Add First Item</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals & Notes */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
                <Label>Comments</Label>
                <Textarea value={form.comments} onChange={e => setForm(p => ({ ...p, comments: e.target.value }))} rows={3} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-right space-y-2">
                <div className="text-lg">
                  Subtotal: <strong>₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                </div>
                <div className="text-2xl text-blue-700 border-t-2 border-blue-700 pt-2 font-bold">
                  Grand Total: ₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
