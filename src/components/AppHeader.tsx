import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, Home } from 'lucide-react';

type AiStatus = 'checking' | 'online' | 'offline';

const AppHeader = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [aiStatus, setAiStatus] = useState<AiStatus>('checking');

  useEffect(() => {
    checkAiStatus();
  }, [user]);

  const checkAiStatus = async () => {
    setAiStatus('checking');
    if (!user) {
      setAiStatus('offline');
      return;
    }
    try {
      const { data } = await supabase
        .from('app_config')
        .select('*')
        .eq('key', `ollama_settings_${user.id}`)
        .maybeSingle();

      if (!data?.value) {
        setAiStatus('offline');
        return;
      }

      const parsed = JSON.parse(data.value);
      if (!parsed.endpoint) {
        setAiStatus('offline');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const cleanEndpoint = parsed.endpoint.trim().replace(/\/+$/, '');
      const res = await fetch(`${cleanEndpoint}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);

      setAiStatus(res.ok ? 'online' : 'offline');
    } catch {
      setAiStatus('offline');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  const dotColor =
    aiStatus === 'online' ? 'bg-green-500' :
    aiStatus === 'offline' ? 'bg-red-500' :
    'bg-slate-300 animate-pulse';

  const statusLabel =
    aiStatus === 'online' ? 'AI Advisor: Online' :
    aiStatus === 'offline' ? 'AI Advisor: Offline' :
    'AI Advisor: Checking...';

  return (
    <div className="border-b bg-white">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg hover:text-primary">
          <Home className="h-5 w-5" /> AuraSpace Console
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/settings/ai"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            title={statusLabel}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
            <span className="hidden sm:inline">{statusLabel}</span>
          </Link>
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppHeader;
