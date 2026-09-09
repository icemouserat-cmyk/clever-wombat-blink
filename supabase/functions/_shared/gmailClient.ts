// Thin fetch-based Gmail REST API client for the justinhau0711@gmail.com demo mailbox.
// This is the ONLY file in the Gmail integration that makes real network calls — the
// parsing/decision logic it's used by lives in src/services/gmailIntegration.ts and is
// covered by Vitest. This file is not unit tested directly; it's deliberately thin
// wiring around three REST calls (token refresh, list/get messages, send).
//
// Required secrets (set via `supabase secrets set`, never committed):
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
// Scopes granted to the refresh token: gmail.readonly + gmail.send only.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export async function refreshAccessToken(): Promise<string> {
  const clientId = Deno.env.get('GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail secrets not configured (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN)');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`Gmail token refresh failed: HTTP ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export async function listNewMessages(accessToken: string, afterUnixSeconds: number): Promise<string[]> {
  const url = new URL(`${GMAIL_API_BASE}/messages`);
  // On first run (no prior sync) there's nothing to filter by — omit `after:` entirely
  // rather than passing after:0, which Gmail's search does not treat as "since epoch".
  if (afterUnixSeconds > 0) {
    url.searchParams.set('q', `after:${afterUnixSeconds}`);
  }
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Gmail list messages failed: HTTP ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.messages || []).map((m: { id: string }) => m.id);
}

export async function getMessage(accessToken: string, id: string) {
  const res = await fetch(`${GMAIL_API_BASE}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail get message failed: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function sendRawEmail(accessToken: string, rawBase64Url: string): Promise<{ id: string }> {
  const res = await fetch(`${GMAIL_API_BASE}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: rawBase64Url }),
  });
  if (!res.ok) {
    throw new Error(`Gmail send failed: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function buildRawMimeMessage({ to, from, subject, bodyText }: { to: string; from: string; subject: string; bodyText: string }): string {
  const message = [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset="UTF-8"', '', bodyText].join('\r\n');
  return base64UrlEncode(new TextEncoder().encode(message));
}

// Wraps base64 at the RFC 2045 line length so mail servers along the way don't choke
// on an unbroken multi-KB line.
function wrapBase64(base64: string): string {
  return base64.match(/.{1,76}/g)?.join('\r\n') ?? base64;
}

export function buildRawMimeMessageWithAttachment({
  to,
  from,
  subject,
  bodyText,
  attachmentFilename,
  attachmentMimeType,
  attachmentBase64,
}: {
  to: string;
  from: string;
  subject: string;
  bodyText: string;
  attachmentFilename: string;
  attachmentMimeType: string;
  attachmentBase64: string;
}): string {
  const boundary = `boundary_${crypto.randomUUID()}`;
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    bodyText,
    '',
    `--${boundary}`,
    `Content-Type: ${attachmentMimeType}; name="${attachmentFilename}"`,
    `Content-Disposition: attachment; filename="${attachmentFilename}"`,
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(attachmentBase64),
    '',
    `--${boundary}--`,
  ].join('\r\n');
  return base64UrlEncode(new TextEncoder().encode(message));
}
