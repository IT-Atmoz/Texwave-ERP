import { getAllRecords, createRecord, updateRecord } from '@/services/firebase';

function addInterval(date: Date, frequency: string, customDays?: number): Date {
  const result = new Date(date);
  switch (frequency) {
    case 'weekly':
      result.setDate(result.getDate() + 7);
      break;
    case 'monthly':
      result.setMonth(result.getMonth() + 1);
      break;
    case 'quarterly':
      result.setMonth(result.getMonth() + 3);
      break;
    case 'half-yearly':
      result.setMonth(result.getMonth() + 6);
      break;
    case 'yearly':
      result.setFullYear(result.getFullYear() + 1);
      break;
    case 'custom':
      result.setDate(result.getDate() + (customDays || 30));
      break;
    default:
      result.setMonth(result.getMonth() + 1);
  }
  return result;
}

export async function processRecurringInvoices(): Promise<number> {
  let generatedCount = 0;

  try {
    const profiles = await getAllRecords('sales/recurringInvoiceProfiles');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const profile of profiles as any[]) {
      if (profile.status !== 'Active') continue;

      const nextDate = new Date(profile.nextInvoiceDate);
      nextDate.setHours(0, 0, 0, 0);

      if (nextDate > today) continue;

      // Check end date
      if (profile.endDate) {
        const endDate = new Date(profile.endDate);
        if (today > endDate) {
          await updateRecord('sales/recurringInvoiceProfiles', profile.id, {
            status: 'Expired',
          });
          continue;
        }
      }

      // Generate invoice
      const invoiceNumber = `RINV-${new Date().getFullYear().toString().slice(-2)}-${String(Date.now()).slice(-6)}`;
      const invoiceData = {
        invoiceNumber,
        invoiceDate: new Date().toISOString().split('T')[0],
        customerId: profile.customerId,
        customerName: profile.customerName,
        lineItems: profile.lineItems || [],
        basicAmount: profile.subtotal || 0,
        grandTotal: profile.grandTotal || 0,
        totalTax: profile.taxAmount || 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        roundOff: 0,
        paymentTerms: profile.paymentTerms || '',
        paymentStatus: 'Unpaid',
        paidAmount: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        remarks: `Auto-generated from recurring profile: ${profile.profileName}`,
        recurringProfileId: profile.id,
        salespersonId: profile.salespersonId || '',
        salespersonName: profile.salespersonName || '',
      };

      const invoiceId = await createRecord('sales/invoices', invoiceData);

      // Update profile
      const newNextDate = addInterval(nextDate, profile.frequency, profile.customIntervalDays);
      const generatedIds = [...(profile.generatedInvoiceIds || []), invoiceId];

      await updateRecord('sales/recurringInvoiceProfiles', profile.id, {
        nextInvoiceDate: newNextDate.toISOString().split('T')[0],
        generatedInvoiceIds: generatedIds,
      });

      generatedCount++;
    }
  } catch (error) {
    console.error('Recurring invoice processing error:', error);
  }

  return generatedCount;
}
