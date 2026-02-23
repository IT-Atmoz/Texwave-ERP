import { format } from 'date-fns';
import fas from '../modules/sales/fas.png';

interface Branch {
  id: string;
  branchName: string;
  branchCode: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isHeadOffice?: boolean;
}

interface QuotationPrintProps {
  quotation: {
    quoteNumber: string;
    quoteDate: string;
    validity: string;
    paymentTerms: string;
    modeOfDispatch: string;
    deliveryTerm: string;
    remarks: string;
    comments: string;
    yourRef?: string;
    ourRef?: string;
    verNo?: string;
    verDate?: string;
    customerName: string;
    customerGST?: string;
    customerPAN?: string;
    customerCIN?: string;
    currency: string;
    currencySymbol: string;
    billingAddress?: Address | null;
    shippingAddress?: Address | null;
    selectedBranch?: Branch | null;
    lineItems: any[];
    subtotal: number;
    cgstAmount: number;
    sgstAmount: number;
    transportCharge: number;
    cgstPercent?: number;
    sgstPercent?: number;
    transportChargePercent?: number;
    grandTotal: number;
    includeGST: boolean;
    isWalkIn: boolean;
  };
}

interface Address {
  label: string;
  street: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

const formatAddress = (addr: Address | null | undefined) => {
  if (!addr) return '—';
  return `${addr.street}${addr.area ? `, ${addr.area}` : ''}\n${addr.city}, ${addr.state} - ${addr.pincode}\n${addr.country}`;
};
// Add this helper function at the top of your component, after the formatBranchAddress function
const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  const convertLessThanThousand = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
  };
  
  const convertToWords = (n: number): string => {
    if (n === 0) return 'Zero';
    
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const remainder = n % 1000;
    
    let result = '';
    
    if (crore > 0) result += convertLessThanThousand(crore) + ' Crore ';
    if (lakh > 0) result += convertLessThanThousand(lakh) + ' Lakh ';
    if (thousand > 0) result += convertLessThanThousand(thousand) + ' Thousand ';
    if (remainder > 0) result += convertLessThanThousand(remainder);
    
    return result.trim();
  };
  
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  
  let words = convertToWords(rupees);
  
  if (paise > 0) {
    words += ' and ' + convertToWords(paise) + ' Paise';
  }
  
  return words + ' Only';
};


const formatBranchAddress = (branch: Branch | null | undefined) => {
  if (!branch) return null;
  return `${branch.branchName} (${branch.branchCode})\n${branch.address}\n${branch.city}, ${branch.state} - ${branch.pincode}\n${branch.country}\nContact: ${branch.contactPerson} | ${branch.phone}`;
};

const fmt = (num: number) => Number(num || 0).toFixed(2);

// Split items into pages - 12 items per page for proper spacing
const ITEMS_PER_PAGE = 12;

export default function QuotationPrintTemplate({ quotation }: QuotationPrintProps) {
  if (!quotation) return null;

  const q = quotation;
  const isWalkIn = q.isWalkIn === true;
  const isINR = q.currency === 'INR';
  const symbol = q.currencySymbol || '₹';
  const showGST = q.includeGST && isINR;

  // Split line items into pages
  const pages: any[][] = [];
  for (let i = 0; i < q.lineItems.length; i += ITEMS_PER_PAGE) {
    pages.push(q.lineItems.slice(i, i + ITEMS_PER_PAGE));
  }

  // If no items, create one empty page
  if (pages.length === 0) {
    pages.push([]);
  }

  const totalPages = pages.length;

  // Company Header Component (reusable)
  const CompanyHeader = () => (
    <>
      {/* Company Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '3px solid #000',
        background: '#ffffff',
        gap: '12px'
      }}>
        <img src={fas} alt="FAS Logo" style={{ width: '75px', height: 'auto', flexShrink: 0 }} />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <h1 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: '#000', lineHeight: 1.2 }}>
            Fluoro Automation Seals Pvt Ltd
          </h1>
          <p style={{ fontSize: '9.5px', margin: '3px 0 0 0', color: '#000', lineHeight: 1.3, fontWeight: '600' }}>
            3/180, Rajiv Gandhi Road, Mettukuppam, Chennai Tamil Nadu 600097 India<br/>
            Phone: +91-841175097 | Email: fas@fluoroautomationseals.com
          </p>
        </div>
      </div>

      {/* Company Details Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 16px',
        background: '#e5e7eb',
        borderBottom: '3px solid #000',
        fontSize: '9.5px',
        fontWeight: '800',
        gap: '45px'
      }}>
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
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            margin: 0;
            padding: 0;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        .quotation-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        
        .quotation-table td,
        .quotation-table th {
          border: 1.5px solid #000;
          padding: 5px 6px;
          vertical-align: middle;
          font-size: 9px;
          line-height: 1.3;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        .quotation-table th {
          background: #e5e7eb;
          font-weight: 900;
          padding: 6px 7px;
          text-align: center;
          line-height: 1.2;
        }

        .quotation-table tbody tr {
          min-height: 30px;
        }

        .quotation-table .description-cell {
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
          <div style={{ border: '3px solid #000', height: '100%', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header on every page */}
            <div style={{ flexShrink: 0 }}>
              <CompanyHeader />
            </div>

            {/* Body Content */}
            <div style={{ flex: 1, padding: '10px 16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              
              {/* Title - Only on first page */}
              {pageIndex === 0 && (
                <>
                  <h2 style={{ textAlign: 'center', fontSize: '17px', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '1.5px' }}>
                    SALES QUOTATION
                  </h2>

                  {/* Customer Info and Quote Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '8.5px', marginBottom: '10px', flexShrink: 0 }}>
                    {/* Bill To */}
                    <div>
                      <p style={{ fontWeight: '900', fontSize: '10px', textDecoration: 'underline', margin: '0 0 3px 0' }}>Bill To:</p>
                      <p style={{ fontWeight: '900', fontSize: '10px', margin: '0 0 4px 0' }}>
                        {isWalkIn ? q.customerName : q.customerName || '—'}
                      </p>
                      {!isWalkIn && q.billingAddress && (
                        <p style={{ whiteSpace: 'pre-line', fontSize: '7.5px', lineHeight: 1.3, margin: '0 0 4px 0', fontWeight: '600' }}>
                          {formatAddress(q.billingAddress)}
                        </p>
                      )}
                      {!isWalkIn && (
                        <div style={{ fontSize: '7.5px', fontWeight: '700' }}>
                          <p style={{ margin: '1.5px 0' }}><strong>GSTIN:</strong> {q.customerGST || '—'}</p>
                          <p style={{ margin: '1.5px 0' }}><strong>PAN:</strong> {q.customerPAN || '—'}</p>
                          <p style={{ margin: '1.5px 0' }}><strong>CIN:</strong> {q.customerCIN || '—'}</p>
                        </div>
                      )}
                      {isWalkIn && (
                        <p style={{ marginTop: '5px', fontSize: '9px', fontWeight: '900', color: '#dc2626' }}>
                          Cash Sale – GST Not Applicable
                        </p>
                      )}
                    </div>

                    {/* Ship To / Branch */}
                    <div>
                      {!isWalkIn && q.shippingAddress && (
                        <div style={{ marginBottom: '6px' }}>
                          <p style={{ fontWeight: '900', fontSize: '10px', textDecoration: 'underline', margin: '0 0 3px 0' }}>Ship To:</p>
                          <p style={{ fontSize: '7.5px', lineHeight: 1.3, whiteSpace: 'pre-line', fontWeight: '600', margin: 0 }}>
                            {formatAddress(q.shippingAddress)}
                          </p>
                        </div>
                      )}

                      {!isWalkIn && q.selectedBranch && (
                        <div style={{ 
                          background: '#fff7ed', 
                          padding: '5px', 
                          borderRadius: '4px', 
                          border: '1.5px solid #fb923c',
                          overflow: 'hidden',
                          wordWrap: 'break-word'
                        }}>
                          <p style={{ fontWeight: '900', fontSize: '7.5px', color: '#c2410c', textDecoration: 'underline', margin: '0 0 3px 0' }}>
                            📍 Branch Details:
                          </p>
                          <p style={{ fontSize: '6.5px', lineHeight: 1.3, whiteSpace: 'pre-line', fontWeight: '600', margin: '0 0 3px 0' }}>
                            {formatBranchAddress(q.selectedBranch)}
                          </p>
                       
                        </div>
                      )}
                    </div>

                    {/* Quote Details */}
                    <div>
                      <table style={{ width: '100%', fontSize: '8.5px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ paddingRight: '10px', fontWeight: '700', padding: '2px 0', verticalAlign: 'top' }}>SQ No.:</td>
                            <td style={{ fontWeight: '900', fontSize: '12px', padding: '2px 0' }}>{q.quoteNumber}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>SQ Date:</td>
                            <td style={{ padding: '2px 0', fontWeight: '800' }}>{format(new Date(q.quoteDate), 'dd/MM/yyyy')}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Currency:</td>
                            <td style={{ fontWeight: '900', padding: '2px 0' }}>{q.currency} {symbol}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Quote Validity:</td>
                            <td style={{ padding: '2px 0', fontWeight: '800' }}>{q.validity || '30 Days'}</td>
                          </tr>
                          {!isWalkIn && (
                            <>
                              <tr>
                                <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Your Ref:</td>
                                <td style={{ padding: '2px 0', fontWeight: '800' }}>{q.yourRef || '—'}</td>
                              </tr>
                              <tr>
                                <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Our Ref:</td>
                                <td style={{ padding: '2px 0', fontWeight: '800' }}>{q.ourRef || '—'}</td>
                              </tr>
                            </>
                          )}
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Mode of Despatch:</td>
                            <td style={{ padding: '2px 0', fontWeight: '800' }}>{q.modeOfDispatch}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Delivery Term:</td>
                            <td style={{ padding: '2px 0', fontWeight: '800' }}>{q.deliveryTerm}</td>
                          </tr>
                          <tr>
                            <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Payment Terms:</td>
                            <td style={{ padding: '2px 0', fontWeight: '800' }}>{q.paymentTerms}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Continuation header for pages after first */}
              {pageIndex > 0 && (
                <div style={{ marginBottom: '10px', paddingTop: '8px', flexShrink: 0 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '900', textAlign: 'center', marginBottom: '5px' }}>
                    SALES QUOTATION - {q.quoteNumber} (Continued)
                  </h3>
                  <p style={{ fontSize: '9px', textAlign: 'center', color: '#666', marginBottom: '8px' }}>
                    Page {pageIndex + 1} of {totalPages}
                  </p>
                </div>
              )}

              {/* Items Table */}
              <div style={{ flex: 1, marginBottom: '10px', minHeight: 0, overflow: 'hidden' }}>
                <table className="quotation-table">
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
                      <th>Rate<br/>({symbol})</th>
                      <th>Amount<br/>({symbol})</th>
                      <th>Disc<br/>%</th>
                      <th>Net<br/>({symbol})</th>
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
                            {item.productDescription || '—'}
                            {item.size && (
                              <div style={{ fontSize: '6.5px', color: '#4b5563', marginTop: '2px' }}>Size: {item.size}</div>
                            )}
                          </td>
                          <td style={{ fontWeight: '700', textAlign: 'center', fontSize: '8px' }}>{item.hsnCode || '—'}</td>
                          <td style={{ textAlign: 'center', fontWeight: '700' }}>{item.uom || 'Nos'}</td>
                          <td style={{ textAlign: 'right', fontWeight: '800' }}>{Number(item.qty || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700' }}>{fmt(item.unitRate)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '800' }}>{fmt(item.qty * item.unitRate)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '700' }}>{Number(item.discount || 0).toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: '900', background: '#f9fafb' }}>{fmt(item.netAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Section - Only on last page */}
              {pageIndex === totalPages - 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', flexShrink: 0 }}>
                  {/* Left: Remarks and Signature */}
                  <div style={{ fontSize: '8.5px' }}>
                    <div style={{ borderTop: '2px solid #000', paddingTop: '5px' }}>
                      <p style={{ lineHeight: 1.4, margin: '0 0 4px 0', fontWeight: '700' }}>
                        <strong style={{ fontWeight: '900' }}>Remarks:</strong> {q.remarks || 'None'}
                      </p>
                      <p style={{ lineHeight: 1.4, margin: 0, fontWeight: '700' }}>
                        <strong style={{ fontWeight: '900' }}>Comments:</strong> {q.comments || 'Thank you for your business!'}
                      </p>
                    </div>

                    <div style={{ marginTop: '16px' }}>
                      <p style={{ fontWeight: '900', fontSize: '10px', marginBottom: '20px' }}>For Fluoro Automation Seals Pvt Ltd</p>
                      <div style={{ borderTop: '2px solid #000', width: '150px', paddingTop: '5px' }}>
                        <p style={{ fontWeight: '900', fontSize: '8.5px' }}>Authorised Signatory</p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Totals */}
                  <div>
                    <table style={{ marginLeft: 'auto', borderTop: '2px solid #000', fontSize: '10px', width: '100%' }}>
                      <tbody>
                        <tr>
                          <td style={{ paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px', textAlign: 'right', fontWeight: '800' }}>Subtotal</td>
                          <td style={{ fontWeight: '900', paddingLeft: '14px', width: '95px', textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                            {symbol}{fmt(q.subtotal)}
                          </td>
                        </tr>

                        {showGST && (
                          <>
                            <tr>
                              <td style={{ paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px', textAlign: 'right', fontWeight: '800' }}>
                                CGST @{q.cgstPercent || 9}%
                              </td>
                              <td style={{ fontWeight: '900', paddingLeft: '14px', textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                                {symbol}{fmt(q.cgstAmount)}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px', textAlign: 'right', fontWeight: '800' }}>
                                SGST @{q.sgstPercent || 9}%
                              </td>
                              <td style={{ fontWeight: '900', paddingLeft: '14px', textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                                {symbol}{fmt(q.sgstAmount)}
                              </td>
                            </tr>
                          </>
                        )}

                        {q.transportCharge > 0 && (
                          <tr>
                            <td style={{ paddingRight: '14px', paddingTop: '4px', paddingBottom: '4px', textAlign: 'right', fontWeight: '800' }}>
                              Transport Charge {q.transportChargePercent ? `@${q.transportChargePercent}%` : ''}
                            </td>
                            <td style={{ fontWeight: '900', paddingLeft: '14px', textAlign: 'right', paddingTop: '4px', paddingBottom: '4px' }}>
                              {symbol}{fmt(q.transportCharge)}
                            </td>
                          </tr>
                        )}

                        <tr style={{ borderTop: '2px solid #000' }}>
                          <td style={{ paddingRight: '14px', paddingTop: '6px', paddingBottom: '6px', fontSize: '11px', fontWeight: '900', textAlign: 'right' }}>
                            Total Amount ({q.currency})
                          </td>
                          <td style={{ fontSize: '13px', fontWeight: '900', paddingLeft: '14px', textAlign: 'right', paddingTop: '6px', paddingBottom: '6px' }}>
                            {symbol}{fmt(q.grandTotal)}
                          </td>
                        </tr>
                         <tr>
                          <td colSpan={2} style={{ 
                            paddingTop: '8px', 
                            paddingBottom: '4px', 
                            fontSize: '8.5px', 
                            fontWeight: '800',
                            textAlign: 'left',
                            fontStyle: 'italic',
                            color: '#1f2937',
                            borderTop: '1px solid #d1d5db'
                          }}>
                            <span style={{ fontWeight: '900' }}>Amount in Words:</span> {numberToWords(q.grandTotal)}
                          </td>
                        </tr>
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
}
