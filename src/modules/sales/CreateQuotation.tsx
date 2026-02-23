// modules/sales/CreateQuotation.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import QuotationPrintTemplate from '@/components/QuotationPrintTemplate';
import {
  Plus,
  Trash2,
  Download,
  ArrowLeft,
  Ruler,
  UserPlus,
  Edit,
  Copy,
  Check,
  Globe,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Customer, Product } from '@/types';
import {
  createRecord,
  getAllRecords,
  getRecordById,
  updateRecord,
} from '@/services/firebase';
import html2pdf from 'html2pdf.js';
import { nanoid } from 'nanoid';

// Exchange rates (1 foreign currency unit = X INR) — Dec 2025
const EXCHANGE_RATES: Record<string, number> = {
  INR: 1,
  USD: 85.50,
  EUR: 92.00,
  GBP: 108.00,
  AED: 23.30,
};

const indianStates = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh"
];

const currencies = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
];

interface Address {
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

interface LineItem {
  sNo: number;
  productCode: string;
  sku?: string | null;
  productDescription: string;
  hsnCode: string;
  uom: string;
  qty: number;
  unitRate: number;
  amount: number;
  discount: number;
  netAmount: number;
  size?: string;
}

interface CustomerData {
  id?: string;
  customerCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  currency: string;
  gst?: string;
  pan?: string;
  cin?: string;
  addresses: Address[];
  branches?: Branch[];
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
}

interface ProductItem {
  productCode: string;
  category: string;
  group: string;
  type: string;
  hsn: string;
  unit: string;
  unitPrice: number;
  stockQty: number;
  size?: {
    height?: number;
    heightUnit?: string;
    width?: number;
    widthUnit?: string;
    length?: number;
    lengthUnit?: string;
    weight?: number;
    weightUnit?: string;
  };
}

interface ProductGroup {
  id: string;
  name: string;
  items: ProductItem[];
  createdAt: number;
}

const initialAddressForm = {
  type: 'billing' as const,
  label: 'Head Office',
  street: '',
  area: '',
  city: '',
  state: 'Tamil Nadu',
  pincode: '',
  country: 'India',
  isDefault: true,
};

// Helper to format to 2 decimal places
const fmt = (num: number) => Number(num || 0).toFixed(2);

export default function CreateQuotation() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const isEditMode = !!id;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<ProductGroup[]>([]);
  const [flattenedProducts, setFlattenedProducts] = useState<Array<ProductItem & { parentName: string; parentId: string }>>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedBillingAddress, setSelectedBillingAddress] = useState<Address | null>(null);
  const [selectedShippingAddress, setSelectedShippingAddress] = useState<Address | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeGST, setIncludeGST] = useState(true);
  const [isWalkInMode, setIsWalkInMode] = useState(false);
  const [walkInCustomerName, setWalkInCustomerName] = useState('');
  const [transportChargePercent, setTransportChargePercent] = useState<number | string>('');
  const [cgstPercent, setCgstPercent] = useState<number | string>(9);
  const [sgstPercent, setSgstPercent] = useState<number | string>(9);
  const [dispatchModes, setDispatchModes] = useState<string[]>([]);
  const [deliveryTerms, setDeliveryTerms] = useState<string[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<string[]>([]);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerCode, setCustomerCode] = useState('CUST-0000');
  const [copied, setCopied] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Omit<CustomerData, 'id'>>({
    customerCode: '',
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    currency: 'INR',
    gst: '',
    pan: '',
    cin: '',
    addresses: [],
    branches: [],
  });
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState(initialAddressForm);
  const [formData, setFormData] = useState({
    quoteNumber: `SQFY25-${String(Date.now()).slice(-5)}`,
    quoteDate: new Date().toISOString().split('T')[0],
    validity: '30 Days',
    paymentTerms: '',
    modeOfDispatch: '',
    deliveryTerm: '',
    remarks: '',
    comments: '',
    yourRef: '',
    ourRef: '',
    verNo: '',
    verDate: '',
  });

  const currentCurrency = isWalkInMode ? 'INR' : ((selectedCustomer as any)?.currency || 'INR');
  const currencySymbol = currencies.find(c => c.code === currentCurrency)?.symbol || '₹';

  const convertPriceToCurrency = (inrPrice: number): number => {
    if (currentCurrency === 'INR') return inrPrice;
    const rate = EXCHANGE_RATES[currentCurrency];
    return Number((inrPrice / rate).toFixed(2));
  };

  const digitsOnly = (val: string) => val.replace(/\D/g, '');
  const limit = (val: string, max: number) => val.slice(0, max);
  const toUpper = (val: string) => val.toUpperCase();
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (id && customers.length > 0) {
      loadQuotationForEdit();
    }
  }, [id, customers]);

  const loadInitialData = async () => {
    try {
      const [cust, prod, salesMaster] = await Promise.all([
        getAllRecords('sales/customers'),
        getAllRecords('sales/products'),
        getRecordById('masters', 'sales'),
      ]);

      setCustomers(cust as Customer[]);
      setProducts(prod as ProductGroup[]);

      const flattened: Array<ProductItem & { parentName: string; parentId: string }> = [];
      (prod as ProductGroup[]).forEach(productGroup => {
        if (productGroup.items && Array.isArray(productGroup.items)) {
          productGroup.items.forEach(item => {
            flattened.push({
              ...item,
              parentName: productGroup.name,
              parentId: productGroup.id,
            });
          });
        }
      });
      setFlattenedProducts(flattened);

      const masters = salesMaster as any;
      setDispatchModes(masters.dispatchModes || []);
      setDeliveryTerms(masters.deliveryTerms || []);
      setPaymentTerms(masters.paymentTerms || []);

      if (masters.dispatchModes?.length > 0) {
        setFormData(prev => ({ ...prev, modeOfDispatch: masters.dispatchModes[0] }));
      }
      if (masters.deliveryTerms?.length > 0) {
        setFormData(prev => ({ ...prev, deliveryTerm: masters.deliveryTerms[0] }));
      }
      if (masters.paymentTerms?.length > 0) {
        setFormData(prev => ({ ...prev, paymentTerms: masters.paymentTerms[0] }));
      }
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadQuotationForEdit = async () => {
    if (!id) return;
    try {
      const q = await getRecordById('sales/quotations', id) as any;
      if (!q) throw new Error('Not found');

      setIsWalkInMode(q.isWalkIn || false);
      setWalkInCustomerName(q.walkInCustomerName || '');
      setIncludeGST(q.includeGST ?? true);
      setTransportChargePercent(q.transportChargePercent ?? '');
      setCgstPercent(q.cgstPercent || 9);
      setSgstPercent(q.sgstPercent || 9);

      setFormData({
        quoteNumber: q.quoteNumber || formData.quoteNumber,
        quoteDate: q.quoteDate || formData.quoteDate,
        validity: q.validity || '30 Days',
        paymentTerms: q.paymentTerms || '',
        modeOfDispatch: q.modeOfDispatch || '',
        deliveryTerm: q.deliveryTerm || '',
        remarks: q.remarks || '',
        comments: q.comments || '',
        yourRef: q.yourRef || '',
        ourRef: q.ourRef || '',
        verNo: q.verNo || '',
        verDate: q.verDate || '',
      });

      if (!q.isWalkIn && q.customerId) {
        let customer = customers.find(c => c.id === q.customerId);
        if (!customer) {
          const fetched = await getRecordById('sales/customers', q.customerId);
          if (fetched) {
            customer = fetched as Customer;
            setCustomers(prev => [...prev, customer!]);
          }
        }
        setSelectedCustomer(customer || null);
        setSelectedBillingAddress(q.billingAddress || null);
        setSelectedShippingAddress(q.shippingAddress || null);
        if (q.selectedBranch) {
          setSelectedBranch(q.selectedBranch);
        }
      }

      setLineItems(
        q.lineItems?.map((item: any, i: number) => ({
          sNo: i + 1,
          productCode: item.productCode || item.sku || '',
          sku: item.sku || null,
          productDescription: item.productDescription || '',
          hsnCode: item.hsnCode || '',
          uom: item.uom || 'Nos',
          qty: Number(item.qty || 1),
          unitRate: Number(item.unitRate || 0),
          amount: Number(item.qty || 1) * Number(item.unitRate || 0),
          discount: Number(item.discount || 0),
          netAmount: Number(item.netAmount || 0),
          size: item.size || '',
        })) || []
      );
    } catch (err) {
      toast.error('Failed to load quotation');
      navigate('/sales/quotations');
    }
  };

  const generateCustomerCode = async () => {
    try {
      const all = await getAllRecords('sales/customers');
      const codes = (all as any[])
        .map(c => c.customerCode)
        .filter(c => typeof c === 'string' && c.startsWith('CUST-'))
        .map(c => parseInt(c.split('-')[1] || '0', 10));
      const next = (Math.max(...codes, 0) + 1).toString().padStart(4, '0');
      const code = `CUST-${next}`;
      setCustomerCode(code);
      setNewCustomer(prev => ({ ...prev, customerCode: code }));
    } catch {
      const code = `CUST-${Date.now().toString().slice(-4)}`;
      setCustomerCode(code);
      setNewCustomer(prev => ({ ...prev, customerCode: code }));
    }
  };

  const openNewCustomerDialog = () => {
    generateCustomerCode();
    setNewCustomer({
      customerCode: '',
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      currency: 'INR',
      gst: '',
      pan: '',
      cin: '',
      addresses: [],
      branches: [],
    });
    setCustomerDialogOpen(true);
  };

  const openAddressDialog = (addr?: Address, type?: 'billing' | 'shipping') => {
    if (addr) {
      setEditingAddress(addr);
      setAddressForm({ ...addr });
    } else {
      setEditingAddress(null);
      setAddressForm({ ...initialAddressForm, type: type || 'billing' });
    }
    setAddressDialogOpen(true);
  };

  const saveAddress = () => {
    if (!addressForm.street.trim()) return toast.error('Street is required');
    if (!addressForm.city.trim()) return toast.error('City is required');
    if (addressForm.pincode.length !== 6) return toast.error('Pincode must be 6 digits');

    let updated = [...newCustomer.addresses];
    const currentId = editingAddress?.id || nanoid();

    if (editingAddress) {
      updated = updated.map(a =>
        a.id === editingAddress.id ? { ...addressForm, id: a.id } : a
      );
    } else {
      updated.push({ ...addressForm, id: currentId });
    }

    if (addressForm.isDefault) {
      updated = updated.map(a => ({
        ...a,
        isDefault: a.type === addressForm.type && a.id === currentId,
      }));
    }

    setNewCustomer(prev => ({ ...prev, addresses: updated }));
    setAddressDialogOpen(false);
    setAddressForm(initialAddressForm);
    toast.success('Address saved');
  };

  const deleteAddress = (id: string) => {
    const addr = newCustomer.addresses.find(a => a.id === id);
    if (!addr) return;
    if (newCustomer.addresses.filter(a => a.type === addr.type).length === 1) {
      return toast.error(`At least one ${addr.type} address required`);
    }
    setNewCustomer(prev => ({ ...prev, addresses: prev.addresses.filter(a => a.id !== id) }));
  };

  const saveNewCustomer = async () => {
    if (!newCustomer.companyName.trim()) return toast.error('Company Name required');
    if (!newCustomer.contactPerson.trim()) return toast.error('Contact Person required');
    if (!newCustomer.email.trim() || !validateEmail(newCustomer.email)) return toast.error('Valid email required');
    if (newCustomer.phone.length !== 10) return toast.error('Phone must be 10 digits');
    if (newCustomer.addresses.filter(a => a.type === 'billing').length === 0) return toast.error('Add at least one Billing Address');
    if (newCustomer.addresses.filter(a => a.type === 'shipping').length === 0) return toast.error('Add at least one Shipping Address');

    try {
      const docRef = await createRecord('sales/customers', {
        ...newCustomer,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const created = { ...newCustomer, id: docRef.id };
      setCustomers(prev => [...prev, created as Customer]);
      setSelectedCustomer(created as Customer);

      const defaultBilling =
        created.addresses.find(a => a.type === 'billing' && a.isDefault) ||
        created.addresses.find(a => a.type === 'billing');
      const defaultShipping =
        created.addresses.find(a => a.type === 'shipping' && a.isDefault) ||
        created.addresses.find(a => a.type === 'shipping');

      setSelectedBillingAddress(defaultBilling || null);
      setSelectedShippingAddress(defaultShipping || null);
      setIsWalkInMode(false);

      toast.success('Customer created & selected');
      setCustomerDialogOpen(false);
    } catch {
      toast.error('Failed to create customer');
    }
  };

  const handleCustomerChange = (custId: string) => {
    const cust = customers.find(c => c.id === custId);
    setSelectedCustomer(cust || null);
    setSelectedBranch(null);

    if (cust) {
      const billing =
        cust.addresses?.find(a => a.type === 'billing' && a.isDefault) ||
        cust.addresses?.find(a => a.type === 'billing');
      const shipping =
        cust.addresses?.find(a => a.type === 'shipping' && a.isDefault) ||
        cust.addresses?.find(a => a.type === 'shipping');

      setSelectedBillingAddress(billing || null);
      setSelectedShippingAddress(shipping || null);

      const custBranches = (cust as any).branches as Branch[];
      const headOffice = custBranches?.find((b: Branch) => b.isHeadOffice);
      if (headOffice) {
        setSelectedBranch(headOffice);
      }

      setLineItems(prev =>
        prev.map(item => {
          const prod = flattenedProducts.find(p => p.productCode === item.productCode);
          if (prod && prod.unitPrice) {
            const convertedRate = convertPriceToCurrency(prod.unitPrice);
            const amount = Number(item.qty || 0) * convertedRate;
            const netAmount = amount * (1 - Number(item.discount || 0) / 100);
            return {
              ...item,
              unitRate: convertedRate,
              amount,
              netAmount,
            };
          }
          return item;
        })
      );
    }
  };

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        sNo: prev.length + 1,
        productCode: '',
        sku: null,
        productDescription: '',
        hsnCode: '',
        uom: 'Nos',
        qty: 1,
        unitRate: 0,
        amount: 0,
        discount: 0,
        netAmount: 0,
        size: '',
      },
    ]);
  };

  const formatSize = (size: any) => {
    if (!size) return '';
    const parts: string[] = [];
    if (size.height) parts.push(`${size.height}${size.heightUnit || 'mm'}`);
    if (size.width) parts.push(`${size.width}${size.widthUnit || 'mm'}`);
    if (size.length) parts.push(`${size.length}${size.lengthUnit || 'mm'}`);
    if (size.weight) parts.push(`${size.weight}${size.weightUnit || 'g'}`);
    return parts.length ? parts.join(' × ') : '';
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'productCode') {
        const prod = flattenedProducts.find(p => p.productCode === value);
        if (prod) {
          const inrPrice = prod.unitPrice || 0;
          const convertedRate = convertPriceToCurrency(inrPrice);
          updated[index].productDescription = `${prod.parentName} - ${prod.category} ${prod.group}`;
          updated[index].unitRate = convertedRate;
          updated[index].uom = prod.unit || 'Nos';
          updated[index].hsnCode = prod.hsn || '';
          updated[index].size = formatSize(prod.size) || '';
          updated[index].sku = null;
        } else {
          updated[index].sku = null;
          updated[index].size = '';
          updated[index].unitRate = 0;
        }
      }

      const item = updated[index];
      item.amount = Number(item.qty || 0) * Number(item.unitRate || 0);
      item.netAmount = item.amount * (1 - Number(item.discount || 0) / 100);

      return updated;
    });
  };

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index).map((it, idx) => ({ ...it, sNo: idx + 1 })));
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, i) => sum + i.netAmount, 0);
    const cgst =
      includeGST && currentCurrency === 'INR'
        ? subtotal * (Number(cgstPercent || 0) / 100)
        : 0;
    const sgst =
      includeGST && currentCurrency === 'INR'
        ? subtotal * (Number(sgstPercent || 0) / 100)
        : 0;
    const transportCharge = subtotal * (Number(transportChargePercent || 0) / 100);
    const total = subtotal + cgst + sgst + transportCharge;

    return { subtotal, cgst, sgst, transportCharge, total };
  };

  const { subtotal, cgst, sgst, transportCharge, total } = calculateTotals();

  const quotationData = {
    ...formData,
    customerName: isWalkInMode ? walkInCustomerName || 'Walk-in Customer' : selectedCustomer?.companyName || '',
    customerGST: isWalkInMode ? '' : selectedCustomer?.gst || '',
    customerPAN: isWalkInMode ? '' : selectedCustomer?.pan || '',
    customerCIN: isWalkInMode ? '' : selectedCustomer?.cin || '',
    currency: currentCurrency,
    currencySymbol,
    billingAddress: selectedBillingAddress,
    shippingAddress: selectedShippingAddress,
    selectedBranch: selectedBranch,
    lineItems,
    subtotal,
    cgstAmount: includeGST && currentCurrency === 'INR' ? cgst : 0,
    sgstAmount: includeGST && currentCurrency === 'INR' ? sgst : 0,
    transportCharge,
    cgstPercent: Number(cgstPercent || 0),
    sgstPercent: Number(sgstPercent || 0),
    transportChargePercent: Number(transportChargePercent || 0),
    grandTotal: total,
    includeGST: includeGST && currentCurrency === 'INR',
    isWalkIn: isWalkInMode,
    customerId: isWalkInMode ? null : selectedCustomer?.id,
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    const element = printRef.current;
    const opt = {
      margin: 0,
      filename: `${quotationData.quoteNumber}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 3, useCORS: true, letterRendering: true, ignoreElements: (el: any) => el.classList?.contains('no-print') },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    };
    html2pdf().set(opt).from(element).save();
  };

  const handleSave = async () => {
    if (lineItems.length === 0 || lineItems.some(i => !i.productCode)) {
      toast.error('Complete all line items');
      return;
    }
    if (!isWalkInMode && !selectedCustomer) {
      toast.error('Select a customer or enable Walk-in');
      return;
    }
    if (isWalkInMode && !walkInCustomerName.trim()) {
      toast.error('Enter Customer Name for Walk-in');
      return;
    }

    const saveData: any = {
      ...quotationData,
      lineItems: lineItems.map(({ sNo, ...rest }) => rest),
      billingAddress: selectedBillingAddress,
      shippingAddress: selectedShippingAddress,
      selectedBranch: selectedBranch,
      transportChargePercent,
      cgstPercent,
      sgstPercent,
      updatedAt: Date.now(),
      ...(!isEditMode && { createdAt: Date.now(), status: 'Draft' }),
    };

    if (isWalkInMode) {
      saveData.walkInCustomerName = walkInCustomerName.trim();
    }

    try {
      if (isEditMode) {
        await updateRecord('sales/quotations', id!, saveData);
        toast.success('Quotation updated!');
      } else {
        await createRecord('sales/quotations', saveData);
        toast.success('Quotation created!');
      }
      navigate('/sales/quotations');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  const customerBranches = selectedCustomer ? ((selectedCustomer as any).branches as Branch[]) : [];

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      {/* Hide number input arrows */}
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-900">
            {isEditMode ? 'Edit Quotation' : 'Create Quotation'}
          </h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/sales/quotations')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="secondary" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={handleSave} className="bg-blue-700 hover:bg-blue-800">
              {isEditMode ? 'Update' : 'Save'} Quotation
            </Button>
          </div>
        </div>

        {/* Form Section - Top */}
        <div className="space-y-6 mb-8">
          {/* Walk-in Mode */}
          <Card className="border-2 border-dashed border-blue-400 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="walkin"
                  checked={isWalkInMode}
                  onCheckedChange={(c) => {
                    setIsWalkInMode(c as boolean);
                    if (c) {
                      setSelectedCustomer(null);
                      setSelectedBranch(null);
                      setSelectedBillingAddress(null);
                      setSelectedShippingAddress(null);
                    }
                  }}
                />
                <Label htmlFor="walkin" className="cursor-pointer text-lg font-semibold text-blue-900">
                  Walk-in Cash Sale (No Customer Details)
                </Label>
              </div>
              {isWalkInMode && (
                <div className="mt-4">
                  <Label>Customer Name</Label>
                  <Input
                    value={walkInCustomerName}
                    onChange={(e) => setWalkInCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Selection */}
          {!isWalkInMode && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Customer
                  <Button size="sm" onClick={openNewCustomerDialog}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    New Customer
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Customer</Label>
                  <Select value={selectedCustomer?.id || ''} onValueChange={handleCustomerChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id!}>
                          <div className="flex items-center gap-2">
                            <Globe className="h-3 w-3" />
                            {c.companyName} ({c.customerCode}) - {(c as any).currency || 'INR'}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Branch Selection */}
                {selectedCustomer && customerBranches.length > 0 && (
                  <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
                    <Label className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-orange-600" />
                      Select Branch (Optional)
                    </Label>
                    <Select
                      value={selectedBranch?.id || ''}
                      onValueChange={(branchId) => {
                        const branch = customerBranches.find(b => b.id === branchId);
                        setSelectedBranch(branch || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no-branch">No Branch Selected</SelectItem>
                        {customerBranches.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {branch.branchName} ({branch.branchCode})
                                {branch.isHeadOffice && (
                                  <span className="ml-2 text-xs bg-orange-600 text-white px-2 py-0.5 rounded">
                                    HEAD OFFICE
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {branch.city}, {branch.state}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedBranch && (
                      <div className="mt-3 p-3 bg-white rounded border text-sm">
                        <p className="font-semibold text-orange-700">{selectedBranch.branchName}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedBranch.address}, {selectedBranch.city}, {selectedBranch.state} - {selectedBranch.pincode}
                        </p>
                        <p className="text-xs mt-1">
                          <strong>Contact:</strong> {selectedBranch.contactPerson} | {selectedBranch.phone}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedCustomer && (
                  <>
                    <div>
                      <Label>Billing Address</Label>
                      <Select
                        value={selectedBillingAddress?.id || ''}
                        onValueChange={(v) => {
                          const addr = selectedCustomer.addresses?.find(a => a.id === v && a.type === 'billing');
                          setSelectedBillingAddress(addr || null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select billing address" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedCustomer.addresses?.filter(a => a.type === 'billing').map(addr => (
                            <SelectItem key={addr.id} value={addr.id}>
                              {addr.label} - {addr.city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Shipping Address</Label>
                      <Select
                        value={selectedShippingAddress?.id || ''}
                        onValueChange={(v) => {
                          const addr = selectedCustomer.addresses?.find(a => a.id === v && a.type === 'shipping');
                          setSelectedShippingAddress(addr || null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select shipping address" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedCustomer.addresses?.filter(a => a.type === 'shipping').map(addr => (
                            <SelectItem key={addr.id} value={addr.id}>
                              {addr.label} - {addr.city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tax & Charges */}
          <Card>
            <CardHeader>
              <CardTitle>Tax & Charges</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="gst"
                  checked={includeGST && currentCurrency === 'INR'}
                  disabled={currentCurrency !== 'INR'}
                  onCheckedChange={(c) => setIncludeGST(c as boolean)}
                />
                <Label htmlFor="gst" className="cursor-pointer">
                  Include GST {currentCurrency !== 'INR' && '(Only for INR)'}
                </Label>
              </div>

              {includeGST && currentCurrency === 'INR' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>CGST %</Label>
                    <Input
                      type="number"
                      value={cgstPercent}
                      onChange={(e) => setCgstPercent(e.target.value ? Number(e.target.value) : '')}
                      min={0}
                      step={0.01}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Amount: {currencySymbol}{fmt(cgst)}
                    </p>
                  </div>
                  <div>
                    <Label>SGST %</Label>
                    <Input
                      type="number"
                      value={sgstPercent}
                      onChange={(e) => setSgstPercent(e.target.value ? Number(e.target.value) : '')}
                      min={0}
                      step={0.01}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Amount: {currencySymbol}{fmt(sgst)}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <Label>Transport Charge %</Label>
                <Input
                  type="number"
                  value={transportChargePercent}
                  onChange={(e) => setTransportChargePercent(e.target.value ? Number(e.target.value) : '')}
                  min={0}
                  step={0.01}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Amount: {currencySymbol}{fmt(transportCharge)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* References & Version */}
          <Card>
            <CardHeader>
              <CardTitle>References & Version</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label>Your Ref</Label>
                <Input
                  value={formData.yourRef}
                  onChange={(e) => setFormData(p => ({ ...p, yourRef: e.target.value }))}
                  placeholder="Client Reference"
                />
              </div>
              <div>
                <Label>Our Ref</Label>
                <Input
                  value={formData.ourRef}
                  onChange={(e) => setFormData(p => ({ ...p, ourRef: e.target.value }))}
                  placeholder="Internal reference"
                />
              </div>
            </CardContent>
          </Card>

          {/* Quotation Details */}
          <Card>
            <CardHeader>
              <CardTitle>Quotation Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label>SQ Date</Label>
                <Input
                  type="date"
                  value={formData.quoteDate}
                  onChange={(e) => setFormData(p => ({ ...p, quoteDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Quote Validity</Label>
                <Input
                  value={formData.validity}
                  onChange={(e) => setFormData(p => ({ ...p, validity: e.target.value }))}
                />
              </div>
              <div>
                <Label>Mode of Despatch</Label>
                <Select
                  value={formData.modeOfDispatch}
                  onValueChange={(v) => setFormData(p => ({ ...p, modeOfDispatch: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select dispatch mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {dispatchModes.map(mode => (
                      <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Delivery Term</Label>
                <Select
                  value={formData.deliveryTerm}
                  onValueChange={(v) => setFormData(p => ({ ...p, deliveryTerm: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select delivery term" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryTerms.map(term => (
                      <SelectItem key={term} value={term}>{term}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Payment Terms</Label>
                <Select
                  value={formData.paymentTerms}
                  onValueChange={(v) => setFormData(p => ({ ...p, paymentTerms: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTerms.map(term => (
                      <SelectItem key={term} value={term}>{term}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Line Items</CardTitle>
                <Button size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {lineItems.map((item, i) => (
                <div key={i} className="border rounded-lg p-5 bg-gradient-to-r from-blue-50 to-gray-50 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label>Product Code</Label>
                      <Select
                        value={item.productCode}
                        onValueChange={(v) => updateLineItem(i, 'productCode', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {flattenedProducts.map(p => (
                            <SelectItem key={p.productCode} value={p.productCode}>
                              <div>
                                <div className="font-medium">{p.parentName}</div>
                                <div className="text-xs text-muted-foreground">
                                  Code: {p.productCode} | {p.category} {p.group} | ₹{fmt(p.unitPrice)} | Stock: {p.stockQty}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={item.productDescription}
                        onChange={(e) => updateLineItem(i, 'productDescription', e.target.value)}
                        rows={2}
                      />
                      {item.size && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Ruler className="h-3 w-3" />
                          <span>{item.size}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label>UOM</Label>
                      <Input value={item.uom} readOnly className="bg-gray-100" />
                    </div>
                    <div>
                      <Label>HSN</Label>
                      <Input value={item.hsnCode} readOnly className="bg-gray-100" />
                    </div>
                    <div>
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) => updateLineItem(i, 'qty', e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                    <div>
                      <Label>Rate ({currencySymbol})</Label>
                      <Input
                        type="number"
                        step={0.01}
                        value={fmt(item.unitRate)}
                        onChange={(e) => updateLineItem(i, 'unitRate', Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <Label>Disc %</Label>
                      <Input
                        type="number"
                        value={item.discount ?? ''}
                        onChange={(e) => updateLineItem(i, 'discount', e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                    <div className="flex items-end">
                      <Label>Net</Label>
                      <div className="text-xl font-bold text-blue-700">{currencySymbol}{fmt(item.netAmount)}</div>
                    </div>
                    <div className="flex justify-end">
                      <Button size="icon" variant="ghost" onClick={() => removeLineItem(i)}>
                        <Trash2 className="h-5 w-5 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardContent className="pt-6 text-right text-lg font-semibold space-y-2">
              <div>Subtotal: {currencySymbol}{fmt(subtotal)}</div>
              {includeGST && currentCurrency === 'INR' && (
                <>
                  <div>CGST @{cgstPercent}%: {currencySymbol}{fmt(cgst)}</div>
                  <div>SGST @{sgstPercent}%: {currencySymbol}{fmt(sgst)}</div>
                </>
              )}
              {transportChargePercent > 0 && (
                <div>Transport Charge @{transportChargePercent}%: {currencySymbol}{fmt(transportCharge)}</div>
              )}
              <div className="text-2xl text-blue-700 border-t-2 border-blue-700 pt-2">
                Grand Total: {currencySymbol}{fmt(total)}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Label>Remarks</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData(p => ({ ...p, remarks: e.target.value }))}
                rows={3}
                className="mb-4"
              />
              <Label>Comments</Label>
              <Textarea
                value={formData.comments}
                onChange={(e) => setFormData(p => ({ ...p, comments: e.target.value }))}
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Preview Section - Bottom in landscape */}
        <div className="w-full mb-8">
          <div className="bg-white rounded-lg shadow-2xl border overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-4 text-center font-bold text-lg">
              Live Preview - A4 Landscape
              {isWalkInMode && (
                <span className="ml-3 inline-block bg-red-600 text-white px-4 py-1 rounded-full text-sm font-bold">CASH SALE</span>
              )}
              <div className="text-sm mt-1">Currency: {currentCurrency} ({currencySymbol})</div>
            </div>
            <div ref={printRef}>
              <QuotationPrintTemplate quotation={quotationData} />
            </div>
          </div>
        </div>
      </div>

      {/* Customer Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-5xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Add New Customer</DialogTitle>
            <div className="flex items-center gap-4 bg-blue-50 px-6 py-4 rounded-xl border-2 border-blue-200">
              <span className="text-sm font-medium">Customer Code:</span>
              <code className="text-2xl font-bold text-blue-600">{customerCode}</code>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(customerCode);
                  setCopied(true);
                  toast.success('Copied!');
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
              </Button>
            </div>
          </DialogHeader>

          <Tabs defaultValue="info" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Basic Info</TabsTrigger>
              <TabsTrigger value="addresses">Addresses</TabsTrigger>
              <TabsTrigger value="bank">Bank Details</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Company Name *</Label>
                  <Input
                    value={newCustomer.companyName}
                    onChange={(e) => setNewCustomer(p => ({ ...p, companyName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Contact Person *</Label>
                  <Input
                    value={newCustomer.contactPerson}
                    onChange={(e) => setNewCustomer(p => ({ ...p, contactPerson: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer(p => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Mobile Number *</Label>
                  <Input
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer(p => ({ ...p, phone: digitsOnly(limit(e.target.value, 10)) }))}
                    maxLength={10}
                  />
                </div>
                <div>
                  <Label>Currency *</Label>
                  <Select value={newCustomer.currency} onValueChange={(v) => setNewCustomer(p => ({ ...p, currency: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.name} ({c.symbol})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>GST Number</Label>
                  <Input
                    value={newCustomer.gst}
                    onChange={(e) => setNewCustomer(p => ({ ...p, gst: toUpper(limit(e.target.value, 15)) }))}
                    maxLength={15}
                  />
                </div>
                <div>
                  <Label>PAN</Label>
                  <Input
                    value={newCustomer.pan}
                    onChange={(e) => setNewCustomer(p => ({ ...p, pan: toUpper(limit(e.target.value, 10)) }))}
                    maxLength={10}
                  />
                </div>
                <div>
                  <Label>CIN</Label>
                  <Input
                    value={newCustomer.cin}
                    onChange={(e) => setNewCustomer(p => ({ ...p, cin: toUpper(limit(e.target.value, 21)) }))}
                    maxLength={21}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="addresses">
              <Tabs defaultValue="billing">
                <TabsList className="mb-4">
                  <TabsTrigger value="billing">Billing Addresses</TabsTrigger>
                  <TabsTrigger value="shipping">Shipping Addresses</TabsTrigger>
                </TabsList>

                <TabsContent value="billing">
                  <Button className="mb-4" onClick={() => openAddressDialog(undefined, 'billing')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Billing Address
                  </Button>
                  {newCustomer.addresses.filter(a => a.type === 'billing').map(addr => (
                    <div
                      key={addr.id}
                      className={`p-4 rounded-lg border mb-3 ${addr.isDefault ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <strong>{addr.label}</strong>
                          {addr.isDefault && (
                            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded ml-2">DEFAULT</span>
                          )}
                          <p className="text-sm">
                            {addr.street}{addr.area && `, ${addr.area}`}, {addr.city}, {addr.state} - {addr.pincode}<br />
                            {addr.country}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => openAddressDialog(addr)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteAddress(addr.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {newCustomer.addresses.filter(a => a.type === 'billing').length === 0 && (
                    <p className="text-muted-foreground text-sm">No billing addresses added yet.</p>
                  )}
                </TabsContent>

                <TabsContent value="shipping">
                  <Button className="mb-4" onClick={() => openAddressDialog(undefined, 'shipping')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Shipping Address
                  </Button>
                  {newCustomer.addresses.filter(a => a.type === 'shipping').map(addr => (
                    <div
                      key={addr.id}
                      className={`p-4 rounded-lg border mb-3 ${addr.isDefault ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <strong>{addr.label}</strong>
                          {addr.isDefault && (
                            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded ml-2">DEFAULT</span>
                          )}
                          <p className="text-sm">
                            {addr.street}{addr.area && `, ${addr.area}`}, {addr.city}, {addr.state} - {addr.pincode}<br />
                            {addr.country}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => openAddressDialog(addr)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteAddress(addr.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {newCustomer.addresses.filter(a => a.type === 'shipping').length === 0 && (
                    <p className="text-muted-foreground text-sm">No shipping addresses added yet.</p>
                  )}
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="bank">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label>Bank Name</Label>
                  <Input
                    value={newCustomer.bankName}
                    onChange={(e) => setNewCustomer(p => ({ ...p, bankName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Account No</Label>
                  <Input
                    value={newCustomer.bankAccountNo}
                    onChange={(e) => setNewCustomer(p => ({ ...p, bankAccountNo: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>IFSC</Label>
                  <Input
                    value={newCustomer.bankIfsc}
                    onChange={(e) => setNewCustomer(p => ({ ...p, bankIfsc: toUpper(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>Branch</Label>
                  <Input
                    value={newCustomer.bankBranch}
                    onChange={(e) => setNewCustomer(p => ({ ...p, bankBranch: e.target.value }))}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-4 mt-6">
            <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveNewCustomer}>Create & Select Customer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Address Dialog */}
      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? 'Edit' : 'Add'} {addressForm.type === 'billing' ? 'Billing' : 'Shipping'} Address
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Label *</Label>
              <Input
                value={addressForm.label}
                onChange={(e) => setAddressForm(p => ({ ...p, label: e.target.value }))}
                placeholder="e.g., Head Office"
              />
            </div>
            <div>
              <Label>Street *</Label>
              <Input
                value={addressForm.street}
                onChange={(e) => setAddressForm(p => ({ ...p, street: e.target.value }))}
              />
            </div>
            <div>
              <Label>Area</Label>
              <Input
                value={addressForm.area}
                onChange={(e) => setAddressForm(p => ({ ...p, area: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City *</Label>
                <Input
                  value={addressForm.city}
                  onChange={(e) => setAddressForm(p => ({ ...p, city: e.target.value }))}
                />
              </div>
              <div>
                <Label>State *</Label>
                <Select value={addressForm.state} onValueChange={(v) => setAddressForm(p => ({ ...p, state: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {indianStates.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pincode *</Label>
                <Input
                  value={addressForm.pincode}
                  onChange={(e) => setAddressForm(p => ({ ...p, pincode: digitsOnly(limit(e.target.value, 6)) }))}
                  maxLength={6}
                />
              </div>
              <div>
                <Label>Country *</Label>
                <Input
                  value={addressForm.country}
                  onChange={(e) => setAddressForm(p => ({ ...p, country: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="default"
                checked={addressForm.isDefault}
                onCheckedChange={(c) => setAddressForm(p => ({ ...p, isDefault: c as boolean }))}
              />
              <Label htmlFor="default" className="cursor-pointer">Set as default</Label>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <Button variant="outline" onClick={() => setAddressDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveAddress}>Save Address</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
