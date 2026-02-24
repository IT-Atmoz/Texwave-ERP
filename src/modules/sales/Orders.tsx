'use client';

import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import fas from './fas.png';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  Lock,
  PlayCircle,
  PauseCircle,
  Wrench,
  User,
  ClipboardCheck,
  AlertCircle,
  Download,
  X,
  Search,
  Eye,
  Save,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import { getAllRecords, createRecord, updateRecord, deleteRecord } from '@/services/firebase';
import { useNavigate } from 'react-router-dom';

// ────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────

type SalesOrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'In Production'
  | 'QC Pending'
  | 'QC Completed'
  | 'Ready for Dispatch'
  | 'Delivered'
  | 'Invoice Generated'
  | 'Closed';

type ProductionJobStatus = 'notstarted' | 'running' | 'paused' | 'completed';
type QCStatus = 'pending' | 'in-progress' | 'completed';

interface ProductItem {
  category: string;
  group: string;
  hsn: string;
  productCode: string;
  size: {
    height: number;
    heightUnit: string;
    length: number;
    lengthUnit: string;
    weight: number;
    weightUnit: string;
    width: number;
    widthUnit: string;
  };
  stockQty: number;
  type: string;
  unit: string;
  unitPrice: number;
}

interface Product {
  id: string;
  createdAt: number;
  items: ProductItem[];
}

interface Quotation {
  id: string;
  quoteNumber?: string;
  customerId?: string;
  customerName?: string;
  customerGST?: string;
  customerPAN?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentTerms?: string;
  deliveryTerm?: string;
  dispatchMode?: string;
  modeOfDispatch?: string;
  lineItems?: any[];
  grandTotal?: number;
  subtotal?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  cgstPercent?: number;
  sgstPercent?: number;
  transportCharge?: number;
  transportChargePercent?: number;
  status?: string;
  quoteDate?: string;
  currency?: string;
}

interface SalesOrder {
  id: string;
  soNumber: string;
  quotationId: string;
  quotationNumber?: string;
  customerId: string;
  customerName: string;
  customerGST?: string;
  customerPAN?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  soDate: string;
  soTimestamp: number;
  deliveryDate?: string;
  paymentTerms?: string;
  dispatchMode?: string;
  instructions?: string;
  items: any[];
  okQty: number;
  notOkQty: number;
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  cgstPercent: number;
  sgstPercent: number;
  transportCharge: number;
  transportChargePercent: number;
  grandTotal: number;
  currency?: string;
  status: SalesOrderStatus;
  productionStatus: 'pending' | 'inprogress' | 'completed';
  qcStatus: 'pending' | 'inprogress' | 'completed';
  invoiceStatus: 'notgenerated' | 'partial' | 'generated';
  deliveryStatus: 'notdispatched' | 'intransit' | 'delivered';
  createdAt: number;
  updatedAt?: number;
  confirmedAt?: number;
}

interface ProductionJob {
  id: string;
  orderId: string;
  soNumber: string;
  productId: string;
  productName: string;
  qty: number;
  status: ProductionJobStatus;
  operatorName?: string;
  machineId?: string;
  createdAt?: number;
  startTime?: string;
}

interface Inspection {
  id: string;
  orderId: string;
  jobId: string;
  productId?: string;
  productName?: string;
  qcStatus?: QCStatus;
  okQty?: number;
  notOkQty?: number;
  inspectorName?: string;
  rejectionReason?: string;
  remarks?: string;
  inspectionDate?: string;
}

interface ManualOrderItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  productDescription: string;
  category: string;
  group: string;
  type: string;
  hsnCode: string;
  qty: number;
  unit: string;
  unitRate: number;
  taxPercentage: number;
  amount: number;
  taxAmount: number;
  netAmount: number;
  size?: {
    length: number;
    lengthUnit: string;
    width: number;
    widthUnit: string;
    height: number;
    heightUnit: string;
    weight: number;
    weightUnit: string;
  };
  stockQty?: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
};

const DEFAULT_STATUS: SalesOrderStatus = 'Pending';
const ITEMS_PER_PAGE = 12;
const fmt = (num: number) => Number(num || 0).toFixed(2);

const numberToWords = (num: number, currency: string): string => {
  if (currency !== "INR") return "";

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  const convertTwoDigit = (n: number): string => {
    if (n < 10) return units[n];
    if (n >= 10 && n < 20) return teens[n - 10];
    return tens[Math.floor(n / 10)] + (n % 10 > 0 ? " " + units[n % 10] : "");
  };

  if (integerPart === 0 && decimalPart === 0) return "Zero Rupees Only";

  let word = "";

  // Crore (10,000,000)
  let part = Math.floor(integerPart / 10000000);
  if (part > 0) {
    word += convertTwoDigit(part) + " Crore ";
  }

  // Lakh (100,000)
  part = Math.floor(integerPart / 100000) % 100;
  if (part > 0) {
    word += convertTwoDigit(part) + " Lakh ";
  }

  // Thousand (1,000)
  part = Math.floor(integerPart / 1000) % 100;
  if (part > 0) {
    word += convertTwoDigit(part) + " Thousand ";
  }

  // Hundred (100)
  part = Math.floor(integerPart / 100) % 10;
  if (part > 0) {
    word += units[part] + " Hundred ";
  }

  // Remaining two digits
  part = integerPart % 100;
  if (part > 0) {
    word += convertTwoDigit(part) + " ";
  }

  let result = word.trim() + " Rupees";

  if (decimalPart > 0) {
    result += " and " + convertTwoDigit(decimalPart) + " Paise";
  }

  return result + " Only";
};

// ────────────────────────────────────────────────
// PRINT TEMPLATES
// ────────────────────────────────────────────────

const OrderAcknowledgementPrintTemplate = ({ order }: { order: SalesOrder }) => {
  const currencySymbol = CURRENCY_SYMBOLS[order.currency || 'INR'];
  const symbol = currencySymbol || '₹';

  const safeFormatDate = (value?: any, fallback = 'NA') => {
    const d = value ? new Date(value) : null;
    return d && !isNaN(d.getTime()) ? format(d, 'dd/MM/yyyy') : fallback;
  };

  const lineItems = order.items || [];
  const pages: any[][] = [];
  for (let i = 0; i < lineItems.length; i += ITEMS_PER_PAGE) {
    pages.push(lineItems.slice(i, i + ITEMS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  const totalPages = pages.length;

  const CompanyHeader = () => (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '3px solid #000',
          background: '#ffffff',
          gap: '12px',
        }}
      >
        <img src={fas} alt="FAS Logo" style={{ width: '75px', height: 'auto', flexShrink: 0 }} crossOrigin="anonymous" />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <h1 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: '#000', lineHeight: 1.2 }}>
            Fluoro Automation Seals Pvt Ltd
          </h1>
          <p style={{ fontSize: '9.5px', margin: '3px 0 0 0', color: '#000', lineHeight: 1.3, fontWeight: '600' }}>
            3/180, Rajiv Gandhi Road, Mettukuppam, Chennai Tamil Nadu 600097 India<br />
            Phone: +91-841175097 | Email: fas@fluoroautomationseals.com
          </p>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 16px',
          background: '#e5e7eb',
          borderBottom: '3px solid #000',
          fontSize: '9.5px',
          fontWeight: '800',
          gap: '45px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontWeight: '900' }}>GSTIN:</span>
          <span>33AAECF2716M1ZO</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontWeight: '900' }}>PAN:</span>
          <span>AAECF2716M</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontWeight: '900' }}>CIN:</span>
          <span>U25209TN2020PTC138498</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .page-break { page-break-after: always; break-after: page; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .order-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .order-table td, .order-table th {
          border: 1.5px solid #000;
          padding: 5px 6px;
          vertical-align: middle;
          font-size: 9px;
          line-height: 1.3;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .order-table th {
          background: #e5e7eb;
          font-weight: 900;
          padding: 6px 7px;
          text-align: center;
          line-height: 1.2;
        }
        .order-table tbody tr { min-height: 30px; }
        .order-table .description-cell {
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: normal;
          max-width: 0;
        }
      `}</style>

      {pages.map((pageItems, pageIndex) => (
        <div
          key={pageIndex}
          className={pageIndex < totalPages - 1 ? 'page-break' : ''}
          style={{
            width: '297mm',
            height: '210mm',
            background: '#ffffff',
            margin: 0,
            padding: 0,
            fontFamily: 'Arial, sans-serif',
            color: '#000',
            position: 'relative',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              border: '3px solid #000',
              height: '210mm',
              width: '297mm',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <CompanyHeader />
            </div>

            <div style={{ flex: 1, padding: '10px 16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {pageIndex === 0 && (
                <>
                  <h2 style={{ textAlign: 'center', fontSize: '17px', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '1.5px' }}>
                    ORDER ACKNOWLEDGEMENT
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '8.5px', marginBottom: '10px', flexShrink: 0 }}>
                    <div>
                      <p style={{ fontWeight: '900', fontSize: '10px', textDecoration: 'underline', margin: '0 0 3px 0' }}>Customer:</p>
                      <p style={{ fontWeight: '900', fontSize: '10px', margin: '0 0 4px 0' }}>{order.customerName || '—'}</p>
                      <div style={{ fontSize: '7.5px', fontWeight: '700' }}>
                        <p style={{ margin: '1.5px 0' }}><strong>GSTIN:</strong> {order.customerGST || '—'}</p>
                        <p style={{ margin: '1.5px 0' }}><strong>PAN:</strong> {order.customerPAN || '—'}</p>
                      </div>
                    </div>
                    <div>
                      {order.deliveryDate && (
                        <p style={{ margin: '1.5px 0', fontWeight: '700' }}>
                          <strong>Delivery Date:</strong> {safeFormatDate(order.deliveryDate)}
                        </p>
                      )}
                      {order.paymentTerms && (
                        <p style={{ margin: '1.5px 0', fontWeight: '700' }}>
                          <strong>Payment Terms:</strong> {order.paymentTerms}
                        </p>
                      )}
                      {order.dispatchMode && (
                        <p style={{ margin: '1.5px 0', fontWeight: '700' }}>
                          <strong>Dispatch Mode:</strong> {order.dispatchMode}
                        </p>
                      )}
                    </div>
                    <div>
                      <table style={{ width: '100%', fontSize: '8.5px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ paddingRight: '10px', fontWeight: '700', padding: '2px 0', verticalAlign: 'top' }}>SO No.:</td>
                            <td style={{ fontWeight: '900', fontSize: '12px', padding: '2px 0' }}>{order.soNumber}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>SO Date:</td>
                            <td style={{ padding: '2px 0', fontWeight: '800' }}>{safeFormatDate(order.soDate || order.createdAt)}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Currency:</td>
                            <td style={{ fontWeight: '900', padding: '2px 0' }}>{order.currency || 'INR'} {symbol}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Quotation:</td>
                            <td style={{ padding: '2px 0', fontWeight: '800' }}>{order.quotationNumber || '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Status:</td>
                            <td style={{ padding: '2px 0', fontWeight: '900', color: '#1d4ed8' }}>{order.status}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {pageIndex > 0 && (
                <div style={{ marginBottom: '10px', paddingTop: '8px', flexShrink: 0 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '900', textAlign: 'center', marginBottom: '5px' }}>
                    ORDER ACKNOWLEDGEMENT - {order.soNumber} (Continued)
                  </h3>
                  <p style={{ fontSize: '9px', textAlign: 'center', color: '#666', marginBottom: '8px' }}>
                    Page {pageIndex + 1} of {totalPages}
                  </p>
                </div>
              )}

              <div style={{ flex: 1, marginBottom: '10px', minHeight: 0, overflow: 'hidden' }}>
                <table className="order-table">
                  <colgroup>
                    <col style={{ width: '3%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '27%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '11%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Sr.</th>
                      <th>SKU / Code</th>
                      <th>Description</th>
                      <th>HSN</th>
                      <th>UOM</th>
                      <th>Qty</th>
                      <th>Rate<br />({symbol})</th>
                      <th>Amount<br />({symbol})</th>
                      <th>Tax<br />%</th>
                      <th>Net<br />({symbol})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((item: any, i: number) => {
                      const globalIndex = pageIndex * ITEMS_PER_PAGE + i;
                      return (
                        <tr key={i}>
                          <td style={{ textAlign: 'center', fontWeight: '800' }}>{globalIndex + 1}</td>
                          <td style={{ fontWeight: '800', fontSize: '8px', wordWrap: 'break-word' }}>{item.productCode || '—'}</td>
                          <td className="description-cell" style={{ textAlign: 'left', fontWeight: '700', fontSize: '8px', wordWrap: 'break-word', whiteSpace: 'normal' }}>
                            {item.productDescription || item.productName || '—'}
                            {item.size && (
                              <div style={{ fontSize: '6.5px', color: '#4b5563', marginTop: '2px' }}>
                                L:{item.size.length}{item.size.lengthUnit} × W:{item.size.width}{item.size.widthUnit} × H:{item.size.height}{item.size.heightUnit} × Wt:{item.size.weight}{item.size.weightUnit}
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: '700', textAlign: 'center', fontSize: '8px' }}>{item.hsnCode || '—'}</td>
                          <td style={{ textAlign: 'center', fontWeight: '700' }}>{item.unit || 'Nos'}</td>
                          <td style={{ textAlign: 'right', fontWeight: '800' }}>{Number(item.qty || item.quantity || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700' }}>{fmt(item.unitRate || item.rate || 0)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '800' }}>{fmt(item.amount || 0)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700' }}>{Number(item.taxPercentage || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '900', background: '#f9fafb' }}>{fmt(item.netAmount || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pageIndex === totalPages - 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', flexShrink: 0 }}>
                  <div style={{ fontSize: '8.5px' }}>
                    {order.instructions && (
                      <div style={{ borderTop: '2px solid #000', paddingTop: '5px', marginBottom: '10px' }}>
                        <p style={{ lineHeight: 1.4, margin: 0, fontWeight: '700' }}>
                          <strong style={{ fontWeight: '900' }}>Instructions:</strong> {order.instructions}
                        </p>
                      </div>
                    )}
                    <div style={{ marginTop: '16px' }}>
                      <p style={{ fontWeight: '900', fontSize: '10px', marginBottom: '20px' }}>For Fluoro Automation Seals Pvt Ltd</p>
                      <div style={{ borderTop: '2px solid #000', width: '150px', paddingTop: '5px' }}>
                        <p style={{ fontWeight: '900', fontSize: '8.5px' }}>Authorised Signatory</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <table style={{ marginLeft: 'auto', borderTop: '2px solid #000', fontSize: '10px', width: '100%' }}>
                      <tbody>
                        <tr>
                          <td style={{ paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px', textAlign: 'right', fontWeight: '800' }}>Subtotal</td>
                          <td style={{ fontWeight: '900', paddingLeft: '14px', width: '95px', textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                            {symbol}{fmt(order.subtotal || 0)}
                          </td>
                        </tr>
                        {order.currency === 'INR' && order.cgstAmount > 0 && (
                          <tr>
                            <td style={{ paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px', textAlign: 'right', fontWeight: '800' }}>
                              CGST @ {order.cgstPercent}%
                            </td>
                            <td style={{ fontWeight: '900', paddingLeft: '14px', textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                              {symbol}{fmt(order.cgstAmount)}
                            </td>
                          </tr>
                        )}
                        {order.currency === 'INR' && order.sgstAmount > 0 && (
                          <tr>
                            <td style={{ paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px', textAlign: 'right', fontWeight: '800' }}>
                              SGST @ {order.sgstPercent}%
                            </td>
                            <td style={{ fontWeight: '900', paddingLeft: '14px', textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                              {symbol}{fmt(order.sgstAmount)}
                            </td>
                          </tr>
                        )}
                        {order.transportCharge > 0 && (
                          <tr>
                            <td style={{ paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px', textAlign: 'right', fontWeight: '800' }}>
                              Transport Charge @ {order.transportChargePercent}%
                            </td>
                            <td style={{ fontWeight: '900', paddingLeft: '14px', textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                              {symbol}{fmt(order.transportCharge)}
                            </td>
                          </tr>
                        )}
                        <tr style={{ borderTop: '2px solid #000' }}>
                          <td style={{ paddingRight: '14px', paddingTop: '6px', paddingBottom: '6px', fontSize: '11px', fontWeight: '900', textAlign: 'right' }}>
                            Total Amount ({order.currency || 'INR'})
                          </td>
                          <td style={{ fontSize: '13px', fontWeight: '900', paddingLeft: '14px', textAlign: 'right', paddingTop: '6px', paddingBottom: '6px' }}>
                            {symbol}{fmt(order.grandTotal || 0)}
                          </td>
                        </tr>
                        {order.currency === 'INR' && (
                          <tr>
                            <td colSpan={2} style={{ paddingTop: '6px', paddingBottom: '4px', fontSize: '9px', fontWeight: '700', textAlign: 'right' }}>
                              Amount in Words: {numberToWords(order.grandTotal || 0, order.currency || 'INR')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

const ProformaInvoicePrintTemplate = ({ order }: { order: SalesOrder }) => {
  const currencySymbol = CURRENCY_SYMBOLS[order.currency || 'INR'];
  const symbol = currencySymbol || '₹';

  const safeFormatDate = (value?: any, fallback = 'NA') => {
    const d = value ? new Date(value) : null;
    return d && !isNaN(d.getTime()) ? format(d, 'dd/MM/yyyy') : fallback;
  };

  const lineItems = order.items || [];
  const pages: any[][] = [];
  for (let i = 0; i < lineItems.length; i += ITEMS_PER_PAGE) {
    pages.push(lineItems.slice(i, i + ITEMS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  const totalPages = pages.length;

  const CompanyHeader = () => (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '3px solid #000',
          background: '#ffffff',
          gap: '12px',
        }}
      >
        <img src={fas} alt="FAS Logo" style={{ width: '75px', height: 'auto', flexShrink: 0 }} crossOrigin="anonymous" />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <h1 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: '#000', lineHeight: 1.2 }}>
            Fluoro Automation Seals Pvt Ltd
          </h1>
          <p style={{ fontSize: '9.5px', margin: '3px 0 0 0', color: '#000', lineHeight: 1.3, fontWeight: '600' }}>
            3/180, Rajiv Gandhi Road, Mettukuppam, Chennai Tamil Nadu 600097 India<br />
            Phone: +91-841175097 | Email: fas@fluoroautomationseals.com
          </p>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 16px',
          background: '#e5e7eb',
          borderBottom: '3px solid #000',
          fontSize: '9.5px',
          fontWeight: '800',
          gap: '45px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontWeight: '900' }}>GSTIN:</span>
          <span>33AAECF2716M1ZO</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontWeight: '900' }}>PAN:</span>
          <span>AAECF2716M</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontWeight: '900' }}>CIN:</span>
          <span>U25209TN2020PTC138498</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .page-break { page-break-after: always; break-after: page; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .proforma-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .proforma-table td, .proforma-table th {
          border: 1.5px solid #000;
          padding: 5px 6px;
          vertical-align: middle;
          font-size: 9px;
          line-height: 1.3;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .proforma-table th {
          background: #e5e7eb;
          font-weight: 900;
          padding: 6px 7px;
          text-align: center;
          line-height: 1.2;
        }
        .proforma-table tbody tr { min-height: 30px; }
        .proforma-table .description-cell {
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: normal;
          max-width: 0;
        }
      `}</style>

      {pages.map((pageItems, pageIndex) => (
        <div
          key={pageIndex}
          className={pageIndex < totalPages - 1 ? 'page-break' : ''}
          style={{
            width: '297mm',
            height: '210mm',
            background: '#ffffff',
            margin: 0,
            padding: 0,
            fontFamily: 'Arial, sans-serif',
            color: '#000',
            position: 'relative',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              border: '3px solid #000',
              height: '210mm',
              width: '297mm',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <CompanyHeader />
            </div>

            <div style={{ flex: 1, padding: '10px 16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {pageIndex === 0 && (
                <>
                  <h2 style={{ textAlign: 'center', fontSize: '17px', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '1.5px' }}>
                    PROFORMA INVOICE
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '8.5px', marginBottom: '10px', flexShrink: 0 }}>
                    <div>
                      <p style={{ fontWeight: '900', fontSize: '10px', textDecoration: 'underline', margin: '0 0 3px 0' }}>Customer:</p>
                      <p style={{ fontWeight: '900', fontSize: '10px', margin: '0 0 4px 0' }}>{order.customerName || '—'}</p>
                      <div style={{ fontSize: '7.5px', fontWeight: '700' }}>
                        <p style={{ margin: '1.5px 0' }}><strong>GSTIN:</strong> {order.customerGST || '—'}</p>
                        <p style={{ margin: '1.5px 0' }}><strong>PAN:</strong> {order.customerPAN || '—'}</p>
                      </div>
                    </div>
                    <div>
                      {order.deliveryDate && (
                        <p style={{ margin: '1.5px 0', fontWeight: '700' }}>
                          <strong>Delivery Date:</strong> {safeFormatDate(order.deliveryDate)}
                        </p>
                      )}
                      {order.paymentTerms && (
                        <p style={{ margin: '1.5px 0', fontWeight: '700' }}>
                          <strong>Payment Terms:</strong> {order.paymentTerms}
                        </p>
                      )}
                      {order.dispatchMode && (
                        <p style={{ margin: '1.5px 0', fontWeight: '700' }}>
                          <strong>Dispatch Mode:</strong> {order.dispatchMode}
                        </p>
                      )}
                    </div>
                    <div>
                      <table style={{ width: '100%', fontSize: '8.5px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ paddingRight: '10px', fontWeight: '700', padding: '2px 0', verticalAlign: 'top' }}>PI No.:</td>
                            <td style={{ fontWeight: '900', fontSize: '12px', padding: '2px 0' }}>PI-{order.soNumber}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>PI Date:</td>
                            <td style={{ padding: '2px 0', fontWeight: '800' }}>{safeFormatDate(order.soDate || order.createdAt)}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Currency:</td>
                            <td style={{ fontWeight: '900', padding: '2px 0' }}>{order.currency || 'INR'} {symbol}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Reference SO:</td>
                            <td style={{ padding: '2px 0', fontWeight: '800' }}>{order.soNumber}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {pageIndex > 0 && (
                <div style={{ marginBottom: '10px', paddingTop: '8px', flexShrink: 0 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '900', textAlign: 'center', marginBottom: '5px' }}>
                    PROFORMA INVOICE - PI-{order.soNumber} (Continued)
                  </h3>
                  <p style={{ fontSize: '9px', textAlign: 'center', color: '#666', marginBottom: '8px' }}>
                    Page {pageIndex + 1} of {totalPages}
                  </p>
                </div>
              )}

              <div style={{ flex: 1, marginBottom: '10px', minHeight: 0, overflow: 'hidden' }}>
                <table className="proforma-table">
                  <colgroup>
                    <col style={{ width: '3%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '27%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '11%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Sr.</th>
                      <th>SKU / Code</th>
                      <th>Description</th>
                      <th>HSN</th>
                      <th>UOM</th>
                      <th>Qty</th>
                      <th>Rate<br />({symbol})</th>
                      <th>Amount<br />({symbol})</th>
                      <th>Tax<br />%</th>
                      <th>Net<br />({symbol})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((item: any, i: number) => {
                      const globalIndex = pageIndex * ITEMS_PER_PAGE + i;
                      return (
                        <tr key={i}>
                          <td style={{ textAlign: 'center', fontWeight: '800' }}>{globalIndex + 1}</td>
                          <td style={{ fontWeight: '800', fontSize: '8px', wordWrap: 'break-word' }}>{item.productCode || '—'}</td>
                          <td className="description-cell" style={{ textAlign: 'left', fontWeight: '700', fontSize: '8px', wordWrap: 'break-word', whiteSpace: 'normal' }}>
                            {item.productDescription || item.productName || '—'}
                            {item.size && (
                              <div style={{ fontSize: '6.5px', color: '#4b5563', marginTop: '2px' }}>
                                L:{item.size.length}{item.size.lengthUnit} × W:{item.size.width}{item.size.widthUnit} × H:{item.size.height}{item.size.heightUnit} × Wt:{item.size.weight}{item.size.weightUnit}
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: '700', textAlign: 'center', fontSize: '8px' }}>{item.hsnCode || '—'}</td>
                          <td style={{ textAlign: 'center', fontWeight: '700' }}>{item.unit || 'Nos'}</td>
                          <td style={{ textAlign: 'right', fontWeight: '800' }}>{Number(item.qty || item.quantity || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700' }}>{fmt(item.unitRate || item.rate || 0)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '800' }}>{fmt(item.amount || 0)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700' }}>{Number(item.taxPercentage || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '900', background: '#f9fafb' }}>{fmt(item.netAmount || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pageIndex === totalPages - 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', flexShrink: 0 }}>
                  <div style={{ fontSize: '8.5px' }}>
                    <div style={{ borderTop: '2px solid #000', paddingTop: '5px', marginBottom: '10px' }}>
                      <p style={{ fontWeight: '900', fontSize: '9px', marginBottom: '4px' }}>Bank Details for Payment:</p>
                      <p style={{ margin: '1px 0', fontWeight: '700' }}><strong>Bank:</strong> HDFC Bank</p>
                      <p style={{ margin: '1px 0', fontWeight: '700' }}><strong>A/C:</strong> 50200012345678</p>
                      <p style={{ margin: '1px 0', fontWeight: '700' }}><strong>IFSC:</strong> HDFC0001234</p>
                      <p style={{ margin: '1px 0', fontWeight: '700' }}><strong>Branch:</strong> Chennai Main</p>
                    </div>
                    <div style={{ marginTop: '16px' }}>
                      <p style={{ fontWeight: '900', fontSize: '10px', marginBottom: '20px' }}>For Fluoro Automation Seals Pvt Ltd</p>
                      <div style={{ borderTop: '2px solid #000', width: '150px', paddingTop: '5px' }}>
                        <p style={{ fontWeight: '900', fontSize: '8.5px' }}>Authorised Signatory</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <table style={{ marginLeft: 'auto', borderTop: '2px solid #000', fontSize: '10px', width: '100%' }}>
                      <tbody>
                        <tr>
                          <td style={{ paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px', textAlign: 'right', fontWeight: '800' }}>Subtotal</td>
                          <td style={{ fontWeight: '900', paddingLeft: '14px', width: '95px', textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                            {symbol}{fmt(order.subtotal || 0)}
                          </td>
                        </tr>
                        {order.currency === 'INR' && order.cgstAmount > 0 && (
                          <tr>
                            <td style={{ paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px', textAlign: 'right', fontWeight: '800' }}>
                              CGST @ {order.cgstPercent}%
                            </td>
                            <td style={{ fontWeight: '900', paddingLeft: '14px', textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                              {symbol}{fmt(order.cgstAmount)}
                            </td>
                          </tr>
                        )}
                        {order.currency === 'INR' && order.sgstAmount > 0 && (
                          <tr>
                            <td style={{ paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px', textAlign: 'right', fontWeight: '800' }}>
                              SGST @ {order.sgstPercent}%
                            </td>
                            <td style={{ fontWeight: '900', paddingLeft: '14px', textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                              {symbol}{fmt(order.sgstAmount)}
                            </td>
                          </tr>
                        )}
                        {order.transportCharge > 0 && (
                          <tr>
                            <td style={{ paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px', textAlign: 'right', fontWeight: '800' }}>
                              Transport Charge @ {order.transportChargePercent}%
                            </td>
                            <td style={{ fontWeight: '900', paddingLeft: '14px', textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                              {symbol}{fmt(order.transportCharge)}
                            </td>
                          </tr>
                        )}
                        <tr style={{ borderTop: '2px solid #000' }}>
                          <td style={{ paddingRight: '14px', paddingTop: '6px', paddingBottom: '6px', fontSize: '11px', fontWeight: '900', textAlign: 'right' }}>
                            Invoice Total ({order.currency || 'INR'})
                          </td>
                          <td style={{ fontSize: '13px', fontWeight: '900', paddingLeft: '14px', textAlign: 'right', paddingTop: '6px', paddingBottom: '6px' }}>
                            {symbol}{fmt(order.grandTotal || 0)}
                          </td>
                        </tr>
                        {order.currency === 'INR' && (
                          <tr>
                            <td colSpan={2} style={{ paddingTop: '6px', paddingBottom: '4px', fontSize: '9px', fontWeight: '700', textAlign: 'right' }}>
                              Amount in Words: {numberToWords(order.grandTotal || 0, order.currency || 'INR')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

// ────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────

export default function SalesOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<SalesOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [flattenedProducts, setFlattenedProducts] = useState<(ProductItem & { parentId: string })[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [soNumber, setSoNumber] = useState('');

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<'oa' | 'proforma'>('oa');
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [orderCreationType, setOrderCreationType] = useState<'quotation' | 'manual'>('quotation');
  const [manualCustomerId, setManualCustomerId] = useState('');
  const [manualCurrency, setManualCurrency] = useState('INR');
  const [manualPaymentTerms, setManualPaymentTerms] = useState('');
  const [manualDispatchMode, setManualDispatchMode] = useState('');
  const [manualDeliveryDate, setManualDeliveryDate] = useState('');
  const [manualInstructions, setManualInstructions] = useState('');
  const [manualItems, setManualItems] = useState<ManualOrderItem[]>([]);
  
  // Manual Order Tax and Transport
  const [manualCgstPercent, setManualCgstPercent] = useState<number>();
  const [manualSgstPercent, setManualSgstPercent] = useState<number>();
  const [manualTransportChargePercent, setManualTransportChargePercent] = useState<number>();

  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [tempJobStatus, setTempJobStatus] = useState<ProductionJobStatus>('notstarted');
  const [tempQCStatus, setTempQCStatus] = useState<QCStatus>('pending');
  const [tempOkQty, setTempOkQty] = useState<number | string>(0);
  const [tempNotOkQty, setTempNotOkQty] = useState<number | string>(0);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    let filtered = orders;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.soNumber?.toLowerCase().startsWith(query) ||
          order.customerName?.toLowerCase().includes(query)
      );
    }

    // Filter by date
    if (dateFilter) {
      filtered = filtered.filter((order) => {
        if (!order.soDate) return false;
        const orderDate = format(new Date(order.soDate), 'yyyy-MM-dd');
        return orderDate === dateFilter;
      });
    }

    setFilteredOrders(filtered);
  }, [searchQuery, dateFilter, orders]);

  const hydrateOrder = (raw: any): SalesOrder => {
    const safeStatus = (raw.status as SalesOrderStatus) || DEFAULT_STATUS;
    return {
      id: raw.id,
      soNumber: raw.soNumber || '',
      quotationId: raw.quotationId || '',
      quotationNumber: raw.quotationNumber || '',
      customerId: raw.customerId || '',
      customerName: raw.customerName || 'Unknown Customer',
      customerGST: raw.customerGST || '',
      customerPAN: raw.customerPAN || '',
      customerAddress: raw.customerAddress || '',
      customerPhone: raw.customerPhone || '',
      customerEmail: raw.customerEmail || '',
      soDate: raw.soDate || new Date(raw.createdAt || Date.now()).toISOString().split('T')[0],
      soTimestamp: raw.soTimestamp || raw.createdAt || Date.now(),
      deliveryDate: raw.deliveryDate || '',
      paymentTerms: raw.paymentTerms || '',
      dispatchMode: raw.dispatchMode || '',
      instructions: raw.instructions || '',
      items: raw.items || raw.lineItems || [],
      okQty: Number(raw.okQty) || 0,
      notOkQty: Number(raw.notOkQty) || 0,
      subtotal: Number(raw.subtotal) || 0,
      cgstAmount: Number(raw.cgstAmount) || 0,
      sgstAmount: Number(raw.sgstAmount) || 0,
      cgstPercent: Number(raw.cgstPercent) || 0,
      sgstPercent: Number(raw.sgstPercent) || 0,
      transportCharge: Number(raw.transportCharge) || 0,
      transportChargePercent: Number(raw.transportChargePercent) || 0,
      grandTotal: Number(raw.grandTotal) || 0,
      currency: raw.currency || 'INR',
      status: safeStatus,
      productionStatus: raw.productionStatus || 'pending',
      qcStatus: raw.qcStatus || 'pending',
      invoiceStatus: raw.invoiceStatus || 'notgenerated',
      deliveryStatus: raw.deliveryStatus || 'notdispatched',
      createdAt: raw.createdAt || Date.now(),
      updatedAt: raw.updatedAt,
      confirmedAt: raw.confirmedAt,
    };
  };

  const loadAllData = async () => {
    try {
      const [oaData, quotationsData, jobsData, inspectionsData, customersData, productsData] =
        await Promise.all([
          getAllRecords('sales/orderAcknowledgements'),
          getAllRecords('sales/quotations'),
          getAllRecords('production/jobs'),
          getAllRecords('quality/inspections'),
          getAllRecords('sales/customers'),
          getAllRecords('sales/products'),
        ]);

      const hydratedOrders = (oaData as any[]).map(hydrateOrder);
      const sortedOrders = hydratedOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(sortedOrders);
      setFilteredOrders(sortedOrders);

      const approved = (quotationsData as Quotation[])
        .filter((q) => q.status?.toLowerCase() === 'accepted')
        .map((q) => ({ ...q, currency: q.currency || 'INR' }));
      setQuotations(approved);

      setJobs(jobsData as ProductionJob[]);
      setInspections(inspectionsData as Inspection[]);
      setCustomers(customersData as any[]);

      if (productsData) {
        const productsList = productsData as Product[];
        setProducts(productsList);
        const flattened: (ProductItem & { parentId: string })[] = [];
        productsList.forEach((product) => {
          if (product.items && Array.isArray(product.items)) {
            product.items.forEach((item) => {
              flattened.push({ ...item, parentId: product.id });
            });
          }
        });
        setFlattenedProducts(flattened);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load data');
    }
  };

  const formatAmount = (amount: number, currency: string = 'INR') => {
    if (currency === 'INR') {
      return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusColor = (status: SalesOrderStatus) => {
    const map: Record<SalesOrderStatus, string> = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Confirmed': 'bg-blue-100 text-blue-800',
      'In Production': 'bg-purple-100 text-purple-800',
      'QC Pending': 'bg-orange-100 text-orange-800',
      'QC Completed': 'bg-teal-100 text-teal-800',
      'Ready for Dispatch': 'bg-indigo-100 text-indigo-800',
      'Delivered': 'bg-cyan-100 text-cyan-800',
      'Invoice Generated': 'bg-lime-100 text-lime-800',
      'Closed': 'bg-green-100 text-green-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  const getProductionSummaryForOrder = (orderId: string) => {
    const orderJobs = jobs.filter((j) => j.orderId === orderId);
    let notStarted = 0;
    let running = 0;
    let paused = 0;
    let completed = 0;
    orderJobs.forEach((job) => {
      const st = job.status || 'notstarted';
      if (st === 'completed') completed++;
      else if (st === 'running') running++;
      else if (st === 'paused') paused++;
      else notStarted++;
    });

    let overall: 'pending' | 'inprogress' | 'completed' = 'pending';
    if (orderJobs.length === 0) {
      overall = 'pending';
    } else if (completed === orderJobs.length) {
      overall = 'completed';
    } else if (running > 0 || paused > 0 || completed > 0) {
      overall = 'inprogress';
    }

    return { jobs: orderJobs, notStarted, running, paused, completed, total: orderJobs.length, overall };
  };

  const getInspectionForJob = (jobId: string): Inspection | undefined => {
    return inspections.find((i) => i.jobId === jobId);
  };

  const deriveOrderStatus = (order: SalesOrder): SalesOrderStatus => {
    const prod = getProductionSummaryForOrder(order.id);
    if (prod.total === 0) {
      return order.status === 'Pending' ? 'Pending' : 'Confirmed';
    }
    if (prod.overall === 'completed') {
      const orderInspections = inspections.filter((i) => i.orderId === order.id);
      const allQCdone =
        orderInspections.length === prod.total &&
        orderInspections.every((i) => i.qcStatus === 'completed');
      return allQCdone ? 'QC Completed' : 'QC Pending';
    }
    return 'In Production';
  };

  const openEdit = (order: SalesOrder) => {
    setSelectedOrder(order);
    setSoNumber(order.soNumber);
    setDeliveryDate(order.deliveryDate || '');
    setInstructions(order.instructions || '');
    setIsEditOpen(true);
  };

  const openDelete = (order: SalesOrder) => {
    setSelectedOrder(order);
    setIsDeleteOpen(true);
  };

  const openPreview = (order: SalesOrder, type: 'oa' | 'proforma') => {
    setPreviewOrder(order);
    setPreviewType(type);
    setIsPreviewOpen(true);
  };

  const generateSoNumber = () => {
    const base = orders.length + 1001;
    return `SO-${String(base).padStart(4, '0')}`;
  };

  const addManualItem = () => {
    const newItem: ManualOrderItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      productId: '',
      productCode: '',
      productName: '',
      productDescription: '',
      category: '',
      group: '',
      type: '',
      hsnCode: '',
      qty: 1,
      unit: '',
      unitRate: 0,
      taxPercentage: 0,
      amount: 0,
      taxAmount: 0,
      netAmount: 0,
    };
    setManualItems([...manualItems, newItem]);
  };

  const removeManualItem = (itemId: string) => {
    setManualItems(manualItems.filter((item) => item.id !== itemId));
  };

  const updateManualItem = (itemId: string, field: keyof ManualOrderItem, value: any) => {
    setManualItems(
      manualItems.map((item) => {
        if (item.id !== itemId) return item;
        const updated = { ...item, [field]: value };

        if (field === 'productCode' && value) {
          const product = flattenedProducts.find((p) => p.productCode === value);
          if (product) {
            updated.productId = product.parentId;
            updated.productCode = product.productCode;
            updated.productName = `${product.category} - ${product.group} (${product.productCode})`;
            updated.productDescription = `${product.category} | ${product.group} | ${product.type}`;
            updated.category = product.category;
            updated.group = product.group;
            updated.type = product.type;
            updated.hsnCode = product.hsn;
            updated.unit = product.unit;
            updated.unitRate = product.unitPrice;
            updated.size = product.size;
            updated.stockQty = product.stockQty;
          }
        }

        const qty = Number(updated.qty) || 0;
        const rate = Number(updated.unitRate) || 0;
        const tax = Number(updated.taxPercentage) || 0;
        updated.amount = qty * rate;
        updated.taxAmount = (updated.amount * tax) / 100;
        updated.netAmount = updated.amount + updated.taxAmount;

        return updated;
      })
    );
  };

  const calculateManualOrderTotals = () => {
    const subtotal = manualItems.reduce((sum, item) => sum + item.amount, 0);
    const cgst = manualCurrency === 'INR' ? subtotal * (manualCgstPercent / 100) : 0;
    const sgst = manualCurrency === 'INR' ? subtotal * (manualSgstPercent / 100) : 0;
    const transportCharge = subtotal * (manualTransportChargePercent / 100);
    const grandTotal = subtotal + cgst + sgst + transportCharge;
    return { subtotal, cgst, sgst, transportCharge, grandTotal };
  };

  const handleCreateOrder = async () => {
    if (orderCreationType === 'quotation') {
      if (!selectedQuotationId) {
        toast.error('Please select a quotation');
        return;
      }
      const selectedQuotation = quotations.find((q) => q.id === selectedQuotationId);
      if (!selectedQuotation) return;

      const now = Date.now();
      const todayISO = new Date().toISOString().split('T')[0];

      const newOrder: Omit<SalesOrder, 'id'> = {
        soNumber: generateSoNumber(),
        quotationId: selectedQuotation.id,
        quotationNumber: selectedQuotation.quoteNumber || '',
        customerId: selectedQuotation.customerId || '',
        customerName: selectedQuotation.customerName || 'Unknown Customer',
        customerGST: selectedQuotation.customerGST || '',
        customerPAN: selectedQuotation.customerPAN || '',
        customerAddress: selectedQuotation.customerAddress || '',
        customerPhone: selectedQuotation.customerPhone || '',
        customerEmail: selectedQuotation.customerEmail || '',
        soDate: todayISO,
        soTimestamp: now,
        deliveryDate: deliveryDate || selectedQuotation.deliveryTerm || todayISO,
        paymentTerms: selectedQuotation.paymentTerms,
        dispatchMode: selectedQuotation.modeOfDispatch || selectedQuotation.dispatchMode,
        instructions,
        items: selectedQuotation.lineItems || [],
        okQty: 0,
        notOkQty: 0,
        subtotal: selectedQuotation.subtotal || 0,
        cgstAmount: selectedQuotation.cgstAmount || 0,
        sgstAmount: selectedQuotation.sgstAmount || 0,
        cgstPercent: selectedQuotation.cgstPercent || 0,
        sgstPercent: selectedQuotation.sgstPercent || 0,
        transportCharge: selectedQuotation.transportCharge || 0,
        transportChargePercent: selectedQuotation.transportChargePercent || 0,
        grandTotal: selectedQuotation.grandTotal || 0,
        currency: selectedQuotation.currency || 'INR',
        status: 'Pending',
        productionStatus: 'pending',
        qcStatus: 'pending',
        invoiceStatus: 'notgenerated',
        deliveryStatus: 'notdispatched',
        createdAt: now,
      };

      try {
        await createRecord('sales/orderAcknowledgements', newOrder);
        toast.success(`Sales Order ${newOrder.soNumber} created`);
        setIsCreateOpen(false);
        resetForm();
        loadAllData();
      } catch (err) {
        console.error(err);
        toast.error('Failed to create order');
      }
    } else {
      // manual order
      if (!manualCustomerId) {
        toast.error('Please select a customer');
        return;
      }
      if (manualItems.length === 0) {
        toast.error('Please add at least one product');
        return;
      }

      const customer = customers.find((c: any) => c.id === manualCustomerId);
      if (!customer) {
        toast.error('Customer not found');
        return;
      }

      const totals = calculateManualOrderTotals();

      const now = Date.now();
      const todayISO = new Date().toISOString().split('T')[0];

      const newOrder: Omit<SalesOrder, 'id'> = {
        soNumber: generateSoNumber(),
        quotationId: '',
        quotationNumber: '',
        customerId: manualCustomerId,
        customerName: customer.companyName || 'Unknown Customer',
        customerGST: customer.gst || '',
        customerPAN: customer.pan || '',
        customerAddress: customer.addresses?.[0]?.street || '',
        customerPhone: customer.phone || '',
        customerEmail: customer.email || '',
        soDate: todayISO,
        soTimestamp: now,
        deliveryDate: manualDeliveryDate || todayISO,
        paymentTerms: manualPaymentTerms,
        dispatchMode: manualDispatchMode,
        instructions: manualInstructions,
        items: manualItems,
        okQty: 0,
        notOkQty: 0,
        subtotal: totals.subtotal,
        cgstAmount: totals.cgst,
        sgstAmount: totals.sgst,
        cgstPercent: manualCgstPercent,
        sgstPercent: manualSgstPercent,
        transportCharge: totals.transportCharge,
        transportChargePercent: manualTransportChargePercent,
        grandTotal: totals.grandTotal,
        currency: manualCurrency,
        status: 'Pending',
        productionStatus: 'pending',
        qcStatus: 'pending',
        invoiceStatus: 'notgenerated',
        deliveryStatus: 'notdispatched',
        createdAt: now,
      };

      try {
        await createRecord('sales/orderAcknowledgements', newOrder);
        toast.success(`Sales Order ${newOrder.soNumber} created`);
        setIsCreateOpen(false);
        resetForm();
        loadAllData();
      } catch (err) {
        console.error(err);
        toast.error('Failed to create order');
      }
    }
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
    try {
      await updateRecord('sales/orderAcknowledgements', selectedOrder.id, {
        deliveryDate,
        instructions,
        updatedAt: Date.now(),
      });
      toast.success(`${soNumber} updated successfully`);
      setIsEditOpen(false);
      resetForm();
      loadAllData();
    } catch (err) {
      toast.error('Failed to update order');
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    try {
      await deleteRecord('sales/orderAcknowledgements', selectedOrder.id);
      toast.success(`${selectedOrder.soNumber} deleted permanently`);
      setIsDeleteOpen(false);
      setSelectedOrder(null);
      loadAllData();
    } catch (err) {
      toast.error('Failed to delete order');
    }
  };

  const handleConfirmOrder = async (order: SalesOrder) => {
    if (order.status !== 'Pending') {
      toast.info('Only pending orders can be confirmed');
      return;
    }
    try {
      const items = order.items;
      if (items.length === 0) {
        toast.error('No items in order');
        return;
      }
      const now = Date.now();
      const jobPromises = items.map(async (item: any, index: number) => {
        const productId = item.productId || item.sku || item.id || `unknown-${index}`;
        const productName = item.productName || item.productDescription || item.name || `${productId} - Item ${index + 1}`;
        const qty = Number(item.qty || item.quantity || 1);
        return createRecord('production/jobs', {
          orderId: order.id,
          soNumber: order.soNumber,
          customerName: order.customerName,
          productId,
          productName,
          productCode: item.productCode || '',
          category: item.category || '',
          group: item.group || '',
          type: item.type || '',
          qty,
          hsnCode: item.hsnCode || '',
          unitRate: item.unitRate || item.rate || 0,
          netAmount: item.netAmount || item.amount || 0,
          deliveryDate: order.deliveryDate,
          priority: 'normal',
          status: 'notstarted',
          createdAt: now,
        });
      });

      await Promise.all(jobPromises);

      await updateRecord('sales/orderAcknowledgements', order.id, {
        status: 'Confirmed',
        productionStatus: 'pending',
        confirmedAt: now,
        updatedAt: now,
      });

      toast.success(`${order.soNumber} confirmed and jobs created`);
      loadAllData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to confirm order');
    }
  };

  const resetForm = () => {
    setSelectedQuotationId('');
    setDeliveryDate('');
    setInstructions('');
    setSoNumber('');
    setSelectedOrder(null);
    setOrderCreationType('quotation');
    setManualCustomerId('');
    setManualCurrency('INR');
    setManualPaymentTerms('');
    setManualDispatchMode('');
    setManualDeliveryDate('');
    setManualInstructions('');
    setManualItems([]);
    setManualCgstPercent(9);
    setManualSgstPercent(9);
    setManualTransportChargePercent(0);
  };

  const getProgressFromStatus = (status: SalesOrderStatus) => {
    const map: Record<SalesOrderStatus, number> = {
      'Pending': 10,
      'Confirmed': 20,
      'In Production': 55,
      'QC Pending': 75,
      'QC Completed': 100,
      'Ready for Dispatch': 90,
      'Delivered': 95,
      'Invoice Generated': 98,
      'Closed': 100,
    };
    return map[status] || 10;
  };

  const canDelete = (order: SalesOrder) => {
    return order.status === 'Pending' || order.status === 'Confirmed';
  };

  const selectedManualCustomer = customers.find((c: any) => c.id === manualCustomerId);
  const clearSearch = () => setSearchQuery('');

  const handleExportPDF = async (type: 'oa' | 'proforma') => {
    if (!printRef.current) return;
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 1122,
        height: 793,
        windowWidth: 1122,
        windowHeight: 793,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pageHeight = (pdfWidth * imgHeight) / imgWidth;
      const totalPages = Math.ceil(pageHeight / pdfHeight);

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();
        const yOffset = -(i * pdfHeight * imgWidth) / pdfWidth;
        pdf.addImage(imgData, 'PNG', 0, yOffset, pdfWidth, (pdfWidth * imgHeight) / imgWidth);
      }

      const filename =
        type === 'oa'
          ? `${previewOrder?.soNumber}-Order-Acknowledgement.pdf`
          : `${previewOrder?.soNumber}-Proforma-Invoice.pdf`;
      pdf.save(filename);
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF export failed');
    }
  };

  const startEditingJob = (job: ProductionJob) => {
    const insp = getInspectionForJob(job.id);
    setEditingJobId(job.id);
    setTempJobStatus(job.status || 'notstarted');
    setTempQCStatus(insp?.qcStatus || 'pending');
    setTempOkQty(insp?.okQty || 0);
    setTempNotOkQty(insp?.notOkQty || 0);
  };

  const cancelEdit = () => {
    setEditingJobId(null);
  };

  const saveJobChanges = async (job: ProductionJob, order: SalesOrder) => {
    const okVal = Number(tempOkQty) || 0;
    const notOkVal = Number(tempNotOkQty) || 0;
    if (okVal + notOkVal > job.qty) {
      toast.error('OK + Not OK quantity cannot exceed total job quantity');
      return;
    }

    try {
      await updateRecord('production/jobs', job.id, {
        status: tempJobStatus,
        updatedAt: Date.now(),
      });

      const existingInsp = getInspectionForJob(job.id);
      const inspPayload = {
        orderId: order.id,
        jobId: job.id,
        productId: job.productId,
        productName: job.productName,
        qcStatus: tempQCStatus,
        okQty: okVal,
        notOkQty: notOkVal,
        inspectionDate: new Date().toISOString(),
        updatedAt: Date.now(),
      };

      if (existingInsp) {
        await updateRecord('quality/inspections', existingInsp.id, inspPayload);
      } else {
        await createRecord('quality/inspections', inspPayload);
      }

      const currentJobs = jobs.filter((j) => j.orderId === order.id);
      const updatedJobs = currentJobs.map((j) => (j.id === job.id ? { ...j, status: tempJobStatus } : j));
      const completedCount = updatedJobs.filter((j) => j.status === 'completed').length;

      const orderInspections = inspections
        .filter((i) => i.orderId === order.id && i.jobId !== job.id)
        .concat([{ ...inspPayload, id: existingInsp?.id || `temp-${Date.now()}` } as Inspection]);

      const allInspected = orderInspections.length === updatedJobs.length;
      const allQCdone = orderInspections.every((i) => i.qcStatus === 'completed');
      const totalOk = orderInspections.reduce((sum, i) => sum + (i.okQty || 0), 0);
      const totalNotOk = orderInspections.reduce((sum, i) => sum + (i.notOkQty || 0), 0);

      let newProdStatus: 'pending' | 'inprogress' | 'completed' = 'pending';
      if (completedCount === updatedJobs.length) {
        newProdStatus = 'completed';
      } else if (completedCount > 0 || updatedJobs.some((j) => j.status === 'running' || j.status === 'paused')) {
        newProdStatus = 'inprogress';
      }

      const newQCStatus: 'pending' | 'inprogress' | 'completed' =
        allInspected && allQCdone ? 'completed' : orderInspections.length > 0 ? 'inprogress' : 'pending';

      await updateRecord('sales/orderAcknowledgements', order.id, {
        productionStatus: newProdStatus,
        qcStatus: newQCStatus,
        okQty: totalOk,
        notOkQty: totalNotOk,
        updatedAt: Date.now(),
      });

      toast.success('Job status & QC updated successfully');
      setEditingJobId(null);
      await loadAllData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save job & QC changes');
    }
  };

  const selectedQuotation = quotations.find((q) => q.id === selectedQuotationId);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sales Orders</h1>
          <p className="text-muted-foreground">Real-time production & quality tracking</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/sales/orders/create')}>
            <Plus className="mr-2 h-4 w-4" />
            Full-Page Form
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Quick Create
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Sales Order</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div>
                <Label>Order Creation Type</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <Button
                    type="button"
                    variant={orderCreationType === 'quotation' ? 'default' : 'outline'}
                    onClick={() => setOrderCreationType('quotation')}
                    className="w-full"
                  >
                    From Approved Quotation
                  </Button>
                  <Button
                    type="button"
                    variant={orderCreationType === 'manual' ? 'default' : 'outline'}
                    onClick={() => setOrderCreationType('manual')}
                    className="w-full"
                  >
                    Create Order Manually
                  </Button>
                </div>
              </div>

              {orderCreationType === 'quotation' ? (
                <div className="space-y-4">
                  <div>
                    <Label>Select Approved Quotation</Label>
                    <Select value={selectedQuotationId} onValueChange={setSelectedQuotationId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose approved quotation..." />
                      </SelectTrigger>
                      <SelectContent>
                        {quotations.map((q) => (
                          <SelectItem key={q.id} value={q.id}>
                            {q.quoteNumber || q.id} - {q.customerName || 'Unknown'} ({q.currency || 'INR'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedQuotation && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Customer</Label>
                          <p className="text-sm font-medium">{selectedQuotation.customerName}</p>
                          <p className="text-xs text-muted-foreground">GST: {selectedQuotation.customerGST || 'NA'}</p>
                        </div>
                        <div>
                          <Label>Quotation</Label>
                          <p className="text-sm font-medium">{selectedQuotation.quoteNumber || selectedQuotation.id}</p>
                          <p className="text-xs text-muted-foreground">Date: {selectedQuotation.quoteDate}</p>
                        </div>
                      </div>

                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-lg font-bold text-green-800">
                          Total: {CURRENCY_SYMBOLS[selectedQuotation.currency || 'INR']}{formatAmount(selectedQuotation.grandTotal || 0, selectedQuotation.currency)}
                        </p>
                        <p className="text-sm text-green-700">Currency: {selectedQuotation.currency || 'INR'}</p>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Delivery Date</Label>
                      <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                    </div>
                    <div></div>
                  </div>

                  <div>
                    <Label>Internal Instructions (Optional)</Label>
                    <Textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Any special packing, priority, or handling notes..."
                      rows={3}
                    />
                  </div>

                  <Button onClick={handleCreateOrder} className="w-full mt-6" size="lg">
                    Create Sales Order
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Select Customer *</Label>
                      <Select value={manualCustomerId} onValueChange={setManualCustomerId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose customer..." />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.companyName || 'Unknown'} {c.gst ? `(${c.gst})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Currency</Label>
                      <Select value={manualCurrency} onValueChange={setManualCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INR">INR (₹)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="AED">AED (د.إ)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedManualCustomer && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium">{selectedManualCustomer.companyName}</p>
                      <p className="text-xs text-muted-foreground">
                        GST: {selectedManualCustomer.gst || 'NA'} | PAN: {selectedManualCustomer.pan || 'NA'}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Payment Terms</Label>
                      <Input
                        value={manualPaymentTerms}
                        onChange={(e) => setManualPaymentTerms(e.target.value)}
                        placeholder="e.g., Net 30, Advance Payment"
                      />
                    </div>
                    <div>
                      <Label>Dispatch Mode</Label>
                      <Input
                        value={manualDispatchMode}
                        onChange={(e) => setManualDispatchMode(e.target.value)}
                        placeholder="e.g., Air, Road, Courier"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Delivery Date</Label>
                    <Input type="date" value={manualDeliveryDate} onChange={(e) => setManualDeliveryDate(e.target.value)} />
                  </div>

                  {/* Manual Order Tax Configuration */}
                  {manualCurrency === 'INR' && (
                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardHeader>
                        <CardTitle className="text-lg">Tax Configuration (GST)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>CGST %</Label>
                            <Input
                              type="number"
                              min={0}
                              max={50}
                              step={0.1}
                              value={manualCgstPercent}
                              onChange={(e) => setManualCgstPercent(Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>SGST %</Label>
                            <Input
                              type="number"
                              min={0}
                              max={50}
                              step={0.1}
                              value={manualSgstPercent}
                              onChange={(e) => setManualSgstPercent(Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div>
                    <Label>Transport Charge %</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={manualTransportChargePercent}
                      onChange={(e) => setManualTransportChargePercent(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-lg font-semibold">Product Items</Label>
                      <Button type="button" size="sm" onClick={addManualItem}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Product
                      </Button>
                    </div>

                    {manualItems.map((item, index) => (
                      <Card key={item.id} className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-medium">Item {index + 1}</h4>
                          <Button type="button" size="sm" variant="ghost" onClick={() => removeManualItem(item.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="md:col-span-2">
                            <Label>Select Product</Label>
                            <Select value={item.productCode} onValueChange={(v) => updateManualItem(item.id, 'productCode', v)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose product..." />
                              </SelectTrigger>
                              <SelectContent>
                                {flattenedProducts.map((p) => (
                                  <SelectItem key={p.productCode} value={p.productCode}>
                                    {p.productCode} - {p.category} - {p.group} ({p.type}) | Stock: {p.stockQty} {p.unit}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {item.productCode && (
                            <div className="md:col-span-2 p-3 bg-gray-50 rounded-lg border">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                <div>
                                  <span className="font-semibold">Category:</span> {item.category}
                                </div>
                                <div>
                                  <span className="font-semibold">Group:</span> {item.group}
                                </div>
                                <div>
                                  <span className="font-semibold">Type:</span> {item.type}
                                </div>
                                <div>
                                  <span className="font-semibold">Stock:</span> {item.stockQty} {item.unit}
                                </div>
                                {item.size && (
                                  <>
                                    <div>
                                      <span className="font-semibold">L:</span> {item.size.length} {item.size.lengthUnit}
                                    </div>
                                    <div>
                                      <span className="font-semibold">W:</span> {item.size.width} {item.size.widthUnit}
                                    </div>
                                    <div>
                                      <span className="font-semibold">H:</span> {item.size.height} {item.size.heightUnit}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Wt:</span> {item.size.weight} {item.size.weightUnit}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          <div>
                            <Label>Product Description</Label>
                            <Input
                              value={item.productDescription}
                              onChange={(e) => updateManualItem(item.id, 'productDescription', e.target.value)}
                              placeholder="Description"
                            />
                          </div>

                          <div>
                            <Label>HSN Code</Label>
                            <Input
                              value={item.hsnCode}
                              onChange={(e) => updateManualItem(item.id, 'hsnCode', e.target.value)}
                              placeholder="HSN Code"
                            />
                          </div>

                          <div>
                            <Label>Quantity</Label>
                            <Input
                              type="number"
                              min={1}
                              value={item.qty}
                              onChange={(e) => updateManualItem(item.id, 'qty', Number(e.target.value))}
                            />
                          </div>

                          <div>
                            <Label>Unit</Label>
                            <Input value={item.unit} onChange={(e) => updateManualItem(item.id, 'unit', e.target.value)} placeholder="Unit" />
                          </div>

                          <div>
                            <Label>Unit Rate</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.unitRate}
                              onChange={(e) => updateManualItem(item.id, 'unitRate', Number(e.target.value))}
                            />
                          </div>

                          <div>
                            <Label>Tax %</Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={item.taxPercentage}
                              onChange={(e) => updateManualItem(item.id, 'taxPercentage', Number(e.target.value))}
                            />
                          </div>

                          <div>
                            <Label>Amount</Label>
                            <Input
                              value={`${CURRENCY_SYMBOLS[manualCurrency]}${formatAmount(item.amount, manualCurrency)}`}
                              disabled
                              className="bg-muted"
                            />
                          </div>

                          <div>
                            <Label>Tax Amount</Label>
                            <Input
                              value={`${CURRENCY_SYMBOLS[manualCurrency]}${formatAmount(item.taxAmount, manualCurrency)}`}
                              disabled
                              className="bg-muted"
                            />
                          </div>

                          <div>
                            <Label>Net Amount</Label>
                            <Input
                              value={`${CURRENCY_SYMBOLS[manualCurrency]}${formatAmount(item.netAmount, manualCurrency)}`}
                              disabled
                              className="bg-muted font-bold"
                            />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {manualItems.length > 0 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-medium">
                            {CURRENCY_SYMBOLS[manualCurrency]}{formatAmount(calculateManualOrderTotals().subtotal, manualCurrency)}
                          </span>
                        </div>
                        {manualCurrency === 'INR' && (
                          <>
                            <div className="flex justify-between">
                              <span>CGST @ {manualCgstPercent}%:</span>
                              <span className="font-medium">
                                {CURRENCY_SYMBOLS[manualCurrency]}{formatAmount(calculateManualOrderTotals().cgst, manualCurrency)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>SGST @ {manualSgstPercent}%:</span>
                              <span className="font-medium">
                                {CURRENCY_SYMBOLS[manualCurrency]}{formatAmount(calculateManualOrderTotals().sgst, manualCurrency)}
                              </span>
                            </div>
                          </>
                        )}
                        {manualTransportChargePercent > 0 && (
                          <div className="flex justify-between">
                            <span>Transport Charge @ {manualTransportChargePercent}%:</span>
                            <span className="font-medium">
                              {CURRENCY_SYMBOLS[manualCurrency]}{formatAmount(calculateManualOrderTotals().transportCharge, manualCurrency)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold text-green-800 pt-2 border-t">
                          <span>Grand Total:</span>
                          <span>
                            {CURRENCY_SYMBOLS[manualCurrency]}{formatAmount(calculateManualOrderTotals().grandTotal, manualCurrency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Internal Instructions (Optional)</Label>
                    <Textarea
                      value={manualInstructions}
                      onChange={(e) => setManualInstructions(e.target.value)}
                      placeholder="Any special packing, priority, or handling notes..."
                      rows={3}
                    />
                  </div>

                  <Button
                    onClick={handleCreateOrder}
                    className="w-full mt-6"
                    size="lg"
                    disabled={!manualCustomerId || manualItems.length === 0}
                  >
                    Create Manual Sales Order
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="relative max-w-md flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by SO number or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 py-6 text-base border-2 border-gray-300 focus:border-blue-500 rounded-lg shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-10 pr-10 py-6 text-base border-2 border-gray-300 focus:border-blue-500 rounded-lg shadow-sm w-[200px]"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear date filter"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        {(searchQuery || dateFilter) && (
          <p className="mt-2 text-sm text-gray-600">
            Found {filteredOrders.length} result{filteredOrders.length !== 1 ? 's' : ''}
            {dateFilter && ` for ${format(new Date(dateFilter), 'dd/MM/yyyy')}`}
          </p>
        )}
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">All Orders</TabsTrigger>
          <TabsTrigger value="tracking">Live Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SO Number</TableHead>
                    <TableHead>Quote No</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Production</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        {searchQuery ? (
                          <>
                            <p className="text-lg font-medium mb-2">No orders match your search</p>
                            <p className="text-sm">
                              Try a different search term or{' '}
                              <button onClick={clearSearch} className="text-blue-600 hover:underline">
                                clear search
                              </button>
                            </p>
                          </>
                        ) : (
                          <p>No sales orders yet</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => {
                      const prodSummary = getProductionSummaryForOrder(order.id);
                      const derivedStatus = deriveOrderStatus(order);
                      const dateObj = order.soDate ? new Date(order.soDate) : new Date(order.createdAt);
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-bold text-blue-600">{order.soNumber}</TableCell>
                          <TableCell className="text-sm text-gray-600">{order.quotationNumber || '-'}</TableCell>
                          <TableCell>{order.customerName}</TableCell>
                          <TableCell>{format(dateObj, 'dd MMM yyyy')}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(derivedStatus)} variant="secondary">
                              {derivedStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              {prodSummary.total === 0 ? (
                                <span className="text-muted-foreground">No jobs</span>
                              ) : (
                                <>
                                  {prodSummary.running > 0 && (
                                    <span className="font-bold text-emerald-700">{prodSummary.running} Running </span>
                                  )}
                                  {prodSummary.completed > 0 && (
                                    <span className="font-medium text-green-700">{prodSummary.completed} Done </span>
                                  )}
                                  {prodSummary.paused > 0 && <span className="text-amber-700">{prodSummary.paused} Paused </span>}
                                  {prodSummary.notStarted > 0 && (
                                    <span className="text-muted-foreground">{prodSummary.notStarted}</span>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>
                              <span className="text-lg font-bold">
                                {CURRENCY_SYMBOLS[order.currency || 'INR']}{formatAmount(order.grandTotal, order.currency)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">{order.currency || 'INR'}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1 items-center flex-wrap">
                              {canDelete(order) ? (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => openEdit(order)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {order.status === 'Pending' && (
                                    <Button size="sm" onClick={() => handleConfirmOrder(order)}>
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button size="sm" variant="destructive" onClick={() => openDelete(order)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  <Lock className="h-3 w-3 mr-1" />
                                  Locked
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-green-600 text-green-600 hover:bg-green-50"
                                onClick={() => openPreview(order, 'oa')}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracking">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredOrders
              .filter((o) => o.status !== 'Pending')
              .map((order) => {
                const summary = getProductionSummaryForOrder(order.id);
                const derived = deriveOrderStatus(order);
                return (
                  <Card key={order.id} className={`hover:shadow-xl transition-all ${summary.running > 0 ? 'ring-2 ring-emerald-500' : ''}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-xl">{order.soNumber}</CardTitle>
                          <p className="text-sm text-muted-foreground">{order.customerName}</p>
                          {order.quotationNumber && <p className="text-xs text-blue-600 mt-1">Quote: {order.quotationNumber}</p>}
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(derived)}>{derived}</Badge>
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              {order.currency || 'INR'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border">
                        <p className="text-2xl font-black text-green-700">
                          {CURRENCY_SYMBOLS[order.currency || 'INR']}{formatAmount(order.grandTotal, order.currency)}
                        </p>
                        <p className="text-xs text-green-600">Grand Total</p>
                      </div>

                      <div>
                        <Progress value={getProgressFromStatus(derived)} className="h-3" />
                        <p className="text-xs text-center mt-2 text-muted-foreground">{derived}</p>
                      </div>

                      <div className="space-y-4">
                        {summary.jobs.length === 0 ? (
                          <p className="text-center text-sm text-muted-foreground py-6">No production jobs created yet</p>
                        ) : (
                          summary.jobs.map((job) => {
                            const inspection = getInspectionForJob(job.id);
                            const isEditingThisJob = editingJobId === job.id;

                            const jobBadge = {
                              notstarted: { color: 'bg-gray-100 text-gray-800', label: 'Not Started' },
                              running: { color: 'bg-emerald-100 text-emerald-900', label: 'Running' },
                              paused: { color: 'bg-amber-100 text-amber-900', label: 'Paused' },
                              completed: { color: 'bg-green-100 text-green-900', label: 'Completed' },
                            }[job.status || 'notstarted'];

                            const qcBadge = {
                              pending: { color: 'bg-gray-100 text-gray-800', label: 'Pending' },
                              'in-progress': { color: 'bg-blue-100 text-blue-900', label: 'In Progress' },
                              completed: {
                                color:
                                  (inspection?.notOkQty || 0) > 0
                                    ? 'bg-red-100 text-red-900'
                                    : 'bg-emerald-100 text-emerald-900',
                                label: (inspection?.notOkQty || 0) > 0 ? 'Rejected' : 'Passed',
                              },
                            }[inspection?.qcStatus || 'pending'];

                            return (
                              <div key={job.id} className="p-4 border rounded-lg bg-background">
                                <div className="flex justify-between items-start mb-3 gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate">{job.productName}</p>
                                    <p className="text-xs text-muted-foreground">Qty: {job.qty}</p>
                                  </div>

                                  {isEditingThisJob ? (
                                    <div className="flex gap-2 flex-shrink-0">
                                      <Button size="sm" onClick={() => saveJobChanges(job, order)}>
                                        <Save className="h-3.5 w-3.5 mr-1" />
                                        Save
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button size="sm" variant="ghost" onClick={() => startEditingJob(job)} className="flex-shrink-0">
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>

                                {isEditingThisJob ? (
                                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                      <Label className="text-xs mb-1 block">Production Status</Label>
                                      <Select
                                        value={tempJobStatus}
                                        onValueChange={(v) => setTempJobStatus(v as ProductionJobStatus)}
                                      >
                                        <SelectTrigger className="h-9">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="notstarted">Not Started</SelectItem>
                                          <SelectItem value="running">Running</SelectItem>
                                          <SelectItem value="paused">Paused</SelectItem>
                                          <SelectItem value="completed">Completed</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div>
                                      <Label className="text-xs mb-1 block">QC Status</Label>
                                      <Select
                                        value={tempQCStatus}
                                        onValueChange={(v) => setTempQCStatus(v as QCStatus)}
                                        disabled={tempJobStatus !== 'completed'}
                                      >
                                        <SelectTrigger className="h-9">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">Pending</SelectItem>
                                          <SelectItem value="in-progress">In Progress</SelectItem>
                                          <SelectItem value="completed">Completed</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div>
                                      <Label className="text-xs mb-1 block">OK Quantity</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={job.qty}
                                        value={tempOkQty}
                                        onChange={(e) => setTempOkQty(e.target.value ? Math.max(0, Number(e.target.value)) : '')}
                                        className="h-9"
                                        disabled={tempJobStatus !== 'completed'}
                                      />
                                    </div>

                                    <div>
                                      <Label className="text-xs mb-1 block">Not OK Quantity</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={job.qty}
                                        value={tempNotOkQty}
                                        onChange={(e) => setTempNotOkQty(e.target.value ? Math.max(0, Number(e.target.value)) : '')}
                                        className="h-9"
                                        disabled={tempJobStatus !== 'completed'}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className="font-medium whitespace-nowrap">Production:</span>
                                      <Badge className={jobBadge.color}>{jobBadge.label}</Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className="font-medium whitespace-nowrap">QC:</span>
                                      <Badge className={qcBadge.color}>
                                        {qcBadge.label}
                                        {inspection?.okQty !== undefined && inspection?.notOkQty !== undefined && (
                                          <span className="ml-1">
                                            ({inspection.okQty}/{inspection.notOkQty})
                                          </span>
                                        )}
                                      </Badge>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </TabsContent>
      </Tabs>

      {/* PREVIEW DIALOG */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-6xl max-h-screen overflow-y-auto p-0 bg-white">
          {previewOrder && (
            <div>
              <div className="sticky top-0 bg-white border-b z-10 p-6 flex justify-between items-center shadow-md">
                <div>
                  <h2 className="text-3xl font-bold text-blue-900">
                    {previewType === 'oa' ? 'Order Acknowledgement' : 'Proforma Invoice'} - {previewOrder.soNumber}
                  </h2>
                  <div className="flex gap-3 mt-2">
                    <Button
                      variant={previewType === 'oa' ? 'default' : 'outline'}
                      onClick={() => setPreviewType('oa')}
                      size="sm"
                    >
                      Order Acknowledgement
                    </Button>
                    <Button
                      variant={previewType === 'proforma' ? 'default' : 'outline'}
                      onClick={() => setPreviewType('proforma')}
                      size="sm"
                    >
                      Proforma Invoice
                    </Button>
                  </div>
                </div>
                <Button onClick={() => handleExportPDF(previewType)} size="lg" className="bg-blue-700 hover:bg-blue-800">
                  <Download className="h-6 w-6 mr-3" />
                  Download PDF
                </Button>
              </div>
              <div ref={printRef}>
                {previewType === 'oa' ? (
                  <OrderAcknowledgementPrintTemplate order={previewOrder} />
                ) : (
                  <ProformaInvoicePrintTemplate order={previewOrder} />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* EDIT BASIC ORDER INFO DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order {soNumber}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Delivery Date</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div>
              <Label>Instructions</Label>
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateOrder}>Update Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedOrder?.soNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrder} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
