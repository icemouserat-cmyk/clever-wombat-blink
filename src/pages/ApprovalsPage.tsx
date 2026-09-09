import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { resolvePendingAction } from '@/services/workflowEngine';
import { loadErpSettings, createErpSalesOrderFromQuotation } from '@/services/erpnextClient';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STAGE_LABELS: Record<string, string> = {
  W01_INQUIRY_TO_QUOTATION: 'W-01 Inquiry to Quotation',
  W02_DEPOSIT_TO_PRODUCTION: 'W-02 Deposit to Production',
  W03_PRODUCTION_TO_DELIVERY: 'W-03 Production to Delivery',
};

interface WorkflowActionRow {
  id: string;
  quotation_id: string;
  stage: string;
  action_type: string;
  hold_reason: string | null;
  entered_pending_at: string;
  decided_at: string | null;
  quotations?: {
    id: string;
    total_amount: number;
    deposit_amount: number | null;
    erpnext_quotation_id: string | null;
    expected_completion_date: string | null;
    customers?: { name: string } | null;
  } | null;
}

function getResolution(row: WorkflowActionRow, decision: 'approved' | 'rejected') {
  const key = `${row.stage}:${row.action_type}:${decision}`;
  switch (key) {
    case 'W01_INQUIRY_TO_QUOTATION:custom_approval:approved':
    case 'W01_INQUIRY_TO_QUOTATION:compliance_hold:approved':
      return {
        resultCode: 'W01_CUSTOM_APPROVED_SENT',
        quotationUpdates: { status: 'Sent', sent_at: new Date().toISOString(), workflow_state: 'W01_CUSTOM_APPROVED_SENT' },
      };
    case 'W01_INQUIRY_TO_QUOTATION:custom_approval:rejected':
    case 'W01_INQUIRY_TO_QUOTATION:compliance_hold:rejected':
      return { resultCode: 'W01_CUSTOM_REJECTED', quotationUpdates: { workflow_state: 'W01_CUSTOM_REJECTED' } };
    case 'W02_DEPOSIT_TO_PRODUCTION:deposit_confirmation:approved':
      return {
        resultCode: 'W02_PRODUCTION_TRIGGERED',
        quotationUpdates: { production_status: 'in_progress', deposit_confirmed_at: new Date().toISOString(), workflow_state: 'W02_PRODUCTION_TRIGGERED' },
      };
    case 'W02_DEPOSIT_TO_PRODUCTION:deposit_confirmation:rejected':
      return { resultCode: 'W02_DEPOSIT_NOT_CONFIRMED', quotationUpdates: { workflow_state: 'W02_DEPOSIT_NOT_CONFIRMED' } };
    case 'W03_PRODUCTION_TO_DELIVERY:delay_escalation:approved':
      return {
        resultCode: 'W03_ESCALATION_APPROVED_FACTORY_SWITCHED',
        quotationUpdates: { production_status: 'in_progress', workflow_state: 'W03_ESCALATION_APPROVED_FACTORY_SWITCHED' },
      };
    case 'W03_PRODUCTION_TO_DELIVERY:delay_escalation:rejected':
      return { resultCode: 'W03_ESCALATION_REJECTED', quotationUpdates: { workflow_state: 'W03_ESCALATION_REJECTED' } };
    case 'W03_PRODUCTION_TO_DELIVERY:qc_approval:approved':
      return {
        resultCode: 'W03_DELIVERED',
        quotationUpdates: { production_status: 'delivered', qc_approved_at: new Date().toISOString(), workflow_state: 'W03_DELIVERED' },
        generateBalanceInvoice: true,
        generateDeliveryNote: true,
      };
    case 'W03_PRODUCTION_TO_DELIVERY:qc_approval:rejected':
      return {
        resultCode: 'W03_QC_REJECTED_REWORK',
        quotationUpdates: { production_status: 'in_progress', workflow_state: 'W03_QC_REJECTED_REWORK' },
      };
    default:
      return { resultCode: decision === 'approved' ? 'APPROVED' : 'REJECTED', quotationUpdates: {} };
  }
}

const ApprovalsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [actions, setActions] = useState<WorkflowActionRow[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('workflow_actions')
      .select('*, quotations(id, total_amount, deposit_amount, erpnext_quotation_id, expected_completion_date, customers(name))')
      .is('decided_at', null)
      .order('entered_pending_at', { ascending: true });
    setActions(data || []);
    setIsLoading(false);
  };

  // Best-effort ERPNext sync (W-02) — runs after the deposit-confirmation decision is
  // already committed above, so a failure here never reverts it. Converts the ERPNext
  // Quotation created in W-01 into a Sales Order via ERPNext's own mapper; skipped
  // (silently) if ERPNext isn't configured, or if W-01 never produced a
  // erpnext_quotation_id to convert from.
  const syncErpSalesOrder = async (row: WorkflowActionRow) => {
    if (!user || !row.quotations?.erpnext_quotation_id) return;
    try {
      const settings = await loadErpSettings(user.id);
      if (!settings?.erpUrl) return;
      const erpSalesOrderId = await createErpSalesOrderFromQuotation(
        settings,
        row.quotations.erpnext_quotation_id,
        row.quotations.expected_completion_date ?? undefined
      );
      await supabase.from('quotations').update({ erpnext_sales_order_id: erpSalesOrderId }).eq('id', row.quotation_id);
      toast({ title: 'Synced to ERPNext', description: `Sales Order ${erpSalesOrderId} created in ERPNext.` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'ERPNext Sync Failed',
        description: error instanceof Error ? error.message : 'Unknown error connecting to ERPNext.',
      });
    }
  };

  const handleDecision = async (row: WorkflowActionRow, decision: 'approved' | 'rejected') => {
    if (!user) return;
    setResolvingId(row.id);
    try {
      const { resultCode, quotationUpdates, generateBalanceInvoice, generateDeliveryNote } = getResolution(row, decision);
      await resolvePendingAction({ actionId: row.id, decision, decidedBy: user.id, resultCode });

      if (Object.keys(quotationUpdates).length > 0) {
        await supabase.from('quotations').update(quotationUpdates).eq('id', row.quotation_id);
      }

      if (generateDeliveryNote) {
        const { error: dnError } = await supabase.from('delivery_notes').insert({
          user_id: user.id,
          quotation_id: row.quotation_id,
          delivery_note_number: `DN-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
        });
        if (dnError) throw dnError;
      }

      if (generateBalanceInvoice && row.quotations) {
        const balance = Number(row.quotations.total_amount || 0) - Number(row.quotations.deposit_amount || 0);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);
        const { error: invError } = await supabase.from('invoices').insert({
          user_id: user.id,
          quotation_id: row.quotation_id,
          invoice_number: `BAL-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
          due_date: dueDate.toISOString(),
          payment_status: 'Unpaid',
          paid_amount: 0,
          total_amount: balance,
          invoice_type: 'balance',
        });
        if (invError) throw invError;
      }

      toast({ title: decision === 'approved' ? 'Approved' : 'Rejected', description: `${STAGE_LABELS[row.stage] || row.stage} action resolved.` });
      await loadPending();

      if (row.stage === 'W02_DEPOSIT_TO_PRODUCTION' && row.action_type === 'deposit_confirmation' && decision === 'approved') {
        await syncErpSalesOrder(row);
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setResolvingId(null);
    }
  };

  const incidents = actions.filter((a) => a.action_type === 'compliance_incident');
  const actionable = actions.filter((a) => a.action_type !== 'compliance_incident');

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <AppSidebar />
        <main className="flex-1 px-8 py-12 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <main className="flex-1 px-8 py-12">
        <div className="container mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Founder Approvals</h1>
            <p className="text-muted-foreground">
              Every action here is a real founder decision — nothing here resolves itself. Elapsed time is recorded as founder minutes.
            </p>
          </div>

          {actionable.length === 0 && incidents.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50 text-muted-foreground">
              Nothing awaiting approval right now.
            </div>
          ) : (
            <div className="space-y-4">
              {actionable.map((row) => (
                <div key={row.id} className="rounded-xl border bg-white p-6 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{STAGE_LABELS[row.stage] || row.stage}</Badge>
                      {row.hold_reason && (
                        <Badge variant="outline" className={row.hold_reason === 'compliance' ? 'border-destructive text-destructive' : ''}>
                          {row.hold_reason === 'compliance' ? 'Compliance Hold' : 'Custom Item'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium">Customer: {row.quotations?.customers?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">Action: {row.action_type}</p>
                    {row.action_type === 'deposit_confirmation' && row.quotations?.deposit_amount != null && (
                      <p className="text-sm font-semibold text-emerald-700">
                        Deposit: RM {Number(row.quotations.deposit_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        {row.quotations?.total_amount != null && (
                          <span className="text-muted-foreground font-normal"> · Total: RM {Number(row.quotations.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Pending since {new Date(row.entered_pending_at).toLocaleString()}
                    </p>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate(`/quotations/${row.quotation_id}`)}>
                      Open quotation
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      disabled={resolvingId === row.id}
                      onClick={() => handleDecision(row, 'approved')}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 text-destructive border-destructive hover:bg-destructive/10"
                      disabled={resolvingId === row.id}
                      onClick={() => handleDecision(row, 'rejected')}
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                </div>
              ))}

              {incidents.length > 0 && (
                <div className="space-y-3 pt-4">
                  <h2 className="text-sm font-semibold text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Compliance Incidents (read-only — not an approval step)
                  </h2>
                  {incidents.map((row) => (
                    <div key={row.id} className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                      <p className="text-sm font-medium">Customer: {row.quotations?.customers?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {STAGE_LABELS[row.stage] || row.stage} · Logged {new Date(row.entered_pending_at).toLocaleString()}
                      </p>
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate(`/quotations/${row.quotation_id}`)}>
                        Open quotation to fix content
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ApprovalsPage;
