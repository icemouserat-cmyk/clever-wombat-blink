CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  po_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Received')),
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at TIMESTAMPTZ,
  UNIQUE(user_id, po_number)
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Purchase orders: owner access" ON public.purchase_orders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  sku TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12, 2) NOT NULL,
  line_total NUMERIC(12, 2) NOT NULL
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Purchase order items: owner access via parent" ON public.purchase_order_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND po.user_id = auth.uid()));
