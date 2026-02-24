"use client"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Edit, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getAllRecords, deleteRecord } from "@/services/firebase"

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-800",
  Sent: "bg-blue-100 text-blue-800",
  Paid: "bg-green-100 text-green-800",
  "Partially Paid": "bg-yellow-100 text-yellow-800",
  Drawn: "bg-purple-100 text-purple-800",
  "Partially Drawn": "bg-indigo-100 text-indigo-800",
}

export default function RetainerInvoices() {
  const [retainers, setRetainers] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const data = await getAllRecords("sales/retainerInvoices")
      setRetainers((data as any[]).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    } catch { toast.error("Failed to load retainer invoices") }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string, num: string) => {
    if (!confirm(`Delete retainer invoice ${num}?`)) return
    try {
      await deleteRecord("sales/retainerInvoices", id)
      setRetainers(prev => prev.filter(r => r.id !== id))
      toast.success("Deleted")
    } catch { toast.error("Failed to delete") }
  }

  const filtered = retainers.filter(r => {
    const s = search.toLowerCase()
    const matchesSearch = !s || r.retainerNumber?.toLowerCase().includes(s) || r.customerName?.toLowerCase().includes(s)
    const matchesStatus = statusFilter === "all" || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalAmount = filtered.reduce((sum, r) => sum + (r.amount || 0), 0)
  const totalUnused = filtered.reduce((sum, r) => sum + (r.unusedBalance || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Retainer Invoices</h2>
          <p className="text-muted-foreground text-sm">
            {filtered.length} retainer{filtered.length !== 1 ? "s" : ""} | Total: ₹{totalAmount.toLocaleString("en-IN")} | Unused: ₹{totalUnused.toLocaleString("en-IN")}
          </p>
        </div>
        <Button onClick={() => navigate("/sales/retainer-invoices/create")} size="lg">
          <Plus className="h-5 w-5 mr-2" /> New Retainer Invoice
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search retainer invoices..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Sent">Sent</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                <SelectItem value="Drawn">Drawn</SelectItem>
                <SelectItem value="Partially Drawn">Partially Drawn</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Retainer #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Unused Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-lg font-medium">No retainer invoices yet</p>
                        <p className="text-sm">Collect advance payments from customers with retainer invoices</p>
                        <Button onClick={() => navigate("/sales/retainer-invoices/create")}>
                          <Plus className="h-4 w-4 mr-2" />Create First Retainer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/50">
                    <TableCell><Badge variant="secondary" className="font-mono">{r.retainerNumber}</Badge></TableCell>
                    <TableCell>{r.date}</TableCell>
                    <TableCell className="font-medium">{r.customerName}</TableCell>
                    <TableCell className="text-right font-mono">₹{(r.amount || 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">₹{(r.unusedBalance || 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[r.status] || STATUS_COLORS.Draft}>{r.status || "Draft"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/sales/retainer-invoices/edit/${r.id}`)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id, r.retainerNumber)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
