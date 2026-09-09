CREATE TABLE public.delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
  delivery_note_number TEXT NOT NULL,
  delivery_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, delivery_note_number)
);
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Delivery notes: owner access" ON public.delivery_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.email_log ADD COLUMN IF NOT EXISTS email_type TEXT NOT NULL DEFAULT 'quotation_sent'
  CHECK (email_type IN ('quotation_sent', 'delay_notice'));
