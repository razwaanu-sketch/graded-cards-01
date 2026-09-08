# Google Analytics 4 — setup & dashboard guide

## What the code already does

`analytics.js` loads GA4 only after a visitor accepts the cookie banner
(privacy-compliant — nothing loads, no request to Google, until consent is
given; declining or ignoring the banner means zero tracking). Once loaded,
GA4's own "Enhanced measurement" automatically captures, with no extra code
needed:

- **Page views** — every page load
- **Time on page / engagement** — GA4 tracks engaged time per page
  automatically in the background
- **Traffic sources** — referrer, UTM parameters, organic search, direct,
  etc. are auto-classified by GA4's default channel grouping
- **Scrolls and outbound link clicks**

On top of that, these e-commerce events are wired into the site's actual
buying flow:

| Event | Fires when | Where in code |
|---|---|---|
| `add_to_cart` | A visitor taps "Add to cart" on a product | `shop.js` |
| `remove_from_cart` | A visitor removes a card from the cart page | `cart-page.js` |
| `view_cart` | The cart page loads with items still in it | `cart-page.js` |
| `begin_checkout` | "Pay for this card" or "Pay for everything" is clicked | `shop.js` / `cart-page.js` |
| `purchase` | A buyer returns from the **combined** checkout having paid | `cart-page.js`, via `?checkout=success&session_id=...` |

**One real limitation, by design of how Stripe Payment Links work:** the
`purchase` event only fires for the combined-checkout flow (the "Pay for
everything" button), because that's the only checkout path that redirects
back to `cart.html` afterwards. A single "Pay for this card" purchase uses
a Stripe Payment Link directly, which redirects to Stripe's own generic
confirmation page — there's no code-side hook to catch that return. If you
want every single-card sale tracked too, each of the 10 Payment Links in
your Stripe Dashboard would need its "After payment" redirect changed to
point back to your site with a similar `?checkout=success` link — a manual
Stripe Dashboard step per card, not something in this codebase. Worth doing
once you're past initial setup, not blocking anything today.

## 1. Get your Measurement ID

1. Go to [analytics.google.com](https://analytics.google.com) and sign in
2. Admin → Create property → name it "Graded Cards 01", set timezone/currency (UK/GBP)
3. Choose **Web** as the platform, enter `https://www.gradedcards01.com`
4. You'll get a **Measurement ID** like `G-XXXXXXXXXX` — send it over and
   it gets dropped into `analytics.js`

## 2. Mark "purchase" as a key event (this is what makes it a "conversion")

Once real purchase events start flowing in (this requires the Measurement
ID to be live and at least one real purchase to have happened):

1. Admin → Events
2. Find `purchase` in the list → toggle **"Mark as key event"**

This is what makes GA4's own conversion-rate reporting and "Key events"
column work throughout your reports.

## 3. Daily / weekly / monthly visitors

- **Reports → Reports snapshot** gives you an at-a-glance overview
- **Reports → Engagement → Overview** shows active users, with a date-range
  picker in the top right — switch between day/week/month granularity
- For a single number you can screenshot for a quick check: **Reports →
  Realtime** shows visitors in the last 30 minutes

## 4. Traffic sources

**Reports → Acquisition → Traffic acquisition** — breaks visits down by
channel (Direct, Organic Search, Referral, Social, etc.) and by individual
source if you want more detail (e.g. "google / organic" vs "instagram.com / referral").

## 5. Building the conversion & cart-abandonment dashboard

This is the one piece that needs a custom report rather than a stock GA4
screen, because "abandonment rate" isn't a metric GA4 ships out of the box
— you build it as a **Funnel Exploration** using the events above:

1. Go to **Explore** (left sidebar) → **Funnel exploration** (blank template)
2. Add these steps in order:
   1. `add_to_cart`
   2. `view_cart`
   3. `begin_checkout`
   4. `purchase`
3. GA4 shows the number (and %) of users completing each step, and the
   drop-off between each step — that drop-off *is* your cart abandonment
   rate at each stage. The overall step-1-to-step-4 completion % is your
   **conversion rate**.
4. Save it, and pin it to a **Collection** (Library → Collections → new
   collection → add your funnel + the Acquisition and Engagement overview
   cards) so all of this lives on one dashboard-style screen instead of
   spread across separate report pages.

Because `purchase` only fires for the combined-checkout path (see the
limitation above), this funnel will under-report actual sales/conversion
until either most buyers use "Pay for everything," or the Payment Links
are reconfigured to redirect back to the site.

## 6. Testing before you trust the numbers

1. Add the real Measurement ID to `analytics.js`, push
2. Visit the live site in an incognito/private window, accept the cookie
   banner
3. Add a card to cart → check **Reports → Realtime → Event count by Event
   name** in GA4 — `add_to_cart` should appear within ~30 seconds
4. Repeat through `view_cart`, `begin_checkout`, and (if you complete a
   real combined-checkout purchase) `purchase`
