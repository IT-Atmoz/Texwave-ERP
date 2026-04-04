import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { database } from '@/services/firebase';
import { ref, set, get } from 'firebase/database';

export default function HRMaster() {
  const [departments, setDepartments]   = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [leaveTypes, setLeaveTypes]     = useState<string[]>([]);
  const [shifts, setShifts]             = useState<string[]>([]);
  const [employeeStatus, setEmployeeStatus] = useState<string[]>([]);

  // Timesheet master fields
  const [projects, setProjects]     = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [jobTypes, setJobTypes]     = useState<string[]>([]);

  const [newItem, setNewItem]               = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    const [hrSnap, projSnap, catSnap, jobSnap] = await Promise.all([
      get(ref(database, 'masters/hr')),
      get(ref(database, 'masters/projects')),
      get(ref(database, 'masters/timesheet/categories')),
      get(ref(database, 'masters/timesheet/jobTypes')),
    ]);

    if (hrSnap.exists()) {
      const data = hrSnap.val();
      setDepartments(data.departments || []);
      setDesignations(data.designations || []);
      setLeaveTypes(data.leaveTypes || []);
      setShifts(data.shifts || []);
      setEmployeeStatus(data.employeeStatus || []);
    }
    if (projSnap.exists()) {
      const v = projSnap.val();
      setProjects(Array.isArray(v) ? v : Object.values(v));
    }
    if (catSnap.exists()) {
      const v = catSnap.val();
      setCategories(Array.isArray(v) ? v : Object.values(v));
    }
    if (jobSnap.exists()) {
      const v = jobSnap.val();
      setJobTypes(Array.isArray(v) ? v : Object.values(v));
    }
  };

  // Returns the current list and Firebase path for a given section key
  const getSectionConfig = (category: string): { list: string[]; path: string; setter: (v: string[]) => void } => {
    const configs: Record<string, { list: string[]; path: string; setter: (v: string[]) => void }> = {
      departments:    { list: departments,    path: 'masters/hr/departments',          setter: setDepartments },
      designations:   { list: designations,   path: 'masters/hr/designations',         setter: setDesignations },
      leaveTypes:     { list: leaveTypes,     path: 'masters/hr/leaveTypes',           setter: setLeaveTypes },
      shifts:         { list: shifts,         path: 'masters/hr/shifts',               setter: setShifts },
      employeeStatus: { list: employeeStatus, path: 'masters/hr/employeeStatus',       setter: setEmployeeStatus },
      projects:       { list: projects,       path: 'masters/projects',                setter: setProjects },
      categories:     { list: categories,     path: 'masters/timesheet/categories',    setter: setCategories },
      jobTypes:       { list: jobTypes,       path: 'masters/timesheet/jobTypes',      setter: setJobTypes },
    };
    return configs[category];
  };

  const addItem = async (category: string) => {
    if (!newItem.trim()) {
      toast({ title: 'Please enter a value', variant: 'destructive' });
      return;
    }
    const { list, path, setter } = getSectionConfig(category);
    const updated = [...list, newItem.trim()];
    setter(updated);
    await set(ref(database, path), updated);
    setNewItem('');
    setEditingCategory(null);
    toast({ title: 'Item added successfully' });
  };

  const removeItem = async (category: string, index: number) => {
    const { list, path, setter } = getSectionConfig(category);
    const updated = list.filter((_, i) => i !== index);
    setter(updated);
    await set(ref(database, path), updated);
    toast({ title: 'Item removed successfully' });
  };

  const renderList = (title: string, items: string[], category: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          {title}
          <Button
            size="sm"
            onClick={() => { setEditingCategory(category); setNewItem(''); }}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editingCategory === category && (
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter value"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem(category)}
              autoFocus
            />
            <Button onClick={() => addItem(category)}>Add</Button>
            <Button variant="outline" onClick={() => { setEditingCategory(null); setNewItem(''); }}>
              Cancel
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No items added</p>
          ) : (
            items.map((item, index) => (
              <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
                {item}
                <button
                  onClick={() => removeItem(category, index)}
                  className="ml-2 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderList('Departments', departments, 'departments')}
        {renderList('Designations', designations, 'designations')}
        {renderList('Leave Types', leaveTypes, 'leaveTypes')}
        {renderList('Shifts', shifts, 'shifts')}
        {renderList('Employee Status', employeeStatus, 'employeeStatus')}
      </div>

      <div className="border-t pt-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Timesheet Master</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderList('Project Names', projects, 'projects')}
          {renderList('Timesheet Categories', categories, 'categories')}
          {renderList('Job Types', jobTypes, 'jobTypes')}
        </div>
      </div>
    </div>
  );
}
