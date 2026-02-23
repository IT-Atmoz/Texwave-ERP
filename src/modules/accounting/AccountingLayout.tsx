'use client';

import { NavLink, Outlet } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { cn } from '@/lib/utils';
import { BookOpen, ScrollText, BarChart3 } from 'lucide-react';

const tabs = [
  {
    id: 'chart-of-accounts',
    label: <span className="flex items-center gap-1"><BookOpen size={16} />Chart of Accounts</span>,
    path: '/accounting/chart-of-accounts',
  },
  {
    id: 'journal-entries',
    label: <span className="flex items-center gap-1"><ScrollText size={16} />Journal Entries</span>,
    path: '/accounting/journal-entries',
  },
  {
    id: 'reports',
    label: <span className="flex items-center gap-1"><BarChart3 size={16} />Reports</span>,
    path: '/accounting/reports',
  },
];

export default function AccountingLayout() {
  return (
    <Layout>
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Accounting</h1>
          <p className="text-muted-foreground mt-1">Chart of accounts, journal entries and financial reports</p>
        </div>

        <div className="border-b border-border">
          <nav className="flex gap-2 overflow-x-auto no-scrollbar -mb-px">
            {tabs.map((tab) => (
              <NavLink
                key={tab.id}
                to={tab.path}
                className={({ isActive }) =>
                  cn(
                    'px-4 py-2 text-sm font-medium rounded-t-md whitespace-nowrap transition-all flex items-center gap-1',
                    'hover:bg-accent hover:text-accent-foreground',
                    isActive
                      ? 'bg-background text-primary border-b-2 border-primary shadow-sm'
                      : 'text-muted-foreground'
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <Outlet />
      </div>
    </Layout>
  );
}
