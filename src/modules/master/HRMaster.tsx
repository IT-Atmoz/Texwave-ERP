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
  const [departments, setDepartments] = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<string[]>([]);
  const [shifts, setShifts] = useState<string[]>([]);
  const [employeeStatus, setEmployeeStatus] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    const mastersRef = ref(database, 'masters/hr');
    const snapshot = await get(mastersRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      setDepartments(data.departments || []);
      setDesignations(data.designations || []);
      setLeaveTypes(data.leaveTypes || []);
      setShifts(data.shifts || []);
      setEmployeeStatus(data.employeeStatus || []);
    }
  };

  const addItem = async (category: string) => {
    if (!newItem.trim()) {
      toast({ title: 'Please enter a value', variant: 'destructive' });
      return;
    }

    let list: string[] = [];
    switch (category) {
      case 'departments':
        list = [...departments, newItem];
        setDepartments(list);
        break;
      case 'designations':
        list = [...designations, newItem];
        setDesignations(list);
        break;
      case 'leaveTypes':
        list = [...leaveTypes, newItem];
        setLeaveTypes(list);
        break;
      case 'shifts':
        list = [...shifts, newItem];
        setShifts(list);
        break;
      case 'employeeStatus':
        list = [...employeeStatus, newItem];
        setEmployeeStatus(list);
        break;
    }

    await set(ref(database, `masters/hr/${category}`), list);
    setNewItem('');
    setEditingCategory(null);
    toast({ title: 'Item added successfully' });
  };

  const removeItem = async (category: string, index: number) => {
    let list: string[] = [];
    switch (category) {
      case 'departments':
        list = departments.filter((_, i) => i !== index);
        setDepartments(list);
        break;
      case 'designations':
        list = designations.filter((_, i) => i !== index);
        setDesignations(list);
        break;
      case 'leaveTypes':
        list = leaveTypes.filter((_, i) => i !== index);
        setLeaveTypes(list);
        break;
      case 'shifts':
        list = shifts.filter((_, i) => i !== index);
        setShifts(list);
        break;
      case 'employeeStatus':
        list = employeeStatus.filter((_, i) => i !== index);
        setEmployeeStatus(list);
        break;
    }

    await set(ref(database, `masters/hr/${category}`), list);
    toast({ title: 'Item removed successfully' });
  };

  const renderList = (title: string, items: string[], category: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          {title}
          <Button
            size="sm"
            onClick={() => setEditingCategory(category)}
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
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem(category)}
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
    </div>
  );
}
