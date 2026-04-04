import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ref, onValue, set } from 'firebase/database';
import { database } from '@/services/firebase';
import { Project, ProjectMember, ProjectStatus } from './types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, Pencil, Calendar, Users, Clock, IndianRupee,
  CheckCircle2, TrendingUp, AlertTriangle, Save, X,
} from 'lucide-react';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  active:    { label: 'Active',     className: 'bg-green-100 text-green-700 border-green-200' },
  'on-hold': { label: 'On Hold',    className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  completed: { label: 'Completed',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
  cancelled: { label: 'Cancelled',  className: 'bg-red-100 text-red-700 border-red-200' },
};

function ProgressBar({ value, max, color = 'bg-primary' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const isOver = pct >= 100;
  return (
    <div className="space-y-1">
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOver ? 'bg-red-400' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{pct}% used</p>
    </div>
  );
}

export default function ProjectDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);

  // Inline editing for logged hours
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editHours, setEditHours] = useState('');
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onValue(ref(database, `projects/${id}`), (snap) => {
      if (!snap.exists()) { setProject(null); return; }
      setProject({ id: id!, ...snap.val(), members: snap.val().members || {} });
    });
    return () => unsub();
  }, [id]);

  const saveLoggedHours = async (memberKey: string) => {
    if (!project) return;
    setSavingHours(true);
    try {
      await set(
        ref(database, `projects/${id}/members/${memberKey}/loggedHours`),
        Number(editHours) || 0
      );
      toast({ title: 'Logged hours updated' });
      setEditingMember(null);
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    } finally {
      setSavingHours(false);
    }
  };

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Project not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/projects/list')}>
          Back to projects
        </Button>
      </div>
    );
  }

  const members = Object.entries(project.members).map(([key, m]) => ({ key, ...m }));
  const totalLogged = members.reduce((s, m) => s + (m.loggedHours || 0), 0);
  const totalEstHours = project.estimatedHours || 0;
  const totalEstCost = project.estimatedCost || 0;
  const totalActualCost = project.actualCost || 0;
  const memberCost = members.reduce((s, m) => s + (m.loggedHours || 0) * (m.hourlyRate || 0), 0);
  const cfg = STATUS_CONFIG[project.status] || STATUS_CONFIG['active'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 mt-0.5" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
              {project.client && (
                <span className="text-sm text-muted-foreground">· {project.client}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
            )}
            {(project.startDate || project.endDate) && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                <Calendar className="h-3.5 w-3.5" />
                {project.startDate || '?'} → {project.endDate || 'TBD'}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => navigate(`/projects/edit/${id}`)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit Project
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Hours */}
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hours</p>
            <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Clock className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <div className="flex items-end gap-1 mb-3">
            <span className="text-3xl font-bold text-foreground">{totalLogged}</span>
            <span className="text-sm text-muted-foreground mb-1">/ {totalEstHours}h</span>
          </div>
          <ProgressBar value={totalLogged} max={totalEstHours} color="bg-purple-500" />
          {totalLogged > totalEstHours && totalEstHours > 0 && (
            <p className="flex items-center gap-1 text-xs text-red-500 mt-2">
              <AlertTriangle className="h-3 w-3" />
              Over by {totalLogged - totalEstHours}h
            </p>
          )}
        </div>

        {/* Budget */}
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Budget</p>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div className="flex items-end gap-1 mb-3">
            <span className="text-3xl font-bold text-foreground">₹{totalActualCost.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground mb-1">/ ₹{totalEstCost.toLocaleString()}</span>
          </div>
          <ProgressBar value={totalActualCost} max={totalEstCost} color="bg-emerald-500" />
          {totalActualCost > totalEstCost && totalEstCost > 0 && (
            <p className="flex items-center gap-1 text-xs text-red-500 mt-2">
              <AlertTriangle className="h-3 w-3" />
              Over by ₹{(totalActualCost - totalEstCost).toLocaleString()}
            </p>
          )}
        </div>

        {/* Team cost */}
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Cost</p>
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <div className="flex items-end gap-1 mb-2">
            <span className="text-3xl font-bold text-foreground">₹{memberCost.toLocaleString()}</span>
          </div>
          <p className="text-xs text-muted-foreground">based on logged hours × hourly rates</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
            <Users className="h-3 w-3" />
            {members.length} team member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Team table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Team Members</h2>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => navigate(`/projects/edit/${id}`)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Manage Team
          </Button>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-7 w-7 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No team members assigned yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Member</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Role</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Est. Hours</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Logged Hours</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Rate/hr</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Cost</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => {
                const pct = m.estimatedHours > 0
                  ? Math.min(100, Math.round((m.loggedHours / m.estimatedHours) * 100))
                  : 0;
                const cost = (m.loggedHours || 0) * (m.hourlyRate || 0);
                const isEditing = editingMember === m.key;

                return (
                  <tr key={m.key} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-medium text-foreground">{m.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{m.role || '—'}</td>
                    <td className="px-4 py-3.5 text-right font-medium">{m.estimatedHours}h</td>
                    <td className="px-4 py-3.5 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Input
                            type="number"
                            min="0"
                            value={editHours}
                            onChange={(e) => setEditHours(e.target.value)}
                            className="h-7 w-20 text-sm text-right"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={savingHours}
                            onClick={() => saveLoggedHours(m.key)}
                          >
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditingMember(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="flex items-center justify-end gap-1.5 w-full group"
                          onClick={() => {
                            setEditingMember(m.key);
                            setEditHours(String(m.loggedHours || 0));
                          }}
                        >
                          <span className={`font-medium ${m.loggedHours > m.estimatedHours && m.estimatedHours > 0 ? 'text-red-500' : ''}`}>
                            {m.loggedHours}h
                          </span>
                          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right text-muted-foreground">
                      {m.hourlyRate ? `₹${m.hourlyRate}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium">
                      {cost > 0 ? `₹${cost.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 w-32">
                      <div className="space-y-0.5">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-red-400' : 'bg-primary'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground text-right">{pct}%</p>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30">
                <td className="px-5 py-3 font-semibold text-foreground" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {members.reduce((s, m) => s + (m.estimatedHours || 0), 0)}h
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {totalLogged}h
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right font-semibold">
                  ₹{memberCost.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-xs">
                    {totalLogged > totalEstHours && totalEstHours > 0 ? (
                      <span className="flex items-center gap-1 text-red-500 font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        Over budget
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        On track
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
