import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Timer, 
  ArrowUpRight, 
  AlertCircle 
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';

interface KPIProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  trend?: { value: string; isPositive: boolean };
  status?: 'good' | 'warning' | 'danger';
}

function KPICard({ title, value, icon, description, trend, status }: KPIProps) {
  return (
    <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            {icon}
          </div>
          {trend && (
            <div className={`flex items-center text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value} <ArrowUpRight className={`w-3 h-3 ${trend.isPositive ? '' : 'rotate-90'}`} />
            </div>
          )}
        </div>
        <CardTitle className="text-sm font-medium text-slate-500 mt-4">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">{value}</div>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
        {status === 'danger' && (
          <div className="mt-3 flex items-center gap-1 text-red-500 text-[10px] font-medium">
            <AlertCircle className="w-3 h-3" /> Target: 15m turnaround
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<{
    sent: number;
    turnaround: string;
    conversion: string;
    activeMinutes: number;
  }>({ sent: 0, turnaround: '0m', conversion: '0%', activeMinutes: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const startWeek = startOfWeek(new Date());
      const endWeek = endOfWeek(new Date());
      const startDay = startOfDay(new Date());
      const endDay = endOfDay(new Date());

      // 1. Quotes Sent this week
      const { data: sentQuotes, error: sentError } = await supabase
        .from('quotations')
        .select('id, created_at, sent_at')
        .gte('sent_at', startWeek.toISOString())
        .lte('sent_at', endWeek.toISOString());
      
      if (sentError) throw sentError;

      // 2. Turnaround Time (Avg sent_at - created_at)
      let avgTurnaround = 0;
      if (sentQuotes && sentQuotes.length > 0) {
        const totalMs = sentQuotes.reduce((acc, q) => {
          return acc + (new Date(q.sent_at!).getTime() - new Date(q.created_at).getTime());
        }, 0);
        avgTurnaround = totalMs / sentQuotes.length;
      }

      // 3. Conversion Rate (Order / Sent)
      const { data: allSent, error: allSentError } = await supabase
        .from('quotations')
        .select('status')
        .neq('status', 'Draft');
      
      if (allSentError) throw allSentError;

      const orders = allSent?.filter(q => q.status === 'Order').length || 0;
      const sent = allSent?.length || 0;
      const conversionRate = sent > 0 ? ((orders / sent) * 100).toFixed(1) : '0';

      // 4. Active Minutes today
      const { data: timeLogs, error: logsError } = await supabase
        .from('founder_time_logs')
        .select('duration_minutes')
        .gte('start_time', startDay.toISOString())
        .lte('start_time', endDay.toISOString());
      
      if (logsError) throw logsError;
      const totalMinutes = timeLogs?.reduce((acc, log) => acc + (log.duration_minutes || 0), 0) || 0;

      // Recent Activity
      const { data: activity, error: actError } = await supabase
        .from('quotations')
        .select('*, customers(name)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (actError) throw actError;

      setKpis({
        sent: sentQuotes?.length || 0,
        turnaround: `${Math.round(avgTurnaround / (1000 * 60))}m`,
        conversion: `${conversionRate}%`,
        activeMinutes: totalMinutes,
      });
      setRecentActivity(activity || []);

    } catch (error: any) {
      console.error("Dashboard error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading analytics...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900">Founder's Console</h1>
        <p className="text-slate-500">Real-time operational metrics and pipeline overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Quotes Sent" 
          value={kpis.sent} 
          icon={<FileText className="w-5 h-5" />} 
          description="Current week" 
          trend={{ value: '+12%', isPositive: true }}
        />
        <KPICard 
          title="Avg. Turnaround" 
          value={kpis.turnaround} 
          icon={<Clock className="w-5 h-5" />} 
          description="Sent vs Created" 
          status={parseInt(kpis.turnaround) > 15 ? 'danger' : 'good'}
        />
        <KPICard 
          title="Conversion Rate" 
          value={kpis.conversion} 
          icon={<CheckCircle2 className="w-5 h-5" />} 
          description="Order / Sent" 
          trend={{ value: '+2.4%', isPositive: true }}
        />
        <KPICard 
          title="Active Time" 
          value={`${kpis.activeMinutes}m`} 
          icon={<Timer className="w-5 h-5" />} 
          description="Logged today" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800">Recent Activity</h3>
              <Badge variant="outline" className="text-xs font-medium">Last 5 Quotes</Badge>
            </div>
            <div className="divide-y">
              {recentActivity.length === 0 ? (
                <div className="p-10 text-center text-slate-400">No recent quotations found.</div>
              ) : (
                recentActivity.map((quote) => (
                  <div key={quote.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        quote.status === 'Order' ? 'bg-green-500' : 
                        quote.status === 'Sent' ? 'bg-blue-500' : 'bg-slate-300'
                      }`} />
                      <div>
                        <div className="text-sm font-medium text-slate-900">{quote.customers?.name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{format(new Date(quote.created_at), 'MMM dd, HH:mm')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-semibold">${quote.total_amount}</div>
                      <Badge variant="secondary" className="text-[10px] capitalize">{quote.status}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <h3 className="text-lg font-bold">Founder's Tip</h3>
              <p className="text-indigo-100 text-sm leading-relaxed">
                "Focus on Custom items first. A3 approvals are the main bottleneck in the current pipeline."
              </p>
              <Button className="w-full bg-white text-indigo-900 hover:bg-indigo-50 font-bold rounded-xl">
                Open AI Advisor
              </Button>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <TrendingUp className="w-32 h-32" />
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-800">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-2">
              <Button variant="outline" className="justify-start rounded-lg text-slate-600 hover:bg-slate-50">
                <Plus className="w-4 h-4 mr-2" /> New Inquiry
              </Button>
              <Button variant="outline" className="justify-start rounded-lg text-slate-600 hover:bg-slate-50">
                <FileText className="w-4 h-4 mr-2" /> Draft Quote
              </Button>
              <Button variant="outline" className="justify-start rounded-lg text-slate-600 hover:bg-slate-50">
                <DollarSign className="w-4 h-4 mr-2" /> Update Pricing
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { FileText, Plus, DollarSign } from 'lucide-react';
