-- D1 schema for customer accounts + order history.
-- Apply with: npx wrangler d1 execute gradedcards01-accounts --file=schema.sql
-- (see ../ACCOUNTS-SETUP.md for full setup steps)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Stores a SHA-256 hash of the session token, never the raw value — if this
-- database were ever exposed, a copy of it alone wouldn't let anyone log in
-- as an existing session. The raw token only ever exists in the response
-- body sent to the client at login/signup time.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Basic brute-force protection: tracks consecutive failed logins per email
-- and a lockout window that grows with repeated failures. Cleared on a
-- successful login.
CREATE TABLE IF NOT EXISTS login_attempts (
  email TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);

-- One row per card sold. A completed Stripe Checkout Session (combined
-- checkout or a single-card Payment Link) can contain more than one card,
-- so orders are linked to a session id but store their own line item.
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  customer_email TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- One return request per order, raised by the buyer from their account
-- page. There's no seller-facing admin page yet (out of scope for now) —
-- see ACCOUNTS-SETUP.md for how to review and update these via the D1
-- console until/unless that's built.
CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  user_id INTEGER REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested', -- requested | approved | rejected | completed
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
