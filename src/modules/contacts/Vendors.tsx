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

interface Vendor {
  id: string;
  vendorCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  gst?: string;
  pan?: string;
  addresses?: { city?: string; state?: string; isDefault?: boolean }[];
  createdAt?: number;
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const data = await getAllRecords('contacts/vendors');
      const sorted = data.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      setVendors(sorted);
    } catch {
      toast.error('Failed to load vendors');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete vendor "${name}"? This cannot be undone.`)) return;
    try {
      await deleteRecord('contacts/vendors', id);
      toast.success('Vendor deleted');
      loadVendors();
    } catch {
      toast.error('Failed to delete vendor');
    }
  };

  const filtered = vendors.filter((v) => {
    const s = searchTerm.toLowerCase();
    const def = v.addresses?.find((a) => a.isDefault);
    return (
      v.vendorCode?.toLowerCase().includes(s) ||
      v.companyName?.toLowerCase().includes(s) ||
      v.contactPerson?.toLowerCase().includes(s) ||
      v.email?.toLowerCase().includes(s) ||
      v.phone?.toLowerCase().includes(s) ||
      v.gst?.toLowerCase().includes(s) ||
      def?.city?.toLowerCase().includes(s) ||
      def?.state?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Vendors</h2>
          <p className="text-muted-foreground mt-1">Manage your vendor / supplier database</p>
        </div>
        <Button asChild size="lg">
          <Link to="/contacts/vendors/new">
            <Plus className="h-5 w-5 mr-2" />
            Add Vendor
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, email, GST..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filtered.length} of {vendors.length} vendors
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>GST</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                      {searchTerm ? (
                        <>No vendors found matching "{searchTerm}"</>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="text-2xl">No vendors yet</div>
                          <Button asChild>
                            <Link to="/contacts/vendors/new">
                              <Plus className="h-4 w-4 mr-2" />
                              Add your first vendor
                            </Link>
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((vendor) => {
                    const def = vendor.addresses?.find((a) => a.isDefault);
                    return (
                      <TableRow key={vendor.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-sm">
                            {vendor.vendorCode || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{vendor.companyName}</TableCell>
                        <TableCell>{vendor.contactPerson}</TableCell>
                        <TableCell>{vendor.phone}</TableCell>
                        <TableCell className="text-muted-foreground">{vendor.email}</TableCell>
                        <TableCell>
                          {vendor.gst ? (
                            <Badge variant="outline">{vendor.gst}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {def ? `${def.city}, ${def.state}` : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/contacts/vendors/edit/${vendor.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(vendor.id, vendor.companyName)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
