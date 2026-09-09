import { describe, it, expect } from 'vitest';
import {
  classifyQuotationItem,
  scanForComplianceViolations,
  classifyInquiryQuotation,
  evaluateProductionDelay,
  DEFAULT_DENYLIST,
} from './workflowEngine';

describe('classifyQuotationItem', () => {
  it('classifies standard furniture as A2', () => {
    expect(classifyQuotationItem('Furniture - Standard')).toBe('A2');
  });

  it('classifies custom furniture as A3', () => {
    expect(classifyQuotationItem('Furniture - Custom')).toBe('A3');
  });
});

describe('scanForComplianceViolations', () => {
  it('flags a case-insensitive denylist match', () => {
    const result = scanForComplianceViolations('Please deposit into our maybank account', DEFAULT_DENYLIST);
    expect(result.flagged).toBe(true);
    expect(result.matches).toContain('Maybank');
  });

  it('reports multiple matches', () => {
    const result = scanForComplianceViolations('Contact escrow agent, CIMB transfer required', DEFAULT_DENYLIST);
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag unrelated text', () => {
    const result = scanForComplianceViolations('Standard office desk, quantity 5, delivery in 2 weeks', DEFAULT_DENYLIST);
    expect(result.flagged).toBe(false);
    expect(result.matches).toEqual([]);
  });
});

describe('classifyInquiryQuotation', () => {
  it('standard items, no compliance flag -> A2 auto-sent', () => {
    const result = classifyInquiryQuotation(['Furniture - Standard', 'Furniture - Standard'], false);
    expect(result).toEqual({ classification: 'A2', resultCode: 'W01_STANDARD_AUTO_SENT', holdReason: null });
  });

  it('custom item present, no compliance flag -> A3 custom-item hold', () => {
    const result = classifyInquiryQuotation(['Furniture - Standard', 'Furniture - Custom'], false);
    expect(result).toEqual({ classification: 'A3', resultCode: 'W01_CUSTOM_PENDING_APPROVAL', holdReason: 'custom_item' });
  });

  it('standard items but compliance flagged -> A3 compliance hold (forced regardless of item_group)', () => {
    const result = classifyInquiryQuotation(['Furniture - Standard'], true);
    expect(result).toEqual({ classification: 'A3', resultCode: 'W01_CUSTOM_PENDING_COMPLIANCE_HOLD', holdReason: 'compliance' });
  });

  it('custom item and compliance flagged -> compliance hold takes precedence in labeling', () => {
    const result = classifyInquiryQuotation(['Furniture - Custom'], true);
    expect(result.holdReason).toBe('compliance');
  });
});

describe('evaluateProductionDelay', () => {
  it('is false exactly at 2 weeks', () => {
    const expected = '2026-01-01T00:00:00.000Z';
    const today = new Date('2026-01-15T00:00:00.000Z');
    expect(evaluateProductionDelay(expected, today)).toBe(false);
  });

  it('is true just past 2 weeks', () => {
    const expected = '2026-01-01T00:00:00.000Z';
    const today = new Date('2026-01-15T00:00:00.001Z');
    expect(evaluateProductionDelay(expected, today)).toBe(true);
  });

  it('is false before the expected date', () => {
    const expected = '2026-02-01T00:00:00.000Z';
    const today = new Date('2026-01-15T00:00:00.000Z');
    expect(evaluateProductionDelay(expected, today)).toBe(false);
  });
});
