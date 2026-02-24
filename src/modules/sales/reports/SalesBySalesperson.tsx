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

interface SalespersonSales {
  salespersonName: string
  invoiceCount: number
  totalAmount: number
  customerCount: number
}

export default function SalesBySalesperson() {
  const [data, setData] = useState<SalespersonSales[]>([])
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

      const map = new Map<string, SalespersonSales & { customers: Set<string> }>()
      filtered.forEach(inv => {
        const name = inv.salespersonName || "Unassigned"
        const existing = map.get(name) || { salespersonName: name, invoiceCount: 0, totalAmount: 0, customerCount: 0, customers: new Set<string>() }
        existing.invoiceCount++
        existing.totalAmount += inv.grandTotal || 0
        if (inv.customerName) existing.customers.add(inv.customerName)
        map.set(name, existing)
      })

      setData(Array.from(map.values()).map(d => ({
        salespersonName: d.salespersonName,
        invoiceCount: d.invoiceCount,
        totalAmount: d.totalAmount,
        customerCount: d.customers.size,
      })).sort((a, b) => b.totalAmount - a.totalAmount))
    } catch { toast.error("Failed to load data") }
    finally { setLoading(false) }
  }

  const handleExport = () => {
    exportToCSV(data, [
      { key: "salespersonName", label: "Salesperson" },
      { key: "invoiceCount", label: "Invoices" },
      { key: "totalAmount", label: "Total Sales" },
      { key: "customerCount", label: "Customers" },
    ], `Sales_By_Salesperson_${startDate}_${endDate}`)
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-4 items-end flex-wrap">
        <div><Label>From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Sales by Salesperson</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Salesperson</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Total Sales</TableHead>
                <TableHead className="text-right">Customers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
              ) : data.map(d => (
                <TableRow key={d.salespersonName}>
                  <TableCell className="font-medium">{d.salespersonName}</TableCell>
                  <TableCell className="text-right">{d.invoiceCount}</TableCell>
                  <TableCell className="text-right font-mono">₹{d.totalAmount.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right">{d.customerCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
