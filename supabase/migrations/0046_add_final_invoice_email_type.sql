ALTER TABLE public.email_log DROP CONSTRAINT IF EXISTS email_log_email_type_check;
ALTER TABLE public.email_log ADD CONSTRAINT email_log_email_type_check
  CHECK (email_type IN ('quotation_sent', 'delay_notice', 'final_invoice'));
