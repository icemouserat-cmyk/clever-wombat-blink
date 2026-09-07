import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Wifi } from 'lucide-react';

const DEFAULT_ENDPOINT = 'http://localhost:11434';

const AIConfigPage = () => {
  const { user } = useAuth();
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [model, setModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    if (user) {
      const { data } = await supabase.from('app_config').select('*').eq('key', `ollama_settings_${user.id}`).maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          setEndpoint(parsed.endpoint || DEFAULT_ENDPOINT);
          setModel(parsed.model || '');
        } catch {}
      }
    }
    setIsLoading(false);
  };

  const saveSettings = async () => {
    if (!user) return;
    const value = JSON.stringify({ endpoint, model });
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: `ollama_settings_${user.id}`, value }, { onConflict: 'key' });
    if (error) {
      toast({ variant: 'destructive', description: error.message });
    } else {
      toast({ title: 'Saved', description: 'AI advisor settings updated.' });
    }
  };

  const testConnection = async () => {
    setTestStatus('testing');
    setAvailableModels([]);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const cleanEndpoint = endpoint.trim().replace(/\/+$/, '');
      const res = await fetch(`${cleanEndpoint}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const models = (data.models || []).map((m: any) => m.name);
      setAvailableModels(models);
      setTestStatus('success');
      toast({ title: 'Connected', description: `Found ${models.length} model(s).` });
    } catch (err: any) {
      setTestStatus('error');
      toast({ variant: 'destructive', title: 'Connection Failed', description: err.name === 'AbortError' ? 'Timed out after 5s.' : err.message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <AppSidebar />
        <main className="flex-1 px-8 py-12 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <main className="flex-1 px-8 py-12">
        <div className="container mx-auto py-8 px-4 max-w-2xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Advisor Settings</h1>
            <p className="text-muted-foreground">Configure the local Ollama endpoint used by the quotation advisor.</p>
          </div>

          <div className="rounded-xl border bg-white p-6 space-y-4">
            <div className="space-y-2">
              <Label>Ollama Endpoint URL</Label>
              <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="http://localhost:11434" />
              <p className="text-xs text-muted-foreground">Ollama must be running locally on this device. This is not a cloud secret and is never sent anywhere except your own configured endpoint.</p>
            </div>

            <Button variant="outline" onClick={testConnection} disabled={testStatus === 'testing'} className="gap-2">
              {testStatus === 'testing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              Test Connection
            </Button>

            {testStatus === 'success' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Connected — {availableModels.length} model(s) available
              </div>
            )}
            {testStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" /> Could not reach Ollama. Advisor features will show an offline state until this is resolved.
              </div>
            )}

            {availableModels.length > 0 && (
              <div className="space-y-2">
                <Label>Model</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="">Select a model...</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {availableModels.length === 0 && (
              <div className="space-y-2">
                <Label>Model name (manual entry)</Label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. qwen2.5:7b" />
              </div>
            )}

            <Button onClick={saveSettings} disabled={!model} className="w-full">Save Settings</Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIConfigPage;
