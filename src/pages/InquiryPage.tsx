import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import InquiryForm from '@/components/InquiryForm';
import InquiryList, { Customer } from '@/components/InquiryList';

export default function InquiryPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error("Error fetching customers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900">Customer Inquiries</h1>
        <p className="text-slate-500">Manage incoming leads and transition them into quotations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <InquiryForm onInquiryCreated={fetchCustomers} />
        </div>
        <div className="lg:col-span-2">
          <InquiryList customers={customers} onRefresh={fetchCustomers} />
        </div>
      </div>
    </div>
  );
}
