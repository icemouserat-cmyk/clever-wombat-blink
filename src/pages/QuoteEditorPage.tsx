import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import AppSidebar from '@/components/AppSidebar';
import AIAdvisorPanel from '@/components/AIAdvisorPanel';
import { Loader2, FileText } from 'lucide-react';
import { useQuoteTimeTracking } from '@/hooks/useQuoteTimeTracking';
import { useQuoteExport } from '@/hooks/useQuoteExport';
import QuoteHeader from '@/components/QuoteHeader';
import QuoteItemManager from '@/components/QuoteItemManager';
import QuoteItemsTable from '@/components/QuoteItemsTable';

const QuoteEditorPage = () => {
  const { id: quoteId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { exportCsv, exportPdf } = useQuoteExport();
  useQuoteTimeTracking(quoteId, user?.id);

  const [isLoading, setIsLoading] = useState(true);
  const [quotation, setQuotation] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [priceList, setPriceList] = useState<any[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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

  const handleAddItem = async (sku: string, quantity: number) => {
    if (!user) return;
    const itemData = priceList.find(p => p.sku === sku);
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
          sku: sku,
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
      toast({ title: 'Item Added', description: `Added ${sku} to quotation.` });
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <AppSidebar />
        <main className="flex-1 px-8 py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <main className="flex-1 px-8 py-12">
        <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8">
          <QuoteHeader 
            quotation={quotation} 
            customer={customer} 
            onExportCsv={() => exportCsv(quotation, customer, items)}
            onExportPdf={() => exportPdf(quotation, customer, items, logoUrl)}
            onMarkAsSent={handleMarkAsSent}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <QuoteItemManager priceList={priceList} onAddItem={handleAddItem} />
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
              <QuoteItemsTable 
                items={items} 
                onRemoveItem={handleRemoveItem} 
                onToggleApproval={handleToggleApproval} 
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default QuoteEditorPage;
