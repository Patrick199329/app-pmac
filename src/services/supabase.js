import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dxgxdgnuzimhgmwhdkcd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Z3hkZ251emltaGdtd2hka2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODkxMzYsImV4cCI6MjA4NzM2NTEzNn0.Dv5hMleFScPsE3xGWVdwM1qOD1Dgf6CZQ9DuNF_5C8U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Access helpers
 */
export const checkAccessPass = async (userId) => {
    if (!userId) return false;
    const { data: pass } = await supabase
        .from('access_passes')
        .select('status')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1);

    return pass && pass.length > 0;
};

export const checkVideoWatched = async (userId, videoKey) => {
    if (!userId || !videoKey) return false;
    const { data: view } = await supabase
        .from('video_views')
        .select('completed_at')
        .eq('user_id', userId)
        .eq('video_key', videoKey)
        .single();

    return !!view?.completed_at;
};

/**
 * Get current profile with role
 */
export const getUserProfile = async (userId) => {
    if (!userId) return null;
    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    return data;
};
export const getUserActivePlan = async (userId) => {
    if (!userId) return 'BASICO';
    const { data: pass } = await supabase
        .from('access_passes')
        .select('plan')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return pass?.plan || 'BASICO';
};
