import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import ImageUpload from '@/components/ImageUpload';
import { Link } from 'react-router-dom';
import { Users, Package, DollarSign, FileText, Loader2, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [kpis, setKpis] = useState({
    quotesSentThisWeek: 0,
    conversionRate: 0,
    avgTurnaroundMinutes: 0,
    founderActiveMinutesToday: 0,
  });

  useEffect(() => {
    if (user) {
      loadKpis();
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('logo_url').eq('id', user.id).maybeSingle();
    setLogoUrl(data?.logo_url || null);
  };

  const handleLogoUploaded = async (url: string) => {
    if (!user) return;
    await supabase.from('profiles').update({ logo_url: url }).eq('id', user.id);
    setLogoUrl(url);
  };

  const handleLogoRemoved = async () => {
    if (!user) return;
    await supabase.from('profiles').update({ logo_url: null }).eq('id', user.id);
    setLogoUrl(null);
  };

  const loadKpis = async () => {
    setIsLoading(true);
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: allQuotes } = await supabase
        .from('quotations')
        .select('status, created_at, sent_at');

      const quotes = allQuotes || [];

      const sentThisWeek = quotes.filter(
        q => q.sent_at && new Date(q.sent_at) >= sevenDaysAgo
      ).length;

      const sentOrOrdered = quotes.filter(q => q.status === 'Sent' || q.status === 'Order');
      const ordered = quotes.filter(q => q.status === 'Order');
      const conversionRate = sentOrOrdered.length > 0
        ? Math.round((ordered.length / sentOrOrdered.length) * 100)
        : 0;

      const sentQuotesWithTiming = quotes.filter(q => q.sent_at && q.created_at);
      const avgTurnaroundMinutes = sentQuotesWithTiming.length > 0
        ? Math.round(
            sentQuotesWithTiming.reduce((sum, q) => {
              const diffMs = new Date(q.sent_at!).getTime() - new Date(q.created_at).getTime();
              return sum + diffMs / 60000;
            }, 0) / sentQuotesWithTiming.length
          )
        : 0;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: timeLogs } = await supabase
        .from('founder_time_logs')
        .select('duration_minutes, start_time')
        .gte('start_time', todayStart.toISOString());

      const founderActiveMinutesToday = (timeLogs || []).reduce(
        (sum, log) => sum + (log.duration_minutes || 0), 0
      );

      setKpis({
        quotesSentThisWeek: sentThisWeek,
        conversionRate,
        avgTurnaroundMinutes,
        founderActiveMinutesToday,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <main className="flex-1 px-8 py-12">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground">Manage inquiries, quotations, and your catalogue from here.</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <ImageUpload
              currentUrl={logoUrl}
              folder="logo"
              onUploaded={handleLogoUploaded}
              onRemoved={handleLogoRemoved}
              label="Company Logo"
            />
          </div>
        </div>

        <div className="mb-10">
          <h3 className="text-lg font-semibold mb-4">Key Performance Indicators</h3>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="rounded-xl border bg-white p-6 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <FileText className="h-4 w-4" /> Quotes Sent This Week
                </div>
                <p className="text-3xl font-bold">{kpis.quotesSentThisWeek}</p>
              </div>

              <div className="rounded-xl border bg-white p-6 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <CheckCircle2 className="h-4 w-4" /> Quote-to-Order Conversion
                </div>
                <p className="text-3xl font-bold">{kpis.conversionRate}%</p>
              </div>

              <div className="rounded-xl border bg-white p-6 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TrendingUp className="h-4 w-4" /> Avg Turnaround (Inquiry→Sent)
                </div>
                <p className="text-3xl font-bold">
                  {kpis.avgTurnaroundMinutes < 60
                    ? `${kpis.avgTurnaroundMinutes}m`
                    : `${(kpis.avgTurnaroundMinutes / 60).toFixed(1)}h`}
                </p>
                <p className="text-xs text-muted-foreground">Target: 15 min (R-01)</p>
              </div>

              <div className="rounded-xl border bg-white p-6 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Clock className="h-4 w-4" /> Founder Active Minutes Today
                </div>
                <p className="text-3xl font-bold">{kpis.founderActiveMinutesToday}</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
