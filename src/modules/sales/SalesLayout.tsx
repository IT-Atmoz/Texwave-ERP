'use client';

import { NavLink, Outlet } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { cn } from '@/lib/utils';
import { LiveClock } from '@/components/layout/LiveClock';

import {
  Home,
  Users,
  Package,
  FileText,
  ShoppingCart,
  Receipt,
  Wallet,
  FileMinus,
} from 'lucide-react';

const salesTabs = [
  {
    id: 'dashboard',
    label: <span className="flex items-center gap-1"><Home size={16} />Dashboard</span>,
    path: '/sales',
    end: true,
  },
  {
    id: 'customers',
    label: <span className="flex items-center gap-1"><Users size={16} />Customers</span>,
    path: '/sales/customers',
  },
  {
    id: 'products',
    label: <span className="flex items-center gap-1"><Package size={16} />Items</span>,
    path: '/sales/products',
  },
  {
    id: 'quotations',
    label: <span className="flex items-center gap-1"><FileText size={16} />Estimates</span>,
    path: '/sales/quotations',
  },
  {
    id: 'orders',
    label: <span className="flex items-center gap-1"><ShoppingCart size={16} />Sales Orders</span>,
    path: '/sales/orders',
  },
  {
    id: 'invoices',
    label: <span className="flex items-center gap-1"><Receipt size={16} />Invoices</span>,
    path: '/sales/invoices',
  },
  {
    id: 'credit-notes',
    label: <span className="flex items-center gap-1"><FileMinus size={16} />Credit Notes</span>,
    path: '/sales/credit-notes',
  },
  {
    id: 'payments-received',
    label: <span className="flex items-center gap-1"><Wallet size={16} />Payments Received</span>,
    path: '/sales/payments-received',
  },
];

export default function SalesLayout() {
  return (
    <Layout>
      <div className="space-y-6 pb-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sales</h1>
            <p className="text-muted-foreground mt-1">
              Estimates, orders, invoices and payment management
            </p>
          </div>
          <LiveClock />
        </div>

        <div className="border-b border-border">
          <nav className="flex gap-2 overflow-x-auto no-scrollbar -mb-px">
            {salesTabs.map((tab) => (
              <NavLink
                key={tab.id}
                to={tab.path}
                end={tab.end}
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
