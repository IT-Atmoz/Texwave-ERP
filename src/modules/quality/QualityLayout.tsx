import { Outlet, NavLink } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { LiveClock } from '@/components/layout/LiveClock';
import { LayoutDashboard, Inbox, ClipboardCheck, Link2, BarChart3 } from 'lucide-react';

export default function QualityLayout() {
  const qualityMenuItems = [
    { path: '/quality', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/quality/incoming', label: 'Incoming Inspection', icon: Inbox },
    // { path: '/quality/stock-mapping', label: 'Stock Mapping', icon: Link2 },
    // { path: '/quality/reports', label: 'Reports', icon: BarChart3 },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Quality Module</h1>
            <p className="text-muted-foreground mt-1">Quality Control & Inspection Management</p>
          </div>
          <LiveClock />
        </div>

        <div className="flex gap-2 border-b border-border">
          {qualityMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/quality'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </div>

        <Outlet />
      </div>
    </Layout>
  );
}
