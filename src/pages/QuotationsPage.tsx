import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { FileText, Plus, Eye } from 'lucide-react';

export interface Quotation {
  id: string;
  customer_id: string;
  status: 'Draft' | 'Sent' | 'Approved' | 'Order';
  total_amount: number;
  created_at: string;
  sent_at: string | null;
  customers?: { name: string };
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQuotations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*, customers(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotations(data || []);
    } catch (error: any) {
      console.error("Error fetching quotations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-900">Quotations</h1>
          <p className="text-slate-500">Manage and track all project quotes and their conversion status.</p>
        </div>
        <Link to="/quotations/new">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Quotation
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead>Quote ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Date Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                  Loading quotations...
                </TableCell>
              </TableRow>
            ) : quotations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                  No quotations found.
                </TableCell>
              </TableRow>
            ) : (
              quotations.map((quote) => (
                <TableRow key={quote.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="font-mono text-xs text-slate-500">
                    {quote.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="font-medium">{quote.customers?.name || 'Unknown'}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={
                        quote.status === 'Order' ? 'bg-green-100 text-green-700' : 
                        quote.status === 'Sent' ? 'bg-blue-100 text-blue-700' : 
                        'bg-slate-100 text-slate-700'
                      }
                    >
                      {quote.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">${quote.total_amount}</TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {format(new Date(quote.created_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link 
                      to={`/quotations/${quote.id}`}
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                    >
                      Edit <Eye className="w-4 h-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
