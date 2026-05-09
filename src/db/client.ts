import { createClient } from '@supabase/supabase-js';

const url =
  process.env.SUPABASE_URL?.trim() ||
  process.env.VITE_SUPABASE_URL?.trim() ||
  (typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_SUPABASE_URL ?? '') : '') ||
  '';
const anon =
  process.env.SUPABASE_ANON_KEY?.trim() ||
  process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  (typeof import.meta !== 'undefined' ? String(import.meta.env?.VITE_SUPABASE_ANON_KEY ?? '') : '') ||
  '';

export const isSupabaseConfigured = Boolean(url && anon);
export const supabase = createClient(url, anon);

export function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
