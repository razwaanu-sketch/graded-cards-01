// Cloudflare Worker: customer accounts, order history, and return requests,
// backed by D1. See ../ACCOUNTS-SETUP.md for the deploy checklist.
//
// Auth model: email + password, PBKDF2-SHA256 hashed (100k iterations) with
// a random salt per user — no plaintext or reversible storage. Sessions are
// a random 256-bit token returned in the JSON response body and kept by the
// client as a Bearer token (in localStorage), not a cookie — this avoids
// all cross-origin cookie/SameSite complications between the static site's
// origin and this Worker's own *.workers.dev origin. Trade-off: a token in
// localStorage is readable by any JS that runs on the page (XSS), same as
// most SPA token-auth setups; there's no server-rendered/user-generated
// content on this site to make that a live risk today, but if that ever
// changes, move to httpOnly cookies scoped to a shared custom domain
// (e.g. api.gradedcards01.com) instead. Only a SHA-256 hash of the token is
// stored in D1, never the raw value, so a copy of the database alone can't
// be used to impersonate an active session.
//
// Failed logins are rate-limited per email with a growing lockout window
// (see lockoutMinutesFor) to blunt password guessing.
//
// Orders are populated by a Stripe webhook (checkout.session.completed),
// never entered by hand — one row per card, matched to an account purely by
// email (so an order recorded before someone creates an account still shows
// up once they sign up with the same email).
//
// Return requests (POST /api/returns) are buyer-raised and stored as a
// system of record, but there's no seller-facing admin page yet — see
// ACCOUNTS-SETUP.md for how to review and action them via the D1 console.

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

async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

// Lockout grows with repeated failures rather than a flat count, so a
// single mistyped password never locks anyone out, but sustained guessing
// gets slower and slower.
function lockoutMinutesFor(failedCount) {
  if (failedCount < 5) return 0;
  if (failedCount < 8) return 1;
  if (failedCount < 12) return 15;
  return 60;
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getUserFromRequest(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT users.id, users.email FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now')`
  )
    .bind(await hashToken(token))
    .first();
  return row || null;
}

async function createSession(env, userId) {
  const token = generateToken();
  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`
  )
    .bind(await hashToken(token), userId)
    .run();
  return token;
}

async function handleSignup(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!isValidEmail(email)) return jsonResponse({ error: "Enter a valid email address." }, 400);
  if (password.length < 8) return jsonResponse({ error: "Password must be at least 8 characters." }, 400);

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return jsonResponse({ error: "An account with that email already exists." }, 409);

  const { hash, salt } = await hashPassword(password);
  const result = await env.DB.prepare(
    "INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)"
  )
    .bind(email, hash, salt)
    .run();

  const token = await createSession(env, result.meta.last_row_id);
  return jsonResponse({ token, email });
}

async function handleLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  const attempt = await env.DB.prepare(
    "SELECT failed_count, locked_until FROM login_attempts WHERE email = ?"
  )
    .bind(email)
    .first();
  if (attempt && attempt.locked_until) {
    const stillLocked = await env.DB.prepare("SELECT datetime('now') < ? AS locked").bind(attempt.locked_until).first();
    if (stillLocked && stillLocked.locked) {
      return jsonResponse({ error: "Too many failed attempts — please try again in a few minutes." }, 429);
    }
  }

  const user = await env.DB.prepare(
    "SELECT id, email, password_hash, password_salt FROM users WHERE email = ?"
  )
    .bind(email)
    .first();

  // Same generic error whether the email doesn't exist or the password is
  // wrong, so a login attempt can't be used to discover which emails have
  // accounts.
  if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
    const failedCount = (attempt ? attempt.failed_count : 0) + 1;
    const lockoutMinutes = lockoutMinutesFor(failedCount);
    await env.DB.prepare(
      `INSERT INTO login_attempts (email, failed_count, locked_until) VALUES (?, ?, ${
        lockoutMinutes ? `datetime('now', '+${lockoutMinutes} minutes')` : "NULL"
      })
       ON CONFLICT(email) DO UPDATE SET failed_count = excluded.failed_count, locked_until = excluded.locked_until`
    )
      .bind(email, failedCount)
      .run();
    return jsonResponse({ error: "Incorrect email or password." }, 401);
  }

  await env.DB.prepare("DELETE FROM login_attempts WHERE email = ?").bind(email).run();
  const token = await createSession(env, user.id);
  return jsonResponse({ token, email: user.email });
}

async function handleLogout(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
  return jsonResponse({ ok: true });
}

async function handleMe(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonResponse({ error: "Not signed in." }, 401);

  const { results } = await env.DB.prepare(
    `SELECT o.id AS order_id, o.product_id, o.product_name, o.amount, o.currency, o.status,
            o.stripe_session_id, o.created_at,
            r.status AS return_status, r.reason AS return_reason, r.requested_at AS return_requested_at
     FROM orders o
     LEFT JOIN returns r ON r.order_id = o.id
     WHERE o.customer_email = ?
     ORDER BY o.created_at DESC`
  )
    .bind(user.email)
    .all();

  return jsonResponse({ email: user.email, orders: results || [] });
}

async function handleCreateReturn(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonResponse({ error: "Not signed in." }, 401);

  const body = await request.json().catch(() => ({}));
  const orderId = Number(body.order_id);
  const reason = (body.reason || "").trim();
  if (!orderId) return jsonResponse({ error: "Missing order." }, 400);
  if (!reason) return jsonResponse({ error: "Please describe the reason for your return." }, 400);
  if (reason.length > 1000) return jsonResponse({ error: "Reason is too long." }, 400);

  // Ownership check: the order must actually belong to this signed-in user's
  // email — otherwise anyone could raise a return against any order id.
  const order = await env.DB.prepare("SELECT id FROM orders WHERE id = ? AND customer_email = ?")
    .bind(orderId, user.email)
    .first();
  if (!order) return jsonResponse({ error: "Order not found." }, 404);

  const existing = await env.DB.prepare("SELECT id FROM returns WHERE order_id = ?").bind(orderId).first();
  if (existing) return jsonResponse({ error: "A return has already been requested for this order." }, 409);

  await env.DB.prepare("INSERT INTO returns (order_id, user_id, reason, status) VALUES (?, ?, ?, 'requested')")
    .bind(orderId, user.id, reason)
    .run();

  return jsonResponse({ ok: true });
}

// --- Stripe webhook -------------------------------------------------------
// Verifies the request really came from Stripe (HMAC-SHA256 over the raw
// body using the endpoint's signing secret) before touching the database.
// See: https://stripe.com/docs/webhooks/signatures

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    })
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = bytesToHex(new Uint8Array(sigBytes));

  // Reject signatures older than 5 minutes to limit replay of a captured request.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;

  return timingSafeEqual(expected, v1);
}

async function handleStripeWebhook(request, env) {
  const payload = await request.text();
  const sig = request.headers.get("Stripe-Signature");
  const valid = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  const event = JSON.parse(payload);
  if (event.type !== "checkout.session.completed") {
    return jsonResponse({ received: true });
  }

  const session = event.data.object;
  const email = (session.customer_details && session.customer_details.email) || session.customer_email;
  if (!email) return jsonResponse({ received: true });

  // Stripe's webhook payload for a Checkout Session doesn't include full
  // line items by default; fetch them with an expand so each card sold
  // becomes its own order row (a combined checkout can contain several).
  const lineItemsRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${session.id}/line_items?limit=100`,
    { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
  );
  const lineItems = await lineItemsRes.json();

  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email.toLowerCase()).first();

  const items = (lineItems.data || []).length
    ? lineItems.data.map((li) => ({
        name: li.description || "Card",
        amount: li.amount_total,
        currency: (li.currency || session.currency || "gbp").toUpperCase(),
      }))
    : [{ name: "Order", amount: session.amount_total, currency: (session.currency || "gbp").toUpperCase() }];

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

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/api/signup" && request.method === "POST") return await handleSignup(request, env);
      if (url.pathname === "/api/login" && request.method === "POST") return await handleLogin(request, env);
      if (url.pathname === "/api/logout" && request.method === "POST") return await handleLogout(request, env);
      if (url.pathname === "/api/me" && request.method === "GET") return await handleMe(request, env);
      if (url.pathname === "/api/returns" && request.method === "POST") return await handleCreateReturn(request, env);
      if (url.pathname === "/api/stripe-webhook" && request.method === "POST")
        return await handleStripeWebhook(request, env);
    } catch (e) {
      return jsonResponse({ error: "Server error" }, 500);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};
