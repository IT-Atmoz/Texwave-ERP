'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Truck, Edit, Trash2, Download, Eye, Package, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import fas from './fas.png';

import { createRecord, getAllRecords, updateRecord, deleteRecord } from '@/services/firebase';

interface Shipment {
  id?: string;
  shipmentId: string;
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  customerName: string;
  transporterName: string;
  vehicleNo: string;
  modeOfTransport: string;
  dispatchDate: string;
  dispatchTime: string;
  deliveryStatus: 'Pending' | 'In Transit' | 'Delivered';
  remarks?: string;
  createdAt?: number;
  updatedAt?: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
};

const formatAmount = (amount: number, currency: string = 'INR') => {
  if (currency === 'INR') {
    return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Shipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [viewLROpen, setViewLROpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    invoiceId: '',
    transporterName: '',
    dispatchDate: new Date().toISOString().split('T')[0],
    dispatchTime: new Date().toTimeString().slice(0, 5),
    deliveryStatus: 'Pending' as Shipment['deliveryStatus'],
    remarks: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [shipData, invData] = await Promise.all([
        getAllRecords('sales/shipments'),
        getAllRecords('sales/invoices'),
      ]);
      const shipmentsWithId = (shipData as any[]).map((s: any) => ({
        ...s,
        id: s.id || Object.keys(s)[0],
      }));
      setShipments(shipmentsWithId);
      setFilteredShipments(shipmentsWithId);
      setInvoices(invData as any[]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load data');
    }
  };

  // Search filter effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredShipments(shipments);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = shipments.filter((shipment) => {
      const shipmentId = (shipment.shipmentId || '').toLowerCase();
      const invoiceNumber = (shipment.invoiceNumber || '').toLowerCase();
      const customerName = (shipment.customerName || '').toLowerCase();

      return (
        shipmentId.startsWith(query) ||
        invoiceNumber.startsWith(query) ||
        customerName.startsWith(query)
      );
    });

    setFilteredShipments(filtered);
  }, [searchQuery, shipments]);

  const usedInvoiceIds = shipments
    .filter(s => s.id !== editingKey)
    .map(s => s.invoiceId);

  const selectedInvoice = invoices.find(i => i.id === formData.invoiceId);
  const currency = selectedInvoice?.currency || 'INR';
  const symbol = CURRENCY_SYMBOLS[currency];

  const handleInvoiceChange = (invoiceId: string) => {
    setFormData(prev => ({ ...prev, invoiceId }));
  };

  const handleSubmit = async () => {
    if (!formData.invoiceId || !selectedInvoice) {
      toast.error('Please select a valid invoice');
      return;
    }

    const shipmentId = editingKey
      ? shipments.find(s => s.id === editingKey)?.shipmentId || `SHIP-${Date.now()}`
      : `SHIP-${String(shipments.length + 1001).padStart(4, '0')}`;

    const payload: Shipment = {
      shipmentId,
      invoiceId: formData.invoiceId,
      invoiceNumber: selectedInvoice.invoiceNumber,
      orderId: selectedInvoice.orderId || '',
      customerName: selectedInvoice.customerName,
      transporterName: formData.transporterName || 'Self',
      vehicleNo: selectedInvoice.vehicleNo || '',
      modeOfTransport: selectedInvoice.transportMode || 'Courier',
      dispatchDate: formData.dispatchDate,
      dispatchTime: formData.dispatchTime,
      deliveryStatus: formData.deliveryStatus,
      remarks: formData.remarks,
      updatedAt: Date.now(),
    };

    try {
      if (editingKey) {
        await updateRecord('sales/shipments', editingKey, payload);
        toast.success('Shipment updated successfully');
      } else {
        payload.createdAt = Date.now();
        await createRecord('sales/shipments', payload);
        toast.success('Shipment created successfully');
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    }
  };

  const handleEdit = (shipment: Shipment) => {
    if (!shipment.id) return;
    setEditingKey(shipment.id);
    setFormData({
      invoiceId: shipment.invoiceId,
      transporterName: shipment.transporterName || '',
      dispatchDate: shipment.dispatchDate,
      dispatchTime: shipment.dispatchTime || '',
      deliveryStatus: shipment.deliveryStatus,
      remarks: shipment.remarks || '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingKey(null);
    setFormData({
      invoiceId: '',
      transporterName: '',
      dispatchDate: new Date().toISOString().split('T')[0],
      dispatchTime: new Date().toTimeString().slice(0, 5),
      deliveryStatus: 'Pending',
      remarks: '',
    });
  };

  const handleDelete = async (firebaseKey: string) => {
    if (!confirm('Delete this shipment permanently?')) return;
    try {
      await deleteRecord('sales/shipments', firebaseKey);
      toast.success('Shipment deleted');
      loadData();
    } catch {
      toast.error('Delete failed');
    }
  };

  const getStatusBadge = (status: string) => {
    const map = {
      Delivered: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      'In Transit': 'bg-blue-100 text-blue-800 border border-blue-300',
      Pending: 'bg-amber-100 text-amber-800 border border-amber-300',
    };
    return map[status as keyof typeof map] || 'bg-gray-100 text-gray-800';
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: element.scrollHeight,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`PL-${selectedShipment?.shipmentId || 'copy'}.pdf`);
      toast.success('Packing List downloaded!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF export failed');
    }
  };

  const openLRView = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setViewLROpen(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3 text-blue-900">
              <Truck className="h-10 w-10 md:h-12 md:w-12 text-blue-600" />
              Shipments & Dispatch
            </h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base">
              Create and manage material dispatches from invoices
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-blue-700 hover:bg-blue-800 w-full md:w-auto">
                <Plus className="h-5 w-5 mr-2" /> Create Shipment
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-[95vw] md:max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl md:text-2xl font-bold">
                  {editingKey ? 'Edit Shipment' : 'Create New Shipment'}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">

                <div>
                  <Label className="text-base md:text-lg font-semibold">Select Invoice *</Label>
                  <Select value={formData.invoiceId} onValueChange={handleInvoiceChange} disabled={!!editingKey}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose invoice..." />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices
                        .filter(inv => !usedInvoiceIds.includes(inv.id) || inv.id === formData.invoiceId)
                        .map(inv => (
                          <SelectItem key={inv.id} value={inv.id}>
                            <div>
                              <div className="font-bold">{inv.invoiceNumber}</div>
                              <div className="text-sm text-muted-foreground">
                                {inv.customerName} • {symbol}{formatAmount(inv.grandTotal || 0, inv.currency)} • {inv.lineItems?.length} items
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedInvoice && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-base md:text-lg flex items-center gap-2">
                        <Package className="h-5 w-5" /> Invoice Items ({selectedInvoice.lineItems.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <div className="min-w-full">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">S.No</TableHead>
                              <TableHead className="w-[120px] md:w-[150px]">Part Code</TableHead>
                              <TableHead className="min-w-[200px] md:min-w-[300px]">Description</TableHead>
                              <TableHead className="w-[80px] md:w-[100px]">HSN</TableHead>
                              <TableHead className="text-center w-[60px] md:w-[80px]">Qty</TableHead>
                              <TableHead className="w-[60px] md:w-[80px]">UOM</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedInvoice.lineItems.map((item: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="align-top">{i + 1}</TableCell>
                                <TableCell className="font-mono text-xs md:text-sm align-top break-all">{item.partCode}</TableCell>
                                <TableCell className="text-xs md:text-sm align-top break-words whitespace-normal max-w-[200px] md:max-w-[400px]">
                                  {item.description}
                                </TableCell>
                                <TableCell className="text-xs md:text-sm align-top">{item.hsnCode}</TableCell>
                                <TableCell className="text-center font-bold text-green-700 align-top">{item.qty}</TableCell>
                                <TableCell className="align-top">{item.uom}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div>
                    <Label>Transport Mode</Label>
                    <Input value={selectedInvoice?.transportMode || 'Courier'} disabled className="bg-gray-100" />
                  </div>
                  <div>
                    <Label>Vehicle Number</Label>
                    <Input value={selectedInvoice?.vehicleNo || ''} disabled className="bg-gray-100" />
                  </div>

                  <div>
                    <Label>Transporter Name</Label>
                    <Input
                      value={formData.transporterName}
                      onChange={e => setFormData(p => ({ ...p, transporterName: e.target.value }))}
                      placeholder="e.g. VRL Logistics"
                    />
                  </div>

                  <div>
                    <Label>Dispatch Date</Label>
                    <Input type="date" value={formData.dispatchDate} onChange={e => setFormData(p => ({ ...p, dispatchDate: e.target.value }))} />
                  </div>

                  <div>
                    <Label>Dispatch Time</Label>
                    <Input type="time" value={formData.dispatchTime} onChange={e => setFormData(p => ({ ...p, dispatchTime: e.target.value }))} />
                  </div>

                  <div>
                    <Label>Delivery Status</Label>
                    <Select value={formData.deliveryStatus} onValueChange={v => setFormData(p => ({ ...p, deliveryStatus: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="In Transit">In Transit</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <Label>Remarks (Optional)</Label>
                    <Textarea rows={3} value={formData.remarks} onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))} />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row justify-end gap-3 md:gap-4">
                  <Button variant="outline" size="lg" onClick={() => setDialogOpen(false)} className="w-full md:w-auto">
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} size="lg" className="bg-blue-700 hover:bg-blue-800 w-full md:w-auto">
                    {editingKey ? 'Update' : 'Create'} Shipment
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by shipment ID, invoice, or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 py-5 md:py-6 text-sm md:text-base border-2 border-gray-300 focus:border-blue-500 rounded-lg shadow-sm"
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
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-600">
              Found {filteredShipments.length} result{filteredShipments.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Shipments Table */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl font-bold">
              All Shipments ({filteredShipments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-50">
                  <TableHead className="font-bold">Shipment ID</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Vehicle</TableHead>
                  <TableHead className="hidden lg:table-cell">Dispatched</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShipments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 md:py-16 text-gray-500">
                      {searchQuery ? (
                        <>
                          <p className="font-medium mb-2">No shipments match your search</p>
                          <p className="text-sm mb-4">Try a different search term or</p>
                          <Button variant="outline" onClick={clearSearch}>
                            Clear Search
                          </Button>
                        </>
                      ) : (
                        'No shipments created yet'
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredShipments.map(s => {
                    const inv = invoices.find(i => i.id === s.invoiceId);
                    const invCurrency = inv?.currency || 'INR';
                    const invSymbol = CURRENCY_SYMBOLS[invCurrency];
                    return (
                      <TableRow key={s.id} className="hover:bg-blue-50/50">
                        <TableCell className="font-bold text-blue-700">{s.shipmentId}</TableCell>
                        <TableCell className="font-medium">{s.invoiceNumber}</TableCell>
                        <TableCell>{s.customerName}</TableCell>
                        <TableCell className="font-mono hidden md:table-cell">{s.vehicleNo || '—'}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {format(new Date(s.dispatchDate), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs md:text-sm px-2 md:px-3 py-1 font-medium ${getStatusBadge(s.deliveryStatus)}`}>
                            {s.deliveryStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-1 md:space-x-2">
                          <Button size="sm" variant="ghost" onClick={() => openLRView(s)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(s)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => s.id && handleDelete(s.id)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* PACKING LIST PRINT TEMPLATE - REDESIGNED TO MATCH QUOTATION FORMAT */}
        <Dialog open={viewLROpen} onOpenChange={setViewLROpen}>
          <DialogContent className="max-w-[95vw] md:max-w-4xl lg:max-w-5xl max-h-[95vh] overflow-y-auto p-0 bg-white">
            {selectedShipment && (() => {
              const inv = invoices.find(i => i.id === selectedShipment.invoiceId);
              const invCurrency = inv?.currency || 'INR';
              const invSymbol = CURRENCY_SYMBOLS[invCurrency];
              return (
                <>
                  <style>{`
                    @media print {
                      @page {
                        size: A4;
                        margin: 0;
                      }
                      body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        margin: 0;
                        padding: 0;
                      }
                    }
                    
                    * {
                      margin: 0;
                      padding: 0;
                      box-sizing: border-box;
                    }
                    
                    .packing-table {
                      width: 100%;
                      border-collapse: collapse;
                      table-layout: fixed;
                    }
                    
                    .packing-table td,
                    .packing-table th {
                      border: 1.5px solid #000;
                      padding: 6px 8px;
                      vertical-align: middle;
                      font-size: 9px;
                      line-height: 1.3;
                      word-wrap: break-word;
                      overflow-wrap: break-word;
                    }
                    
                    .packing-table th {
                      background: #e5e7eb;
                      font-weight: 900;
                      text-align: center;
                      line-height: 1.2;
                    }

                    .packing-table .description-cell {
                      word-wrap: break-word;
                      overflow-wrap: break-word;
                      white-space: normal;
                      max-width: 0;
                    }
                  `}</style>

                  <div className="sticky top-0 bg-white border-b z-10 p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md">
                    <h2 className="text-xl md:text-3xl font-bold text-blue-900">
                      Packing List - {selectedShipment.shipmentId}
                    </h2>
                    <Button onClick={handleExportPDF} size="lg" className="bg-blue-700 hover:bg-blue-800 w-full md:w-auto">
                      <Download className="h-5 w-5 mr-2" /> Download PDF
                    </Button>
                  </div>

                  <div 
                    ref={printRef} 
                    style={{ 
                      backgroundColor: '#ffffff',
                      maxWidth: '800px',
                      margin: '0 auto',
                      width: '100%',
                    }} 
                    className="text-black font-sans"
                  >
                    <div style={{ border: '3px solid #000', minHeight: '100%' }}>
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
                        <img 
                          src={fas.src || fas} 
                          alt="FAS Logo" 
                          style={{ width: '75px', height: 'auto', flexShrink: 0 }}
                          crossOrigin="anonymous"
                        />
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <h1 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: '#000', lineHeight: 1.2 }}>
                            Fluoro Automation Seals Pvt Ltd
                          </h1>
                          <p style={{ fontSize: '9.5px', margin: '3px 0 0 0', color: '#000', lineHeight: 1.3, fontWeight: '600' }}>
                            3/180, Rajiv Gandhi Road, Mettukuppam, Chennai, Tamil Nadu 600097<br/>
                            Phone: +91-841175097 | Email: dispatch@fluoroautomation.com
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

                      {/* Body Content */}
                      <div style={{ padding: '10px 16px' }}>
                        {/* Title */}
                        <h2 style={{ textAlign: 'center', fontSize: '17px', fontWeight: '900', margin: '0 0 10px 0', letterSpacing: '1.5px' }}>
                          PACKING LIST
                        </h2>

                        {/* Shipment Details Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '8.5px', marginBottom: '12px' }}>
                          {/* Left Column */}
                          <div>
                            <table style={{ width: '100%', fontSize: '8.5px', borderCollapse: 'collapse' }}>
                              <tbody>
                                <tr>
                                  <td style={{ paddingRight: '10px', fontWeight: '700', padding: '2px 0', verticalAlign: 'top' }}>PL No.:</td>
                                  <td style={{ fontWeight: '900', fontSize: '12px', padding: '2px 0', color: '#1d4ed8' }}>{selectedShipment.shipmentId}</td>
                                </tr>
                                <tr>
                                  <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Date:</td>
                                  <td style={{ padding: '2px 0', fontWeight: '800' }}>{format(new Date(selectedShipment.dispatchDate), 'dd/MM/yyyy')}</td>
                                </tr>
                                <tr>
                                  <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Time:</td>
                                  <td style={{ padding: '2px 0', fontWeight: '800' }}>{selectedShipment.dispatchTime}</td>
                                </tr>
                                <tr>
                                  <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Transporter:</td>
                                  <td style={{ padding: '2px 0', fontWeight: '800' }}>{selectedShipment.transporterName || 'Self'}</td>
                                </tr>
                                <tr>
                                  <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Vehicle No:</td>
                                  <td style={{ padding: '2px 0', fontWeight: '900', fontSize: '10px' }}>{selectedShipment.vehicleNo || '—'}</td>
                                </tr>
                                <tr>
                                  <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Mode:</td>
                                  <td style={{ padding: '2px 0', fontWeight: '800' }}>{selectedShipment.modeOfTransport}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Right Column */}
                          <div>
                            <table style={{ width: '100%', fontSize: '8.5px', borderCollapse: 'collapse' }}>
                              <tbody>
                                <tr>
                                  <td style={{ paddingRight: '10px', fontWeight: '700', padding: '2px 0', verticalAlign: 'top' }}>Invoice No:</td>
                                  <td style={{ fontWeight: '900', fontSize: '10px', padding: '2px 0' }}>{selectedShipment.invoiceNumber}</td>
                                </tr>
                                <tr>
                                  <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Consignee:</td>
                                  <td style={{ padding: '2px 0', fontWeight: '800' }}>{selectedShipment.customerName}</td>
                                </tr>
                                <tr>
                                  <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Total Value:</td>
                                  <td style={{ padding: '2px 0', fontWeight: '900', fontSize: '11px' }}>{invSymbol}{formatAmount(inv?.grandTotal || 0, invCurrency)}</td>
                                </tr>
                                <tr>
                                  <td style={{ paddingRight: '10px', padding: '2px 0', verticalAlign: 'top', fontWeight: '700' }}>Status:</td>
                                  <td style={{ padding: '2px 0' }}>
                                    <span style={{ 
                                      display: 'inline-block',
                                      padding: '2px 8px', 
                                      borderRadius: '4px',
                                      fontSize: '8px',
                                      fontWeight: '800',
                                      backgroundColor: selectedShipment.deliveryStatus === 'Delivered' ? '#d1fae5' : selectedShipment.deliveryStatus === 'In Transit' ? '#dbeafe' : '#fef3c7',
                                      color: selectedShipment.deliveryStatus === 'Delivered' ? '#065f46' : selectedShipment.deliveryStatus === 'In Transit' ? '#1e40af' : '#92400e',
                                      border: `1px solid ${selectedShipment.deliveryStatus === 'Delivered' ? '#6ee7b7' : selectedShipment.deliveryStatus === 'In Transit' ? '#93c5fd' : '#fcd34d'}`
                                    }}>
                                      {selectedShipment.deliveryStatus}
                                    </span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Items Table */}
                        <div style={{ marginBottom: '12px' }}>
                          <table className="packing-table">
                            <colgroup>
                              <col style={{ width: '5%' }} />
                              <col style={{ width: '15%' }} />
                              <col style={{ width: '45%' }} />
                              <col style={{ width: '10%' }} />
                              <col style={{ width: '10%' }} />
                              <col style={{ width: '10%' }} />
                            </colgroup>
                            <thead>
                              <tr>
                                <th>Sr.</th>
                                <th>Part Code</th>
                                <th>Description</th>
                                <th>HSN</th>
                                <th>Qty</th>
                                <th>UOM</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inv?.lineItems?.map((item: any, i: number) => (
                                <tr key={i}>
                                  <td style={{ textAlign: 'center', fontWeight: '800' }}>{i + 1}</td>
                                  <td style={{ fontWeight: '800', fontSize: '8px', wordWrap: 'break-word' }}>{item.partCode}</td>
                                  <td className="description-cell" style={{ textAlign: 'left', fontWeight: '700', fontSize: '8px', wordWrap: 'break-word', whiteSpace: 'normal' }}>
                                    {item.description}
                                  </td>
                                  <td style={{ fontWeight: '700', textAlign: 'center', fontSize: '8px' }}>{item.hsnCode}</td>
                                  <td style={{ textAlign: 'center', fontWeight: '900', fontSize: '10px', color: '#059669' }}>{item.qty}</td>
                                  <td style={{ textAlign: 'center', fontWeight: '700' }}>{item.uom}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Remarks */}
                        {selectedShipment.remarks && (
                          <div style={{ 
                            backgroundColor: '#fffbeb', 
                            border: '2px solid #fcd34d', 
                            borderRadius: '6px', 
                            padding: '8px 12px', 
                            marginBottom: '12px' 
                          }}>
                            <p style={{ fontWeight: '900', fontSize: '9px', marginBottom: '4px' }}>Remarks:</p>
                            <p style={{ fontSize: '8.5px', lineHeight: 1.4, fontWeight: '700', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                              {selectedShipment.remarks}
                            </p>
                          </div>
                        )}

                        {/* Signature Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px', borderTop: '2px solid #000', paddingTop: '12px' }}>
                          <div>
                            <p style={{ fontWeight: '900', fontSize: '9px', marginBottom: '30px' }}>Receiver's Signature</p>
                            <div style={{ borderTop: '2px solid #000', width: '150px', paddingTop: '5px' }}>
                              <p style={{ fontSize: '8px', fontWeight: '700' }}>Name & Stamp</p>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontWeight: '900', fontSize: '9px', marginBottom: '30px' }}>For Fluoro Automation Seals Pvt Ltd</p>
                            <div style={{ borderTop: '2px solid #000', width: '150px', marginLeft: 'auto', paddingTop: '5px' }}>
                              <p style={{ fontSize: '8px', fontWeight: '700' }}>Authorized Signatory</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
