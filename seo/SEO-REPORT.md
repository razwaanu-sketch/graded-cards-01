# SEO report: keyword system and site audit (24 September 2026)

## Summary

The site now has a keyword system that runs itself. Every card, category and set page is generated from
`products.js` and three data files in `seo/`, rebuilt and re-audited automatically on every change, and
checked monthly for new Pokémon releases. The final audit shows **0 errors and 2 minor warnings** across
46 pages (37 indexable, all 37 in the sitemap). No product was renamed and checkout was not touched.

## What the audit found before the fixes

| Area | Problem |
|---|---|
| Card pages | Titles said only the card name and grade, with no set, language or card number. The product script overwrote the page's title and description after loading. |
| Card pages | Each page had two `<h1>` headings, because the hidden "Card not found" block was left in. |
| Card pages | No descriptive text beyond one line of set info, and no links to related categories. |
| Image alt text | Every card photo said "… graded Pokémon card, front view", with no set or card number. |
| Categories | None existed. The Eeveelutions and Mega Evolutions buttons are JavaScript filters, so Google can't see them as pages. |
| Set coverage | Nothing on the site targeted set or era searches, such as "Scarlet & Violet" or "Pokémon TCG sets in order". |
| Internal links | Every product link sat in the JavaScript-built shop grid. Only the footer's info pages were plain HTML links. |
| Home page | The main section heading was "The Collection", with no keywords, and the meta description was 165 characters, so Google would cut it off. |
| Titles | About (23 characters) and FAQ (21 characters) had short titles with no keywords. |
| Descriptions | Contact, Privacy and Terms had 34–64 character descriptions, too short to earn a click. |
| Duplicates | `product.html?id=` addresses could be indexed alongside the card pages. That was already fixed with noindex and forwarding. |

## What was built

**Set registry (`seo/sets.json`):** covers 11 eras and 127 English sets, from Base Set (1999) to Pitch Black
(2026). That includes Mega Evolution (Mega Evolution, Phantasmal Flames, Ascended Heroes, Perfect Order,
Chaos Rising, Pitch Black), Scarlet & Violet, Sword & Shield, Sun & Moon, XY, Black & White,
HeartGold & SoulSilver, Platinum, Diamond & Pearl, the EX era and the Wizards of the Coast era. It also holds
the Japanese sets you stock (SV8, SV8a, SV9, M1L, M2a, s12a, CP6). Set names and years were checked against
published set lists. Every current card matches a set and era.

**Card pages (all 17):**
- **Unique title:** built as card name, grader, grade, set, language and number. For example "Charizard V PSA 10 – VSTAR Universe s12a Japanese #211". Card names are unchanged.
- **Unique description:** a buying-intent meta description with the grade, rarity, set, cert, price, tracked delivery and returns, kept under 160 characters.
- **"About this card" section:** three short factual paragraphs covering the set and era, what the grade means, and cert and shipping. There's also a details table (Pokémon, set, era, language, number, rarity, grader, grade, cert) and "More like this" links.
- **Breadcrumbs:** a visible trail from Shop to the era page to the card, plus the same breadcrumb for Google.
- **Product structured data:** now also includes era, language and rarity.
- **Cleanup:** the extra hidden `<h1>` is gone, and the title, heading, price and photo are in the HTML itself.

**Category landing pages:** 11 are live, and each is published only while at least 2 cards are in stock:

| Page | Main target |
|---|---|
| psa-graded-pokemon-cards.html | buy PSA graded Pokémon cards / UK |
| psa-10-pokemon-cards.html | PSA 10 Pokémon cards |
| ace-graded-pokemon-cards.html | ACE graded Pokémon cards |
| japanese-graded-pokemon-cards.html | Japanese graded Pokémon cards |
| english-graded-pokemon-cards.html | English graded Pokémon cards UK |
| eeveelution-graded-cards.html | Eeveelution PSA 10 |
| charizard-graded-cards.html | Charizard PSA 10 / PSA 9 |
| gengar-graded-cards.html | Mega Gengar ex ACE 10 |
| scarlet-violet-graded-pokemon-cards.html | Scarlet & Violet graded cards |
| mega-evolution-graded-pokemon-cards.html | Mega Evolution graded cards |
| xy-graded-pokemon-cards.html | XY graded cards |

What each page includes:
- **Content:** a heading, a short intro with live counts and grade ranges, the card grid as real links, an "About" section and links to the other categories.
- **Google data:** CollectionPage and ItemList structured data, plus breadcrumbs.
- **Automatic updates:** pages for other Pokémon, such as Umbreon or Rayquaza, and for other eras appear by themselves once you stock two matching cards.

**Set guide (`pokemon-tcg-sets.html`):** "Pokémon TCG Sets in Order" lists every era with a one-line summary,
every English set in release order, and the Japanese sets you stock. For each era it links to the graded
cards in stock, or to new-card alerts when there are none.

**Internal links:**
- **Home page:** a new "Shop Graded Pokémon Cards" block links by grader, era, Pokémon and language. The shop heading is now "Graded Pokémon Cards for Sale".
- **Footers:** every page's footer has a category row: PSA graded, PSA 10, ACE graded, Japanese, English and the set guide.
- **Kept current:** both blocks are rewritten on each build, so they never link to a page that's gone.

**Titles and descriptions fixed:**
- **About and FAQ:** new titles, "About Us: UK Graded Pokémon Card Shop" and "Graded Pokémon Cards FAQ".
- **Descriptions:** new ones for About, FAQ, Contact, Privacy and Terms, and a trimmed home page description.

**Image alt text:** every card photo now names the card, grade, set and number, in the shop grid, card pages,
related cards and category pages.

**Sitemap and Shopping feed:** these now include the category pages and set guide. Shopping product types
follow "Graded Pokémon Cards > Era > Set".

**Keeping it running:**
- **`tools/seo_audit.py`:** checks titles, descriptions, headings, canonical addresses, robots and sitemap consistency, image alt text, broken links, structured data, thin or duplicate pages, keyword coverage, and cards whose set is missing from the registry. It writes `seo/audit-report.md`.
- **The Card share pages Action:** rebuilds and audits on every relevant push.
- **The Monthly SEO check:** opens a GitHub issue when the set list hasn't been reviewed for 60 days.
- **`seo/README.md`:** explains how to add a new set in two lines of JSON.

## Remaining warnings

- `contact.html` and `notify.html` have little text (115–129 words). They're action pages rather than
  ranking pages, so this is acceptable.

## Recommended next steps, most valuable first

1. **Connect Google Search Console and Merchant Center.** Follow `GOOGLE-SETUP.md`. None of this work shows up
   in Google until the sitemap is submitted. Send Claude the Search Console verification tag.
2. **Make the shop grid images lighter.** Each card photo in the grid is about 500 KB (8.4 MB for 17 cards on
   the home page), and the desktop hero loads three 1.1 MB full-resolution photos. Page speed on phones is a
   ranking factor. Generating 480-pixel thumbnails, about 50 KB each, for grids would cut the home page
   weight by roughly 90% without changing how cards look on the product pages.
3. **Add the trader details to the footer.** Merchant Center checks business identity against the website.
   Your legal name, trading status and VAT status are still needed.
4. **Add English counterparts for Japanese sets, once checked.** Many UK buyers search the English set name
   even for Japanese cards. Terastal Festival ex is widely described as the Japanese counterpart of
   Prismatic Evolutions. Adding a verified `english_counterpart` to each Japanese set would let card pages
   mention it naturally.
5. **Add a line or two of your own notes per card.** An optional note in `products.js` covering centring,
   eye appeal or why the card is special would make each page more original than generated text can.
6. **Build links from outside.** Put the site in your Instagram, TikTok and eBay profiles, and share card pages
   (they now preview properly) in collector groups and Discord servers. Links from other sites are what move
   rankings for competitive searches such as "Charizard PSA 10".
7. **Write two or three genuinely useful guides.** For example: how to check a PSA or ACE cert, PSA vs ACE
   grading, and Japanese vs English cards. These target the questions buyers search before they buy.
8. **Add reviews only when they're real.** Once you have genuine buyer reviews (for example through a review
   platform), they can be added to card pages as structured data. Don't add them before then, as Google
   penalises self-written reviews.
9. **Check Search Console monthly.** Add the real searches people use to `seo/keywords.json`, and stock and
   write for what's being searched.
