import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from '../config/index.js';

if (!config.supabase.url) {
  console.warn('Warning: SUPABASE_URL is not defined');
}

const supabaseKey =
  config.supabase.serviceRoleKey || config.supabase.anonKey;

if (!supabaseKey) {
  console.warn('Warning: Set SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_ANON_KEY');
} else if (!config.supabase.serviceRoleKey) {
  console.warn(
    'Warning: Using anon key for admin booking writes. Add SUPABASE_SERVICE_ROLE_KEY to backend .env for reliable admin CRUD.'
  );
}

/** Server-side client — prefers service role so admin updates bypass RLS. */
export const supabase: SupabaseClient = createClient(config.supabase.url, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default supabase;
