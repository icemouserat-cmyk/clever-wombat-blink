GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers access policy" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);