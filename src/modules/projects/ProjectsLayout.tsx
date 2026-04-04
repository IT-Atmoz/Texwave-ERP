import { Outlet, NavLink } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { LayoutDashboard, FolderKanban, BarChart3 } from 'lucide-react';

const navGroups = [
  {
    label: 'OVERVIEW',
    items: [
      { path: '/projects/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'PROJECTS',
    items: [
      { path: '/projects/list', label: 'All Projects', icon: FolderKanban },
    ],
  },
  {
    label: 'INSIGHTS',
    items: [
      { path: '/projects/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
];

export default function ProjectsLayout() {
  return (
    <Layout>
      <div className="-m-6 flex" style={{ minHeight: 'calc(100vh - 4rem)' }}>
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-border flex flex-col overflow-y-auto shrink-0">
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderKanban className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-none">Projects</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Project Management</p>
              </div>
            </div>
          </div>

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
