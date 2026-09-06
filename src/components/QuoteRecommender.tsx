import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, WifiOff, AlertTriangle } from 'lucide-react';

interface QuoteRecommenderProps {
  customers: any[];
}

const QuoteRecommender: React.FC<QuoteRecommenderProps> = ({ customers }) => {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<'idle' | 'offline' | 'error' | 'not_configured'>('idle');

  const askAdvisor = async () => {
    if (!question.trim() || !user) return;
    setIsAsking(true);
    setResponse('');
    setStatus('idle');

    try {
      const { data: configData } = await supabase
        .from('app_config')
        .select('*')
        .eq('key', `ollama_settings_${user.id}`)
        .maybeSingle();

      if (!configData?.value) {
        setStatus('not_configured');
        setIsAsking(false);
        return;
      }

      const settings = JSON.parse(configData.value);
      if (!settings.endpoint || !settings.model) {
        setStatus('not_configured');
        setIsAsking(false);
        return;
      }

      const customerList = customers.map(c =>
        `- ${c.name}: referral_source=${c.referral_source}, staff_size=${c.staff_size}`
      ).join('\n');

      const systemPrompt = `You are a quotation advisor for AuraSpace, a furniture sourcing company.
You are given ONLY the recorded customer list below. AuraSpace has two item groups:
"Furniture - Standard" (fixed catalogue items like desks, chairs, cabinets, workstations, conference tables, partitions) and
"Furniture - Custom" (bespoke projects, requires founder approval before sending, no fixed price).
When asked whether a customer is likely to need Standard or Custom pricing, reason ONLY from what is stated
(staff size, referral source) plus general furnishing logic (e.g. large staff size or complex layouts may
suggest custom/bespoke needs; straightforward small offices usually fit standard catalogue items).
Do NOT invent specific quotation amounts, specific item choices, or commitments. If you don't have enough
information to answer confidently, say so plainly.`;

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
            { role: 'user', content: `Recorded customers:\n${customerList || '(none yet)'}\n\nQuestion: ${question}` },
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
      setStatus(err.name === 'AbortError' ? 'offline' : 'error');
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white p-6 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-500" /> Ask the Pricing Advisor
      </h3>
      <div className="space-y-2">
        <Label className="text-xs">Ask about a customer (e.g. "Should Test SME Sdn Bhd get standard or custom pricing?")</Label>
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question..."
            onKeyDown={(e) => e.key === 'Enter' && askAdvisor()}
          />
          <Button onClick={askAdvisor} disabled={isAsking || !question.trim()}>
            {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
          </Button>
        </div>
      </div>

      {status === 'not_configured' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <WifiOff className="h-3 w-3" /> Configure the AI Advisor in Settings first.
        </div>
      )}
      {status === 'offline' && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <WifiOff className="h-3 w-3" /> Ollama did not respond in time.
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" /> Could not reach the AI advisor.
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

export default QuoteRecommender;
