"use client"
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, Edit, Trash2, Plus, X, Copy, Search, Calendar, Filter, Eye } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { getAllRecords, deleteRecord } from "@/services/firebase"
import CreateInvoice from "./CreateInvoice"
import fas from "./fas.png"

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
}

// Professional Invoice Template - COMPLETE WITH ALL CONTENT VISIBLE
const FullInvoiceTemplate = ({ invoice }: { invoice: any }) => {
  const currency = invoice.currency || "INR"
  const symbol = CURRENCY_SYMBOLS[currency]

const numberToWords = (num: number): string => {
  if (currency !== "INR") return "";

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  // Round to 2 decimal places and work with integer part only
  const integerPart = Math.floor(num);
  
  if (integerPart === 0) return "Zero Rupees Only";

  let word = "";

  // Crore (10,000,000)
  let part = Math.floor(integerPart / 10000000);
  if (part > 0) {
    word += numberToWords(part).replace(" Rupees Only", "") + " Crore ";
    num = integerPart % 10000000;
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

  return word.trim() + " Rupees Only";

  // Helper function to convert two-digit numbers
  function convertTwoDigit(n: number): string {
    if (n < 10) return units[n];
    if (n >= 10 && n < 20) return teens[n - 10];
    return tens[Math.floor(n / 10)] + (n % 10 > 0 ? " " + units[n % 10] : "");
  }
};


  const formatAmount = (n: number) =>
    Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const formatAddress = (addr: any) => {
    if (!addr) return ""
    const lines = [
      addr.street || "",
      addr.area || "",
      addr.city ? `${addr.city}, ${addr.state} - ${addr.pincode}` : "",
      addr.country || "",
    ].filter(Boolean)
    return lines.join("\n")
  }

  const amountInWords = numberToWords(invoice.grandTotal || 0)
  const itemsTotal = invoice.lineItems?.reduce((s: number, i: any) => s + (i.taxableValue || 0), 0) || 0
  const transportCharge = Number(invoice.transportCharge || 0)
  const taxableAmount = invoice.taxableAmount || 0

  return (
    <div
      style={{
        width: "1122px",
        minHeight: "794px",
        background: "#ffffff",
        margin: "0 auto",
        padding: 0,
        fontFamily: "Arial, sans-serif",
        boxSizing: "border-box",
        overflow: "visible",
      }}
    >
      <div
        style={{
          border: "2px solid #000",
          margin: 0,
          padding: 0,
          background: "#ffffff",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            textAlign: "center",
            padding: "8px 12px",
            borderBottom: "2px solid #000",
            background: "#ffffff",
          }}
        >
          <img
            src={fas}
            alt="FAS"
            style={{ width: "50px", height: "auto", margin: "0 auto 4px", display: "block" }}
          />
          <h1
            style={{
              fontSize: "14px",
              fontWeight: 900,
              margin: "2px 0",
              color: "#000",
              letterSpacing: "0.5px",
            }}
          >
            Fluoro Automation Seals Pvt Ltd
          </h1>
          <p
            style={{ fontSize: "8px", margin: "1px 0", color: "#000", fontWeight: 600 }}
          >
            3/180, Rajiv Gandhi Road, Mettukuppam, Chennai Tamil Nadu 600097 India
          </p>
          <p
            style={{ fontSize: "8px", margin: "1px 0", color: "#000", fontWeight: 600 }}
          >
            Phone: 9841175097 | Email: fas@fluoroautomationseals.com
          </p>
        </div>

        {/* COMPANY DETAILS BAR */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            padding: "4px 12px",
            background: "#ffffff",
            borderBottom: "2px solid #000",
            fontSize: "8px",
            fontWeight: 700,
          }}
        >
          <div>GSTIN: 33AAECF2716M1ZO</div>
          <div>CIN: U25209TN2020PTC138498</div>
          <div>PAN: AAECF2716M</div>
        </div>

        {/* INVOICE TITLE */}
        <div
          style={{
            textAlign: "center",
            padding: "6px 0",
            borderBottom: "2px solid #000",
            background: "#ffffff",
          }}
        >
          <h2
            style={{
              fontSize: "13px",
              fontWeight: 900,
              margin: 0,
              letterSpacing: "1px",
            }}
          >
            INVOICE
          </h2>
        </div>

        {/* INVOICE DETAILS - Two column layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderBottom: "2px solid #000",
            background: "#ffffff",
          }}
        >
          {/* Left Column */}
          <div
            style={{
              borderRight: "2px solid #000",
              padding: "4px 8px",
              fontSize: "7.5px",
              background: "#ffffff",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      width: "55%",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 700,
                    }}
                  >
                    Invoice No:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 800,
                    }}
                  >
                    {invoice.invoiceNumber}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 700,
                    }}
                  >
                    Invoice Date:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 800,
                    }}
                  >
                    {invoice.invoiceDate ? format(new Date(invoice.invoiceDate), "dd-MM-yyyy") : ""}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 700,
                    }}
                  >
                    Tax Is Payable On Reverse Charge:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 800,
                    }}
                  >
                    No
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 700,
                    }}
                  >
                    Payment Terms:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 800,
                    }}
                  >
                    {invoice.paymentTerms || ""}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 700,
                    }}
                  >
                    Transporter Name:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 800,
                    }}
                  >
                    {invoice.transporterName || ""}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 700,
                    }}
                  >
                    E-Way Bill No:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 800,
                    }}
                  >
                    {invoice.eWayBillNo || ""}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      fontWeight: 700,
                    }}
                  >
                    E-Way Bill Date:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      fontWeight: 800,
                    }}
                  >
                    {invoice.eWayBillDate || ""}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right Column */}
          <div
            style={{
              padding: "4px 8px",
              fontSize: "7.5px",
              background: "#ffffff",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      width: "55%",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 700,
                    }}
                  >
                    Transportation Mode:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 800,
                    }}
                  >
                    {invoice.transportMode || ""}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 700,
                    }}
                  >
                    Vehicle No.:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 800,
                    }}
                  >
                    {invoice.vehicleNo || "NA"}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 700,
                    }}
                  >
                    Date & Time of Supply:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 800,
                    }}
                  >
                    {invoice.dateTimeOfSupply
                      ? format(new Date(invoice.dateTimeOfSupply), "dd-MM-yyyy HH:mm:ss")
                      : ""}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 700,
                    }}
                  >
                    Place of Supply:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 800,
                    }}
                  >
                    {invoice.placeOfSupply || ""}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 700,
                    }}
                  >
                    Customer PO No:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      borderBottom: "1px solid #dee2e6",
                      fontWeight: 800,
                    }}
                  >
                    {invoice.customerPO || ""}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      padding: "3px 4px",
                      fontWeight: 700,
                    }}
                  >
                    Customer PO Date:
                  </td>
                  <td
                    style={{
                      padding: "3px 4px",
                      fontWeight: 800,
                    }}
                  >
                    {invoice.customerPODate
                      ? format(new Date(invoice.customerPODate), "dd-MM-yyyy")
                      : ""}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Billed to / Shipped to */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderBottom: "2px solid #000",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              borderRight: "2px solid #000",
              padding: "6px 8px",
              fontSize: "7.5px",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                textAlign: "center",
                borderBottom: "1px solid #999",
                marginBottom: "4px",
                paddingBottom: "2px",
              }}
            >
              <strong style={{ fontSize: "8.5px", fontWeight: 800 }}>
                Details of Recipient (Billed to)
              </strong>
            </div>
            <p
              style={{
                fontWeight: 800,
                fontSize: "9px",
                margin: "3px 0",
                color: "#000",
              }}
            >
              {invoice.customerName}
            </p>
            <pre
              style={{
                fontFamily: "Arial, sans-serif",
                fontSize: "7.5px",
                whiteSpace: "pre-wrap",
                margin: "2px 0",
                fontWeight: 600,
                lineHeight: 1.3,
              }}
            >
              {formatAddress(invoice.billingAddress)}
            </pre>
            <p style={{ margin: "2px 0", fontWeight: 700 }}>
              <strong>State Code:</strong> {(invoice.customerGST || "").substring(0, 2)}
            </p>
            <p style={{ margin: "2px 0", fontWeight: 700 }}>
              <strong>GSTIN:</strong> {invoice.customerGST}
            </p>
          </div>

          <div
            style={{
              padding: "6px 8px",
              fontSize: "7.5px",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                textAlign: "center",
                borderBottom: "1px solid #999",
                marginBottom: "4px",
                paddingBottom: "2px",
              }}
            >
              <strong style={{ fontSize: "8.5px", fontWeight: 800 }}>
                Details of Consignee (Shipped to)
              </strong>
            </div>
            <p
              style={{
                fontWeight: 800,
                fontSize: "9px",
                margin: "3px 0",
                color: "#000",
              }}
            >
              {invoice.customerName}
            </p>
            <pre
              style={{
                fontFamily: "Arial, sans-serif",
                fontSize: "7.5px",
                whiteSpace: "pre-wrap",
                margin: "2px 0",
                fontWeight: 600,
                lineHeight: 1.3,
              }}
            >
              {formatAddress(invoice.shippingAddress)}
            </pre>
            <p style={{ margin: "2px 0", fontWeight: 700 }}>
              <strong>State Code:</strong> {(invoice.customerGST || "").substring(0, 2)}
            </p>
            <p style={{ margin: "2px 0", fontWeight: 700 }}>
              <strong>GSTIN:</strong> {invoice.customerGST}
            </p>
          </div>
        </div>

        {/* ITEMS TABLE - FIXED WITH WORD WRAP */}
        <div
          style={{
            padding: 0,
            background: "#ffffff",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "7px",
              background: "#ffffff",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: "3%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "4%" }} />
              <col style={{ width: "4%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "3%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "3%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "3%" }} />
              <col style={{ width: "6%" }} />
            </colgroup>
            <thead style={{ background: "#e5e7eb" }}>
              <tr>
                <th
                  rowSpan={2}
                  style={{
                    border: "1.5px solid #000",
                    padding: "4px 2px",
                    textAlign: "center",
                    fontWeight: 900,
                    fontSize: "7px",
                    lineHeight: 1.2,
                  }}
                >
                  S.No
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1.5px solid #000",
                    padding: "4px 3px",
                    fontWeight: 900,
                    fontSize: "7px",
                    lineHeight: 1.2,
                    textAlign: "left",
                  }}
                >
                  Part Code / Description
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1.5px solid #000",
                    padding: "4px 2px",
                    textAlign: "center",
                    fontWeight: 900,
                    fontSize: "7px",
                    lineHeight: 1.2,
                  }}
                >
                  HSN/SAC
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1.5px solid #000",
                    padding: "4px 2px",
                    textAlign: "center",
                    fontWeight: 900,
                    fontSize: "7px",
                    lineHeight: 1.2,
                  }}
                >
                  Qty
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1.5px solid #000",
                    padding: "4px 2px",
                    textAlign: "center",
                    fontWeight: 900,
                    fontSize: "7px",
                    lineHeight: 1.2,
                  }}
                >
                  UOM
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1.5px solid #000",
                    padding: "4px 3px",
                    textAlign: "right",
                    fontWeight: 900,
                    fontSize: "7px",
                    lineHeight: 1.2,
                  }}
                >
                  Rate
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1.5px solid #000",
                    padding: "4px 3px",
                    textAlign: "right",
                    fontWeight: 900,
                    fontSize: "7px",
                    lineHeight: 1.2,
                  }}
                >
                  Amount
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1.5px solid #000",
                    padding: "4px 3px",
                    textAlign: "right",
                    fontWeight: 900,
                    fontSize: "7px",
                    lineHeight: 1.2,
                  }}
                >
                  Disc
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1.5px solid #000",
                    padding: "4px 3px",
                    textAlign: "right",
                    fontWeight: 900,
                    fontSize: "7px",
                    lineHeight: 1.2,
                  }}
                >
                  Taxable Value
                </th>
                <th
                  colSpan={2}
                  style={{
                    border: "1.5px solid #000",
                    padding: "4px 2px",
                    textAlign: "center",
                    fontWeight: 900,
                    fontSize: "7px",
                    lineHeight: 1.2,
                  }}
                >
                  CGST
                </th>
                <th
                  colSpan={2}
                  style={{
                    border: "1.5px solid #000",
                    padding: "4px 2px",
                    textAlign: "center",
                    fontWeight: 900,
                    fontSize: "7px",
                    lineHeight: 1.2,
                  }}
                >
                  SGST/UTGST
                </th>
                <th
                  colSpan={2}
                  style={{
                    border: "1.5px solid #000",
                    padding: "4px 2px",
                    textAlign: "center",
                    fontWeight: 900,
                    fontSize: "7px",
                    lineHeight: 1.2,
                  }}
                >
                  IGST
                </th>
              </tr>
              <tr>
                <th
                  style={{
                    border: "1.5px solid #000",
                    padding: "3px 2px",
                    textAlign: "center",
                    fontWeight: 800,
                    fontSize: "6.5px",
                    lineHeight: 1.1,
                  }}
                >
                  %
                </th>
                <th
                  style={{
                    border: "1.5px solid #000",
                    padding: "3px 2px",
                    textAlign: "right",
                    fontWeight: 800,
                    fontSize: "6.5px",
                    lineHeight: 1.1,
                  }}
                >
                  Amt
                </th>
                <th
                  style={{
                    border: "1.5px solid #000",
                    padding: "3px 2px",
                    textAlign: "center",
                    fontWeight: 800,
                    fontSize: "6.5px",
                    lineHeight: 1.1,
                  }}
                >
                  %
                </th>
                <th
                  style={{
                    border: "1.5px solid #000",
                    padding: "3px 2px",
                    textAlign: "right",
                    fontWeight: 800,
                    fontSize: "6.5px",
                    lineHeight: 1.1,
                  }}
                >
                  Amt
                </th>
                <th
                  style={{
                    border: "1.5px solid #000",
                    padding: "3px 2px",
                    textAlign: "center",
                    fontWeight: 800,
                    fontSize: "6.5px",
                    lineHeight: 1.1,
                  }}
                >
                  %
                </th>
                <th
                  style={{
                    border: "1.5px solid #000",
                    padding: "3px 2px",
                    textAlign: "right",
                    fontWeight: 800,
                    fontSize: "6.5px",
                    lineHeight: 1.1,
                  }}
                >
                  Amt
                </th>
              </tr>
            </thead>
            <tbody>
              {(invoice.lineItems || []).map((item: any, i: number) => (
                <tr key={i} style={{ background: "#ffffff" }}>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 2px",
                      textAlign: "center",
                      fontWeight: 700,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {i + 1}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 3px",
                      fontSize: "6.5px",
                      lineHeight: 1.3,
                      verticalAlign: "top",
                      wordWrap: "break-word",
                      overflowWrap: "break-word",
                      whiteSpace: "normal",
                      maxWidth: "0",
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: "1px" }}>
                      {item.partCode || item.productCode}
                    </div>
                    <div
                      style={{
                        fontSize: "6px",
                        color: "#333",
                        fontWeight: 600,
                        lineHeight: 1.3,
                      }}
                    >
                      {item.description || item.productName}
                    </div>
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 2px",
                      textAlign: "center",
                      fontWeight: 700,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {item.hsnCode}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 2px",
                      textAlign: "center",
                      fontWeight: 800,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {item.qty || item.invoicedQty}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 2px",
                      textAlign: "center",
                      fontWeight: 700,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {item.uom || "NOS"}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 3px",
                      textAlign: "right",
                      fontWeight: 700,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {formatAmount(item.rate)}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 3px",
                      textAlign: "right",
                      fontWeight: 800,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {formatAmount(item.amount)}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 3px",
                      textAlign: "right",
                      fontWeight: 700,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {formatAmount(item.discount || 0)}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 3px",
                      textAlign: "right",
                      fontWeight: 900,
                      background: "#f9fafb",
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {formatAmount(item.taxableValue)}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 2px",
                      textAlign: "center",
                      fontWeight: 800,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {invoice.applyCGST && item.cgstPercent ? item.cgstPercent.toFixed(1) : "0.0"}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 3px",
                      textAlign: "right",
                      fontWeight: 800,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {formatAmount(item.cgstAmount || 0)}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 2px",
                      textAlign: "center",
                      fontWeight: 800,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {invoice.applySGST && item.sgstPercent ? item.sgstPercent.toFixed(1) : "0.0"}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 3px",
                      textAlign: "right",
                      fontWeight: 800,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {formatAmount(item.sgstAmount || 0)}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 2px",
                      textAlign: "center",
                      fontWeight: 800,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {invoice.applyIGST && item.igstPercent ? item.igstPercent.toFixed(1) : "0.0"}
                  </td>
                  <td
                    style={{
                      border: "1.5px solid #000",
                      padding: "4px 3px",
                      textAlign: "right",
                      fontWeight: 800,
                      fontSize: "7px",
                      verticalAlign: "top",
                    }}
                  >
                    {formatAmount(item.igstAmount || 0)}
                  </td>
                </tr>
              ))}

              {/* TOTAL ROW */}
              <tr style={{ fontWeight: 900, background: "#ffffff" }}>
                <td
                  colSpan={6}
                  style={{
                    border: "1.5px solid #000",
                    padding: "5px 4px",
                    textAlign: "right",
                    fontSize: "8px",
                  }}
                >
                  TOTAL
                </td>
                <td
                  style={{
                    border: "1.5px solid #000",
                    padding: "5px 4px",
                    textAlign: "right",
                    fontSize: "8px",
                  }}
                >
                  {formatAmount(
                    invoice.lineItems?.reduce((s: number, i: any) => s + (i.amount || 0), 0) || 0
                  )}
                </td>
                <td
                  style={{
                    border: "1.5px solid #000",
                    padding: "5px 4px",
                    textAlign: "right",
                    fontSize: "8px",
                  }}
                >
                  {formatAmount(
                    invoice.lineItems?.reduce((s: number, i: any) => s + (i.discount || 0), 0) || 0
                  )}
                </td>
                <td
                  style={{
                    border: "1.5px solid #000",
                    padding: "5px 4px",
                    textAlign: "right",
                    fontSize: "8px",
                  }}
                >
                  {formatAmount(
                    invoice.lineItems?.reduce(
                      (s: number, i: any) => s + (i.taxableValue || 0),
                      0
                    ) || 0
                  )}
                </td>
                <td
                  style={{
                    border: "1.5px solid #000",
                    padding: "5px 2px",
                  }}
                ></td>
                <td
                  style={{
                    border: "1.5px solid #000",
                    padding: "5px 4px",
                    textAlign: "right",
                    fontSize: "8px",
                  }}
                >
                  {formatAmount(
                    invoice.lineItems?.reduce(
                      (s: number, i: any) => s + (i.cgstAmount || 0),
                      0
                    ) || 0
                  )}
                </td>
                <td
                  style={{
                    border: "1.5px solid #000",
                    padding: "5px 2px",
                  }}
                ></td>
                <td
                  style={{
                    border: "1.5px solid #000",
                    padding: "5px 4px",
                    textAlign: "right",
                    fontSize: "8px",
                  }}
                >
                  {formatAmount(
                    invoice.lineItems?.reduce(
                      (s: number, i: any) => s + (i.sgstAmount || 0),
                      0
                    ) || 0
                  )}
                </td>
                <td
                  style={{
                    border: "1.5px solid #000",
                    padding: "5px 2px",
                  }}
                ></td>
                <td
                  style={{
                    border: "1.5px solid #000",
                    padding: "5px 4px",
                    textAlign: "right",
                    fontSize: "8px",
                  }}
                >
                  {formatAmount(
                    invoice.lineItems?.reduce(
                      (s: number, i: any) => s + (i.igstAmount || 0),
                      0
                    ) || 0
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SUMMARY SECTION */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderTop: "2px solid #000",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              borderRight: "2px solid #000",
              padding: "6px 8px",
              fontSize: "8px",
              fontWeight: 700,
            }}
          >
            <p style={{ margin: "2px 0" }}>
              <strong style={{ fontWeight: 900 }}>Items Total:</strong> {symbol}
              {formatAmount(itemsTotal)}
            </p>
            {transportCharge > 0 && (
              <p style={{ margin: "2px 0" }}>
                <strong style={{ fontWeight: 900 }}>Transport Charge:</strong> {symbol}
                {formatAmount(transportCharge)}
              </p>
            )}
            <p
              style={{
                margin: "2px 0",
                borderTop: "1px solid #ccc",
                paddingTop: "2px",
              }}
            >
              <strong style={{ fontWeight: 900 }}>Taxable Amount:</strong> {symbol}
              {formatAmount(taxableAmount + transportCharge)}
            </p>
            {invoice.applyCGST && invoice.cgstAmount > 0 && (
              <p style={{ margin: "2px 0", color: "#0066cc" }}>
                <strong style={{ fontWeight: 900 }}>CGST ({invoice.cgstPercent}%):</strong> {symbol}
                {formatAmount(invoice.cgstAmount)}
              </p>
            )}
            {invoice.applySGST && invoice.sgstAmount > 0 && (
              <p style={{ margin: "2px 0", color: "#0066cc" }}>
                <strong style={{ fontWeight: 900 }}>SGST ({invoice.sgstPercent}%):</strong> {symbol}
                {formatAmount(invoice.sgstAmount)}
              </p>
            )}
            {invoice.applyIGST && invoice.igstAmount > 0 && (
              <p style={{ margin: "2px 0", color: "#0066cc" }}>
                <strong style={{ fontWeight: 900 }}>IGST ({invoice.igstPercent}%):</strong> {symbol}
                {formatAmount(invoice.igstAmount)}
              </p>
            )}
            <p style={{ margin: "2px 0" }}>
              <strong style={{ fontWeight: 900 }}>Round Off:</strong> ₹0.00
            </p>
          </div>

          <div
            style={{
              padding: "6px 8px",
              fontSize: "8px",
              textAlign: "right",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                fontWeight: 900,
                margin: "2px 0",
                color: "#000",
              }}
            >
              Grand Total: {symbol}
              {formatAmount(invoice.grandTotal)}
            </p>
          </div>
        </div>

        {/* AMOUNT IN WORDS */}
        {currency === "INR" && (
          <div
            style={{
              borderTop: "2px solid #000",
              padding: "6px 8px",
              fontSize: "8px",
              fontWeight: 700,
              background: "#ffffff",
            }}
          >
            <strong style={{ fontWeight: 900 }}>Amount in Words:</strong> {amountInWords}
          </div>
        )}

        {/* E-WAY BILL */}
        {invoice.eWayBillNo && invoice.eWayBillDate && (
          <div
            style={{
              borderTop: "2px solid #000",
              padding: "6px 8px",
              fontSize: "8px",
              fontWeight: 700,
              background: "#ffffff",
            }}
          >
            <strong style={{ fontWeight: 900 }}>Electronic Reference Number (E-Way Bill):</strong>{" "}
            {invoice.eWayBillNo}
            {invoice.eWayBillDate && (
              <span style={{ marginLeft: "15px", fontWeight: 900 }}>
                <strong>Date:</strong> {format(new Date(invoice.eWayBillDate), "dd-MM-yyyy")}
              </span>
            )}
          </div>
        )}

        {/* REMARKS */}
        {invoice.remarks && (
          <div
            style={{
              borderTop: "2px solid #000",
              padding: "6px 8px",
              fontSize: "8px",
              fontWeight: 700,
              background: "#ffffff",
            }}
          >
            <strong style={{ fontWeight: 900 }}>Remarks:</strong> {invoice.remarks}
          </div>
        )}

        {/* TERMS & SIGNATURE */}
        <div
          style={{
            borderTop: "2px solid #000",
            padding: "8px 8px",
            fontSize: "7px",
            background: "#ffffff",
          }}
        >
          <p style={{ margin: "2px 0", fontWeight: 800 }}>
            <strong>TERM & CONDITION OF SALES</strong>
          </p>
          <p
            style={{
              margin: "12px 0 3px",
              textAlign: "center",
              fontSize: "8px",
              fontWeight: 700,
            }}
          >
            Certified that the Particulars given above are true and correct
          </p>
          <p
            style={{
              margin: "15px 0 3px",
              textAlign: "right",
              fontSize: "8px",
              fontWeight: 900,
            }}
          >
            For Fluoro Automation Seals Pvt Ltd
          </p>
          <div style={{ marginTop: "20px", textAlign: "right" }}>
            <p
              style={{
                fontSize: "8px",
                fontWeight: 900,
                borderTop: "1px solid #000",
                display: "inline-block",
                paddingTop: "3px",
                paddingRight: "40px",
              }}
            >
              Authorized Signatory
            </p>
          </div>

          <div style={{ marginTop: "6px" }}>
            <table style={{ width: "100%", fontSize: "7px" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "2px", fontWeight: 700 }}>Name:</td>
                  <td style={{ padding: "2px", fontWeight: 700 }}>Designation:</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// Modal Preview with Download
const InvoicePreviewModal = ({ invoice, onClose }: { invoice: any; onClose: () => void }) => {
  const printRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    if (!printRef.current) return

    setIsDownloading(true)
    try {
      const element = printRef.current
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: 1122,
        height: element.scrollHeight,
        windowWidth: 1122,
      })

      const imgData = canvas.toDataURL("image/png")
      const imgWidth = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width

   const pdf = new jsPDF({
  orientation: imgHeight > imgWidth ? "portrait" : "landscape",
  unit: "mm",
  format: "a4",
});


      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight)
      } else {
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight)
      }

      pdf.save(`Invoice_${invoice.invoiceNumber}.pdf`)
      toast.success("Invoice downloaded successfully!")
    } catch (err) {
      console.error("PDF generation error:", err)
      toast.error("Failed to download PDF")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] max-h-[95vh] overflow-y-auto p-4">
        <DialogHeader>
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-xl font-bold text-blue-900">
              Invoice Preview - {invoice.invoiceNumber}
            </DialogTitle>
            <Button
              className="bg-green-600 hover:bg-green-700 shadow-lg"
              onClick={handleDownload}
              disabled={isDownloading}
              size="lg"
            >
              <Download className="h-5 w-5 mr-2" />
              {isDownloading ? "Generating..." : "Download PDF"}
            </Button>
          </div>
        </DialogHeader>

        <div
          ref={printRef}
          className="bg-white rounded-lg overflow-visible shadow-xl"
          style={{ maxWidth: "1122px", margin: "0 auto" }}
        >
          <FullInvoiceTemplate invoice={invoice} />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose} size="lg">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const generateYearOptions = () => {
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = currentYear - 5; y <= currentYear + 1; y++) {
    years.push(y)
  }
  return years.sort((a, b) => b - a)
}

const monthOptions = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
]

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>("")
  const navigate = useNavigate()

  useEffect(() => {
    const loadData = async () => {
      try {
        const [invoiceData, customerData] = await Promise.all([
          getAllRecords("sales/invoices"),
          getAllRecords("sales/customers"),
        ])

        const sortedInvoices = (invoiceData as any[]).sort(
          (a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)
        )
        setInvoices(sortedInvoices)
        setFilteredInvoices(sortedInvoices)

        const sortedCustomers = (customerData as any[]).sort((a: any, b: any) =>
          a.companyName.localeCompare(b.companyName)
        )
        setCustomers(sortedCustomers)
      } catch (err) {
        toast.error("Failed to load data")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    let result = [...invoices]

    if (selectedCustomerId !== "all") {
      result = result.filter((inv: any) => inv.customerId === selectedCustomerId)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((inv: any) => {
        const invoiceNumber = (inv.invoiceNumber || "").toLowerCase()
        const customerName = (inv.customerName || "").toLowerCase()
        return invoiceNumber.startsWith(query) || customerName.startsWith(query)
      })
    }

    if (selectedDate) {
      result = result.filter((inv: any) => {
        const invDate = new Date(inv.invoiceDate).toISOString().split("T")[0]
        return invDate === selectedDate
      })
    }

    setFilteredInvoices(result)
  }, [selectedCustomerId, searchQuery, invoices, selectedDate])

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this invoice permanently?")) return

    try {
      await deleteRecord("sales/invoices", id)
      toast.success("Invoice deleted")
      setInvoices((prev) => prev.filter((inv) => inv.id !== id))
      setFilteredInvoices((prev) => prev.filter((inv) => inv.id !== id))
    } catch (err) {
      toast.error("Delete failed")
    }
  }

  const handleDuplicate = (id: string) => {
    navigate(`/sales/invoices/edit/${id}?duplicate=true`)
    toast.info("Duplicating invoice - a new invoice number will be generated.")
  }

  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice)
  }

  const clearSearch = () => {
    setSearchQuery("")
  }

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedCustomerId("all")
    setSelectedDate("")
  }

  const hasActiveFilters = searchQuery || selectedCustomerId !== "all" || selectedDate
  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0)

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">GST Invoices</h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""} · Total: ₹
              {totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
          </div>
          <Button onClick={() => navigate("/sales/invoices/create")}>
            <Plus className="h-5 w-5 mr-2" />
            Create New Invoice
          </Button>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list">All Invoices</TabsTrigger>
            <TabsTrigger value="create">Create / Edit</TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            <Card className="mb-6">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">Filters</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 items-end flex-wrap">
                  <div className="relative flex-1 min-w-[280px]">
                    <Label className="text-sm font-medium mb-2 block">Search</Label>
                    <Search className="absolute left-3 top-10 h-5 w-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search by invoice number or customer name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    {searchQuery && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-3 top-10 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="relative w-[200px]">
                    <Label className="text-sm font-medium mb-2 block">Date</Label>
                    <Calendar className="absolute left-3 top-10 h-5 w-5 text-gray-400" />
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    {selectedDate && (
                      <button
                        onClick={() => setSelectedDate("")}
                        className="absolute right-3 top-10 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="w-[220px]">
                    <Label className="text-sm font-medium mb-2 block">Customer</Label>
                    <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Customers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        {customers.map((cust) => (
                          <SelectItem key={cust.id} value={cust.id}>
                            {cust.companyName} ({cust.customerCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {hasActiveFilters && (
                  <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Clear All Filters
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {hasActiveFilters && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 font-medium">
                  Found {filteredInvoices.length} result{filteredInvoices.length !== 1 ? "s" : ""}
                  {searchQuery && ` matching "${searchQuery}"`}
                  {selectedCustomerId !== "all" &&
                    ` for ${customers.find((c) => c.id === selectedCustomerId)?.companyName}`}
                  {selectedDate && ` on ${format(new Date(selectedDate), "dd-MM-yyyy")}`}
                </p>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>All Generated Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center py-8">Loading invoices...</p>
                ) : filteredInvoices.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {hasActiveFilters ? (
                      <>
                        <p className="text-lg font-medium mb-2">No invoices found</p>
                        <p className="text-sm mb-4">No results match your current filters.</p>
                        <Button variant="outline" onClick={clearFilters}>
                          Clear All Filters
                        </Button>
                      </>
                    ) : (
                      <p>No invoices generated yet. Click "Create New Invoice" to get started.</p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice No</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-mono font-semibold">
                              {inv.invoiceNumber}
                            </TableCell>
                            <TableCell>{format(new Date(inv.invoiceDate), "dd-MM-yyyy")}</TableCell>
                            <TableCell>{inv.customerName}</TableCell>
                            <TableCell className="font-medium">
                              ₹{Number(inv.grandTotal || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                                Generated
                              </span>
                            </TableCell>
                            <TableCell className="space-x-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewInvoice(inv)}
                                title="View"
                              >
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDuplicate(inv.id)}
                                title="Duplicate"
                              >
                                <Copy className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/sales/invoices/edit/${inv.id}`)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(inv.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <CreateInvoice />
          </TabsContent>
        </Tabs>

        {selectedInvoice && (
          <InvoicePreviewModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
        )}
      </div>
    </div>
  )
}
