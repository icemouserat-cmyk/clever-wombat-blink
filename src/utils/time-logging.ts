import { supabase } from '@/integrations/supabase/client';

export async function startTimeLog(quotationId: string | null) {
  const sessionId = Math.random().toString(36).substring(7);
  const { error } = await supabase
    .from('founder_time_logs')
    .insert([{ 
      quotation_id: quotationId, 
      start_time: new Date().toISOString(), 
      session_id: sessionId 
    }]);
  
  if (error) console.error('Error starting time log:', error);
  return sessionId;
}

export async function endTimeLog(sessionId: string) {
  if (!sessionId) return;

  const { data: log, error: fetchError } = await supabase
    .from('founder_time_logs')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (fetchError || !log) return;

  const startTime = new Date(log.start_time).getTime();
  const endTime = new Date().getTime();
  const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));

  const { error: updateError } = await supabase
    .from('founder_time_logs')
    .update({ 
      end_time: new Date().toISOString(), 
      duration_minutes: durationMinutes 
    })
    .eq('id', log.id);

  if (updateError) console.error('Error ending time log:', updateError);
}
