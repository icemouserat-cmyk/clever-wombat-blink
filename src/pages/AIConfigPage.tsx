import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { BrainCircuit, Save, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AIConfigPage() {
  const { toast } = useToast();
  const [endpoint, setEndpoint] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      // We'll store the config in a simple 'app_config' table or similar
      // For now, let's check if the table exists, if not, we'll create it
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'ollama_endpoint')
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
      if (data) setEndpoint(data.value);
    } catch (error: any) {
      console.error("Error fetching AI config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ key: 'ollama_endpoint', value: endpoint });

      if (error) throw error;
      toast({ title: "Configuration Saved", description: "Ollama endpoint has been updated." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading configuration...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <BrainCircuit className="w-8 h-8 text-indigo-600" /> AI Advisor Configuration
        </h1>
        <p className="text-slate-500">Configure the connection to your local Ollama instance for quotation auditing and drafting.</p>
      </div>

      <div className="bg-white p-8 rounded-xl border shadow-sm space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="endpoint">Ollama API Endpoint</Label>
            <Input 
              id="endpoint"
              placeholder="http://localhost:11434" 
              value={endpoint} 
              onChange={(e) => setEndpoint(e.target.value)} 
              className="font-mono"
            />
            <p className="text-xs text-slate-500">Default local Ollama address is typically http://localhost:11434</p>
          </div>

          <Button 
            onClick={saveConfig} 
            disabled={isSaving} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
          >
            {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Configuration</>}
          </Button>
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Integration Note</AlertTitle>
          <AlertDescription className="text-blue-700">
            The AI Advisor connects directly from your browser to your local Ollama API. Ensure that Ollama is running and CORS is configured to allow requests from your app's domain.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
