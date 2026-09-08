// Cloudflare Worker: customer accounts + order history, backed by D1.
//
// NOT DEPLOYED / NOT LIVE. This is staged backend code — see
// ../ACCOUNTS-SETUP.md for the full checklist before this ever goes live
// (create the D1 database, run schema.sql, deploy this Worker, set secrets,
// register the Stripe webhook, then wire account.html's ACCOUNTS_API to the
// deployed URL and link it from the site nav).
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
// (e.g. api.gradedcards01.com) instead.
//
// Orders are populated by a Stripe webhook (checkout.session.completed),
// never entered by hand — one row per card, matched to an account purely by
// email (so an order recorded before someone creates an account still shows
// up once they sign up with the same email).

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
     WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`
  )
    .bind(token)
    .first();
  return row || null;
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
  const userId = result.meta.last_row_id;

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
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  const user = await env.DB.prepare(
    "SELECT id, email, password_hash, password_salt FROM users WHERE email = ?"
  )
    .bind(email)
    .first();

  // Same generic error whether the email doesn't exist or the password is
  // wrong, so a login attempt can't be used to discover which emails have
  // accounts.
  if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
    return jsonResponse({ error: "Incorrect email or password." }, 401);
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
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return jsonResponse({ ok: true });
}

async function handleMe(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonResponse({ error: "Not signed in." }, 401);

  const { results } = await env.DB.prepare(
    `SELECT product_id, product_name, amount, currency, status, stripe_session_id, created_at
     FROM orders WHERE customer_email = ? ORDER BY created_at DESC`
  )
    .bind(user.email)
    .all();

  return jsonResponse({ email: user.email, orders: results || [] });
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
      if (url.pathname === "/api/stripe-webhook" && request.method === "POST")
        return await handleStripeWebhook(request, env);
    } catch (e) {
      return jsonResponse({ error: "Server error" }, 500);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};
