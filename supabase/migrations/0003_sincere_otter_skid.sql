GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suppliers access policy" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);