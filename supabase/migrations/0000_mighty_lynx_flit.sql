CREATE TABLE public.customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  referral_source TEXT,
  staff_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);