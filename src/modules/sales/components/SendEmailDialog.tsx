"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Send, Paperclip } from "lucide-react"
import { toast } from "sonner"
import { updateRecord } from "@/services/firebase"

interface SendEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentType: string
  documentNumber: string
  documentId: string
  firebasePath: string
  customerName: string
  customerEmail?: string
  onSent?: () => void
}

const MERGE_FIELDS = [
  { key: "{{customerName}}", label: "Customer Name" },
  { key: "{{documentNumber}}", label: "Document Number" },
  { key: "{{amount}}", label: "Amount" },
  { key: "{{dueDate}}", label: "Due Date" },
  { key: "{{companyName}}", label: "Company Name" },
]

export default function SendEmailDialog({
  open,
  onOpenChange,
  documentType,
  documentNumber,
  documentId,
  firebasePath,
  customerName,
  customerEmail = "",
  onSent,
}: SendEmailDialogProps) {
  const [to, setTo] = useState(customerEmail)
  const [cc, setCc] = useState("")
  const [subject, setSubject] = useState(`${documentType} ${documentNumber} from Fluoro Automation Seals`)
  const [body, setBody] = useState(
    `Dear {{customerName}},\n\nPlease find attached ${documentType.toLowerCase()} ${documentNumber}.\n\nPlease review and let us know if you have any questions.\n\nBest regards,\nFluoro Automation Seals Pvt Ltd`
  )
  const [attachPDF, setAttachPDF] = useState(true)
  const [sending, setSending] = useState(false)

  const insertMergeField = (field: string) => {
    setBody(prev => prev + field)
  }

  const handleSend = async () => {
    if (!to.trim()) { toast.error("Enter recipient email"); return }

    setSending(true)
    try {
      // Mark document as 'Sent' in Firebase
      await updateRecord(firebasePath, documentId, {
        status: "Sent",
        sentAt: new Date().toISOString(),
        sentTo: to,
        emailSubject: subject,
      })

      // Note: Actual email delivery requires backend integration
      toast.success(`${documentType} marked as sent to ${to}`)
      onSent?.()
      onOpenChange(false)
    } catch {
      toast.error("Failed to send")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <Send className="h-5 w-5 inline mr-2" />
            Send {documentType} — {documentNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>To *</Label>
              <Input value={to} onChange={e => setTo(e.target.value)} placeholder="customer@example.com" type="email" />
            </div>
            <div className="col-span-2">
              <Label>CC</Label>
              <Input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" type="email" />
            </div>
          </div>

          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Message Body</Label>
              <div className="flex gap-1 flex-wrap">
                {MERGE_FIELDS.map(f => (
                  <button key={f.key} onClick={() => insertMergeField(f.key)} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100" title={`Insert ${f.label}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} className="font-mono text-sm" />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="attach-pdf" checked={attachPDF} onCheckedChange={(v) => setAttachPDF(!!v)} />
            <label htmlFor="attach-pdf" className="text-sm flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" /> Attach PDF
            </label>
          </div>

          <p className="text-xs text-muted-foreground bg-yellow-50 p-2 rounded">
            Note: This will mark the document as "Sent". Actual email delivery requires backend email service integration.
          </p>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending} className="bg-blue-700 hover:bg-blue-800">
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
