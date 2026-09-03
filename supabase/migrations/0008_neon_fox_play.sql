CREATE TABLE public.quotation_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  requires_a3_approval BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);