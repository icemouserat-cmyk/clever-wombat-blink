GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.founder_time_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.founder_time_logs TO service_role;
ALTER TABLE public.founder_time_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founder time logs access policy" ON public.founder_time_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);