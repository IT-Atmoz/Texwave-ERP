import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { createRecord, updateRecord, getRecordById, getAllRecords } from '@/services/firebase';

const indianStates = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu and Kashmir','Ladakh',
];

interface VendorData {
  vendorCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  gst: string;
  pan: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  bankName: string;
  bankAccountNo: string;
  bankIfsc: string;
  bankBranch: string;
}

const empty: VendorData = {
  vendorCode: '',
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  gst: '',
  pan: '',
  street: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  bankName: '',
  bankAccountNo: '',
  bankIfsc: '',
  bankBranch: '',
};

export default function VendorForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<VendorData>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      getRecordById('contacts/vendors', id!).then((data) => {
        if (data) {
          const addr = data.addresses?.[0] || {};
          setForm({
            vendorCode: data.vendorCode || '',
            companyName: data.companyName || '',
            contactPerson: data.contactPerson || '',
            email: data.email || '',
            phone: data.phone || '',
            gst: data.gst || '',
            pan: data.pan || '',
            street: addr.street || '',
            city: addr.city || '',
            state: addr.state || '',
            pincode: addr.pincode || '',
            country: addr.country || 'India',
            bankName: data.bankName || '',
            bankAccountNo: data.bankAccountNo || '',
            bankIfsc: data.bankIfsc || '',
            bankBranch: data.bankBranch || '',
          });
        }
      });
    } else {
      generateVendorCode();
    }
  }, [id]);

  const generateVendorCode = async () => {
    try {
      const existing = await getAllRecords('contacts/vendors');
      const num = existing.length + 1;
      setForm((f) => ({ ...f, vendorCode: `VEND-${String(num).padStart(4, '0')}` }));
    } catch {
      setForm((f) => ({ ...f, vendorCode: `VEND-${Date.now().toString().slice(-4)}` }));
    }
  };

  const set = (field: keyof VendorData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) { toast.error('Company name is required'); return; }
    if (!form.contactPerson.trim()) { toast.error('Contact person is required'); return; }

    setSaving(true);
    try {
      const payload = {
        vendorCode: form.vendorCode,
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        gst: form.gst.trim(),
        pan: form.pan.trim(),
        addresses: [
          {
            id: 'addr-1',
            type: 'billing',
            label: 'Primary',
            street: form.street,
            area: '',
            city: form.city,
            state: form.state,
            pincode: form.pincode,
            country: form.country,
            isDefault: true,
          },
        ],
        bankName: form.bankName.trim(),
        bankAccountNo: form.bankAccountNo.trim(),
        bankIfsc: form.bankIfsc.trim(),
        bankBranch: form.bankBranch.trim(),
      };

      if (isEdit) {
        await updateRecord('contacts/vendors', id!, payload);
        toast.success('Vendor updated successfully');
      } else {
        await createRecord('contacts/vendors', payload);
        toast.success('Vendor created successfully');
      }
      navigate('/contacts/vendors');
    } catch {
      toast.error('Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/contacts/vendors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Vendor' : 'New Vendor'}</h1>
          <p className="text-muted-foreground text-sm">{isEdit ? 'Update vendor details' : 'Add a new vendor / supplier'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Vendor Code</Label>
              <Input value={form.vendorCode} onChange={(e) => set('vendorCode', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Company Name *</Label>
              <Input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Contact Person *</Label>
              <Input value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>GST Number</Label>
              <Input value={form.gst} onChange={(e) => set('gst', e.target.value)} placeholder="15-digit GSTIN" />
            </div>
            <div className="space-y-1">
              <Label>PAN Number</Label>
              <Input value={form.pan} onChange={(e) => set('pan', e.target.value)} placeholder="ABCDE1234F" />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader><CardTitle>Address</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <Label>Street</Label>
              <Input value={form.street} onChange={(e) => set('street', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <Select value={form.state} onValueChange={(v) => set('state', v)}>
                <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent>
                  {indianStates.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Pincode</Label>
              <Input value={form.pincode} onChange={(e) => set('pincode', e.target.value)} maxLength={6} />
            </div>
            <div className="space-y-1">
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => set('country', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader><CardTitle>Bank Details (Optional)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Bank Name</Label>
              <Input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Account Number</Label>
              <Input value={form.bankAccountNo} onChange={(e) => set('bankAccountNo', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>IFSC Code</Label>
              <Input value={form.bankIfsc} onChange={(e) => set('bankIfsc', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Branch</Label>
              <Input value={form.bankBranch} onChange={(e) => set('bankBranch', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" asChild>
            <Link to="/contacts/vendors">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Vendor' : 'Create Vendor'}
          </Button>
        </div>
      </form>
    </div>
  );
}
