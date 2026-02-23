'use client';

import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { cn } from '@/lib/utils';
import { Users, Building2 } from 'lucide-react';

const contactsTabs = [
  {
    id: 'customers',
    label: (
      <span className="flex items-center gap-1">
        <Users size={16} />
        Customers
      </span>
    ),
    path: '/contacts/customers',
  },
  {
    id: 'vendors',
    label: (
      <span className="flex items-center gap-1">
        <Building2 size={16} />
        Vendors
      </span>
    ),
    path: '/contacts/vendors',
  },
];

export default function ContactsLayout() {
  return (
    <Layout>
      <div className="space-y-6 pb-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Contacts</h1>
            <p className="text-muted-foreground mt-1">Manage customers and vendors</p>
          </div>
        </div>

        <div className="border-b border-border">
          <nav className="flex gap-2 overflow-x-auto no-scrollbar -mb-px">
            {contactsTabs.map((tab) => (
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
