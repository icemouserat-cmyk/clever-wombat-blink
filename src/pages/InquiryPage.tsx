import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import InquiryForm from '@/components/InquiryForm';
import InquiryList from '@/components/InquiryList';
import EmailInquiriesList from '@/components/EmailInquiriesList';
import QuoteRecommender from '@/components/QuoteRecommender';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const POLL_INTERVAL_MS = 2 * 60 * 1000;

const InquiryPage = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [emailRefreshKey, setEmailRefreshKey] = useState(0);
  const location = useLocation();
  const prefill = (location.state as { inquiryId?: string; name?: string; email?: string; staffSize?: number | null } | null) || null;
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchCustomers = async () => {
      const { data } = await supabase
        .from('customers')
        .select('name, referral_source, staff_size')
        .order('created_at', { ascending: false });
      setCustomers(data || []);
    };
    fetchCustomers();
  }, []);

  const checkInboxNow = async (manual = false) => {
    if (!user) return;
    setIsPolling(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-poll-inbox', { body: { userId: user.id } });
      if (error) {
        let detail = error.message;
        try {
          const body = await error.context?.json();
          if (body?.error) detail = body.error;
        } catch {
          /* ignore — fall back to error.message */
        }
        toast({ variant: 'destructive', title: 'Inbox check failed', description: detail });
      } else if (manual) {
        toast({ title: 'Inbox checked', description: `Found ${data?.checked ?? 0} message(s), ${data?.created ?? 0} new inquiry(ies).` });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Inbox check failed', description: err.message });
    } finally {
      setIsPolling(false);
      setEmailRefreshKey((k) => k + 1);
    }
  };

  useEffect(() => {
    if (!user) return;
    checkInboxNow();
    const interval = setInterval(checkInboxNow, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <main className="flex-1 px-8 py-12">
        <div className="container mx-auto space-y-10">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Customer Inquiries</h1>
              <p className="text-muted-foreground">Capture new qualified inquiries and initiate the quotation process.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => checkInboxNow(true)} disabled={isPolling} className="gap-2 shrink-0">
              {isPolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Check Inbox Now
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-5 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Capture New Lead</h2>
                <InquiryForm
                  key={prefill?.inquiryId || 'blank'}
                  prefillName={prefill?.name}
                  prefillEmail={prefill?.email}
                  prefillStaffSize={prefill?.staffSize ?? undefined}
                  sourceInquiryId={prefill?.inquiryId}
                />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-4">New Email Inquiries (justinhau0711@gmail.com)</h2>
                <EmailInquiriesList refreshKey={emailRefreshKey} />
              </div>
              <QuoteRecommender customers={customers} />
            </div>
            <div className="lg:col-span-7 space-y-4">
              <h2 className="text-xl font-semibold">Recent Inquiries</h2>
              <InquiryList />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InquiryPage;
