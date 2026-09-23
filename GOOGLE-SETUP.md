# Getting found on Google

The website side is done. These steps need you, because they happen in your own Google accounts.
Do step 1 first. Everything else builds on it.

## What the site now gives Google

- **`sitemap.xml`** lists every public page and every card page, with each card's photo. It updates
  itself whenever `products.js` changes.
- **`robots.txt`** tells search engines everything public can be crawled, and where the sitemap is.
- **Product data on every card page**: name, grade, cert number, price in GBP, in stock or sold,
  £10 UK shipping and the 14-day return policy. This is what lets Google show price and stock in
  search results.
- **`google-merchant-feed.xml`** lists every card for sale in the format Google Merchant Center reads,
  for free Google Shopping listings. Sold cards drop out automatically.
- **A branded "Page not found" page** (`404.html`) with a search box, instead of GitHub's plain error.
- **Search-friendly page setup**: a preferred address on every page, a stronger home page title,
  and the basket, product template and "coming soon" pages kept out of search results.

## 1. Google Search Console (about 15 minutes)

This is how Google learns your site exists and how you see what people search to find you.

1. Go to https://search.google.com/search-console and sign in with the Google account you want to use.
2. Click **Add property** and choose **URL prefix**. Enter `https://www.gradedcards01.com/`.
3. Choose the **HTML tag** verification method. Google shows a line like
   `<meta name="google-site-verification" content="abc123..." />`.
   Send that line to Claude and it will be added to the home page. Then click **Verify**.
   (If your domain's DNS is managed somewhere you can edit, the **Domain** property with a DNS TXT
   record works too and covers every version of the address.)
4. In the left menu open **Sitemaps**, type `sitemap.xml` and click **Submit**.
5. Open **URL inspection**, paste `https://www.gradedcards01.com/`, then click **Request indexing**.
   Do the same for two or three of your best cards, for example
   `https://www.gradedcards01.com/card-pikachu-ex.html`.
6. Come back after a week. **Pages** shows what's indexed. **Shopping > Product snippets** and
   **Merchant listings** show whether Google can read your prices and stock.

## 2. Google Merchant Center: free Shopping listings (about 30 minutes)

This puts your cards in the Shopping tab and product panels on Google, free of charge.

1. Go to https://merchants.google.com and create an account with the same Google account.
2. **Business info**: enter your business name, the Peterborough address and your customer service
   email. Google checks this against the website.
3. **Website**: enter `https://www.gradedcards01.com/` and claim it. If Search Console is verified
   with the same account, this is one click.
4. **Shipping**: add a UK service at a flat £10, handling time 1 to 2 business days, and the
   transit time of the Royal Mail service you use.
5. **Returns**: 14 days, returned by post, customer pays return postage (change of mind), with a link
   to `https://www.gradedcards01.com/shipping.html`.
6. **Products > Add products > Add products from a file > Add a file from a link**. Paste
   `https://www.gradedcards01.com/google-merchant-feed.xml` and set it to fetch **daily**.
7. Make sure **Free listings** is turned on under Growth or Marketing (the menu name varies).

Google reviews new stores, which usually takes a few days. The most common reasons for a rejection
are missing business details or a returns policy that doesn't match the site, so keep steps 2 and 5
matching the website exactly. Showing your legal name and trading status in the footer also helps here.

## 3. Bing (2 minutes)

Go to https://www.bing.com/webmasters, sign in and choose **Import from Google Search Console**.
Bing also powers DuckDuckGo and Yahoo results.

## What to expect

- New sites usually appear in Google within a few days to a few weeks of submitting the sitemap.
- Searches for your shop name come first. Ranking for competitive terms like "PSA 10 Charizard"
  takes longer and depends on other sites linking to yours: an Instagram or TikTok bio link,
  your eBay profile, collector forums and Discord servers all count.
- Check Search Console once a month. The **Performance** report shows the searches that led people
  to your cards, which tells you what to stock and what to write about.
