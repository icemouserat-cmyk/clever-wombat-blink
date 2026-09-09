import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { getOrderCompletionLabel, isOrderDone, getDaysOverdue } from '@/lib/statusLabels';
import { useToast } from '@/hooks/use-toast';

const PRODUCTION_BADGE_CLASS: Record<string, string> = {
  in_progress: 'border-blue-500 text-blue-700',
  ready_for_qc: 'border-amber-500 text-amber-700',
  delayed_escalation: 'border-destructive text-destructive',
  delivered: 'border-amber-500 text-amber-700',
  done: 'border-green-500 text-green-700',
};

const ProgressPage = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('quotations')
        .select(
          'id, total_amount, deposit_amount, production_status, expected_completion_date, workflow_state, balance_paid_at, customers(name), delivery_notes(delivery_note_number)'
        )
        .eq('status', 'Order')
        .not('production_status', 'is', null)
        .order('expected_completion_date', { ascending: true, nullsFirst: false });
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Failed to load Progress',
          description: error.message.includes('delivery_notes')
            ? 'The delivery_notes table is missing — run migration 0045 in the Supabase SQL Editor.'
            : error.message,
        });
      }
      setOrders(data || []);
      setIsLoading(false);
    };
    fetchOrders();
  }, [toast]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <main className="flex-1 px-8 py-12">
        <div className="container mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
            <p className="text-muted-foreground">Orders with a confirmed deposit — tracked through production to delivery.</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50 text-muted-foreground">
              No orders in production yet. They'll show up here once a deposit is confirmed on the Approvals page.
            </div>
          ) : (
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Customer</th>
                    <th className="text-left font-medium px-4 py-3">Production Status</th>
                    <th className="text-left font-medium px-4 py-3">Expected Completion</th>
                    <th className="text-left font-medium px-4 py-3">Delivery Note</th>
                    <th className="text-left font-medium px-4 py-3">Deposit / Total</th>
                    <th className="text-right font-medium px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2 font-medium">{order.customers?.name || 'Unknown'}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className={PRODUCTION_BADGE_CLASS[isOrderDone(order) ? 'done' : order.production_status || ''] || ''}>
                          {getOrderCompletionLabel(order)}
                        </Badge>
                        {getDaysOverdue(order) !== null && (
                          <div className="text-xs text-destructive mt-1">{getDaysOverdue(order)} day(s) overdue</div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {order.expected_completion_date ? format(new Date(order.expected_completion_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {order.delivery_notes?.[0]?.delivery_note_number || '—'}
                      </td>
                      <td className="px-4 py-2">
                        RM {Number(order.deposit_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} / RM{' '}
                        {Number(order.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/quotations/${order.id}`)} className="gap-2">
                          Open <ArrowRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProgressPage;
