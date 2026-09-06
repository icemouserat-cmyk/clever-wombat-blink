import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppHeader from '@/components/AppHeader';
import InquiryForm from '@/components/InquiryForm';
import InquiryList from '@/components/InquiryList';
import QuoteRecommender from '@/components/QuoteRecommender';

const InquiryPage = () => {
  const [customers, setCustomers] = useState<any[]>([]);

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

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <div className="container mx-auto py-8 px-4 max-w-6xl space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Customer Inquiries</h1>
          <p className="text-muted-foreground">Capture new qualified inquiries and initiate the quotation process.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Capture New Lead</h2>
              <InquiryForm />
            </div>
            <QuoteRecommender customers={customers} />
          </div>
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-xl font-semibold">Recent Inquiries</h2>
            <InquiryList />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InquiryPage;
