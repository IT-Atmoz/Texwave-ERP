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

interface Bill {
  id: string;
  billNumber: string;
  vendorName: string;
  billDate: string;
  dueDate: string;
  total: number;
  status: string;
  paymentStatus: string;
  paidAmount: number;
  createdAt: number;
}

const paymentBadge: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  Unpaid: 'destructive',
  Partial: 'outline',
  Paid: 'default',
};

export default function Bills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadBills(); }, []);

  const loadBills = async () => {
    try {
      const data = await getAllRecords('purchases/bills');
      setBills(data.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch { toast.error('Failed to load bills'); }
  };

  const handleDelete = async (id: string, num: string) => {
    if (!confirm(`Delete bill ${num}?`)) return;
    try {
      await deleteRecord('purchases/bills', id);
      toast.success('Bill deleted');
      loadBills();
    } catch { toast.error('Failed to delete bill'); }
  };

  const filtered = bills.filter((b) => {
    const s = search.toLowerCase();
    return (
      b.billNumber?.toLowerCase().includes(s) ||
      b.vendorName?.toLowerCase().includes(s) ||
      b.paymentStatus?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Bills</h2>
          <p className="text-muted-foreground text-sm">Vendor bills and payment status</p>
        </div>
        <Button asChild size="lg">
          <Link to="/purchases/bills/create">
            <Plus className="h-5 w-5 mr-2" />
            New Bill
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by bill no, vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">{filtered.length} of {bills.length} bills</div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill Number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Bill Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                      {search ? (
                        <>No bills found matching "{search}"</>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="text-2xl">No bills yet</div>
                          <Button asChild>
                            <Link to="/purchases/bills/create">
                              <Plus className="h-4 w-4 mr-2" />
                              Create your first bill
                            </Link>
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((bill) => (
                    <TableRow key={bill.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">{bill.billNumber}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{bill.vendorName}</TableCell>
                      <TableCell>{bill.billDate}</TableCell>
                      <TableCell>{bill.dueDate}</TableCell>
                      <TableCell className="text-right font-mono">
                        ₹{(bill.total || 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ₹{(bill.paidAmount || 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={paymentBadge[bill.paymentStatus] || 'secondary'}>
                          {bill.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon"
                            onClick={() => navigate(`/purchases/bills/edit/${bill.id}`)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            onClick={() => handleDelete(bill.id, bill.billNumber)}>
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
