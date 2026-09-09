// Sends a courtesy delay notice from justinhau0711@gmail.com the moment a production
// delay is first detected (called fire-and-forget from the delay-detection effect in
// src/pages/QuoteEditorPage.tsx, alongside the internal openPendingAction escalation).
// Best-effort: a failure here never blocks or reverts the internal escalation, which is
// already committed by the time this runs.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { refreshAccessToken, sendRawEmail, buildRawMimeMessage } from '../_shared/gmailClient.ts';
import { shouldSendQuotationEmail, buildDelayNoticeEmail } from '../_shared/inquiryParsing.ts';
import { corsHeaders } from '../_shared/cors.ts';

const FROM_ADDRESS = 'justinhau0711@gmail.com';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { quotationId } = await req.json();
    if (!quotationId) {
      return new Response(JSON.stringify({ error: 'quotationId is required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: quotation, error: qError } = await supabase.from('quotations').select('*').eq('id', quotationId).single();
    if (qError) throw qError;

    const { data: customer, error: cError } = await supabase.from('customers').select('*').eq('id', quotation.customer_id).single();
    if (cError) throw cError;

    if (!shouldSendQuotationEmail(customer)) {
      return new Response(JSON.stringify({ skipped: true, reason: 'customer has no email on file' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!quotation.expected_completion_date) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no expected completion date on file' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const delayWeeks = (Date.now() - new Date(quotation.expected_completion_date).getTime()) / WEEK_MS;
    const { subject, bodyText } = buildDelayNoticeEmail({ quotation, customer, delayWeeks });
    const accessToken = await refreshAccessToken();
    const raw = buildRawMimeMessage({ to: customer.email, from: FROM_ADDRESS, subject, bodyText });
    const sendResult = await sendRawEmail(accessToken, raw);

    const { error: logError } = await supabase.from('email_log').insert({
      user_id: quotation.user_id,
      quotation_id: quotationId,
      recipient_email: customer.email,
      gmail_message_id: sendResult.id,
      email_type: 'delay_notice',
    });
    if (logError) throw logError;

    return new Response(JSON.stringify({ sent: true, messageId: sendResult.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
