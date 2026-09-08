# Customer accounts — go-live checklist

Everything below is written and committed but **not deployed and not linked
from the site**. `account.html` currently just shows "Accounts aren't
switched on yet" to any visitor who finds it directly. Follow these steps
when you're ready to turn it on.

## What this adds

- `account.html` / `account.js` — sign up, log in, and view order history
- `accounts-worker/` — a Cloudflare Worker + D1 database backend:
  - Passwords are hashed (PBKDF2-SHA256, 100k iterations, random salt per
    user) — never stored in plain text
  - Sessions are a random token the browser keeps in `localStorage` and
    sends as `Authorization: Bearer <token>` (not a cookie — this avoids
    cross-origin cookie issues between your GitHub Pages site and the
    Worker's own `*.workers.dev` address)
  - Orders are populated automatically by a Stripe webhook when a payment
    completes — you never enter them by hand, and there's nothing to keep
    in sync with `products.js`

## Setup steps

1. **Create the database.** In the Cloudflare dashboard: Storage &
   Databases → D1 → Create database → name it `gradedcards01-accounts`.
   Copy the **Database ID** it gives you.

2. **Load the schema.** Open the new database → Console (or "Query") tab,
   paste in the contents of `accounts-worker/schema.sql`, and run it. This
   creates the `users`, `sessions`, and `orders` tables.

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

## Known limitations (fine for a shop this size, worth knowing)

- No "forgot password" flow yet — you'd need to add a password-reset-by-email
  step (e.g. via a transactional email service) if that becomes a problem
- No email verification on signup — someone could sign up with an email
  they don't own; low-stakes here since accounts only ever *display* order
  history, they don't grant any purchasing power
- Session tokens don't auto-refresh; they simply expire after 30 days and
  the user has to log in again
