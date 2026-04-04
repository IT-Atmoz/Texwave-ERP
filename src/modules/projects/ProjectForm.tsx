import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ref, push, set, get } from 'firebase/database';
import { database, getAllRecords } from '@/services/firebase';
import { Project, ProjectMember, ProjectStatus } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Users } from 'lucide-react';

interface EmpOption {
  id: string;
  name: string;
  employeeId: string;
  department?: string;
}

const EMPTY_MEMBER: Omit<ProjectMember, 'empId' | 'name'> = {
  role: '',
  estimatedHours: 0,
  loggedHours: 0,
  hourlyRate: 0,
};

export default function ProjectForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmpOption[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [client, setClient] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [members, setMembers] = useState<(ProjectMember & { _key: string })[]>([]);

  // Load employees
  useEffect(() => {
    getAllRecords('hr/employees').then((data: any[]) => {
      setEmployees((data || []).filter((e) => e.status !== 'inactive'));
    });
  }, []);

  // Load project if editing
  useEffect(() => {
    if (!id) return;
    get(ref(database, `projects/${id}`)).then((snap) => {
      if (!snap.exists()) return;
      const p = snap.val() as Project;
      setName(p.name || '');
      setDescription(p.description || '');
      setClient(p.client || '');
      setStatus(p.status || 'active');
      setStartDate(p.startDate || '');
      setEndDate(p.endDate || '');
      setEstimatedHours(String(p.estimatedHours || ''));
      setEstimatedCost(String(p.estimatedCost || ''));
      setActualCost(String(p.actualCost || ''));
      const mems = Object.entries(p.members || {}).map(([k, m]) => ({
        ...m,
        _key: k,
      }));
      setMembers(mems);
    });
  }, [id]);

  const addMember = () => {
    setMembers((prev) => [
      ...prev,
      { empId: '', name: '', ...EMPTY_MEMBER, _key: `_new_${Date.now()}` },
    ]);
  };

  const updateMember = (idx: number, field: string, value: string | number) => {
    setMembers((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        if (field === 'empId') {
          const emp = employees.find((e) => e.id === value);
          return { ...m, empId: String(value), name: emp?.name || '' };
        }
        return { ...m, [field]: value };
      })
    );
  };

  const removeMember = (idx: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: 'Project name is required', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      const membersObj: Record<string, ProjectMember> = {};
      members.forEach((m) => {
        if (!m.empId) return;
        const key = m._key.startsWith('_new_') ? m.empId : m._key;
        membersObj[key] = {
          empId: m.empId,
          name: m.name,
          role: m.role,
          estimatedHours: Number(m.estimatedHours) || 0,
          loggedHours: Number(m.loggedHours) || 0,
          hourlyRate: Number(m.hourlyRate) || 0,
        };
      });

      const data = {
        name: name.trim(),
        description: description.trim(),
        client: client.trim(),
        status,
        startDate,
        endDate,
        estimatedHours: Number(estimatedHours) || 0,
        estimatedCost: Number(estimatedCost) || 0,
        actualCost: Number(actualCost) || 0,
        members: membersObj,
        createdAt: isEdit ? undefined : new Date().toISOString(),
      };
      if (isEdit && !data.createdAt) delete data.createdAt;

      if (isEdit) {
        await set(ref(database, `projects/${id}`), { ...data, createdAt: (await get(ref(database, `projects/${id}/createdAt`))).val() });
      } else {
        await push(ref(database, 'projects'), data);
      }

      toast({ title: isEdit ? 'Project updated' : 'Project created' });
      navigate('/projects/list');
    } catch (err) {
      toast({ title: 'Failed to save project', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{isEdit ? 'Edit Project' : 'New Project'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEdit ? 'Update project details and team' : 'Set up a new project with team and budget'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Project Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Project Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website Redesign" required />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief project description..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="active">Active</option>
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Budget & Hours */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Budget & Hours</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Estimated Hours</Label>
              <Input
                type="number"
                min="0"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Cost (₹)</Label>
              <Input
                type="number"
                min="0"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Actual Cost Spent (₹)</Label>
              <Input
                type="number"
                min="0"
                value={actualCost}
                onChange={(e) => setActualCost(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Team Members</h2>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addMember}>
              <Plus className="h-3.5 w-3.5" />
              Add Member
            </Button>
          </div>

          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
              No team members yet. Click "Add Member" to assign employees.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-1">
                <div className="col-span-3">Employee</div>
                <div className="col-span-3">Role in Project</div>
                <div className="col-span-2">Est. Hours</div>
                <div className="col-span-2">Logged Hours</div>
                <div className="col-span-1">Rate/hr (₹)</div>
                <div className="col-span-1" />
              </div>
              {members.map((m, idx) => (
                <div key={m._key} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <select
                      value={m.empId}
                      onChange={(e) => updateMember(idx, 'empId', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Select employee</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.employeeId})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="e.g. Developer"
                      value={m.role}
                      onChange={(e) => updateMember(idx, 'role', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={m.estimatedHours || ''}
                      onChange={(e) => updateMember(idx, 'estimatedHours', Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={m.loggedHours || ''}
                      onChange={(e) => updateMember(idx, 'loggedHours', Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={m.hourlyRate || ''}
                      onChange={(e) => updateMember(idx, 'hourlyRate', Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeMember(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Project' : 'Create Project'}
          </Button>
        </div>
      </form>
    </div>
  );
}
