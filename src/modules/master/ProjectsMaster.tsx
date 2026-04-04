import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { database } from '@/services/firebase';
import { ref, set, get } from 'firebase/database';

export default function ProjectsMaster() {
  const [projects, setProjects]     = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [jobTypes, setJobTypes]     = useState<string[]>([]);

  const [newItem, setNewItem]               = useState('');
  const [editingSection, setEditingSection] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [projSnap, catSnap, jobSnap] = await Promise.all([
      get(ref(database, 'masters/projects')),
      get(ref(database, 'masters/timesheet/categories')),
      get(ref(database, 'masters/timesheet/jobTypes')),
    ]);

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

  const addItem = async (section: string) => {
    if (!newItem.trim()) {
      toast({ title: 'Please enter a value', variant: 'destructive' });
      return;
    }

    let updated: string[] = [];
    let path = '';

    if (section === 'projects') {
      updated = [...projects, newItem.trim()];
      path = 'masters/projects';
      setProjects(updated);
    } else if (section === 'categories') {
      updated = [...categories, newItem.trim()];
      path = 'masters/timesheet/categories';
      setCategories(updated);
    } else if (section === 'jobTypes') {
      updated = [...jobTypes, newItem.trim()];
      path = 'masters/timesheet/jobTypes';
      setJobTypes(updated);
    }

    await set(ref(database, path), updated);
    setNewItem('');
    setEditingSection(null);
    toast({ title: 'Item added successfully' });
  };

  const removeItem = async (section: string, index: number) => {
    let updated: string[] = [];
    let path = '';

    if (section === 'projects') {
      updated = projects.filter((_, i) => i !== index);
      path = 'masters/projects';
      setProjects(updated);
    } else if (section === 'categories') {
      updated = categories.filter((_, i) => i !== index);
      path = 'masters/timesheet/categories';
      setCategories(updated);
    } else if (section === 'jobTypes') {
      updated = jobTypes.filter((_, i) => i !== index);
      path = 'masters/timesheet/jobTypes';
      setJobTypes(updated);
    }

    await set(ref(database, path), updated);
    toast({ title: 'Item removed' });
  };

  const renderSection = (title: string, items: string[], section: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          {title}
          <Button
            size="sm"
            onClick={() => { setEditingSection(section); setNewItem(''); }}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editingSection === section && (
          <div className="flex gap-2 mb-4">
            <Input
              placeholder={`Enter ${title.toLowerCase().replace(/s$/, '')}`}
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem(section)}
              autoFocus
            />
            <Button onClick={() => addItem(section)}>Add</Button>
            <Button variant="outline" onClick={() => { setEditingSection(null); setNewItem(''); }}>
              Cancel
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No items added yet</p>
          ) : (
            items.map((item, index) => (
              <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
                {item}
                <button
                  onClick={() => removeItem(section, index)}
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
        {renderSection('Projects', projects, 'projects')}
        {renderSection('Timesheet Categories', categories, 'categories')}
        {renderSection('Job Types', jobTypes, 'jobTypes')}
      </div>
    </div>
  );
}
