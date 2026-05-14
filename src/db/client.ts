import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

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

/**
 * Node &lt; 22 không có `globalThis.WebSocket` — Realtime của supabase-js cần package `ws`.
 * Trình duyệt có WebSocket sẵn → không truyền transport.
 */
function supabaseRealtimeOptions(): {
  realtime?: { transport: typeof WebSocket };
} {
  if (typeof globalThis.WebSocket === 'function') {
    return {};
  }
  return {
    realtime: {
      transport: ws as unknown as typeof WebSocket,
    },
  };
}

const sharedOpts = supabaseRealtimeOptions();

export const isSupabaseConfigured = Boolean(url && anon);
export const supabase = createClient(url, anon, sharedOpts);

export function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
    ...sharedOpts,
  });
}
