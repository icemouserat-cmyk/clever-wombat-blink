import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Wifi, Eye, EyeOff, LogIn } from 'lucide-react';

type AuthMode = 'token' | 'session';

interface ErpSettings {
  erpUrl: string;
  authMode: AuthMode;
  apiKey: string;
  apiSecret: string;
  username: string;
  password: string;
}

const DEFAULT_SETTINGS: ErpSettings = {
  erpUrl: '',
  authMode: 'token',
  apiKey: '',
  apiSecret: '',
  username: '',
  password: '',
};

// Only http/https base URLs are accepted; API calls are restricted to this origin.
function normaliseBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('Enter the ERPNext base URL first.');
  const url = new URL(trimmed);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('ERPNext URL must use http:// or https://');
  }
  return `${url.protocol}//${url.host}`;
}

const ERPConfigPage = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ErpSettings>(DEFAULT_SETTINGS);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    setIsLoading(true);
    if (user) {
      const { data } = await supabase.from('app_config').select('*').eq('key', `erpnext_settings_${user.id}`).maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        } catch {
          // ignore malformed stored settings
        }
      }
    }
    setIsLoading(false);
  };

  const saveSettings = async () => {
    if (!user) return;
    setIsSaving(true);
    const value = JSON.stringify(settings);
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: `erpnext_settings_${user.id}`, value }, { onConflict: 'key' });
    setIsSaving(false);
    if (error) {
      toast({ variant: 'destructive', description: error.message });
    } else {
      toast({ title: 'Saved', description: 'ERPNext connection settings updated.' });
    }
  };

  const testTokenConnection = async (baseUrl: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const target = new URL('/api/resource/DocType', baseUrl);
      target.searchParams.set('fields', '["name"]');
      target.searchParams.set('limit_page_length', '1');
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (settings.apiKey && settings.apiSecret) {
        headers.Authorization = `token ${settings.apiKey}:${settings.apiSecret}`;
      }
      const res = await fetch(target.toString(), { headers, signal: controller.signal });
      if (res.status === 401) throw new Error('Authentication failed. Check the API key and secret.');
      if (res.status === 403) throw new Error('Permission denied. This user cannot read DocType.');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const testSessionConnection = async (baseUrl: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const target = new URL('/api/method/login', baseUrl);
      const form = new URLSearchParams({ usr: settings.username, pwd: settings.password });
      const res = await fetch(target.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: form,
        credentials: 'include',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(res.status === 401 ? 'Invalid username or password.' : `HTTP ${res.status}`);
      return true;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const testConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const baseUrl = normaliseBaseUrl(settings.erpUrl);
      setSettings((prev) => ({ ...prev, erpUrl: baseUrl }));
      if (settings.authMode === 'token') {
        await testTokenConnection(baseUrl);
      } else {
        await testSessionConnection(baseUrl);
      }
      setTestStatus('success');
      setTestMessage('Connected successfully.');
      toast({ title: 'Connected', description: 'ERPNext connection successful.' });
    } catch (err) {
      setTestStatus('error');
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const message = isAbort ? 'Timed out after 8s.' : err instanceof Error ? err.message : 'Could not reach ERPNext.';
      setTestMessage(message);
      toast({ variant: 'destructive', title: 'Connection Failed', description: message });
    }
  };

  const update = <K extends keyof ErpSettings>(key: K, value: ErpSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

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
            <h1 className="text-3xl font-bold tracking-tight">ERPNext Connection</h1>
            <p className="text-muted-foreground">Connect this app to your ERPNext instance so the AI Agent, Business Adviser, and Analytics can read live data.</p>
          </div>

          <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 text-xs text-amber-800">
            Credentials are stored against your account and are only sent directly to the ERPNext URL you configure. Use a dedicated, least-privilege ERPNext user, and prefer HTTPS with CORS restricted to this app's origin.
          </div>

          <div className="rounded-xl border bg-white p-6 space-y-4">
            <div className="space-y-2">
              <Label>ERPNext Base URL</Label>
              <Input
                value={settings.erpUrl}
                onChange={(e) => update('erpUrl', e.target.value)}
                placeholder="https://erp.example.com"
                type="url"
              />
              <p className="text-xs text-muted-foreground">Only HTTP or HTTPS URLs are accepted. API calls are restricted to this base origin.</p>
            </div>

            <div className="space-y-2">
              <Label>Authentication Mode</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={settings.authMode}
                onChange={(e) => update('authMode', e.target.value as AuthMode)}
              >
                <option value="token">API Key + API Secret</option>
                <option value="session">Session login (username + password)</option>
              </select>
            </div>

            {settings.authMode === 'token' ? (
              <>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input value={settings.apiKey} onChange={(e) => update('apiKey', e.target.value)} autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label>API Secret</Label>
                  <div className="relative">
                    <Input
                      value={settings.apiSecret}
                      onChange={(e) => update('apiSecret', e.target.value)}
                      type={showApiSecret ? 'text' : 'password'}
                      autoComplete="off"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiSecret((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label="Show or hide API secret"
                    >
                      {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Uses <code>Authorization: token key:secret</code>.</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>ERPNext User</Label>
                  <Input value={settings.username} onChange={(e) => update('username', e.target.value)} autoComplete="username" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      value={settings.password}
                      onChange={(e) => update('password', e.target.value)}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label="Show or hide password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Uses ERPNext's login endpoint with browser cookies (<code>credentials: include</code>).</p>
                </div>
              </>
            )}

            <Button variant="outline" onClick={testConnection} disabled={testStatus === 'testing'} className="gap-2">
              {testStatus === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : settings.authMode === 'session' ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              {settings.authMode === 'session' ? 'Log in with session' : 'Test ERPNext Connection'}
            </Button>

            {testStatus === 'success' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> {testMessage || 'Connected.'}
              </div>
            )}
            {testStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" /> {testMessage}
              </div>
            )}

            <Button onClick={saveSettings} disabled={isSaving || !settings.erpUrl} className="w-full">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Settings
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ERPConfigPage;
