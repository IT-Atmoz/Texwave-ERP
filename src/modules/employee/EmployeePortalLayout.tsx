import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, MapPin, Clock, User, FolderOpen, LogOut, FileText,
  Calendar, CalendarDays,
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
      { path: '/employee/checkin',    label: 'Check In / Out', icon: MapPin },
      { path: '/employee/attendance', label: 'Attendance',     icon: Calendar },
      { path: '/employee/timesheet',  label: 'My Timesheet',   icon: Clock },
    ],
  },
  {
    label: 'LEAVES',
    items: [
      { path: '/employee/leaves', label: 'Leave Tracker', icon: CalendarDays },
    ],
  },
  {
    label: 'MY INFO',
    items: [
      { path: '/employee/profile',   label: 'My Profile', icon: User },
      { path: '/employee/documents', label: 'Documents',  icon: FolderOpen },
    ],
  },
];

export default function EmployeePortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'E';

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Top Bar ── */}
      <header className="h-14 bg-card/80 backdrop-blur-md border-b border-border/60 flex items-center justify-between px-5 shrink-0 z-20 sticky top-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-white border border-border shadow-sm flex items-center justify-center overflow-hidden">
            <img src="/Texa_Logo.jpeg" alt="Texawave" className="h-7 w-7 object-contain" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-bold text-foreground">Texawave ERP</p>
            <p className="text-[10px] text-muted-foreground">Employee Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pl-3 border-l border-border/60">
            <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center shadow-sm shrink-0">
              <span className="text-xs font-bold text-white">{initials}</span>
            </div>
            <div className="hidden sm:block leading-none text-right">
              <p className="text-xs font-semibold text-foreground">{user?.name}</p>
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

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-52 bg-sidebar border-r border-sidebar-border flex flex-col overflow-y-auto shrink-0">
          <nav className="flex-1 py-3">
            {navGroups.map((group, gi) => (
              <div key={group.label}>
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/35 px-4 mb-1 mt-4 first:mt-2">
                  {group.label}
                </p>
                {group.items.map((item, ii) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end
                      style={{ animationDelay: `${(gi * 3 + ii) * 35}ms` }}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg text-sm transition-all duration-150 ${
                          isActive
                            ? 'bg-sidebar-primary/20 text-sidebar-primary font-semibold border-l-2 border-sidebar-primary shadow-sm'
                            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                          <span className="truncate">{item.label}</span>
                          {isActive && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary shrink-0" />
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Bottom user card */}
          <div className="p-3 border-t border-sidebar-border shrink-0">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-sidebar-accent/50 border border-sidebar-border/40">
              <div className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-[10px] font-bold text-white">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.name}</p>
                <p className="text-[10px] text-sidebar-foreground/50">Employee</p>
              </div>
              <div className="ml-auto shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 block animate-pulse" />
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col bg-muted/20">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="page-enter">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
