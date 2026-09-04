# graded-cards-01

A static storefront for selling PSA graded Pokémon cards, hosted on GitHub
Pages at [www.gradedcards01.com](https://www.gradedcards01.com).

## What's here

- `index.html` — homepage: hero with search, category tiles, filterable shop grid, trust section
- `products.js` — the product catalog and categories (edit prices, mark items sold, add Stripe links, add/edit `tags` here)
- `shop.js` — renders the shop grid + category tiles, and handles search/filtering and Add to Cart
- `cart.js` — site-wide cart (localStorage) and the cart icon/badge shown in every page's nav
- `cart.html` / `cart-page.js` — the cart page: line items, subtotal, per-card Stripe payment links
- `about.html`, `contact.html`, `shipping.html`, `terms.html`, `privacy.html` — supporting pages
- `contact.js` — powers the contact form (opens a pre-filled email, no backend needed; also handles the cart's "combined invoice" prefill)
- `style.css`, `script.js` — shared styling and interactions
- `images/cards/` — card photos (filenames referenced from `products.js`)

## Getting fully live

See **[SETUP.md](SETUP.md)** for the remaining steps: uploading real card
photos, creating Stripe Payment Links so checkout actually charges buyers,
and filling in your real business details on the legal/contact pages.

## About the cart

Because this is a static site with no backend, the cart lets buyers browse
and select multiple cards, but checkout still pays for each card via its own
Stripe Payment Link (a true single combined checkout needs a server — see
"Optional upgrades" in SETUP.md). A "Request a combined invoice" link on the
cart page pre-fills the contact form with the buyer's cart so you can send
them one manual multi-item payment link instead, if they'd rather pay once.

## Local preview

```
python3 -m http.server
```

then open `http://localhost:8000`.
