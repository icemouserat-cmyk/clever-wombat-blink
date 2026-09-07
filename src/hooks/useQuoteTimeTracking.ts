import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useQuoteTimeTracking = (quoteId: string | undefined, userId: string | undefined) => {
  const timeLogRef = useRef<string | null>(null);

  useEffect(() => {
    if (!quoteId || !userId) return;

    const startLog = async () => {
      const { data, error } = await supabase
        .from('founder_time_logs')
        .insert({
          user_id: userId,
          quotation_id: quoteId,
          start_time: new Date().toISOString(),
        })
        .select()
        .single();
      if (!error && data) {
        timeLogRef.current = data.id;
      }
    };

    startLog();

    const closeLog = async () => {
      const logId = timeLogRef.current;
      if (!logId) return;
      
      const end = new Date();
      const { data } = await supabase.from('founder_time_logs').select('start_time').eq('id', logId).single();
      if (!data) return;
      
      const start = new Date(data.start_time);
      const duration = Math.round((end.getTime() - start.getTime()) / 60000);
      
      try {
        await supabase
          .from('founder_time_logs')
          .update({ end_time: end.toISOString(), duration_minutes: duration })
          .eq('id', logId);
      } catch {
        // best-effort — ignore errors during unload/navigation
      }
    };

    window.addEventListener('beforeunload', closeLog);

    return () => {
      window.removeEventListener('beforeunload', closeLog);
      closeLog();
    };
  }, [quoteId, userId]);

  return { timeLogRef };
};
