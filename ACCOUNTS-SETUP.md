# Customer accounts — go-live checklist

Everything below is written and committed but **not deployed and not linked
from the site**. `account.html` currently just shows "Accounts aren't
switched on yet" to any visitor who finds it directly. Follow these steps
when you're ready to turn it on.

## What this adds

- `account.html` / `account.js` — sign up, log in, view order history, and
  request a return on an order
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
  - Orders are populated automatically by a Stripe webhook when a payment
    completes — you never enter them by hand, and there's nothing to keep
    in sync with `products.js`
  - Return requests are stored per order, raised by the buyer from their
    account page — see "Reviewing return requests" below for how you see
    and action them (there's no seller-facing admin page yet)

## Setup steps

1. **Create the database.** In the Cloudflare dashboard: Storage &
   Databases → D1 → Create database → name it `gradedcards01-accounts`.
   Copy the **Database ID** it gives you.

2. **Load the schema.** Open the new database → Console (or "Query") tab,
   paste in the contents of `accounts-worker/schema.sql`, and run it. This
   creates the `users`, `sessions`, `orders`, `returns`, and
   `login_attempts` tables.

3. **Update `accounts-worker/wrangler.toml`.** Replace
   `REPLACE_WITH_D1_DATABASE_ID` with the Database ID from step 1, commit,
   and push (to this branch is fine for now).

4. **Deploy the Worker**, same pattern as the checkout Worker:
   - Workers & Pages → Create application → Connect GitHub → this repo →
     set the root directory to `accounts-worker`
   - After it deploys, go to Domains and enable the `workers.dev` URL —
     note it down (e.g. `https://gradedcards01-accounts.<you>.workers.dev`)

5. **Add secrets** under Settings → Variables and secrets (mark both as
   type **Secret**):
   - `STRIPE_SECRET_KEY` — same value as the checkout Worker
   - `STRIPE_WEBHOOK_SECRET` — you'll get this in step 6

6. **Register the Stripe webhook.** In the
   [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks),
   add an endpoint:
   - URL: `https://<your-accounts-worker-url>/api/stripe-webhook`
   - Event to send: `checkout.session.completed`
   - Stripe will show a **Signing secret** (`whsec_...`) — that's the
     `STRIPE_WEBHOOK_SECRET` from step 5

7. **Wire the frontend.** In `account.js`, set:
   ```js
   const ACCOUNTS_API = "https://<your-accounts-worker-url>";
   ```

8. **Link it from the site.** Add an "Account" link to the `.nav-menu` in
   each HTML page (same pattern as Shop/About/Shipping/Contact), and/or a
   "My account" link near the cart icon.

9. **Commit and push to `main`.** This is the point where it actually goes
   live — everything before this step can be done safely without affecting
   the live site.

## Testing before you announce it

- Sign up with a real email you control, confirm you land on the
  signed-in view with an empty order list
- Make a real (or Stripe test-mode, if you switch keys temporarily) purchase
  using that same email, and confirm the order appears after a refresh
- Try signing up twice with the same email — should show "An account with
  that email already exists."
- Try logging in with a wrong password — should show a generic "Incorrect
  email or password" (never reveal whether the email exists)
- Try logging in with a wrong password 5+ times in a row — should start
  returning "Too many failed attempts" instead of continuing to guess
- On a real order, tap "Request a return," submit a reason, confirm it
  shows "Return: requested" afterwards and the button doesn't reappear;
  confirm the row shows up via the D1 console query above

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

Once you're checking this regularly, worth adding: an email notification to
you when a new return comes in, and a status update email to the buyer —
both need a transactional email provider (see below), so they're grouped
with that decision rather than built blind.

## Known limitations (fine for a shop this size, worth knowing)

- No "forgot password" flow yet, and no email notification when a return
  request comes in or changes status — both need a transactional email
  provider (e.g. SendGrid, Mailgun, Postmark) wired into the Worker, which
  is a new external service account + API key, so it's a deliberate next
  step rather than something built without checking first. Say the word
  and we can set one up the same way we did Stripe/GA4.
- No email verification on signup — someone could sign up with an email
  they don't own; low-stakes here since accounts only ever *display* order
  history and raise return requests, they don't grant any purchasing power
- Session tokens don't auto-refresh; they simply expire after 30 days and
  the user has to log in again
- No seller-facing admin page for returns (see "Reviewing return requests"
  above) — reasonable for the current volume, worth building once there's
  enough return traffic to make the D1 console tedious
