// Cloudflare Worker: customer accounts, order history, and return requests,
// backed by D1. Deployed as its own Cloudflare Workers Builds project with
// its root directory set to this folder (accounts-worker/), independent of
// the checkout Worker's own project — see ../ACCOUNTS-SETUP.md.
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
// up once they sign up with the same email). Each order also stores its
// Stripe receipt_url and payment_intent_id; a later charge.refunded event
// on that payment_intent updates every order row from the same charge to
// 'refunded' or 'partially_refunded'. Both event types must be selected on
// the Stripe webhook destination — see ACCOUNTS-SETUP.md.
//
// Return requests (POST /api/returns) are buyer-raised and stored as a
// system of record, but there's no seller-facing admin page yet — see
// ACCOUNTS-SETUP.md for how to review and action them via the D1 console.
//
// Email verification and password reset are sent via Resend (env.RESEND_API_KEY,
// env.EMAIL_FROM). Order history and return requests are withheld until an
// address is verified — otherwise signing up with someone else's real email
// would immediately expose their order history, since orders are matched
// purely by email address.

const SITE_ORIGIN = "https://www.gradedcards01.com";
const SESSION_DAYS = 30;
const VERIFY_TOKEN_HOURS = 24;
const RESET_TOKEN_HOURS = 1;

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
    `SELECT users.id, users.email, users.email_verified FROM sessions
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

// Sends via Resend's REST API. Failures are swallowed by callers (a signup
// or reset request should still succeed even if the email provider is
// briefly down) — see the comment at each call site.
async function sendEmail(env, { to, subject, html, text }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

// Creates a single-use, time-limited token for either email purpose,
// storing only its hash (same reasoning as session tokens). Returns the
// raw token to embed in the emailed link.
async function createEmailToken(env, userId, purpose, hours) {
  const token = generateToken();
  await env.DB.prepare(
    `INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at)
     VALUES (?, ?, ?, datetime('now', '+${hours} hours'))`
  )
    .bind(await hashToken(token), userId, purpose)
    .run();
  return token;
}

async function sendVerificationEmail(env, userId, email) {
  const token = await createEmailToken(env, userId, "verify", VERIFY_TOKEN_HOURS);
  const link = `${SITE_ORIGIN}/account.html?verify=${token}`;
  await sendEmail(env, {
    to: email,
    subject: "Verify your email — Graded Cards 01",
    text: `Verify your email to activate your Graded Cards 01 account: ${link}\n\nThis link expires in ${VERIFY_TOKEN_HOURS} hours.`,
    html: `<p>Verify your email to activate your Graded Cards 01 account:</p><p><a href="${link}">${link}</a></p><p>This link expires in ${VERIFY_TOKEN_HOURS} hours.</p>`,
  });
}

async function sendPasswordResetEmail(env, userId, email) {
  const token = await createEmailToken(env, userId, "reset", RESET_TOKEN_HOURS);
  const link = `${SITE_ORIGIN}/account.html?reset=${token}`;
  await sendEmail(env, {
    to: email,
    subject: "Reset your password — Graded Cards 01",
    text: `Reset your Graded Cards 01 password: ${link}\n\nThis link expires in ${RESET_TOKEN_HOURS} hour and can only be used once. If you didn't request this, you can ignore this email.`,
    html: `<p>Reset your Graded Cards 01 password:</p><p><a href="${link}">${link}</a></p><p>This link expires in ${RESET_TOKEN_HOURS} hour and can only be used once. If you didn't request this, you can ignore this email.</p>`,
  });
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

  const token = await createSession(env, userId);

  // A signup should succeed even if the email provider hiccups — the
  // account still works, and "Resend verification email" covers the retry.
  try {
    await sendVerificationEmail(env, userId, email);
  } catch (e) {
    // swallow — verification email is a courtesy, not a signup requirement
  }

  return jsonResponse({ token, email, email_verified: false });
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

  const emailVerified = !!user.email_verified;

  // Order history and returns are only ever matched by email — without
  // requiring proof of ownership first, anyone could sign up with someone
  // else's email and immediately see (and file returns against) their real
  // orders. Withholding both until the address is verified closes that.
  if (!emailVerified) {
    return jsonResponse({ email: user.email, email_verified: false, orders: [] });
  }

  const { results } = await env.DB.prepare(
    `SELECT o.id AS order_id, o.product_id, o.product_name, o.amount, o.currency, o.status,
            o.stripe_session_id, o.receipt_url, o.refunded_amount, o.created_at,
            r.status AS return_status, r.reason AS return_reason, r.requested_at AS return_requested_at
     FROM orders o
     LEFT JOIN returns r ON r.order_id = o.id
     WHERE o.customer_email = ?
     ORDER BY o.created_at DESC`
  )
    .bind(user.email)
    .all();

  return jsonResponse({ email: user.email, email_verified: true, orders: results || [] });
}

async function handleVerifyEmail(request, env) {
  const body = await request.json().catch(() => ({}));
  const token = body.token || "";
  if (!token) return jsonResponse({ error: "Missing verification token." }, 400);

  const row = await env.DB.prepare(
    "SELECT user_id FROM email_tokens WHERE token_hash = ? AND purpose = 'verify' AND expires_at > datetime('now')"
  )
    .bind(await hashToken(token))
    .first();
  if (!row) return jsonResponse({ error: "This verification link is invalid or has expired." }, 400);

  await env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(row.user_id).run();
  await env.DB.prepare("DELETE FROM email_tokens WHERE user_id = ? AND purpose = 'verify'").bind(row.user_id).run();

  return jsonResponse({ ok: true });
}

async function handleResendVerification(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonResponse({ error: "Not signed in." }, 401);
  if (user.email_verified) return jsonResponse({ error: "Your email is already verified." }, 400);

  await env.DB.prepare("DELETE FROM email_tokens WHERE user_id = ? AND purpose = 'verify'").bind(user.id).run();
  try {
    await sendVerificationEmail(env, user.id, user.email);
  } catch (e) {
    return jsonResponse({ error: "Could not send email right now — please try again shortly." }, 502);
  }
  return jsonResponse({ ok: true });
}

async function handleRequestPasswordReset(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();

  // Always the same response whether or not the email has an account, so
  // this endpoint can't be used to discover registered addresses.
  const genericResponse = jsonResponse({
    ok: true,
    message: "If that email has an account, we've sent a password reset link.",
  });

  if (!isValidEmail(email)) return genericResponse;
  const user = await env.DB.prepare("SELECT id, email FROM users WHERE email = ?").bind(email).first();
  if (!user) return genericResponse;

  try {
    await sendPasswordResetEmail(env, user.id, user.email);
  } catch (e) {
    // Still return the generic success response — don't leak provider
    // failures to the client, and don't reveal account existence either.
  }
  return genericResponse;
}

async function handleResetPassword(request, env) {
  const body = await request.json().catch(() => ({}));
  const token = body.token || "";
  const password = body.password || "";
  if (!token) return jsonResponse({ error: "Missing reset token." }, 400);
  if (password.length < 8) return jsonResponse({ error: "Password must be at least 8 characters." }, 400);

  const row = await env.DB.prepare(
    "SELECT user_id FROM email_tokens WHERE token_hash = ? AND purpose = 'reset' AND expires_at > datetime('now')"
  )
    .bind(await hashToken(token))
    .first();
  if (!row) return jsonResponse({ error: "This reset link is invalid or has expired." }, 400);

  const { hash, salt } = await hashPassword(password);
  await env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?")
    .bind(hash, salt, row.user_id)
    .run();

  // Force re-login everywhere — a password reset should invalidate any
  // session that might exist on a device the account owner no longer trusts.
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(row.user_id).run();
  await env.DB.prepare("DELETE FROM email_tokens WHERE user_id = ? AND purpose = 'reset'").bind(row.user_id).run();

  return jsonResponse({ ok: true });
}

async function handleCreateReturn(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) return jsonResponse({ error: "Not signed in." }, 401);
  if (!user.email_verified) return jsonResponse({ error: "Please verify your email before requesting a return." }, 403);

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

async function handleCheckoutCompleted(session, env) {
  const email = (session.customer_details && session.customer_details.email) || session.customer_email;
  if (!email) return;

  // Stripe redelivers this event on any timeout or non-2xx response, so
  // guard against inserting the same session's orders twice.
  const alreadyProcessed = await env.DB.prepare("SELECT id FROM orders WHERE stripe_session_id = ? LIMIT 1")
    .bind(session.id)
    .first();
  if (alreadyProcessed) return;

  // Stripe's webhook payload for a Checkout Session doesn't include line
  // items or charge details by default; re-fetch with both expanded in one
  // call — line items so each card sold becomes its own order row (a
  // combined checkout can contain several), and the charge for its
  // receipt_url and payment_intent id (needed later to match refunds back
  // to the right order rows).
  const sessionRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${session.id}?expand[]=line_items&expand[]=payment_intent.latest_charge`,
    { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
  );
  const sessionResText = await sessionRes.text();
  if (!sessionRes.ok) {
    console.error(`Stripe session expand fetch failed (${sessionRes.status}): ${sessionResText}`);
  }
  let fullSession = {};
  try {
    fullSession = JSON.parse(sessionResText);
  } catch (e) {
    console.error(`Stripe session expand response wasn't valid JSON: ${sessionResText}`);
  }

  const paymentIntent = fullSession.payment_intent;
  const paymentIntentId = paymentIntent ? paymentIntent.id : null;
  const receiptUrl = paymentIntent && paymentIntent.latest_charge ? paymentIntent.latest_charge.receipt_url : null;

  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email.toLowerCase()).first();

  const lineItems = (fullSession.line_items && fullSession.line_items.data) || [];
  const items = lineItems.length
    ? lineItems.map((li) => ({
        name: li.description || "Card",
        amount: li.amount_total,
        currency: (li.currency || session.currency || "gbp").toUpperCase(),
      }))
    : [{ name: "Order", amount: session.amount_total, currency: (session.currency || "gbp").toUpperCase() }];

  for (const item of items) {
    await env.DB.prepare(
      `INSERT INTO orders (user_id, customer_email, stripe_session_id, payment_intent_id, receipt_url, product_name, amount, currency, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid')`
    )
      .bind(
        user ? user.id : null,
        email.toLowerCase(),
        session.id,
        paymentIntentId,
        receiptUrl,
        item.name,
        item.amount,
        item.currency
      )
      .run();
  }
}

// A refund (full or partial) updates every order row that came from the
// same charge — a combined checkout's line items share one payment_intent,
// so a single refund event applies to all of them alike. There's no
// per-line-item refund data from Stripe to split it further.
async function handleChargeRefunded(charge, env) {
  const paymentIntentId = charge.payment_intent;
  if (!paymentIntentId) return;

  const status = charge.amount_refunded >= charge.amount ? "refunded" : "partially_refunded";
  await env.DB.prepare("UPDATE orders SET status = ?, refunded_amount = ? WHERE payment_intent_id = ?")
    .bind(status, charge.amount_refunded, paymentIntentId)
    .run();
}

async function handleStripeWebhook(request, env) {
  const payload = await request.text();
  const sig = request.headers.get("Stripe-Signature");
  const valid = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  const event = JSON.parse(payload);
  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(event.data.object, env);
  } else if (event.type === "charge.refunded") {
    await handleChargeRefunded(event.data.object, env);
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
      if (url.pathname === "/api/verify-email" && request.method === "POST") return await handleVerifyEmail(request, env);
      if (url.pathname === "/api/resend-verification" && request.method === "POST")
        return await handleResendVerification(request, env);
      if (url.pathname === "/api/request-password-reset" && request.method === "POST")
        return await handleRequestPasswordReset(request, env);
      if (url.pathname === "/api/reset-password" && request.method === "POST")
        return await handleResetPassword(request, env);
      if (url.pathname === "/api/stripe-webhook" && request.method === "POST")
        return await handleStripeWebhook(request, env);
    } catch (e) {
      return jsonResponse({ error: "Server error" }, 500);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};
