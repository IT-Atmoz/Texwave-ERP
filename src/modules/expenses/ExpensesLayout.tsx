'use client';

import { Outlet } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';

export default function ExpensesLayout() {
  return (
    <Layout>
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Expenses</h1>
          <p className="text-muted-foreground mt-1">Track and manage business expenses</p>
        </div>
        <Outlet />
      </div>
    </Layout>
  );
}
