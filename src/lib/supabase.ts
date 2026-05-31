import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hkhccivrxuqsnyizrptq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhraGNjaXZyeHVxc255aXpycHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjE5ODAsImV4cCI6MjA5NTc5Nzk4MH0.Coh832CYQcnX5l_vVfirjiWK8EYzJwXvvGlv4QoZP8A';

if (!supabaseUrl || supabaseUrl === 'your_supabase_url_here') {
  console.warn('⚠️ Supabase URL not configured. Please set VITE_SUPABASE_URL in your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
