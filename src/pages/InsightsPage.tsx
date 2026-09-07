import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, WifiOff, AlertTriangle } from 'lucide-react';

type SummaryStatus = 'idle' | 'not_configured' | 'offline' | 'error';

const InsightsPage = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<{ endpoint: string; model: string } | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);

  const [overviewSummary, setOverviewSummary] = useState('');
  const [overviewStatus, setOverviewStatus] = useState<SummaryStatus>('idle');
  const [isGeneratingOverview, setIsGeneratingOverview] = useState(false);

  const [quotationsSummary, setQuotationsSummary] = useState('');
  const [quotationsStatus, setQuotationsStatus] = useState<SummaryStatus>('idle');
  const [isGeneratingQuotations, setIsGeneratingQuotations] = useState(false);

  const [customersSummary, setCustomersSummary] = useState('');
  const [customersStatus, setCustomersStatus] = useState<SummaryStatus>('idle');
  const [isGeneratingCustomers, setIsGeneratingCustomers] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setIsConfigLoading(true);
      if (user) {
        const { data } = await supabase
          .from('app_config')
          .select('*')
          .eq('key', `ollama_settings_${user.id}`)
          .maybeSingle();
        if (data?.value) {
          try {
            const parsed = JSON.parse(data.value);
            if (parsed.endpoint && parsed.model) setSettings(parsed);
          } catch {}
        }
      }
      setIsConfigLoading(false);
    };
    loadSettings();
  }, [user]);

  const callOllama = async (systemPrompt: string, userContent: string): Promise<{ result: string; status: SummaryStatus }> => {
    if (!settings) return { result: '', status: 'not_configured' };
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const cleanEndpoint = settings.endpoint.trim().replace(/\/+$/, '');

      const res = await fetch(`${cleanEndpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { result: data.message?.content || 'No response content received.', status: 'idle' };
    } catch (err: any) {
      return { result: '', status: err.name === 'AbortError' ? 'offline' : 'error' };
    }
  };

  const generateOverview = async () => {
    if (!user) return;
    setIsGeneratingOverview(true);
    setOverviewSummary('');
    setOverviewStatus('idle');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: quotes } = await supabase.from('quotations').select('status, created_at, sent_at, total_amount');
    const { data: customers } = await supabase.from('customers').select('id, created_at');
    const { data: items } = await supabase.from('quotation_items').select('requires_a3_approval, is_approved');

    const q = quotes || [];
    const inquiriesThisWeek = (customers || []).filter(c => new Date(c.created_at) >= sevenDaysAgo).length;
    const sentThisWeek = q.filter(x => x.sent_at && new Date(x.sent_at) >= sevenDaysAgo).length;
    const totalDraft = q.filter(x => x.status === 'Draft').length;
    const totalSent = q.filter(x => x.status === 'Sent').length;
    const pendingA3 = (items || []).filter(i => i.requires_a3_approval && !i.is_approved).length;
    const totalValue = q.reduce((sum, x) => sum + Number(x.total_amount || 0), 0);

    const systemPrompt = `You are a business overview advisor for AuraSpace. You are given ONLY the recorded
counts below. Summarize the founder's current business state in 3-4 concise sentences. Do not invent
customer names, specific amounts beyond what is given, or commitments. If a number is zero, say so plainly
rather than omitting it.`;

    const userContent = `New inquiries this week: ${inquiriesThisWeek}
Quotations sent this week: ${sentThisWeek}
Draft quotations (not yet sent): ${totalDraft}
Sent quotations (total): ${totalSent}
Line items pending A3 approval: ${pendingA3}
Total value across all quotations (RM): ${totalValue.toFixed(2)}`;

    const { result, status } = await callOllama(systemPrompt, userContent);
    setOverviewSummary(// result
    setOverviewStatus(status);
    setIsGeneratingOverview(false);
  };

  const generateQuotationsSummary = async () => {
    setIsGeneratingQuotations(true);
    setQuotationsSummary('');
    setQuotationsStatus('idle');

    const { data: quotes } = await supabase.from('quotations').select('status, total_amount, created_at, sent_at').order('created_at', { ascending: true });
    const q = quotes || [];

    const byStatus: Record<string, number> = {};
    q.forEach(x => { byStatus[x.status] = (byStatus[x.status] || 0) + 1; });
    const totalValue = q.reduce((sum, x) => sum + Number(x.total_amount || 0), 0);
    const oldestDraft = q.find(x => x.status === 'Draft');

    const systemPrompt = `You are a quotations pipeline advisor for AuraSpace. You are given ONLY the recorded
data below. Summarize the state of the quotation pipeline in 3-4 concise sentences, noting the status
breakdown and flagging if any draft quotation looks like it has been sitting too long. Do not invent
customer names or specific items. If there is no oldest draft, say there are no pending drafts.`;

    const userContent = `Total quotations: ${q.length}
Status breakdown: ${JSON.stringify(byStatus)}
Total value across all quotations (RM): ${totalValue.toFixed(2)}
Oldest still-Draft quotation created at: ${oldestDraft ? oldestDraft.created_at : 'none'}`;

    const { result, status } = await callOllama(systemPrompt, userContent);
    setQuotationsSummary(result);
    setQuotationsStatus(status);
    setIsGeneratingQuotations(false);
  };

  const generateCustomersSummary = async () => {
    setIsGeneratingCustomers(true);
    setCustomersSummary('');
    setCustomersStatus('idle');

    const { data: customers } = await supabase.from('customers').select('referral_source, staff_size, created_at');
    const c = customers || [];

    const bySource: Record<string, number> = {};
    c.forEach(x => { bySource[x.referral_source] = (bySource[x.referral_source] || 0) + 1; });
    const avgStaffSize = c.length > 0 ? Math.round(c.reduce((sum, x) => sum + (x.staff_size || 0), 0) / c.length) : 0;

    const systemPrompt = `You are a customer base advisor for AuraSpace. You are given ONLY the recorded data
below. Summarize the customer base in 3-4 concise sentences, noting referral source mix and typical staff
size. Do not invent specific customer names or details not given.`;

    const userContent = `Total customers: ${c.length}
Referral source breakdown: ${JSON.stringify(bySource)}
Average staff size: ${avgStaffSize}`;

    const { result, status } = await callOllama(systemPrompt, userContent);
    setCustomersSummary(result);
    setCustomersStatus(status);
    setIsGeneratingCustomers(false);
  };

  const renderStatus = (status: SummaryStatus) => {
    if (status === 'not_configured') return <div className="flex items-center gap-2 text-xs text-muted-foreground"><WifiOff className="h-3 w-3" /> Configure the AI Advisor in Settings first.</div>;
    if (status === 'offline') return <div className="flex items-center gap-2 text-xs text-destructive"><WifiOff className="h-3 w-3" /> Ollama did not respond in time.</div>;
    if (status === 'error') return <div className="flex items-center gap-2 text-xs text-destructive"><AlertTriangle className="h-3 w-3" /> Could not reach the AI advisor.</div>;
    return null;
  };

  if (isConfigLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <AppSidebar />
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <main className="flex-1 px-8 py-12">
        <div className="container mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Insights</h1>
            <p className="text-muted-foreground">Grounded summaries of your business, quotations, and customers.</p>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Business Overview</TabsTrigger>
              <TabsTrigger value="quotations">Quotations</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="rounded-xl border bg-white p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-500" /> Business Overview</h3>
                  <Button size="sm" variant="outline" onClick={generateOverview} disabled={isGeneratingOverview}>
                    {isGeneratingOverview ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
                  </Button>
                </div>
                {renderStatus(overviewStatus)}
                {overviewSummary && <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{overviewSummary}</div>}
              </div>
            </TabsContent>

            <TabsContent value="quotations" className="space-y-4">
              <div className="rounded-xl border bg-white p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-500" /> Quotations Summary</h3>
                  <Button size="sm" variant="outline" onClick={generateQuotationsSummary} disabled={isGeneratingQuotations}>
                    {isGeneratingQuotations ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
                  </Button>
                </div>
                {renderStatus(quotationsStatus)}
                {quotationsSummary && <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{quotationsSummary}</div>}
              </div>
            </TabsContent>

            <TabsContent value="customers" className="space-y-4">
              <div className="rounded-xl border bg-white p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-500" /> Customers Summary</h3>
                  <Button size="sm" variant="outline" onClick={generateCustomersSummary} disabled={isGeneratingCustomers}>
                    {isGeneratingCustomers ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
                  </Button>
                </div>
                {renderStatus(customersStatus)}
                {customersSummary && <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{customersSummary}</div>}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default InsightsPage;
