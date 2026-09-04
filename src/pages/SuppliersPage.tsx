import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Plus, Database } from 'lucide-react';

const SuppliersPage = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { fetchSuppliers(); }, []);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers(data || []);
    setIsLoading(false);
  };

  const addSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    const { error } = await supabase.from('suppliers').insert({ name: name.trim(), user_id: user.id });
    if (error) return toast({ variant: 'destructive', description: error.message });
    setName('');
    await fetchSuppliers();
  };

  const deleteSupplier = async (id: string) => {
    await supabase.from('suppliers').delete().eq('id', id);
    await fetchSuppliers();
  };

  const seedSuppliers = async () => {
    if (!user) return;
    setIsLoading(true);
    const candidates = ['Artmatrix Technology', 'LenZon', 'Teyen Office Furniture'];
    for (const n of candidates) {
      const { data } = await supabase.from('suppliers').select('id').eq('name', n).eq('user_id', user.id).maybeSingle();
      if (!data) await supabase.from('suppliers').insert({ name: n, user_id: user.id });
    }
    await fetchSuppliers();
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <div className="container mx-auto py-8 px-4 max-w-5xl space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold">Supplier Management</h1>
            <p className="text-muted-foreground">Manage your factory partner references.</p>
          </div>
          <Button variant="outline" onClick={seedSuppliers} disabled={isLoading} className="gap-2"><Database className="h-4 w-4" /> Seed</Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 p-6 border rounded-xl space-y-4 bg-white">
              <h2 className="font-semibold">Add New</h2>
              <form onSubmit={addSupplier} className="space-y-4">
                <div className="space-y-2">
                  <Label>Supplier Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full gap-2"><Plus className="h-4 w-4" /> Add</Button>
              </form>
            </div>
            <div className="lg:col-span-2 border rounded-xl bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr><th className="text-left px-4 py-3 font-medium">Name</th><th className="text-right px-4 py-3 font-medium">Action</th></tr>
                </thead>
                <tbody>
                  {suppliers.map(s => (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{s.name}</td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteSupplier(s.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuppliersPage;
