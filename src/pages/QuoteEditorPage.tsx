import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppSidebar from '@/components/AppSidebar';
import AIAdvisorPanel from '@/components/AIAdvisorPanel';
import { Loader2, FileText, CheckCircle, Plus } from 'lucide-react';
import { useQuoteTimeTracking } from '@/hooks/useQuoteTimeTracking';
import { useQuoteExport } from '@/hooks/useQuoteExport';
import QuoteHeader from '@/components/QuoteHeader';
import QuoteItemsTable from '@/components/QuoteItemsTable';
import {
  classifyQuotationItem,
  scanForComplianceViolations,
  classifyInquiryQuotation,
  evaluateProductionDelay,
  fetchDenylist,
  openPendingAction,
  logAutoAction,
  logComplianceIncident,
} from '@/services/workflowEngine';
import { getOrderCompletionLabel } from '@/lib/statusLabels';
import { loadErpSettings, createErpQuotation } from '@/services/erpnextClient';

const QuoteEditorPage = () => {
  const { id: quoteId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { exportCsv, exportPdf, exportFinalInvoicePdf } = useQuoteExport();
  useQuoteTimeTracking(quoteId, user?.id);

  const [isLoading, setIsLoading] = useState(true);
  const [quotation, setQuotation] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [priceList, setPriceList] = useState<any[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);

  const [selectedSku, setSelectedSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  const [denylist, setDenylist] = useState<string[]>([]);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [deliveryNote, setDeliveryNote] = useState<any>(null);

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

      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('quotation_id', quoteId)
        .order('created_at', { ascending: true });
      setInvoices(existingInvoices || []);

      // Best-effort: silently ignored if the delivery_notes table isn't there yet
      // (migration 0045 not yet applied) — the rest of the page still works fine.
      const { data: existingDeliveryNote } = await supabase
        .from('delivery_notes')
        .select('*')
        .eq('quotation_id', quoteId)
        .maybeSingle();
      setDeliveryNote(existingDeliveryNote || null);

      if (user) {
        const { data: profile } = await supabase.from('profiles').select('logo_url').eq('id', user.id).maybeSingle();
        setLogoUrl(profile?.logo_url || null);
      }

      setDenylist(await fetchDenylist());
      await refreshPendingActions();
      if (quote.deposit_amount) setDepositAmount(String(quote.deposit_amount));
      if (quote.expected_completion_date) setExpectedCompletionDate(quote.expected_completion_date);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPendingActions = async () => {
    const { data } = await supabase
      .from('workflow_actions')
      .select('*')
      .eq('quotation_id', quoteId)
      .order('created_at', { ascending: false });
    setPendingActions(data || []);
  };

  const refreshQuotationTotal = async () => {
    const { data, error } = await supabase.from('quotations').select('total_amount').eq('id', quoteId).single();
    if (error) throw error;
    setQuotation((prev) => ({ ...prev, total_amount: data.total_amount }));
  };

  const handleAddItem = async () => {
    if (!user || !selectedSku) return;
    const itemData = priceList.find(p => p.sku === selectedSku);
    if (!itemData) return;

    const requiresA3 = classifyQuotationItem(itemData.item_group) === 'A3';
    const markup = 0.19;
    const unitPrice = requiresA3
      ? (parseFloat(customPrice) || 0)
      : itemData.base_cost * (1 + markup);
    const lineTotal = unitPrice * quantity;

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
          description: requiresA3 ? customDescription : itemData.description,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await refreshQuotationTotal();
      setItems(prev => [...prev, newItem]);
      setSelectedSku('');
      setQuantity(1);
      setCustomPrice('');
      setCustomDescription('');
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

  const sendQuotationNow = async (resultCode: string) => {
    const { error } = await supabase
      .from('quotations')
      .update({ status: 'Sent', sent_at: new Date().toISOString(), workflow_state: resultCode })
      .eq('id', quoteId);
    if (error) throw error;
    setQuotation((prev) => ({ ...prev, status: 'Sent', workflow_state: resultCode }));
    toast({ title: 'Quotation Sent', description: 'The quotation has been marked as Sent.' });

    // Best-effort: the quotation is already Sent regardless of whether this succeeds.
    // Email delivery is logged separately (email_log) and never gates the send status.
    supabase.functions.invoke('gmail-send-quotation', { body: { quotationId: quoteId } }).catch(() => {});

    // Best-effort ERPNext sync (W-01) — never blocks the Sent status above, which is
    // already committed. Unlike the Gmail send, this shows a toast either way since
    // the founder needs to see whether the ERPNext write actually succeeded.
    syncErpQuotation();
  };

  const syncErpQuotation = async () => {
    if (!user || !customer || !quoteId) return;
    try {
      const settings = await loadErpSettings(user.id);
      if (!settings?.erpUrl) return;
      const erpQuotationId = await createErpQuotation(
        settings,
        customer.name,
        items.map((i) => ({ sku: i.sku, description: i.description, quantity: i.quantity, unit_price: i.unit_price }))
      );
      await supabase.from('quotations').update({ erpnext_quotation_id: erpQuotationId }).eq('id', quoteId);
      setQuotation((prev) => ({ ...prev, erpnext_quotation_id: erpQuotationId }));
      toast({ title: 'Synced to ERPNext', description: `Quotation ${erpQuotationId} created in ERPNext.` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'ERPNext Sync Failed',
        description: error instanceof Error ? error.message : 'Unknown error connecting to ERPNext.',
      });
    }
  };

  const handleMarkAsSent = async () => {
    if (!user || !quotation) return;
    const text = [quotation.notes, ...items.map((i) => i.description)].filter(Boolean).join('\n');
    const { flagged } = scanForComplianceViolations(text, denylist);
    const itemGroups = items
      .map((i) => priceList.find((p) => p.sku === i.sku)?.item_group)
      .filter(Boolean) as string[];
    const { classification, resultCode, holdReason } = classifyInquiryQuotation(itemGroups, flagged);

    try {
      if (classification === 'A2') {
        await logAutoAction({
          userId: user.id,
          quotationId: quoteId!,
          stage: 'W01_INQUIRY_TO_QUOTATION',
          actionType: 'auto_draft_sent',
          resultCode,
        });
        await sendQuotationNow(resultCode);
        return;
      }

      const latestW01Action = pendingActions.find((a) => a.stage === 'W01_INQUIRY_TO_QUOTATION');
      if (latestW01Action && latestW01Action.decided_at && latestW01Action.decision === 'approved') {
        await sendQuotationNow(latestW01Action.result_code);
        return;
      }
      if (latestW01Action && !latestW01Action.decided_at) {
        toast({ title: 'Awaiting Founder Approval', description: 'This quotation is still pending review on the Approvals page.' });
        return;
      }

      await openPendingAction({
        userId: user.id,
        quotationId: quoteId!,
        stage: 'W01_INQUIRY_TO_QUOTATION',
        actionType: holdReason === 'compliance' ? 'compliance_hold' : 'custom_approval',
        resultCode,
        holdReason: holdReason!,
      });
      await supabase.from('quotations').update({ workflow_state: resultCode }).eq('id', quoteId);
      setQuotation((prev) => ({ ...prev, workflow_state: resultCode }));
      await refreshPendingActions();
      toast({
        variant: 'destructive',
        title: holdReason === 'compliance' ? 'Compliance Hold' : 'A3 Approval Required',
        description:
          holdReason === 'compliance'
            ? 'This quotation mentions a specific bank, escrow account, or regulatory body and requires founder review before it can be sent.'
            : 'This quotation includes custom items and requires explicit founder approval before sending. Review it on the Approvals page.',
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleMarkAsOrder = async () => {
    try {
      const { error } = await supabase
        .from('quotations')
        .update({ status: 'Order' })
        .eq('id', quoteId);
      if (error) throw error;
      setQuotation((prev) => ({ ...prev, status: 'Order' }));
      toast({ title: 'Order Confirmed', description: 'Quotation converted to a confirmed Order.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleGenerateInvoice = async () => {
    if (!user || !quotation) return;
    try {
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      const { data: newInvoice, error } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          quotation_id: quoteId,
          invoice_number: invoiceNumber,
          due_date: dueDate.toISOString(),
          payment_status: 'Unpaid',
          paid_amount: 0,
          total_amount: quotation.total_amount,
        })
        .select()
        .single();

      if (error) throw error;
      setInvoices((prev) => [...prev, newInvoice]);
      toast({ title: 'Invoice Generated', description: `${invoiceNumber} created, due in 14 days.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleMarkAsPaid = async (invoiceId: string, totalAmount: number, invoiceType?: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ payment_status: 'Paid', paid_amount: totalAmount })
        .eq('id', invoiceId);
      if (error) throw error;
      const updatedInvoices = invoices.map((inv) => (inv.id === invoiceId ? { ...inv, payment_status: 'Paid', paid_amount: totalAmount } : inv));
      setInvoices(updatedInvoices);

      // The balance invoice being paid is what actually completes the order — QC
      // approval alone only marks it physically delivered, not financially done.
      if (invoiceType === 'balance') {
        const paidAt = new Date().toISOString();
        await supabase.from('quotations').update({ balance_paid_at: paidAt }).eq('id', quoteId);
        setQuotation((prev) => ({ ...prev, balance_paid_at: paidAt }));

        const depositInvoice = updatedInvoices.find((inv) => inv.invoice_type === 'deposit');
        const balanceInvoice = updatedInvoices.find((inv) => inv.id === invoiceId);
        const pdfDataUri = await exportFinalInvoicePdf({ ...quotation, balance_paid_at: paidAt }, customer, items, logoUrl, depositInvoice, balanceInvoice);

        // Best-effort: the PDF is already downloaded locally regardless of whether
        // emailing it to the customer succeeds.
        const pdfBase64 = pdfDataUri?.match(/base64,(.*)$/)?.[1];
        if (pdfBase64) {
          supabase.functions.invoke('gmail-send-final-invoice', { body: { quotationId: quoteId, pdfBase64 } }).catch(() => {});
        }
      }

      toast({ title: 'Payment Recorded', description: 'Invoice marked as fully paid.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleSubmitDeposit = async () => {
    if (!user || !quotation || !depositAmount || !expectedCompletionDate) return;
    const text = [quotation.notes, ...items.map((i) => i.description)].filter(Boolean).join('\n');
    const { flagged, matches } = scanForComplianceViolations(text, denylist);

    try {
      if (flagged) {
        await logComplianceIncident({
          userId: user.id,
          quotationId: quoteId!,
          stage: 'W02_DEPOSIT_TO_PRODUCTION',
          resultCode: 'W02_BLOCKED_COMPLIANCE_VIOLATION',
        });
        await supabase.from('quotations').update({ workflow_state: 'W02_BLOCKED_COMPLIANCE_VIOLATION' }).eq('id', quoteId);
        setQuotation((prev) => ({ ...prev, workflow_state: 'W02_BLOCKED_COMPLIANCE_VIOLATION' }));
        await refreshPendingActions();
        toast({
          variant: 'destructive',
          title: 'Compliance Violation — Blocked',
          description: `Deposit transition blocked (${matches.join(', ')}). This is logged as a compliance incident, not an approval step — fix the quotation content before retrying.`,
        });
        return;
      }

      const amount = parseFloat(depositAmount);
      await openPendingAction({
        userId: user.id,
        quotationId: quoteId!,
        stage: 'W02_DEPOSIT_TO_PRODUCTION',
        actionType: 'deposit_confirmation',
        resultCode: 'W02_PENDING_DEPOSIT_CONFIRMATION',
      });
      await supabase
        .from('quotations')
        .update({ deposit_amount: amount, expected_completion_date: expectedCompletionDate, workflow_state: 'W02_PENDING_DEPOSIT_CONFIRMATION' })
        .eq('id', quoteId);
      await supabase.from('invoices').insert({
        user_id: user.id,
        quotation_id: quoteId,
        invoice_number: `DEP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
        due_date: new Date().toISOString(),
        payment_status: 'Unpaid',
        paid_amount: 0,
        total_amount: amount,
        invoice_type: 'deposit',
      });
      setQuotation((prev) => ({
        ...prev,
        deposit_amount: amount,
        expected_completion_date: expectedCompletionDate,
        workflow_state: 'W02_PENDING_DEPOSIT_CONFIRMATION',
      }));
      await refreshPendingActions();
      toast({ title: 'Deposit Recorded', description: 'Awaiting explicit founder confirmation on the Approvals page before production starts.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleMarkReadyForQC = async () => {
    if (!user || !quotation) return;
    try {
      await openPendingAction({
        userId: user.id,
        quotationId: quoteId!,
        stage: 'W03_PRODUCTION_TO_DELIVERY',
        actionType: 'qc_approval',
        resultCode: 'W03_PENDING_QC_APPROVAL',
      });
      await supabase.from('quotations').update({ production_status: 'ready_for_qc', workflow_state: 'W03_PENDING_QC_APPROVAL' }).eq('id', quoteId);
      setQuotation((prev) => ({ ...prev, production_status: 'ready_for_qc', workflow_state: 'W03_PENDING_QC_APPROVAL' }));
      await refreshPendingActions();
      toast({ title: 'Marked Ready for QC', description: 'Awaiting founder final QC approval before the delivery note and balance invoice are generated.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  useEffect(() => {
    if (!user || !quotation || !quoteId) return;
    if (quotation.production_status !== 'in_progress' || !quotation.expected_completion_date) return;
    const alreadyEscalated = pendingActions.some((a) => a.stage === 'W03_PRODUCTION_TO_DELIVERY' && a.action_type === 'delay_escalation' && !a.decided_at);
    if (alreadyEscalated || !evaluateProductionDelay(quotation.expected_completion_date)) return;

    (async () => {
      await openPendingAction({
        userId: user.id,
        quotationId: quoteId,
        stage: 'W03_PRODUCTION_TO_DELIVERY',
        actionType: 'delay_escalation',
        resultCode: 'W03_PENDING_DELAY_ESCALATION',
      });
      await supabase.from('quotations').update({ production_status: 'delayed_escalation', workflow_state: 'W03_PENDING_DELAY_ESCALATION' }).eq('id', quoteId);
      setQuotation((prev) => ({ ...prev, production_status: 'delayed_escalation', workflow_state: 'W03_PENDING_DELAY_ESCALATION' }));
      await refreshPendingActions();

      // Best-effort: the internal escalation above is already committed regardless of
      // whether this customer-facing courtesy email succeeds. Sent immediately, not
      // gated on founder approval — a separate decision from the internal escalation.
      supabase.functions.invoke('gmail-send-delay-notice', { body: { quotationId: quoteId } }).catch(() => {});
    })();
  }, [user, quotation?.production_status, quotation?.expected_completion_date, quoteId]);

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

  const selectedItemData = priceList.find(p => p.sku === selectedSku);
  const isCustomItem = selectedItemData?.item_group === 'Furniture - Custom';

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
            onMarkAsOrder={handleMarkAsOrder}
            onGenerateInvoice={handleGenerateInvoice}
            invoice={invoices[0] || null}
          />

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
                  {isCustomItem && (
                    <>
                      <div className="space-y-2">
                        <Label>Custom Description</Label>
                        <Input 
                          value={customDescription} 
                          onChange={(e) => setCustomDescription(e.target.value)} 
                          placeholder="e.g. Custom ergonomic chair with leather finish"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Custom Price (RM) — agreed with customer</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={customPrice}
                          onChange={(e) => setCustomPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                          placeholder="e.g. 5000"
                        />
                        <p className="text-xs text-muted-foreground">
                          This item has no fixed catalogue price. Enter the price agreed
                          with the customer for this specific quotation.
                        </p>
                      </div>
                    </>
                  )}
                  <Button 
                    className="w-full" 
                    onClick={handleAddItem} 
                    disabled={!selectedSku || (isCustomItem && (!customPrice || parseFloat(customPrice) <= 0))}
                  >
                    Add to Quotation
                  </Button>
                </div>
              </div>
              <AIAdvisorPanel quotation={quotation} customer={customer} items={items} />
              
              {invoices.map((inv) => (
                <div key={inv.id} className="rounded-xl border bg-white p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {inv.invoice_number}
                      {inv.invoice_type && inv.invoice_type !== 'full' && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground uppercase">{inv.invoice_type}</span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${inv.payment_status === 'Paid' ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />
                      <Badge className={inv.payment_status === 'Paid' ? 'bg-green-500' : 'bg-orange-500'}>
                        {inv.payment_status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Due: {new Date(inv.due_date).toLocaleDateString()}
                  </p>
                  <p className="text-lg font-bold">
                    RM {Number(inv.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  {inv.payment_status !== 'Paid' && (
                    <Button size="sm" className="w-full" onClick={() => handleMarkAsPaid(inv.id, inv.total_amount, inv.invoice_type)}>
                      Mark as Paid
                    </Button>
                  )}
                </div>
              ))}

              {quotation?.status === 'Order' && !quotation?.production_status && (
                <div className="rounded-xl border bg-white p-6 space-y-3">
                  <h3 className="text-sm font-semibold">Deposit &amp; Production Trigger (W-02)</h3>
                  {quotation?.workflow_state === 'W02_BLOCKED_COMPLIANCE_VIOLATION' ? (
                    <p className="text-sm text-destructive">
                      Blocked: this quotation's content triggered a compliance hold. Logged as an incident — edit the quotation content, then retry.
                    </p>
                  ) : quotation?.workflow_state === 'W02_PENDING_DEPOSIT_CONFIRMATION' ? (
                    <p className="text-sm text-muted-foreground">Awaiting explicit founder confirmation on the Approvals page.</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Deposit Amount (RM, 30% of total)</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                          placeholder={String(Math.round((quotation?.total_amount || 0) * 0.3))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Completion Date</Label>
                        <Input type="date" value={expectedCompletionDate} onChange={(e) => setExpectedCompletionDate(e.target.value)} />
                      </div>
                      <Button className="w-full" onClick={handleSubmitDeposit} disabled={!depositAmount || !expectedCompletionDate}>
                        Record Deposit &amp; Trigger Review
                      </Button>
                    </>
                  )}
                </div>
              )}

              {quotation?.production_status && (
                <div className="rounded-xl border bg-white p-6 space-y-3">
                  <h3 className="text-sm font-semibold">Production &amp; Delivery (W-03)</h3>
                  <p className="text-sm">
                    Status: <span className="font-medium">{getOrderCompletionLabel(quotation)}</span>
                  </p>
                  {quotation.expected_completion_date && (
                    <p className="text-xs text-muted-foreground">Expected completion: {quotation.expected_completion_date}</p>
                  )}
                  {deliveryNote ? (
                    <p className="text-xs text-muted-foreground">
                      Delivery Note: <span className="font-medium text-foreground">{deliveryNote.delivery_note_number}</span> — delivered{' '}
                      {new Date(deliveryNote.delivery_date).toLocaleDateString()}
                    </p>
                  ) : (
                    quotation.production_status && quotation.production_status !== 'not_started' && (
                      <p className="text-xs text-muted-foreground">Delivery Note: not yet generated (created automatically on QC approval).</p>
                    )
                  )}
                  {quotation.production_status === 'delayed_escalation' && (
                    <p className="text-sm text-destructive">
                      Production is more than 2 weeks past the expected completion date. Escalated for founder review on the Approvals page.
                    </p>
                  )}
                  {quotation.production_status === 'ready_for_qc' && (
                    <p className="text-sm text-muted-foreground">Awaiting founder final QC approval on the Approvals page.</p>
                  )}
                  {quotation.production_status === 'delivered' && !quotation.balance_paid_at && (
                    <p className="text-sm text-amber-600">QC approved, delivery note and balance invoice generated — awaiting balance payment below.</p>
                  )}
                  {quotation.production_status === 'delivered' && quotation.balance_paid_at && (
                    <p className="text-sm text-green-600">Done — balance paid, order complete.</p>
                  )}
                  {quotation.production_status === 'in_progress' && (
                    <Button className="w-full" onClick={handleMarkReadyForQC}>
                      Mark Ready for QC
                    </Button>
                  )}
                </div>
              )}

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
