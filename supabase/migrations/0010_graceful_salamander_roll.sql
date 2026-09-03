CREATE TABLE public.founder_time_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);