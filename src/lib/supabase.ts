import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || supabaseUrl === 'your_supabase_url_here') {
  console.warn('⚠️ Supabase URL not configured. Please set VITE_SUPABASE_URL in your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
