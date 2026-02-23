'use client';

import { NavLink, Outlet } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { cn } from '@/lib/utils';
import { FileText, ReceiptText, Wallet } from 'lucide-react';

const tabs = [
  {
    id: 'orders',
    label: <span className="flex items-center gap-1"><FileText size={16} />Purchase Orders</span>,
    path: '/purchases/orders',
  },
  {
    id: 'bills',
    label: <span className="flex items-center gap-1"><ReceiptText size={16} />Bills</span>,
    path: '/purchases/bills',
  },
  {
    id: 'payments-made',
    label: <span className="flex items-center gap-1"><Wallet size={16} />Payments Made</span>,
    path: '/purchases/payments-made',
  },
];

export default function PurchasesLayout() {
  return (
    <Layout>
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Purchases</h1>
          <p className="text-muted-foreground mt-1">Purchase orders, vendor bills and payment tracking</p>
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
