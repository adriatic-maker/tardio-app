import { useEffect } from 'react';
import { supabase } from './supabase';

export async function saveJobs(jobs) {
  await supabase.from('jobs').upsert({ id: 'all', data: jobs, updated_at: new Date() });
}

export async function loadJobs() {
  const { data } = await supabase.from('jobs').select('data').eq('id', 'all').single();
  return data?.data || null;
}

export async function saveChecked(checked) {
  await supabase.from('checked').upsert({ id: 'global', data: checked, updated_at: new Date() });
}

export async function loadChecked() {
  const { data } = await supabase.from('checked').select('data').eq('id', 'global').single();
  return data?.data || null;
}

export async function savePendingCOs(list) {
  await supabase.from('pending_cos').upsert({ id: 'all', data: list, updated_at: new Date() });
}

export async function loadPendingCOs() {
  const { data } = await supabase.from('pending_cos').select('data').eq('id', 'all').single();
  return data?.data || [];
}

export function useRealtimeSync({ setJobs, setChecked, setPendingCOs }) {
  useEffect(() => {
    const channel = supabase
      .channel('tardio-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, payload => {
        if (payload.new?.data) setJobs(payload.new.data);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checked' }, payload => {
        if (payload.new?.data) setChecked(payload.new.data);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_cos' }, payload => {
        if (payload.new?.data) setPendingCOs(payload.new.data);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);
}