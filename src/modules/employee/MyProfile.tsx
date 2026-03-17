import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, get, update } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { User, Phone, Briefcase, Edit3, Save, X, CheckCircle2 } from 'lucide-react';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const officeLocations = ['OMR', 'Anna Nagar', 'Coimbatore', 'Remote', 'Kayar'];
const genderOptions = ['Male', 'Female', 'Other'];

interface EmpData {
  name?: string;
  employeeId?: string;
  email?: string;
  phone?: string;
  department?: string;
  role?: string;
  joiningDate?: string;
  project?: string;
  workDomain?: string;
  bloodGroup?: string;
  gender?: string;
  dob?: string;
  officeType?: string;
  landline?: string;
  referredBy?: string;
  profilePhoto?: string;
  status?: string;
  presentAddress?: { address?: string; city?: string; state?: string; pincode?: string };
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function MyProfile() {
  const { user } = useAuth();
  const [emp, setEmp] = useState<EmpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firebaseKey, setFirebaseKey] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);

  const [form, setForm] = useState<Partial<EmpData>>({});

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [deptsSnap] = await Promise.all([
        get(ref(database, 'masters/hr/departments')),
      ]);
      if (deptsSnap.exists()) {
        const val = deptsSnap.val();
        setDepartments(Array.isArray(val) ? val : Object.values(val));
      }

      // Use firebaseKey for direct lookup
      if (user.firebaseKey) {
        const snap = await get(ref(database, `hr/employees/${user.firebaseKey}`));
        if (snap.exists()) {
          setEmp(snap.val());
          setForm(snap.val());
          setFirebaseKey(user.firebaseKey);
          setLoading(false);
          return;
        }
      }
      // Fallback: search by display employeeId
      if (user.employeeId) {
        const allSnap = await get(ref(database, 'hr/employees'));
        if (allSnap.exists()) {
          const entries = Object.entries(allSnap.val());
          const found = entries.find(([, v]: any) => v.employeeId === user.employeeId);
          if (found) {
            setEmp(found[1] as EmpData);
            setForm(found[1] as EmpData);
            setFirebaseKey(found[0]);
          }
        }
      }
      setLoading(false);
    };
    load();
  }, [user?.firebaseKey, user?.employeeId]);

  const setField = (field: keyof EmpData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!firebaseKey) {
      toast.error('Unable to find your employee record. Please contact HR.');
      return;
    }
    if (!form.name?.trim()) { toast.error('Full name is required'); return; }
    if (form.phone && !/^\d{10}$/.test(form.phone)) { toast.error('Phone must be 10 digits'); return; }

    setSaving(true);
    try {
      await update(ref(database, `hr/employees/${firebaseKey}`), {
        name: form.name?.trim(),
        phone: form.phone?.trim() || '',
        email: form.email?.trim() || '',
        bloodGroup: form.bloodGroup || '',
        department: form.department || '',
        role: form.role?.trim() || '',
        officeType: form.officeType || '',
        joiningDate: form.joiningDate || '',
        landline: form.landline?.trim() || '',
        referredBy: form.referredBy?.trim() || '',
        gender: form.gender || '',
        dob: form.dob || '',
        profileFilled: true,
        updatedAt: Date.now(),
      });
      // Sync name + mark profile filled in portal user record
      await update(ref(database, `users/${firebaseKey}`), {
        name: form.name?.trim(),
        email: form.email?.trim() || '',
        profileFilled: true,
      });
      setEmp(prev => ({ ...prev, ...form, profileFilled: true } as EmpData));
      setEditing(false);
      toast.success('Profile updated successfully! HR has been notified.');
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const initials = (emp?.name || user?.name || 'E')
    .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const maskedAccount = emp?.bankAccountNo
    ? '*'.repeat(Math.max(0, emp.bankAccountNo.length - 4)) + emp.bankAccountNo.slice(-4)
    : null;

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading profile...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {emp?.profilePhoto ? (
                <img src={emp.profilePhoto} alt={emp.name} className="h-14 w-14 rounded-full object-cover border-2 border-border" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border shrink-0">
                  <span className="text-lg font-bold text-primary">{initials}</span>
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold">{emp?.name || user?.name}</h2>
                <p className="text-sm text-muted-foreground">{emp?.role || 'Employee'}{emp?.department ? ` · ${emp.department}` : ''}</p>
                <Badge variant={emp?.status === 'active' ? 'default' : 'secondary'} className="mt-1 capitalize text-xs">
                  {emp?.status ?? 'active'}
                </Badge>
              </div>
            </div>
            {!editing ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-2">
                <Edit3 className="h-4 w-4" /> Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm(emp || {}); }}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700">
                  {saving ? 'Saving...' : <><Save className="h-4 w-4" /> Save</>}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info note when not filled */}
      {!emp?.name && !editing && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Complete your profile</p>
            <p className="text-xs mt-0.5">Click "Edit Profile" to fill in your details. Your information will be saved to the HR system automatically.</p>
          </div>
        </div>
      )}

      {/* Personal Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <Label>Full Name *</Label>
                <Input value={form.name || ''} onChange={e => setField('name', e.target.value)} placeholder="Your full name" />
              </div>
              <div className="space-y-1">
                <Label>Gender</Label>
                <Select value={form.gender || ''} onValueChange={v => setField('gender', v)}>
                  <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>{genderOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date of Birth</Label>
                <Input type="date" value={form.dob || ''} onChange={e => setField('dob', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Blood Group</Label>
                <Select value={form.bloodGroup || ''} onValueChange={v => setField('bloodGroup', v)}>
                  <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                  <SelectContent>{bloodGroups.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Referred By</Label>
                <Input value={form.referredBy || ''} onChange={e => setField('referredBy', e.target.value)} placeholder="Who referred you?" />
              </div>
            </div>
          ) : (
            <>
              <InfoRow label="Employee ID" value={emp?.employeeId} />
              <InfoRow label="Gender" value={emp?.gender} />
              <InfoRow label="Date of Birth" value={emp?.dob} />
              <InfoRow label="Blood Group" value={emp?.bloodGroup} />
              <InfoRow label="Referred By" value={emp?.referredBy} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" /> Contact Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Phone Number</Label>
                <Input value={form.phone || ''} onChange={e => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit number" inputMode="numeric" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email || ''} onChange={e => setField('email', e.target.value)} placeholder="your@email.com" />
              </div>
              <div className="space-y-1">
                <Label>Landline</Label>
                <Input value={form.landline || ''} onChange={e => setField('landline', e.target.value)} placeholder="Office landline" />
              </div>
            </div>
          ) : (
            <>
              <InfoRow label="Phone" value={emp?.phone} />
              <InfoRow label="Email" value={emp?.email} />
              <InfoRow label="Landline" value={emp?.landline} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Employment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" /> Employment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Department</Label>
                <Select value={form.department || ''} onValueChange={v => setField('department', v)}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {(departments.length > 0 ? departments : ['HR', 'Sales', 'Engineering', 'Finance', 'Operations'])
                      .map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Designation</Label>
                <Input value={form.role || ''} onChange={e => setField('role', e.target.value)} placeholder="e.g. Software Engineer" />
              </div>
              <div className="space-y-1">
                <Label>Joining Date</Label>
                <Input type="date" value={form.joiningDate || ''} onChange={e => setField('joiningDate', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Office Location</Label>
                <Select value={form.officeType || ''} onValueChange={v => setField('officeType', v)}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>{officeLocations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <>
              <InfoRow label="Department" value={emp?.department} />
              <InfoRow label="Designation" value={emp?.role} />
              <InfoRow label="Joining Date" value={emp?.joiningDate} />
              <InfoRow label="Office Location" value={emp?.officeType} />
              <InfoRow label="Project" value={emp?.project} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Bank Details — read only for employee */}
      {(emp?.bankName || emp?.bankAccountNo) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Bank Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Bank Name" value={emp?.bankName} />
            <InfoRow label="Account No." value={maskedAccount} />
            <InfoRow label="IFSC Code" value={emp?.bankIfsc} />
            <InfoRow label="Branch" value={emp?.bankBranch} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
