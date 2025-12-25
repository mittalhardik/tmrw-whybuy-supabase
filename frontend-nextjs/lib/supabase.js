import { createClient } from '@supabase/supabase-js';

// Support runtime environment variables (for Cloud Run)
// In browser, check window.env first, then fall back to process.env
const isBrowser = typeof window !== 'undefined';
const supabaseUrl = isBrowser && window.env?.NEXT_PUBLIC_SUPABASE_URL
  ? window.env.NEXT_PUBLIC_SUPABASE_URL
  : process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = isBrowser && window.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: Missing Supabase URL or Key in environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('NEXT_PUBLIC_SUPABASE_KEY:', supabaseKey ? 'Set' : 'Missing');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
