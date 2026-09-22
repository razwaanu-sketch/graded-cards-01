# Site review — what's missing (2026-09-22)

An honest audit of gradedcards01.com, ranked by how much it actually matters. Come back to this whenever you're ready to tackle the next item.

## Legally/financially risky — fix these first

1. **No trader identity anywhere on the site.** UK law (Consumer Contracts Regulations 2013) requires you to state who you actually are before someone buys — your legal name (or company name + registration number if you're a Ltd), and a geographic address, before checkout, not buried in a returns policy. Right now the only address on the whole site is a return-to address on the shipping page. This is a 20-minute fix (a line in the footer or a "Company info" section) but it's the one thing that could actually get you in legal trouble, so it goes first.

2. **No stated VAT/business status.** Doesn't matter if you're under the VAT threshold — but "sole trader, not VAT registered" or your VAT number if you are one is standard, and its absence looks unfinished to anyone who checks.

3. **Single point of failure on literally everything.** One person's login controls your domain, Stripe, Cloudflare, GitHub, and Resend. If your phone breaks or you lose 2FA access to one of those, the business stops. No documented recovery plan, no second admin. Worth at minimum writing down where your 2FA backup codes live.

## Real trust/conversion gaps

4. **Zero social proof.** No reviews, no testimonials, no "X cards sold," no social media presence at all (no Instagram/Twitter/eBay links anywhere). For someone about to spend £900 on a Mega Gengar ex from a site they've never heard of, this is the biggest thing standing between "interested" and "actually pays." A Trustpilot widget, even 5 genuine reviews, or a linked Instagram showing real packages going out, would do more for conversion than anything else on this list.

5. **No urgency beyond "1 of 1."** That's honest and worth keeping honest — but there's nothing showing recent activity ("sold 3 hours ago," a simple sales counter) that would nudge a hesitant buyer.

6. **No way to grow your own inventory pipeline.** Every product is hand-typed into `products.js`. There's no "Sell/consign your card to us" intake form. If sourcing new cards is the actual bottleneck, that's a real growth lever missing, not just a website nicety.

## Real operational gaps

7. **No dispatch-condition record for high-value items.** You're shipping £600–£1000 slabs. If a buyer disputes "it arrived damaged," there's currently no photo-at-dispatch policy to protect yourself. Cheap insurance: photograph every slab right before it goes in the box.

8. **No counterfeit/authenticity guarantee stated** beyond "it's PSA/ACE graded, go check yourself." Honest, but something like "if a cert ever comes back invalid, full refund, no questions" costs nothing (PSA/ACE cards essentially never fail that check) and reads as more confident.

## Smaller, real, but lower priority

- No blog/content — the grading-card hobby searches obsessively for population reports, grading guides, set info. Zero organic SEO traffic being captured there.
- No "notify me" / restock alerts (less relevant since nothing restocks, but relevant for "new cards added" alerts)
- No bundle/multi-card incentive
- `sealed.html` / `raw-cards.html` have been "coming soon" for a while — either build them out or pull the nav links; a permanently-empty page erodes trust
- No age-appropriateness statement (minor, but a lot of buyers/gift-recipients in this hobby are minors)

## If picking just two things

**Trader identity info** (legal exposure, fast fix) and **any form of social proof** (directly moves conversion) — everything else here is optimization on top of a site that already works well technically.
