# SEO system

Everything customers and search engines see is built from three data files plus `products.js`.
Nothing here renames a product or touches checkout.

| File | What it controls |
|---|---|
| `seo/sets.json` | Every Pokémon TCG era and set, newest first. Drives each card's era, set name and "About this card" text, the era landing pages and the set guide (`pokemon-tcg-sets.html`). |
| `seo/categories.json` | Copy and rules for the landing pages: PSA graded, PSA 10, ACE graded, Japanese, English, Eeveelutions, one page per era and one per Pokémon. |
| `seo/keywords.json` | The search phrases each page targets, the set-guide terms and the Pokémon watchlist. Used by the audit. |

`tools/build_card_pages.py` builds the pages and `tools/seo_audit.py` checks them. The **Card share pages**
GitHub Action runs both on every push that changes `products.js`, a template, a card photo or anything in
`seo/`, commits the results and republishes the site. The **Monthly SEO check** runs the audit on the 1st of
each month and opens a reminder issue when the set list is due a review.

## How pages appear and disappear

- **Card pages** (`card-<id>.html`): one per card in `products.js`, with a title like
  "Charizard V PSA 10 – VSTAR Universe s12a Japanese #211", a unique description, an "About this card"
  section, breadcrumbs, links to its category pages, and Product structured data (price, stock, shipping, returns).
- **Category pages**: published only when at least 2 unsold cards match (`min_in_stock`), so there are never
  empty or thin pages. A Pokémon page such as `umbreon-graded-cards.html` appears by itself once two graded
  Umbreon cards are listed, and is removed again if they sell and nothing replaces them.
- **Links**: the "Shop Graded Pokémon Cards" block on the home page and the category row in every footer are
  rewritten on each build between `<!-- seo:... -->` markers, so they only ever link to live pages.

## When Pokémon releases a new set

1. Add it to its era in `seo/sets.json`: `{"name": "Set Name", "year": 2026}` for English sets, or
   `{"code": "M3", "name": "Japanese Name", "year": 2026}` under `japanese_sets`.
   A new era (series) goes at the top with an `id`, `name`, `years` and a one-sentence `summary`.
2. Update `last_reviewed` to today's date.
3. Push. The set guide, era pages and every card from that set update automatically.

If a card's `set` text in `products.js` doesn't match any set, the build prints a warning and the audit lists it.
Add the set, or an `aliases` entry with the spelling you used.

## Writing product entries that rank well

Keep the existing format in `products.js`: `"set": "2025 Pokémon M1L (Japanese) — Special Art Rare"`.
The year, set code or name, language in brackets and the rarity after the dash all feed the SEO text.
Card names stay exactly as you write them.

## Checking the results

Run `python3 tools/seo_audit.py` (or open the latest Action run). `seo/audit-report.md` lists errors,
warnings, keyword coverage per page and the Pokémon watchlist.
