import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { database } from '@/services/firebase';
import { Project } from './types';
import { TrendingUp, Clock, IndianRupee, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function ProjectAnalytics() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const unsub = onValue(ref(database, 'projects'), (snap) => {
      const val = snap.val() || {};
      setProjects(
        Object.entries(val).map(([id, p]: [string, any]) => ({
          id,
          ...p,
          members: p.members || {},
        }))
      );
    });
    return () => unsub();
  }, []);

  const totalBudget = projects.reduce((s, p) => s + (p.estimatedCost || 0), 0);
  const totalSpent = projects.reduce((s, p) => s + (p.actualCost || 0), 0);
  const totalEstHours = projects.reduce((s, p) => s + (p.estimatedHours || 0), 0);
  const totalLoggedHours = projects.reduce((s, p) => {
    return s + Object.values(p.members).reduce((ms, m) => ms + (m.loggedHours || 0), 0);
  }, 0);

  // Per-employee aggregation
  const empMap: Record<string, { name: string; loggedHours: number; estimatedHours: number; projects: string[] }> = {};
  projects.forEach((p) => {
    Object.entries(p.members).forEach(([, m]) => {
      if (!m.empId) return;
      if (!empMap[m.empId]) {
        empMap[m.empId] = { name: m.name, loggedHours: 0, estimatedHours: 0, projects: [] };
      }
      empMap[m.empId].loggedHours += m.loggedHours || 0;
      empMap[m.empId].estimatedHours += m.estimatedHours || 0;
      if (!empMap[m.empId].projects.includes(p.name)) {
        empMap[m.empId].projects.push(p.name);
      }
    });
  });
  const empList = Object.entries(empMap)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => b.loggedHours - a.loggedHours);

  // Projects over-hours
  const overHours = projects.filter((p) => {
    const logged = Object.values(p.members).reduce((s, m) => s + (m.loggedHours || 0), 0);
    return p.estimatedHours > 0 && logged > p.estimatedHours;
  });

  const overBudget = projects.filter((p) => p.estimatedCost > 0 && (p.actualCost || 0) > p.estimatedCost);

  const statusCounts = ['active', 'on-hold', 'completed', 'cancelled'].map((s) => ({
    status: s,
    count: projects.filter((p) => p.status === s).length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Project Analytics</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Insights across all projects and team members</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Budget Utilisation', value: totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}%` : '—', sub: `₹${totalSpent.toLocaleString()} of ₹${totalBudget.toLocaleString()}`, icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Hours Utilisation', value: totalEstHours > 0 ? `${Math.round((totalLoggedHours / totalEstHours) * 100)}%` : '—', sub: `${totalLoggedHours}h of ${totalEstHours}h`, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Over-Hours Projects', value: overHours.length, sub: `${projects.length - overHours.length} on track`, icon: AlertTriangle, color: overHours.length > 0 ? 'text-red-500' : 'text-green-600', bg: overHours.length > 0 ? 'bg-red-50' : 'bg-green-50' },
          { label: 'Over-Budget Projects', value: overBudget.length, sub: `${projects.length - overBudget.length} within budget`, icon: TrendingUp, color: overBudget.length > 0 ? 'text-red-500' : 'text-green-600', bg: overBudget.length > 0 ? 'bg-red-50' : 'bg-green-50' },
        ].map((s) => {
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

      <div className="grid grid-cols-2 gap-6">
        {/* Status breakdown */}
        <div className="bg-white border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Projects by Status</h2>
          <div className="space-y-3">
            {statusCounts.map(({ status, count }) => {
              const pct = projects.length > 0 ? Math.round((count / projects.length) * 100) : 0;
              const colors: Record<string, string> = {
                active: 'bg-green-400',
                'on-hold': 'bg-yellow-400',
                completed: 'bg-blue-400',
                cancelled: 'bg-red-400',
              };
              const labels: Record<string, string> = {
                active: 'Active', 'on-hold': 'On Hold', completed: 'Completed', cancelled: 'Cancelled',
              };
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-foreground">{labels[status]}</span>
                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[status]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Budget per project */}
        <div className="bg-white border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Budget vs Spent per Project</h2>
          <div className="space-y-3 max-h-56 overflow-y-auto">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No projects</p>
            ) : projects.map((p) => {
              const pct = p.estimatedCost > 0 ? Math.min(100, Math.round(((p.actualCost || 0) / p.estimatedCost) * 100)) : 0;
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <button className="font-medium text-foreground hover:text-primary truncate max-w-[60%]" onClick={() => navigate(`/projects/${p.id}`)}>
                      {p.name}
                    </button>
                    <span className="text-muted-foreground shrink-0">₹{(p.actualCost || 0).toLocaleString()} / ₹{(p.estimatedCost || 0).toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Team workload */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Team Workload</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Hours logged per employee across all projects</p>
        </div>
        {empList.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Users className="h-7 w-7 mx-auto mb-2 opacity-30" />
            No team data yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Projects</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Est. Hours</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Logged Hours</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Utilisation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {empList.map((e) => {
                const pct = e.estimatedHours > 0 ? Math.min(100, Math.round((e.loggedHours / e.estimatedHours) * 100)) : 0;
                return (
                  <tr key={e.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {e.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">{e.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {e.projects.slice(0, 2).map((pn) => (
                          <span key={pn} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{pn}</span>
                        ))}
                        {e.projects.length > 2 && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">+{e.projects.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right text-muted-foreground">{e.estimatedHours}h</td>
                    <td className="px-4 py-3.5 text-right font-medium">{e.loggedHours}h</td>
                    <td className="px-4 py-3.5 w-36">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-red-400' : pct > 70 ? 'bg-yellow-400' : 'bg-primary'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Flagged projects */}
      {(overHours.length > 0 || overBudget.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold text-red-700">Projects Needing Attention</h2>
          </div>
          <div className="space-y-2">
            {overHours.map((p) => {
              const logged = Object.values(p.members).reduce((s, m) => s + (m.loggedHours || 0), 0);
              return (
                <div key={`h-${p.id}`} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-red-100">
                  <button className="text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/projects/${p.id}`)}>
                    {p.name}
                  </button>
                  <span className="text-xs text-red-600 font-medium">
                    Hours over by {logged - p.estimatedHours}h
                  </span>
                </div>
              );
            })}
            {overBudget.map((p) => (
              <div key={`b-${p.id}`} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-red-100">
                <button className="text-sm font-medium text-foreground hover:text-primary" onClick={() => navigate(`/projects/${p.id}`)}>
                  {p.name}
                </button>
                <span className="text-xs text-red-600 font-medium">
                  Over budget by ₹{((p.actualCost || 0) - p.estimatedCost).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
