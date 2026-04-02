import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, remove } from 'firebase/database';
import { database } from '@/services/firebase';
import { Project, ProjectStatus } from './types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Plus, Search, FolderKanban, Calendar, Users, IndianRupee,
  Clock, Pencil, Trash2, Eye, ChevronRight,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string }> = {
  active:    { label: 'Active',     className: 'bg-green-100 text-green-700 border-green-200' },
  'on-hold': { label: 'On Hold',    className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  completed: { label: 'Completed',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
  cancelled: { label: 'Cancelled',  className: 'bg-red-100 text-red-700 border-red-200' },
};

function hoursProgress(logged: number, estimated: number) {
  if (!estimated) return 0;
  return Math.min(100, Math.round((logged / estimated) * 100));
}

function costProgress(actual: number, estimated: number) {
  if (!estimated) return 0;
  return Math.min(100, Math.round((actual / estimated) * 100));
}

export default function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

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

  const handleDelete = async (project: Project) => {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    await remove(ref(database, `projects/${project.id}`));
    toast({ title: 'Project deleted' });
  };

  const filtered = projects.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.client || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalLogged = (p: Project) =>
    Object.values(p.members).reduce((s, m) => s + (m.loggedHours || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Projects</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{projects.length} projects total</p>
        </div>
        <Button onClick={() => navigate('/projects/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects or clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'on-hold', 'completed', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No projects found</p>
          <p className="text-sm mt-1">Create your first project to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((project) => {
            const memberCount = Object.keys(project.members).length;
            const logged = totalLogged(project);
            const hPct = hoursProgress(logged, project.estimatedHours);
            const cPct = costProgress(project.actualCost || 0, project.estimatedCost || 0);
            const cfg = STATUS_CONFIG[project.status] || STATUS_CONFIG['active'];

            return (
              <div
                key={project.id}
                className="bg-white border border-border rounded-xl p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                      {project.client && (
                        <span className="text-xs text-muted-foreground">· {project.client}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground text-base truncate">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{project.description}</p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-5 mt-3 text-xs text-muted-foreground flex-wrap">
                      {project.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {project.startDate} → {project.endDate || 'TBD'}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {memberCount} member{memberCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Progress bars */}
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      {/* Hours */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" /> Hours
                          </span>
                          <span className="font-medium text-foreground">
                            {logged}h / {project.estimatedHours || 0}h
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${hPct > 90 ? 'bg-red-400' : 'bg-primary'}`}
                            style={{ width: `${hPct}%` }}
                          />
                        </div>
                      </div>
                      {/* Budget */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <IndianRupee className="h-3 w-3" /> Budget
                          </span>
                          <span className="font-medium text-foreground">
                            ₹{(project.actualCost || 0).toLocaleString()} / ₹{(project.estimatedCost || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${cPct > 90 ? 'bg-red-400' : 'bg-emerald-500'}`}
                            style={{ width: `${cPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => navigate(`/projects/edit/${project.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(project)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 ml-1"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
