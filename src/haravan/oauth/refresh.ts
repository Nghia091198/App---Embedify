import type { Response } from 'express';
import { updateSessionTokens } from '../../db/sessionStore.js';
import type { HaravanRequest } from '../authMiddleware.js';
async function exchangeRefresh(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
} | null> {
  const clientId = process.env.HARAVAN_CLIENT_ID?.trim();
  const clientSecret = process.env.HARAVAN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch('https://accounts.haravan.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  if (!data?.access_token) return null;
  return {
    access_token: String(data.access_token),
    refresh_token: data.refresh_token != null ? String(data.refresh_token) : undefined,
    id_token: data.id_token != null ? String(data.id_token) : undefined,
    expires_in: Number(data.expires_in ?? 86400),
  };
}

export async function refreshHandler(req: HaravanRequest, res: Response): Promise<void> {
  const s = req.haravanSession;
  if (!s?.refresh_token) {
    res.status(400).json({ error: 'no_refresh_token' });
    return;
  }
  const tokens = await exchangeRefresh(s.refresh_token);
  if (!tokens) {
    res.status(401).json({ error: 'refresh_failed' });
    return;
  }
  const exp = new Date(Date.now() + tokens.expires_in * 1000);
  try {
    await updateSessionTokens(s.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? s.refresh_token,
      id_token: tokens.id_token ?? s.id_token,
      token_expires_at: exp,
    });
    res.json({ ok: true, expires_at: exp.toISOString() });
  } catch {
    res.status(500).json({ error: 'session_update_failed' });
  }
}
