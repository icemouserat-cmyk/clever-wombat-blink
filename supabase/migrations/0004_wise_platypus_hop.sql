CREATE TABLE public.price_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  description TEXT,
  base_cost DECIMAL(12,2) NOT NULL,
  item_group TEXT CHECK (item_group IN ('Standard', 'Custom')),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);