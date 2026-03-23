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
  { id: 'dashboard',  label: 'Dashboard',    icon: LayoutDashboard, path: '/dashboard' },
  { id: 'contacts',   label: 'Contacts',     icon: Handshake,       path: '/contacts' },
  { id: 'sales',      label: 'Sales',        icon: ShoppingCart,    path: '/sales' },
  { id: 'purchases',  label: 'Purchases',    icon: ShoppingBag,     path: '/purchases' },
  { id: 'expenses',   label: 'Expenses',     icon: Receipt,         path: '/expenses' },
  { id: 'banking',    label: 'Banking',      icon: CreditCard,      path: '/banking' },
  { id: 'accounting', label: 'Accounting',   icon: BookOpen,        path: '/accounting' },
  { id: 'hr',         label: 'HR',           icon: Users,           path: '/hr/dashboard' },
  { id: 'master',     label: 'Master Lists', icon: Server,          path: '/master' },
  { id: 'settings',   label: 'Settings',     icon: Settings,        path: '/settings' },
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
        'h-screen flex flex-col sticky top-0 z-30 shrink-0',
        'transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        collapsed ? 'w-[58px]' : 'w-[220px]',
      )}
      style={{
        background: 'hsl(222,47%,11%)',
        borderRight: '1px solid hsl(222,35%,16%)',
      }}
    >
      {/* ── Header ── */}
      <div className={cn(
        'flex items-center shrink-0 border-b',
        'transition-all duration-300',
        collapsed ? 'p-3 justify-center' : 'px-4 py-3 gap-3',
      )} style={{ borderColor: 'hsl(222,35%,16%)' }}>

        <div className="h-8 w-8 rounded-lg overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
          <img src="/Texa_Logo.jpeg" alt="Texawave" className="h-7 w-7 object-contain" />
        </div>

        {!collapsed && (
          <div className="flex-1 min-w-0 animate-fade-in-left">
            <p className="font-bold text-[13px] text-white leading-none tracking-tight">Texawave ERP</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'hsl(210,15%,50%)' }}>Enterprise Platform</p>
          </div>
        )}

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="h-6 w-6 rounded-md flex items-center justify-center transition-colors shrink-0"
            style={{ color: 'hsl(210,15%,45%)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'hsl(222,40%,17%)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── User card ── */}
      {!collapsed && user && (
        <div
          className="mx-3 mt-3 mb-0.5 rounded-xl px-3 py-2.5 animate-fade-in"
          style={{ background: 'hsl(222,40%,15%)', border: '1px solid hsl(222,35%,19%)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, hsl(152,76%,30%), hsl(152,70%,44%))' }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-white truncate leading-tight">{user.name}</p>
              <p className="text-[10px] capitalize mt-0.5" style={{ color: 'hsl(210,15%,48%)' }}>{user.role}</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" style={{ boxShadow: '0 0 6px hsl(152,70%,52%)' }} />
          </div>
        </div>
      )}

      {collapsed && user && (
        <div className="flex justify-center py-2.5">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white cursor-pointer"
            style={{ background: 'linear-gradient(135deg, hsl(152,76%,30%), hsl(152,70%,44%))' }}
            onClick={() => setCollapsed(false)}
            title={user.name}
          >
            {initials}
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 no-scrollbar">
        <ul className="space-y-0.5">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg text-[13px] font-medium',
                      'transition-all duration-150 group relative',
                      collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2',
                      isActive
                        ? 'text-white'
                        : 'hover:text-white',
                    )
                  }
                  style={({ isActive }) => ({
                    background: isActive ? 'hsl(152,70%,40%,0.15)' : 'transparent',
                    borderLeft: isActive && !collapsed ? '2px solid hsl(152,70%,48%)' : '2px solid transparent',
                    color: isActive ? 'hsl(152,70%,56%)' : 'hsl(210,15%,58%)',
                  })}
                  onMouseEnter={e => {
                    const el = e.currentTarget;
                    if (!el.getAttribute('data-active')) {
                      el.style.background = 'hsl(222,40%,17%)';
                      el.style.color = 'hsl(210,20%,88%)';
                    }
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget;
                    if (!el.getAttribute('data-active')) {
                      el.style.background = 'transparent';
                      el.style.color = 'hsl(210,15%,58%)';
                    }
                  }}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn('h-[17px] w-[17px] shrink-0 transition-transform duration-150 group-hover:scale-105')}
                        style={{ color: isActive ? 'hsl(152,70%,52%)' : undefined }}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {isActive && !collapsed && (
                        <span
                          className="ml-auto h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: 'hsl(152,70%,52%)' }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Bottom ── */}
      <div className="p-2 shrink-0 space-y-0.5" style={{ borderTop: '1px solid hsl(222,35%,16%)' }}>
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="w-full flex items-center justify-center p-2 rounded-lg transition-colors"
            style={{ color: 'hsl(210,15%,45%)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'hsl(222,40%,17%)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150',
            collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2',
          )}
          style={{ color: 'hsl(0,65%,60%)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'hsl(0,65%,50%,0.12)';
            e.currentTarget.style.color = 'hsl(0,65%,70%)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'hsl(0,65%,60%)';
          }}
        >
          <LogOut className="h-[17px] w-[17px] shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
