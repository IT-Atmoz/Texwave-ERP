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
  const [projects, setProjects] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const snap = await get(ref(database, 'masters/projects'));
    if (snap.exists()) {
      const val = snap.val();
      setProjects(Array.isArray(val) ? val : Object.values(val));
    }
  };

  const addProject = async () => {
    if (!newItem.trim()) {
      toast({ title: 'Please enter a project name', variant: 'destructive' });
      return;
    }
    const updated = [...projects, newItem.trim()];
    setProjects(updated);
    await set(ref(database, 'masters/projects'), updated);
    setNewItem('');
    setEditing(false);
    toast({ title: 'Project added successfully' });
  };

  const removeProject = async (index: number) => {
    const updated = projects.filter((_, i) => i !== index);
    setProjects(updated);
    await set(ref(database, 'masters/projects'), updated);
    toast({ title: 'Project removed' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            Projects
            <Button
              size="sm"
              onClick={() => setEditing(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {editing && (
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Enter project name"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addProject()}
              />
              <Button onClick={addProject}>Add</Button>
              <Button variant="outline" onClick={() => { setEditing(false); setNewItem(''); }}>
                Cancel
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-sm">No projects added yet</p>
            ) : (
              projects.map((project, index) => (
                <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
                  {project}
                  <button
                    onClick={() => removeProject(index)}
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
    </div>
  );
}
