import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, WifiOff, AlertTriangle } from 'lucide-react';

interface AIAdvisorPanelProps {
  quotation: any;
  customer: any;
  items: any[];
}

const AIAdvisorPanel: React.FC<AIAdvisorPanelProps> = ({ quotation, customer, items }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<{ endpoint: string; model: string } | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<'idle' | 'offline' | 'error'>('idle');

  useEffect(() => {
    const loadSettings = async () => {
      setIsConfigLoading(true);
      if (user) {
        const { data } = await supabase
          .from('app_config')
          .select('*')
          .eq('key', `ollama_settings_${user.id}`)
          .maybeSingle();
        if (data?.value) {
          try {
            const parsed = JSON.parse(data.value);
            if (parsed.endpoint && parsed.model) setSettings(parsed);
          } catch {}
        }
      }
      setIsConfigLoading(false);
    };
    loadSettings();
  }, [user]);

  const buildContext = () => {
    const lineItems = items.map(i => `- ${i.sku} x${i.quantity} @ RM${i.unit_price.toFixed(2)} = RM${i.line_total.toFixed(2)} (${i.requires_a3_approval ? 'Custom - requires approval' : 'Standard'})`).join('\n');
    return `Customer: ${customer?.name || 'Unknown'} (staff size: ${customer?.staff_size || 'unknown'})
Quotation status: ${quotation?.status}
Total amount: RM ${Number(quotation?.total_amount || 0).toFixed(2)}
Line items:
${lineItems || '(no items yet)'}`;
  };

  const generateAdvice = async () => {
    if (!settings) return;
    setIsGenerating(true);
    setResponse('');
    setStatus('idle');

    const systemPrompt = `You are a quotation advisor for AuraSpace, a furniture sourcing company. You are given ONLY the recorded quotation data below as context. Do not invent customer names, prices, discounts, or commitments not present in the data. Summarize the quotation in 2-3 concise sentences for the founder, and flag if any Standard item's markup looks unusually low or if the quote seems worth a second look. Never promise a discount, delivery date, or commitment on the founder's behalf. If context is insufficient, say so plainly.`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const cleanEndpoint = settings.endpoint.trim().replace(/\/+$/, '');

      const res = await fetch(`${cleanEndpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: buildContext() },
          ],
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResponse(data.message?.content || 'No response content received.');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus('offline');
      } else {
        setStatus('error');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  if (isConfigLoading) {
    return (
      <div className="rounded-xl border bg-slate-50 p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-xl border bg-slate-50 p-6 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <WifiOff className="h-4 w-4" /> AI Advisor not configured
        </div>
        <p className="text-xs text-muted-foreground">
          Set up an Ollama endpoint and model in Settings to enable quotation advice.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" /> AI Advisor
        </h3>
        <Button size="sm" variant="outline" onClick={generateAdvice} disabled={isGenerating || items.length === 0}>
          {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Summarize'}
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">Add line items to get a quotation summary.</p>
      )}

      {status === 'offline' && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <WifiOff className="h-3 w-3" /> Ollama did not respond in time. Check that it is running locally.
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" /> Could not reach the AI advisor. Verify your settings.
        </div>
      )}

      {response && (
        <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">
          {response}
        </div>
      )}
    </div>
  );
};

export default AIAdvisorPanel;
