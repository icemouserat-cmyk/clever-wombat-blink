import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const QuotationsPage = () => {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuotations = async () => {
      setIsLoading(true);
      const { data: quotes, error } = await supabase
        .from('quotations')
        .select('*, customers(name)')
        .order('created_at', { ascending: false });
      if (!error) setQuotations(quotes || []);
      setIsLoading(false);
    };
    fetchQuotations();
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <main className="flex-1 px-8 py-12">
        <div className="container mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quotations</h1>
            <p className="text-muted-foreground">All draft and sent quotations.</p>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : quotations.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50 text-muted-foreground">
              No quotations yet. Capture an inquiry to create one.
            </div>
          ) : (
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Customer</th>
                    <th className="text-left font-medium px-4 py-3">Status</th>
                    <th className="text-left font-medium px-4 py-3">Total</th>
                    <th className="text-left font-medium px-4 py-3">Date</th>
                    <th className="text-right font-medium px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q) => (
                    <tr key={q.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2 font-medium">{q.customers?.name || 'Unknown'}</td>
                      <td className="px-4 py-2"><Badge variant="outline">{q.status}</Badge></td>
                      <td className="px-4 py-2">RM {Number(q.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-muted-foreground">{format(new Date(q.created_at), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/quotations/${q.id}`)} className="gap-2">
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

export default QuotationsPage;
