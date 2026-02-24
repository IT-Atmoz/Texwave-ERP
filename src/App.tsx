// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Context & Routes

import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute, EmployeeProtectedRoute } from "@/components/ProtectedRoute";
import { LoginRoute } from "@/components/LoginRoute";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import StubPage from "./pages/StubPage";
import NotFound from "./pages/NotFound";

// Services
import { getAllRecords } from "@/services/firebase";

// HR Components
import EmployeeTimesheet from "./modules/hr/EmployeeTimesheet";
import Attendance from "./modules/hr/Attendance";

// Contacts Module
import ContactsLayout from "./modules/contacts/ContactsLayout";
import Vendors from "./modules/contacts/Vendors";
import VendorForm from "./modules/contacts/VendorForm";

// Purchases Module
import PurchasesLayout from "./modules/purchases/PurchasesLayout";
import PurchaseOrders from "./modules/purchases/PurchaseOrders";
import CreatePurchaseOrder from "./modules/purchases/CreatePurchaseOrder";
import Bills from "./modules/purchases/Bills";
import CreateBill from "./modules/purchases/CreateBill";
import PaymentsMade from "./modules/purchases/PaymentsMade";

// Expenses Module
import ExpensesLayout from "./modules/expenses/ExpensesLayout";
import Expenses from "./modules/expenses/Expenses";

// Banking Module
import BankingLayout from "./modules/banking/BankingLayout";
import BankAccounts from "./modules/banking/BankAccounts";
import Transactions from "./modules/banking/Transactions";

// Accounting Module
import AccountingLayout from "./modules/accounting/AccountingLayout";
import ChartOfAccounts from "./modules/accounting/ChartOfAccounts";
import JournalEntries from "./modules/accounting/JournalEntries";
import AccountingReports from "./modules/accounting/Reports";

// Sales Module
import SalesLayout from "./modules/sales/SalesLayout";
import SalesDashboard from "./modules/sales/SalesDashboard";
import Customers from "./modules/sales/Customers";
import CustomerForm from "./modules/sales/CustomerForm";
import PaymentsReceived from "./modules/sales/PaymentsReceived";
import CreditNotes from "./modules/sales/CreditNotes";
import Products from "./modules/sales/Products";
import Quotations from "./modules/sales/Quotations";
import CreateQuotation from "./modules/sales/CreateQuotation";
import Orders from "./modules/sales/Orders";
import Invoices from "./modules/sales/Invoices";
import CreateInvoice from "./modules/sales/CreateInvoice";
import Reports from "./modules/sales/Reports";
import SalesSettings from "./modules/sales/SalesSettings";
import CreateSalesOrder from "./modules/sales/CreateSalesOrder";
import DeliveryChallans from "./modules/sales/DeliveryChallans";
import CreateDeliveryChallan from "./modules/sales/CreateDeliveryChallan";
import CreatePaymentReceived from "./modules/sales/CreatePaymentReceived";
import CreateCreditNote from "./modules/sales/CreateCreditNote";
import RetainerInvoices from "./modules/sales/RetainerInvoices";
import CreateRetainerInvoice from "./modules/sales/CreateRetainerInvoice";
import RecurringInvoices from "./modules/sales/RecurringInvoices";
import CreateRecurringProfile from "./modules/sales/CreateRecurringProfile";

// HR Module
import HRLayout from "./modules/hr/HRLayout";
import EmployeesList from "./modules/hr/Employees";
import EmployeeForm from "./modules/hr/EmployeeForm";
import Documents from "./modules/hr/Documents";
import Leaves from "./modules/hr/Leaves";
import Shifts from "./modules/hr/Shifts";
import Payroll from "./modules/hr/Payroll";
import HRReports from "./modules/hr/Reports";
import Loans from "./modules/hr/Loans";
import EmployeeDocumentsView from "./modules/hr/EmployeeDocumentsView";
import Holiday from "./modules/hr/Holiday";
import Holial from "./modules/hr/Holial";
import FullMonthPresent from "./modules/hr/FMP";
import BonusSheet from "./modules/hr/BonusSheet";
import FMA from "./modules/hr/FMA";

// Master Module
import MasterLayout from "./modules/master/MasterLayout";
import SalesMaster from "./modules/master/SalesMaster";
import HRMaster from "./modules/master/HRMaster";
import StoresMaster from "./modules/master/StoresMaster";
import FinanceMaster from "./modules/master/FinanceMaster";
import ProjectsMaster from "./modules/master/ProjectsMaster";

// HR Privilege Manager
import PrivilegeManager from "./modules/hr/PrivilegeManager";
import OrgChart from "./modules/hr/OrgChart";
import WorkLogs from "./modules/hr/WorkLogs";

// Employee Portal
import EmployeePortalLayout from "./modules/employee/EmployeePortalLayout";
import EmployeeDashboard from "./modules/employee/EmployeeDashboard";
import WebCheckin from "./modules/employee/WebCheckin";
import MyTimesheet from "./modules/employee/MyTimesheet";
import MyProfile from "./modules/employee/MyProfile";
import MyDocuments from "./modules/employee/MyDocuments";
import MyAttendance from "./modules/employee/MyAttendance";
import MyLeaves from "./modules/employee/MyLeaves";

// Other
import FMP from "./modules/hr/FMP";
import Bonus from "./modules/hr/Bonus";
import Profile from "./modules/hr/Profile";
import EmployeeProfileView from "./modules/hr/EmployeeProfileView";
import Other from "./modules/hr/Other";
import Empdash from "./modules/hr/Empdash";
import HRDashboard from "./modules/hr/HRDashboard";
import Approved from "./modules/hr/Approved";
import Pf from "./modules/hr/Pf";
import Esi from "./modules/hr/Esi";

// Query Client
const queryClient = new QueryClient();

// =======================================================
// 🔥 FULLY DYNAMIC CHAT WIDGET – WORKS ON ALL TABLES
// =======================================================
type ChatMessage = {
  sender: "user" | "system";
  text: string;
};

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "system",
      text:
        "Hi 👋 Ask me anything like:\n" +
        "• how many employees\n" +
        "• [name] dob\n" +
        "• [name] salary\n" +
        "• [name] attendance\n" +
        "• list customers\n" +
        "• total invoices\n" +
        "• show products",
    },
  ]);

  // Load employees once (for name matching)
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const data = await getAllRecords("hr/employees");
        setEmployees(data);
      } catch (err) {
        console.error("Failed to load employees for chat:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadEmployees();
  }, []);

  // Table mapping – covers ALL tables in your JSON
  const tableMap = useMemo(
    () => [
      { keywords: ["employee", "employees"], path: "hr/employees", display: "employees" },
      { keywords: ["attendance"], path: "hr/attendance", display: "attendance records" },
      { keywords: ["approval", "approvals"], path: "hr/attendanceApprovals", display: "attendance approvals" },
      { keywords: ["customer", "customers"], path: "sales/customers", display: "customers" },
      { keywords: ["invoice", "invoices"], path: "sales/invoices", display: "invoices" },
      { keywords: ["quotation", "quotations"], path: "sales/quotations", display: "quotations" },
      { keywords: ["order", "orders", "oa"], path: "sales/orderAcknowledgements", display: "order acknowledgements" },
      { keywords: ["product", "products", "stock"], path: "sales/products", display: "products" },
    ],
    []
  );

  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input.trim();
    const lowerText = userText.toLowerCase();

    setMessages((m) => [...m, { sender: "user", text: userText }]);
    setInput("");

    // 1. Count / Total queries
    if (lowerText.includes("how many") || lowerText.includes("total") || lowerText.includes("count")) {
      const matched = tableMap.find((t) => t.keywords.some((k) => lowerText.includes(k)));
      if (matched) {
        try {
          const records = await getAllRecords(matched.path);
          setMessages((m) => [
            ...m,
            { sender: "system", text: `Total ${matched.display}: ${records.length}` },
          ]);
        } catch (err) {
          setMessages((m) => [...m, { sender: "system", text: "Error fetching data." }]);
        }
        return;
      }
    }

    // 2. List / Show queries
    if (lowerText.includes("list") || lowerText.includes("show")) {
      const matched = tableMap.find((t) => t.keywords.some((k) => lowerText.includes(k)));
      if (matched) {
        try {
          const records = await getAllRecords(matched.path);
          if (!records.length) {
            setMessages((m) => [...m, { sender: "system", text: `No ${matched.display} found.` }]);
            return;
          }

          let reply = `**${matched.display.charAt(0).toUpperCase() + matched.display.slice(1)}**\nTotal: ${records.length}\n\n`;

          records.slice(0, 10).forEach((r: any, i: number) => {
            reply += `${i + 1}. `;
            reply +=
              r.companyName ||
              r.name ||
              r.productName ||
              r.invoiceNumber ||
              r.soNumber ||
              r.id ||
              "Record";
            reply += "\n";
          });

          if (records.length > 10) reply += "\n...and more";

          setMessages((m) => [...m, { sender: "system", text: reply }]);
        } catch (err) {
          setMessages((m) => [...m, { sender: "system", text: "Error fetching data." }]);
        }
        return;
      }
    }

    // 3. Employee-specific queries (fully dynamic)
    const employee = employees.find((emp) => lowerText.includes(emp.name.toLowerCase()));
    if (employee) {
      const name = employee.name;
      let reply = `**${name}**\n`;

      // DOB
      if (lowerText.includes("dob") || lowerText.includes("birth") || lowerText.includes("date of birth")) {
        reply += `Date of Birth: ${employee.dob || "Not available"}`;
      }
      // Salary
      else if (lowerText.includes("salary") || lowerText.includes("gross") || lowerText.includes("pay") || lowerText.includes("ctc")) {
        const sal = employee.salary || {};
        reply += `Monthly Salary: ₹${sal.monthlySalary || sal.grossMonthly || "N/A"}\n`;
        reply += `Gross Monthly: ₹${sal.grossMonthly || "N/A"}\n`;
        reply += `Basic: ₹${sal.basic || "N/A"}`;
      }
      // Joining Date
      else if (lowerText.includes("joining") || lowerText.includes("joined")) {
        reply += `Joining Date: ${employee.joiningDate || "Not available"}`;
      }
      // Department
      else if (lowerText.includes("department")) {
        reply += `Department: ${employee.department || "Not available"}`;
      }
      // Phone
      else if (lowerText.includes("phone") || lowerText.includes("mobile")) {
        reply += `Phone: ${employee.phone || "Not available"}`;
      }
      // Default: basic info
      else {
        reply += `Employee ID: ${employee.employeeId || "N/A"}\n`;
        reply += `Department: ${employee.department || "N/A"}\n`;
        reply += `Joining Date: ${employee.joiningDate || "N/A"}\n`;
        reply += `Monthly Salary: ₹${employee.salary?.monthlySalary || "N/A"}\n`;
        reply += `DOB: ${employee.dob || "N/A"}`;
      }

      setMessages((m) => [...m, { sender: "system", text: reply }]);
      return;
    }

    // 4. Attendance query for any employee
    if (lowerText.includes("attendance")) {
      const employee = employees.find((emp) => lowerText.includes(emp.name.toLowerCase()));
      if (employee) {
        try {
          const records = await getAllRecords("hr/attendance");
          const flatRecords = Object.values(records).flat();
          const empRecords = flatRecords.filter((r: any) => r.employeeId === employee.id);

          if (!empRecords.length) {
            setMessages((m) => [...m, { sender: "system", text: `No attendance records for ${employee.name}.` }]);
            return;
          }

          let reply = `**${employee.name} Attendance**\n\n`;
          empRecords.slice(0, 15).forEach((r: any) => {
            reply += `${r.date} – ${r.status} (${r.totalHours || 0} hrs)\n`;
          });
          if (empRecords.length > 15) reply += "\n...and more";

          setMessages((m) => [...m, { sender: "system", text: reply }]);
        } catch (err) {
          setMessages((m) => [...m, { sender: "system", text: "Error fetching attendance." }]);
        }
        return;
      }
    }

    // 5. Fallback
    setMessages((m) => [
      ...m,
      {
        sender: "system",
        text:
          "Sorry, I didn’t understand that.\n\n" +
          "Try asking things like:\n" +
          "• how many employees\n" +
          "• arun dob\n" +
          "• lokesh salary\n" +
          "• list customers\n" +
          "• total invoices\n" +
          "• nkr attendance",
      },
    ]);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button onClick={() => setOpen(!open)} className="rounded-full w-14 h-14 shadow-lg">
          💬
        </Button>
      </div>

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-20 right-6 w-96 z-50">
          <Card className="shadow-2xl">
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle>Company Chat</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                ✕
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="h-80 overflow-y-auto border rounded p-3 text-sm space-y-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg max-w-[90%] whitespace-pre-wrap ${
                      m.sender === "user"
                        ? "ml-auto bg-blue-100 text-blue-900"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask me anything..."
                  className="flex-1"
                />
                <Button onClick={handleSend}>Send</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

// =====================
// APP ROOT – UNCHANGED
// =====================
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />

              <Route
                path="/login"
                element={
                  <LoginRoute>
                    <Login />
                  </LoginRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              {/* CONTACTS MODULE */}
              <Route
                path="/contacts"
                element={
                  <ProtectedRoute module="contacts">
                    <ContactsLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="customers" replace />} />
                <Route path="customers">
                  <Route index element={<Customers />} />
                  <Route path="new" element={<CustomerForm />} />
                  <Route path="edit/:id" element={<CustomerForm />} />
                </Route>
                <Route path="vendors">
                  <Route index element={<Vendors />} />
                  <Route path="new" element={<VendorForm />} />
                  <Route path="edit/:id" element={<VendorForm />} />
                </Route>
              </Route>

              {/* PURCHASES MODULE */}
              <Route
                path="/purchases"
                element={
                  <ProtectedRoute module="purchases">
                    <PurchasesLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="orders" replace />} />
                <Route path="orders" element={<PurchaseOrders />} />
                <Route path="orders/create" element={<CreatePurchaseOrder />} />
                <Route path="orders/edit/:id" element={<CreatePurchaseOrder />} />
                <Route path="bills" element={<Bills />} />
                <Route path="bills/create" element={<CreateBill />} />
                <Route path="bills/edit/:id" element={<CreateBill />} />
                <Route path="payments-made" element={<PaymentsMade />} />
              </Route>

              {/* EXPENSES MODULE */}
              <Route
                path="/expenses"
                element={
                  <ProtectedRoute module="expenses">
                    <ExpensesLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Expenses />} />
              </Route>

              {/* BANKING MODULE */}
              <Route
                path="/banking"
                element={
                  <ProtectedRoute module="banking">
                    <BankingLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="accounts" replace />} />
                <Route path="accounts" element={<BankAccounts />} />
                <Route path="transactions" element={<Transactions />} />
              </Route>

              {/* ACCOUNTING MODULE */}
              <Route
                path="/accounting"
                element={
                  <ProtectedRoute module="accounting">
                    <AccountingLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="chart-of-accounts" replace />} />
                <Route path="chart-of-accounts" element={<ChartOfAccounts />} />
                <Route path="journal-entries" element={<JournalEntries />} />
                <Route path="reports" element={<AccountingReports />} />
              </Route>

              {/* SALES MODULE */}
              <Route
                path="/sales"
                element={
                  <ProtectedRoute module="sales">
                    <SalesLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<SalesDashboard />} />
                <Route path="customers">
                  <Route index element={<Customers />} />
                  <Route path="new" element={<CustomerForm />} />
                  <Route path="edit/:id" element={<CustomerForm />} />
                </Route>
                <Route path="products" element={<Products />} />
                <Route path="quotations">
                  <Route index element={<Quotations />} />
                  <Route path="create" element={<CreateQuotation />} />
                  <Route path="edit/:id" element={<CreateQuotation />} />
                </Route>
                <Route path="orders">
                  <Route index element={<Orders />} />
                  <Route path="create" element={<CreateSalesOrder />} />
                  <Route path="create/:quotationId" element={<CreateSalesOrder />} />
                  <Route path="edit/:id" element={<CreateSalesOrder />} />
                </Route>
                <Route path="delivery-challans">
                  <Route index element={<DeliveryChallans />} />
                  <Route path="create" element={<CreateDeliveryChallan />} />
                  <Route path="create/:orderId" element={<CreateDeliveryChallan />} />
                  <Route path="edit/:id" element={<CreateDeliveryChallan />} />
                </Route>
                <Route path="invoices">
                  <Route index element={<Invoices />} />
                  <Route path="create" element={<CreateInvoice />} />
                  <Route path="edit/:id" element={<CreateInvoice />} />
                </Route>
                <Route path="payments-received">
                  <Route index element={<PaymentsReceived />} />
                  <Route path="create" element={<CreatePaymentReceived />} />
                  <Route path="edit/:id" element={<CreatePaymentReceived />} />
                </Route>
                <Route path="credit-notes">
                  <Route index element={<CreditNotes />} />
                  <Route path="create" element={<CreateCreditNote />} />
                  <Route path="edit/:id" element={<CreateCreditNote />} />
                </Route>
                <Route path="retainer-invoices">
                  <Route index element={<RetainerInvoices />} />
                  <Route path="create" element={<CreateRetainerInvoice />} />
                  <Route path="edit/:id" element={<CreateRetainerInvoice />} />
                </Route>
                <Route path="recurring-invoices">
                  <Route index element={<RecurringInvoices />} />
                  <Route path="create" element={<CreateRecurringProfile />} />
                  <Route path="edit/:id" element={<CreateRecurringProfile />} />
                </Route>
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<SalesSettings />} />
              </Route>

              {/* HR MODULE */}
              <Route
                path="/hr"
                element={
                  <ProtectedRoute module="hr">
                    <HRLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="dashboard" element={<HRDashboard />} />
                <Route index element={<Navigate to="employees" replace />} />
                <Route path="employees">
                  <Route index element={<EmployeesList />} />
                  <Route path="new" element={<EmployeeForm />} />
                  <Route path="edit/:id" element={<EmployeeForm />} />
                </Route>
                <Route path="attendance" element={<Attendance />} />
                        <Route path="pf" element={<Pf />} />
                                <Route path="esi" element={<Esi />} />
                <Route path="holidays" element={<Holiday />} />
                <Route path="holial" element={<Holial />} />
                <Route path="profile" element={<Profile />} />
                <Route path="employees/profile/:id" element={<EmployeeProfileView />} />
                <Route path="approval-attendance" element={<Approved />} />
                <Route path="full-month-present" element={<FullMonthPresent />} />
                <Route path="full-month-absent" element={<FMA />} />
                <Route path="bonus" element={<Bonus />} />
                <Route path="bonus-sheet/:employeeId/:month" element={<BonusSheet />} />
                <Route path="leaves" element={<Leaves />} />
                <Route path="shifts" element={<Shifts />} />
                <Route path="documents">
                  <Route index element={<Documents />} />
                  <Route path=":id" element={<EmployeeDocumentsView />} />
                </Route>
                <Route path="other-documents" element={<Other />} />
                <Route path="payroll" element={<Payroll />} />
                <Route path="loans" element={<Loans />} />
                <Route path="reports" element={<HRReports />} />
                <Route path="privileges" element={<PrivilegeManager />} />
                <Route path="org-chart" element={<OrgChart />} />
                <Route path="time-logs" element={<WorkLogs />} />
              </Route>

              <Route
                path="/hr/attendance/:employeeId/:month?"
                element={
                  <ProtectedRoute module="hr">
                    <EmployeeTimesheet />
                  </ProtectedRoute>
                }
              />

              {/* MASTER MODULE */}
              <Route
                path="/master"
                element={
                  <ProtectedRoute module="master">
                    <MasterLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="sales" replace />} />
                <Route path="sales" element={<SalesMaster />} />
                <Route path="hr" element={<HRMaster />} />
                <Route path="stores" element={<StoresMaster />} />
                <Route path="finance" element={<FinanceMaster />} />
                <Route path="projects" element={<ProjectsMaster />} />
              </Route>

              {/* EMPLOYEE PORTAL */}
              <Route
                path="/employee"
                element={
                  <EmployeeProtectedRoute>
                    <EmployeePortalLayout />
                  </EmployeeProtectedRoute>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<EmployeeDashboard />} />
                <Route path="checkin" element={<WebCheckin />} />
                <Route path="attendance" element={<MyAttendance />} />
                <Route path="leaves" element={<MyLeaves />} />
                <Route path="timesheet" element={<MyTimesheet />} />
                <Route path="profile" element={<MyProfile />} />
                <Route path="documents" element={<MyDocuments />} />
              </Route>

              {/* Stub Routes */}
              <Route
                path="/projects"
                element={
                  <ProtectedRoute module="projects">
                    <StubPage title="Projects Module" description="Coming soon..." />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute module="settings">
                    <StubPage title="Settings" description="System configuration" />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>

            {/* Global Chat Widget */}
            {/* <ChatWidget /> */}
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
