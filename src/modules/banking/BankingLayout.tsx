'use client';

import { NavLink, Outlet } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { cn } from '@/lib/utils';
import { Landmark, ArrowLeftRight } from 'lucide-react';

const tabs = [
  {
    id: 'accounts',
    label: <span className="flex items-center gap-1"><Landmark size={16} />Bank Accounts</span>,
    path: '/banking/accounts',
  },
  {
    id: 'transactions',
    label: <span className="flex items-center gap-1"><ArrowLeftRight size={16} />Transactions</span>,
    path: '/banking/transactions',
  },
];

export default function BankingLayout() {
  return (
    <Layout>
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Banking</h1>
          <p className="text-muted-foreground mt-1">Manage bank accounts and transactions</p>
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
