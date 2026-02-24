import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, ShoppingCart, Users, Server, Settings,
  ChevronLeft, ChevronRight, LogOut, Handshake, ShoppingBag,
  Receipt, CreditCard, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard',  label: 'Dashboard',   icon: LayoutDashboard, path: '/dashboard' },
  { id: 'contacts',   label: 'Contacts',    icon: Handshake,       path: '/contacts' },
  { id: 'sales',      label: 'Sales',       icon: ShoppingCart,    path: '/sales' },
  { id: 'purchases',  label: 'Purchases',   icon: ShoppingBag,     path: '/purchases' },
  { id: 'expenses',   label: 'Expenses',    icon: Receipt,         path: '/expenses' },
  { id: 'banking',    label: 'Banking',     icon: CreditCard,      path: '/banking' },
  { id: 'accounting', label: 'Accounting',  icon: BookOpen,        path: '/accounting' },
  { id: 'hr',         label: 'HR',          icon: Users,           path: '/hr/dashboard' },
  { id: 'master',     label: 'Master Lists',icon: Server,          path: '/master' },
  { id: 'settings',   label: 'Settings',    icon: Settings,        path: '/settings' },
];

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, hasAccess } = useAuth();

  const filteredMenuItems = menuItems.filter(item => hasAccess(item.id));

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar border-r border-sidebar-border flex flex-col sticky top-0 z-30',
        'transition-[width] duration-300 ease-smooth',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      {/* ── Header ── */}
      <div className={cn(
        'flex items-center border-b border-sidebar-border shrink-0',
        collapsed ? 'p-3 justify-center' : 'p-4 gap-3',
      )}>
        {/* Logo */}
        <div className={cn(
          'rounded-xl overflow-hidden shrink-0 shadow-inner-glow',
          collapsed ? 'h-9 w-9' : 'h-9 w-9',
        )}>
          <img
            src="/Texa_Logo.jpeg"
            alt="Texawave"
            className="h-full w-full object-contain"
          />
        </div>

        {/* Brand text */}
        {!collapsed && (
          <div className="flex-1 min-w-0 animate-fade-in-left">
            <p className="font-bold text-sm text-sidebar-foreground leading-none">Texawave ERP</p>
            <p className="text-[11px] text-sidebar-foreground/50 mt-0.5">Enterprise Platform</p>
          </div>
        )}

        {/* Collapse toggle */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="h-7 w-7 rounded-lg flex items-center justify-center
              text-sidebar-foreground/40 hover:text-sidebar-foreground
              hover:bg-sidebar-accent transition-all duration-150 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── User card ── */}
      {!collapsed && user && (
        <div className="mx-3 mt-3 mb-1 rounded-xl bg-sidebar-accent/60 border border-sidebar-border/40 px-3 py-2.5 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-[11px] font-bold text-white">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">{user.name}</p>
              <p className="text-[10px] text-sidebar-foreground/50 capitalize mt-0.5">{user.role}</p>
            </div>
            <div className="ml-auto shrink-0">
              <span className="h-2 w-2 rounded-full bg-green-400 block animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Collapsed avatar */}
      {collapsed && user && (
        <div className="flex justify-center py-2">
          <div
            className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center shadow-sm cursor-pointer"
            onClick={() => setCollapsed(false)}
            title={user.name}
          >
            <span className="text-[11px] font-bold text-white">{initials}</span>
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <ul className="space-y-0.5">
          {filteredMenuItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <li key={item.id} style={{ animationDelay: `${idx * 30}ms` }}>
                <NavLink
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg text-sm font-medium',
                      'transition-all duration-150 ease-smooth group',
                      collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
                      isActive
                        ? [
                            'bg-sidebar-primary/20 text-sidebar-primary',
                            'border-l-2 border-sidebar-primary',
                            collapsed ? 'border-l-0' : '',
                            'shadow-sm',
                          ].join(' ')
                        : 'text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/70',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-transform duration-200',
                        'group-hover:scale-110',
                        isActive ? 'text-sidebar-primary' : '',
                      )} />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {isActive && !collapsed && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary shrink-0" />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Bottom: expand + logout ── */}
      <div className="p-2 border-t border-sidebar-border space-y-1 shrink-0">
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="w-full flex items-center justify-center p-2 rounded-lg
              text-sidebar-foreground/50 hover:text-sidebar-foreground
              hover:bg-sidebar-accent transition-all duration-150"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg text-sm font-medium',
            'text-red-400/70 hover:text-red-300 hover:bg-red-500/15',
            'transition-all duration-150',
            collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
