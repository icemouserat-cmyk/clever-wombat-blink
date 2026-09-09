// Polls the justinhau0711@gmail.com demo inbox for messages newer than the last synced
// high-water mark, and creates an `inquiries` row per new message. Never marks
// messages as read/modifies the mailbox in any way — this is why gmail.readonly is
// sufficient (no gmail.modify needed). Invoked by the client via
// supabase.functions.invoke('gmail-poll-inbox') — a button click plus a periodic
// interval while the Inquiry page is open (see src/pages/InquiryPage.tsx).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { refreshAccessToken, listNewMessages, getMessage } from '../_shared/gmailClient.ts';
import { parseInquiryFromGmailMessage } from '../_shared/inquiryParsing.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { userId } = await req.json().catch(() => ({ userId: null }));
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: state, error: stateError } = await supabase.from('gmail_sync_state').select('*').eq('id', 1).single();
    if (stateError) throw stateError;

    // On the very first poll (no prior sync state), default to a 24-hour lookback
    // rather than unlimited history — this mailbox has thousands of pre-existing
    // messages unrelated to this demo, and we only want to pick up recent test mail.
    const ONE_DAY_SECONDS = 24 * 60 * 60;
    const afterUnixSeconds = state.last_synced_at
      ? Math.floor(new Date(state.last_synced_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000) - ONE_DAY_SECONDS;

    const accessToken = await refreshAccessToken();
    const messageIds = await listNewMessages(accessToken, afterUnixSeconds);

    let created = 0;
    let newestReceivedAt: string | null = state.last_synced_at;

    for (const id of messageIds) {
      const message = await getMessage(accessToken, id);
      const parsed = parseInquiryFromGmailMessage(message);

      const { error: insertError } = await supabase.from('inquiries').insert({
        user_id: userId,
        customer_name: parsed.customerName,
        customer_email: parsed.customerEmail,
        subject: parsed.subject,
        requirement_description: parsed.requirementDescription,
        gmail_message_id: parsed.gmailMessageId,
        received_at: parsed.receivedAt,
      });
      // Unique constraint on gmail_message_id makes this idempotent across polls.
      if (insertError && insertError.code !== '23505') throw insertError;
      if (!insertError) created += 1;

      if (!newestReceivedAt || new Date(parsed.receivedAt) > new Date(newestReceivedAt)) {
        newestReceivedAt = parsed.receivedAt;
      }
    }

    if (newestReceivedAt && newestReceivedAt !== state.last_synced_at) {
      await supabase.from('gmail_sync_state').update({ last_synced_at: newestReceivedAt, updated_at: new Date().toISOString() }).eq('id', 1);
    }

    return new Response(JSON.stringify({ checked: messageIds.length, created }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
