// src/modules/hr/HRLayout.tsx

import { Outlet, NavLink } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  CalendarCheck,
  FileText,
  HandCoins,
  FolderOpen,
  CalendarPlus,
  CalendarDays,
  CircleOff,
  UserCircle,
  FileStack,
  LayoutDashboard,
  CheckCircle,
  ShieldCheck,
  ShieldPlus,
  IndianRupee,
  CalendarX2,
  BriefcaseBusiness,
  GitBranch,
  ClipboardList,
} from 'lucide-react';

export default function HRLayout() {
  const { user } = useAuth();

  const navGroups = [
    {
      label: 'OVERVIEW',
      items: [
        { path: '/hr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'PEOPLE',
      items: [
        { path: '/hr/employees', label: 'Employees', icon: Users },
        { path: '/hr/profile', label: 'Profiles', icon: UserCircle },
        { path: '/hr/shifts', label: 'Shifts', icon: BriefcaseBusiness },
        { path: '/hr/org-chart', label: 'Org Chart', icon: GitBranch },
        { path: '/hr/time-logs', label: 'Work Logs', icon: ClipboardList },
      ],
    },
    {
      label: 'TIME & ATTENDANCE',
      items: [
        { path: '/hr/attendance', label: 'Attendance', icon: CalendarCheck },
        { path: '/hr/approval-attendance', label: 'Approval', icon: CheckCircle },
        { path: '/hr/full-month-present', label: 'Full Month Present', icon: CalendarDays },
        { path: '/hr/full-month-absent', label: 'Full Month Absent', icon: CircleOff },
      ],
    },
    {
      label: 'LEAVE MANAGEMENT',
      items: [
        { path: '/hr/leaves', label: 'Leaves', icon: FileText },
        { path: '/hr/holidays', label: 'Holidays', icon: CalendarPlus },
        { path: '/hr/holial', label: 'Holiday Alerts', icon: CalendarX2 },
      ],
    },
    {
      label: 'PAYROLL & COMPLIANCE',
      items: [
        { path: '/hr/payroll', label: 'Payroll', icon: IndianRupee },
        { path: '/hr/pf', label: 'PF', icon: ShieldCheck },
        { path: '/hr/esi', label: 'ESI', icon: ShieldPlus },
        { path: '/hr/loans', label: 'Loans', icon: HandCoins },
        { path: '/hr/bonus', label: 'Bonus', icon: IndianRupee },
      ],
    },
    {
      label: 'DOCUMENTS',
      items: [
        { path: '/hr/documents', label: 'Employee Documents', icon: FolderOpen },
        { path: '/hr/other-documents', label: 'Other Documents', icon: FileStack },
      ],
    },
    ...(user?.role === 'admin' ? [{
      label: 'SETTINGS',
      items: [
        { path: '/hr/privileges', label: 'Privilege Manager', icon: ShieldCheck },
      ],
    }] : []),
  ];

  return (
    <Layout>
      <div className="-m-6 flex" style={{ minHeight: 'calc(100vh - 4rem)' }}>
        {/* Left Sidebar */}
        <aside className="w-56 bg-white border-r border-border flex flex-col overflow-y-auto shrink-0">
          {/* HR Header */}
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-none">HR Module</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">People & Payroll</p>
              </div>
            </div>
          </div>

          {/* Nav Groups */}
          <nav className="flex-1 py-2 overflow-y-auto">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-3 mb-1 mt-4">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2 mx-1 rounded-md text-sm transition-all ${
                          isActive
                            ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          <Outlet />
        </div>
      </div>
    </Layout>
  );
}
