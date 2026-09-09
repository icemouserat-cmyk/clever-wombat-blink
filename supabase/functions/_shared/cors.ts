// Shared CORS headers for Edge Functions invoked from the browser via
// supabase.functions.invoke(). Without these, the browser's preflight OPTIONS
// request is rejected and supabase-js reports a generic "Failed to send a
// request to the Edge Function" with no useful detail.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
