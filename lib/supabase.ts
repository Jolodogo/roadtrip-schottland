import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client (used in components for Realtime + reads)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role key (used in API routes for writes)
export function createServerClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export const STORAGE_BUCKET = 'trip-photos';
