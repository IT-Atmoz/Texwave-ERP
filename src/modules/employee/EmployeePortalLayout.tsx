import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, MapPin, Clock, User, FolderOpen, LogOut, FileText,
} from 'lucide-react';

const navGroups = [
  {
    label: 'OVERVIEW',
    items: [
      { path: '/employee/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'ATTENDANCE',
    items: [
      { path: '/employee/checkin', label: 'Check In / Out', icon: MapPin },
      { path: '/employee/timesheet', label: 'My Timesheet', icon: Clock },
    ],
  },
  {
    label: 'MY INFO',
    items: [
      { path: '/employee/profile', label: 'My Profile', icon: User },
      { path: '/employee/documents', label: 'Documents', icon: FolderOpen },
    ],
  },
];

export default function EmployeePortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'E';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="h-14 bg-white border-b border-border flex items-center justify-between px-5 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-white border border-border shadow-sm flex items-center justify-center overflow-hidden">
            <img src="/Texa_Logo.jpeg" alt="Texawave" className="h-7 w-7 object-contain" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-bold text-foreground">Texawave ERP</p>
            <p className="text-[10px] text-muted-foreground">Employee Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">{initials}</span>
            </div>
            <div className="hidden sm:block leading-none text-right">
              <p className="text-sm font-semibold text-foreground">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground">{user?.employeeId}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive gap-1.5 h-8"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Logout</span>
          </Button>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 bg-white border-r border-border flex flex-col overflow-y-auto shrink-0">
          <nav className="flex-1 py-3">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-3 mb-1 mt-4 first:mt-2">
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
                        `flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-md text-sm transition-all ${
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

          {/* Bottom user card */}
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-white">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user?.name}</p>
                <p className="text-[10px] text-muted-foreground">Employee</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 bg-muted/20">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
