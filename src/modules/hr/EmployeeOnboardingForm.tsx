// src/modules/hr/EmployeeOnboardingForm.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ref, get, update, set } from 'firebase/database';
import { database } from '@/services/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Loader2, ClipboardList, Eye, EyeOff } from 'lucide-react';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const officeLocations = ['OMR', 'Anna Nagar', 'Coimbatore', 'Remote'];

interface OnboardingRecord {
  employeeKey: string;
  status: 'pending' | 'submitted';
  createdAt: number;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  bloodGroup: string;
  department: string;
  role: string;
  officeType: string;
  joiningDate: string;
  landline: string;
  referredBy: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

export default function EmployeeOnboardingForm() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [record, setRecord] = useState<OnboardingRecord | null>(null);
  const [pageError, setPageError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    bloodGroup: '',
    department: '',
    role: '',
    officeType: '',
    joiningDate: '',
    landline: '',
    referredBy: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

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
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!/^\d{10}$/.test(form.phone)) e.phone = 'Phone must be exactly 10 digits';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email is required';
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
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
      // Update the employee record with submitted details
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

      // Create portal login account — employee sets their own email + password
      await set(ref(database, `users/${record.employeeKey}`), {
        email: form.email.trim(),
        password: form.password,
        role: 'employee',
        name: form.name.trim(),
        createdAt: Date.now(),
      });

      // Mark onboarding token as submitted
      await update(ref(database, `hr/employeeOnboarding/${token}`), {
        status: 'submitted',
        submittedAt: Date.now(),
        submittedData: {
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
        },
      });

      setSubmitted(true);
    } catch {
      setErrors(prev => ({ ...prev, name: 'Submission failed. Please try again.' }));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
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

  // ── Already submitted ────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-800">Details Submitted Successfully!</h2>
            <p className="text-sm text-muted-foreground">
              Your information has been received and your portal account is ready.
              You can now log in to the Employee Portal using your email and the password you set.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="bg-blue-600 text-white p-3 rounded-full">
              <ClipboardList className="h-7 w-7" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Onboarding Form</h1>
          <p className="text-sm text-muted-foreground">
            Fill in your details below. Your information will be recorded automatically and your Employee Portal account will be created.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-base text-gray-700">Personal &amp; Work Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Full Name */}
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
                {/* Phone */}
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

                {/* Email */}
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

                {/* Blood Group */}
                <div className="space-y-1">
                  <Label>Blood Group <span className="text-red-500">*</span></Label>
                  <Select value={form.bloodGroup} onValueChange={v => setField('bloodGroup', v)}>
                    <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                    <SelectContent>
                      {bloodGroups.map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.bloodGroup && <p className="text-xs text-red-500">{errors.bloodGroup}</p>}
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <Label>Department <span className="text-red-500">*</span></Label>
                  <Select value={form.department} onValueChange={v => setField('department', v)}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {(departments.length > 0
                        ? departments
                        : ['HR', 'Sales', 'Engineering', 'Finance', 'Operations']
                      ).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.department && <p className="text-xs text-red-500">{errors.department}</p>}
                </div>

                {/* Designation */}
                <div className="space-y-1">
                  <Label>Designation <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.role}
                    onChange={e => setField('role', e.target.value)}
                    placeholder="e.g. Software Engineer"
                  />
                  {errors.role && <p className="text-xs text-red-500">{errors.role}</p>}
                </div>

                {/* Office Location */}
                <div className="space-y-1">
                  <Label>Office Location <span className="text-red-500">*</span></Label>
                  <Select value={form.officeType} onValueChange={v => setField('officeType', v)}>
                    <SelectTrigger><SelectValue placeholder="Select office location" /></SelectTrigger>
                    <SelectContent>
                      {officeLocations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.officeType && <p className="text-xs text-red-500">{errors.officeType}</p>}
                </div>

                {/* Joining Date */}
                <div className="space-y-1">
                  <Label>Joining Date <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={form.joiningDate}
                    onChange={e => setField('joiningDate', e.target.value)}
                  />
                  {errors.joiningDate && <p className="text-xs text-red-500">{errors.joiningDate}</p>}
                </div>

                {/* Landline */}
                <div className="space-y-1">
                  <Label>Landline</Label>
                  <Input
                    value={form.landline}
                    onChange={e => setField('landline', e.target.value)}
                    placeholder="Office landline number"
                  />
                </div>
              </div>

              {/* Referred By */}
              <div className="space-y-1">
                <Label>Referred By</Label>
                <Input
                  value={form.referredBy}
                  onChange={e => setField('referredBy', e.target.value)}
                  placeholder="Name of the person who referred you"
                />
              </div>

              {/* Portal Password Section */}
              <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                <p className="text-sm font-medium text-gray-700">Set Your Employee Portal Password</p>
                <p className="text-xs text-muted-foreground">
                  You will use your email and this password to log in to the Employee Portal.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Password <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => setField('password', e.target.value)}
                        placeholder="Min. 6 characters"
                        className="pr-9"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPassword(v => !v)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label>Confirm Password <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input
                        type={showConfirm ? 'text' : 'password'}
                        value={form.confirmPassword}
                        onChange={e => setField('confirmPassword', e.target.value)}
                        placeholder="Re-enter your password"
                        className="pr-9"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowConfirm(v => !v)}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword}</p>}
                  </div>
                </div>
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
