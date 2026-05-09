const WEBHOOK_SUBSCRIBE_URL = 'https://webhook.haravan.com/api/subscribe';

export async function subscribeWebhook(accessToken: string): Promise<boolean> {
  const res = await fetch(WEBHOOK_SUBSCRIBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({}),
  });
  let data: { error?: boolean } = {};
  try {
    data = (await res.json()) as { error?: boolean };
  } catch {
    data = {};
  }
  return res.ok && data.error === false;
}

export async function unsubscribeWebhook(accessToken: string): Promise<boolean> {
  const res = await fetch(WEBHOOK_SUBSCRIBE_URL, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok;
}
