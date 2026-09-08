# Setup checklist — getting fully live

The site now has a working shop layout, product data, and all the pages that
were previously dead links. Three things are still placeholders because only
you can supply them. Do these in order:

## 1. Add real card photos

Upload these 10 files to the `images/cards/` folder in this repo (drag-and-drop
on GitHub.com works fine — go to the folder, click "Add file → Upload files"):

- `images/cards/eevee-ex.jpg`
- `images/cards/flareon-ex.jpg`
- `images/cards/espeon-ex.jpg`
- `images/cards/leafeon-ex.jpg`
- `images/cards/jolteon-ex.jpg`
- `images/cards/mega-gengar-ex.jpg`
- `images/cards/mega-venusaur-ex.jpg`
- `images/cards/bulbasaur.jpg`
- `images/cards/articuno.jpg`
- `images/cards/pikachu-ex.jpg`

Filenames must match exactly (lowercase, hyphens). Until a file is uploaded,
that card shows a "Photo coming soon" placeholder automatically — nothing
breaks.

## 2. Create Stripe Payment Links (this is what makes checkout actually work)

Buyers browse with "Add to cart" and pay from the cart page (`cart.html`) —
each card pays via its own Stripe link there. Right now every card falls
back to "Contact to buy" because `stripeLink` is empty in `products.js`. To
accept real card payments:

1. Create a free account at [stripe.com](https://stripe.com) and finish
   activating it (bank details, business info) so you can receive payouts.
2. In the Stripe Dashboard, go to **Payment links → + New**.
3. Add a product for each card:
   - Name: e.g. "Eevee ex — PSA 10 (2024 SV8a #224)"
   - Price: one-time, £300 (or your current price)
   - Under **Options**, turn on **"Collect customer addresses"** → Shipping
     (you're shipping a physical card, so you need this).
   - Under **Options**, set **"Limit the number of payments"** to `1` — this
     is important since each card is a unique 1-of-1 item; it auto-deactivates
     the link the moment it sells, so it can't be bought twice.
4. Click **Create link**, copy the URL (looks like `https://buy.stripe.com/xxxxx`).
5. Open `products.js` in this repo, find the matching product, and paste the
   URL into its `stripeLink` field, e.g.:
   ```js
   stripeLink: "https://buy.stripe.com/xxxxx",
   ```
6. Commit and push. That card's "Pay for this card" button on the cart page
   goes live immediately.

Repeat for each of the 10 cards.

**When a card sells:** Stripe deactivates that link automatically (because of
the limit-1 setting), but the button on your site won't know that on its own.
Also set `sold: true` on that product in `products.js` and push, so the site
shows a "Sold out" badge instead of a dead link.

**Note on the cart:** because this is a static site with no backend, a buyer
who adds multiple cards to their cart still pays for each one separately
(its own Stripe link) rather than one combined checkout — Stripe requires a
server to combine arbitrary items into a single payment. The cart page also
offers a "Request a combined invoice" link that pre-fills the contact form
with everything in the buyer's cart, so you can manually create one
multi-item Stripe Payment Link for that specific order if they'd rather pay
once. See "Optional upgrades later" below for a true one-checkout-for-many
option.

## 3. Fill in your real business details

Done — all contact points (contact form, About, Shipping, Terms, Privacy)
route to `Gradedcards01@outlook.com`, and the business/shipping/returns
details are filled in on those pages.

## Optional upgrades later

- **Real contact form (no email-client popup):** sign up free at
  [Formspree](https://formspree.io), and swap the `contact.js` mailto logic
  for a `fetch()` POST to your Formspree endpoint.
- **More cards:** copy a block in `products.js`, give it a new `id`, a
  `tags` entry (used by the category tiles / filter chips), and add its
  image + Stripe link the same way. Update the `sub` counts in the
  `CATEGORIES` array at the bottom of `products.js` if you change how many
  cards are in a category.
- **PSA verification:** each product already stores its PSA cert number —
  consider linking it to `https://www.psacard.com/cert/<certNumber>` on the
  product card so buyers can one-click verify.
## 4. Enable single combined checkout (optional but built and ready)

Right now a buyer with multiple cards in their cart pays for each one
separately. `checkout-worker/worker.js` is a ready-to-deploy Cloudflare
Worker that creates ONE Stripe Checkout Session covering the whole cart.
It never needs your Stripe secret key to leave Cloudflare's dashboard.

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → sign up free
   (no credit card needed) → **Workers & Pages** → **Create** → **Worker**.
2. Give it a name (e.g. `gradedcards01-checkout`), then open the editor and
   replace the sample code with the contents of `checkout-worker/worker.js`
   from this repo.
3. Go to the Worker's **Settings → Variables and Secrets** → add a secret
   named `STRIPE_SECRET_KEY` with your **secret key** from
   [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/apikeys)
   (starts with `sk_live_...`). This stays inside Cloudflare — never paste it
   anywhere else.
4. Click **Deploy**. You'll get a URL like
   `https://gradedcards01-checkout.<your-subdomain>.workers.dev`.
5. Open `cart-page.js` in this repo, find `const CHECKOUT_ENDPOINT = "";`
   near the top, and paste that URL in between the quotes.
6. Commit and push. The cart page will now show a "Pay for everything
   (1 checkout)" button whenever there's more than one item, alongside the
   existing per-card links.

## Optional upgrades later

- **Real contact form (no email-client popup):** sign up free at
  [Formspree](https://formspree.io), and swap the `contact.js` mailto logic
  for a `fetch()` POST to your Formspree endpoint.
- **More cards:** copy a block in `products.js`, give it a new `id`, a
  `tags` entry (used by the category tiles / filter chips), and add its
  image + Stripe link the same way. Update the `sub` counts in the
  `CATEGORIES` array at the bottom of `products.js` if you change how many
  cards are in a category.
- **PSA verification:** each product already stores its PSA cert number —
  consider linking it to `https://www.psacard.com/cert/<certNumber>` on the
  product card so buyers can one-click verify.
