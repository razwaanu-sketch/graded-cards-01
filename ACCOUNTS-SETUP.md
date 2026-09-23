# Customer accounts — setup reference

This is **live** — deployed, tested, and linked from the site nav. This
doc is kept as a reference for how it's wired up and what to do if you
ever need to redeploy the Worker or database from scratch.

## What this adds

- `account.html` / `account.js` — sign up, log in, email verification,
  forgot/reset password, view order history, and request a return on an
  order
- `accounts-worker/` — a Cloudflare Worker + D1 database backend:
  - Passwords are hashed (PBKDF2-SHA256, 100k iterations, random salt per
    user) — never stored in plain text
  - Sessions are a random token the browser keeps in `localStorage` and
    sends as `Authorization: Bearer <token>` (not a cookie — this avoids
    cross-origin cookie issues between your GitHub Pages site and the
    Worker's own `*.workers.dev` address); only a hash of the token is
    stored in the database, never the raw value
  - Repeated failed logins for the same email get a growing lockout
    (1 min → 15 min → 1 hour) to blunt password guessing
  - **Email verification is required before order history or returns are
    visible.** Orders are matched purely by email address, so without this,
    signing up with someone else's real email would immediately expose
    their order history — verification closes that. A new signup gets a
    verification email (via Resend) and sees a "please verify" banner
    instead of their orders until they click the link.
  - **Forgot/reset password** sends a one-time link (via Resend) that
    expires in 1 hour and can only be used once; resetting a password logs
    out every existing session on that account.
  - Orders are populated automatically by a Stripe webhook when a payment
    completes — you never enter them by hand, and there's nothing to keep
    in sync with `products.js`
  - Each order stores its Stripe receipt URL (shown as a "Receipt" link)
    and payment_intent id; a later refund on that payment (full or partial)
    is picked up by a second webhook event and updates the order's status
    to `refunded` or `partially_refunded` automatically — see step 7
  - Return requests are stored per order, raised by the buyer from their
    account page — see "Reviewing return requests" below for how you see
    and action them (there's no seller-facing admin page yet)

## Setup steps

1. **Create the database.** In the Cloudflare dashboard: Storage &
   Databases → D1 → Create database → name it `gradedcards01-accounts`.
   Copy the **Database ID** it gives you.

2. **Load the schema.** Open the new database → Console (or "Query") tab,
   paste in the contents of `accounts-worker/schema.sql`, and run it. This
   creates the `users`, `sessions`, `orders`, `returns`, `login_attempts`,
   and `email_tokens` tables.

3. **Update `accounts-worker/wrangler.toml`.** Replace
   `REPLACE_WITH_D1_DATABASE_ID` with the Database ID from step 1, commit,
   and push (to this branch is fine for now).

4. **Deploy the Worker**, same pattern as the checkout Worker:
   - Workers & Pages → Create application → Connect GitHub → this repo →
     set the root directory to `accounts-worker`
   - After it deploys, go to Domains and enable the `workers.dev` URL —
     note it down (e.g. `https://gradedcards01-accounts.<you>.workers.dev`)

5. **Set up Resend** (sends verification + password-reset emails):
   - Sign up free at [resend.com](https://resend.com)
   - **Add and verify a sending domain** (Domains → Add Domain — e.g.
     `gradedcards01.com` or a subdomain like `mail.gradedcards01.com`) by
     adding the DNS records it gives you at Namecheap, same idea as the
     earlier HTTPS/DNS work. **Without a verified domain, Resend will only
     deliver to your own signup email — verification/reset links won't
     reach real buyers**, so this step isn't optional.
   - Once verified, create an **API key** (API Keys → Create API Key)
   - Decide a from-address using your verified domain, e.g.
     `no-reply@gradedcards01.com`

6. **Add secrets** under the Worker's Settings → Variables and secrets
   (mark all as type **Secret** except `EMAIL_FROM`, which can be plain
   text since it's not sensitive):
   - `STRIPE_SECRET_KEY` — same value as the checkout Worker
   - `STRIPE_WEBHOOK_SECRET` — you'll get this in step 7
   - `RESEND_API_KEY` — from step 5
   - `EMAIL_FROM` — your verified from-address, e.g. `no-reply@gradedcards01.com`
  - `ADMIN_KEY` — a long random string only you know (see "Private site-visit
    counter" below) — mark as **Secret**

7. **Register the Stripe webhook.** In the
   [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks),
   add an endpoint:
   - URL: `https://<your-accounts-worker-url>/api/stripe-webhook`
   - Events to send: **both** `checkout.session.completed` (creates the
     order) and `charge.refunded` (updates its status on a refund) — if the
     destination already exists with only the first event selected, edit it
     and add the second rather than creating a new destination
   - Stripe will show a **Signing secret** (`whsec_...`) — that's the
     `STRIPE_WEBHOOK_SECRET` from step 6

8. **Wire the frontend.** In `account.js`, set:
   ```js
   const ACCOUNTS_API = "https://<your-accounts-worker-url>";
   ```

9. **Link it from the site.** Add an "Account" link to the `.nav-menu` in
   each HTML page (same pattern as Shop/About/Shipping/Contact), and/or a
   "My account" link near the cart icon.

10. **Commit and push to `main`.** This is the point where it actually goes
    live — everything before this step can be done safely without affecting
    the live site.

## Testing before you announce it

This is the full customer journey to walk through end to end once deployed
— it'll surface any config issue (wrong secret, unverified Resend domain,
webhook not registered) before a real buyer hits it.

- **Sign up** with a real email you control → land on the signed-in view
  with a "please verify your email" banner and no order history yet
- Check that inbox for the verification email (check spam too) → click the
  link → should land back on `account.html` showing "Your email is
  verified" and the (empty) order history section
- Try signing up twice with the same email — should show "An account with
  that email already exists."
- **Log out, log back in** with the same email/password — confirm the
  order history (now empty) still loads correctly
- Try logging in with a wrong password — should show a generic "Incorrect
  email or password" (never reveal whether the email exists)
- Try logging in with a wrong password 5+ times in a row — should start
  returning "Too many failed attempts" instead of continuing to guess
- Tap **"Forgot your password?"** → enter your email → confirm the generic
  "If that email has an account…" message appears regardless of whether
  you typed a real or made-up email → check your inbox for the reset email
  → click it → set a new password → confirm you're prompted to log in
  again (old sessions are invalidated) and the new password works
- Make a real (or Stripe test-mode, if you switch keys temporarily)
  purchase using your verified email, and confirm the order appears in
  your account after a refresh
- On that order, tap **"Request a return,"** submit a reason, confirm it
  shows "Return: requested" afterwards and the button doesn't reappear;
  confirm the row shows up via the D1 console query below
- **Sign up with a second, different email you don't intend to verify** →
  confirm it also sees the "please verify" banner with no orders, even if
  you never click that link — this is the check that the email-ownership
  gap is actually closed

## Migrating an existing database (receipts + refund status)

If your D1 database was created before receipts/refund-status support was
added, `schema.sql`'s `CREATE TABLE IF NOT EXISTS` won't add the new
columns to an already-existing `orders` table. Run this once in the D1
**Console** tab for `gradedcards01-accounts`:

```sql
ALTER TABLE orders ADD COLUMN payment_intent_id TEXT;
ALTER TABLE orders ADD COLUMN receipt_url TEXT;
ALTER TABLE orders ADD COLUMN refunded_amount INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON orders(payment_intent_id);
```

Orders recorded before this migration will simply have no receipt link and
can't have their refund status auto-synced (their `payment_intent_id` is
NULL) — only new orders going forward get both.

## Private site-visit counter

`visits.html` is a real-time traffic dashboard for you only — it isn't
linked from anywhere on the site (no nav/footer link), and its
`<meta name="robots">` tag keeps it out of search engines. Every page
posts an anonymous `{path}` to `/api/track-visit` on load (no cookies, no
PII — see `visits-track.js`); `visits.html` reads them back via
`/api/visit-stats`, which requires a `key` query param matching the
`ADMIN_KEY` secret set in step 6.

**If your D1 database already existed before this feature was added**, run
this once in the D1 Console tab (same place as the migration below) to add
the new table:

```sql
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
```

**To view it:** open `https://www.gradedcards01.com/visits.html` directly
(bookmark it — it's not in any menu), enter your `ADMIN_KEY` value once,
and it's remembered in that browser from then on (stored in
`localStorage`, not sent anywhere except as the `key` param on this one
endpoint). It shows total visits, today, last hour, last 5 minutes, and a
recent-activity list, refreshing every 5 seconds. Tap "Lock" to forget the
key on that device (e.g. before handing it to someone else).

## Order-confirmation and shipping emails

Two emails now go out automatically via Resend (the same one used for
verification/reset emails):

- **Order confirmation** — sent the moment a Stripe `checkout.session.completed`
  webhook is processed, listing the item(s) and total, with a note that a
  tracking email follows once it ships. No setup needed beyond the Resend
  config already in place.
- **"Your order has shipped"** — sent when you mark an order shipped with a
  tracking number (see the order dashboard below), including that tracking
  number and carrier if given.

**If your D1 database already existed before this feature was added**, run
this once in the D1 Console tab to add the new columns:

```sql
ALTER TABLE orders ADD COLUMN tracking_number TEXT;
ALTER TABLE orders ADD COLUMN carrier TEXT;
ALTER TABLE orders ADD COLUMN shipped_at TEXT;
```

### Order dashboard (`orders.html`)

A private page for marking orders shipped, gated by the same `ADMIN_KEY`
secret and `localStorage` key as `visits.html` — if you've already unlocked
one, the other opens straight to its dashboard on the same device. Open
`https://www.gradedcards01.com/orders.html` directly (it isn't linked from
the site). It lists the 100 most recent orders; for any order that isn't
shipped or refunded yet, enter a tracking number (carrier is optional) and
tap **"Mark shipped"** — this saves the tracking info and sends the
shipping email in one step.

The ship form also has a **"Photographed before boxing"** checkbox —
tick it if you took a dispatch photo of that card, which is now stated as
practice on the Shipping & Returns page. It's recorded per order (shown
as "📷 Dispatch photo recorded" or a "⚠ No dispatch photo recorded"
warning in the dashboard) so you have a record to point to if a buyer
ever disputes an item's condition on arrival — it doesn't store the photo
itself, just that one was taken, so keep the actual photos wherever you
already keep them.

**If your D1 database already existed before this feature was added**, run
this once in the D1 Console tab:

```sql
ALTER TABLE orders ADD COLUMN dispatch_photo_taken INTEGER NOT NULL DEFAULT 0;
```

The ship form also takes a **seal number** — the number on the
tamper-evident seal you close each parcel with. It's included in the
shipping email, and the Shipping & Returns page and FAQ tell buyers to
check the seal is intact and its number matches before accepting delivery.
Shipped orders show "🔒 Seal #…" in the dashboard, or a "⚠ No seal number
recorded" warning if it was left blank.

**If your D1 database already existed before this feature was added**, run
this once in the D1 Console tab:

```sql
ALTER TABLE orders ADD COLUMN seal_number TEXT;
```

## Reviewing return requests

There's no admin page for this yet — a buyer's return request just creates
a row in the `returns` table. Check for new ones and action them from the
D1 **Console** tab (Storage & Databases → `gradedcards01-accounts` →
Console):

```sql
-- See open requests
SELECT r.id, r.reason, r.status, r.requested_at, o.product_name, o.customer_email
FROM returns r JOIN orders o ON o.id = r.order_id
WHERE r.status = 'requested'
ORDER BY r.requested_at DESC;

-- Approve or reject one (id from the query above)
UPDATE returns SET status = 'approved', updated_at = datetime('now') WHERE id = ?;
```

Now that Resend is wired in for verification/reset emails, worth adding
next: a notification to you when a new return comes in, and a status
update email to the buyer when you approve/reject one — both are small
additions to `handleCreateReturn` and the D1 update query above, using the
same `sendEmail` helper already in `worker.js`.

## Known limitations (fine for a shop this size, worth knowing)

- Session tokens don't auto-refresh; they simply expire after 30 days and
  the user has to log in again
- No seller-facing admin page for returns (see "Reviewing return requests"
  above) — reasonable for the current volume, worth building once there's
  enough return traffic to make the D1 console tedious
- No notification email to you when a return is requested, or to the buyer
  when its status changes — see the note just above
- The shipping email is sent manually from `orders.html` once you dispatch
  an order — there's no courier API integration, so nothing sends it for
  you automatically
- Password reset links are single-use and expire in 1 hour; verification
  links expire in 24 hours (resend from the account page if it lapses)
