// Browser-side ERPNext REST client for W-01/W-02 writes. This runs in the founder's
// browser (not a Supabase Edge Function) because the ERPNext instance lives on a
// private LAN address unreachable from Supabase's cloud infrastructure — the same
// reason ERPConfigPage's "Test Connection" already calls ERPNext directly via fetch.
// Deliberately thin wiring (like supabase/functions/_shared/gmailClient.ts) — not unit
// tested directly. Field names below follow ERPNext's standard/default schema and have
// not yet been verified against a live instance; expect small adjustments once ERPNext
// is reachable again.

import { supabase } from '@/integrations/supabase/client';
import type { ErpSettings } from '@/pages/ERPConfigPage';

export async function loadErpSettings(userId: string): Promise<ErpSettings | null> {
  const { data } = await supabase.from('app_config').select('*').eq('key', `erpnext_settings_${userId}`).maybeSingle();
  if (!data?.value) return null;
  try {
    const parsed = JSON.parse(data.value) as Partial<ErpSettings>;
    if (!parsed.erpUrl) return null;
    return parsed as ErpSettings;
  } catch {
    return null;
  }
}

async function erpRequest(settings: ErpSettings, path: string, options: RequestInit = {}): Promise<any> {
  const target = new URL(path, settings.erpUrl);
  const headers: Record<string, string> = { Accept: 'application/json', ...((options.headers as Record<string, string>) || {}) };
  if (settings.authMode === 'token' && settings.apiKey && settings.apiSecret) {
    headers.Authorization = `token ${settings.apiKey}:${settings.apiSecret}`;
  }
  const res = await fetch(target.toString(), {
    ...options,
    headers,
    credentials: settings.authMode === 'session' ? 'include' : options.credentials,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ERPNext ${path} failed: HTTP ${res.status} ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function findErpDocByField(settings: ErpSettings, doctype: string, field: string, value: string): Promise<string | null> {
  const filters = encodeURIComponent(JSON.stringify([[field, '=', value]]));
  const fields = encodeURIComponent(JSON.stringify(['name']));
  const result = await erpRequest(
    settings,
    `/api/resource/${encodeURIComponent(doctype)}?filters=${filters}&fields=${fields}&limit_page_length=1`
  );
  return result?.data?.[0]?.name ?? null;
}

// Idempotent: looks up an ERPNext Customer by customer_name, creates one if missing.
export async function ensureErpCustomer(settings: ErpSettings, customerName: string): Promise<string> {
  const existing = await findErpDocByField(settings, 'Customer', 'customer_name', customerName);
  if (existing) return existing;
  const created = await erpRequest(settings, '/api/resource/Customer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_name: customerName, customer_type: 'Company' }),
  });
  return created.data.name;
}

// Idempotent: looks up an ERPNext Item by item_code (mapped from our price_list SKU),
// creates one if missing. item_group 'Products' is a guess — this app's price_list has
// no matching concept, so this is one of the fields most likely to need adjusting once
// tested against the real instance.
export async function ensureErpItem(settings: ErpSettings, sku: string, description: string | null): Promise<string> {
  const existing = await findErpDocByField(settings, 'Item', 'item_code', sku);
  if (existing) return existing;
  const created = await erpRequest(settings, '/api/resource/Item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      item_code: sku,
      item_name: description || sku,
      item_group: 'Products',
      stock_uom: 'Nos',
      is_stock_item: 0,
    }),
  });
  return created.data.name;
}

// Idempotent: looks up an ERPNext Supplier by supplier_name, creates one if missing.
export async function ensureErpSupplier(settings: ErpSettings, supplierName: string): Promise<string> {
  const existing = await findErpDocByField(settings, 'Supplier', 'supplier_name', supplierName);
  if (existing) return existing;
  const created = await erpRequest(settings, '/api/resource/Supplier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supplier_name: supplierName, supplier_group: 'All Supplier Groups' }),
  });
  return created.data.name;
}

export interface ErpPurchaseOrderLine {
  sku: string;
  description: string | null;
  quantity: number;
  unit_cost: number;
}

// Creates an ERPNext Purchase Order as a draft (docstatus 0) — mirrors createErpQuotation
// but for the supplier-side procurement flow (see SupplierDetailPage). scheduleDate
// defaults to 14 days out per line, since ERPNext's Purchase Order Item typically
// requires schedule_date.
export async function createErpPurchaseOrder(
  settings: ErpSettings,
  supplierName: string,
  items: ErpPurchaseOrderLine[],
  scheduleDate?: string
): Promise<string> {
  const supplierErpId = await ensureErpSupplier(settings, supplierName);
  const effectiveScheduleDate =
    scheduleDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const erpItems = [];
  for (const item of items) {
    const itemCode = await ensureErpItem(settings, item.sku, item.description);
    erpItems.push({ item_code: itemCode, qty: item.quantity, rate: item.unit_cost, schedule_date: effectiveScheduleDate });
  }
  const created = await erpRequest(settings, '/api/resource/Purchase Order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supplier: supplierErpId, schedule_date: effectiveScheduleDate, items: erpItems }),
  });
  return created.data.name;
}

export interface ErpQuotationLine {
  sku: string;
  description: string | null;
  quantity: number;
  unit_price: number;
}

// Creates an ERPNext Quotation as a draft (docstatus 0) — the founder reviews and
// submits it inside ERPNext itself; this app never auto-submits ERPNext documents.
export async function createErpQuotation(settings: ErpSettings, customerName: string, items: ErpQuotationLine[]): Promise<string> {
  const customerErpId = await ensureErpCustomer(settings, customerName);
  const erpItems = [];
  for (const item of items) {
    const itemCode = await ensureErpItem(settings, item.sku, item.description);
    erpItems.push({ item_code: itemCode, qty: item.quantity, rate: item.unit_price });
  }
  const created = await erpRequest(settings, '/api/resource/Quotation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quotation_to: 'Customer', party_name: customerErpId, items: erpItems }),
  });
  return created.data.name;
}

// Converts an existing ERPNext Quotation into a Sales Order using ERPNext's own
// make_sales_order mapper, so pricing/tax/UOM mapping stays consistent with however
// this ERPNext instance is configured rather than us rebuilding the document by hand.
// Also created as a draft (docstatus 0) — never auto-submitted.
export async function createErpSalesOrderFromQuotation(
  settings: ErpSettings,
  quotationErpId: string,
  deliveryDate?: string
): Promise<string> {
  const mapped = await erpRequest(
    settings,
    `/api/method/erpnext.selling.doctype.quotation.quotation.make_sales_order?source_name=${encodeURIComponent(quotationErpId)}`
  );
  const doc = mapped.message;
  if (deliveryDate && Array.isArray(doc.items)) {
    doc.items = doc.items.map((i: any) => ({ ...i, delivery_date: deliveryDate }));
  }
  if (deliveryDate) doc.delivery_date = deliveryDate;
  const created = await erpRequest(settings, '/api/resource/Sales Order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
  return created.data.name;
}
