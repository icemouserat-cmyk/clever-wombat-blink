// Sends the final invoice PDF (already generated and downloaded client-side by
// useQuoteExport's exportFinalInvoicePdf) to the customer from justinhau0711@gmail.com
// the moment the balance invoice is marked Paid (see handleMarkAsPaid in
// src/pages/QuoteEditorPage.tsx). The PDF is built in the browser and passed here as a
// base64 string rather than regenerated server-side, so the emailed copy is byte-for-byte
// what the founder downloaded. Best-effort: never blocks or reverts the payment record.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { refreshAccessToken, sendRawEmail, buildRawMimeMessageWithAttachment } from '../_shared/gmailClient.ts';
import { shouldSendQuotationEmail, buildFinalInvoiceEmail } from '../_shared/inquiryParsing.ts';
import { corsHeaders } from '../_shared/cors.ts';

const FROM_ADDRESS = 'justinhau0711@gmail.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { quotationId, pdfBase64 } = await req.json();
    if (!quotationId || !pdfBase64) {
      return new Response(JSON.stringify({ error: 'quotationId and pdfBase64 are required' }), { status: 400, headers: corsHeaders });
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

    const { subject, bodyText } = buildFinalInvoiceEmail({ quotation, customer });
    const accessToken = await refreshAccessToken();
    const raw = buildRawMimeMessageWithAttachment({
      to: customer.email,
      from: FROM_ADDRESS,
      subject,
      bodyText,
      attachmentFilename: `AuraSpace_FinalInvoice_${quotationId.slice(0, 8)}.pdf`,
      attachmentMimeType: 'application/pdf',
      attachmentBase64: pdfBase64,
    });
    const sendResult = await sendRawEmail(accessToken, raw);

    const { error: logError } = await supabase.from('email_log').insert({
      user_id: quotation.user_id,
      quotation_id: quotationId,
      recipient_email: customer.email,
      gmail_message_id: sendResult.id,
      email_type: 'final_invoice',
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
