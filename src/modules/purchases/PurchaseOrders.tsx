import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteRecord, getAllRecords } from '@/services/firebase';
import { Link, useNavigate } from 'react-router-dom';

interface PO {
  id: string;
  poNumber: string;
  vendorName: string;
  date: string;
  expectedDate?: string;
  total: number;
  status: string;
  createdAt: number;
}

const statusColor: Record<string, string> = {
  Draft: 'secondary',
  Sent: 'outline',
  Received: 'default',
  Cancelled: 'destructive',
};

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<PO[]>([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const data = await getAllRecords('purchases/purchaseOrders');
      setOrders(data.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch { toast.error('Failed to load purchase orders'); }
  };

  const handleDelete = async (id: string, po: string) => {
    if (!confirm(`Delete PO ${po}?`)) return;
    try {
      await deleteRecord('purchases/purchaseOrders', id);
      toast.success('Purchase order deleted');
      loadOrders();
    } catch { toast.error('Failed to delete'); }
  };

  const filtered = orders.filter((o) => {
    const s = search.toLowerCase();
    return (
      o.poNumber?.toLowerCase().includes(s) ||
      o.vendorName?.toLowerCase().includes(s) ||
      o.status?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Purchase Orders</h2>
          <p className="text-muted-foreground text-sm">Manage purchase orders to vendors</p>
        </div>
        <Button asChild size="lg">
          <Link to="/purchases/orders/create">
            <Plus className="h-5 w-5 mr-2" />
            New Purchase Order
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO number, vendor, status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">{filtered.length} of {orders.length} orders</div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Expected Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                      {search ? (
                        <>No orders found matching "{search}"</>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="text-2xl">No purchase orders yet</div>
                          <Button asChild>
                            <Link to="/purchases/orders/create">
                              <Plus className="h-4 w-4 mr-2" />
                              Create your first PO
                            </Link>
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">{order.poNumber}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{order.vendorName}</TableCell>
                      <TableCell>{order.date}</TableCell>
                      <TableCell>{order.expectedDate || '—'}</TableCell>
                      <TableCell className="text-right font-mono">
                        ₹{(order.total || 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={(statusColor[order.status] as any) || 'secondary'}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon"
                            onClick={() => navigate(`/purchases/orders/edit/${order.id}`)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            onClick={() => handleDelete(order.id, order.poNumber)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
