// This module implements the same inquiry -> quotation -> deposit -> production ->
// delivery approval logic (W-01/W-02/W-03) as the parallel Dify workflow built for
// governance validation. The two run independently and never call each other — this
// is a deliberate architecture decision, not an oversight, so the same business rules
// can be checked by two independently-built systems. Terminal result codes below are
// copied verbatim from the Dify DSL's End-node outputs so both systems stay auditable
// against one shared vocabulary; PENDING_* codes are additions unique to this app,
// needed because this app actually waits for a founder decision instead of the Dify
// placeholder's auto-approve.

import { supabase } from '@/integrations/supabase/client';

export type Classification = 'A2' | 'A3';
export type HoldReason = 'custom_item' | 'compliance';
export type WorkflowStage = 'W01_INQUIRY_TO_QUOTATION' | 'W02_DEPOSIT_TO_PRODUCTION' | 'W03_PRODUCTION_TO_DELIVERY';

export const DEFAULT_DENYLIST = [
  'Maybank',
  'CIMB',
  'Public Bank',
  'RHB',
  'Hong Leong Bank',
  'HSBC',
  'Bank Negara',
  'escrow',
  'bank account',
  'regulatory authority',
  'compliance commission',
  'Securities Commission',
];

export function classifyQuotationItem(itemGroup: string): Classification {
  return itemGroup === 'Furniture - Custom' ? 'A3' : 'A2';
}

export async function fetchDenylist(): Promise<string[]> {
  const { data } = await supabase.from('compliance_denylist').select('term');
  if (data && data.length > 0) return data.map((row: { term: string }) => row.term);
  return DEFAULT_DENYLIST;
}

export function scanForComplianceViolations(text: string, denylist: string[]): { flagged: boolean; matches: string[] } {
  const haystack = text.toLowerCase();
  const matches = denylist.filter((term) => haystack.includes(term.toLowerCase()));
  return { flagged: matches.length > 0, matches };
}

export function classifyInquiryQuotation(
  itemGroups: string[],
  complianceFlagged: boolean
): { classification: Classification; resultCode: string; holdReason: HoldReason | null } {
  if (complianceFlagged) {
    return { classification: 'A3', resultCode: 'W01_CUSTOM_PENDING_COMPLIANCE_HOLD', holdReason: 'compliance' };
  }
  const hasCustomItem = itemGroups.some((group) => classifyQuotationItem(group) === 'A3');
  if (hasCustomItem) {
    return { classification: 'A3', resultCode: 'W01_CUSTOM_PENDING_APPROVAL', holdReason: 'custom_item' };
  }
  return { classification: 'A2', resultCode: 'W01_STANDARD_AUTO_SENT', holdReason: null };
}

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export function evaluateProductionDelay(expectedDate: string, today: Date = new Date()): boolean {
  const expected = new Date(expectedDate);
  return today.getTime() - expected.getTime() > TWO_WEEKS_MS;
}

interface OpenPendingActionArgs {
  userId: string;
  quotationId: string;
  stage: WorkflowStage;
  actionType: string;
  resultCode: string;
  holdReason?: HoldReason;
}

export async function openPendingAction({
  userId,
  quotationId,
  stage,
  actionType,
  resultCode,
  holdReason,
}: OpenPendingActionArgs): Promise<string> {
  const { data, error } = await supabase
    .from('workflow_actions')
    .insert({
      user_id: userId,
      quotation_id: quotationId,
      stage,
      classification: 'A3',
      action_type: actionType,
      result_code: resultCode,
      hold_reason: holdReason ?? null,
      entered_pending_at: new Date().toISOString(),
      founder_minutes: 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

interface ResolvePendingActionArgs {
  actionId: string;
  decision: 'approved' | 'rejected';
  decidedBy: string;
  resultCode: string;
}

// The only function permitted to close a pending A3 action. It must be called with an
// explicit decision made by the founder — no code path may invoke this automatically,
// including in tests, which must simulate a real "founder clicks Approve/Reject" call.
export async function resolvePendingAction({ actionId, decision, decidedBy, resultCode }: ResolvePendingActionArgs): Promise<void> {
  const { data: action, error: fetchError } = await supabase
    .from('workflow_actions')
    .select('entered_pending_at')
    .eq('id', actionId)
    .single();
  if (fetchError) throw fetchError;

  const decidedAt = new Date();
  const enteredPendingAt = new Date(action.entered_pending_at);
  const founderMinutes = Math.round((decidedAt.getTime() - enteredPendingAt.getTime()) / 60000);

  const { error } = await supabase
    .from('workflow_actions')
    .update({
      decided_at: decidedAt.toISOString(),
      decided_by: decidedBy,
      decision,
      result_code: resultCode,
      founder_minutes: founderMinutes,
    })
    .eq('id', actionId);
  if (error) throw error;
}

interface LogAutoActionArgs {
  userId: string;
  quotationId: string;
  stage: WorkflowStage;
  actionType: string;
  resultCode: string;
}

export async function logAutoAction({ userId, quotationId, stage, actionType, resultCode }: LogAutoActionArgs): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('workflow_actions').insert({
    user_id: userId,
    quotation_id: quotationId,
    stage,
    classification: 'A2',
    action_type: actionType,
    result_code: resultCode,
    entered_pending_at: now,
    decided_at: now,
    founder_minutes: 0,
  });
  if (error) throw error;
}

interface LogComplianceIncidentArgs {
  userId: string;
  quotationId: string;
  stage: WorkflowStage;
  resultCode: string;
}

// A hard block, not a normal approval step: per spec, a failed compliance scan on a
// deposit transition must be logged as an incident and must never present an
// Approve/Reject path. This row intentionally never gets a decided_at — resolving it
// means fixing the underlying quotation content and re-running the scan, which
// produces a fresh outcome rather than "approving" this record.
export async function logComplianceIncident({ userId, quotationId, stage, resultCode }: LogComplianceIncidentArgs): Promise<void> {
  const { error } = await supabase.from('workflow_actions').insert({
    user_id: userId,
    quotation_id: quotationId,
    stage,
    classification: 'A3',
    action_type: 'compliance_incident',
    result_code: resultCode,
    hold_reason: 'compliance',
    entered_pending_at: new Date().toISOString(),
    founder_minutes: 0,
  });
  if (error) throw error;
}
