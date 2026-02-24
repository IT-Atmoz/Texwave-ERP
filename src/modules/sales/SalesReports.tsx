"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SalesByCustomer from "./reports/SalesByCustomer"
import SalesByItem from "./reports/SalesByItem"
import SalesBySalesperson from "./reports/SalesBySalesperson"
import InvoiceAging from "./reports/InvoiceAging"
import EstimateConversion from "./reports/EstimateConversion"
import CustomerBalances from "./reports/CustomerBalances"
import ReceivableSummary from "./reports/ReceivableSummary"
import OrderFulfillment from "./reports/OrderFulfillment"

export default function SalesReports() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Sales Reports</h2>
        <p className="text-muted-foreground text-sm">Comprehensive analytics across the sales pipeline</p>
      </div>

      <Tabs defaultValue="by-customer" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="by-customer">By Customer</TabsTrigger>
          <TabsTrigger value="by-item">By Item</TabsTrigger>
          <TabsTrigger value="by-salesperson">By Salesperson</TabsTrigger>
          <TabsTrigger value="aging">Invoice Aging</TabsTrigger>
          <TabsTrigger value="conversion">Estimate Conversion</TabsTrigger>
          <TabsTrigger value="balances">Customer Balances</TabsTrigger>
          <TabsTrigger value="receivable">Receivable Summary</TabsTrigger>
          <TabsTrigger value="fulfillment">Order Fulfillment</TabsTrigger>
        </TabsList>

        <TabsContent value="by-customer"><SalesByCustomer /></TabsContent>
        <TabsContent value="by-item"><SalesByItem /></TabsContent>
        <TabsContent value="by-salesperson"><SalesBySalesperson /></TabsContent>
        <TabsContent value="aging"><InvoiceAging /></TabsContent>
        <TabsContent value="conversion"><EstimateConversion /></TabsContent>
        <TabsContent value="balances"><CustomerBalances /></TabsContent>
        <TabsContent value="receivable"><ReceivableSummary /></TabsContent>
        <TabsContent value="fulfillment"><OrderFulfillment /></TabsContent>
      </Tabs>
    </div>
  )
}
