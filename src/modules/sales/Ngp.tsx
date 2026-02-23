// src/modules/sales/NRGP.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
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
import fas from "./fas.png"; // Your company logo

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

interface NRGPLineItem {
  id: string;
  productId?: string;
  productCode?: string;
  description: string;
  qty: number | string;
  uom?: string;
}

interface NonReturnableGatePass {
  id?: string;
  nrgpNumber: string;
  nrgpDate: string;
  customerId: string | null;
  customerName: string;
  customerGST?: string;
  billingAddress?: Address | null;
  kindAttn?: string;
  phoneNumber?: string;
  lineItems: NRGPLineItem[];
  totalQty: number;
  itemValue?: number; // optional, in Rs
  remarks?: string;
  createdAt?: number;
  updatedAt?: number;
}

// NEW: Flattened product item interface
interface FlatProductItem {
  id: string;
  productCode: string;
  category: string;
  group: string;
  hsn: string;
  stockQty: number;
  type: string;
  unit: string;
  unitPrice: number;
  parentName: string;
  parentId: string;
}

// ---------------------- PRINT TEMPLATE (WHITE BACKGROUND) ----------------------

const formatAddress = (addr?: Address | null) => {
  if (!addr) return "—";
  return `${addr.street}${addr.area ? `, ${addr.area}` : ""}\n${addr.city}, ${addr.state} - ${addr.pincode}\n${addr.country}`;
};

const NRGPPrintTemplate: React.FC<{ nrgp: NonReturnableGatePass }> = ({ nrgp }) => {
  return (
    <div className="bg-white text-black text-xs leading-tight font-sans">
      <div className="border-4 border-black p-4">
        {/* WHITE Header */}
        <div className="bg-white text-center mb-4 pb-4 border-b-2 border-black">
          <img
            src={fas}
            alt="FAS Logo"
            crossOrigin="anonymous"
            className="w-44 h-20 mx-auto mb-3"
          />
          <h1 className="text-xl font-bold text-black">FLUORO AUTOMATION SEALS PRIVATE LIMITED</h1>
          <p className="text-sm mt-1 text-black">
            Door No 3/824, Survey No 164/1, Pillaiyar Koil Street, Mettukuppam,<br />
            Chennai, Tamil Nadu - 600097
          </p>
          <p className="text-sm text-black">
            Ph: +91-98411 75097 | +91-72997 87879 &nbsp; Email: fas@fluoroautomationseals.com
          </p>
          <p className="text-sm font-bold mt-2 text-black">GST No: 33AAECF2716M1ZO</p>
        </div>

        {/* Title */}
        <div className="text-center border-b-2 border-black pb-2 mb-4">
          <div className="font-bold text-lg">NON-RETURNABLE GATE PASS</div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          <div>
            <p><strong>NO.NRGP</strong> {nrgp.nrgpNumber}</p>
            <p><strong>DATE:</strong> {nrgp.nrgpDate}</p>
            <p className="mt-2">
              <strong>M/s.</strong> {nrgp.customerName || "—"}
            </p>
            <p className="whitespace-pre-line leading-tight">
              {formatAddress(nrgp.billingAddress || null)}
            </p>
            <p className="mt-2">
              <strong>GSTIN:</strong> {nrgp.customerGST || "—"}
            </p>
          </div>

          <div className="text-right">
            <p><strong>Kind Atten:</strong> {nrgp.kindAttn || "—"}</p>
            <p><strong>Ph No:</strong> {nrgp.phoneNumber || "—"}</p>
          </div>
        </div>

        {/* Table */}
        <table className="w-full border-2 border-black text-xs">
          <thead className="bg-gray-200">
            <tr>
              <th className="border border-black p-2 w-12 text-center">Sl. No.</th>
              <th className="border border-black p-2 text-center">PARTICULARS</th>
              <th className="border border-black p-2 w-24 text-center">QTY</th>
            </tr>
          </thead>
          <tbody>
            {nrgp.lineItems.map((item, index) => (
              <tr key={item.id}>
                <td className="border border-black p-2 text-center">{index + 1}</td>
                <td className="border border-black p-2">
                  {item.description || "—"}
                  {item.productCode && (
                    <div className="text-[10px] text-gray-600 mt-1">Code: {item.productCode}</div>
                  )}
                </td>
                <td className="border border-black p-2 text-center">{item.qty} {item.uom || "Nos"}</td>
              </tr>
            ))}
            {nrgp.lineItems.length === 0 && (
              <tr>
                <td colSpan={3} className="border border-black p-4 text-center">No items added</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-6 text-xs">
          <div className="flex justify-between items-start border-t-2 border-black pt-4">
            <div>
              <p className="font-semibold">[We are sending the following items for sample Approval only.]</p>
              <p className="font-semibold">[NOT FOR SALE]</p>
              <p className="mt-2">
                <strong>ITEM VALUE: Rs. {nrgp.itemValue?.toLocaleString() || "—"}</strong>
              </p>
            </div>
            <div className="text-center">
              <p className="font-bold mt-12">For Fluoro Automation Seals Pvt Ltd</p>
              <div className="border-t-2 border-black w-64 mx-auto mt-8 pt-2">
                <p className="font-medium">Authorised Signatory</p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="font-semibold">Receiver's Signature</p>
          </div>

          <p className="mt-8 text-[10px] text-gray-600 text-center">
            This is a system-generated Non-Returnable Gate Pass.
          </p>
        </div>
      </div>
    </div>
  );
};

// ---------------------- PREVIEW MODAL ----------------------

const NRGPPreviewModal = ({ nrgp, onClose }: { nrgp: NonReturnableGatePass; onClose: () => void }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!printRef.current || downloading) return;
    setDownloading(true);

    try {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `${nrgp.nrgpNumber}.pdf`,
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
      toast.success(`Downloaded: ${nrgp.nrgpNumber}.pdf`);
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
            NRGP Preview - {nrgp.nrgpNumber}
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
          <NRGPPrintTemplate nrgp={nrgp} />
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

export default function NRGP() {
  const [tab, setTab] = useState<"list" | "create">("list");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [flatProducts, setFlatProducts] = useState<FlatProductItem[]>([]);
  const [nrgps, setNRGPs] = useState<NonReturnableGatePass[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Preview modal state
  const [previewNRGP, setPreviewNRGP] = useState<NonReturnableGatePass | null>(null);

  const [nrgpForPrint, setNrgpForPrint] = useState<NonReturnableGatePass | null>(null);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedBillingAddress, setSelectedBillingAddress] = useState<Address | null>(null);

  const [form, setForm] = useState({
    nrgpNumber: `NRGP25-${String(Date.now()).slice(-5)}`,
    nrgpDate: new Date().toISOString().split("T")[0],
    kindAttn: "",
    phoneNumber: "",
    phoneCountryCode: "IN",
    itemValue: "",
    remarks: "",
  });

  const [lineItems, setLineItems] = useState<NRGPLineItem[]>([
    {
      id: crypto.randomUUID(),
      productId: undefined,
      productCode: "",
      description: "",
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
        const [cust, prod, nrgpData] = await Promise.all([
          getAllRecords("sales/customers"),
          getAllRecords("sales/products"),
          getAllRecords("sales/nrgp"),
        ]);
        
        setCustomers(cust as Customer[]);
        
        // Flatten products
        const flattenedProducts = flattenProducts(prod || []);
        setFlatProducts(flattenedProducts);
        console.log("Flattened products:", flattenedProducts);
        
        setNRGPs((nrgpData || []).map((d: any) => ({ ...(d as NonReturnableGatePass) })));
      } catch (e) {
        console.error("Load error:", e);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const computeTotals = () => {
    const totalQty = lineItems.reduce((sum, li) => sum + (Number(li.qty) || 0), 0);
    return { totalQty };
  };

  const { totalQty } = computeTotals();

  const nrgpPreview: NonReturnableGatePass = {
    id: editingId || undefined,
    nrgpNumber: form.nrgpNumber,
    nrgpDate: form.nrgpDate,
    customerId: selectedCustomer?.id || null,
    customerName: selectedCustomer?.companyName || "",
    customerGST: (selectedCustomer as any)?.gst || "",
    billingAddress: selectedBillingAddress || undefined,
    kindAttn: form.kindAttn,
    phoneNumber: form.phoneNumber,
    lineItems,
    totalQty,
    itemValue: form.itemValue ? Number(form.itemValue) : undefined,
    remarks: form.remarks,
  };

  const handleDownloadPDF = useCallback((nrgp: NonReturnableGatePass) => {
    if (isPreparingPdf) return;
    setIsPreparingPdf(true);
    setNrgpForPrint(nrgp);

    const generatePdf = () => {
      if (!printRef.current) {
        toast.error("Print area not ready");
        setIsPreparingPdf(false);
        return;
      }

      const opt = {
        margin: [8, 8, 8, 8],
        filename: `${nrgp.nrgpNumber}.pdf`,
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
          toast.success(`Downloaded: ${nrgp.nrgpNumber}.pdf`);
        })
        .catch((err) => {
          console.error("PDF Error:", err);
          toast.error("Failed to generate PDF");
        })
        .finally(() => {
          setNrgpForPrint(null);
          setIsPreparingPdf(false);
        });
    };

    requestAnimationFrame(() => {
      setTimeout(generatePdf, 600);
    });
  }, [isPreparingPdf]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      nrgpNumber: `NRGP25-${String(Date.now()).slice(-5)}`,
      nrgpDate: new Date().toISOString().split("T")[0],
      kindAttn: "",
      phoneNumber: "",
      phoneCountryCode: "IN",
      itemValue: "",
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
        qty: 1,
        uom: "",
      },
    ]);
  };

  const handleCustomerChange = (id: string) => {
    const cust = customers.find((c) => c.id === id) || null;
    setSelectedCustomer(cust);
    const billing = cust?.addresses?.find((a: any) => a.type === "billing" && a.isDefault) ||
      cust?.addresses?.find((a: any) => a.type === "billing") || null;
    setSelectedBillingAddress(billing as Address);
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: undefined,
        productCode: "",
        description: "",
        qty: 1,
        uom: "",
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const updateLineItem = (id: string, field: keyof NRGPLineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.id !== id) return li;
        const updated: NRGPLineItem = { ...li, [field]: value };
        
        // NEW: Handle product selection from flattened products
        if (field === "productCode") {
          const prod = flatProducts.find((p) => p.productCode === value);
          if (prod) {
            updated.productId = prod.id;
            updated.description = `${prod.category} - ${prod.parentName}`;
            updated.uom = prod.unit;
          }
        }
        
        if (field === "qty") updated.qty = value === '' ? '' : Number(value);
        return updated;
      })
    );
  };

  const handleSave = async () => {
    if (!selectedCustomer) return toast.error("Select a customer");
    if (lineItems.length === 0) return toast.error("Add at least one item");
    if (lineItems.some((li) => !li.description || !li.qty || Number(li.qty) <= 0))
      return toast.error("Complete all line items");

    const payload: NonReturnableGatePass = {
      ...nrgpPreview,
      customerId: selectedCustomer.id!,
      customerName: selectedCustomer.companyName,
      customerGST: (selectedCustomer as any)?.gst || "",
      billingAddress: selectedBillingAddress || undefined,
      lineItems,
      totalQty,
      itemValue: form.itemValue ? Number(form.itemValue) : undefined,
      updatedAt: Date.now(),
      ...(editingId ? {} : { createdAt: Date.now() }),
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateRecord("sales/nrgp", editingId, payload);
        toast.success("NRGP Updated");
      } else {
        const ref = await createRecord("sales/nrgp", payload);
        payload.id = ref.id;
        toast.success("NRGP Created");
      }
      const fresh = await getAllRecords("sales/nrgp");
      setNRGPs((fresh || []).map((d: any) => ({ ...(d as NonReturnableGatePass) })));
      setTab("list");
      resetForm();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id: string) => {
    try {
      const data: any = await getRecordById("sales/nrgp", id);
      if (!data) return toast.error("NRGP not found");

      setEditingId(id);
      setForm({
        nrgpNumber: data.nrgpNumber,
        nrgpDate: data.nrgpDate,
        kindAttn: data.kindAttn || "",
        phoneNumber: data.phoneNumber || "",
        phoneCountryCode: data.phoneCountryCode || "IN",
        itemValue: data.itemValue || "",
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
      toast.error("Failed to load NRGP");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this NRGP permanently?")) return;
    try {
      await deleteRecord("sales/nrgp", id);
      setNRGPs((prev) => prev.filter((d) => d.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  // View NRGP
  const handleView = (nrgp: NonReturnableGatePass) => {
    setPreviewNRGP(nrgp);
  };

  const filteredNRGPs = nrgps.filter((nrgp) => {
    const q = search.toLowerCase();
    return !q || nrgp.nrgpNumber.toLowerCase().includes(q) || (nrgp.customerName || "").toLowerCase().includes(q);
  });

  if (loading) {
    return <div className="p-10 text-center text-lg">Loading Non-Returnable Gate Passes…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-blue-900">Non-Returnable Gate Pass</h1>
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="create">
                {editingId ? "Edit NRGP" : "Create NRGP"}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* LIST TAB */}
          <TabsContent value="list">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Non-Returnable Gate Passes</CardTitle>
                <div className="flex gap-2 items-center">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
                    <Input
                      className="pl-8 w-64"
                      placeholder="Search NRGP or Customer"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      const fresh = await getAllRecords("sales/nrgp");
                      setNRGPs((fresh || []).map((d: any) => ({ ...(d as NonReturnableGatePass) })));
                      toast.success("Refreshed");
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => { resetForm(); setTab("create"); }}>
                    <Plus className="h-4 w-4 mr-2" /> New NRGP
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredNRGPs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No NRGPs found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border px-3 py-2 text-left">NRGP No</th>
                          <th className="border px-3 py-2 text-left">Date</th>
                          <th className="border px-3 py-2 text-left">Customer</th>
                          <th className="border px-3 py-2 text-right">Qty</th>
                          <th className="border px-3 py-2 text-right">Value (₹)</th>
                          <th className="border px-3 py-2 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredNRGPs.map((nrgp) => (
                          <tr key={nrgp.id}>
                            <td className="border px-3 py-2">{nrgp.nrgpNumber}</td>
                            <td className="border px-3 py-2">{nrgp.nrgpDate}</td>
                            <td className="border px-3 py-2">{nrgp.customerName}</td>
                            <td className="border px-3 py-2 text-right">{nrgp.totalQty}</td>
                            <td className="border px-3 py-2 text-right">
                              {nrgp.itemValue ? `₹${nrgp.itemValue.toLocaleString()}` : "—"}
                            </td>
                            <td className="border px-3 py-2 text-center">
                              <div className="flex justify-center gap-1">
                                <Button 
                                  size="icon" 
                                  variant="outline" 
                                  onClick={() => handleView(nrgp)}
                                  title="View NRGP"
                                >
                                  <Eye className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => handleEdit(nrgp.id!)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="outline" onClick={() => handleDelete(nrgp.id!)}>
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
                {/* NRGP Details */}
                <Card>
                  <CardHeader><CardTitle>NRGP Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>NRGP Number</Label>
                      <Input value={form.nrgpNumber} onChange={(e) => setForm(p => ({ ...p, nrgpNumber: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={form.nrgpDate} onChange={(e) => setForm(p => ({ ...p, nrgpDate: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Kind Attention</Label>
                      <Input value={form.kindAttn} onChange={(e) => setForm(p => ({ ...p, kindAttn: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Phone Number</Label>
                      <PhoneInput
                        countryCode={form.phoneCountryCode || 'IN'}
                        phone={form.phoneNumber}
                        onCountryCodeChange={(v) => setForm(p => ({ ...p, phoneCountryCode: v }))}
                        onPhoneChange={(v) => setForm(p => ({ ...p, phoneNumber: v }))}
                      />
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
                        <div className="grid grid-cols-2 gap-4">
                          <div><Label>UOM</Label><Input value={li.uom || ""} onChange={(e) => updateLineItem(li.id, "uom", e.target.value)} /></div>
                          <div><Label>Qty</Label><Input type="number" value={li.qty} onChange={(e) => updateLineItem(li.id, "qty", e.target.value)} /></div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Value & Remarks */}
                <Card>
                  <CardHeader><CardTitle>Value & Remarks</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Item Value (₹)</Label>
                      <Input
                        type="number"
                        value={form.itemValue}
                        onChange={(e) => setForm(p => ({ ...p, itemValue: e.target.value }))}
                        placeholder="Enter total value in Rs (optional)"
                      />
                    </div>
                    <div>
                      <Label>Remarks</Label>
                      <Textarea rows={2} value={form.remarks} onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))} />
                    </div>
                    <div className="flex justify-between items-center pt-4">
                      <div className="font-semibold">Total Qty: {totalQty}</div>
                      <div className="flex gap-3">
                        <Button variant="outline" onClick={resetForm} disabled={saving}>Reset</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
                          {saving ? "Saving..." : editingId ? "Update NRGP" : "Save NRGP"}
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
                      NRGP: {nrgpPreview.nrgpNumber} | {nrgpPreview.nrgpDate}
                    </div>
                  </div>

                  <div ref={printRef} className="bg-white p-4">
                    <NRGPPrintTemplate nrgp={nrgpForPrint || nrgpPreview} />
                  </div>

                  <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleDownloadPDF(nrgpPreview)}
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
        {previewNRGP && (
          <NRGPPreviewModal
            nrgp={previewNRGP}
            onClose={() => setPreviewNRGP(null)}
          />
        )}
      </div>
    </div>
  );
}
