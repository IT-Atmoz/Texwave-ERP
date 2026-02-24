export type UserRole = 'admin' | 'sales' | 'hr' | 'accountant' | 'manager' | 'quality' | 'production' | 'employee';

export interface User {
  username: string;
  role: UserRole;
  name: string;
  employeeId?: string;
  email?: string;
}

export interface Address {
  id: string;
  type: 'billing' | 'shipping';
  label: string;
  street: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault?: boolean;
}

export interface Customer {
  id: string;
  customerCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  gst?: string;
  pan?: string;
  cin?: string;
  addresses: Address[];
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
  bankDetails?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Product {
  id: string;
  productCode: string;
  name: string;
  description: string;
  sku: string;
  hsn: string;
  uom: string;
  unitPrice: number;
  taxPercent: number;
  stockQty: number;
  grossWeight?: number;
  netWeight?: number;
  packageQty?: number;
  linkedPartCode?: string;
  createdAt: number;
}

export interface Lead {
  id: string;
  customerId: string;
  customerName: string;
  source: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Lost' | 'Converted';
  expectedValue: number;
  expectedCloseDate: string;
  assignedTo: string;
  notes: string;
  createdAt: number;
}

export interface QuotationLineItem {
  sNo: number;
  productCode: string;
  productDescription: string;
  uom: string;
  unitRate: number;
  qty: number;
  requiredDate?: string;
  hsnCode: string;
  amount: number;
  discount: number;
  netAmount: number;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  quoteDate: string;
  versionNo?: string;
  versionDate?: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerGST: string;
  customerPAN: string;
  quoteValidity: string;
  modeOfDispatch: string;
  deliveryTerm: string;
  paymentTerms: string;
  ourRef?: string;
  yourRef?: string;
  lineItems: QuotationLineItem[];
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  taxTotal: number;
  grandTotal: number;
  remarks?: string;
  comments?: string;
  attachments: string[];
  status: 'Draft' | 'Approved' | 'Sent' | 'Accepted' | 'Rejected' | 'Converted';
  convertedToSOId?: string;
  convertedToInvoiceId?: string;
  salespersonId?: string;
  salespersonName?: string;
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  approvalHistory?: ApprovalEntry[];
  customFields?: Record<string, any>;
  createdAt: number;
}

export interface OrderAcknowledgement {
  id: string;
  soNumber: string;
  soDate: string;
  version?: string;
  site?: string;
  quotationId?: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  shipToAddress: string;
  billToAddress: string;
  customerPONo?: string;
  customerPODate?: string;
  gstNoBillTo: string;
  gstNoShipTo: string;
  deliveryTerms: string;
  paymentTerms: string;
  deliveryMode: string;
  lineItems: OrderLineItem[];
  total: number;
  grandTotal: number;
  comments?: string;
  creditTerms?: string;
  preparedBy?: string;
  approvedBy?: string;
  status: 'Draft' | 'Approved' | 'Confirmed' | 'In Production' | 'QC' | 'Ready' | 'Delivered' | 'Cancelled';
  qcStatus?: 'pending' | 'in-progress' | 'completed' | 'hold';
  productionStatus?: 'pending' | 'in-progress' | 'completed';
  invoiceStatus?: 'not_generated' | 'generated' | 'paid';
  convertedFromQuotationId?: string;
  convertedFromQuotationNumber?: string;
  convertedToInvoiceIds?: string[];
  convertedToDCIds?: string[];
  shipmentDate?: string;
  salespersonId?: string;
  salespersonName?: string;
  shippingCharge?: number;
  adjustment?: number;
  invoicedStatus?: 'Not Invoiced' | 'Partially Invoiced' | 'Invoiced';
  shippedStatus?: 'Not Shipped' | 'Partially Shipped' | 'Shipped';
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  approvalHistory?: ApprovalEntry[];
  customFields?: Record<string, any>;
  createdAt: number;
}

export interface OrderLineItem {
  sNo: number;
  itemCode: string;
  itemDescription: string;
  requiredDate?: string;
  uom: string;
  salesQty: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  orderAcknowledgementId: string;
  customerId: string;
  customerName: string;
  customerGST: string;
  customerPAN: string;
  billingAddress: string;
  shippingAddress: string;
  customerPONo?: string;
  customerPODate?: string;
  transportationMode: string;
  vehicleNo?: string;
  dateTimeOfSupply: string;
  placeOfSupply: string;
  transporterName?: string;
  paymentTerms: string;
  eWayBillNo?: string;
  eWayBillDate?: string;
  taxIsReverseCharge: boolean;
  lineItems: InvoiceLineItem[];
  basicAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  totalInWords: string;
  totalTaxInWords: string;
  remarks?: string;
  paymentStatus: 'Draft' | 'Final' | 'Unpaid' | 'Partial' | 'Paid' | 'Sent' | 'Viewed' | 'Overdue' | 'Partially Paid' | 'Void';
  paidAmount: number;
  dueDate: string;
  convertedFromSOId?: string;
  convertedFromSONumber?: string;
  convertedFromDCId?: string;
  convertedFromQuotationId?: string;
  salespersonId?: string;
  salespersonName?: string;
  creditNotesApplied?: CreditNoteApplication[];
  retainerApplied?: RetainerApplication[];
  paymentHistory?: PaymentApplication[];
  voidedAt?: number;
  voidReason?: string;
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  approvalHistory?: ApprovalEntry[];
  customFields?: Record<string, any>;
  createdAt: number;
}

export interface InvoiceLineItem {
  sNo: number;
  partCode: string;
  description: string;
  hsnCode: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
  discount: number;
  taxableValue: number;
  cgstPercent: number;
  cgstAmount: number;
  sgstPercent: number;
  sgstAmount: number;
  igstPercent: number;
  igstAmount: number;
  total: number;
}

export interface DashboardStats {
  totalCustomers: number;
  totalProducts: number;
  totalSalesThisMonth: number;
  pendingQuotations: number;
  totalLeads: number;
  convertedLeads: number;
  totalEmployees: number;
  presentToday: number;
  pendingLeaves: number;
}

export interface SalaryStructure {
  basic: number;
  hra: number;
  da: number;
  conveyance: number;
  medical: number;
  specialAllowance: number;
  additionalSpecialAllowance: number;
  otherAllowance: number;
  grossMonthly: number;
  ctcLPA: number;
}

// Static Department Types
export type DepartmentType = 'Staff' | 'Workers' | 'Others';

export const DEPARTMENTS: DepartmentType[] = ['Staff', 'Workers', 'Others'];

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  phone: string;
  email: string;
  department: string;
  role: string;
  joiningDate: string;
  salary: SalaryStructure;
  status: 'active' | 'inactive' | 'resigned' | 'terminated';

  // Personal Info
  gender?: 'Male' | 'Female' | 'Other';
  dateOfBirth?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  religion?: string;
  nationality?: string;

  // Office
  officeType?: string;
  shift?: string;
  reportingTo?: string;

  // Experience
  experienceYears?: string;
  previousCompany?: string;
  previousRole?: string;

  // Project & Domain
  project?: string;
  workDomain?: string;

  // Family Details
  fatherName?: string;
  fatherPhone?: string;
  motherName?: string;
  motherPhone?: string;
  spouseName?: string;
  spousePhone?: string;
  emergencyContact?: string;
  emergencyContactName?: string;

  // Documents
  profilePhoto?: string;
  resumeUrl?: string;
  aadhaarUrl?: string;
  panUrl?: string;
  bankStatementUrl?: string;
  tenthCertificateUrl?: string;
  twelfthCertificateUrl?: string;
  graduationCertificateUrl?: string;
  postGraduationCertificateUrl?: string;

  // IDs
  aadhaarNumber?: string;
  panNumber?: string;
  esiNumber?: string;
  pfNumber?: string;

  // Bank
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
  bankDetails?: string;

  // Address
  presentAddress?: {
    street: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
  };
  permanentAddress?: {
    street: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    sameAsPresent?: boolean;
  };

  // Bonus
  bonus?: {
    amount: number;
    type: string;
    month: string;
    status: 'Pending' | 'Approved' | 'Paid';
  }[];

  createdAt?: number;
  updatedAt?: number;
}

export interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: 'Present' | 'Absent' | 'Half Day' | 'Leave' | 'Holiday' | 'Week Off';
  checkIn?: string;
  checkOut?: string;
  totalHours?: number;
  overtimeHours?: number;
  lateArrival?: boolean;
  earlyExit?: boolean;
  notes: string;
  createdAt: number;
}

export interface Leave {
  id: string;
  employeeId: string;
  employeeName: string;
  department?: string;
  startDate: string;
  endDate: string;
  totalDays?: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  appliedAt: number;
  processedBy?: string;
  processedAt?: number;
}

export interface Shift {
  id: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  assignedEmployees: string[];
  createdAt: number;
}

export interface ProductionBatch {
  id: string;
  batchId: string;
  partName: string;
  partNo: string;
  machineNo: string;
  dieNo: string;
  productionQty: number;
  productionDate: string;
  operatorName: string;
  qcStatus: 'pending' | 'in-progress' | 'completed';
  createdAt: number;
}

export interface QualityInspection {
  id: string;
  batchId: string;
  partName: string;
  partNo: string;
  machineNo: string;
  dieNo: string;
  productionQty: number;
  productionDate: string;
  operatorName: string;
  inspectorName: string;
  inspectionDate: string;
  okQty: number;
  notOkQty: number;
  rejectionReason: string;
  remarks: string;
  images: string[];
  status: 'pending' | 'in-progress' | 'completed';
  tagStatus: 'Before Inspection' | 'After Inspection';
  salesOrderNo?: string;
  salesOrderDate?: string;
  createdAt: number;
}

export interface QualityTag {
  id: string;
  tagId: string;
  batchId: string;
  inspectionId: string;
  tagStatus: 'Before Inspection' | 'After Inspection';
  timestamp: number;
}

export interface FGStock {
  id: string;
  batchId: string;
  partName: string;
  partNo: string;
  quantity: number;
  qc: 'ok' | 'hold';
  createdAt: number;
}

export interface ScrapStock {
  id: string;
  batchId: string;
  partName: string;
  partNo: string;
  quantity: number;
  reason: string;
  createdAt: number;
}

export interface MasterData {
  sales: SalesMaster;
  hr: HRMaster;
  quality: QualityMaster;
  production: ProductionMaster;
  stores: StoresMaster;
  finance: FinanceMaster;
}

export interface SalesMaster {
  paymentTerms: string[];
  deliveryTerms: string[];
  dispatchModes: string[];
  gstList: string[];
}

export interface HRMaster {
  departments: string[];
  designations: string[];
  leaveTypes: string[];
  shifts: string[];
  holidayList: string[];
  employeeStatus: string[];
}

export interface QualityMaster {
  rejectionReasons: string[];
  inspectionTypes: string[];
  tagStatus: string[];
}

export interface ProductionMaster {
  machines: Record<string, { name: string }>;
  dies: Record<string, { name: string }>;
  compoundCodes: string[];
  rejectionCategories: string[];
  productionStages: string[];
  parts: Record<string, Part>;
}

export interface StoresMaster {
  rawMaterialCategories: string[];
  uomList: string[];
  stockLocations: string[];
  suppliers: Record<string, Supplier>;
}

export interface FinanceMaster {
  expenseTypes: string[];
  paymentModes: string[];
}

export interface Part {
  name: string;
  partNumber: string;
  inputWeight: number;
  cycleTime: number;
  cavity: number;
}

export interface Supplier {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface ProductionJob {
  id: string;
  orderId: string;
  partId: string;
  machineId: string;
  operator: string;
  status: 'not_started' | 'running' | 'completed';
  startTime?: string;
  endTime?: string;
  createdAt: number;
}

export interface RawMaterial {
  id: string;
  compoundCode: string;
  qty: number;
  shelfLife: string;
  batchNumber: string;
  location: string;
  createdAt: number;
}

export interface WIPStock {
  id: string;
  batchId: string;
  partName: string;
  partNo: string;
  quantity: number;
  stage: string;
  createdAt: number;
}

// ============================================================
// NEW: Zoho Books-style modules
// ============================================================

export interface Vendor {
  id: string;
  vendorCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  gst?: string;
  pan?: string;
  addresses: Address[];
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
  bankDetails?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface PurchaseLineItem {
  sNo: number;
  itemName: string;
  description?: string;
  qty: number;
  uom: string;
  rate: number;
  taxPercent: number;
  amount: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  date: string;
  expectedDate?: string;
  items: PurchaseLineItem[];
  subTotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
  status: 'Draft' | 'Sent' | 'Received' | 'Cancelled';
  createdAt: number;
}

export interface Bill {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  poId?: string;
  billDate: string;
  dueDate: string;
  items: PurchaseLineItem[];
  subTotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
  status: 'Open' | 'Partially Paid' | 'Paid' | 'Overdue';
  paymentStatus: 'Unpaid' | 'Partial' | 'Paid';
  paidAmount: number;
  createdAt: number;
}

export interface PaymentMade {
  id: string;
  paymentNumber: string;
  vendorId: string;
  vendorName: string;
  billId?: string;
  amount: number;
  paymentDate: string;
  mode: string;
  reference?: string;
  notes?: string;
  createdAt: number;
}

export interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  openingBalance: number;
  currentBalance: number;
  currency: string;
  createdAt: number;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  type: 'Credit' | 'Debit';
  amount: number;
  description: string;
  reference?: string;
  category?: string;
  createdAt: number;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  paidThrough: string;
  vendor?: string;
  reference?: string;
  notes?: string;
  status: 'Recorded' | 'Reimbursed';
  createdAt: number;
}

export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntry {
  id: string;
  entryId: string;
  date: string;
  reference?: string;
  description: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  createdAt: number;
}

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Income' | 'Expense' | 'Equity';
  parentId?: string;
  balance: number;
  createdAt: number;
}

export interface PaymentReceived {
  id: string;
  paymentNumber: string;
  customerId: string;
  customerName: string;
  invoiceId?: string;
  amount: number;
  paymentDate: string;
  mode: string;
  reference?: string;
  notes?: string;
  invoiceAllocations?: InvoiceAllocation[];
  excessAmount?: number;
  bankCharges?: number;
  refundedAmount?: number;
  refundHistory?: RefundEntry[];
  createdAt: number;
}

// ============================================================
// Sales Module - Zoho Books Enhanced Types
// ============================================================

export interface DeliveryChallan {
  id: string;
  dcNumber: string;
  dcDate: string;
  customerId: string;
  customerName: string;
  customerGST?: string;
  billingAddress?: any;
  shippingAddress?: any;
  challanType: 'Supply' | 'Job Work' | 'Delivery' | 'Others';
  vehicleNo?: string;
  transporterName?: string;
  placeOfSupply?: string;
  salesOrderId?: string;
  salesOrderNumber?: string;
  lineItems: DCLineItem[];
  totalQty: number;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  status: 'Draft' | 'Open' | 'Delivered' | 'Invoiced' | 'Returned';
  convertedToInvoiceId?: string;
  terms?: string;
  remarks?: string;
  salespersonId?: string;
  salespersonName?: string;
  customFields?: Record<string, any>;
  createdAt: number;
  updatedAt?: number;
}

export interface DCLineItem {
  sNo: number;
  productCode: string;
  description: string;
  hsnCode: string;
  qty: number;
  uom: string;
  rate?: number;
  amount?: number;
}

export interface RetainerInvoice {
  id: string;
  retainerNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string;
  amount: number;
  description: string;
  notes?: string;
  terms?: string;
  status: 'Draft' | 'Sent' | 'Paid' | 'Partially Paid' | 'Drawn' | 'Partially Drawn';
  paidAmount: number;
  drawnAmount: number;
  unusedBalance: number;
  appliedToInvoices?: RetainerApplication[];
  paymentHistory?: PaymentApplication[];
  refundHistory?: RefundEntry[];
  salespersonId?: string;
  salespersonName?: string;
  customFields?: Record<string, any>;
  createdAt: number;
  updatedAt?: number;
}

export interface RecurringInvoiceProfile {
  id: string;
  profileName: string;
  customerId: string;
  customerName: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'custom';
  customIntervalDays?: number;
  startDate: string;
  endDate?: string;
  nextInvoiceDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  paymentTerms?: string;
  notes?: string;
  terms?: string;
  status: 'Active' | 'Paused' | 'Stopped' | 'Expired';
  generatedInvoiceIds?: string[];
  salespersonId?: string;
  salespersonName?: string;
  customFields?: Record<string, any>;
  createdAt: number;
  updatedAt?: number;
}

export interface CreditNote {
  id: string;
  cnNumber: string;
  customerId: string;
  customerName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  date: string;
  reason: string;
  notes?: string;
  status: 'Open' | 'Applied' | 'Partially Applied' | 'Void';
  items: CreditNoteItem[];
  subTotal: number;
  taxAmount: number;
  total: number;
  balanceAmount: number;
  appliedToInvoices?: CreditNoteApplication[];
  refunds?: RefundEntry[];
  salespersonId?: string;
  salespersonName?: string;
  customFields?: Record<string, any>;
  createdAt: number;
  updatedAt?: number;
}

export interface CreditNoteItem {
  sNo: number;
  description: string;
  qty: number;
  rate: number;
  taxPercent: number;
  amount: number;
}

export interface ApprovalEntry {
  id: string;
  action: 'Submitted' | 'Approved' | 'Rejected';
  by: string;
  at: number;
  comment?: string;
}

export interface CreditNoteApplication {
  creditNoteId: string;
  creditNoteNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  appliedAt: number;
}

export interface RetainerApplication {
  retainerId: string;
  retainerNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  appliedAt: number;
}

export interface PaymentApplication {
  paymentId: string;
  paymentNumber: string;
  amount: number;
  date: string;
  mode: string;
}

export interface InvoiceAllocation {
  invoiceId: string;
  invoiceNumber: string;
  allocatedAmount: number;
  invoiceTotal: number;
  invoiceBalance: number;
}

export interface RefundEntry {
  id: string;
  amount: number;
  date: string;
  mode: string;
  reference?: string;
  notes?: string;
  createdAt: number;
}

export interface Salesperson {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  commissionPercent?: number;
  status: 'Active' | 'Inactive';
  createdAt: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  documentType: string;
  subject: string;
  body: string;
  createdAt: number;
}

export interface ApprovalWorkflow {
  id: string;
  documentType: string;
  enabled: boolean;
  levels: ApprovalLevel[];
  autoApproveThreshold?: number;
}

export interface ApprovalLevel {
  level: number;
  approverRole: string;
  approverName?: string;
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  fieldType: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox';
  options?: string[];
  appliesTo: string[];
  required: boolean;
  createdAt: number;
}

// Bonus Record
export interface BonusRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  monthlySalary: number;
  bonusType: 'Performance' | 'Festival' | 'Annual' | 'Special';
  bonusAmount: number;
  bonusMonth: string;
  status: 'Pending' | 'Approved' | 'Paid';
  remarks?: string;
  createdAt: number;
  approvedBy?: string;
  approvedAt?: number;
  paidAt?: number;
}
