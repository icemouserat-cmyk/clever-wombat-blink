import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  LogOut, Home, Users, FileText, DollarSign, Package, Settings, Sparkles, Plug, ClipboardCheck, ShieldAlert, TrendingUp,
} from 'lucide-react';

type AiStatus = 'checking' | 'online' | 'offline';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/inquiries', label: 'Inquiries', icon: Users },
  { to: '/quotations', label: 'Quotations', icon: FileText },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/approvals', label: 'Approvals', icon: ClipboardCheck },
  { to: '/settings/pricing', label: 'Price List', icon: DollarSign },
  { to: '/settings/suppliers', label: 'Suppliers', icon: Package },
  { to: '/insights', label: 'AI Insights', icon: Sparkles },
  { to: '/settings/ai', label: 'AI Settings', icon: Settings },
  { to: '/settings/erp', label: 'ERP Connection', icon: Plug },
  { to: '/settings/compliance', label: 'Compliance', icon: ShieldAlert },
];

const AppSidebar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
    <aside className="w-64 shrink-0 bg-white border-r min-h-screen flex flex-col">
      <div className="p-4 border-b">
        <p className="font-bold text-lg">AuraSpace Console</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t space-y-3">
        <Link
          to="/settings/ai"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3"
          title={statusLabel}
        >
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          {statusLabel}
        </Link>
        <div className="px-3 text-xs text-muted-foreground truncate">{user?.email}</div>
        <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full gap-2">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    </aside>
  );
};

export default AppSidebar;
