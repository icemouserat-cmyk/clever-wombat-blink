ALTER TABLE public.delivery_notes ADD COLUMN IF NOT EXISTS erpnext_delivery_note_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS erpnext_invoice_id TEXT;
