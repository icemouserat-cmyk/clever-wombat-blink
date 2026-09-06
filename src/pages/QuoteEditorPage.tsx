import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import AppHeader from '@/components/AppHeader';
import AIAdvisorPanel from '@/components/AIAdvisorPanel';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Loader2, Plus, Trash2, ArrowLeft, FileText, Send, CheckCircle, AlertCircle, Download, FileDown } from 'lucide-react';

const QuoteEditorPage = () => {
  const { id: quoteId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [quotation, setQuotation] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [priceList, setPriceList] = useState<any[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [selectedSku, setSelectedSku] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (quoteId) loadQuoteData();
  }, [quoteId]);

  const loadQuoteData = async () => {
    setIsLoading(true);
    try {
      const { data: quote, error: qError } = await supabase.from('quotations').select('*').eq('id', quoteId).single();
      if (qError) throw qError;
      setQuotation(quote);

      const { data: cust, error: cError } = await supabase.from('customers').select('*').eq('id', quote.customer_id).single();
      if (cError) throw cError;
      setCustomer(cust);

      const { data: qItems, error: iError } = await supabase.from('quotation_items').select('*').eq('quotation_id', quoteId);
      if (iError) throw iError;
      setItems(qItems || []);

      const { data: pl, error: plError } = await supabase.from('price_list').select('*').order('sku', { ascending: true });
      if (plError) throw plError;
      setPriceList(pl || []);

      if (user) {
        const { data: profile } = await supabase.from('profiles').select('logo_url').eq('id', user.id).maybeSingle();
        setLogoUrl(profile?.logo_url || null);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshQuotationTotal = async () => {
    const { data, error } = await supabase.from('quotations').select('total_amount').eq('id', quoteId).single();
    if (error) throw error;
    setQuotation((prev: any) => ({ ...prev, total_amount: data.total_amount }));
  };

  const handleAddItem = async () => {
    if (!selectedSku || !user) return;
    const itemData = priceList.find(p => p.sku === selectedSku);
    if (!itemData) return;

    const markup = 0.19;
    const unitPrice = itemData.base_cost * (1 + markup);
    const lineTotal = unitPrice * quantity;
    const requiresA3 = itemData.item_group === 'Furniture - Custom';

    try {
      const { data: newItem, error: insertError } = await supabase
        .from('quotation_items')
        .insert({
          quotation_id: quoteId,
          user_id: user.id,
          sku: selectedSku,
          quantity: quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
          requires_a3_approval: requiresA3,
          is_approved: !requiresA3,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await refreshQuotationTotal();
      setItems(prev => [...prev, newItem]);
      setSelectedSku('');
      setQuantity(1);
      toast({ title: 'Item Added', description: `Added ${selectedSku} to quotation.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from('quotation_items').delete().eq('id', itemId);
      if (error) throw error;
      await refreshQuotationTotal();
      setItems(prev => prev.filter(i => i.id !== itemId));
      toast({ title: 'Item Removed', description: 'Line item deleted.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleToggleApproval = async (itemId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('quotation_items').update({ is_approved: !currentStatus }).eq('id', itemId);
      if (error) throw error;
      setItems(prev => prev.map(item => item.id === itemId ? { ...item, is_approved: !currentStatus } : item));
      toast({ title: 'Approval Updated', description: `Item is now ${!currentStatus ? 'Approved' : 'Pending Review'}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleMarkAsSent = async () => {
    const unapprovedCustomItems = items.filter(item => item.requires_a3_approval && !item.is_approved);
    if (unapprovedCustomItems.length > 0) {
      toast({
        variant: 'destructive',
        title: 'A3 Approval Required',
        description: `Cannot send quotation. ${unapprovedCustomItems.length} custom item(s) require explicit founder approval before sending.`,
      });
      return;
    }
    try {
      const { error } = await supabase
        .from('quotations')
        .update({ status: 'Sent', sent_at: new Date().toISOString() })
        .eq('id', quoteId);
      if (error) throw error;
      setQuotation((prev: any) => ({ ...prev, status: 'Sent' }));
      toast({ title: 'Quotation Sent', description: 'The quotation has been marked as Sent.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const escapeCsv = (val: any) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCsv = () => {
    if (!quotation || !customer) return;

    const headerRows = [
      ['Field', 'Value'],
      ['Quotation ID', quotation.id],
      ['Status', quotation.status],
      ['Customer Name', customer.name],
      ['Referral Source', customer.referral_source],
      ['Staff Size', customer.staff_size],
      ['Created At', quotation.created_at],
      ['Sent At', quotation.sent_at || ''],
      ['Total Amount (RM)', Number(quotation.total_amount).toFixed(2)],
      ['Notes', quotation.notes || ''],
      [],
      ['SKU', 'Quantity', 'Unit Price (RM)', 'Line Total (RM)', 'Item Group', 'Requires A3 Approval', 'Approved'],
    ];

    const itemRows = items.map(item => [
      item.sku,
      item.quantity,
      item.unit_price.toFixed(2),
      item.line_total.toFixed(2),
      item.requires_a3_approval ? 'Furniture - Custom' : 'Furniture - Standard',
      item.requires_a3_approval ? 'Yes' : 'No',
      item.is_approved ? 'Yes' : 'No',
    ]);

    const allRows = [...headerRows, ...itemRows];
    const csvContent = allRows.map(row => row.map(escapeCsv).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeCustomerName = (customer.name || 'quotation').replace(/[^a-z0-9]/gi, '_');
    link.download = `AuraSpace_Quote_${safeCustomerName}_${quotation.id.slice(0, 8)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'Exported', description: 'Quotation CSV downloaded.' });
  };

  const loadImageAsDataUrl = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const handleExportPdf = async () => {
    if (!quotation || !customer) return;

    const doc = new jsPDF();
    let cursorY = 15;

    if (logoUrl) {
      const dataUrl = await loadImageAsDataUrl(logoUrl);
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, 'PNG', 14, cursorY, 30, 30);
          cursorY += 5;
        } catch {
          // If image embedding fails, continue without it rather than blocking export
        }
      }
    }

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AuraSpace Sdn Bhd', logoUrl ? 50 : 14, cursorY + 8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Quotation', logoUrl ? 50 : 14, cursorY + 14);

    cursorY += 35;

    doc.setFontSize(11);
    doc.text(`Quotation ID: ${quotation.id.slice(0, 8)}`, 14, cursorY);
    doc.text(`Status: ${quotation.status}`, 140, cursorY);
    cursorY += 6;
    doc.text(`Customer: ${customer.name}`, 14, cursorY);
    doc.text(`Created: ${new Date(quotation.created_at).toLocaleDateString()}`, 140, cursorY);
    cursorY += 6;
    doc.text(`Referral Source: ${customer.referral_source}`, 14, cursorY);
    if (quotation.sent_at) {
      doc.text(`Sent: ${new Date(quotation.sent_at).toLocaleDateString()}`, 140, cursorY);
    }
    cursorY += 6;
    doc.text(`Staff Size: ${customer.staff_size}`, 14, cursorY);
    cursorY += 10;

    if (quotation.notes) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      const noteLines = doc.splitTextToSize(`Notes: ${quotation.notes}`, 180);
      doc.text(noteLines, 14, cursorY);
      cursorY += noteLines.length * 5 + 5;
      doc.setFont('helvetica', 'normal');
    }

    autoTable(doc, {
      startY: cursorY,
      head: [['SKU', 'Qty', 'Unit Price (RM)', 'Line Total (RM)', 'Group', 'A3 Approved']],
      body: items.map(item => [
        item.sku,
        String(item.quantity),
        item.unit_price.toFixed(2),
        item.line_total.toFixed(2),
        item.requires_a3_approval ? 'Custom' : 'Standard',
        item.requires_a3_approval ? (item.is_approved ? 'Yes' : 'No') : 'N/A',
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || cursorY + 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: RM ${Number(quotation.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 140, finalY + 10);

    const safeCustomerName = (customer.name || 'quotation').replace(/[^a-z0-9]/gi, '_');
    doc.save(`AuraSpace_Quote_${safeCustomerName}_${quotation.id.slice(0, 8)}.pdf`);

    toast({ title: 'Exported', description: 'Quotation PDF downloaded.' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <Button variant="ghost" onClick={() => navigate('/quotations')} className="mb-4 -ml-4 text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotations
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Quotation Builder</h1>
              <Badge variant="outline" className="text-sm">{quotation?.status}</Badge>
            </div>
            <p className="text-muted-foreground">
              Customer: <span className="font-medium text-foreground">{customer?.name}</span> |
              Staff Size: <span className="font-medium text-foreground">{customer?.staff_size}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right space-y-1">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-4xl font-bold text-primary">
                RM {quotation?.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={items.length === 0} className="flex items-center gap-2">
                  <Download className="h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={items.length === 0} className="flex items-center gap-2">
                  <FileDown className="h-4 w-4" /> PDF
                </Button>
              </div>
              {quotation?.status === 'Draft' && (
                <Button onClick={handleMarkAsSent} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
                  <Send className="h-4 w-4" /> Mark as Sent
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="h-5 w-5" /> Add Line Item
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Item (SKU)</Label>
                  <Select value={selectedSku} onValueChange={setSelectedSku}>
                    <SelectTrigger><SelectValue placeholder="Choose a product..." /></SelectTrigger>
                    <SelectContent>
                      {priceList.map(p => (
                        <SelectItem key={p.id} value={p.sku}>
                          {p.sku} - {p.description} (RM {p.base_cost})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
                </div>
                <Button className="w-full" onClick={handleAddItem} disabled={!selectedSku}>
                  Add to Quotation
                </Button>
              </div>
            </div>

            <AIAdvisorPanel quotation={quotation} customer={customer} items={items} />

            <div className="rounded-xl border bg-slate-50 p-6 space-y-3">
              <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Inquiry Notes
              </h3>
              <p className="text-sm text-slate-700 italic whitespace-pre-wrap">
                {quotation?.notes || 'No specific notes provided for this inquiry.'}
              </p>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">SKU</th>
                    <th className="text-left font-medium px-4 py-3">Qty</th>
                    <th className="text-left font-medium px-4 py-3">Unit Price</th>
                    <th className="text-left font-medium px-4 py-3">Total</th>
                    <th className="text-left font-medium px-4 py-3">Approval</th>
                    <th className="text-right font-medium px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        No items added to this quotation yet.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-b last:border-b-0">
                        <td className="px-4 py-2 font-mono font-medium">{item.sku}</td>
                        <td className="px-4 py-2">{item.quantity}</td>
                        <td className="px-4 py-2">RM {item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 font-medium">RM {item.line_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2">
                          {item.requires_a3_approval ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleApproval(item.id, item.is_approved)}
                              className="h-7 px-2"
                            >
                              {item.is_approved ? (
                                <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" /> Approved
                                </Badge>
                              ) : (
                                <Badge className="bg-red-500 hover:bg-red-600 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" /> Pending A3
                                </Badge>
                              )}
                            </Button>
                          ) : (
                            <Badge variant="secondary" className="font-normal">Standard</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(item.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteEditorPage;
