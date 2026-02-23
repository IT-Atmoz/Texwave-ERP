import { Outlet, NavLink } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { LiveClock } from '@/components/layout/LiveClock';
import { LayoutDashboard, Briefcase, Package, Archive, Boxes } from 'lucide-react';

export default function ProductionLayout() {
  const productionMenuItems = [
    { path: '/production', label: 'Production Jobs', icon: Briefcase },
    // { path: '/production/batches', label: 'Batch Management', icon: Archive },
    // { path: '/production/raw-materials', label: 'Raw Materials', icon: Package },
    // { path: '/production/wip', label: 'WIP Stock', icon: Boxes },
    // { path: '/production/fg-stock', label: 'FG Stock', icon: Package },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Production</h1>
            <p className="text-muted-foreground mt-1">Manufacturing and inventory management</p>
          </div>
          <LiveClock />
        </div>

        <div className="flex gap-2 border-b border-border overflow-x-auto">
          {productionMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/production'}
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
