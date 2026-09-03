import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, Send, RotateCcw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AIAdvisorProps {
  quoteData: {
    customerName: string;
    items: any[];
    total: number;
  };
  onAuditComplete?: (suggestions: string) => void;
}

export default function AIAdvisorPanel({ quoteData }: AIAdvisorProps) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getEndpoint = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'ollama_endpoint')
      .single();
    return data?.value || 'http://localhost:11434';
  };

  const sendMessage = async (text: string = input) => {
    if (!text.trim()) return;

    const userMessage = { role: 'user' as const, content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = await getEndpoint();
      const response = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3', // Default model, could be configurable
          prompt: constructPrompt(text, quoteData),
          stream: false,
        }),
      });

      if (!response.ok) throw new Error(`AI API error: ${response.statusText}`);
      
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Ollama. Please check your configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const constructPrompt = (userText: string, data: any) => {
    return `You are the AuraSpace AI Advisor, a professional furniture sourcing auditor.
    
    CONTEXT:
    Customer: ${data.customerName}
    Quote Items: ${data.items.map((i: any) => `${i.sku}: ${i.description} x${i.quantity} @ $${i.unit_price}`).join(', ')}
    Total Quote Value: $${data.total}
    
    USER REQUEST: ${userText}
    
    INSTRUCTIONS:
    - Be concise and professional.
    - Audit for underpricing (target markup 18-20%).
    - Suggest alternative SKU groupings if applicable.
    - Flag items that seem unusually high or low in cost based on furniture industry standards.
    - Do NOT commit to any price or timeline; suggest "Founder Review Required".`;
  };

  const runAudit = () => {
    sendMessage('Perform a full audit of this quotation. Check for pricing errors and offer suggestions for improvement.');
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-indigo-50 flex justify-between items-center">
        <div className="flex items-center gap-2 font-semibold text-indigo-900">
          <BrainCircuit className="w-5 h-5" /> AI Advisor
        </div>
        <Button variant="ghost" size="sm" onClick={clearChat} className="text-slate-500">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-10 space-y-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
              <BrainCircuit className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">Ready to audit your quote</p>
              <p className="text-xs text-slate-500">I can check for pricing errors, suggest markup adjustments, or help draft descriptions.</p>
            </div>
            <Button variant="outline" onClick={runAudit} className="text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50">
              Run Initial Audit
            </Button>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
              m.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-slate-100 text-slate-800 rounded-tl-none border'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 p-3 rounded-lg rounded-tl-none border text-xs text-slate-500 animate-pulse">
              AI is thinking...
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="bg-red-50 p-3 rounded-lg rounded-tl-none border border-red-200 text-xs text-red-600 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t bg-slate-50">
        <div className="flex gap-2">
          <Input 
            placeholder="Ask AI about this quote..." 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="bg-white"
          />
          <Button onClick={() => sendMessage()} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
