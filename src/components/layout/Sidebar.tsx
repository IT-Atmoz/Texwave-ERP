import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Server,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Handshake,
  ShoppingBag,
  Receipt,
  CreditCard,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'contacts', label: 'Contacts', icon: Handshake, path: '/contacts' },
  { id: 'sales', label: 'Sales', icon: ShoppingCart, path: '/sales' },
  { id: 'purchases', label: 'Purchases', icon: ShoppingBag, path: '/purchases' },
  { id: 'expenses', label: 'Expenses', icon: Receipt, path: '/expenses' },
  { id: 'banking', label: 'Banking', icon: CreditCard, path: '/banking' },
  { id: 'accounting', label: 'Accounting', icon: BookOpen, path: '/accounting' },
  { id: 'hr', label: 'HR', icon: Users, path: '/hr/dashboard' },
  { id: 'master', label: 'Master Lists', icon: Server, path: '/master' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, hasAccess } = useAuth();

  const filteredMenuItems = menuItems.filter(item => hasAccess(item.id));

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 sticky top-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header with Logo */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img
              src="/Texa_Logo.jpeg"
              alt="Texawave Logo"
              className="h-8 w-auto object-contain rounded"
            />
            <div>
              <h1 className="font-bold text-sm text-sidebar-foreground">Texawave ERP</h1>
              <p className="text-xs text-sidebar-foreground/60">Pvt Ltd</p>
            </div>
          </div>
        )}

        {collapsed && (
          <img
            src="/Texa_Logo.jpeg"
            alt="Texawave Logo"
            className="h-8 w-8 object-contain rounded"
          />
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground ml-auto transition-colors"
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && user && (
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-sidebar-accent flex items-center justify-center ring-2 ring-sidebar-primary/40">
              <span className="text-sidebar-primary font-semibold text-sm">
                {user.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                        : 'text-sidebar-foreground/70'
                    )
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={logout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
            'text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
