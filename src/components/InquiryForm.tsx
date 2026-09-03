import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const formSchema = z.object({
  name: z.string().min(2, { message: "Name is required" }),
  referral_source: z.string().min(1, { message: "Referral source is required" }),
  staff_size: z.coerce.number().min(1, { message: "Staff size must be at least 1" }),
});

export default function InquiryForm({ onInquiryCreated }: { onInquiryCreated: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      referral_source: '',
      staff_size: 1,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const { error } = await supabase
        .from('customers')
        .insert([values]);

      if (error) throw error;

      toast({
        title: "Inquiry Received",
        description: "Customer inquiry has been successfully recorded.",
      });
      form.reset();
      onInquiryCreated();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An unexpected error occurred.",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-xl border shadow-sm">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-indigo-900">Customer Intake</h3>
          <p className="text-sm text-slate-500">Capture new inquiry details to start the quotation process.</p>
        </div>
        
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Corp" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="referral_source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Referral Source</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="staff_size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Staff Size</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="50" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
          Record Inquiry
        </Button>
      </form>
    </Form>
  );
}
