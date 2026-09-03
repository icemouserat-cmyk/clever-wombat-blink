GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quotations access policy" ON public.quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);