import { createClient } from '@supabase/supabase-js';

const fallbackUrl = 'https://izwfyqezvkkonwngbeih.supabase.co';
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6d2Z5cWV6dmtrb253bmdiZWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc0ODQsImV4cCI6MjEwMDA0MzQ4NH0.ISk7LoarxmHor-MXJBJjTEJ9-eiU_q7ZBMzGglIkl9o';

export const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || fallbackUrl;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || fallbackKey;

export const supabase = createClient(String(supabaseUrl), String(supabaseKey), {
  auth: {
    persistSession: true,
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Keep auth token refresh checks low to reduce repeated background requests.
    keepAliveInterval: 300000,
  },
});

export const AVATAR_BUCKET = 'user-avatars';
export const MEDIA_BUCKET = 'media_files';
