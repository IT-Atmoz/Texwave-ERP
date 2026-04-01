import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { database } from '@/services/firebase';
import { Project } from './types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FolderKanban, TrendingUp, Clock, IndianRupee,
  CheckCircle2, Pause, XCircle, Plus, ChevronRight,
  Users,
} from 'lucide-react';

export default function ProjectsDashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const unsub = onValue(ref(database, 'projects'), (snap) => {
      const val = snap.val() || {};
      const list: Project[] = Object.entries(val).map(([id, p]: [string, any]) => ({
        id,
        ...p,
        members: p.members || {},
      }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setProjects(list);
    });
    return () => unsub();
  }, []);

  const byStatus = (s: string) => projects.filter((p) => p.status === s);
  const totalHoursEstimated = projects.reduce((s, p) => s + (p.estimatedHours || 0), 0);
  const totalHoursLogged = projects.reduce((s, p) => {
    return s + Object.values(p.members).reduce((ms, m) => ms + (m.loggedHours || 0), 0);
  }, 0);
  const totalBudget = projects.reduce((s, p) => s + (p.estimatedCost || 0), 0);
  const totalSpent = projects.reduce((s, p) => s + (p.actualCost || 0), 0);

  const statCards = [
    {
      label: 'Total Projects',
      value: projects.length,
      icon: FolderKanban,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: `${byStatus('active').length} active`,
    },
    {
      label: 'Hours Logged',
      value: `${totalHoursLogged}h`,
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: `of ${totalHoursEstimated}h estimated`,
    },
    {
      label: 'Total Budget',
      value: `₹${totalBudget.toLocaleString()}`,
      icon: IndianRupee,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      sub: `₹${totalSpent.toLocaleString()} spent`,
    },
    {
      label: 'Completed',
      value: byStatus('completed').length,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      sub: `${byStatus('on-hold').length} on hold`,
    },
  ];

  const statusBadge: Record<string, string> = {
    active:    'bg-green-100 text-green-700',
    'on-hold': 'bg-yellow-100 text-yellow-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Project Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Overview of all projects and their progress</p>
        </div>
        <Button onClick={() => navigate('/projects/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <div className={`h-8 w-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { status: 'active',    label: 'Active',    icon: TrendingUp,  color: 'text-green-600',  bg: 'bg-green-50' },
          { status: 'on-hold',   label: 'On Hold',   icon: Pause,       color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { status: 'completed', label: 'Completed', icon: CheckCircle2,color: 'text-blue-600',   bg: 'bg-blue-50' },
          { status: 'cancelled', label: 'Cancelled', icon: XCircle,     color: 'text-red-500',    bg: 'bg-red-50' },
        ].map(({ status, label, icon: Icon, color, bg }) => {
          const list = byStatus(status);
          const budget = list.reduce((s, p) => s + (p.estimatedCost || 0), 0);
          return (
            <div key={status} className={`rounded-xl border p-4 ${bg} border-transparent`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className={`text-sm font-semibold ${color}`}>{label}</span>
              </div>
              <p className={`text-3xl font-bold ${color}`}>{list.length}</p>
              <p className="text-xs text-muted-foreground mt-1">₹{budget.toLocaleString()} budget</p>
            </div>
          );
        })}
      </div>

      {/* Recent projects table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Recent Projects</h2>
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigate('/projects/list')}>
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No projects yet. Create your first project.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Project</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Team</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Hours</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Budget</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.slice(0, 8).map((p) => {
                const memberCount = Object.keys(p.members).length;
                const logged = Object.values(p.members).reduce((s, m) => s + (m.loggedHours || 0), 0);
                return (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{p.name}</p>
                      {p.endDate && (
                        <p className="text-xs text-muted-foreground mt-0.5">Due {p.endDate}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{p.client || '—'}</td>
                    <td className="px-4 py-3.5">
                      <Badge className={`text-xs ${statusBadge[p.status] || ''}`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1).replace('-', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Users className="h-3.5 w-3.5" />
                        {memberCount}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-medium">{logged}h</span>
                      <span className="text-muted-foreground"> / {p.estimatedHours || 0}h</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-medium">₹{(p.actualCost || 0).toLocaleString()}</span>
                      <span className="text-muted-foreground"> / ₹{(p.estimatedCost || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
