"use client"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { getAllRecords } from "@/services/firebase"
import { exportToCSV } from "../utils/csvExport"

interface ItemSales {
  partCode: string
  description: string
  totalQty: number
  totalAmount: number
  invoiceCount: number
}

export default function SalesByItem() {
  const [data, setData] = useState<ItemSales[]>([])
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear(), 0, 1); return d.toISOString().split("T")[0] })
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [startDate, endDate])

  const loadData = async () => {
    setLoading(true)
    try {
      const invoices = await getAllRecords("sales/invoices") as any[]
      const filtered = invoices.filter(inv => {
        const d = inv.invoiceDate || inv.date || ""
        return d >= startDate && d <= endDate
      })

      const map = new Map<string, ItemSales>()
      filtered.forEach(inv => {
        const items = inv.lineItems || []
        items.forEach((item: any) => {
          const key = item.partCode || item.description || "Unknown"
          const existing = map.get(key) || { partCode: item.partCode || "", description: item.description || key, totalQty: 0, totalAmount: 0, invoiceCount: 0 }
          existing.totalQty += item.invoicedQty || item.qty || 0
          existing.totalAmount += item.taxableValue || item.amount || 0
          existing.invoiceCount++
          map.set(key, existing)
        })
      })

      setData(Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount))
    } catch { toast.error("Failed to load data") }
    finally { setLoading(false) }
  }

  const handleExport = () => {
    exportToCSV(data, [
      { key: "partCode", label: "Part Code" },
      { key: "description", label: "Description" },
      { key: "totalQty", label: "Qty Sold" },
      { key: "totalAmount", label: "Total Amount" },
      { key: "invoiceCount", label: "Times Invoiced" },
    ], `Sales_By_Item_${startDate}_${endDate}`)
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-4 items-end flex-wrap">
        <div><Label>From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Sales by Item</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty Sold</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Times Invoiced</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
              ) : data.map(d => (
                <TableRow key={d.partCode + d.description}>
                  <TableCell className="font-mono">{d.partCode || "—"}</TableCell>
                  <TableCell>{d.description}</TableCell>
                  <TableCell className="text-right">{d.totalQty}</TableCell>
                  <TableCell className="text-right font-mono">₹{d.totalAmount.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">{d.invoiceCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
