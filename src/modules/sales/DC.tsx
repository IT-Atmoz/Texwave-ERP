// src/modules/sales/DC.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Edit,
  Download,
  Search,
  RefreshCw,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Customer } from "@/types";
import {
  createRecord,
  getAllRecords,
  getRecordById,
  updateRecord,
  deleteRecord,
} from "@/services/firebase";
import html2pdf from "html2pdf.js";
import fas from "./fas.png"; // Logo

// ---------------------- TYPES ----------------------

interface Address {
  id?: string;
  label?: string;
  street: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  type?: "billing" | "shipping";
  isDefault?: boolean;
}

interface DCLineItem {
  id: string;
  productId?: string;
  productCode?: string;
  description: string;
  hsnCode: string;
  qty: number | string;
  uom?: string;
}

interface DeliveryChallan {
  id?: string;
  dcNumber: string;
  dcDate: string;
  customerId: string | null;
  customerName: string;
  customerGST?: string;
  billingAddress?: Address | null;
  lineItems: DCLineItem[];
  totalQty: number;
  totalAmount: number;
  terms: string;
  remarks: string;
  createdAt?: number;
  updatedAt?: number;
}

// NEW: Flattened product item interface
interface FlatProductItem {
  id: string; // unique identifier
  productCode: string;
  category: string;
  group: string;
  hsn: string;
  stockQty: number;
  type: string;
  unit: string;
  unitPrice: number;
  parentName: string; // parent product name
  parentId: string; // parent product id
}

// ---------------------- PRINT TEMPLATE (WHITE BACKGROUND) ----------------------

const formatAddress = (addr?: Address | null) => {
  if (!addr) return "—";
  return `${addr.street}${addr.area ? `, ${addr.area}` : ""}\n${addr.city}, ${addr.state} - ${addr.pincode}\n${addr.country}`;
};

const DCPrintTemplate: React.FC<{ dc: DeliveryChallan }> = ({ dc }) => {
  return (
    <div className="bg-white text-black text-xs leading-tight font-sans">
      <div className="border-4 border-black">
        {/* WHITE HEADER */}
        <div className="bg-white text-black pt-8 pb-6 px-6 text-center border-b-4 border-black">
          <img
            src={fas}
            alt="FAS Logo"
            crossOrigin="anonymous"
            className="w-44 h-20 mx-auto mb-3"
          />
          <h1 className="text-2xl font-bold mt-1 text-black">
            Fluoro Automation Seals Pvt Ltd
          </h1>
          <p className="text-sm mt-2 leading-tight text-black">
            3/180, Rajiv Gandhi Road, Mettukuppam, Chennai Tamil Nadu 600097 India
          </p>
          <p className="text-sm leading-tight text-black">
            Phone: +91-841175097 | Email: fas@fluoroautomationseals.com
          </p>
        </div>

        <div className="flex justify-between bg-gray-100 p-3 border-b-2 border-black text-xs font-bold">
          <div>GSTIN: 33AAECF2716M1ZO</div>
          <div>PAN: AAECF2716M</div>
          <div>CIN: U25209TN2020PTC138498</div>
        </div>

        {/* Body */}
        <div className="p-8">
          <h2 className="text-center text-2xl font-bold mb-6">
            Delivery Challan
          </h2>

          <div className="grid grid-cols-2 gap-10 text-xs mb-6">
            {/* Bill To */}
            <div className="space-y-2">
              <p className="font-bold text-lg underline">Bill To:</p>
              <p className="font-bold text-base mt-1">
                {dc.customerName || "—"}
              </p>
              <p className="mt-1 whitespace-pre-line leading-tight">
                {formatAddress(dc.billingAddress || null)}
              </p>
              <p className="mt-2">
                <span className="font-semibold">GSTIN:</span>{" "}
                {dc.customerGST || "—"}
              </p>
            </div>

            {/* DC Details */}
            <div className="text-right">
              <table className="inline-table text-xs">
                <tbody>
                  <tr>
                    <td className="pr-6 font-medium">DC Number:</td>
                    <td className="font-bold text-lg">{dc.dcNumber}</td>
                  </tr>
                  <tr>
                    <td className="pr-6 font-medium">Date:</td>
                    <td>{dc.dcDate || "—"}</td>
                  </tr>
                  <tr>
                    <td className="pr-6 font-medium">Total Quantity:</td>
                    <td>{dc.totalQty}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Items table */}
          <table className="w-full border-2 border-black text-xs table-fixed mt-6">
            <thead className="bg-gray-200">
              <tr>
                <th className="border border-black p-2 w-10 text-center">Sl.</th>
                <th className="border border-black p-2 w-24 text-center">HSN Code</th>
                <th className="border border-black p-2 w-52 text-left">Description</th>
                <th className="border border-black p-2 w-20 text-center">UOM</th>
                <th className="border border-black p-2 w-20 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {dc.lineItems.map((item, index) => (
                <tr key={item.id || index}>
                  <td className="border border-black p-2 text-center">{index + 1}</td>
                  <td className="border border-black p-2 text-center">{item.hsnCode || "—"}</td>
                  <td className="border border-black p-2">
                    {item.description || "—"}
                    {item.productCode && (
                      <div className="text-[10px] text-gray-600 mt-1">Code: {item.productCode}</div>
                    )}
                  </td>
                  <td className="border border-black p-2 text-center">{item.uom || "Nos"}</td>
                  <td className="border border-black p-2 text-right">{item.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mt-4">
            <table className="border-t-2 border-black">
              <tbody>
                <tr>
                  <td className="pr-8 py-1 text-right font-medium">Total Quantity</td>
                  <td className="font-bold pl-6 w-32 text-right">{dc.totalQty}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Remarks / Terms */}
          <div className="mt-8 border-t-2 border-black pt-4 text-xs">
            <p className="mb-2">
              <span className="font-semibold">Remarks:</span> {dc.remarks || "—"}
            </p>
            <p className="mt-2 font-semibold mb-1">Terms & Conditions:</p>
            <p className="whitespace-pre-line">
              {dc.terms || "Goods sent for approval / job work / delivery."}
            </p>
          </div>

          {/* Signature */}
          <div className="mt-16">
            <div className="flex justify-between items-end">
              <div />
              <div className="text-center">
                <p className="font-bold mb-8">For Fluoro Automation Seals Pvt Ltd</p>
                <div className="border-t-2 border-black w-64 mx-auto pt-4">
                  <p className="font-medium text-sm">Authorised Signatory</p>
                </div>
              </div>
            </div>
            <p className="mt-8 text-[10px] text-gray-600 text-center">
              This is a system-generated Delivery Challan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------- PREVIEW MODAL ----------------------

const DCPreviewModal = ({ dc, onClose }: { dc: DeliveryChallan; onClose: () => void }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!printRef.current || downloading) return;
    setDownloading(true);

    try {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `${dc.dcNumber}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
      };

      await html2pdf().set(opt).from(printRef.current).save();
      toast.success(`Downloaded: ${dc.dcNumber}.pdf`);
    } catch (err) {
      console.error("PDF Error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-900">
            Delivery Challan Preview - {dc.dcNumber}
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
          <DCPrintTemplate dc={dc} />
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button 
            className="bg-green-600 hover:bg-green-700" 
            onClick={handleDownload}
            disabled={downloading}
          >
            <Download className="h-4 w-4 mr-2" /> 
            {downloading ? "Downloading..." : "Download PDF"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------- MAIN COMPONENT ----------------------

export default function DC() {
  const [tab, setTab] = useState<"list" | "create">("list");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [flatProducts, setFlatProducts] = useState<FlatProductItem[]>([]);
  const [deliveryChallans, setDeliveryChallans] = useState<DeliveryChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Preview modal state
  const [previewDC, setPreviewDC] = useState<DeliveryChallan | null>(null);

  // Critical state for PDF printing
  const [dcForPrint, setDcForPrint] = useState<DeliveryChallan | null>(null);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedBillingAddress, setSelectedBillingAddress] = useState<Address | null>(null);

  const [form, setForm] = useState({
    dcNumber: `DCFAS25-${String(Date.now()).slice(-5)}`,
    dcDate: new Date().toISOString().split("T")[0],
    terms: "",
    remarks: "",
  });

  const [lineItems, setLineItems] = useState<DCLineItem[]>([
    {
      id: crypto.randomUUID(),
      productId: undefined,
      productCode: "",
      description: "",
      hsnCode: "",
      qty: 1,
      uom: "",
    },
  ]);

  const printRef = useRef<HTMLDivElement>(null);

  // NEW: Flatten products from Firebase structure
  const flattenProducts = (productsData: any[]): FlatProductItem[] => {
    const flattened: FlatProductItem[] = [];
    
    productsData.forEach((product: any) => {
      if (product.items && Array.isArray(product.items)) {
        product.items.forEach((item: any, index: number) => {
          if (item.productCode) {
            flattened.push({
              id: `${product.id}-${index}`,
              productCode: item.productCode,
              category: item.category || "",
              group: item.group || "",
              hsn: item.hsn || "",
              stockQty: item.stockQty || 0,
              type: item.type || "",
              unit: item.unit || "Nos",
              unitPrice: item.unitPrice || 0,
              parentName: product.name || "",
              parentId: product.id || "",
            });
          }
        });
      }
    });
    
    return flattened;
  };

  // Load data
  useEffect(() => {
    const load = async () => {
      try {
        const [cust, prod, dcs] = await Promise.all([
          getAllRecords("sales/customers"),
          getAllRecords("sales/products"),
          getAllRecords("sales/deliveryChallans"),
        ]);
        
        setCustomers(cust as Customer[]);
        
        // Flatten products
        const flattenedProducts = flattenProducts(prod || []);
        setFlatProducts(flattenedProducts);
        console.log("Flattened products:", flattenedProducts);
        
        setDeliveryChallans((dcs || []).map((d: any) => ({ ...(d as DeliveryChallan) })));
      } catch (e) {
        console.error("Load error:", e);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Compute totals
  const computeTotals = () => {
    const totalQty = lineItems.reduce((sum, li) => sum + (Number(li.qty) || 0), 0);
    const totalAmount = 0;
    return { totalQty, totalAmount };
  };

  const { totalQty } = computeTotals();

  // Current preview DC
  const dcPreview: DeliveryChallan = {
    id: editingId || undefined,
    dcNumber: form.dcNumber,
    dcDate: form.dcDate,
    customerId: selectedCustomer?.id || null,
    customerName: selectedCustomer?.companyName || "",
    customerGST: (selectedCustomer as any)?.gst || "",
    billingAddress: selectedBillingAddress || undefined,
    lineItems,
    totalQty,
    totalAmount: 0,
    terms: form.terms,
    remarks: form.remarks,
  };

  // FINAL WORKING PDF DOWNLOAD
  const handleDownloadPDF = useCallback((dc: DeliveryChallan) => {
    if (isPreparingPdf) return;
    setIsPreparingPdf(true);
    setDcForPrint(dc);

    const generatePdf = () => {
      if (!printRef.current) {
        toast.error("Print area not ready");
        setIsPreparingPdf(false);
        return;
      }

      const opt = {
        margin: [8, 8, 8, 8],
        filename: `${dc.dcNumber}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
      };

      html2pdf()
        .set(opt)
        .from(printRef.current)
        .save()
        .then(() => {
          toast.success(`Downloaded: ${dc.dcNumber}.pdf`);
        })
        .catch((err) => {
          console.error("PDF Error:", err);
          toast.error("Failed to generate PDF");
        })
        .finally(() => {
          setDcForPrint(null);
          setIsPreparingPdf(false);
        });
    };

    // Give React time to render the new DC
    requestAnimationFrame(() => {
      setTimeout(generatePdf, 600);
    });
  }, [isPreparingPdf]);

  // Reset form
  const resetForm = () => {
    setEditingId(null);
    setForm({
      dcNumber: `DCFAS25-${String(Date.now()).slice(-5)}`,
      dcDate: new Date().toISOString().split("T")[0],
      terms: "",
      remarks: "",
    });
    setSelectedCustomer(null);
    setSelectedBillingAddress(null);
    setLineItems([
      {
        id: crypto.randomUUID(),
        productId: undefined,
        productCode: "",
        description: "",
        hsnCode: "",
        qty: 1,
        uom: "",
      },
    ]);
    setDcForPrint(null);
  };

  // Customer change
  const handleCustomerChange = (id: string) => {
    const cust = customers.find((c) => c.id === id) || null;
    setSelectedCustomer(cust);
    const billing = cust?.addresses?.find((a: any) => a.type === "billing" && a.isDefault) ||
      cust?.addresses?.find((a: any) => a.type === "billing") || null;
    setSelectedBillingAddress(billing as Address);
  };

  // Line items
  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: undefined,
        productCode: "",
        description: "",
        hsnCode: "",
        qty: 1,
        uom: "",
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const updateLineItem = (id: string, field: keyof DCLineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.id !== id) return li;
        const updated: DCLineItem = { ...li, [field]: value };
        
        // NEW: Handle product selection from flattened products
        if (field === "productCode") {
          const prod = flatProducts.find((p) => p.productCode === value);
          if (prod) {
            updated.productId = prod.id;
            updated.description = `${prod.category} - ${prod.parentName}`;
            updated.hsnCode = prod.hsn;
            updated.uom = prod.unit;
          }
        }
        
        if (field === "qty") updated.qty = value === '' ? '' : Number(value);
        return updated;
      })
    );
  };

  // Save
  const handleSave = async () => {
    if (!selectedCustomer) return toast.error("Select a customer");
    if (lineItems.length === 0) return toast.error("Add at least one item");
    if (lineItems.some((li) => !li.description || !li.hsnCode || !li.qty || Number(li.qty) <= 0))
      return toast.error("Complete all line items");

    const payload: DeliveryChallan = {
      ...dcPreview,
      customerId: selectedCustomer.id!,
      customerName: selectedCustomer.companyName,
      customerGST: (selectedCustomer as any)?.gst || "",
      billingAddress: selectedBillingAddress || undefined,
      lineItems,
      totalQty,
      totalAmount: 0,
      updatedAt: Date.now(),
      ...(editingId ? {} : { createdAt: Date.now() }),
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateRecord("sales/deliveryChallans", editingId, payload);
        toast.success("DC Updated");
      } else {
        const ref = await createRecord("sales/deliveryChallans", payload);
        payload.id = ref.id;
        toast.success("DC Created");
      }
      const fresh = await getAllRecords("sales/deliveryChallans");
      setDeliveryChallans((fresh || []).map((d: any) => ({ ...(d as DeliveryChallan) })));
      setTab("list");
      resetForm();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Edit
  const handleEdit = async (id: string) => {
    try {
      const data: any = await getRecordById("sales/deliveryChallans", id);
      if (!data) return toast.error("DC not found");

      setEditingId(id);
      setForm({
        dcNumber: data.dcNumber,
        dcDate: data.dcDate,
        terms: data.terms || "",
        remarks: data.remarks || "",
      });

      const cust = customers.find((c) => c.id === data.customerId) || null;
      setSelectedCustomer(cust);
      setSelectedBillingAddress(data.billingAddress || null);

      setLineItems(
        (data.lineItems || []).map((li: any) => ({
          ...li,
          id: crypto.randomUUID(),
        }))
      );

      setTab("create");
    } catch {
      toast.error("Failed to load DC");
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this Delivery Challan permanently?")) return;
    try {
      await deleteRecord("sales/deliveryChallans", id);
      setDeliveryChallans((prev) => prev.filter((d) => d.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  // View DC
  const handleView = (dc: DeliveryChallan) => {
    setPreviewDC(dc);
  };

  // Filtered list
  const filteredDCs = deliveryChallans.filter((dc) => {
    const q = search.toLowerCase();
    return !q || dc.dcNumber.toLowerCase().includes(q) || (dc.customerName || "").toLowerCase().includes(q);
  });

  if (loading) {
    return <div className="p-10 text-center text-lg">Loading Delivery Challans…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-blue-900">Delivery Challan</h1>
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="create">
                {editingId ? "Edit DC" : "Create DC"}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* LIST TAB */}
          <TabsContent value="list">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Delivery Challans</CardTitle>
                <div className="flex gap-2 items-center">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
                    <Input
                      className="pl-8 w-64"
                      placeholder="Search DC or Customer"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      const dcs = await getAllRecords("sales/deliveryChallans");
                      setDeliveryChallans((dcs || []).map((d: any) => ({ ...(d as DeliveryChallan) })));
                      toast.success("Refreshed");
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => { resetForm(); setTab("create"); }}>
                    <Plus className="h-4 w-4 mr-2" /> New DC
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredDCs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No Delivery Challans found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border px-3 py-2 text-left">DC No</th>
                          <th className="border px-3 py-2 text-left">Date</th>
                          <th className="border px-3 py-2 text-left">Customer</th>
                          <th className="border px-3 py-2 text-right">Qty</th>
                          <th className="border px-3 py-2 text-right">Amount</th>
                          <th className="border px-3 py-2 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDCs.map((dc) => (
                          <tr key={dc.id}>
                            <td className="border px-3 py-2">{dc.dcNumber}</td>
                            <td className="border px-3 py-2">{dc.dcDate}</td>
                            <td className="border px-3 py-2">{dc.customerName}</td>
                            <td className="border px-3 py-2 text-right">{dc.totalQty}</td>
                            <td className="border px-3 py-2 text-right">₹{dc.totalAmount.toFixed(2)}</td>
                            <td className="border px-3 py-2 text-center">
                              <div className="flex justify-center gap-1">
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  onClick={() => handleView(dc)}
                                  title="View DC"
                                >
                                  <Eye className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => handleEdit(dc.id!)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => handleDelete(dc.id!)}>
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CREATE / EDIT TAB */}
          <TabsContent value="create">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* LEFT: FORM */}
              <div className="space-y-6">
                {/* DC Details */}
                <Card>
                  <CardHeader><CardTitle>DC Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>DC Number</Label>
                      <Input value={form.dcNumber} onChange={(e) => setForm(p => ({ ...p, dcNumber: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={form.dcDate} onChange={(e) => setForm(p => ({ ...p, dcDate: e.target.value }))} />
                    </div>
                  </CardContent>
                </Card>

                {/* Customer */}
                <Card>
                  <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <Select value={selectedCustomer?.id || ""} onValueChange={handleCustomerChange}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id!}>
                            {c.companyName} ({(c as any).customerCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedCustomer && (
                      <Select value={selectedBillingAddress?.id || ""} onValueChange={(val) => {
                        const addr = (selectedCustomer as any).addresses?.find((a: any) => a.id === val);
                        setSelectedBillingAddress(addr || null);
                      }}>
                        <SelectTrigger><SelectValue placeholder="Billing Address" /></SelectTrigger>
                        <SelectContent>
                          {(selectedCustomer as any).addresses
                            ?.filter((a: any) => a.type === "billing")
                            .map((a: any) => (
                              <SelectItem key={a.id} value={a.id}>{a.label} - {a.city}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  </CardContent>
                </Card>

                {/* Line Items */}
                <Card>
                  <CardHeader className="flex justify-between items-center">
                    <CardTitle>Items</CardTitle>
                    <Button size="sm" onClick={addLineItem}><Plus className="h-4 w-4 mr-2" />Add Row</Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {lineItems.map((li, i) => (
                      <div key={li.id} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-gray-50">
                        <div className="flex justify-between mb-3">
                          <span className="font-semibold">Item {i + 1}</span>
                          {lineItems.length > 1 && (
                            <Button size="icon" variant="ghost" onClick={() => removeLineItem(li.id)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 mb-3">
                          <div>
                            <Label>Product Code</Label>
                            <Select value={li.productCode || ""} onValueChange={(v) => updateLineItem(li.id, "productCode", v)}>
                              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                              <SelectContent>
                                {flatProducts.map((p) => (
                                  <SelectItem key={p.id} value={p.productCode}>
                                    {p.productCode} - {p.category} ({p.parentName})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Description</Label>
                            <Textarea rows={2} value={li.description} onChange={(e) => updateLineItem(li.id, "description", e.target.value)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div><Label>HSN</Label><Input value={li.hsnCode} onChange={(e) => updateLineItem(li.id, "hsnCode", e.target.value)} /></div>
                          <div><Label>UOM</Label><Input value={li.uom || ""} onChange={(e) => updateLineItem(li.id, "uom", e.target.value)} /></div>
                          <div><Label>Qty</Label><Input type="number" value={li.qty} onChange={(e) => updateLineItem(li.id, "qty", e.target.value)} /></div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Remarks & Save */}
                <Card>
                  <CardHeader><CardTitle>Remarks & Terms</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div><Label>Remarks</Label><Textarea rows={2} value={form.remarks} onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))} /></div>
                    <div><Label>Terms</Label><Textarea rows={3} value={form.terms} onChange={(e) => setForm(p => ({ ...p, terms: e.target.value }))} /></div>
                    <div className="flex justify-between items-center pt-4">
                      <div className="font-semibold">Total Qty: {totalQty}</div>
                      <div className="flex gap-3">
                        <Button variant="outline" onClick={resetForm} disabled={saving}>Reset</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
                          {saving ? "Saving..." : editingId ? "Update DC" : "Save DC"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT: LIVE PREVIEW + PDF BUTTON */}
              <div className="sticky top-4">
                <div className="bg-white rounded-lg shadow-2xl border overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-4 text-center font-bold text-lg">
                    Live Preview - A4
                    <div className="text-sm mt-1">
                      DC: {dcPreview.dcNumber} | {dcPreview.dcDate}
                    </div>
                  </div>

                  {/* This is the print container */}
                  <div ref={printRef} className="bg-white p-4">
                    <DCPrintTemplate dc={dcForPrint || dcPreview} />
                  </div>

                  <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleDownloadPDF(dcPreview)}
                      disabled={isPreparingPdf}
                    >
                      {isPreparingPdf ? "Preparing..." : <><Download className="h-4 w-4 mr-2" /> Download PDF</>}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview Modal */}
        {previewDC && (
          <DCPreviewModal
            dc={previewDC}
            onClose={() => setPreviewDC(null)}
          />
        )}
      </div>
    </div>
  );
}
