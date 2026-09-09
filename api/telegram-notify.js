export const config = { runtime: 'edge' };

import { rateLimit } from './_ratelimit.js';

// Only these events are accepted — the frontend can never inject
// arbitrary free-text into the outgoing Telegram message.
const EVENT_LABELS = {
  register: '🆕 New Registration',
  login: '🔐 Login',
  verify: '✅ Email Verified',
  reset_request: '🔑 Password Reset Requested',
  logout: '👋 Logout',
};

export default async function handler(req) {
  if (req.method !== 'POST') return json({ success: false }, 405);

  // Soft same-origin check. Not a hard security boundary (a scripted
  // attacker can spoof headers), but combined with the rate limit below
  // it stops the common case: some other site's JS hitting this endpoint
  // through a visitor's browser.
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json({ success: false }, 403);
    } catch {
      return json({ success: false }, 403);
    }
  }
  if (!rateLimit(req, { limit: 15, windowMs: 60_000 })) {
    return json({ success: false }, 429);
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  // Telegram is a side-channel, not a dependency — if it isn't configured
  // yet, quietly no-op instead of erroring. Never let this block auth.
  if (!token || !chatId) return json({ success: true, skipped: true });

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ success: false }, 400);
  }

  const label = EVENT_LABELS[body?.event];
  if (!label) return json({ success: false, error: 'Unknown event' }, 400);

  const username = typeof body.username === 'string' && body.username
    ? sanitize(body.username).slice(0, 40)
    : '—';
  const time = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const text = `🔔 NexaKit Pro\n\nEvent: ${label}\nUsername: ${username}\nTime: ${time}`;

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      console.error('Telegram notify failed:', r.status, await r.text().catch(() => ''));
    }
  } catch (e) {
    console.error('Telegram notify error:', e);
  }

  // Always resolve success to the caller — delivery failures are logged
  // server-side only, they never surface as an app-facing error.
  return json({ success: true });
}

function sanitize(s) { return String(s).replace(/[\r\n]/g, ' ').replace(/[^\w .@-]/g, ''); }

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
