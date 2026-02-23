'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { database } from '@/services/firebase';
import { ref, set, get } from 'firebase/database';

export default function SalesMaster() {
  // Sales masters
  const [paymentTerms, setPaymentTerms] = useState<string[]>([]);
  const [deliveryTerms, setDeliveryTerms] = useState<string[]>([]);
  const [dispatchModes, setDispatchModes] = useState<string[]>([]);
  const [gstList, setGstList] = useState<string[]>([]);

  // Inventory/Item masters
  const [itemCategories, setItemCategories] = useState<string[]>([]);
  const [itemTypes, setItemTypes] = useState<string[]>([]);
  const [itemGroups, setItemGroups] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]); // New: Units / UOM

  const [newItem, setNewItem] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    try {
      const mastersRef = ref(database, 'masters/sales');
      const snapshot = await get(mastersRef);

      if (snapshot.exists()) {
        const data = snapshot.val();

        // Helper to safely convert to array (handles both array and object with numeric keys)
        const toArray = (val: any) => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          return Object.keys(val)
            .filter((key) => !isNaN(Number(key)))
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => val[key])
            .filter((item: string) => item !== null && item !== undefined);
        };

        setPaymentTerms(toArray(data.paymentTerms));
        setDeliveryTerms(toArray(data.deliveryTerms));
        setDispatchModes(toArray(data.dispatchModes));
        setGstList(toArray(data.gstList));
        setItemCategories(toArray(data.itemCategories));
        setItemTypes(toArray(data.itemTypes));
        setItemGroups(toArray(data.itemGroups));
        setUnits(toArray(data.units)); // Load units
      }
    } catch (error) {
      console.error('Error loading master data:', error);
      toast({ title: 'Failed to load masters', variant: 'destructive' });
    }
  };

  const addItem = async (category: string) => {
    if (!newItem.trim()) {
      toast({ title: 'Please enter a value', variant: 'destructive' });
      return;
    }

    let updatedList: string[] = [];
    switch (category) {
      case 'paymentTerms':
        updatedList = [...paymentTerms, newItem];
        setPaymentTerms(updatedList);
        break;
      case 'deliveryTerms':
        updatedList = [...deliveryTerms, newItem];
        setDeliveryTerms(updatedList);
        break;
      case 'dispatchModes':
        updatedList = [...dispatchModes, newItem];
        setDispatchModes(updatedList);
        break;
      case 'gstList':
        updatedList = [...gstList, newItem];
        setGstList(updatedList);
        break;
      case 'itemCategories':
        updatedList = [...itemCategories, newItem];
        setItemCategories(updatedList);
        break;
      case 'itemTypes':
        updatedList = [...itemTypes, newItem];
        setItemTypes(updatedList);
        break;
      case 'itemGroups':
        updatedList = [...itemGroups, newItem];
        setItemGroups(updatedList);
        break;
      case 'units':
        updatedList = [...units, newItem];
        setUnits(updatedList);
        break;
      default:
        return;
    }

    await set(ref(database, `masters/sales/${category}`), updatedList);
    setNewItem('');
    setEditingCategory(null);
    toast({ title: `${newItem} added successfully` });
  };

  const removeItem = async (category: string, index: number) => {
    let updatedList: string[] = [];
    switch (category) {
      case 'paymentTerms':
        updatedList = paymentTerms.filter((_, i) => i !== index);
        setPaymentTerms(updatedList);
        break;
      case 'deliveryTerms':
        updatedList = deliveryTerms.filter((_, i) => i !== index);
        setDeliveryTerms(updatedList);
        break;
      case 'dispatchModes':
        updatedList = dispatchModes.filter((_, i) => i !== index);
        setDispatchModes(updatedList);
        break;
      case 'gstList':
        updatedList = gstList.filter((_, i) => i !== index);
        setGstList(updatedList);
        break;
      case 'itemCategories':
        updatedList = itemCategories.filter((_, i) => i !== index);
        setItemCategories(updatedList);
        break;
      case 'itemTypes':
        updatedList = itemTypes.filter((_, i) => i !== index);
        setItemTypes(updatedList);
        break;
      case 'itemGroups':
        updatedList = itemGroups.filter((_, i) => i !== index);
        setItemGroups(updatedList);
        break;
      case 'units':
        updatedList = units.filter((_, i) => i !== index);
        setUnits(updatedList);
        break;
      default:
        return;
    }

    await set(ref(database, `masters/sales/${category}`), updatedList);
    toast({ title: 'Item removed successfully' });
  };

  const renderList = (title: string, items: string[], category: string) => (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          {title}
          <Button
            size="sm"
            onClick={() => {
              setEditingCategory(category);
              setNewItem('');
            }}
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
              placeholder="Enter new value"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem(category)}
              autoFocus
            />
            <Button onClick={() => addItem(category)}>Add</Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditingCategory(null);
                setNewItem('');
              }}
            >
              Cancel
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 min-h-[40px]">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No items added yet</p>
          ) : (
            items.map((item, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="text-sm px-3 py-1.5 flex items-center gap-2"
              >
                {item}
                <button
                  onClick={() => removeItem(category, index)}
                  className="hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-center mb-10">Sales & Inventory Masters</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Sales Related Masters */}
        {renderList('Payment Terms', paymentTerms, 'paymentTerms')}
        {renderList('Delivery Terms', deliveryTerms, 'deliveryTerms')}
        {renderList('Dispatch Modes', dispatchModes, 'dispatchModes')}
        {renderList('GST Rates', gstList, 'gstList')}

        {/* Inventory/Item Related Masters */}
        {renderList('Item Categories', itemCategories, 'itemCategories')}
        {renderList('Item Types', itemTypes, 'itemTypes')}
        {renderList('Item Groups', itemGroups, 'itemGroups')}
        {renderList('Units', units, 'units')}
      </div>
    </div>
  );
}