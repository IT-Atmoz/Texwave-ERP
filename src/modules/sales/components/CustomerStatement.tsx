"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, X } from "lucide-react"
import { toast } from "sonner"
import { getAllRecords } from "@/services/firebase"
import { exportToCSV } from "../utils/csvExport"

interface CustomerStatementProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  customerName: string
}

interface Transaction {
  date: string
  type: string
  number: string
  description: string
  debit: number
  credit: number
  balance: number
}

export default function CustomerStatement({ open, onOpenChange, customerId, customerName }: CustomerStatementProps) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    return d.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && customerId) loadStatement()
  }, [open, customerId, startDate, endDate])

  const loadStatement = async () => {
    setLoading(true)
    try {
      const [invoices, payments, creditNotes] = await Promise.all([
        getAllRecords("sales/invoices"),
        getAllRecords("sales/paymentsReceived"),
        getAllRecords("sales/creditNotes"),
      ])

      const txns: Transaction[] = []

      // Add invoices
      ;(invoices as any[])
        .filter((inv: any) => inv.customerId === customerId)
        .forEach((inv: any) => {
          const date = inv.invoiceDate || inv.date || ""
          if (date >= startDate && date <= endDate) {
            txns.push({
              date,
              type: "Invoice",
              number: inv.invoiceNumber || "",
              description: `Invoice to ${customerName}`,
              debit: inv.grandTotal || 0,
              credit: 0,
              balance: 0,
            })
          }
        })

      // Add payments
      ;(payments as any[])
        .filter((p: any) => p.customerId === customerId)
        .forEach((p: any) => {
          const date = p.paymentDate || p.date || ""
          if (date >= startDate && date <= endDate) {
            txns.push({
              date,
              type: "Payment",
              number: p.paymentNumber || "",
              description: `Payment received — ${p.mode || ""}`,
              debit: 0,
              credit: p.amount || 0,
              balance: 0,
            })
          }
        })

      // Add credit notes
      ;(creditNotes as any[])
        .filter((cn: any) => cn.customerId === customerId)
        .forEach((cn: any) => {
          const date = cn.date || ""
          if (date >= startDate && date <= endDate) {
            txns.push({
              date,
              type: "Credit Note",
              number: cn.cnNumber || "",
              description: `Credit note — ${cn.reason || ""}`,
              debit: 0,
              credit: cn.total || 0,
              balance: 0,
            })
          }
        })

      // Sort by date
      txns.sort((a, b) => a.date.localeCompare(b.date))

      // Calculate running balance
      let balance = 0
      txns.forEach(t => {
        balance += t.debit - t.credit
        t.balance = balance
      })

      setTransactions(txns)
    } catch {
      toast.error("Failed to load statement")
    } finally {
      setLoading(false)
    }
  }

  const totalDebit = transactions.reduce((s, t) => s + t.debit, 0)
  const totalCredit = transactions.reduce((s, t) => s + t.credit, 0)
  const closingBalance = totalDebit - totalCredit

  const handleExportCSV = () => {
    exportToCSV(
      transactions,
      [
        { key: "date", label: "Date" },
        { key: "type", label: "Type" },
        { key: "number", label: "Number" },
        { key: "description", label: "Description" },
        { key: "debit", label: "Debit" },
        { key: "credit", label: "Credit" },
        { key: "balance", label: "Balance" },
      ],
      `Statement_${customerName}_${startDate}_${endDate}`
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customer Statement — {customerName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4 items-end">
            <div>
              <Label>From</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Invoiced</div>
              <div className="text-lg font-bold text-red-600">{totalDebit.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Received</div>
              <div className="text-lg font-bold text-green-600">{totalCredit.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-muted-foreground">Outstanding</div>
              <div className={`text-lg font-bold ${closingBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                {closingBalance.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No transactions in this period
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>{t.date}</TableCell>
                      <TableCell>
                        <Badge variant={t.type === "Invoice" ? "default" : "secondary"}>{t.type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">{t.number}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.description}</TableCell>
                      <TableCell className="text-right font-mono">{t.debit > 0 ? `₹${t.debit.toLocaleString("en-IN")}` : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{t.credit > 0 ? `₹${t.credit.toLocaleString("en-IN")}` : "—"}</TableCell>
                      <TableCell className={`text-right font-mono font-bold ${t.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                        ₹{t.balance.toLocaleString("en-IN")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
