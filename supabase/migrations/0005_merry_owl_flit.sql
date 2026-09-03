GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.price_list TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.price_list TO service_role;
ALTER TABLE public.price_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Price list access policy" ON public.price_list FOR ALL TO authenticated USING (true) WITH CHECK (true);