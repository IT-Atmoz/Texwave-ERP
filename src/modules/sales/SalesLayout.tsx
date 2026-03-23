'use client';

import { NavLink, Outlet } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { cn } from '@/lib/utils';

import {
  Home,
  Users,
  Package,
  FileText,
  ShoppingCart,
  Receipt,
  Wallet,
  FileMinus,
  Truck,
  Landmark,
  RotateCcw,
  BarChart3,
  Settings,
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
    label: <span className="flex items-center gap-1"><FileText size={16} />Quotations</span>,
    path: '/sales/quotations',
  },
  {
    id: 'orders',
    label: <span className="flex items-center gap-1"><ShoppingCart size={16} />Sales Orders</span>,
    path: '/sales/orders',
  },
  {
    id: 'invoices',
    label: <span className="flex items-center gap-1"><Receipt size={16} />Invoices & Delivery Challans</span>,
    path: '/sales/invoices',
  },
  {
    id: 'payments-received',
    label: <span className="flex items-center gap-1"><Wallet size={16} />Payments Received</span>,
    path: '/sales/payments-received',
  },
  {
    id: 'credit-notes',
    label: <span className="flex items-center gap-1"><FileMinus size={16} />Credit Notes</span>,
    path: '/sales/credit-notes',
  },
  {
    id: 'retainer-invoices',
    label: <span className="flex items-center gap-1"><Landmark size={16} />Retainer Invoices</span>,
    path: '/sales/retainer-invoices',
  },
  {
    id: 'recurring-invoices',
    label: <span className="flex items-center gap-1"><RotateCcw size={16} />Recurring Invoices</span>,
    path: '/sales/recurring-invoices',
  },
  {
    id: 'reports',
    label: <span className="flex items-center gap-1"><BarChart3 size={16} />Reports</span>,
    path: '/sales/reports',
  },
  {
    id: 'settings',
    label: <span className="flex items-center gap-1"><Settings size={16} />Settings</span>,
    path: '/sales/settings',
  },
];

export default function SalesLayout() {
  return (
    <Layout>
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales</h1>
          <p className="text-muted-foreground mt-1">
            Quotations, orders, invoices and payment management
          </p>
        </div>

        <div className="border-b border-slate-200">
          <nav className="flex gap-0.5 overflow-x-auto no-scrollbar -mb-px">
            {salesTabs.map((tab) => (
              <NavLink
                key={tab.id}
                to={tab.path}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap transition-all flex items-center gap-1.5 rounded-t border-b-2',
                    isActive
                      ? 'text-primary border-primary bg-primary/5'
                      : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-100/70'
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
