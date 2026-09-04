# graded-cards-01

A static storefront for selling PSA graded Pokémon cards, hosted on GitHub
Pages at [www.gradedcards01.com](https://www.gradedcards01.com).

## What's here

- `index.html` — homepage: hero, shop grid, trust section
- `products.js` — the product catalog (edit prices, mark items sold, add Stripe links here)
- `shop.js` — renders the shop grid from `products.js` and handles Buy Now / Sold state
- `about.html`, `contact.html`, `shipping.html`, `terms.html`, `privacy.html` — supporting pages
- `contact.js` — powers the contact form (opens a pre-filled email, no backend needed)
- `style.css`, `script.js` — shared styling and interactions
- `images/cards/` — card photos (filenames referenced from `products.js`)

## Getting fully live

See **[SETUP.md](SETUP.md)** for the remaining steps: uploading real card
photos, creating Stripe Payment Links so "Buy now" actually charges buyers,
and filling in your real business details on the legal/contact pages.

## Local preview

```
python3 -m http.server
```

then open `http://localhost:8000`.
