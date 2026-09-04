import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const InquiryList = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInquiries = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setCustomers(data || []);
      } catch (error: any) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInquiries();
  }, []);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (customers.length === 0) return <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50 text-muted-foreground">No inquiries yet.</div>;

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead>Customer Name</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Staff Size</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell><Badge variant="secondary">{c.referral_source}</Badge></TableCell>
              <TableCell>{c.staff_size}</TableCell>
              <TableCell className="text-muted-foreground">{format(new Date(c.created_at), 'MMM d, yyyy')}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => navigate('/quotations')} className="flex items-center gap-2">
                  <PlusCircle className="h-3 w-3" /> View Quotes
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default InquiryList;
