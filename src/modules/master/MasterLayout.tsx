import { Outlet, NavLink } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { LiveClock } from '@/components/layout/LiveClock';
import { ShoppingCart, Users, Package, Wallet, Briefcase } from 'lucide-react';

export default function MasterLayout() {
  const masterMenuItems = [
    { path: '/master/sales', label: 'Sales Master', icon: ShoppingCart },
    { path: '/master/hr', label: 'HR Master', icon: Users },
    { path: '/master/stores', label: 'Stores Master', icon: Package },
    { path: '/master/finance', label: 'Finance Master', icon: Wallet },
    { path: '/master/projects', label: 'Projects', icon: Briefcase },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Master Lists</h1>
            <p className="text-muted-foreground mt-1">Centralized master data for all modules</p>
          </div>
          <LiveClock />
        </div>

        <div className="flex gap-2 border-b border-border overflow-x-auto">
          {masterMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
