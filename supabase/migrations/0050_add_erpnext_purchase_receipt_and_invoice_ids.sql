ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS erpnext_purchase_receipt_id TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS erpnext_purchase_invoice_id TEXT;
