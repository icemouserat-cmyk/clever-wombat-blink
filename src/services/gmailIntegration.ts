// Pure parsing/decision logic for the Gmail integration (justinhau0711@gmail.com demo
// inbox). Deliberately free of any Deno- or network-specific APIs so it can run under
// the existing Vitest suite and be imported unmodified by the Supabase Edge Functions
// in supabase/functions/, which do the actual network calls via supabase/functions/_shared/gmailClient.ts.

export interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  internalDate?: string;
  payload: {
    headers: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailMessagePart[];
  };
}

export function parseFromHeader(raw: string): { name: string; email: string } {
  const match = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim();
    const email = match[2].trim();
    return { name: name || email, email };
  }
  const email = raw.trim();
  return { name: email, email };
}

function base64UrlDecode(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  if (typeof atob === 'function') {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }
  return Buffer.from(padded, 'base64').toString('utf-8');
}

export function extractPlainTextBody(payload: GmailMessage['payload']): string {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return base64UrlDecode(payload.body.data);
  }
  const parts = payload.parts || [];
  const plainPart = parts.find((p) => p.mimeType === 'text/plain');
  if (plainPart?.body?.data) {
    return base64UrlDecode(plainPart.body.data);
  }
  for (const part of parts) {
    if (part.parts) {
      const nested = extractPlainTextBody({ headers: [], mimeType: part.mimeType, body: part.body, parts: part.parts });
      if (nested) return nested;
    }
  }
  if (payload.body?.data) {
    return base64UrlDecode(payload.body.data);
  }
  return '';
}

function getHeader(message: GmailMessage, name: string): string {
  const header = message.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

export interface ParsedInquiry {
  customerName: string;
  customerEmail: string;
  subject: string;
  requirementDescription: string;
  gmailMessageId: string;
  receivedAt: string;
}

const STAFF_SIZE_PATTERNS = [
  /(\d{1,4})\s*\+?\s*(?:staff|employees?|people|pax|headcount|workers?|personnel)\b/i,
  /(?:staff|team|employees?|headcount)\s*(?:of|:)?\s*(\d{1,4})/i,
];

// Heuristic, best-effort extraction of a headcount mentioned in free-text inquiry
// content (e.g. "for about 40 staff", "team of 40 employees"). Returns null when no
// plausible number is found — the founder still confirms/corrects this in the form,
// this only saves typing when the email happens to state it plainly.
export function extractStaffSize(text: string): number | null {
  for (const pattern of STAFF_SIZE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const value = parseInt(match[1], 10);
      if (!isNaN(value)) return value;
    }
  }
  return null;
}

export function parseInquiryFromGmailMessage(message: GmailMessage): ParsedInquiry {
  const { name, email } = parseFromHeader(getHeader(message, 'From'));
  const subject = getHeader(message, 'Subject');
  const body = extractPlainTextBody(message.payload).trim();
  const receivedAt = message.internalDate
    ? new Date(Number(message.internalDate)).toISOString()
    : new Date().toISOString();
  return {
    customerName: name,
    customerEmail: email,
    subject,
    requirementDescription: body,
    gmailMessageId: message.id,
    receivedAt,
  };
}

export interface QuotationEmailInput {
  quotation: { total_amount: number; notes?: string | null };
  customer: { name: string; email?: string | null };
  items: { description?: string | null; sku: string; quantity: number; unit_price: number; line_total: number }[];
}

export function shouldSendQuotationEmail(customer: { email?: string | null }): boolean {
  return Boolean(customer.email && customer.email.trim().length > 0);
}

export function buildQuotationEmail({ quotation, customer, items }: QuotationEmailInput): { subject: string; bodyText: string } {
  const lines = items.map(
    (item) => `  - ${item.description || item.sku} x${item.quantity} — RM ${item.line_total.toFixed(2)}`
  );
  const bodyText = [
    `Dear ${customer.name},`,
    '',
    'Thank you for your inquiry. Please find your quotation summary below:',
    '',
    ...lines,
    '',
    `Total: RM ${Number(quotation.total_amount).toFixed(2)}`,
    quotation.notes ? `\nNotes: ${quotation.notes}` : '',
    '',
    'Please let us know if you have any questions.',
    '',
    'Best regards,',
    'AuraSpace',
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  return { subject: 'Your AuraSpace Quotation', bodyText };
}

export interface DelayNoticeInput {
  quotation: { expected_completion_date?: string | null };
  customer: { name: string; email?: string | null };
  delayWeeks: number;
}

// Sent automatically the moment a production delay is first detected (>2 weeks past
// the expected completion date) — a courtesy notice, not a decision. The founder's
// separate internal escalation (on the Approvals page) is unaffected by whether this
// email succeeds or fails.
export function buildDelayNoticeEmail({ quotation, customer, delayWeeks }: DelayNoticeInput): { subject: string; bodyText: string } {
  const roundedWeeks = Math.floor(delayWeeks);
  const bodyText = [
    `Dear ${customer.name},`,
    '',
    'We want to let you know that your order is currently running behind its expected completion date' +
      (quotation.expected_completion_date ? ` of ${quotation.expected_completion_date}` : '') +
      `, by approximately ${roundedWeeks} week${roundedWeeks === 1 ? '' : 's'}.`,
    '',
    'Our team is reviewing this and will follow up with an updated timeline shortly. We apologise for the inconvenience.',
    '',
    'Please let us know if you have any questions in the meantime.',
    '',
    'Best regards,',
    'AuraSpace',
  ].join('\n');

  return { subject: 'Update on Your Order — Production Delay', bodyText };
}

export interface FinalInvoiceEmailInput {
  quotation: { total_amount: number };
  customer: { name: string };
}

// Sent the moment the balance invoice is marked Paid, with the final invoice PDF
// (built client-side by useQuoteExport's exportFinalInvoicePdf) attached — see
// gmail-send-final-invoice, which receives that same PDF as a base64 string from the
// browser rather than regenerating it server-side.
export function buildFinalInvoiceEmail({ quotation, customer }: FinalInvoiceEmailInput): { subject: string; bodyText: string } {
  const bodyText = [
    `Dear ${customer.name},`,
    '',
    `Thank you — your order has been paid in full (RM ${Number(quotation.total_amount).toFixed(2)}) and is now complete.`,
    'Please find your final invoice attached for your records.',
    '',
    'We appreciate your business and hope to work with you again.',
    '',
    'Best regards,',
    'AuraSpace',
  ].join('\n');

  return { subject: 'Your Final Invoice — Order Complete', bodyText };
}
