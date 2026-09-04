import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Database, CheckCircle2, AlertCircle } from 'lucide-react';

const PricingPage = () => {
  const { user } = useAuth();
  const [prices, setPrices] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [localEdits, setLocalEdits] = useState<Record<string, any>>({});
  const [rowStatus, setRowStatus] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [p, s] = await Promise.all([
      supabase.from('price_list').select('*').order('sku'),
      supabase.from('suppliers').select('id, name').order('name')
    ]);
    setPrices(p.data || []);
    setSuppliers(s.data || []);
    setIsLoading(false);
  };

  const updateLocal = (id: string, updates: any) => {
    setLocalEdits(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
    setRowStatus(prev => ({ ...prev, [id]: 'idle' }));
  };

  const handleSave = async (id: string, explicitUpdates?: any) => {
    const updates = explicitUpdates ?? localEdits[id];
    if (!updates) return;
    setRowStatus(prev => ({ ...prev, [id]: 'saving' }));
    try {
      const { error } = await supabase.from('price_list').update(updates).eq('id', id);
      if (error) throw error;
      setRowStatus(prev => ({ ...prev, [id]: 'saved' }));
      setPrices(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      setLocalEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (e: any) {
      setRowStatus(prev => ({ ...prev, [id]: 'error' }));
      toast({ variant: 'destructive', description: e.message });
    }
  };

  const seedCatalogue = async () => {
    if (!user) return;
    setIsLoading(true);
    const catalog = [
      { sku: 'SKU-DESK-01', desc: 'Standard Office Desk', cost: 550, group: 'Furniture - Standard' },
      { sku: 'SKU-CHAIR-01', desc: 'Ergonomic Task Chair', cost: 550, group: 'Furniture - Standard' },
      { sku: 'SKU-CAB-01', desc: 'Storage/Filing Cabinet', cost: 900, group: 'Furniture - Standard' },
      { sku: 'SKU-CLUSTER-4P', desc: '4-Pax Workstation Cluster', cost: 4000, group: 'Furniture - Standard' },
      { sku: 'SKU-TABLE-8P', desc: '8-Seater Conference Table', cost: 3500, group: 'Furniture - Standard' },
      { sku: 'SKU-PART-01', desc: 'Partition System', cost: 325, group: 'Furniture - Standard' },
      { sku: 'SKU-BESPOKE', desc: 'Bespoke Project', cost: 0, group: 'Furniture - Custom' },
    ];
    for (const item of catalog) {
      const { data } = await supabase.from('price_list').select('id').eq('sku', item.sku).eq('user_id', user.id).maybeSingle();
      if (!data) await supabase.from('price_list').insert({ sku: item.sku, description: item.desc, base_cost: item.cost, item_group: item.group, user_id: user.id });
    }
    await fetchData();
    setIsLoading(false);
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Master Price List</h1>
          <p className="text-muted-foreground">Central pricing control.</p>
        </div>
        <Button variant="outline" onClick={seedCatalogue} disabled={isLoading} className="gap-2"><Database className="h-4 w-4" /> Seed</Button>
      </div>
      <div className="rounded-xl border bg-white overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[140px]">SKU</TableHead>
              <TableHead className="w-full">Description</TableHead>
              <TableHead className="w-[120px]">Cost (RM)</TableHead>
              <TableHead className="w-[180px]">Group</TableHead>
              <TableHead className="w-[180px]">Supplier</TableHead>
              <TableHead className="text-center w-[80px]">Status</TableHead>
              <TableHead className="text-right w-[80px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map(item => {
              const edit = localEdits[item.id] || {};
              const status = rowStatus[item.id] || 'idle';
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-medium">{item.sku}</TableCell>
                  <TableCell>
                    <Input className="h-8" value={edit.description ?? item.description} onChange={(e) => updateLocal(item.id, { description: e.target.value })} onBlur={() => handleSave(item.id)} />
                  </TableCell>
                  <TableCell>
                    <Input className="h-8" type="number" value={edit.base_cost ?? item.base_cost} onChange={(e) => updateLocal(item.id, { base_cost: parseFloat(e.target.value) || 0 })} onBlur={() => handleSave(item.id)} />
                  </TableCell>
                  <TableCell>
                    <Select value={edit.item_group ?? item.item_group} onValueChange={(val: any) => { updateLocal(item.id, { item_group: val }); handleSave(item.id, { item_group: val }); }}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Furniture - Standard">Standard</SelectItem>
                        <SelectItem value="Furniture - Custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={(edit.supplier_id ?? item.supplier_id) || ''} onValueChange={(val) => { updateLocal(item.id, { supplier_id: val || null }); handleSave(item.id, { supplier_id: val || null }); }}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin mx-auto text-blue-500" />}
                    {status === 'saved' && <CheckCircle2 className="h-4 w-4 mx-auto text-green-500" />}
                    {status === 'error' && <AlertCircle className="h-4 w-4 mx-auto text-destructive" />}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSave(item.id)} disabled={status === 'saving'}><Save className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PricingPage;
