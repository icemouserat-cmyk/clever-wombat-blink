import { describe, it, expect } from 'vitest';
import {
  parseFromHeader,
  extractPlainTextBody,
  parseInquiryFromGmailMessage,
  buildQuotationEmail,
  shouldSendQuotationEmail,
  extractStaffSize,
  buildDelayNoticeEmail,
  buildFinalInvoiceEmail,
  type GmailMessage,
} from './gmailIntegration';

function b64url(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('parseFromHeader', () => {
  it('parses a display name + email address', () => {
    expect(parseFromHeader('"John Tan" <john@example.com>')).toEqual({ name: 'John Tan', email: 'john@example.com' });
  });

  it('parses a name without quotes', () => {
    expect(parseFromHeader('John Tan <john@example.com>')).toEqual({ name: 'John Tan', email: 'john@example.com' });
  });

  it('falls back to the bare email address when no display name is present', () => {
    expect(parseFromHeader('john@example.com')).toEqual({ name: 'john@example.com', email: 'john@example.com' });
  });
});

describe('extractPlainTextBody', () => {
  it('extracts a simple non-multipart text/plain body', () => {
    const payload = { headers: [], mimeType: 'text/plain', body: { data: b64url('Hello there') } };
    expect(extractPlainTextBody(payload)).toBe('Hello there');
  });

  it('extracts the text/plain part from a multipart message', () => {
    const payload = {
      headers: [],
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: b64url('Plain body text') } },
        { mimeType: 'text/html', body: { data: b64url('<p>HTML body</p>') } },
      ],
    };
    expect(extractPlainTextBody(payload)).toBe('Plain body text');
  });

  it('finds text/plain nested inside a deeper multipart tree', () => {
    const payload = {
      headers: [],
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [{ mimeType: 'text/plain', body: { data: b64url('Nested plain text') } }],
        },
      ],
    };
    expect(extractPlainTextBody(payload)).toBe('Nested plain text');
  });
});

describe('parseInquiryFromGmailMessage', () => {
  it('composes header + body parsing into an inquiry shape', () => {
    const message: GmailMessage = {
      id: 'msg-123',
      internalDate: '1700000000000',
      payload: {
        headers: [
          { name: 'From', value: '"Jane Doe" <jane@example.com>' },
          { name: 'Subject', value: 'Need 10 office desks' },
        ],
        mimeType: 'text/plain',
        body: { data: b64url('We need 10 standard office desks for our new office.') },
      },
    };

    const result = parseInquiryFromGmailMessage(message);
    expect(result).toEqual({
      customerName: 'Jane Doe',
      customerEmail: 'jane@example.com',
      subject: 'Need 10 office desks',
      requirementDescription: 'We need 10 standard office desks for our new office.',
      gmailMessageId: 'msg-123',
      receivedAt: new Date(1700000000000).toISOString(),
    });
  });
});

describe('extractStaffSize', () => {
  it('extracts "about 40 staff"', () => {
    expect(extractStaffSize('We are setting up a new office for about 40 staff.')).toBe(40);
  });

  it('extracts "team of 40 employees"', () => {
    expect(extractStaffSize('We have a team of 40 employees moving into a new space.')).toBe(40);
  });

  it('extracts "staff of 40"', () => {
    expect(extractStaffSize('Our staff of 40 will need new desks.')).toBe(40);
  });

  it('extracts "60 people"', () => {
    expect(extractStaffSize('Looking to furnish an office for 60 people.')).toBe(60);
  });

  it('returns null when no headcount is mentioned', () => {
    expect(extractStaffSize('We need 10 standard office desks for our new office.')).toBeNull();
  });
});

describe('shouldSendQuotationEmail', () => {
  it('is true when the customer has an email address', () => {
    expect(shouldSendQuotationEmail({ email: 'a@b.com' })).toBe(true);
  });

  it('is false when the customer has no email address', () => {
    expect(shouldSendQuotationEmail({ email: null })).toBe(false);
    expect(shouldSendQuotationEmail({ email: '' })).toBe(false);
    expect(shouldSendQuotationEmail({})).toBe(false);
  });
});

describe('buildQuotationEmail', () => {
  it('includes line items, total, and customer name', () => {
    const { subject, bodyText } = buildQuotationEmail({
      quotation: { total_amount: 1250.5, notes: 'Please deliver by Friday' },
      customer: { name: 'Jane Doe', email: 'jane@example.com' },
      items: [
        { description: 'Standard Office Desk', sku: 'SKU-DESK-01', quantity: 2, unit_price: 500, line_total: 1000 },
        { description: 'Ergonomic Chair', sku: 'SKU-CHAIR-01', quantity: 1, unit_price: 250.5, line_total: 250.5 },
      ],
    });

    expect(subject).toBe('Your AuraSpace Quotation');
    expect(bodyText).toContain('Dear Jane Doe,');
    expect(bodyText).toContain('Standard Office Desk x2 — RM 1000.00');
    expect(bodyText).toContain('Total: RM 1250.50');
    expect(bodyText).toContain('Please deliver by Friday');
  });
});

describe('buildDelayNoticeEmail', () => {
  it('includes the customer name, expected date, and rounded delay in weeks', () => {
    const { subject, bodyText } = buildDelayNoticeEmail({
      quotation: { expected_completion_date: '2026-08-01' },
      customer: { name: 'Alex Tan', email: 'alex@example.com' },
      delayWeeks: 2.8,
    });

    expect(subject).toBe('Update on Your Order — Production Delay');
    expect(bodyText).toContain('Dear Alex Tan,');
    expect(bodyText).toContain('2026-08-01');
    expect(bodyText).toContain('by approximately 2 weeks');
  });

  it('uses singular "week" for exactly one week of delay', () => {
    const { bodyText } = buildDelayNoticeEmail({
      quotation: { expected_completion_date: null },
      customer: { name: 'Alex Tan' },
      delayWeeks: 1.2,
    });
    expect(bodyText).toContain('by approximately 1 week.');
    expect(bodyText).not.toContain('1 weeks');
  });
});

describe('buildFinalInvoiceEmail', () => {
  it('includes the customer name and total amount', () => {
    const { subject, bodyText } = buildFinalInvoiceEmail({
      quotation: { total_amount: 11260 },
      customer: { name: 'JUN HAU LAI' },
    });

    expect(subject).toBe('Your Final Invoice — Order Complete');
    expect(bodyText).toContain('Dear JUN HAU LAI,');
    expect(bodyText).toContain('RM 11260.00');
    expect(bodyText).toContain('paid in full');
  });
});
