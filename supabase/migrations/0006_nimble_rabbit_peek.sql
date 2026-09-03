CREATE TABLE public.quotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('Draft', 'Sent', 'Approved', 'Order')) DEFAULT 'Draft',
  total_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  order_converted_at TIMESTAMP WITH TIME ZONE
);