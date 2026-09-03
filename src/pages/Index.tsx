import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Timer, 
  ArrowUpRight, 
  AlertCircle,
  FileText,
  Plus,
  DollarSign,
  Calendar
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
    <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
            {icon}
          </div>
          {trend && (
            <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${trend.isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {trend.value} <ArrowUpRight className={`w-3 h-3 ${trend.isPositive ? '' : 'rotate-90'}`} />
            </div>
          )}
        </div>
        <CardTitle className="text-sm font-bold text-slate-400 mt-4 uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-black text-slate-900 tracking-tight">{value}</div>
        <p className="text-sm text-slate-500 mt-1 font-medium">{description}</p>
        {status === 'danger' && (
          <div className="mt-3 flex items-center gap-1 text-red-500 text-[11px] font-bold bg-red-50 p-2 rounded-lg">
            <AlertCircle className="w-3 h-3" /> Target: 15m turnaround
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
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

      const { data: sentQuotes, error: sentError } = await supabase
        .from('quotations')
        .select('id, created_at, sent_at')
        .gte('sent_at', startWeek.toISOString())
        .lte('sent_at', endWeek.toISOString());
      
      if (sentError) throw sentError;

      let avgTurnaround = 0;
      if (sentQuotes && sentQuotes.length > 0) {
        const totalMs = sentQuotes.reduce((acc, q) => {
          return acc + (new Date(q.sent_at!).getTime() - new Date(q.created_at).getTime());
        }, 0);
        avgTurnaround = totalMs / sentQuotes.length;
      }

      const { data: allSent, error: allSentError } = await supabase
        .from('quotations')
        .select('status')
        .neq('status', 'Draft');
      
      if (allSentError) throw allSentError;

      const orders = allSent?.filter(q => q.status === 'Order').length || 0;
      const sent = allSent?.length || 0;
      const conversionRate = sent > 0 ? ((orders / sent) * 100).toFixed(1) : '0';

      const { data: timeLogs, error: logsError } = await supabase
        .from('founder_time_logs')
        .select('duration_minutes')
        .gte('start_time', startDay.toISOString())
        .lte('start_time', endDay.toISOString());
      
      if (logsError) throw logsError;
      const totalMinutes = timeLogs?.reduce((acc, log) => acc + (log.duration_minutes || 0), 0) || 0;

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
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Founder's Console</h1>
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(), 'EEEE, MMMM do yyyy')}</span>
          </div>
        </div>
        <div className="flex gap-3">
           <Button 
            variant="outline" 
            className="bg-white rounded-xl shadow-sm border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={() => navigate('/inquiries')}
          >
            <Plus className="w-4 h-4 mr-2" /> New Inquiry
          </Button>
          <Button 
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-100 transition-all"
            onClick={() => navigate('/quotations/new')}
          >
            <FileText className="w-4 h-4 mr-2" /> Create Quotation
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Quotes Sent" 
          value={kpis.sent} 
          icon={<FileText className="w-6 h-6" />} 
          description="Current week" 
          trend={{ value: '+12%', isPositive: true }}
        />
        <KPICard 
          title="Avg. Turnaround" 
          value={kpis.turnaround} 
          icon={<Clock className="w-6 h-6" />} 
          description="Sent vs Created" 
          status={parseInt(kpis.turnaround) > 15 ? 'danger' : 'good'}
        />
        <KPICard 
          title="Conversion Rate" 
          value={kpis.conversion} 
          icon={<CheckCircle2 className="w-6 h-6" />} 
          description="Order / Sent" 
          trend={{ value: '+2.4%', isPositive: true }}
        />
        <KPICard 
          title="Active Time" 
          value={`${kpis.activeMinutes}m`} 
          icon={<Timer className="w-6 h-6" />} 
          description="Logged today" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg">Recent Activity</h3>
              <Badge variant="outline" className="bg-white text-slate-500 font-bold px-3 py-1 rounded-full border-slate-200">
                Last 5 Quotes
              </Badge>
            </div>
            <div className="divide-y divide-slate-100">
              {recentActivity.length === 0 ? (
                <div className="p-20 text-center text-slate-400 font-medium">No recent quotations found.</div>
              ) : (
                recentActivity.map((quote) => (
                  <div key={quote.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full shadow-sm ${
                        quote.status === 'Order' ? 'bg-green-500 ring-4 ring-green-100' : 
                        quote.status === 'Sent' ? 'bg-blue-500 ring-4 ring-blue-100' : 'bg-slate-300 ring-4 ring-slate-100'
                      }`} />
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{quote.customers?.name || 'Unknown'}</span>
                        <span className="text-xs text-slate-500 font-medium">{format(new Date(quote.created_at), 'MMM dd, HH:mm')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-sm font-black text-slate-900">${quote.total_amount}</span>
                      <Badge variant="secondary" className="text-[11px] font-bold capitalize px-3 py-1 rounded-full bg-slate-100 text-slate-600 border-none">
                        {quote.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="space-y-8">
          <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-2 text-indigo-200 text-xs font-bold uppercase tracking-widest">
                <BrainCircuit className="w-4 h-4" /> Operational Intelligence
              </div>
              <h3 className="text-2xl font-black leading-tight">Founder's Strategy Tip</h3>
              <p className="text-indigo-100 text-sm leading-relaxed font-medium">
                "Focus on Custom items first. A3 approvals are the main bottleneck in the current pipeline."
              </p>
              <Button 
                onClick={() => navigate('/quotations')} 
                className="w-full bg-white text-indigo-600 hover:bg-indigo-50 font-bold rounded-xl shadow-lg transition-transform active:scale-95"
              >
                Launch AI Advisor
              </Button>
            </div>
            <div className="absolute -right-8 -bottom-8 opacity-20 group-hover:rotate-12 transition-transform duration-500">
              <TrendingUp className="w-48 h-48" />
            </div>
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
            <h3 className="font-bold text-slate-800 text-lg">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-3">
              <Button 
                variant="outline" 
                className="justify-start rounded-xl text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all group"
                onClick={() => navigate('/inquiries')}
              >
                <Plus className="w-4 h-4 mr-3 text-slate-400 group-hover:text-indigo-600" /> New Inquiry
              </Button>
              <Button 
                variant="outline" 
                className="justify-start rounded-xl text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all group"
                onClick={() => navigate('/quotations/new')}
              >
                <FileText className="w-4 h-4 mr-3 text-slate-400 group-hover:text-indigo-600" /> Draft Quote
              </Button>
              <Button 
                variant="outline" 
                className="justify-start rounded-xl text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all group"
                onClick={() => navigate('/settings/pricing')}
              >
                <DollarSign className="w-4 h-4 mr-3 text-slate-400 group-hover:text-indigo-600" /> Update Pricing
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
