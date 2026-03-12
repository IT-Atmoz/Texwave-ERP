// src/modules/hr/EmployeeOnboardingForm.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ref, get, update } from 'firebase/database';
import { database } from '@/services/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Loader2, ClipboardList } from 'lucide-react';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const officeLocations = ['OMR', 'Anna Nagar', 'Coimbatore', 'Remote'];

interface OnboardingRecord {
  employeeKey: string;
  email: string;
  status: 'pending' | 'submitted';
  createdAt: number;
  submittedAt?: number;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  bloodGroup: string;
  department: string;
  role: string;
  officeType: string;
  joiningDate: string;
  landline: string;
  referredBy: string;
}

export default function EmployeeOnboardingForm() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [record, setRecord] = useState<OnboardingRecord | null>(null);
  const [pageError, setPageError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    email: '',
    bloodGroup: '',
    department: '',
    role: '',
    officeType: '',
    joiningDate: '',
    landline: '',
    referredBy: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    const load = async () => {
      if (!token) { setPageError('Invalid link.'); setLoading(false); return; }
      try {
        const [snap, deptsSnap] = await Promise.all([
          get(ref(database, `hr/employeeOnboarding/${token}`)),
          get(ref(database, 'masters/hr/departments')),
        ]);

        if (!snap.exists()) { setPageError('This link is invalid or has expired.'); setLoading(false); return; }

        const data = snap.val() as OnboardingRecord;
        setRecord(data);

        if (data.status === 'submitted') {
          setSubmitted(true);
        } else {
          setForm(f => ({ ...f, email: data.email || '' }));
        }

        if (deptsSnap.exists()) {
          const val = deptsSnap.val();
          setDepartments(Array.isArray(val) ? val : Object.values(val));
        }
      } catch {
        setPageError('Failed to load form. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!/^\d{10}$/.test(form.phone)) e.phone = 'Phone must be exactly 10 digits';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email is required';
    if (!form.bloodGroup) e.bloodGroup = 'Select blood group';
    if (!form.department) e.department = 'Select department';
    if (!form.role.trim()) e.role = 'Designation is required';
    if (!form.officeType) e.officeType = 'Select office location';
    if (!form.joiningDate) e.joiningDate = 'Joining date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const setField = (field: keyof FormState, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const next = { ...e }; delete next[field]; return next; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !token || !record) return;

    setSubmitting(true);
    try {
      await update(ref(database, `hr/employees/${record.employeeKey}`), {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        bloodGroup: form.bloodGroup,
        department: form.department,
        role: form.role.trim(),
        officeType: form.officeType,
        joiningDate: form.joiningDate,
        landline: form.landline.trim(),
        referredBy: form.referredBy.trim(),
        onboardingSubmittedAt: Date.now(),
        updatedAt: Date.now(),
      });

      await update(ref(database, `hr/employeeOnboarding/${token}`), {
        status: 'submitted',
        submittedAt: Date.now(),
        submittedData: { ...form },
      });

      setSubmitted(true);
    } catch {
      setErrors(prev => ({ ...prev, name: 'Submission failed. Please try again.' }));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="text-lg font-semibold text-gray-800">{pageError}</p>
            <p className="text-sm text-muted-foreground">Contact your HR team for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-800">Details Submitted Successfully!</h2>
            <p className="text-sm text-muted-foreground">
              Your information has been received. HR will review and complete your employee profile.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="bg-blue-600 text-white p-3 rounded-full">
              <ClipboardList className="h-7 w-7" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Onboarding Form</h1>
          <p className="text-sm text-muted-foreground">
            Please fill in your details accurately. This information will be used to set up your employee profile.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-base text-gray-700">Personal &amp; Work Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="Enter your full name"
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Phone Number <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.phone}
                    onChange={e => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    inputMode="numeric"
                  />
                  {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                </div>

                <div className="space-y-1">
                  <Label>Email <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setField('email', e.target.value)}
                    placeholder="your@email.com"
                  />
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>

                <div className="space-y-1">
                  <Label>Blood Group <span className="text-red-500">*</span></Label>
                  <Select value={form.bloodGroup} onValueChange={v => setField('bloodGroup', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {bloodGroups.map(bg => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.bloodGroup && <p className="text-xs text-red-500">{errors.bloodGroup}</p>}
                </div>

                <div className="space-y-1">
                  <Label>Department <span className="text-red-500">*</span></Label>
                  <Select value={form.department} onValueChange={v => setField('department', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {(departments.length > 0
                        ? departments
                        : ['HR', 'Sales', 'Engineering', 'Finance', 'Operations']
                      ).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.department && <p className="text-xs text-red-500">{errors.department}</p>}
                </div>

                <div className="space-y-1">
                  <Label>Designation <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.role}
                    onChange={e => setField('role', e.target.value)}
                    placeholder="e.g. Software Engineer"
                  />
                  {errors.role && <p className="text-xs text-red-500">{errors.role}</p>}
                </div>

                <div className="space-y-1">
                  <Label>Office Location <span className="text-red-500">*</span></Label>
                  <Select value={form.officeType} onValueChange={v => setField('officeType', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select office location" />
                    </SelectTrigger>
                    <SelectContent>
                      {officeLocations.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.officeType && <p className="text-xs text-red-500">{errors.officeType}</p>}
                </div>

                <div className="space-y-1">
                  <Label>Joining Date <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={form.joiningDate}
                    onChange={e => setField('joiningDate', e.target.value)}
                  />
                  {errors.joiningDate && <p className="text-xs text-red-500">{errors.joiningDate}</p>}
                </div>

                <div className="space-y-1">
                  <Label>Landline</Label>
                  <Input
                    value={form.landline}
                    onChange={e => setField('landline', e.target.value)}
                    placeholder="Office landline number"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Referred By</Label>
                <Input
                  value={form.referredBy}
                  onChange={e => setField('referredBy', e.target.value)}
                  placeholder="Name of the person who referred you"
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Fields marked with <span className="text-red-500">*</span> are required. Please ensure all information is accurate before submitting.
                </AlertDescription>
              </Alert>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                  : 'Submit My Details'
                }
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
