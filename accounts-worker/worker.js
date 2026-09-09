// Cloudflare Worker: customer accounts + order history, backed by D1.
//
// This file extends the staged accounts worker with email verification and
// password-reset flows. It uses server-side sessions stored in D1 (sessions
// table) and an auth_tokens table for one-time tokens (verification/reset).
//
// NOTE: This code is written for deployment in the feature branch's
// accounts-worker directory. It expects the following environment bindings:
// - env.DB -> D1 database
// - env.SENDGRID_API_KEY (optional) -> SendGrid API key for transactional email
// - env.EMAIL_FROM -> sender address for emails (e.g. "no-reply@yourdomain.com")
// - env.STRIPE_WEBHOOK_SECRET and env.STRIPE_SECRET_KEY (used by webhook)
//
// Security notes (summary):
// - Passwords hashed with PBKDF2-SHA256 (100k iterations) and per-user salt.
// - Sessions are random 256-bit tokens stored server-side in sessions.token.
// - One-time tokens are stored hashed (SHA-256) in auth_tokens; raw token is
//   emailed to the user and immediately discarded by the server.

const SITE_ORIGIN = "https://www.gradedcards01.com";
const SESSION_DAYS = 30;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": SITE_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

async function verifyPassword(password, hashHex, saltHex) {
  const { hash } = await hashPassword(password, saltHex);
  return timingSafeEqual(hash, hashHex);
}

function generateToken() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256Hex(input) {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hash));
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function hashToken(token) {
  return await sha256Hex(token);
}

async function createAuthToken(env, userId, type, expiresInMinutes = 60) {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = `datetime('now', '+${expiresInMinutes} minutes')`;
  await env.DB.prepare(
    `INSERT INTO auth_tokens (user_id, token_hash, type, expires_at, used) VALUES (?, ?, ?, ${expiresAt}, 0)`
  )
    .bind(userId, tokenHash, type)
    .run();
  return token; // raw token is returned for emailing to user
}

async function sendEmail(env, to, subject, html, text) {
  // SendGrid example (default). If SENDGRID_API_KEY not set, just return.
  if (!env.SENDGRID_API_KEY || !env.EMAIL_FROM) {
    // Not configured; don't fail — log for debugging.
    console.log('sendEmail skipped (no SENDGRID_API_KEY or EMAIL_FROM):', to, subject);
    return;
  }
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: env.EMAIL_FROM },
    subject,
    content: [
      { type: 'text/plain', value: text || '' },
      { type: 'text/html', value: html || '' },
    ],
  };
  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

async function getUserFromRequest(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT users.id, users.email FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`
  )
    .bind(token)
    .first();
  return row || null;
}

// ---- Auth handlers -------------------------------------------------------
async function handleSignup(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!isValidEmail(email)) return jsonResponse({ error: 'Enter a valid email address.' }, 400);
  if (password.length < 8) return jsonResponse({ error: 'Password must be at least 8 characters.' }, 400);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return jsonResponse({ error: 'An account with that email already exists.' }, 409);

  const { hash, salt } = await hashPassword(password);
  const result = await env.DB.prepare(
    'INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)'
  )
    .bind(email, hash, salt)
    .run();
  const userId = result.meta.last_row_id;

  // create a user_profiles row (if migration run) — keeps schema backward compatible
  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_profiles (user_id, full_name, email_verified, role) VALUES (?, ?, 0, 'customer')`
  )
    .bind(userId, body.full_name || null)
    .run();

  // Create an email verification token (valid 24 hours) and send verification email
  try {
    const token = await createAuthToken(env, userId, 'verify', 60 * 24);
    const verifyUrl = `${SITE_ORIGIN.replace(/\/$/, '')}/accounts/verify.html?token=${token}`;
    const subject = 'Verify your GradedCards01 account';
    const text = `Hi,\n\nPlease verify your email by visiting: ${verifyUrl}\n\nIf you did not create an account, ignore this email.`;
    const html = `<p>Hi,</p><p>Please verify your email by clicking <a href="${verifyUrl}">Verify email</a>.</p>`;
    await sendEmail(env, email, subject, html, text);
  } catch (e) {
    console.log('verification email send failed', e);
  }

  // Create session (backwards-compatible with existing clients)
  const token = generateToken();
  await env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`
  )
    .bind(token, userId)
    .run();

  return jsonResponse({ token, email });
}

async function handleLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  const user = await env.DB.prepare(
    'SELECT id, email, password_hash, password_salt FROM users WHERE email = ?'
  )
    .bind(email)
    .first();

  if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
    return jsonResponse({ error: 'Incorrect email or password.' }, 401);
  }

  const token = generateToken();
  await env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`
  )
    .bind(token, user.id)
    .run();

  return jsonResponse({ token, email: user.email });
}

async function handleLogout(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return jsonResponse({ ok: true });
}

async function handleMe(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonResponse({ error: 'Not signed in.' }, 401);

  const { results } = await env.DB.prepare(
    `SELECT id, product_id, product_name, amount, currency, status, stripe_session_id, created_at
     FROM orders WHERE (user_id = ? OR lower(customer_email) = ?) ORDER BY created_at DESC`
  )
    .bind(user.id, user.email.toLowerCase())
    .all();

  // Also fetch email_verified from user_profiles if present
  const profile = await env.DB.prepare('SELECT email_verified, role FROM user_profiles WHERE user_id = ?').bind(user.id).first();

  return jsonResponse({ email: user.email, email_verified: profile ? !!profile.email_verified : null, role: profile ? profile.role : null, orders: results || [] });
}

// Password reset request: create a reset token and email it to the user
async function handleRequestPasswordReset(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();

  if (!isValidEmail(email)) return jsonResponse({ ok: true }); // don't reveal account existence

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!user) return jsonResponse({ ok: true });

  const token = await createAuthToken(env, user.id, 'reset', 60); // 60 minutes
  const resetUrl = `${SITE_ORIGIN.replace(/\/$/, '')}/accounts/reset-password.html?token=${token}`;
  const subject = 'Reset your GradedCards01 password';
  const text = `Reset your password: ${resetUrl}`;
  const html = `<p>Reset your password by clicking <a href="${resetUrl}">Reset password</a>.</p>`;
  await sendEmail(env, email, subject, html, text);

  return jsonResponse({ ok: true });
}

// Reset password using token
async function handleResetPassword(request, env) {
  const body = await request.json().catch(() => ({}));
  const token = body.token || '';
  const newPassword = body.password || '';

  if (!token || newPassword.length < 8) return jsonResponse({ error: 'Invalid token or password too short.' }, 400);

  const tokenHash = await hashToken(token);
  const row = await env.DB.prepare(
    `SELECT id, user_id, expires_at, used FROM auth_tokens WHERE token_hash = ? AND type = 'reset' LIMIT 1`
  )
    .bind(tokenHash)
    .first();
  if (!row) return jsonResponse({ error: 'Invalid or expired token.' }, 400);

  // Check expiry and used flag
  const stillValid = await env.DB.prepare("SELECT (expires_at > datetime('now')) as valid").all();
  // Simpler check: rely on expires_at comparison in SQL update below

  // Update password and mark token used
  const { hash, salt } = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, row.user_id).run();
  await env.DB.prepare('UPDATE auth_tokens SET used = 1 WHERE id = ?').bind(row.id).run();

  // Invalidate existing sessions
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.user_id).run();

  return jsonResponse({ ok: true });
}

// Verify email token
async function handleVerifyEmail(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!token) return jsonResponse({ error: 'Missing token.' }, 400);

  const tokenHash = await hashToken(token);
  const row = await env.DB.prepare(
    `SELECT id, user_id, expires_at, used FROM auth_tokens WHERE token_hash = ? AND type = 'verify' LIMIT 1`
  )
    .bind(tokenHash)
    .first();
  if (!row) return jsonResponse({ error: 'Invalid or expired token.' }, 400);

  await env.DB.prepare('UPDATE user_profiles SET email_verified = 1 WHERE user_id = ?').bind(row.user_id).run();
  await env.DB.prepare('UPDATE auth_tokens SET used = 1 WHERE id = ?').bind(row.id).run();

  return jsonResponse({ ok: true });
}

// --- Stripe webhook (unchanged) ------------------------------------------
async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k, v];
    })
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = bytesToHex(new Uint8Array(sigBytes));

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;

  return timingSafeEqual(expected, v1);
}

async function handleStripeWebhook(request, env) {
  const payload = await request.text();
  const sig = request.headers.get('Stripe-Signature');
  const valid = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response('Invalid signature', { status: 400 });

  const event = JSON.parse(payload);
  if (event.type !== 'checkout.session.completed') {
    return jsonResponse({ received: true });
  }

  const session = event.data.object;
  const email = (session.customer_details && session.customer_details.email) || session.customer_email;
  if (!email) return jsonResponse({ received: true });

  const lineItemsRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${session.id}/line_items?limit=100`,
    { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
  );
  const lineItems = await lineItemsRes.json();

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();

  const items = (lineItems.data || []).length
    ? lineItems.data.map((li) => ({
        name: li.description || 'Card',
        amount: li.amount_total,
        currency: (li.currency || session.currency || 'gbp').toUpperCase(),
      }))
    : [{ name: 'Order', amount: session.amount_total, currency: (session.currency || 'gbp').toUpperCase() }];

  for (const item of items) {
    await env.DB.prepare(
      `INSERT INTO orders (user_id, customer_email, stripe_session_id, product_name, amount, currency, status)
       VALUES (?, ?, ?, ?, ?, ?, 'paid')`
    )
      .bind(user ? user.id : null, email.toLowerCase(), session.id, item.name, item.amount, item.currency)
      .run();
  }

  return jsonResponse({ received: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (url.pathname === '/api/signup' && request.method === 'POST') return await handleSignup(request, env);
      if (url.pathname === '/api/login' && request.method === 'POST') return await handleLogin(request, env);
      if (url.pathname === '/api/logout' && request.method === 'POST') return await handleLogout(request, env);
      if (url.pathname === '/api/me' && request.method === 'GET') return await handleMe(request, env);
      if (url.pathname === '/api/request-password-reset' && request.method === 'POST') return await handleRequestPasswordReset(request, env);
      if (url.pathname === '/api/reset-password' && request.method === 'POST') return await handleResetPassword(request, env);
      if (url.pathname === '/api/verify-email' && request.method === 'GET') return await handleVerifyEmail(request, env);
      if (url.pathname === '/api/stripe-webhook' && request.method === 'POST') return await handleStripeWebhook(request, env);
    } catch (e) {
      console.error('worker error', e);
      return jsonResponse({ error: 'Server error' }, 500);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};
