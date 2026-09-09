import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_DENYLIST } from '@/services/workflowEngine';
import { Loader2, Trash2, Plus } from 'lucide-react';

const CompliancePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [terms, setTerms] = useState<{ id: string; term: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTerm, setNewTerm] = useState('');

  useEffect(() => {
    loadTerms();
  }, []);

  const loadTerms = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('compliance_denylist').select('*').order('term');
    if (!data || data.length === 0) {
      if (user) {
        for (const term of DEFAULT_DENYLIST) {
          await supabase.from('compliance_denylist').insert({ term, created_by: user.id });
        }
      }
      const { data: seeded } = await supabase.from('compliance_denylist').select('*').order('term');
      setTerms(seeded || []);
    } else {
      setTerms(data);
    }
    setIsLoading(false);
  };

  const handleAdd = async () => {
    if (!user || !newTerm.trim()) return;
    const { error } = await supabase.from('compliance_denylist').insert({ term: newTerm.trim(), created_by: user.id });
    if (error) {
      toast({ variant: 'destructive', description: error.message });
      return;
    }
    setNewTerm('');
    await loadTerms();
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('compliance_denylist').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', description: error.message });
      return;
    }
    setTerms((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <main className="flex-1 px-8 py-12">
        <div className="container mx-auto py-8 px-4 max-w-2xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Compliance Denylist</h1>
            <p className="text-muted-foreground">
              Terms that force a compliance hold when they appear in quotation content — shared across all users, since this is a company-wide policy, not a personal setting.
            </p>
          </div>

          <div className="rounded-xl border bg-white p-6 space-y-4">
            <div className="flex gap-2">
              <Input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="e.g. Maybank" onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
              <Button onClick={handleAdd} disabled={!newTerm.trim()} className="gap-2">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {terms.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm">{t.term}</span>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CompliancePage;
