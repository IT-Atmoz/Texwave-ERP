"use client"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Edit, Trash2, Eye, FileText } from "lucide-react"
import { toast } from "sonner"
import { getAllRecords, deleteRecord } from "@/services/firebase"

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-800",
  Open: "bg-blue-100 text-blue-800",
  Delivered: "bg-green-100 text-green-800",
  Invoiced: "bg-purple-100 text-purple-800",
  Returned: "bg-red-100 text-red-800",
}

export default function DeliveryChallans() {
  const [challans, setChallans] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const data = await getAllRecords("sales/deliveryChallans")
      setChallans((data as any[]).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    } catch { toast.error("Failed to load delivery challans") }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string, num: string) => {
    if (!confirm(`Delete delivery challan ${num}?`)) return
    try {
      await deleteRecord("sales/deliveryChallans", id)
      setChallans(prev => prev.filter(d => d.id !== id))
      toast.success("Deleted")
    } catch { toast.error("Failed to delete") }
  }

  const filtered = challans.filter(dc => {
    const s = search.toLowerCase()
    const matchesSearch = !s || dc.dcNumber?.toLowerCase().includes(s) || dc.customerName?.toLowerCase().includes(s)
    const matchesStatus = statusFilter === "all" || dc.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Delivery Challans</h2>
          <p className="text-muted-foreground text-sm">{filtered.length} challan{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => navigate("/sales/delivery-challans/create")} size="lg">
          <Plus className="h-5 w-5 mr-2" /> New Delivery Challan
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by DC number or customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
                <SelectItem value="Invoiced">Invoiced</SelectItem>
                <SelectItem value="Returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DC Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Challan Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      {search || statusFilter !== "all" ? "No challans match your filters" : (
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-lg font-medium">No delivery challans yet</p>
                          <Button onClick={() => navigate("/sales/delivery-challans/create")}>
                            <Plus className="h-4 w-4 mr-2" />Create First DC
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : filtered.map(dc => (
                  <TableRow key={dc.id} className="hover:bg-muted/50">
                    <TableCell><Badge variant="secondary" className="font-mono">{dc.dcNumber}</Badge></TableCell>
                    <TableCell>{dc.dcDate}</TableCell>
                    <TableCell className="font-medium">{dc.customerName}</TableCell>
                    <TableCell>{dc.challanType || "Delivery"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[dc.status] || STATUS_COLORS.Draft}>{dc.status || "Draft"}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{dc.totalQty || 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/sales/delivery-challans/edit/${dc.id}`)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {dc.status === "Delivered" && !dc.convertedToInvoiceId && (
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/sales/invoices/create?fromDC=${dc.id}`)} title="Convert to Invoice">
                            <FileText className="h-4 w-4 text-purple-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(dc.id, dc.dcNumber)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
