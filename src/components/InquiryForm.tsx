import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface InquiryFormProps {
  prefillName?: string;
  prefillEmail?: string;
  prefillStaffSize?: number;
  sourceInquiryId?: string;
}

const InquiryForm = ({ prefillName, prefillEmail, prefillStaffSize, sourceInquiryId }: InquiryFormProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: prefillName || '',
    email: prefillEmail || '',
    referralSource: '',
    staffSize: prefillStaffSize ? String(prefillStaffSize) : '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    if (prefillName || prefillEmail || prefillStaffSize) {
      setFormData((prev) => ({
        ...prev,
        name: prefillName || prev.name,
        email: prefillEmail || prev.email,
        staffSize: prefillStaffSize ? String(prefillStaffSize) : prev.staffSize,
      }));
    }
  }, [prefillName, prefillEmail, prefillStaffSize]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const size = parseInt(formData.staffSize);
    if (isNaN(size) || size < 20 || size > 150) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Staff size must be between 20 and 150.' });
      return;
    }

    setIsLoading(true);
    try {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          user_id: user.id,
          name: formData.name,
          email: formData.email,
          referral_source: formData.referralSource,
          staff_size: size,
          address: formData.address,
        })
        .select()
        .single();

      if (customerError) throw customerError;

      const { data: quotation, error: quoteError } = await supabase
        .from('quotations')
        .insert({
          user_id: user.id,
          customer_id: customer.id,
          status: 'Draft',
          notes: formData.notes,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      if (sourceInquiryId) {
        await supabase
          .from('inquiries')
          .update({ status: 'converted', converted_customer_id: customer.id, converted_quotation_id: quotation.id })
          .eq('id', sourceInquiryId);
      }

      toast({ title: 'Inquiry Captured', description: 'Customer and draft quotation created.' });
      setFormData({ name: '', email: '', referralSource: '', staffSize: '', address: '', notes: '' });
      navigate('/quotations');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-white rounded-xl border shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Customer Name</Label>
          <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Customer Email</Label>
          <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="referral">Referral Source</Label>
          <Select value={formData.referralSource} onValueChange={(val) => setFormData({ ...formData, referralSource: val })} required>
            <SelectTrigger id="referral"><SelectValue placeholder="Select source..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Direct Outreach">Direct Outreach</SelectItem>
              <SelectItem value="Referral Partner">Referral Partner</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="staff">Staff Size (20-150)</Label>
          <Input id="staff" type="number" value={formData.staffSize} onChange={(e) => setFormData({ ...formData, staffSize: e.target.value })} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Delivery/Billing Address</Label>
        <Textarea id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Inquiry Notes</Label>
        <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={4} />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Capture Inquiry'}
      </Button>
    </form>
  );
};

export default InquiryForm;
