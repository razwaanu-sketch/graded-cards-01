PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

-- 1) Supplemental profile info for users (keeps original users table intact)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  email_verified INTEGER DEFAULT 0, -- 0=false, 1=true
  role TEXT DEFAULT 'customer',    -- e.g., 'customer', 'admin'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- 2) Addresses (shipping / billing) linked to users
CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT,            -- "Home", "Work", etc.
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  country TEXT,
  phone TEXT,
  is_default INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- 3) Order items (existing orders table appears to store one line per row;
--    this table supports multi-item orders and richer line detail)
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  sku TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL, -- price in cents
  total_price INTEGER NOT NULL, -- quantity * unit_price (store for historic accuracy)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 4) Order metadata separate from the existing orders table
CREATE TABLE IF NOT EXISTS order_metadata (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE,        -- human-facing order number (e.g., ORD-20260909-0001)
  shipping_address_id INTEGER REFERENCES addresses(id),
  billing_address_id INTEGER REFERENCES addresses(id),
  total_amount INTEGER,            -- full order total in cents
  currency TEXT,
  payment_status TEXT DEFAULT 'paid', -- e.g., 'pending','paid','refunded'
  receipt_url TEXT,                -- link to receipt/pdf if generated
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_order_metadata_order_number ON order_metadata(order_number);

-- 5) Shipments / tracking information (one or more shipments per order)
CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  courier TEXT,                    -- e.g., 'UPS', 'FedEx', 'RoyalMail'
  tracking_number TEXT,
  tracking_url TEXT,
  shipped_at TEXT,
  delivered_at TEXT,
  tracking_status TEXT DEFAULT 'pending', -- 'pending','in_transit','delivered','exception'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);

-- 6) Returns / RMA requests
CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT,
  items_json TEXT,   -- JSON array describing returned items: [{"order_item_id":..., "qty":...}, ...]
  images_json TEXT,  -- JSON array of image URLs (optional)
  status TEXT DEFAULT 'requested', -- 'requested','approved','rejected','received','refunded'
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  refund_amount INTEGER, -- in cents, if partially/full refunded
  admin_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_returns_user ON returns(user_id);
CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);

-- 7) Wishlists (user saves favorite products)
CREATE TABLE IF NOT EXISTS wishlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product ON wishlists(product_id);

-- 8) Back-in-stock subscriptions
CREATE TABLE IF NOT EXISTS back_in_stock_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  email TEXT NOT NULL,
  product_id TEXT NOT NULL,
  notify_sent INTEGER DEFAULT 0,  -- 0=false, 1=true
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  notified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_backinstock_product ON back_in_stock_subscriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_backinstock_user ON back_in_stock_subscriptions(user_id);

-- 9) Email preferences (per user)
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  marketing INTEGER DEFAULT 1,
  order_notifications INTEGER DEFAULT 1,
  shipping_notifications INTEGER DEFAULT 1,
  back_in_stock_notifications INTEGER DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10) Saved carts + cart items (server-side saved carts)
CREATE TABLE IF NOT EXISTS carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  name TEXT,                -- e.g., "Saved for July sale"
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL, -- price in cents at the time added
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_carts_user ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);

-- 11) Refunds (administrative tracking of refunds)
CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- cents
  currency TEXT,
  provider_ref TEXT,       -- provider refund id (stripe/refund id)
  status TEXT DEFAULT 'requested', -- 'requested','processed','failed'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  admin_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);

-- Helpful indices on existing tables
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

COMMIT;
