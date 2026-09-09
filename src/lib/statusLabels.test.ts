import { describe, it, expect } from 'vitest';
import { getQuotationStatusLabel, getProductionStatusLabel, getOrderCompletionLabel, isOrderDone } from './statusLabels';

describe('getQuotationStatusLabel', () => {
  it('maps Sent to Pending', () => {
    expect(getQuotationStatusLabel('Sent')).toBe('Pending');
  });

  it('passes through other statuses unchanged', () => {
    expect(getQuotationStatusLabel('Draft')).toBe('Draft');
    expect(getQuotationStatusLabel('Order')).toBe('Order');
  });
});

describe('getProductionStatusLabel', () => {
  it('returns a friendly label for known statuses', () => {
    expect(getProductionStatusLabel('in_progress')).toBe('In Progress');
    expect(getProductionStatusLabel('ready_for_qc')).toBe('Ready for QC');
  });

  it('returns a dash for null/undefined', () => {
    expect(getProductionStatusLabel(null)).toBe('—');
    expect(getProductionStatusLabel(undefined)).toBe('—');
  });
});

describe('getOrderCompletionLabel / isOrderDone', () => {
  it('is not done and shows the production label while not yet delivered', () => {
    const order = { production_status: 'in_progress', balance_paid_at: null };
    expect(isOrderDone(order)).toBe(false);
    expect(getOrderCompletionLabel(order)).toBe('In Progress');
  });

  it('shows "Awaiting Balance Payment" when delivered but not yet paid', () => {
    const order = { production_status: 'delivered', balance_paid_at: null };
    expect(isOrderDone(order)).toBe(false);
    expect(getOrderCompletionLabel(order)).toBe('Awaiting Balance Payment');
  });

  it('shows "Done" only once delivered AND the balance is paid', () => {
    const order = { production_status: 'delivered', balance_paid_at: '2026-09-09T00:00:00.000Z' };
    expect(isOrderDone(order)).toBe(true);
    expect(getOrderCompletionLabel(order)).toBe('Done');
  });
});
