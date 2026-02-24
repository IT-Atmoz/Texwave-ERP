"use client"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Edit, Trash2, Pause, Play, Square } from "lucide-react"
import { toast } from "sonner"
import { getAllRecords, deleteRecord, updateRecord } from "@/services/firebase"

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-800",
  Paused: "bg-yellow-100 text-yellow-800",
  Stopped: "bg-red-100 text-red-800",
  Expired: "bg-gray-100 text-gray-800",
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  "half-yearly": "Half-Yearly",
  yearly: "Yearly",
  custom: "Custom",
}

export default function RecurringInvoices() {
  const [profiles, setProfiles] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const data = await getAllRecords("sales/recurringInvoiceProfiles")
      setProfiles((data as any[]).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
    } catch { toast.error("Failed to load recurring profiles") }
    finally { setLoading(false) }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateRecord("sales/recurringInvoiceProfiles", id, { status: newStatus })
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))
      toast.success(`Profile ${newStatus.toLowerCase()}`)
    } catch { toast.error("Failed to update status") }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete recurring profile "${name}"?`)) return
    try {
      await deleteRecord("sales/recurringInvoiceProfiles", id)
      setProfiles(prev => prev.filter(p => p.id !== id))
      toast.success("Deleted")
    } catch { toast.error("Failed to delete") }
  }

  const filtered = profiles.filter(p => {
    const s = search.toLowerCase()
    const matchesSearch = !s || p.profileName?.toLowerCase().includes(s) || p.customerName?.toLowerCase().includes(s)
    const matchesStatus = statusFilter === "all" || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Recurring Invoices</h2>
          <p className="text-muted-foreground text-sm">{filtered.length} profile{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => navigate("/sales/recurring-invoices/create")} size="lg">
          <Plus className="h-5 w-5 mr-2" /> New Recurring Profile
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search profiles..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Paused">Paused</SelectItem>
                <SelectItem value="Stopped">Stopped</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Invoice</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
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
                        <p className="text-lg font-medium">No recurring profiles yet</p>
                        <p className="text-sm">Set up automatic invoice generation for repeat customers</p>
                        <Button onClick={() => navigate("/sales/recurring-invoices/create")}>
                          <Plus className="h-4 w-4 mr-2" />Create First Profile
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.map(p => (
                  <TableRow key={p.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{p.profileName}</TableCell>
                    <TableCell>{p.customerName}</TableCell>
                    <TableCell>{FREQUENCY_LABELS[p.frequency] || p.frequency}</TableCell>
                    <TableCell>{p.nextInvoiceDate || "—"}</TableCell>
                    <TableCell className="text-right font-mono">₹{(p.grandTotal || 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[p.status] || STATUS_COLORS.Active}>{p.status || "Active"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/sales/recurring-invoices/edit/${p.id}`)} title="Edit"><Edit className="h-4 w-4" /></Button>
                        {p.status === "Active" && (
                          <Button variant="ghost" size="icon" onClick={() => handleStatusChange(p.id, "Paused")} title="Pause"><Pause className="h-4 w-4 text-yellow-600" /></Button>
                        )}
                        {p.status === "Paused" && (
                          <Button variant="ghost" size="icon" onClick={() => handleStatusChange(p.id, "Active")} title="Resume"><Play className="h-4 w-4 text-green-600" /></Button>
                        )}
                        {(p.status === "Active" || p.status === "Paused") && (
                          <Button variant="ghost" size="icon" onClick={() => handleStatusChange(p.id, "Stopped")} title="Stop"><Square className="h-4 w-4 text-red-600" /></Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id, p.profileName)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
