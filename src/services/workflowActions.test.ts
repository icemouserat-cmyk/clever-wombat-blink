import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertMock = vi.fn();
const updateMock = vi.fn();
const selectSingleMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: (payload: Record<string, unknown>) => {
        insertMock(payload);
        return {
          select: () => ({
            single: async () => ({ data: { id: 'action-123', ...payload }, error: null }),
          }),
        };
      },
      select: () => ({
        eq: () => ({
          single: selectSingleMock,
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        updateMock(payload);
        return { eq: async () => ({ error: null }) };
      },
    })),
  },
}));

import { openPendingAction, resolvePendingAction } from './workflowEngine';

beforeEach(() => {
  insertMock.mockClear();
  updateMock.mockClear();
  selectSingleMock.mockReset();
});

describe('openPendingAction', () => {
  it('never sets decided_at when opening a pending A3 action', async () => {
    await openPendingAction({
      userId: 'u1',
      quotationId: 'q1',
      stage: 'W01_INQUIRY_TO_QUOTATION',
      actionType: 'custom_approval',
      resultCode: 'W01_CUSTOM_PENDING_APPROVAL',
      holdReason: 'custom_item',
    });
    const insertedPayload = insertMock.mock.calls[0][0];
    expect(insertedPayload).not.toHaveProperty('decided_at');
    expect(insertedPayload.entered_pending_at).toBeTruthy();
  });
});

describe('resolvePendingAction — explicit founder decision only', () => {
  it('is the only function that sets decided_at, and only when explicitly called with a founder decision', async () => {
    // Simulates the founder clicking "Approve" in the Approvals page UI — this call
    // must be explicit; nothing in openPendingAction or logAutoAction can produce it.
    selectSingleMock.mockResolvedValue({
      data: { entered_pending_at: new Date(Date.now() - 5 * 60000).toISOString() },
      error: null,
    });

    await resolvePendingAction({
      actionId: 'action-123',
      decision: 'approved',
      decidedBy: 'founder-user-id',
      resultCode: 'W01_CUSTOM_APPROVED_SENT',
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    const updatePayload = updateMock.mock.calls[0][0];
    expect(updatePayload.decided_at).toBeTruthy();
    expect(updatePayload.decided_by).toBe('founder-user-id');
    expect(updatePayload.decision).toBe('approved');
    expect(updatePayload.founder_minutes).toBeGreaterThanOrEqual(5);
  });

  it('reflects a rejection exactly as decided by the founder, never substituting an approval', async () => {
    selectSingleMock.mockResolvedValue({
      data: { entered_pending_at: new Date().toISOString() },
      error: null,
    });

    await resolvePendingAction({
      actionId: 'action-456',
      decision: 'rejected',
      decidedBy: 'founder-user-id',
      resultCode: 'W01_CUSTOM_REJECTED',
    });

    const updatePayload = updateMock.mock.calls[0][0];
    expect(updatePayload.decision).toBe('rejected');
  });
});
