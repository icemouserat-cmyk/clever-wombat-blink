ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;

CREATE TABLE public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  subject TEXT,
  requirement_description TEXT NOT NULL,
  gmail_message_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'converted')),
  converted_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  converted_quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inquiries: owner access" ON public.inquiries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.gmail_sync_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO public.gmail_sync_state (id, last_synced_at) VALUES (1, NULL);

CREATE TABLE public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  gmail_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Email log: owner access" ON public.email_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
