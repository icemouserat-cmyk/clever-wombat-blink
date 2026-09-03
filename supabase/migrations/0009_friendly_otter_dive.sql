GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotation_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotation_items TO service_role;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quotation items access policy" ON public.quotation_items FOR ALL TO authenticated USING (true) WITH CHECK (true);