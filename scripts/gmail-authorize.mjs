#!/usr/bin/env node
// One-time, local-only script to obtain a Gmail OAuth refresh token for the
// justinhau0711@gmail.com demo mailbox. Run this yourself on your own machine —
// it never sends anything anywhere except Google's own OAuth endpoints, and
// writes the result only to a local, gitignored file. No dependencies beyond
// Node's built-ins.
//
// Prerequisites (do this in Google Cloud Console first):
//   1. Create/select a project, enable the Gmail API.
//   2. OAuth consent screen: External, Testing, add justinhau0711@gmail.com as a Test user.
//   3. Create an OAuth Client ID of type "Desktop app". Note the Client ID + Client Secret.
//
// Usage:
//   node scripts/gmail-authorize.mjs <CLIENT_ID> <CLIENT_SECRET>
//
// This prints a Google consent URL. Open it, sign in as justinhau0711@gmail.com,
// approve, and paste the "code" shown on the redirect page back into this
// script's prompt. It writes .gmail-credentials.json (gitignored) with the
// refresh token. You then copy that value into `supabase secrets set` yourself —
// this script never transmits it anywhere else.

import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import https from 'node:https';

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error('Usage: node scripts/gmail-authorize.mjs <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

const REDIRECT_PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}`;
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'];

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES.join(' '));
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
authUrl.searchParams.set('login_hint', 'justinhau0711@gmail.com');

console.log('\nOpen this URL, sign in as justinhau0711@gmail.com, and approve access:\n');
console.log(authUrl.toString());
console.log(`\nWaiting for the redirect to ${REDIRECT_URI} ...\n`);

function exchangeCodeForTokens(code) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }).toString();

    const req = https.request(
      {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`Token exchange failed: HTTP ${res.statusCode} ${data}`));
          resolve(JSON.parse(data));
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.end(`Authorization failed: ${error}. Check the terminal and try again.`);
    console.error(`Authorization failed: ${error}`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.end('No code received.');
    return;
  }

  res.end('Authorization received — you can close this tab and return to the terminal.');
  server.close();

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      console.error(
        '\nNo refresh_token in the response. This usually means justinhau0711@gmail.com already granted access before.\n' +
          'Revoke prior access at https://myaccount.google.com/permissions and re-run this script.'
      );
      process.exit(1);
    }
    writeFileSync(
      '.gmail-credentials.json',
      JSON.stringify({ client_id: clientId, client_secret: clientSecret, refresh_token: tokens.refresh_token }, null, 2)
    );
    console.log('\nSuccess. Wrote .gmail-credentials.json (gitignored — do not commit it).');
    console.log('Next: run the supabase secrets set command shown in the setup instructions, using the values from that file.\n');
  } catch (err) {
    console.error('\nToken exchange failed:', err.message);
    process.exit(1);
  }
});

server.listen(REDIRECT_PORT);
