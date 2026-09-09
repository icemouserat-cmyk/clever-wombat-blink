import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Plus, Trash2, Package } from 'lucide-react';
import { loadErpSettings, createErpPurchaseOrder } from '@/services/erpnextClient';

interface DraftLine {
  sku: string;
  description: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

const SupplierDetailPage = () => {
  const { id: supplierId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [supplier, setSupplier] = useState<any>(null);
  const [priceList, setPriceList] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  const [selectedSku, setSelectedSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);

  useEffect(() => {
    if (supplierId) loadData();
  }, [supplierId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: supplierData, error: sError } = await supabase.from('suppliers').select('*').eq('id', supplierId).single();
      if (sError) throw sError;
      setSupplier(supplierData);

      const { data: pl, error: plError } = await supabase.from('price_list').select('*').eq('supplier_id', supplierId).order('sku');
      if (plError) throw plError;
      setPriceList(pl || []);

      const { data: pos, error: poError } = await supabase
        .from('purchase_orders')
        .select('*, purchase_order_items(*)')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });
      if (poError) throw poError;
      setPurchaseOrders(pos || []);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const addDraftLine = () => {
    const itemData = priceList.find((p) => p.sku === selectedSku);
    if (!itemData) return;
    const lineTotal = itemData.base_cost * quantity;
    setDraftLines((prev) => [
      ...prev,
      { sku: itemData.sku, description: itemData.description, quantity, unit_cost: itemData.base_cost, line_total: lineTotal },
    ]);
    setSelectedSku('');
    setQuantity(1);
  };

  const removeDraftLine = (index: number) => {
    setDraftLines((prev) => prev.filter((_, i) => i !== index));
  };

  const draftTotal = draftLines.reduce((sum, line) => sum + line.line_total, 0);

  const submitPurchaseOrder = async () => {
    if (!user || !supplierId || draftLines.length === 0) return;
    try {
      const { data: newPo, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          user_id: user.id,
          supplier_id: supplierId,
          po_number: `PO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
          total_cost: draftTotal,
        })
        .select()
        .single();
      if (poError) throw poError;

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(
        draftLines.map((line) => ({
          purchase_order_id: newPo.id,
          sku: line.sku,
          description: line.description,
          quantity: line.quantity,
          unit_cost: line.unit_cost,
          line_total: line.line_total,
        }))
      );
      if (itemsError) throw itemsError;

      setDraftLines([]);
      toast({ title: 'Purchase Order Created', description: `${newPo.po_number} sent to ${supplier?.name}.` });
      await loadData();

      // Best-effort ERPNext sync — the Supabase purchase order above is already
      // committed regardless of whether this succeeds. Visible toast (not silent)
      // since ERPNext writes are still being verified against the live instance.
      syncErpPurchaseOrder(newPo.id, draftLines);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const syncErpPurchaseOrder = async (poId: string, lines: DraftLine[]) => {
    if (!user || !supplier) return;
    try {
      const settings = await loadErpSettings(user.id);
      if (!settings?.erpUrl) return;
      const erpPoId = await createErpPurchaseOrder(
        settings,
        supplier.name,
        lines.map((l) => ({ sku: l.sku, description: l.description, quantity: l.quantity, unit_cost: l.unit_cost }))
      );
      await supabase.from('purchase_orders').update({ erpnext_po_id: erpPoId }).eq('id', poId);
      await loadData();
      toast({ title: 'Synced to ERPNext', description: `Purchase Order ${erpPoId} created in ERPNext.` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'ERPNext Sync Failed',
        description: error instanceof Error ? error.message : 'Unknown error connecting to ERPNext.',
      });
    }
  };

  const markAsReceived = async (poId: string) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'Received', received_at: new Date().toISOString() })
        .eq('id', poId);
      if (error) throw error;
      await loadData();
      toast({ title: 'Marked as Received' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <main className="flex-1 px-8 py-12">
        <div className="container mx-auto space-y-8">
          <div>
            <Button variant="ghost" onClick={() => navigate('/settings/suppliers')} className="mb-4 -ml-4 text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Suppliers
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{supplier?.name}</h1>
            <p className="text-muted-foreground">Order furniture from this supplier and track purchase orders.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Plus className="h-5 w-5" /> Add Line Item
                </h2>
                {priceList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No price list items are linked to this supplier yet. Add some in Price List settings first.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select Item (SKU)</Label>
                      <Select value={selectedSku} onValueChange={setSelectedSku}>
                        <SelectTrigger><SelectValue placeholder="Choose a product..." /></SelectTrigger>
                        <SelectContent>
                          {priceList.map((p) => (
                            <SelectItem key={p.id} value={p.sku}>
                              {p.sku} - {p.description} (RM {p.base_cost})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
                    </div>
                    <Button className="w-full" onClick={addDraftLine} disabled={!selectedSku}>
                      Add to Purchase Order
                    </Button>
                  </div>
                )}
              </div>

              {draftLines.length > 0 && (
                <div className="rounded-xl border bg-white p-6 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold">Draft Purchase Order</h3>
                  {draftLines.map((line, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-b-0">
                      <div>
                        <p className="font-medium">{line.sku} x{line.quantity}</p>
                        <p className="text-xs text-muted-foreground">RM {line.line_total.toFixed(2)}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeDraftLine(i)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-sm font-bold pt-2">Total: RM {draftTotal.toFixed(2)}</p>
                  <Button className="w-full" onClick={submitPurchaseOrder}>
                    Submit Purchase Order
                  </Button>
                </div>
              )}
            </div>

            <div className="lg:col-span-8 rounded-xl border bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Purchase Orders</h2>
              </div>
              {purchaseOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No purchase orders yet for this supplier.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left font-medium px-4 py-3">PO Number</th>
                      <th className="text-left font-medium px-4 py-3">Items</th>
                      <th className="text-left font-medium px-4 py-3">Total</th>
                      <th className="text-left font-medium px-4 py-3">Status</th>
                      <th className="text-right font-medium px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="border-b last:border-b-0">
                        <td className="px-4 py-2 font-medium">
                          {po.po_number}
                          {po.erpnext_po_id && (
                            <span className="block text-xs font-normal text-muted-foreground font-mono">ERP: {po.erpnext_po_id}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {(po.purchase_order_items || []).map((i: any) => `${i.sku} x${i.quantity}`).join(', ')}
                        </td>
                        <td className="px-4 py-2">RM {Number(po.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={po.status === 'Received' ? 'border-green-500 text-green-700' : 'border-amber-500 text-amber-700'}>
                            {po.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {po.status === 'Pending' && (
                            <Button variant="outline" size="sm" onClick={() => markAsReceived(po.id)}>
                              Mark as Received
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SupplierDetailPage;
