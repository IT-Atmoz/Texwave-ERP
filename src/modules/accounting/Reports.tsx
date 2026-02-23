import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';
import { getAllRecords } from '@/services/firebase';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    unpaidInvoices: [] as any[],
    unpaidBills: [] as any[],
    totalReceivables: 0,
    totalPayables: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoices, bills, expenses] = await Promise.all([
        getAllRecords('sales/invoices'),
        getAllRecords('purchases/bills'),
        getAllRecords('expenses/records'),
      ]);

      // Income: sum of all invoice grand totals
      const totalIncome = invoices.reduce((s: number, inv: any) => s + (inv.grandTotal || 0), 0);

      // Expenses: sum of bills + expense records
      const billsTotal = bills.reduce((s: number, b: any) => s + (b.total || 0), 0);
      const expensesTotal = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
      const totalExpenses = billsTotal + expensesTotal;
      const netProfit = totalIncome - totalExpenses;

      // Receivables: unpaid/partially paid invoices
      const unpaidInvoices = invoices
        .filter((inv: any) => ['Unpaid', 'Partial', 'Draft', 'Final'].includes(inv.paymentStatus))
        .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 10);
      const totalReceivables = unpaidInvoices.reduce(
        (s: number, inv: any) => s + ((inv.grandTotal || 0) - (inv.paidAmount || 0)),
        0
      );

      // Payables: unpaid bills
      const unpaidBills = bills
        .filter((b: any) => b.paymentStatus !== 'Paid')
        .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 10);
      const totalPayables = unpaidBills.reduce(
        (s: number, b: any) => s + ((b.total || 0) - (b.paidAmount || 0)),
        0
      );

      setData({ totalIncome, totalExpenses, netProfit, unpaidInvoices, unpaidBills, totalReceivables, totalPayables });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">Loading reports...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Financial Reports</h2>
        <p className="text-muted-foreground text-sm">Live data from Firebase — P&L, Receivables, Payables</p>
      </div>

      {/* P&L Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">₹{data.totalIncome.toLocaleString('en-IN')}</div>
            <p className="text-xs text-muted-foreground mt-1">All invoices total</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <div className="p-2 bg-red-50 rounded-lg">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">₹{data.totalExpenses.toLocaleString('en-IN')}</div>
            <p className="text-xs text-muted-foreground mt-1">Bills + expense records</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${data.netProfit >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit / Loss</CardTitle>
            <div className={`p-2 rounded-lg ${data.netProfit >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
              <DollarSign className={`h-5 w-5 ${data.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${data.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {data.netProfit < 0 ? '-' : ''}₹{Math.abs(data.netProfit).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Income − Expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Receivables & Payables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receivables */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Receivables
            </CardTitle>
            <Badge variant="outline" className="font-bold text-amber-600">
              ₹{data.totalReceivables.toLocaleString('en-IN')}
            </Badge>
          </CardHeader>
          <CardContent>
            {data.unpaidInvoices.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">All invoices paid</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.unpaidInvoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell><Badge variant="secondary" className="font-mono text-xs">{inv.invoiceNumber}</Badge></TableCell>
                      <TableCell className="text-sm">{inv.customerName}</TableCell>
                      <TableCell className="text-sm">{inv.dueDate || '—'}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-amber-600">
                        ₹{((inv.grandTotal || 0) - (inv.paidAmount || 0)).toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payables */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Payables
            </CardTitle>
            <Badge variant="outline" className="font-bold text-red-600">
              ₹{data.totalPayables.toLocaleString('en-IN')}
            </Badge>
          </CardHeader>
          <CardContent>
            {data.unpaidBills.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">All bills paid</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.unpaidBills.map((bill: any) => (
                    <TableRow key={bill.id}>
                      <TableCell><Badge variant="secondary" className="font-mono text-xs">{bill.billNumber}</Badge></TableCell>
                      <TableCell className="text-sm">{bill.vendorName}</TableCell>
                      <TableCell className="text-sm">{bill.dueDate || '—'}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-red-600">
                        ₹{((bill.total || 0) - (bill.paidAmount || 0)).toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
