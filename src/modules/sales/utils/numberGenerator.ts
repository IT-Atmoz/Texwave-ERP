import { getAllRecords } from '@/services/firebase';

const DEFAULT_PREFIXES: Record<string, string> = {
  quotation: 'SQFY',
  salesOrder: 'SOFY',
  invoice: 'INV',
  deliveryChallan: 'DC',
  creditNote: 'CN',
  paymentReceived: 'RCPT',
  retainerInvoice: 'RET',
  recurringInvoice: 'REC',
};

const FIREBASE_PATHS: Record<string, string> = {
  quotation: 'sales/quotations',
  salesOrder: 'sales/orderAcknowledgements',
  invoice: 'sales/invoices',
  deliveryChallan: 'sales/deliveryChallans',
  creditNote: 'sales/creditNotes',
  paymentReceived: 'sales/paymentsReceived',
  retainerInvoice: 'sales/retainerInvoices',
  recurringInvoice: 'sales/recurringInvoiceProfiles',
};

export async function generateDocumentNumber(
  type: keyof typeof DEFAULT_PREFIXES,
  customPrefix?: string
): Promise<string> {
  const prefix = customPrefix || DEFAULT_PREFIXES[type] || type.toUpperCase();
  const year = new Date().getFullYear().toString().slice(-2);
  const path = FIREBASE_PATHS[type];

  if (!path) {
    return `${prefix}-${year}-${String(Date.now()).slice(-5)}`;
  }

  try {
    const existing = await getAllRecords(path);
    const count = existing.length + 1;
    return `${prefix}-${year}-${String(count).padStart(4, '0')}`;
  } catch {
    return `${prefix}-${year}-${String(Date.now()).slice(-5)}`;
  }
}
