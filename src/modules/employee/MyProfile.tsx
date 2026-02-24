import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { database } from '@/services/firebase';
import { ref, get } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  User, Phone, Mail, MapPin, Building, Calendar, Briefcase, CreditCard
} from 'lucide-react';

interface EmployeeData {
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
  dateOfBirth?: string;
  profilePhoto?: string;
  presentAddress?: { address?: string; city?: string; state?: string; pincode?: string };
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
  status?: string;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function MyProfile() {
  const { user } = useAuth();
  const [emp, setEmp] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.employeeId) return;
    const load = async () => {
      // Employees are stored under Firebase push keys, not the display employeeId.
      // Search all employees to find the one matching this user's employeeId.
      const snap = await get(ref(database, 'hr/employees'));
      if (snap.exists()) {
        const data = snap.val();
        const found = Object.values(data).find(
          (e: any) => e.employeeId === user.employeeId
        ) as EmployeeData | undefined;
        setEmp(found ?? null);
      } else {
        setEmp(null);
      }
      setLoading(false);
    };
    load();
  }, [user?.employeeId]);

  const initials = emp?.name
    ? emp.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'E';

  const maskedAccount = emp?.bankAccountNo
    ? '*'.repeat(Math.max(0, emp.bankAccountNo.length - 4)) + emp.bankAccountNo.slice(-4)
    : null;

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading profile...</div>;
  }

  if (!emp) {
    return <div className="text-center py-12 text-muted-foreground">Profile not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-4">
            {emp.profilePhoto ? (
              <img
                src={emp.profilePhoto}
                alt={emp.name}
                className="h-16 w-16 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border shrink-0">
                <span className="text-xl font-bold text-primary">{initials}</span>
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-foreground">{emp.name}</h2>
              <p className="text-sm text-muted-foreground">{emp.role} · {emp.department}</p>
              <Badge variant={emp.status === 'active' ? 'default' : 'secondary'} className="mt-1 capitalize">
                {emp.status ?? 'active'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Employee ID" value={emp.employeeId} />
          <InfoRow label="Gender" value={emp.gender} />
          <InfoRow label="Date of Birth" value={emp.dateOfBirth} />
          <InfoRow label="Blood Group" value={emp.bloodGroup} />
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Contact & Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Phone" value={emp.phone} />
          <InfoRow label="Email" value={emp.email} />
          {emp.presentAddress && (
            <InfoRow
              label="Address"
              value={[emp.presentAddress.address, emp.presentAddress.city, emp.presentAddress.state, emp.presentAddress.pincode]
                .filter(Boolean).join(', ')}
            />
          )}
        </CardContent>
      </Card>

      {/* Employment Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Employment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Department" value={emp.department} />
          <InfoRow label="Designation" value={emp.role} />
          <InfoRow label="Joining Date" value={emp.joiningDate} />
          <InfoRow label="Project" value={emp.project} />
          <InfoRow label="Work Domain" value={emp.workDomain} />
        </CardContent>
      </Card>

      {/* Bank Details */}
      {(emp.bankName || emp.bankAccountNo) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Bank Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Bank Name" value={emp.bankName} />
            <InfoRow label="Account No." value={maskedAccount} />
            <InfoRow label="IFSC Code" value={emp.bankIfsc} />
            <InfoRow label="Branch" value={emp.bankBranch} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
