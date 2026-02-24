// Document Conversion Utilities - Maps data between document types

export function quotationToSalesOrder(quotation: any) {
  return {
    customerId: quotation.customerId,
    customerCode: quotation.customerCode || '',
    customerName: quotation.customerName,
    shipToAddress: quotation.shippingAddress
      ? `${quotation.shippingAddress.street || ''}, ${quotation.shippingAddress.city || ''}, ${quotation.shippingAddress.state || ''} - ${quotation.shippingAddress.pincode || ''}`
      : '',
    billToAddress: quotation.billingAddress
      ? `${quotation.billingAddress.street || ''}, ${quotation.billingAddress.city || ''}, ${quotation.billingAddress.state || ''} - ${quotation.billingAddress.pincode || ''}`
      : '',
    gstNoBillTo: quotation.customerGST || '',
    gstNoShipTo: quotation.customerGST || '',
    deliveryTerms: quotation.deliveryTerm || '',
    paymentTerms: quotation.paymentTerms || '',
    deliveryMode: quotation.modeOfDispatch || '',
    convertedFromQuotationId: quotation.id,
    convertedFromQuotationNumber: quotation.quoteNumber,
    salespersonId: quotation.salespersonId || '',
    salespersonName: quotation.salespersonName || '',
    lineItems: (quotation.lineItems || []).map((item: any, idx: number) => ({
      sNo: idx + 1,
      itemCode: item.productCode || '',
      itemDescription: item.productDescription || '',
      uom: item.uom || 'Nos',
      salesQty: item.qty || 0,
      rate: item.unitRate || 0,
      amount: item.netAmount || (item.qty || 0) * (item.unitRate || 0),
    })),
    total: quotation.subtotal || 0,
    grandTotal: quotation.grandTotal || 0,
  };
}

export function quotationToInvoice(quotation: any) {
  return {
    customerId: quotation.customerId,
    customerName: quotation.customerName,
    customerGST: quotation.customerGST || '',
    customerPAN: quotation.customerPAN || '',
    billingAddress: quotation.billingAddress
      ? `${quotation.billingAddress.street || ''}, ${quotation.billingAddress.city || ''}, ${quotation.billingAddress.state || ''} - ${quotation.billingAddress.pincode || ''}`
      : '',
    shippingAddress: quotation.shippingAddress
      ? `${quotation.shippingAddress.street || ''}, ${quotation.shippingAddress.city || ''}, ${quotation.shippingAddress.state || ''} - ${quotation.shippingAddress.pincode || ''}`
      : '',
    paymentTerms: quotation.paymentTerms || '',
    convertedFromQuotationId: quotation.id,
    salespersonId: quotation.salespersonId || '',
    salespersonName: quotation.salespersonName || '',
    lineItems: (quotation.lineItems || []).map((item: any, idx: number) => ({
      sNo: idx + 1,
      partCode: item.productCode || '',
      description: item.productDescription || '',
      hsnCode: item.hsnCode || '',
      qty: item.qty || 0,
      uom: item.uom || 'Nos',
      rate: item.unitRate || 0,
      amount: (item.qty || 0) * (item.unitRate || 0),
      discount: item.discount || 0,
      taxableValue: item.netAmount || 0,
      cgstPercent: 0,
      cgstAmount: 0,
      sgstPercent: 0,
      sgstAmount: 0,
      igstPercent: 0,
      igstAmount: 0,
      total: item.netAmount || 0,
    })),
  };
}

export function salesOrderToInvoice(order: any, selectedItems?: any[]) {
  const items = selectedItems || order.lineItems || [];
  return {
    customerId: order.customerId,
    customerName: order.customerName,
    customerGST: order.gstNoBillTo || '',
    billingAddress: order.billToAddress || '',
    shippingAddress: order.shipToAddress || '',
    paymentTerms: order.paymentTerms || '',
    customerPONo: order.customerPONo || '',
    customerPODate: order.customerPODate || '',
    convertedFromSOId: order.id,
    convertedFromSONumber: order.soNumber,
    salespersonId: order.salespersonId || '',
    salespersonName: order.salespersonName || '',
    lineItems: items.map((item: any, idx: number) => ({
      sNo: idx + 1,
      partCode: item.itemCode || '',
      description: item.itemDescription || '',
      hsnCode: item.hsnCode || '',
      qty: item.salesQty || item.qty || 0,
      uom: item.uom || 'Nos',
      rate: item.rate || 0,
      amount: (item.salesQty || item.qty || 0) * (item.rate || 0),
      discount: 0,
      taxableValue: item.amount || 0,
      cgstPercent: 0,
      cgstAmount: 0,
      sgstPercent: 0,
      sgstAmount: 0,
      igstPercent: 0,
      igstAmount: 0,
      total: item.amount || 0,
    })),
  };
}

export function salesOrderToDC(order: any) {
  return {
    customerId: order.customerId,
    customerName: order.customerName,
    customerGST: order.gstNoBillTo || '',
    salesOrderId: order.id,
    salesOrderNumber: order.soNumber,
    salespersonId: order.salespersonId || '',
    salespersonName: order.salespersonName || '',
    lineItems: (order.lineItems || []).map((item: any, idx: number) => ({
      sNo: idx + 1,
      productCode: item.itemCode || '',
      description: item.itemDescription || '',
      hsnCode: item.hsnCode || '',
      qty: item.salesQty || 0,
      uom: item.uom || 'Nos',
    })),
  };
}

export function dcToInvoice(dc: any) {
  return {
    customerId: dc.customerId,
    customerName: dc.customerName,
    customerGST: dc.customerGST || '',
    convertedFromDCId: dc.id,
    salespersonId: dc.salespersonId || '',
    salespersonName: dc.salespersonName || '',
    lineItems: (dc.lineItems || []).map((item: any, idx: number) => ({
      sNo: idx + 1,
      partCode: item.productCode || '',
      description: item.description || '',
      hsnCode: item.hsnCode || '',
      qty: item.qty || 0,
      uom: item.uom || 'Nos',
      rate: item.rate || 0,
      amount: (item.qty || 0) * (item.rate || 0),
      discount: 0,
      taxableValue: (item.qty || 0) * (item.rate || 0),
      cgstPercent: 0,
      cgstAmount: 0,
      sgstPercent: 0,
      sgstAmount: 0,
      igstPercent: 0,
      igstAmount: 0,
      total: (item.qty || 0) * (item.rate || 0),
    })),
  };
}

export function invoiceToCreditNote(invoice: any) {
  return {
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    items: (invoice.lineItems || []).map((item: any, idx: number) => ({
      sNo: idx + 1,
      description: item.description || item.partCode || '',
      qty: item.qty || 0,
      rate: item.rate || 0,
      taxPercent: (item.cgstPercent || 0) + (item.sgstPercent || 0) + (item.igstPercent || 0),
      amount: item.total || item.amount || 0,
    })),
  };
}

export function getSourceDocumentInfo(document: any): { type: string; id: string; number: string; path: string } | null {
  if (document.convertedFromQuotationId) {
    return {
      type: 'Quotation',
      id: document.convertedFromQuotationId,
      number: document.convertedFromQuotationNumber || '',
      path: `/sales/quotations/edit/${document.convertedFromQuotationId}`,
    };
  }
  if (document.convertedFromSOId) {
    return {
      type: 'Sales Order',
      id: document.convertedFromSOId,
      number: document.convertedFromSONumber || '',
      path: `/sales/orders/edit/${document.convertedFromSOId}`,
    };
  }
  if (document.convertedFromDCId) {
    return {
      type: 'Delivery Challan',
      id: document.convertedFromDCId,
      number: '',
      path: `/sales/delivery-challans/edit/${document.convertedFromDCId}`,
    };
  }
  if (document.salesOrderId) {
    return {
      type: 'Sales Order',
      id: document.salesOrderId,
      number: document.salesOrderNumber || '',
      path: `/sales/orders/edit/${document.salesOrderId}`,
    };
  }
  return null;
}
