import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { extractStaffSize } from '@/services/gmailIntegration';

interface EmailInquiriesListProps {
  refreshKey: number;
}

interface EmailInquiry {
  id: string;
  customer_name: string;
  customer_email: string;
  subject: string | null;
  requirement_description: string;
}

const EmailInquiriesList = ({ refreshKey }: EmailInquiriesListProps) => {
  const [inquiries, setInquiries] = useState<EmailInquiry[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInquiries = async () => {
      const { data } = await supabase
        .from('inquiries')
        .select('*')
        .eq('status', 'new')
        .order('received_at', { ascending: false });
      setInquiries(data || []);
    };
    fetchInquiries();
  }, [refreshKey]);

  const handleSelect = (inquiry: EmailInquiry) => {
    navigate('/inquiries', {
      state: {
        inquiryId: inquiry.id,
        name: inquiry.customer_name,
        email: inquiry.customer_email,
        staffSize: extractStaffSize(inquiry.requirement_description),
      },
    });
  };

  if (inquiries.length === 0) {
    return <p className="text-sm text-muted-foreground">No new email inquiries from justinhau0711@gmail.com yet.</p>;
  }

  return (
    <div className="space-y-2">
      {inquiries.map((inquiry) => (
        <button
          key={inquiry.id}
          onClick={() => handleSelect(inquiry)}
          className="w-full text-left rounded-lg border bg-white p-3 hover:border-primary transition-colors"
        >
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm">{inquiry.customer_name}</span>
            <span className="text-xs text-muted-foreground">{inquiry.customer_email}</span>
          </div>
          {inquiry.subject && <p className="text-xs text-muted-foreground mt-1">{inquiry.subject}</p>}
          <p className="text-xs text-muted-foreground truncate mt-1">{inquiry.requirement_description}</p>
        </button>
      ))}
    </div>
  );
};

export default EmailInquiriesList;
