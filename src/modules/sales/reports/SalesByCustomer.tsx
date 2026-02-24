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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface CustomerSales {
  customerName: string
  invoiceCount: number
  totalAmount: number
  paidAmount: number
  outstanding: number
}

export default function SalesByCustomer() {
  const [data, setData] = useState<CustomerSales[]>([])
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

      const map = new Map<string, CustomerSales>()
      filtered.forEach(inv => {
        const name = inv.customerName || "Unknown"
        const existing = map.get(name) || { customerName: name, invoiceCount: 0, totalAmount: 0, paidAmount: 0, outstanding: 0 }
        existing.invoiceCount++
        existing.totalAmount += inv.grandTotal || 0
        existing.paidAmount += inv.paidAmount || 0
        existing.outstanding += Math.max(0, (inv.grandTotal || 0) - (inv.paidAmount || 0))
        map.set(name, existing)
      })

      const sorted = Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount)
      setData(sorted)
    } catch { toast.error("Failed to load data") }
    finally { setLoading(false) }
  }

  const handleExport = () => {
    exportToCSV(data, [
      { key: "customerName", label: "Customer" },
      { key: "invoiceCount", label: "Invoices" },
      { key: "totalAmount", label: "Total Amount" },
      { key: "paidAmount", label: "Paid" },
      { key: "outstanding", label: "Outstanding" },
    ], `Sales_By_Customer_${startDate}_${endDate}`)
  }

  const totalSales = data.reduce((s, d) => s + d.totalAmount, 0)

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-4 items-end flex-wrap">
        <div><Label>From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      {data.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="customerName" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Sales"]} />
                <Bar dataKey="totalAmount" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sales by Customer — Total: ₹{totalSales.toLocaleString("en-IN")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : data.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No data for selected period</TableCell></TableRow>
              ) : data.map(d => (
                <TableRow key={d.customerName}>
                  <TableCell className="font-medium">{d.customerName}</TableCell>
                  <TableCell className="text-right">{d.invoiceCount}</TableCell>
                  <TableCell className="text-right font-mono">₹{d.totalAmount.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right font-mono text-green-600">₹{d.paidAmount.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">₹{d.outstanding.toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
