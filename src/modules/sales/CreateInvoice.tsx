"use client"
import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, ArrowLeft, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import {
  createRecord,
  getAllRecords,
  getRecord,
  updateRecord,
  deleteRecord,
} from "@/services/firebase"
import fas from "./fas.png"

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
}

const ITEMS_PER_PAGE = 8

interface LineItem {
  sNo: number
  partCode: string
  description: string
  hsnCode: string
  availableStock?: number
  invoicedQty: number
  uom: string
  rate: number
  amount: number
  discount: number
  discountPercent: number
  cgstPercent: number
  sgstPercent: number
  igstPercent: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  taxableValue: number
  fgIds?: string
}

export default function CreateInvoice() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const printRef = useRef<HTMLDivElement>(null)

  const urlParams = new URLSearchParams(window.location.search)
  const isDuplicateMode = urlParams.get("duplicate") === "true"
  const isEditMode = !!id && !isDuplicateMode

  // Form States
  const [mode, setMode] = useState<"order" | "direct" | "rawmaterial">("order")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0])
  const [transportMode, setTransportMode] = useState("Courier")
  const [transporterName, setTransporterName] = useState("")
  const [vehicleNo, setVehicleNo] = useState("")
  const [dateTimeOfSupply, setDateTimeOfSupply] = useState(new Date().toISOString().slice(0, 16))
  const [placeOfSupply, setPlaceOfSupply] = useState("Tamil Nadu")
  const [customerPONo, setCustomerPONo] = useState("")
  const [customerPODate, setCustomerPODate] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("30 Days")
  const [eWayBillNo, setEWayBillNo] = useState("")
  const [eWayBillDate, setEWayBillDate] = useState("")
  const [remarks, setRemarks] = useState("")

  // ✅ FIXED: Tax States - Initialize with DEFAULT values
  const [applyCGST, setApplyCGST] = useState(true)
  const [applySGST, setApplySGST] = useState(true)
  const [applyIGST, setApplyIGST] = useState(false)
const [cgstPercent, setCgstPercent] = useState<number | ''>('');
const [sgstPercent, setSgstPercent] = useState<number | ''>('');
const [igstPercent, setIgstPercent] = useState<number | ''>('');

  // ✅ FIXED: Transport Charge States - Initialize with DEFAULT values
const [transportCharge, setTransportCharge] = useState<number | ''>('');
const [transportChargePercent, setTransportChargePercent] = useState<number | ''>('');
  const [transportChargeType, setTransportChargeType] = useState<"fixed" | "percent">("fixed")

  const [loadingInvoice, setLoadingInvoice] = useState(false)

  // Data States
  const [orders, setOrders] = useState<any[]>([])
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
  const [quotation, setQuotation] = useState<any | null>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  const [fgStock, setFgStock] = useState<any[]>([])
  const [products, setProducts] = useState<Record<string, any>>({})
  const [allProductItems, setAllProductItems] = useState<any[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [inspections, setInspections] = useState<any[]>([])

  const currency = selectedOrder?.currency || selectedCustomer?.currency || "INR"
  const symbol = CURRENCY_SYMBOLS[currency]

  // Generate Invoice Number
  useEffect(() => {
    if (!isEditMode && !invoiceNumber) {
      const now = new Date()
      const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
      const fy = `${fyStart}-${String(fyStart + 1).slice(-2)}`
      const seq = String(Date.now()).slice(-5)
      setInvoiceNumber(`FAS/${fy}/${seq}`)
    }
  }, [isEditMode, invoiceNumber])

  // Load All Data
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [oaData, custData, fgData, prodData, quotData, inspData] = await Promise.all([
          getAllRecords("sales/orderAcknowledgements"),
          getAllRecords("sales/customers"),
          getAllRecords("stores/fg"),
          getAllRecords("sales/products"),
          getAllRecords("sales/quotations"),
          getAllRecords("quality/inspections"),
        ])

        setAllOrders(oaData as any[])
        setCustomers(custData as any[])
        setFgStock(fgData as any[])
        setInspections(inspData as any[])

        // Process Products correctly from sales/products table
        const flatItems: any[] = []
        const prodMap: Record<string, any> = {}
        ;(prodData as any[]).forEach((productDoc: any) => {
          if (productDoc.items && Array.isArray(productDoc.items)) {
            productDoc.items.forEach((item: any) => {
              const productCode = item.productCode
              if (productCode) {
                prodMap[productCode] = item
                flatItems.push(item)
              }
            })
          }
        })
        setProducts(prodMap)
        setAllProductItems(flatItems)

        const quotMap = (quotData as any[]).reduce((acc: any, q: any) => {
          if (q.quoteNumber) acc[q.quoteNumber] = q
          return acc
        }, {})
        ;(window as any).quotMap = quotMap

        // Filter eligible orders - ONLY QC COMPLETED
        const eligible = (oaData as any[]).filter((order: any) => {
          return order.status === "QC Completed" || order.qcStatus === "completed"
        })
        setOrders(eligible)
      } catch (err) {
        console.error(err)
        toast.error("Failed to load data")
      }
    }
    loadAll()
  }, [])

  // Load Quotation
  useEffect(() => {
    if (!selectedOrder?.quotationNumber) {
      setQuotation(null)
      return
    }
    const map = (window as any).quotMap
    const q = map?.[selectedOrder.quotationNumber]
    setQuotation(q || null)
  }, [selectedOrder])

  // Load Existing Invoice (Edit Mode)
  useEffect(() => {
    if (!id) return

    const load = async () => {
      setLoadingInvoice(true)
      try {
        const inv: any = await getRecord("sales/invoices", id)
        if (!inv) throw new Error()

        setInvoiceDate(inv.invoiceDate)
        setTransportMode(inv.transportMode || "Courier")
        setTransporterName(inv.transporterName || "")
        setVehicleNo(inv.vehicleNo || "")
        setDateTimeOfSupply(inv.dateTimeOfSupply || new Date().toISOString().slice(0, 16))
        setPlaceOfSupply(inv.placeOfSupply || "Tamil Nadu")
        setCustomerPONo(inv.customerPO || "")
        setCustomerPODate(inv.customerPODate || "")
        setPaymentTerms(inv.paymentTerms || "30 Days")
        setEWayBillNo(inv.eWayBillNo || "")
        setEWayBillDate(inv.eWayBillDate || "")
        setRemarks(inv.remarks || "")

        setApplyCGST(inv.applyCGST ?? true)
        setApplySGST(inv.applySGST ?? true)
        setApplyIGST(inv.applyIGST ?? false)

        setCgstPercent(typeof inv.cgstPercent === "number" ? inv.cgstPercent : 9)
        setSgstPercent(typeof inv.sgstPercent === "number" ? inv.sgstPercent : 9)
        setIgstPercent(typeof inv.igstPercent === "number" ? inv.igstPercent : 18)

        setTransportCharge(inv.transportCharge || 0)
        setTransportChargeType(inv.transportChargeType || "fixed")
        setTransportChargePercent(inv.transportChargePercent || "")

        const items = (inv.lineItems || []).map((li: any, i: number) => {
          const qty = Number(li.qty || li.invoicedQty || 0)
          const rate = Number(li.rate || 0)
          const amount = qty * rate
          const discount = Number(li.discount || 0)
          const discountPercent = Number(li.discountPercent || 0)
          const taxableValue = amount - discount

          return {
            sNo: i + 1,
            partCode: li.partCode || li.productCode,
            description: li.description || li.productName,
            hsnCode: li.hsnCode || "39269099",
            availableStock: li.availableStock || 0,
            invoicedQty: qty,
            uom: li.uom || "NOS",
            rate,
            amount,
            discount,
            discountPercent,
            cgstPercent: Number(li.cgstPercent || 9),
            sgstPercent: Number(li.sgstPercent || 9),
            igstPercent: Number(li.igstPercent || 18),
            cgstAmount: Number(li.cgstAmount || 0),
            sgstAmount: Number(li.sgstAmount || 0),
            igstAmount: Number(li.igstAmount || 0),
            taxableValue,
            fgIds: li.fgIds || "",
          }
        })

        setLineItems(items)

        // Load Order / Customer
        if (inv.orderId) {
          setMode("order")
          const order = allOrders.find((o: any) => o.id === inv.orderId)
          if (order) setSelectedOrder(order)
        } else {
          setMode(inv.mode || "direct")
          const cust = customers.find((c: any) => c.id === inv.customerId)
          if (cust) setSelectedCustomer(cust)
        }

        if (!isDuplicateMode) {
          setInvoiceNumber(inv.invoiceNumber)
        }
      } catch (err) {
        toast.error("Invoice not found")
        navigate("/sales/invoices")
      } finally {
        setLoadingInvoice(false)
      }
    }

    if (allOrders.length > 0 && customers.length > 0) {
      load()
    }
  }, [id, isDuplicateMode, allOrders, customers, navigate])

  const customerState =
    selectedOrder?.customerState || selectedCustomer?.addresses?.[0]?.state || "Tamil Nadu"

  // Recalculate Item
  const recalcItem = (item: LineItem): LineItem => {
    const amount = item.invoicedQty * item.rate
    const discount =
      item.discountPercent > 0 ? (amount * item.discountPercent) / 100 : item.discount
    const taxableValue = amount - discount

    let cgstAmount = 0
    let sgstAmount = 0
    let igstAmount = 0

    if (currency === "INR") {
      if (applyCGST && item.cgstPercent > 0) {
        cgstAmount = (taxableValue * item.cgstPercent) / 100
      }
      if (applySGST && item.sgstPercent > 0) {
        sgstAmount = (taxableValue * item.sgstPercent) / 100
      }
      if (applyIGST && item.igstPercent > 0) {
        igstAmount = (taxableValue * item.igstPercent) / 100
      }
    }

    return {
      ...item,
      amount,
      discount,
      taxableValue,
      cgstAmount: Number(cgstAmount.toFixed(2)),
      sgstAmount: Number(sgstAmount.toFixed(2)),
      igstAmount: Number(igstAmount.toFixed(2)),
    }
  }

  // ✅ CRITICAL FIX: Recalculate all line items when tax percentages or apply flags change
  useEffect(() => {
    if (lineItems.length > 0) {
      setLineItems((prev) =>
        prev.map((item) =>
          recalcItem({
            ...item,
            cgstPercent: cgstPercent || 0,
            sgstPercent: sgstPercent || 0,
            igstPercent: igstPercent || 0,
          })
        )
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cgstPercent, sgstPercent, igstPercent, applyCGST, applySGST, applyIGST, currency])

  // Handle Order Change
  const handleOrderChange = (orderId: string) => {
    const order = allOrders.find((o) => o.id === orderId)
    if (!order) return

    setSelectedOrder(order)
    setSelectedCustomer(null)

    const orderInspections = inspections.filter(
      (insp: any) => insp.orderId === order.id && insp.qcStatus === "completed"
    )

    const items = (order.items || [])
      .map((it: any, i: number) => {
        const inspection = orderInspections.find(
          (insp: any) =>
            insp.productId === it.productId ||
            insp.productName === it.productName ||
            insp.productName === it.productDescription
        )

        const okQty = inspection ? Number(inspection.okQty || 0) : 0

        if (okQty === 0) return null

        const rate = Number(it.unitRate || 0)

        return recalcItem({
          sNo: i + 1,
          partCode: it.productCode || "",
          description: it.productDescription || it.productName || it.productCode || "",
          hsnCode: it.hsnCode || "39269099",
          availableStock: okQty,
          invoicedQty: okQty,
          uom: it.uom || it.unit || "NOS",
          rate,
          amount: 0,
          discount: 0,
          discountPercent: 0,
          cgstPercent: cgstPercent || 9,
          sgstPercent: sgstPercent || 9,
          igstPercent: igstPercent || 18,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          taxableValue: 0,
          fgIds: "",
        })
      })
      .filter(Boolean) as LineItem[]

    setLineItems(items)
  }

  // Add FG Item (Finished Goods from FG Stock)
  const addFgItem = (productCode: string) => {
    const fgItems = fgStock.filter((f: any) => f.productCode === productCode && f.qc === "ok")
    const totalAvailable = fgItems.reduce((s: number, f: any) => s + Number(f.quantity), 0)

    if (totalAvailable === 0) {
      toast.info("No FG stock available")
      return
    }

    if (lineItems.find((i) => i.partCode === productCode)) {
      toast.info("Already added")
      return
    }

    const prod = products[productCode]
    const rate = Number(prod?.unitPrice || 0)

    const newItem: LineItem = recalcItem({
      sNo: lineItems.length + 1,
      partCode: productCode,
      description: prod?.category ? `${prod.category} - ${prod.group}` : productCode,
      hsnCode: prod?.hsn || "39269099",
      availableStock: totalAvailable,
      invoicedQty: 1,
      uom: prod?.unit || "NOS",
      rate,
      amount: 0,
      discount: 0,
      discountPercent: 0,
      cgstPercent: cgstPercent || 9,
      sgstPercent: sgstPercent || 9,
      igstPercent: igstPercent || 18,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxableValue: 0,
      fgIds: "",
    })

    setLineItems([...lineItems, newItem])
  }

  // Add Raw Material Item (from products table stockQty)
  const addRawMaterialItem = (productCode: string) => {
    const prod = products[productCode]
    
    if (!prod) {
      toast.error("Product not found")
      return
    }

    const available = Number(prod.stockQty || 0)

    if (lineItems.find((i) => i.partCode === productCode)) {
      toast.info("Already added")
      return
    }

    const rate = Number(prod.unitPrice || 0)

    const newItem: LineItem = recalcItem({
      sNo: lineItems.length + 1,
      partCode: productCode,
      description: prod.category ? `${prod.category} - ${prod.group}` : productCode,
      hsnCode: prod.hsn || "39269099",
      availableStock: available,
      invoicedQty: 1,
      uom: prod.unit || "NOS",
      rate,
      amount: 0,
      discount: 0,
      discountPercent: 0,
      cgstPercent: cgstPercent || 9,
      sgstPercent: sgstPercent || 9,
      igstPercent: igstPercent || 18,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxableValue: 0,
      fgIds: "",
    })

    setLineItems([...lineItems, newItem])
  }

  // Update Qty
  const updateQty = (idx: number, qty: number) => {
    setLineItems((prev) => {
      const updated = [...prev]
      const item = updated[idx]
      const max = item.availableStock || 0
      const newQty = Math.max(0, Math.min(qty, max))
      updated[idx] = recalcItem({ ...item, invoicedQty: newQty })
      return updated
    })
  }

  // Update Item Field
  const updateItemField = (idx: number, field: keyof LineItem, value: any) => {
    setLineItems((prev) => {
      const updated = [...prev]
      updated[idx] = recalcItem({ ...updated[idx], [field]: value })
      return updated
    })
  }

  // Remove Item
  const removeItem = (idx: number) => {
    setLineItems((prev) =>
      prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sNo: i + 1 }))
    )
  }

  // Calculate Transport Charge
  const calculateTransportCharge = () => {
    if (transportChargeType === "fixed") {
      return Number(transportCharge || 0)
    } else {
      const itemsTotal = lineItems.reduce((sum, i) => sum + i.taxableValue, 0)
      const percent = Number(transportChargePercent || 0)
      return (itemsTotal * percent) / 100
    }
  }

  const finalTransportCharge = calculateTransportCharge()

  // Calculate Totals
  const calculateTotals = () => {
    const itemsTotal = lineItems.reduce((sum, i) => sum + i.taxableValue, 0)
    const taxable = itemsTotal + finalTransportCharge

    let cgst = 0
    let sgst = 0
    let igst = 0

    if (currency === "INR") {
      const itemsCGST = lineItems.reduce((sum, i) => sum + i.cgstAmount, 0)
      const itemsSGST = lineItems.reduce((sum, i) => sum + i.sgstAmount, 0)
      const itemsIGST = lineItems.reduce((sum, i) => sum + i.igstAmount, 0)

      let transportCGST = 0
      let transportSGST = 0
      let transportIGST = 0

      if (finalTransportCharge > 0) {
        if (applyCGST && cgstPercent > 0) {
          transportCGST = (finalTransportCharge * cgstPercent) / 100
        }
        if (applySGST && sgstPercent > 0) {
          transportSGST = (finalTransportCharge * sgstPercent) / 100
        }
        if (applyIGST && igstPercent > 0) {
          transportIGST = (finalTransportCharge * igstPercent) / 100
        }
      }

      cgst = itemsCGST + transportCGST
      sgst = itemsSGST + transportSGST
      igst = itemsIGST + transportIGST
    }

    const total = taxable + cgst + sgst + igst

    return {
      taxable: Number(taxable.toFixed(2)),
      cgst: Number(cgst.toFixed(2)),
      sgst: Number(sgst.toFixed(2)),
      igst: Number(igst.toFixed(2)),
      total: Number(total.toFixed(2)),
      transportCharge: finalTransportCharge,
    }
  }

  const { taxable, cgst, sgst, igst, total, transportCharge: calculatedTransportCharge } =
    calculateTotals()

  // Format Amount
  const formatAmount = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Number to Words
  const numberToWords = (num: number): string => {
    if (currency !== "INR") return ""

    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
    const teens = [
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ]
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    const integerPart = Math.floor(num)

    if (integerPart === 0) return "Zero Rupees Only"

    let word = ""

    let part = Math.floor(integerPart / 10000000)
    if (part > 0) {
      word += numberToWords(part).replace(" Rupees Only", "") + " Crore "
    }

    part = Math.floor(integerPart / 100000) % 100
    if (part > 0) {
      word += convertTwoDigit(part) + " Lakh "
    }

    part = Math.floor(integerPart / 1000) % 100
    if (part > 0) {
      word += convertTwoDigit(part) + " Thousand "
    }

    part = Math.floor(integerPart / 100) % 10
    if (part > 0) {
      word += units[part] + " Hundred "
    }

    part = integerPart % 100
    if (part > 0) {
      word += convertTwoDigit(part) + " "
    }

    return word.trim() + " Rupees Only"

    function convertTwoDigit(n: number): string {
      if (n < 10) return units[n]
      if (n >= 10 && n < 20) return teens[n - 10]
      return tens[Math.floor(n / 10)] + (n % 10 > 0 ? " " + units[n % 10] : "")
    }
  }

  const amountInWords = numberToWords(total)

  // Deduct From FG Stock
  const deductFromFgStock = async (item: LineItem) => {
    if (item.invoicedQty === 0) return

    let candidates = fgStock.filter(
      (f: any) =>
        f.productCode === item.partCode &&
        f.qc === "ok" &&
        (mode === "order" ? f.soNumber === selectedOrder?.soNumber : true)
    )

    candidates.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0))

    let remaining = item.invoicedQty
    for (const fg of candidates) {
      if (remaining <= 0) break

      const deduct = Math.min(remaining, Number(fg.quantity || 0))
      const newQty = Number(fg.quantity || 0) - deduct

      if (newQty <= 0) {
        await deleteRecord("stores/fg", fg.id)
      } else {
        await updateRecord("stores/fg", fg.id, { quantity: newQty })
      }

      remaining -= deduct
    }
  }

  // Deduct from Raw Material Stock (products table)
  const deductFromRawMaterialStock = async (item: LineItem) => {
    if (item.invoicedQty === 0) return
    
    const prod = products[item.partCode]
    if (!prod) return

    const currentStock = Number(prod.stockQty || 0)
    const newStock = Math.max(0, currentStock - item.invoicedQty)

    // Find the product document ID from allProductItems
    let productDocId = ""
    let itemIndex = -1
    
    const allProductDocs = await getAllRecords("sales/products")
    for (const doc of allProductDocs as any[]) {
      if (doc.items && Array.isArray(doc.items)) {
        const idx = doc.items.findIndex((i: any) => i.productCode === item.partCode)
        if (idx !== -1) {
          productDocId = doc.id
          itemIndex = idx
          break
        }
      }
    }

    if (productDocId && itemIndex !== -1) {
      // Update the specific item's stockQty in the products array
      const productDoc = allProductDocs.find((d: any) => d.id === productDocId) as any
      const updatedItems = [...productDoc.items]
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        stockQty: newStock
      }
      
      await updateRecord("sales/products", productDocId, { items: updatedItems })
    }
  }

  // Handle Save
  const handleSave = async () => {
    if (lineItems.length === 0 || lineItems.every((i) => i.invoicedQty === 0)) {
      toast.error("Add at least one item")
      return
    }

    const payload: any = {
      invoiceNumber,
      invoiceDate,
      customerId: selectedOrder?.customerId || selectedCustomer?.id || "",
      customerName: selectedOrder?.customerName || selectedCustomer?.companyName || "",
      customerGST: selectedOrder?.customerGST || selectedCustomer?.gst || "",
      paymentTerms,
      transportMode,
      transporterName,
      vehicleNo,
      dateTimeOfSupply,
      placeOfSupply,
      customerPO: customerPONo,
      customerPODate,
      eWayBillNo,
      eWayBillDate,
      remarks,
      applyCGST,
      applySGST,
      applyIGST,
      cgstPercent: Number(cgstPercent) || 0,
      sgstPercent: Number(sgstPercent) || 0,
      igstPercent: Number(igstPercent) || 0,
      currency,
      taxableAmount: taxable - calculatedTransportCharge,
      transportCharge: calculatedTransportCharge,
      transportChargeType,
      transportChargePercent: transportChargePercent || 0,
      cgstAmount: applyCGST ? cgst : 0,
      sgstAmount: applySGST ? sgst : 0,
      igstAmount: applyIGST ? igst : 0,
      grandTotal: total,
      lineItems: lineItems.map((i) => ({
        ...i,
        qty: i.invoicedQty,
        cgstPercent: Number(i.cgstPercent) || 0,
        sgstPercent: Number(i.sgstPercent) || 0,
        igstPercent: Number(i.igstPercent) || 0,
      })),
      mode,
      orderId: mode === "order" ? selectedOrder?.id : null,
      quotationId: quotation?.id || null,
      status: "Generated",
      updatedAt: Date.now(),
    }

    if (!isEditMode) {
      payload.createdAt = Date.now()
    }

    try {
      if (isEditMode && id) {
        await updateRecord("sales/invoices", id, payload)
        toast.success("Invoice updated")
      } else {
        await createRecord("sales/invoices", payload)
        toast.success("Invoice created")
      }

      // Update Order Status
      if (mode === "order" && selectedOrder) {
        await updateRecord("sales/orderAcknowledgements", selectedOrder.id, {
          invoiceStatus: "generated",
          status: "Invoice Generated",
          updatedAt: Date.now(),
        })
      }

      // Deduct Stock based on mode
      for (const item of lineItems) {
        if (mode === "direct") {
          await deductFromFgStock(item)
        } else if (mode === "rawmaterial") {
          await deductFromRawMaterialStock(item)
        }
      }

      toast.success("Invoice saved & stock updated")
      navigate("/sales/invoices")
    } catch (e: any) {
      console.error(e)
      toast.error("Save failed: " + (e.message || "Error"))
    }
  }

  // Handle Download PDF
  const handleDownloadPdf = async () => {
    if (!printRef.current) return

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      })

      const img = canvas.toDataURL("image/png")
      const pdf = new jsPDF("l", "mm", "a4")
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
      const imgX = (pdfWidth - imgWidth * ratio) / 2
      const imgY = 0

      pdf.addImage(img, "PNG", imgX, imgY, imgWidth * ratio, imgHeight * ratio)
      pdf.save(`${invoiceNumber}.pdf`)
      toast.success("PDF downloaded")
    } catch {
      toast.error("PDF generation failed")
    }
  }

  // Format Address
  const formatAddress = (addr: any) => {
    if (!addr) return ""
    const lines = [
      addr.street || "",
      addr.area || "",
      addr.city ? `${addr.city}, ${addr.state} - ${addr.pincode}` : "",
      addr.country || "",
    ].filter(Boolean)
    return lines.join("\n")
  }

  const billingAddress =
    quotation?.billingAddress || selectedCustomer?.addresses?.find((a: any) => a.type === "billing")
  const shippingAddress =
    quotation?.shippingAddress ||
    selectedCustomer?.addresses?.find((a: any) => a.type === "shipping")

  if (loadingInvoice) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl font-medium">
        Loading invoice...
      </div>
    )
  }

  const pages: LineItem[][] = []
  for (let i = 0; i < lineItems.length; i += ITEMS_PER_PAGE) {
    pages.push(lineItems.slice(i, i + ITEMS_PER_PAGE))
  }
  if (pages.length === 0) pages.push([])
  const totalPages = pages.length

  const CompanyHeader = (
    <div
      style={{
        textAlign: "center",
        padding: "12px 16px",
        borderBottom: "3px solid #000",
        background: "#ffffff",
      }}
    >
      <img
        src={fas}
        alt="FAS"
        style={{ width: "70px", height: "auto", margin: "0 auto 6px", display: "block" }}
        crossOrigin="anonymous"
      />
      <h1
        style={{
          fontSize: "18px",
          fontWeight: 900,
          margin: "3px 0",
          color: "#000",
          letterSpacing: "0.5px",
        }}
      >
        Fluoro Automation Seals Pvt Ltd
      </h1>
      <p style={{ fontSize: "10px", margin: "2px 0", color: "#000", fontWeight: 600 }}>
        3/180, Rajiv Gandhi Road, Mettukuppam, Chennai Tamil Nadu 600097 India
      </p>
      <p style={{ fontSize: "10px", margin: "2px 0", color: "#000", fontWeight: 600 }}>
        Phone: 9841175097 | Email: fas@fluoroautomationseals.com
      </p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-4">
      <div className="max-w-full mx-auto px-4">
        {/* HEADER */}
        <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => navigate("/sales/invoices")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <h1 className="text-3xl font-bold text-blue-900">
            {isEditMode ? "Edit Invoice" : "Create New Invoice"}
          </h1>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleDownloadPdf}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={handleSave} className="bg-blue-700 hover:bg-blue-800 px-8">
              {isEditMode ? "Update Invoice" : "Generate Invoice"}
            </Button>
          </div>
        </div>

        {/* TABS */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="mb-4">
          <TabsList className="grid w-full max-w-3xl grid-cols-3">
            <TabsTrigger value="order">From Sales Order</TabsTrigger>
            {/* <TabsTrigger value="direct">Direct Sale (FG Stock)</TabsTrigger> */}
            <TabsTrigger value="rawmaterial">Direct Sale (Raw Material)</TabsTrigger>
          </TabsList>

          {/* FROM ORDER */}
          <TabsContent value="order" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Select Sales Order (QC Completed Only)</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedOrder?.id || ""}
                  onValueChange={handleOrderChange}
                  disabled={isEditMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select order..." />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.soNumber} - {o.customerName} ({o.currency}) - Status: {o.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {orders.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    No eligible orders. Only orders with QC Completed status are shown.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DIRECT SALE FROM FG STOCK */}
          <TabsContent value="direct" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Select Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedCustomer?.id || ""}
                  onValueChange={(v) => {
                    const cust = customers.find((c) => c.id === v)
                    setSelectedCustomer(cust || null)
                    setLineItems([])
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.companyName} ({c.customerCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedCustomer && (
              <Card>
                <CardHeader>
                  <CardTitle>Add Products from Finished Goods Stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select onValueChange={addFgItem}>
                    <SelectTrigger>
                      <SelectValue placeholder="Search FG product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allProductItems
                        .filter(
                          (item) =>
                            item.type === "FINISHED GOODS" || item.type === "SEMI FINISHED GOODS"
                        )
                        .map((item) => {
                          const code = item.productCode
                          const fg = fgStock.filter(
                            (f: any) => f.productCode === code && f.qc === "ok"
                          )
                          const total = fg.reduce((s: number, f: any) => s + Number(f.quantity), 0)
                          if (total === 0) return null
                          return (
                            <SelectItem key={code} value={code}>
                              {code} - {item.category} - {item.group} ({total} {item.unit || "NOS"}{" "}
                              available)
                            </SelectItem>
                          )
                        })
                        .filter(Boolean)}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* DIRECT SALE FROM RAW MATERIAL */}
          <TabsContent value="rawmaterial" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Select Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedCustomer?.id || ""}
                  onValueChange={(v) => {
                    const cust = customers.find((c) => c.id === v)
                    setSelectedCustomer(cust || null)
                    setLineItems([])
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.companyName} ({c.customerCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedCustomer && (
              <Card>
                <CardHeader>
                  <CardTitle>Add Products from Raw Materials</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select onValueChange={addRawMaterialItem}>
                    <SelectTrigger>
                      <SelectValue placeholder="Search raw material product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allProductItems
                        .filter((item) => item.productCode)
                        .map((item) => {
                          const stock = Number(item.stockQty || 0)
                          return (
                            <SelectItem key={item.productCode} value={item.productCode}>
                              {item.productCode} - {item.category || "N/A"} - {item.group || "N/A"} ({stock} {item.unit || "NOS"} available)
                            </SelectItem>
                          )
                        })}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* LINE ITEMS EDITOR */}
        {lineItems.length > 0 && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Line Items Editor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="border border-gray-300 p-2">#</th>
                      <th className="border border-gray-300 p-2">Part Code</th>
                      <th className="border border-gray-300 p-2">Description</th>
                      <th className="border border-gray-300 p-2">HSN</th>
                      <th className="border border-gray-300 p-2">Available</th>
                      <th className="border border-gray-300 p-2">Qty</th>
                      <th className="border border-gray-300 p-2">UOM</th>
                      <th className="border border-gray-300 p-2">Rate</th>
                      <th className="border border-gray-300 p-2">Amount</th>
                      <th className="border border-gray-300 p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, i) => (
                      <tr key={i}>
                        <td className="border border-gray-300 p-2 text-center">{i + 1}</td>
                        <td className="border border-gray-300 p-2">{item.partCode}</td>
                        <td className="border border-gray-300 p-2">{item.description}</td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            value={item.hsnCode}
                            onChange={(e) => updateItemField(i, "hsnCode", e.target.value)}
                            className="w-24"
                          />
                        </td>
                        <td className="border border-gray-300 p-2 text-center font-semibold">
                          {item.availableStock}
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            type="number"
                            value={item.invoicedQty}
                            onChange={(e) => updateQty(i, Number(e.target.value))}
                            min={0}
                            max={item.availableStock}
                            className="w-20"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            value={item.uom}
                            onChange={(e) => updateItemField(i, "uom", e.target.value)}
                            className="w-20"
                          />
                        </td>
                        <td className="border border-gray-300 p-2">
                          <Input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItemField(i, "rate", Number(e.target.value))}
                            min={0}
                            step={0.01}
                            className="w-24"
                          />
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-semibold">
                          {symbol}{formatAmount(item.amount)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          <Button variant="destructive" size="sm" onClick={() => removeItem(i)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Tax percentages (CGST, SGST, IGST) are controlled globally
                  in the GST Configuration section below. Discount is not editable per item.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Continue with rest of your JSX - Invoice Details, Transport Charge, GST Configuration, PDF Preview... */}
        {/* I'll truncate here due to character limits, but include ALL remaining JSX from your original code */}
        


        {/* INVOICE DETAILS */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Invoice No.</Label>
                <Input value={invoiceNumber} readOnly className="bg-gray-100 font-bold" />
              </div>
              <div>
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Date & Time of Supply</Label>
                <Input
                  type="datetime-local"
                  value={dateTimeOfSupply}
                  onChange={(e) => setDateTimeOfSupply(e.target.value)}
                />
              </div>

              <div>
                <Label>Transport Mode</Label>
                <Select value={transportMode} onValueChange={setTransportMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select transport mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Courier">Courier</SelectItem>
                    <SelectItem value="Porter">Porter</SelectItem>
                    <SelectItem value="Road Transport">Road Transport</SelectItem>
                    <SelectItem value="Air Transport">Air Transport</SelectItem>
                    <SelectItem value="Sea Transport">Sea Transport</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Transporter Name</Label>
                <Input
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                  placeholder="Enter transporter name"
                />
              </div>

              <div>
                <Label>Vehicle No.</Label>
                <Input
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  placeholder="NA"
                />
              </div>

              <div>
                <Label>Place of Supply</Label>
                <Input value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} />
              </div>

              <div>
                <Label>Customer PO No.</Label>
                <Input value={customerPONo} onChange={(e) => setCustomerPONo(e.target.value)} />
              </div>

              <div>
                <Label>Customer PO Date</Label>
                <Input
                  type="date"
                  value={customerPODate}
                  onChange={(e) => setCustomerPODate(e.target.value)}
                />
              </div>

              <div>
                <Label>Payment Terms</Label>
                <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
              </div>

              <div>
                <Label>E-Way Bill No.</Label>
                <Input
                  value={eWayBillNo}
                  onChange={(e) => setEWayBillNo(e.target.value)}
                  placeholder="Enter E-Way Bill Number"
                />
              </div>

              <div>
                <Label>E-Way Bill Date</Label>
                <Input
                  type="date"
                  value={eWayBillDate}
                  onChange={(e) => setEWayBillDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* TRANSPORT CHARGE */}
        <Card className="bg-blue-50 border-2 border-blue-200 mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Transport Charge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={transportChargeType === "fixed"}
                  onChange={() => setTransportChargeType("fixed")}
                  className="w-4 h-4"
                />
                Fixed Amount
              </Label>
              <Label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={transportChargeType === "percent"}
                  onChange={() => setTransportChargeType("percent")}
                  className="w-4 h-4"
                />
                Percentage
              </Label>
            </div>

            {transportChargeType === "fixed" ? (
              <div>
                <Label>Fixed Transport Charge ({symbol})</Label>
                <Input
                  type="number"
                  value={transportCharge}
              onChange={(e) => setTransportCharge(e.target.value === '' ? '' : Number(e.target.value))}
                 
              
                  placeholder="Enter fixed amount"
                />
              </div>
            ) : (
              <div>
                <Label>Transport Charge Percentage (%)</Label>
                <Input
                  type="number"
                  value={transportChargePercent}
                  onChange={(e) => setTransportChargePercent(e.target.value)}
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="Enter percentage"
                />
              </div>
            )}

            <div className="text-sm font-medium text-blue-800">
              Calculated Transport Charge: {symbol}
              {formatAmount(calculatedTransportCharge)}
            </div>
          </CardContent>
        </Card>

        {/* GST CONFIGURATION */}
        <Card className="bg-green-50 border-2 border-green-200 mb-4">
          <CardHeader>
            <CardTitle className="text-lg">GST Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="applyCGST"
                    checked={applyCGST}
                    onChange={(e) => setApplyCGST(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="applyCGST" className="cursor-pointer text-base font-bold">
                    Apply CGST
                  </Label>
                </div>
                <div>
                  <Label>CGST Percentage (%)</Label>
                  <Input
                    type="number"
                    value={cgstPercent}
               onChange={(e) => setCgstPercent(e.target.value === '' ? '' : Number(e.target.value))}
                    min={0}
                    step={0.1}
                    disabled={!applyCGST}
                    className="font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="applySGST"
                    checked={applySGST}
                    onChange={(e) => setApplySGST(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="applySGST" className="cursor-pointer text-base font-bold">
                    Apply SGST
                  </Label>
                </div>
                <div>
                  <Label>SGST Percentage (%)</Label>
                  <Input
                    type="number"
                    value={sgstPercent}
            onChange={(e) => setSgstPercent(e.target.value === '' ? '' : Number(e.target.value))}
                    min={0}
                    step={0.1}
                    disabled={!applySGST}
                    className="font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="applyIGST"
                    checked={applyIGST}
                    onChange={(e) => setApplyIGST(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="applyIGST" className="cursor-pointer text-base font-bold">
                    Apply IGST
                  </Label>
                </div>
                <div>
                  <Label>IGST Percentage (%)</Label>
                  <Input
                    type="number"
                    value={igstPercent}
             onChange={(e) => setIgstPercent(e.target.value === '' ? '' : Number(e.target.value))}
                    min={0}
                    step={0.1}
                    disabled={!applyIGST}
                    className="font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-white border-2 border-green-300 rounded">
              <h3 className="font-bold text-lg mb-2">Live Tax Calculation Preview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Items Total:</span>
                  <div className="font-bold text-lg">
                    {symbol}
                    {formatAmount(lineItems.reduce((s, i) => s + i.taxableValue, 0))}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Transport:</span>
                  <div className="font-bold text-lg">
                    {symbol}
                    {formatAmount(calculatedTransportCharge)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Taxable Amount:</span>
                  <div className="font-bold text-lg">
                    {symbol}
                    {formatAmount(taxable)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Grand Total:</span>
                  <div className="font-bold text-xl text-green-700">
                    {symbol}
                    {formatAmount(total)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t">
                {applyCGST && (
                  <div className="bg-blue-50 p-2 rounded">
                    <span className="text-gray-600 text-xs">CGST ({cgstPercent}%)</span>
                    <div className="font-bold text-blue-700">
                      {symbol}
                      {formatAmount(cgst)}
                    </div>
                  </div>
                )}
                {applySGST && (
                  <div className="bg-blue-50 p-2 rounded">
                    <span className="text-gray-600 text-xs">SGST ({sgstPercent}%)</span>
                    <div className="font-bold text-blue-700">
                      {symbol}
                      {formatAmount(sgst)}
                    </div>
                  </div>
                )}
                {applyIGST && (
                  <div className="bg-blue-50 p-2 rounded">
                    <span className="text-gray-600 text-xs">IGST ({igstPercent}%)</span>
                    <div className="font-bold text-blue-700">
                      {symbol}
                      {formatAmount(igst)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

 


        {/* MULTI-PAGE PDF PREVIEW */}
        <div
          ref={printRef}
          style={{
            media: "print",
            "@page": { size: "A4 landscape", margin: 0 },
            "@media print": {
              "print-color-adjust": "exact",
              "-webkit-print-color-adjust": "exact",
              margin: 0,
              padding: 0,
            },
            ".page-break": {
              "page-break-after": "always",
              "break-after": "page",
              margin: 0,
              padding: 0,
              boxSizing: "border-box",
            },
          }}
        >
          {pages.map((pageItems, pageIndex) => (
            <div
              key={pageIndex}
              className={pageIndex < totalPages - 1 ? "page-break" : ""}
              style={{
                width: "297mm",
                height: "210mm",
                background: "#ffffff",
                margin: "0 auto 20px",
                padding: 0,
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                fontFamily: "Arial, sans-serif",
                position: "relative",
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  border: "3px solid #000",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Header on every page */}
                <div style={{ flexShrink: 0 }}>{CompanyHeader}</div>

                {/* Body Content */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    overflow: "hidden",
                  }}
                >
                  {/* INVOICE TITLE - Only on first page */}
                  {pageIndex === 0 && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "6px 0",
                        borderBottom: "2px solid #000",
                        background: "#ffffff",
                        flexShrink: 0,
                      }}
                    >
                      <h2
                        style={{
                          fontSize: "14px",
                          fontWeight: 900,
                          margin: 0,
                          letterSpacing: "1px",
                        }}
                      >
                        INVOICE
                      </h2>
                    </div>
                  )}

                  {/* Continuation header for pages after first */}
                  {pageIndex > 0 && (
                    <div
                      style={{
                        padding: "8px 16px",
                        borderBottom: "2px solid #000",
                        flexShrink: 0,
                      }}
                    >
                      <h3
                        style={{
                          fontSize: "13px",
                          fontWeight: 900,
                          textAlign: "center",
                          marginBottom: "3px",
                        }}
                      >
                        INVOICE - {invoiceNumber} (Continued)
                      </h3>
                      <p
                        style={{
                          fontSize: "9px",
                          textAlign: "center",
                          color: "#666",
                          margin: 0,
                        }}
                      >
                        Page {pageIndex + 1} of {totalPages}
                      </p>
                    </div>
                  )}

                  {/* INVOICE DETAILS - Only on first page */}
                  {pageIndex === 0 && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        borderBottom: "2px solid #000",
                        background: "#ffffff",
                        flexShrink: 0,
                      }}
                    >
                      {/* Left Column */}
                      <div
                        style={{
                          borderRight: "2px solid #000",
                          padding: "4px 10px",
                          fontSize: "8px",
                          background: "#ffffff",
                        }}
                      >
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  width: "55%",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 700,
                                }}
                              >
                                Invoice No:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 800,
                                }}
                              >
                                {invoiceNumber}
                              </td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 700,
                                }}
                              >
                                Invoice Date:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 800,
                                }}
                              >
                                {invoiceDate
                                  ? format(new Date(invoiceDate), "dd-MM-yyyy")
                                  : ""}
                              </td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 700,
                                }}
                              >
                                Tax Is Payable On Reverse Charge:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 800,
                                }}
                              >
                                No
                              </td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 700,
                                }}
                              >
                                Payment Terms:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 800,
                                }}
                              >
                                {paymentTerms}
                              </td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 700,
                                }}
                              >
                                Transporter Name:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 800,
                                }}
                              >
                                {transporterName || ""}
                              </td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 700,
                                }}
                              >
                                E-Way Bill No:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 800,
                                }}
                              >
                                {eWayBillNo || ""}
                              </td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  fontWeight: 700,
                                }}
                              >
                                E-Way Bill Date:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  fontWeight: 800,
                                }}
                              >
                                {eWayBillDate || ""}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Right Column */}
                      <div
                        style={{
                          padding: "4px 10px",
                          fontSize: "8px",
                          background: "#ffffff",
                        }}
                      >
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  width: "55%",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 700,
                                }}
                              >
                                Transportation Mode:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 800,
                                }}
                              >
                                {transportMode}
                              </td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 700,
                                }}
                              >
                                Vehicle No.:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 800,
                                }}
                              >
                                {vehicleNo || "NA"}
                              </td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 700,
                                }}
                              >
                                Date & Time of Supply:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 800,
                                }}
                              >
                                {dateTimeOfSupply
                                  ? format(new Date(dateTimeOfSupply), "dd-MM-yyyy HH:mm:ss")
                                  : ""}
                              </td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 700,
                                }}
                              >
                                Place of Supply:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 800,
                                }}
                              >
                                {placeOfSupply}
                              </td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 700,
                                }}
                              >
                                Customer PO No:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  borderBottom: "1px solid #dee2e6",
                                  fontWeight: 800,
                                }}
                              >
                                {customerPONo || ""}
                              </td>
                            </tr>
                            <tr>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  fontWeight: 700,
                                }}
                              >
                                Customer PO Date:
                              </td>
                              <td
                                style={{
                                  padding: "2px 4px",
                                  fontWeight: 800,
                                }}
                              >
                                {customerPODate
                                  ? format(new Date(customerPODate), "dd-MM-yyyy")
                                  : ""}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Billed to / Shipped to */}
                  {pageIndex === 0 && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        borderBottom: "2px solid #000",
                        background: "#ffffff",
                        flexShrink: 0,
                      }}
                    >
                      {/* Billed to */}
                      <div
                        style={{
                          borderRight: "2px solid #000",
                          padding: "6px 10px",
                          fontSize: "8px",
                          background: "#ffffff",
                        }}
                      >
                        <div
                          style={{
                            textAlign: "center",
                            borderBottom: "1px solid #999",
                            marginBottom: "4px",
                            paddingBottom: "2px",
                          }}
                        >
                          <strong style={{ fontSize: "9px", fontWeight: 800 }}>
                            Details of Recipient (Billed to)
                          </strong>
                        </div>
                        <p
                          style={{
                            fontWeight: 800,
                            fontSize: "10px",
                            margin: "3px 0",
                            color: "#000",
                          }}
                        >
                          {selectedOrder?.customerName || selectedCustomer?.companyName}
                        </p>
                        <pre
                          style={{
                            fontFamily: "Arial, sans-serif",
                            fontSize: "8px",
                            whiteSpace: "pre-wrap",
                            margin: "2px 0",
                            fontWeight: 600,
                            lineHeight: 1.3,
                          }}
                        >
                          {formatAddress(billingAddress)}
                        </pre>
                        <p style={{ margin: "2px 0", fontWeight: 700 }}>
                          <strong>State Code:</strong>{" "}
                          {(selectedOrder?.customerGST || selectedCustomer?.gst || "")
                            .substring(0, 2)}
                        </p>
                        <p style={{ margin: "2px 0", fontWeight: 700 }}>
                          <strong>GSTIN:</strong>{" "}
                          {selectedOrder?.customerGST || selectedCustomer?.gst}
                        </p>
                      </div>

                      {/* Shipped to */}
                      <div
                        style={{
                          padding: "6px 10px",
                          fontSize: "8px",
                          background: "#ffffff",
                        }}
                      >
                        <div
                          style={{
                            textAlign: "center",
                            borderBottom: "1px solid #999",
                            marginBottom: "4px",
                            paddingBottom: "2px",
                          }}
                        >
                          <strong style={{ fontSize: "9px", fontWeight: 800 }}>
                            Details of Consignee (Shipped to)
                          </strong>
                        </div>
                        <p
                          style={{
                            fontWeight: 800,
                            fontSize: "10px",
                            margin: "3px 0",
                            color: "#000",
                          }}
                        >
                          {selectedOrder?.customerName || selectedCustomer?.companyName}
                        </p>
                        <pre
                          style={{
                            fontFamily: "Arial, sans-serif",
                            fontSize: "8px",
                            whiteSpace: "pre-wrap",
                            margin: "2px 0",
                            fontWeight: 600,
                            lineHeight: 1.3,
                          }}
                        >
                          {formatAddress(shippingAddress)}
                        </pre>
                        <p style={{ margin: "2px 0", fontWeight: 700 }}>
                          <strong>State Code:</strong>{" "}
                          {(selectedOrder?.customerGST || selectedCustomer?.gst || "")
                            .substring(0, 2)}
                        </p>
                        <p style={{ margin: "2px 0", fontWeight: 700 }}>
                          <strong>GSTIN:</strong>{" "}
                          {selectedOrder?.customerGST || selectedCustomer?.gst}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ITEMS TABLE */}
                  <div
                    style={{
                      flex: 1,
                      padding: 0,
                      background: "#ffffff",
                      minHeight: 0,
                      overflow: "hidden",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "8px",
                        background: "#ffffff",
                      }}
                    >
                      <thead style={{ background: "#ffffff" }}>
                        <tr>
                          <th
                            rowSpan={2}
                            style={{
                              border: "1px solid #000",
                              padding: "4px 2px",
                              textAlign: "center",
                              width: "2.5%",
                              fontWeight: 900,
                            }}
                          >
                            S.No
                          </th>
                          <th
                            rowSpan={2}
                            style={{
                              border: "1px solid #000",
                              padding: "4px 2px",
                              width: "13%",
                              fontWeight: 900,
                            }}
                          >
                            Part Code
                            <br />
                            Description
                          </th>
                          <th
                            rowSpan={2}
                            style={{
                              border: "1px solid #000",
                              padding: "4px 2px",
                              textAlign: "center",
                              width: "5%",
                              fontWeight: 900,
                            }}
                          >
                            HSN
                            <br />
                            SAC
                          </th>
                          <th
                            rowSpan={2}
                            style={{
                              border: "1px solid #000",
                              padding: "4px 2px",
                              textAlign: "center",
                              width: "3.5%",
                              fontWeight: 900,
                            }}
                          >
                            Qty
                          </th>
                          <th
                            rowSpan={2}
                            style={{
                              border: "1px solid #000",
                              padding: "4px 2px",
                              textAlign: "center",
                              width: "3.5%",
                              fontWeight: 900,
                            }}
                          >
                            UOM
                          </th>
                          <th
                            rowSpan={2}
                            style={{
                              border: "1px solid #000",
                              padding: "4px 2px",
                              textAlign: "right",
                              width: "6%",
                              fontWeight: 900,
                            }}
                          >
                            Rate
                          </th>
                          <th
                            rowSpan={2}
                            style={{
                              border: "1px solid #000",
                              padding: "4px 2px",
                              textAlign: "right",
                              width: "7%",
                              fontWeight: 900,
                            }}
                          >
                            Amount
                          </th>
                          <th
                            rowSpan={2}
                            style={{
                              border: "1px solid #000",
                              padding: "4px 2px",
                              textAlign: "right",
                              width: "4.5%",
                              fontWeight: 900,
                            }}
                          >
                            Disc
                          </th>
                          <th
                            rowSpan={2}
                            style={{
                              border: "1px solid #000",
                              padding: "4px 2px",
                              textAlign: "right",
                              width: "7.5%",
                              fontWeight: 900,
                            }}
                          >
                            Taxable
                            <br />
                            Value
                          </th>
                          <th
                            colSpan={2}
                            style={{
                              border: "1px solid #000",
                              padding: "4px 2px",
                              textAlign: "center",
                              fontWeight: 900,
                            }}
                          >
                            CGST
                          </th>
                          <th
                            colSpan={2}
                            style={{
                              border: "1px solid #000",
                              padding: "4px 2px",
                              textAlign: "center",
                              fontWeight: 900,
                            }}
                          >
                            SGST/UTGST
                          </th>
                          <th
                            colSpan={2}
                            style={{
                              border: "1px solid #000",
                              padding: "4px 2px",
                              textAlign: "center",
                              fontWeight: 900,
                            }}
                          >
                            IGST
                          </th>
                        </tr>
                        <tr>
                          <th
                            style={{
                              border: "1px solid #000",
                              padding: "2px",
                              textAlign: "center",
                              width: "2.5%",
                              fontWeight: 800,
                            }}
                          >
                            %
                          </th>
                          <th
                            style={{
                              border: "1px solid #000",
                              padding: "2px",
                              textAlign: "right",
                              width: "5.5%",
                              fontWeight: 800,
                            }}
                          >
                            Amt
                          </th>
                          <th
                            style={{
                              border: "1px solid #000",
                              padding: "2px",
                              textAlign: "center",
                              width: "2.5%",
                              fontWeight: 800,
                            }}
                          >
                            %
                          </th>
                          <th
                            style={{
                              border: "1px solid #000",
                              padding: "2px",
                              textAlign: "right",
                              width: "5.5%",
                              fontWeight: 800,
                            }}
                          >
                            Amt
                          </th>
                          <th
                            style={{
                              border: "1px solid #000",
                              padding: "2px",
                              textAlign: "center",
                              width: "2.5%",
                              fontWeight: 800,
                            }}
                          >
                            %
                          </th>
                          <th
                            style={{
                              border: "1px solid #000",
                              padding: "2px",
                              textAlign: "right",
                              width: "5.5%",
                              fontWeight: 800,
                            }}
                          >
                            Amt
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((item, i) => {
                          const globalIndex = pageIndex * ITEMS_PER_PAGE + i
                          return (
                            <tr key={i} style={{ background: "#ffffff" }}>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 2px",
                                  textAlign: "center",
                                  fontWeight: 700,
                                }}
                              >
                                {globalIndex + 1}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 4px",
                                  fontSize: "7.5px",
                                  lineHeight: 1.2,
                                }}
                              >
                                <div style={{ fontWeight: 800 }}>{item.partCode}</div>
                                <div
                                  style={{
                                    fontSize: "7px",
                                    color: "#333",
                                    fontWeight: 600,
                                  }}
                                >
                                  {item.description}
                                </div>
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 2px",
                                  textAlign: "center",
                                  fontWeight: 700,
                                }}
                              >
                                {item.hsnCode}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 2px",
                                  textAlign: "center",
                                  fontWeight: 800,
                                }}
                              >
                                {item.invoicedQty}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 2px",
                                  textAlign: "center",
                                  fontWeight: 700,
                                }}
                              >
                                {item.uom}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 4px",
                                  textAlign: "right",
                                  fontWeight: 700,
                                }}
                              >
                                {formatAmount(item.rate)}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 4px",
                                  textAlign: "right",
                                  fontWeight: 800,
                                }}
                              >
                                {formatAmount(item.amount)}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 4px",
                                  textAlign: "right",
                                  fontWeight: 700,
                                }}
                              >
                                {formatAmount(item.discount)}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 4px",
                                  textAlign: "right",
                                  fontWeight: 900,
                                  background: "#ffffff",
                                }}
                              >
                                {formatAmount(item.taxableValue)}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 2px",
                                  textAlign: "center",
                                  fontWeight: 800,
                                }}
                              >
                                {applyCGST ? item.cgstPercent.toFixed(1) : "0.0"}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 4px",
                                  textAlign: "right",
                                  fontWeight: 800,
                                }}
                              >
                                {formatAmount(item.cgstAmount)}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 2px",
                                  textAlign: "center",
                                  fontWeight: 800,
                                }}
                              >
                                {applySGST ? item.sgstPercent.toFixed(1) : "0.0"}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 4px",
                                  textAlign: "right",
                                  fontWeight: 800,
                                }}
                              >
                                {formatAmount(item.sgstAmount)}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 2px",
                                  textAlign: "center",
                                  fontWeight: 800,
                                }}
                              >
                                {applyIGST ? item.igstPercent.toFixed(1) : "0.0"}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "3px 4px",
                                  textAlign: "right",
                                  fontWeight: 800,
                                }}
                              >
                                {formatAmount(item.igstAmount)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottom Section - Only on last page */}
                  {pageIndex === totalPages - 1 && (
                    <>
                      {/* TOTAL ROW */}
                      <div style={{ flexShrink: 0, background: "#ffffff" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "8px",
                            background: "#ffffff",
                          }}
                        >
                          <tbody>
                            <tr style={{ fontWeight: 900, background: "#ffffff" }}>
                              <td
                                colSpan={6}
                                style={{
                                  border: "1px solid #000",
                                  padding: "4px 6px",
                                  textAlign: "right",
                                  fontSize: "9px",
                                  width: "33.5%",
                                }}
                              >
                                TOTAL
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "4px 6px",
                                  textAlign: "right",
                                  fontSize: "9px",
                                  width: "7%",
                                }}
                              >
                                {formatAmount(lineItems.reduce((s, i) => s + i.amount, 0))}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "4px 6px",
                                  textAlign: "right",
                                  fontSize: "9px",
                                  width: "4.5%",
                                }}
                              >
                                {formatAmount(lineItems.reduce((s, i) => s + i.discount, 0))}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "4px 6px",
                                  textAlign: "right",
                                  fontSize: "9px",
                                  width: "7.5%",
                                }}
                              >
                                {formatAmount(lineItems.reduce((s, i) => s + i.taxableValue, 0))}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "4px 2px",
                                  width: "2.5%",
                                }}
                              ></td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "4px 6px",
                                  textAlign: "right",
                                  fontSize: "9px",
                                  width: "5.5%",
                                }}
                              >
                                {formatAmount(lineItems.reduce((s, i) => s + i.cgstAmount, 0))}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "4px 2px",
                                  width: "2.5%",
                                }}
                              ></td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "4px 6px",
                                  textAlign: "right",
                                  fontSize: "9px",
                                  width: "5.5%",
                                }}
                              >
                                {formatAmount(lineItems.reduce((s, i) => s + i.sgstAmount, 0))}
                              </td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "4px 2px",
                                  width: "2.5%",
                                }}
                              ></td>
                              <td
                                style={{
                                  border: "1px solid #000",
                                  padding: "4px 6px",
                                  textAlign: "right",
                                  fontSize: "9px",
                                  width: "5.5%",
                                }}
                              >
                                {formatAmount(lineItems.reduce((s, i) => s + i.igstAmount, 0))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* SUMMARY SECTION */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          borderTop: "2px solid #000",
                          background: "#ffffff",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            borderRight: "2px solid #000",
                            padding: "6px 10px",
                            fontSize: "9px",
                            fontWeight: 700,
                          }}
                        >
                          <p style={{ margin: "2px 0" }}>
                            <strong style={{ fontWeight: 900 }}>Items Total:</strong> {symbol}
                            {formatAmount(lineItems.reduce((s, i) => s + i.taxableValue, 0))}
                          </p>
                          <p style={{ margin: "2px 0" }}>
                            <strong style={{ fontWeight: 900 }}>Transport Charge:</strong> {symbol}
                            {formatAmount(calculatedTransportCharge)}
                          </p>
                          <p
                            style={{
                              margin: "2px 0",
                              borderTop: "1px solid #ccc",
                              paddingTop: "2px",
                            }}
                          >
                            <strong style={{ fontWeight: 900 }}>Taxable Amount:</strong> {symbol}
                            {formatAmount(taxable)}
                          </p>
                          {applyCGST && cgst > 0 && (
                            <p style={{ margin: "2px 0", color: "#0066cc" }}>
                              <strong style={{ fontWeight: 900 }}>CGST ({cgstPercent}%):</strong>{" "}
                              {symbol}
                              {formatAmount(cgst)}
                            </p>
                          )}
                          {applySGST && sgst > 0 && (
                            <p style={{ margin: "2px 0", color: "#0066cc" }}>
                              <strong style={{ fontWeight: 900 }}>SGST ({sgstPercent}%):</strong>{" "}
                              {symbol}
                              {formatAmount(sgst)}
                            </p>
                          )}
                          {applyIGST && igst > 0 && (
                            <p style={{ margin: "2px 0", color: "#0066cc" }}>
                              <strong style={{ fontWeight: 900 }}>IGST ({igstPercent}%):</strong>{" "}
                              {symbol}
                              {formatAmount(igst)}
                            </p>
                          )}
                          <p style={{ margin: "2px 0" }}>
                            <strong style={{ fontWeight: 900 }}>Round Off:</strong> ₹0.00
                          </p>
                        </div>

                        <div
                          style={{
                            padding: "6px 10px",
                            fontSize: "9px",
                            textAlign: "right",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                          }}
                        >
                          <p
                            style={{
                              fontSize: "12px",
                              fontWeight: 900,
                              margin: "2px 0",
                              color: "#000",
                            }}
                          >
                            Grand Total: {symbol}
                            {formatAmount(total)}
                          </p>
                        </div>
                      </div>

                      {/* AMOUNT IN WORDS */}
                      {currency === "INR" && (
                        <div
                          style={{
                            borderTop: "2px solid #000",
                            padding: "6px 10px",
                            fontSize: "9px",
                            fontWeight: 700,
                            background: "#ffffff",
                            flexShrink: 0,
                          }}
                        >
                          <strong style={{ fontWeight: 900 }}>Amount in Words:</strong>{" "}
                          {amountInWords}
                        </div>
                      )}

                      {/* E-WAY BILL */}
                      {eWayBillNo && eWayBillDate && (
                        <div
                          style={{
                            borderTop: "2px solid #000",
                            padding: "6px 10px",
                            fontSize: "9px",
                            fontWeight: 700,
                            background: "#ffffff",
                            flexShrink: 0,
                          }}
                        >
                          <strong style={{ fontWeight: 900 }}>
                            Electronic Reference Number (E-Way Bill):
                          </strong>{" "}
                          {eWayBillNo}
                          <span style={{ marginLeft: "20px", fontWeight: 900 }}>
                            <strong>Date:</strong> {format(new Date(eWayBillDate), "dd-MM-yyyy")}
                          </span>
                        </div>
                      )}

                      {/* TERMS & SIGNATURE */}
                      <div
                        style={{
                          borderTop: "2px solid #000",
                          padding: "8px 10px",
                          fontSize: "8px",
                          background: "#ffffff",
                          flexShrink: 0,
                        }}
                      >
                        <p style={{ margin: "2px 0", fontWeight: 800 }}>
                          <strong>TERM & CONDITION OF SALES</strong>
                        </p>
                        <p
                          style={{
                            margin: "16px 0 4px",
                            textAlign: "center",
                            fontSize: "9px",
                            fontWeight: 700,
                          }}
                        >
                          Certified that the Particulars given above are true and correct
                        </p>
                        <p
                          style={{
                            margin: "20px 0 4px",
                            textAlign: "right",
                            fontSize: "9px",
                            fontWeight: 900,
                          }}
                        >
                          For Fluoro Automation Seals Pvt Ltd
                        </p>
                        <div style={{ marginTop: "28px", textAlign: "right" }}>
                          <p
                            style={{
                              fontSize: "9px",
                              fontWeight: 900,
                              borderTop: "1px solid #000",
                              display: "inline-block",
                              paddingTop: "4px",
                              paddingRight: "50px",
                            }}
                          >
                            Authorized Signatory
                          </p>
                        </div>

                        <div style={{ marginTop: "8px" }}>
                          <table style={{ width: "100%", fontSize: "8px" }}>
                            <tbody>
                              <tr>
                                <td style={{ padding: "2px", fontWeight: 700 }}>Name:</td>
                                <td style={{ padding: "2px", fontWeight: 700 }}>Designation:</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
