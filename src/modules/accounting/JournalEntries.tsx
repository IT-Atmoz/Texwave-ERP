import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createRecord, deleteRecord, getAllRecords } from '@/services/firebase';

interface JournalLine {
  account: string;
  debit: number;
  credit: number;
  description: string;
}

const emptyLine = (): JournalLine => ({ account: '', debit: 0, credit: 0, description: '' });

export default function JournalEntries() {
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    lines: [emptyLine(), emptyLine()],
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [ent, acc] = await Promise.all([
        getAllRecords('accounting/journalEntries'),
        getAllRecords('accounting/chartOfAccounts'),
      ]);
      setEntries(ent.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)));
      setAccounts(acc.sort((a: any, b: any) => (a.code || '').localeCompare(b.code || '')));
    } catch { toast.error('Failed to load journal entries'); }
  };

  const updateLine = (idx: number, field: keyof JournalLine, value: any) => {
    setForm((f) => {
      const lines = [...f.lines];
      lines[idx] = { ...lines[idx], [field]: field === 'account' || field === 'description' ? value : parseFloat(value) || 0 };
      return { ...f, lines };
    });
  };

  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  const removeLine = (idx: number) => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));

  const totalDebit = form.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const generateEntryId = async () => {
    const existing = await getAllRecords('accounting/journalEntries').catch(() => []);
    return `JE-${new Date().getFullYear()}-${String(existing.length + 1).padStart(4, '0')}`;
  };

  const handleSave = async () => {
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (form.lines.some((l) => !l.account)) { toast.error('All lines must have an account'); return; }
    if (!isBalanced) { toast.error(`Debits (${totalDebit.toFixed(2)}) must equal Credits (${totalCredit.toFixed(2)})`); return; }

    setSaving(true);
    try {
      const entryId = await generateEntryId();
      await createRecord('accounting/journalEntries', {
        entryId,
        date: form.date,
        reference: form.reference,
        description: form.description,
        lines: form.lines,
        totalDebit,
        totalCredit,
      });
      toast.success('Journal entry created');
      setOpen(false);
      setForm({ date: new Date().toISOString().split('T')[0], reference: '', description: '', lines: [emptyLine(), emptyLine()] });
      loadAll();
    } catch { toast.error('Failed to save journal entry'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, eid: string) => {
    if (!confirm(`Delete journal entry ${eid}?`)) return;
    try {
      await deleteRecord('accounting/journalEntries', id);
      toast.success('Entry deleted');
      loadAll();
    } catch { toast.error('Failed to delete'); }
  };

  const filtered = entries.filter((e) => {
    const s = search.toLowerCase();
    return e.entryId?.toLowerCase().includes(s) || e.description?.toLowerCase().includes(s) || e.reference?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Journal Entries</h2>
          <p className="text-muted-foreground text-sm">{entries.length} entries recorded</p>
        </div>
        <Button onClick={() => setOpen(true)} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          New Entry
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="pb-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search entries..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                      {search ? <>No entries for "{search}"</> : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="text-xl">No journal entries yet</div>
                          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Create entry</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-muted/50">
                      <TableCell><Badge variant="secondary" className="font-mono">{entry.entryId}</Badge></TableCell>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.reference || '—'}</TableCell>
                      <TableCell className="font-medium">{entry.description}</TableCell>
                      <TableCell className="text-right font-mono">₹{(entry.totalDebit || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right font-mono">₹{(entry.totalCredit || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id, entry.entryId)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="Invoice / Bill no." />
              </div>
              <div className="space-y-1 col-span-1">
                <Label>Description *</Label>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Narration" />
              </div>
            </div>

            {/* Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lines</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />Add Line
                </Button>
              </div>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-32 text-right">Debit (₹)</TableHead>
                      <TableHead className="w-32 text-right">Credit (₹)</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.lines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Select value={line.account} onValueChange={(v) => updateLine(idx, 'account', v)}>
                            <SelectTrigger className="min-w-[180px]"><SelectValue placeholder="Select account" /></SelectTrigger>
                            <SelectContent>
                              {accounts.map((a: any) => (
                                <SelectItem key={a.id} value={a.name}>{a.code} — {a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)} placeholder="Note" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={line.debit || ''} onChange={(e) => updateLine(idx, 'debit', e.target.value)} className="text-right" min={0} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={line.credit || ''} onChange={(e) => updateLine(idx, 'credit', e.target.value)} className="text-right" min={0} />
                        </TableCell>
                        <TableCell>
                          {form.lines.length > 2 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(idx)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={2} className="font-semibold text-right text-sm">Totals:</TableCell>
                      <TableCell className={`text-right font-mono font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{totalDebit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{totalCredit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              {!isBalanced && totalDebit > 0 && (
                <p className="text-sm text-destructive">Debits and credits must balance. Difference: ₹{Math.abs(totalDebit - totalCredit).toFixed(2)}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !isBalanced}>
                {saving ? 'Saving...' : 'Post Entry'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
