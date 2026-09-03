import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface Customer {
  id: string;
  name: string;
  referral_source: string;
  staff_size: number;
  created_at: string;
}

export default function InquiryList({ customers, onRefresh }: { customers: Customer[], onRefresh: () => void }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800">Recent Inquiries</h3>
        </div>
        <Badge variant="outline" className="text-slate-500 font-medium">
          {customers.length} Total
        </Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50">
            <TableHead>Customer</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Staff Size</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10 text-slate-400">
                No inquiries found. Start by adding one above.
              </TableCell>
            </TableRow>
          ) : (
            customers.map((customer) => (
              <TableRow key={customer.id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell className="font-medium text-slate-900">{customer.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {customer.referral_source}
                  </Badge>
                </TableCell>
                <TableCell>{customer.staff_size}</TableCell>
                <TableCell className="text-slate-500 text-sm">
                  {format(new Date(customer.created_at), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <Link 
                    to={`/quotations/new?customerId=${customer.id}`}
                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                  >
                    Create Quote <ArrowRight className="w-4 h-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
