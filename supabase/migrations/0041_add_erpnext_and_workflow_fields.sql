ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS erpnext_quotation_id TEXT;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS erpnext_sales_order_id TEXT;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS workflow_state TEXT;

ALTER TABLE public.price_list ADD COLUMN IF NOT EXISTS erpnext_item_code TEXT;
