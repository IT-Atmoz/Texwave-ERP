"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { updateRecord } from "@/services/firebase"

interface ApprovalEntry {
  action: "approved" | "rejected" | "submitted"
  by: string
  at: string
  comments?: string
}

interface ApprovalBannerProps {
  documentId: string
  documentType: string
  firebasePath: string
  approvalStatus?: "pending" | "approved" | "rejected" | "not_required"
  approvalHistory?: ApprovalEntry[]
  onStatusChange?: (newStatus: string, history: ApprovalEntry[]) => void
  currentUser?: string
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "bg-yellow-50 border-yellow-300", textColor: "text-yellow-800", badge: "bg-yellow-100 text-yellow-800", label: "Pending Approval" },
  approved: { icon: CheckCircle2, color: "bg-green-50 border-green-300", textColor: "text-green-800", badge: "bg-green-100 text-green-800", label: "Approved" },
  rejected: { icon: XCircle, color: "bg-red-50 border-red-300", textColor: "text-red-800", badge: "bg-red-100 text-red-800", label: "Rejected" },
  not_required: { icon: AlertTriangle, color: "bg-gray-50 border-gray-300", textColor: "text-gray-600", badge: "bg-gray-100 text-gray-800", label: "No Approval Required" },
}

export default function ApprovalBanner({
  documentId,
  documentType,
  firebasePath,
  approvalStatus = "not_required",
  approvalHistory = [],
  onStatusChange,
  currentUser = "Admin",
}: ApprovalBannerProps) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectComments, setRejectComments] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [processing, setProcessing] = useState(false)

  if (approvalStatus === "not_required") return null

  const config = STATUS_CONFIG[approvalStatus]
  const Icon = config.icon

  const handleApprove = async () => {
    setProcessing(true)
    try {
      const entry: ApprovalEntry = { action: "approved", by: currentUser, at: new Date().toISOString() }
      const newHistory = [...approvalHistory, entry]
      await updateRecord(firebasePath, documentId, { approvalStatus: "approved", approvalHistory: newHistory })
      onStatusChange?.("approved", newHistory)
      toast.success(`${documentType} approved`)
    } catch { toast.error("Failed to approve") }
    finally { setProcessing(false) }
  }

  const handleReject = async () => {
    if (!rejectComments.trim()) { toast.error("Please provide rejection comments"); return }
    setProcessing(true)
    try {
      const entry: ApprovalEntry = { action: "rejected", by: currentUser, at: new Date().toISOString(), comments: rejectComments }
      const newHistory = [...approvalHistory, entry]
      await updateRecord(firebasePath, documentId, { approvalStatus: "rejected", approvalHistory: newHistory })
      onStatusChange?.("rejected", newHistory)
      setRejectOpen(false)
      setRejectComments("")
      toast.success(`${documentType} rejected`)
    } catch { toast.error("Failed to reject") }
    finally { setProcessing(false) }
  }

  return (
    <>
      <div className={`border rounded-lg p-4 ${config.color}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className={`h-5 w-5 ${config.textColor}`} />
            <div>
              <Badge className={config.badge}>{config.label}</Badge>
              {approvalHistory.length > 0 && (
                <button onClick={() => setShowHistory(!showHistory)} className="ml-3 text-sm underline text-muted-foreground">
                  {showHistory ? "Hide" : "View"} history ({approvalHistory.length})
                </button>
              )}
            </div>
          </div>
          {approvalStatus === "pending" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApprove} disabled={processing} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} disabled={processing}>
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
          )}
        </div>

        {showHistory && approvalHistory.length > 0 && (
          <div className="mt-3 space-y-2 border-t pt-3">
            {approvalHistory.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <div className={`mt-1 w-2 h-2 rounded-full ${entry.action === "approved" ? "bg-green-500" : entry.action === "rejected" ? "bg-red-500" : "bg-blue-500"}`} />
                <div>
                  <span className="font-medium capitalize">{entry.action}</span> by {entry.by}
                  <span className="text-muted-foreground"> on {new Date(entry.at).toLocaleDateString("en-IN")}</span>
                  {entry.comments && <p className="text-muted-foreground mt-0.5">{entry.comments}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject {documentType}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea value={rejectComments} onChange={e => setRejectComments(e.target.value)} placeholder="Reason for rejection..." rows={3} />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} disabled={processing}>
                {processing ? "Rejecting..." : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
