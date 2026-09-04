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

## 2. Create Stripe Payment Links (this is what makes "Buy now" actually work)

Right now every "Buy now" button falls back to "Contact to buy" because
`stripeLink` is empty in `products.js`. To accept real card payments:

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
6. Commit and push. The "Buy now" button for that card goes live immediately.

Repeat for each of the 10 cards.

**When a card sells:** Stripe deactivates that link automatically (because of
the limit-1 setting), but the button on your site won't know that on its own.
Also set `sold: true` on that product in `products.js` and push, so the site
shows a "Sold out" badge instead of a dead link.

## 3. Fill in your real business details

Search each of these files for text wrapped in `[LIKE THIS]` and replace it
with your real details:

- `contact.js` — replace `your-email@example.com` with your real contact email
- `contact.html`, `about.html`, `shipping.html`, `terms.html`, `privacy.html`
  — business name, email, shipping regions/cost, returns window, country

## Optional upgrades later

- **Real contact form (no email-client popup):** sign up free at
  [Formspree](https://formspree.io), and swap the `contact.js` mailto logic
  for a `fetch()` POST to your Formspree endpoint.
- **More cards:** copy a block in `products.js`, give it a new `id`, and add
  its image + Stripe link the same way.
- **PSA verification:** each product already stores its PSA cert number —
  consider linking it to `https://www.psacard.com/cert/<certNumber>` on the
  product card so buyers can one-click verify.
