import { getSupabaseAdmin } from './client.js';

export interface HaravanSessionRow {
  id: string;
  user_sub: string;
  user_email: string | null;
  user_name: string | null;
  orgid: string | null;
  orgname: string | null;
  access_token: string;
  id_token: string | null;
  refresh_token: string | null;
  token_expires_at: string;
  scope: string | null;
  shop_info: unknown;
}

export async function saveOAuthState(state: string, nonce: string, expiresAt: Date): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('haravan_oauth_states').insert({
    state,
    nonce,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;
}

export async function consumeOAuthState(state: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('haravan_oauth_states')
    .select('nonce, expires_at')
    .eq('state', state)
    .maybeSingle();
  if (error) throw error;
  await admin.from('haravan_oauth_states').delete().eq('state', state);
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.nonce as string;
}

export async function upsertHaravanSession(input: {
  user_sub: string;
  user_email?: string | null;
  user_name?: string | null;
  orgid?: string | null;
  orgname?: string | null;
  access_token: string;
  id_token?: string | null;
  refresh_token?: string | null;
  token_expires_at: Date;
  scope?: string | null;
  shop_info?: unknown;
}): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('haravan_sessions')
    .upsert(
      {
        user_sub: input.user_sub,
        user_email: input.user_email ?? null,
        user_name: input.user_name ?? null,
        orgid: input.orgid ?? null,
        orgname: input.orgname ?? null,
        access_token: input.access_token,
        id_token: input.id_token ?? null,
        refresh_token: input.refresh_token ?? null,
        token_expires_at: input.token_expires_at.toISOString(),
        scope: input.scope ?? null,
        shop_info: input.shop_info ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_sub' },
    )
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function getHaravanSessionById(sessionId: string): Promise<HaravanSessionRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('haravan_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (error) throw error;
  return data as HaravanSessionRow | null;
}

/**
 * Lấy 1 session bất kỳ (mới nhất) của org — dùng cho proxy storefront khi không có cookie session.
 * Có thể có nhiều user trong cùng org → chọn row updated_at desc.
 */
export async function getHaravanSessionByOrgId(orgId: string): Promise<HaravanSessionRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('haravan_sessions')
    .select('*')
    .eq('orgid', orgId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as HaravanSessionRow | null;
}

export async function updateSessionTokens(
  sessionId: string,
  input: {
    access_token: string;
    refresh_token?: string | null;
    id_token?: string | null;
    token_expires_at: Date;
  },
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('haravan_sessions')
    .update({
      access_token: input.access_token,
      refresh_token: input.refresh_token ?? null,
      id_token: input.id_token ?? null,
      token_expires_at: input.token_expires_at.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function deleteSessionsByOrgId(orgId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('haravan_sessions').delete().eq('orgid', orgId);
  if (error) throw error;
}

export async function deleteWidgetDataByOrgId(orgId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from('widget_blocks').delete().eq('org_id', orgId);
  await admin.from('widget_config').delete().eq('org_id', orgId);
}

export async function deleteProfileBindingsByOrgId(orgId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from('haravan_profile_bindings').delete().eq('haravan_org_id', orgId);
}
