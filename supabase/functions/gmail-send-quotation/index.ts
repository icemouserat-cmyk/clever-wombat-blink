// Sends the outgoing quotation email from justinhau0711@gmail.com when a quotation is
// marked Sent (both the A2 auto path and the A3-approved path call this, from
// sendQuotationNow in src/pages/QuoteEditorPage.tsx). Best-effort: a failure here
// never reverts or blocks the quotation's Sent status, which is already committed by
// the time this runs — it is invoked fire-and-forget after that DB update succeeds.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { refreshAccessToken, sendRawEmail, buildRawMimeMessage } from '../_shared/gmailClient.ts';
import { shouldSendQuotationEmail, buildQuotationEmail } from '../_shared/inquiryParsing.ts';
import { corsHeaders } from '../_shared/cors.ts';

const FROM_ADDRESS = 'justinhau0711@gmail.com';

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

    const { data: items, error: iError } = await supabase.from('quotation_items').select('*').eq('quotation_id', quotationId);
    if (iError) throw iError;

    const { subject, bodyText } = buildQuotationEmail({ quotation, customer, items: items || [] });
    const accessToken = await refreshAccessToken();
    const raw = buildRawMimeMessage({ to: customer.email, from: FROM_ADDRESS, subject, bodyText });
    const sendResult = await sendRawEmail(accessToken, raw);

    const { error: logError } = await supabase.from('email_log').insert({
      user_id: quotation.user_id,
      quotation_id: quotationId,
      recipient_email: customer.email,
      gmail_message_id: sendResult.id,
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
