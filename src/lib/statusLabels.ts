// Display-only label mapping — the underlying `quotations.status` value stays
// 'Sent' in the database (all A2/A3 logic, KPI queries, and filters key off that
// exact string). This only changes what the founder sees: 'Sent' reads as
// "Pending" since the quotation is really awaiting the customer's decision.
export function getQuotationStatusLabel(status: string): string {
  if (status === 'Sent') return 'Pending';
  return status;
}

const PRODUCTION_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  ready_for_qc: 'Ready for QC',
  delayed_escalation: 'Delayed — Escalated',
  delivered: 'Delivered',
};

export function getProductionStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return PRODUCTION_STATUS_LABELS[status] || status;
}

// QC approval only marks the order physically "delivered" and generates the balance
// invoice — it does not by itself mean the order is truly finished. An order only
// reaches "Done" once the balance invoice is actually confirmed paid, tracked via
// quotations.balance_paid_at.
export function getOrderCompletionLabel(quotation: { production_status?: string | null; balance_paid_at?: string | null }): string {
  if (quotation.production_status !== 'delivered') {
    return getProductionStatusLabel(quotation.production_status);
  }
  return quotation.balance_paid_at ? 'Done' : 'Awaiting Balance Payment';
}

export function isOrderDone(quotation: { production_status?: string | null; balance_paid_at?: string | null }): boolean {
  return quotation.production_status === 'delivered' && Boolean(quotation.balance_paid_at);
}

// Days past the expected completion date, for orders still in production (not yet
// delivered). Returns null when there's nothing to show — no date on file, the order
// isn't overdue, or it's already past the production stage. Shown on the Progress page
// as an at-a-glance number alongside the "Delayed — Escalated" badge, since the badge
// alone doesn't say how late an order actually is.
export function getDaysOverdue(quotation: {
  production_status?: string | null;
  expected_completion_date?: string | null;
}): number | null {
  if (quotation.production_status !== 'in_progress' && quotation.production_status !== 'delayed_escalation') return null;
  if (!quotation.expected_completion_date) return null;
  const daysOverdue = Math.floor((Date.now() - new Date(quotation.expected_completion_date).getTime()) / (24 * 60 * 60 * 1000));
  return daysOverdue > 0 ? daysOverdue : null;
}
