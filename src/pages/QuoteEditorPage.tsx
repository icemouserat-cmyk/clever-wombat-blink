import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { calculateMarkup, calculateLineTotal } from '@/utils/pricing';
import { startTimeLog, endTimeLog } from '@/utils/time-logging';
import { exportToCSV } from '@/utils/export';
import AIAdvisorPanel from '@/components/AIAdvisorPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, ArrowLeft, Package } from 'lucide-react';

interface QuoteItem {
  id?: string;
  sku: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  requires_a3_approval: boolean;
  is_approved: boolean;
}

export default function QuoteEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [customer_id, setCustomerId] = useState(searchParams.get('customerId') || '');
  const [customers, setCustomers] = useState<any[]>([]);
  const [priceList, setPriceList] = useState<any[]>([]);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [status, setStatus] = useState<'Draft' | 'Sent' | 'Approved' | 'Order'>('Draft');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
    
    // Start time logging when entering the editor
    const startLog = async () => {
      const sid = await startTimeLog(id || null);
      setSessionId(sid);
    };
    startLog();

    return () => {
      if (sessionId) {
        endTimeLog(sessionId);
      }
    };
  }, [id]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [custRes, priceRes] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('price_list').select('*'),
      ]);

      setCustomers(custRes.data || []);
      setPriceList(priceRes.data || []);

      if (id) {
        const { data: quote, error: quoteError } = await supabase
          .from('quotations')
          .select('*')
          .eq('id', id)
          .single();
        
        if (quoteError) throw quoteError;
        
        setCustomerId(quote.customer_id);
        setStatus(quote.status);

        const { data: quoteItems, error: itemsError } = await supabase
          .from('quotation_items')
          .select('*')
          .eq('quotation_id', id);
        
        if (itemsError) throw itemsError;
        setItems(quoteItems || []);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = (sku: string) => {
    const priceItem = priceList.find(p => p.sku === sku);
    if (!priceItem) return;

    const unitPrice = calculateMarkup(priceItem.base_cost);
    const newItem: QuoteItem = {
      sku: priceItem.sku,
      description: priceItem.description,
      quantity: 1,
      unit_price: unitPrice,
      line_total: calculateLineTotal(unitPrice, 1),
      requires_a3_approval: priceItem.item_group === 'Custom',
      is_approved: priceItem.item_group === 'Standard', // Standard is auto-approved
    };

    setItems([...items, newItem]);
  };

  const updateItem = (index: number, updates: Partial<QuoteItem>) => {
    const newItems = [...items];
    const item = { ...newItems[index], ...updates };
    
    if (updates.quantity !== undefined) {
      item.line_total = calculateLineTotal(item.unit_price, item.quantity);
    }
    
    newItems[index] = item;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.line_total, 0);
  };

  const saveQuote = async (newStatus?: 'Draft' | 'Sent' | 'Approved' | 'Order') => {
    if (!customer_id) {
      toast({ variant: "destructive", title: "Missing Customer", description: "Please select a customer first." });
      return;
    }

    const updatedStatus = newStatus || status;

    // Stage 5: A3 Approval Block
    if (updatedStatus === 'Sent') {
      const unapprovedA3Items = items.filter(item => item.requires_a3_approval && !item.is_approved);
      if (unapprovedA3Items.length > 0) {
        toast({
          variant: "destructive",
          title: "Approval Required",
          description: `There are ${unapprovedA3Items.length} custom items that require founder approval (A3) before this quote can be sent.`
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      let quoteId = id;
      const totalAmount = calculateTotal();

      // Stage 6: Timestamp tracking
      const updates: any = {
        customer_id,
        status: updatedStatus,
        total_amount: totalAmount
      };

      if (updatedStatus === 'Sent' && status !== 'Sent') {
        updates.sent_at = new Date().toISOString();
      } else if (updatedStatus === 'Order' && status !== 'Order') {
        updates.order_converted_at = new Date().toISOString();
      }

      if (!quoteId) {
        const { data, error } = await supabase
          .from('quotations')
          .insert([updates])
          .select()
          .single();
        if (error) throw error;
        quoteId = data.id;
      } else {
        const { error } = await supabase
          .from('quotations')
          .update(updates)
          .eq('id', quoteId);
        if (error) throw error;
      }

      // Save items
      const itemsToSave = items.map(item => ({
        quotation_id: quoteId,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        requires_a3_approval: item.requires_a3_approval,
        is_approved: item.is_approved,
      }));

      // Simple approach: delete and recreate items for this quote
      if (quoteId) {
        await supabase.from('quotation_items').delete().eq('quotation_id', quoteId);
      }
      
      const { error: itemsError } = await supabase.from('quotation_items').insert(itemsToSave);
      if (itemsError) throw itemsError;

      toast({ title: "Saved Successfully", description: "Quotation and items have been updated." });
      if (!id) navigate(`/quotations/${quoteId}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {id ? 'Edit Quotation' : 'New Quotation'}
            </h1>
            <p className="text-slate-500">Build your quote and apply markups.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => saveQuote()}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
          >
            {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Quotation</>}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const data = items.map(i => ({
                SKU: i.sku,
                Description: i.description,
                Qty: i.quantity,
                UnitPrice: i.unit_price,
                Total: i.line_total
              }));
              exportToCSV(`AuraSpace-Quote-${id || 'new'}`, data, [
                { key: 'SKU', label: 'SKU' },
                { key: 'Description', label: 'Description' },
                { key: 'Qty', label: 'Quantity' },
                { key: 'UnitPrice', label: 'Unit Price' },
                { key: 'Total', label: 'Line Total' },
              ]);
            }}
            className="flex items-center gap-2"
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="flex items-center gap-2"
          >
            Print PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Quote Details
            </h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Customer</label>
              <Select value={customer_id} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Status</label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Sent">Sent</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Order">Order</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveQuote('Sent')}
                disabled={status === 'Sent' || isSaving}
                className="text-xs"
              >
                Mark Sent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveQuote('Order')}
                disabled={status === 'Order' || isSaving}
                className="text-xs"
              >
                Convert Order
              </Button>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4" /> Add Items
            </h3>
            <Select onValueChange={addItem}>
              <SelectTrigger>
                <SelectValue placeholder="Search SKU..." />
              </SelectTrigger>
              <SelectContent>
                {priceList.map(item => (
                  <SelectItem key={item.id} value={item.sku}>
                    {item.sku} - {item.description} (${item.base_cost})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead>Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Approval</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                          No items added to this quote.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, index) => (
                        <TableRow key={index} className="hover:bg-slate-50/50">
                          <TableCell>
                            <div className="font-medium">{item.sku}</div>
                            <div className="text-xs text-slate-500">{item.description}</div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-20 h-8"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value) || 0 })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24 h-8"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, { unit_price: parseFloat(e.target.value) || 0 })}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            ${item.line_total.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {item.requires_a3_approval ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="destructive" className="text-[10px]">A3 Req</Badge>
                                <input
                                  type="checkbox"
                                  checked={item.is_approved}
                                  onChange={(e) => updateItem(index, { is_approved: e.target.checked })}
                                />
                              </div>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">Standard</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="p-6 border-t bg-slate-50 flex justify-end items-center gap-4">
                  <div className="text-slate-600 font-medium">Grand Total:</div>
                  <div className="text-2xl font-bold text-indigo-900">${calculateTotal().toFixed(2)}</div>
                </div>
              </div>
            </div>
            <div className="xl:col-span-1">
              <AIAdvisorPanel
                quoteData={{
                  customerName: customers.find(c => c.id === customer_id)?.name || 'Unknown Customer',
                  items: items,
                  total: calculateTotal()
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
