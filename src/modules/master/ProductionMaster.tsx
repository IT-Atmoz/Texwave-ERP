import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { database } from '@/services/firebase';
import { ref, set, get, push } from 'firebase/database';
import { Part } from '@/types';

export default function ProductionMaster() {
  const [machines, setMachines] = useState<Record<string, { name: string }>>({});
  const [dies, setDies] = useState<Record<string, { name: string }>>({});
  const [compoundCodes, setCompoundCodes] = useState<string[]>([]);
  const [productionStages, setProductionStages] = useState<string[]>([]);
  const [parts, setParts] = useState<Record<string, Part>>({});
  const [newItem, setNewItem] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [partForm, setPartForm] = useState<Part>({
    name: '',
    partNumber: '',
    inputWeight: 0,
    cycleTime: 0,
    cavity: 0,
  });
  const [showPartDialog, setShowPartDialog] = useState(false);

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    const mastersRef = ref(database, 'masters/production');
    const snapshot = await get(mastersRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      setMachines(data.machines || {});
      setDies(data.dies || {});
      setCompoundCodes(data.compoundCodes || []);
      setProductionStages(data.productionStages || []);
      setParts(data.parts || {});
    }
  };

  const addMachineOrDie = async (category: 'machines' | 'dies') => {
    if (!newItem.trim()) {
      toast({ title: 'Please enter a value', variant: 'destructive' });
      return;
    }

    const id = `${category === 'machines' ? 'MC' : 'DIE'}${String(Object.keys(category === 'machines' ? machines : dies).length + 1).padStart(2, '0')}`;
    const updated = category === 'machines' 
      ? { ...machines, [id]: { name: newItem } }
      : { ...dies, [id]: { name: newItem } };

    if (category === 'machines') setMachines(updated);
    else setDies(updated);

    await set(ref(database, `masters/production/${category}`), updated);
    setNewItem('');
    setEditingCategory(null);
    toast({ title: 'Item added successfully' });
  };

  const addListItem = async (category: 'compoundCodes' | 'productionStages') => {
    if (!newItem.trim()) {
      toast({ title: 'Please enter a value', variant: 'destructive' });
      return;
    }

    const list = category === 'compoundCodes' 
      ? [...compoundCodes, newItem]
      : [...productionStages, newItem];

    if (category === 'compoundCodes') setCompoundCodes(list);
    else setProductionStages(list);

    await set(ref(database, `masters/production/${category}`), list);
    setNewItem('');
    setEditingCategory(null);
    toast({ title: 'Item added successfully' });
  };

  const addPart = async () => {
    if (!partForm.name || !partForm.partNumber) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    const id = `part${String(Object.keys(parts).length + 1).padStart(3, '0')}`;
    const updated = { ...parts, [id]: partForm };
    setParts(updated);
    await set(ref(database, `masters/production/parts`), updated);
    
    setShowPartDialog(false);
    setPartForm({ name: '', partNumber: '', inputWeight: 0, cycleTime: 0, cavity: 0 });
    toast({ title: 'Part added successfully' });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Machines
              <Button size="sm" onClick={() => setEditingCategory('machines')} className="bg-primary">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingCategory === 'machines' && (
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Machine name"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                />
                <Button onClick={() => addMachineOrDie('machines')}>Add</Button>
                <Button variant="outline" onClick={() => { setEditingCategory(null); setNewItem(''); }}>
                  Cancel
                </Button>
              </div>
            )}
            <div className="space-y-2">
              {Object.entries(machines).map(([id, machine]) => (
                <div key={id} className="flex items-center justify-between p-2 bg-secondary rounded">
                  <span className="text-sm font-medium">{id}: {machine.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Dies
              <Button size="sm" onClick={() => setEditingCategory('dies')} className="bg-primary">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingCategory === 'dies' && (
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Die name"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                />
                <Button onClick={() => addMachineOrDie('dies')}>Add</Button>
                <Button variant="outline" onClick={() => { setEditingCategory(null); setNewItem(''); }}>
                  Cancel
                </Button>
              </div>
            )}
            <div className="space-y-2">
              {Object.entries(dies).map(([id, die]) => (
                <div key={id} className="flex items-center justify-between p-2 bg-secondary rounded">
                  <span className="text-sm font-medium">{id}: {die.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Compound Codes
              <Button size="sm" onClick={() => setEditingCategory('compoundCodes')} className="bg-primary">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingCategory === 'compoundCodes' && (
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Compound code"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                />
                <Button onClick={() => addListItem('compoundCodes')}>Add</Button>
                <Button variant="outline" onClick={() => { setEditingCategory(null); setNewItem(''); }}>
                  Cancel
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {compoundCodes.map((code, index) => (
                <Badge key={index} variant="secondary">{code}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Production Stages
              <Button size="sm" onClick={() => setEditingCategory('productionStages')} className="bg-primary">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingCategory === 'productionStages' && (
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Stage name"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                />
                <Button onClick={() => addListItem('productionStages')}>Add</Button>
                <Button variant="outline" onClick={() => { setEditingCategory(null); setNewItem(''); }}>
                  Cancel
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {productionStages.map((stage, index) => (
                <Badge key={index} variant="secondary">{stage}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            Parts Master
            <Dialog open={showPartDialog} onOpenChange={setShowPartDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Part
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Part</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Part Name</Label>
                    <Input
                      value={partForm.name}
                      onChange={(e) => setPartForm({ ...partForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Part Number</Label>
                    <Input
                      value={partForm.partNumber}
                      onChange={(e) => setPartForm({ ...partForm, partNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Input Weight (grams)</Label>
                    <Input
                      type="number"
                      value={partForm.inputWeight}
                      onChange={(e) => setPartForm({ ...partForm, inputWeight: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Cycle Time (seconds)</Label>
                    <Input
                      type="number"
                      value={partForm.cycleTime}
                      onChange={(e) => setPartForm({ ...partForm, cycleTime: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Cavity</Label>
                    <Input
                      type="number"
                      value={partForm.cavity}
                      onChange={(e) => setPartForm({ ...partForm, cavity: Number(e.target.value) })}
                    />
                  </div>
                  <Button onClick={addPart} className="w-full">Add Part</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part No</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead>Input Weight</TableHead>
                <TableHead>Cycle Time</TableHead>
                <TableHead>Cavity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(parts).map(([id, part]) => (
                <TableRow key={id}>
                  <TableCell className="font-medium">{part.partNumber}</TableCell>
                  <TableCell>{part.name}</TableCell>
                  <TableCell>{part.inputWeight}g</TableCell>
                  <TableCell>{part.cycleTime}s</TableCell>
                  <TableCell>{part.cavity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
