CREATE TABLE public.compliance_denylist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);
ALTER TABLE public.compliance_denylist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shared compliance denylist access" ON public.compliance_denylist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('W01_INQUIRY_TO_QUOTATION','W02_DEPOSIT_TO_PRODUCTION','W03_PRODUCTION_TO_DELIVERY')),
  classification TEXT NOT NULL CHECK (classification IN ('A2','A3')),
  action_type TEXT NOT NULL,
  result_code TEXT NOT NULL,
  hold_reason TEXT CHECK (hold_reason IN ('custom_item','compliance')),
  entered_pending_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.profiles(id),
  decision TEXT CHECK (decision IN ('approved','rejected')),
  founder_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.workflow_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workflow actions: owner access" ON public.workflow_actions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12,2);
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS deposit_confirmed_at TIMESTAMPTZ;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS production_status TEXT
  CHECK (production_status IN ('not_started','in_progress','ready_for_qc','delayed_escalation','delivered'));
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS expected_completion_date DATE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS actual_completion_date DATE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS qc_approved_at TIMESTAMPTZ;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'full'
  CHECK (invoice_type IN ('full','deposit','balance'));
