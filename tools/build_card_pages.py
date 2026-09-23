#!/usr/bin/env python3
"""Build a shareable page and a link-preview image for every card.

WhatsApp, Instagram, Facebook and iMessage read a page's <meta> tags without
running its JavaScript, so product.html?id=... always previews as the generic
site image. This script writes, for each card in products.js:

  card-<id>.html          product.html with that card's title, description,
                          preview image and Google product data baked in
  images/share/<id>.jpg   a 1200x630 preview image of the card
  card-pages.js           the list of generated pages, so the site links to them
  sitemap.xml             every public page and card page, with card photos,
                          for Google Search Console
  google-merchant-feed.xml  in-stock cards as a Google Merchant Center feed
                          (free Google Shopping listings)

Run it after changing products.js, product.html or a card photo:
    python3 tools/build_card_pages.py
The "Card share pages" GitHub Action runs it automatically on push to main.
Needs node (to read products.js) and Pillow.
"""
import html
import json
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://www.gradedcards01.com"
STORE = "Graded Cards 01"
SHIPPING_GBP = "10.00"

# Public, indexable pages for the sitemap (card pages are added automatically).
# sealed.html and raw-cards.html are "coming soon" and noindex; add them back here
# (and drop their robots meta tag) once they have products.
STATIC_PAGES = ["", "about.html", "faq.html", "shipping.html", "contact.html",
                "terms.html", "privacy.html", "notify.html"]

CATEGORY = {"eeveelution": "Eeveelutions", "mega-evolution": "Mega Evolutions"}
SHARE_DIR = os.path.join(ROOT, "images", "share")
W, H = 1200, 630


def load_products():
    js = (
        "const fs=require('fs');"
        "eval(fs.readFileSync(process.argv[1],'utf8')+';globalThis.__P=PRODUCTS');"
        "process.stdout.write(JSON.stringify(globalThis.__P));"
    )
    out = subprocess.check_output(["node", "-e", js, os.path.join(ROOT, "products.js")])
    return json.loads(out)


def price_text(p):
    return "Sold" if p.get("sold") else f"£{p['price']:,.2f}"


def share_image(p):
    """Card photo centred on the site's dark background with a soft blue glow."""
    src = os.path.join(ROOT, p["image"])
    card = Image.open(src).convert("RGB")
    bg = Image.new("RGB", (W, H), (22, 21, 19))
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((W // 2 - 420, -120, W // 2 + 420, H + 120), fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    bg.paste(Image.new("RGB", (W, H), (52, 84, 214)), (0, 0), glow)

    ch = H - 60
    cw = round(card.width * ch / card.height)
    card = card.resize((cw, ch), Image.LANCZOS)
    shadow = Image.new("L", (W, H), 0)
    x, y = (W - cw) // 2, 30
    ImageDraw.Draw(shadow).rectangle((x + 10, y + 24, x + cw + 10, y + ch + 24), fill=170)
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    bg.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), shadow)
    bg.paste(card, (x, y))

    logo_path = os.path.join(ROOT, "images", "logo-mark.png")
    if os.path.exists(logo_path):
        logo = Image.open(logo_path).convert("RGBA").resize((88, 88), Image.LANCZOS)
        bg.paste(logo, (W - 88 - 36, H - 88 - 36), logo)

    os.makedirs(SHARE_DIR, exist_ok=True)
    out = os.path.join(SHARE_DIR, f"{p['id']}.jpg")
    bg.save(out, "JPEG", quality=84, optimize=True, progressive=True)
    return f"images/share/{p['id']}.jpg"


def set_meta(doc, attr, key, value):
    """Replace the content of <meta {attr}="{key}" ...>, or add it before </head>."""
    pattern = re.compile(r'<meta %s="%s" content="[^"]*"\s*/?>' % (attr, re.escape(key)))
    tag = f'<meta {attr}="{key}" content="{html.escape(value, quote=True)}" />'
    if pattern.search(doc):
        return pattern.sub(lambda _m: tag, doc, count=1)
    return doc.replace("</head>", f"  {tag}\n</head>", 1)


def card_page(template, p, image_rel):
    company = p["grade"].split(" ")[0]
    url = f"{SITE}/card-{p['id']}.html"
    image_url = f"{SITE}/{image_rel}"
    title = f"{p['name']} — {p['grade']} {p['gradeLabel']} | Graded Cards 01"
    desc = (
        f"{p['name']}, {p['set']}, #{p['cardNumber']}. {p['grade']} {p['gradeLabel']}, "
        f"{company} cert #{p['certNumber']}. {price_text(p)}."
    )

    # product.html is noindex (it's only a template); each card page should be indexed.
    doc = re.sub(r'\s*<meta name="robots" content="[^"]*"\s*/?>', "", template, count=1)
    doc = re.sub(r"<title>.*?</title>", lambda _m: f"<title>{html.escape(title)}</title>", doc, count=1)
    for attr, key, value in [
        ("name", "description", desc),
        ("property", "og:title", f"{p['name']} — {p['grade']} {p['gradeLabel']}"),
        ("property", "og:description", desc),
        ("property", "og:type", "product"),
        ("property", "og:site_name", "Graded Cards 01"),
        ("property", "og:url", url),
        ("property", "og:image", image_url),
        ("property", "og:image:width", str(W)),
        ("property", "og:image:height", str(H)),
        ("property", "og:image:alt", f"{p['name']} {p['grade']} graded Pokémon card"),
        ("property", "product:price:amount", f"{p['price']:.2f}"),
        ("property", "product:price:currency", p.get("currency", "GBP")),
        ("property", "product:availability", "out of stock" if p.get("sold") else "in stock"),
        ("property", "product:condition", "used"),
        ("name", "twitter:card", "summary_large_image"),
        ("name", "twitter:title", f"{p['name']} — {p['grade']} {p['gradeLabel']}"),
        ("name", "twitter:description", desc),
        ("name", "twitter:image", image_url),
    ]:
        doc = set_meta(doc, attr, key, value)

    offer = {
        "@type": "Offer",
        "url": url,
        "priceCurrency": p.get("currency", "GBP"),
        "price": f"{p['price']:.2f}",
        "availability": "https://schema.org/SoldOut" if p.get("sold") else "https://schema.org/InStock",
        "itemCondition": "https://schema.org/UsedCondition",
        "seller": {"@type": "Organization", "name": STORE, "url": SITE + "/"},
        "shippingDetails": {
            "@type": "OfferShippingDetails",
            "shippingRate": {"@type": "MonetaryAmount", "value": SHIPPING_GBP, "currency": "GBP"},
            "shippingDestination": {"@type": "DefinedRegion", "addressCountry": "GB"},
        },
        "hasMerchantReturnPolicy": {
            "@type": "MerchantReturnPolicy",
            "applicableCountry": "GB",
            "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
            "merchantReturnDays": 14,
            "returnMethod": "https://schema.org/ReturnByMail",
            "returnFees": "https://schema.org/ReturnFeesCustomerResponsibility",
            "merchantReturnLink": SITE + "/shipping.html",
        },
    }
    ld = [
        {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": f"{p['name']} {p['grade']} {p['gradeLabel']}",
            "description": desc,
            "image": [f"{SITE}/{p['image']}", f"{SITE}/{p['image'].replace('images/cards/', 'images/cards-full/')}"],
            "sku": str(p["certNumber"]),
            "brand": {"@type": "Brand", "name": "Pokémon"},
            "category": "Collectible Trading Cards",
            "url": url,
            "additionalProperty": [
                {"@type": "PropertyValue", "name": "Grading company", "value": company},
                {"@type": "PropertyValue", "name": "Grade", "value": f"{p['grade']} {p['gradeLabel']}"},
                {"@type": "PropertyValue", "name": "Cert number", "value": str(p["certNumber"])},
                {"@type": "PropertyValue", "name": "Set", "value": p["set"]},
                {"@type": "PropertyValue", "name": "Card number", "value": p["cardNumber"]},
            ],
            "offers": offer,
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Graded Pokémon Cards", "item": SITE + "/"},
                {"@type": "ListItem", "position": 2, "name": p["name"], "item": url},
            ],
        },
    ]
    ld_json = json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")
    head_extra = (
        f'  <link rel="canonical" href="{url}" />\n'
        f'  <script type="application/ld+json">{ld_json}</script>\n'
    )
    doc = doc.replace("</head>", head_extra + "</head>", 1)

    marker = '<script src="product.js" defer></script>'
    if marker not in doc:
        sys.exit("product.html no longer loads product.js the expected way; update build_card_pages.py")
    doc = doc.replace(
        marker,
        f'<script>window.GC01_PRODUCT_ID = {json.dumps(p["id"])};</script>\n  {marker}',
        1,
    )
    note = "<!-- Generated from product.html by tools/build_card_pages.py. Edit product.html, not this file. -->\n"
    return note + doc


def xml_escape(text):
    return html.escape(str(text), quote=True)


def write_sitemap(products):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
             '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
    for page in STATIC_PAGES:
        lines.append(f"  <url><loc>{SITE}/{page}</loc></url>")
    for p in products:
        lines += [
            "  <url>",
            f"    <loc>{SITE}/card-{p['id']}.html</loc>",
            "    <image:image>",
            f"      <image:loc>{SITE}/{p['image']}</image:loc>",
            "    </image:image>",
            "  </url>",
        ]
    lines.append("</urlset>")
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def write_merchant_feed(products):
    items = []
    for p in products:
        if p.get("sold"):
            continue
        company = p["grade"].split(" ")[0]
        category = next((CATEGORY[t] for t in p.get("tags", []) if t in CATEGORY), "Other Singles")
        title = f"{p['name']} {p['grade']} {p['gradeLabel']} – {p['set']} #{p['cardNumber']}"[:150]
        desc = (
            f"{p['name']} from {p['set']}, card #{p['cardNumber']}, graded {p['grade']} {p['gradeLabel']} by {company}. "
            f"{company} cert #{p['certNumber']} can be verified on the grader's website. Sent from the UK with tracked, "
            f"signed-for delivery under a numbered tamper-evident seal. 14-day returns."
        )
        items.append(f"""    <item>
      <g:id>{xml_escape(p['id'])}</g:id>
      <g:title>{xml_escape(title)}</g:title>
      <g:description>{xml_escape(desc)}</g:description>
      <g:link>{SITE}/card-{p['id']}.html</g:link>
      <g:image_link>{SITE}/{p['image']}</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>{p['price']:.2f} {p.get('currency', 'GBP')}</g:price>
      <g:condition>used</g:condition>
      <g:brand>Pokémon</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>Graded Pokémon Cards &gt; {xml_escape(category)}</g:product_type>
      <g:shipping>
        <g:country>GB</g:country>
        <g:service>Tracked, signed-for</g:service>
        <g:price>{SHIPPING_GBP} GBP</g:price>
      </g:shipping>
      <g:min_handling_time>1</g:min_handling_time>
      <g:max_handling_time>2</g:max_handling_time>
    </item>""")
    feed = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n'
        "  <channel>\n"
        f"    <title>{STORE}</title>\n"
        f"    <link>{SITE}/</link>\n"
        "    <description>PSA and ACE graded Pokémon cards from the UK.</description>\n"
        + "\n".join(items) + "\n"
        "  </channel>\n"
        "</rss>\n"
    )
    with open(os.path.join(ROOT, "google-merchant-feed.xml"), "w", encoding="utf-8") as f:
        f.write(feed)


def main():
    products = load_products()
    template = open(os.path.join(ROOT, "product.html"), encoding="utf-8").read()
    ids = []
    for p in products:
        if not re.fullmatch(r"[a-z0-9-]+", p["id"]):
            sys.exit(f"Unsafe product id for a file name: {p['id']!r}")
        image_rel = share_image(p)
        with open(os.path.join(ROOT, f"card-{p['id']}.html"), "w", encoding="utf-8") as f:
            f.write(card_page(template, p, image_rel))
        ids.append(p["id"])

    # Remove pages and images for cards no longer in products.js.
    for name in os.listdir(ROOT):
        m = re.fullmatch(r"card-([a-z0-9-]+)\.html", name)
        if m and m.group(1) not in ids:
            os.remove(os.path.join(ROOT, name))
    for name in os.listdir(SHARE_DIR):
        if name.endswith(".jpg") and name[:-4] not in ids:
            os.remove(os.path.join(SHARE_DIR, name))

    with open(os.path.join(ROOT, "card-pages.js"), "w", encoding="utf-8") as f:
        f.write(
            "// Generated by tools/build_card_pages.py. Cards that have their own shareable page.\n"
            f"window.GC01_CARD_PAGES = {json.dumps(sorted(ids))};\n"
            "window.gc01ProductUrl = function (id) {\n"
            "  return window.GC01_CARD_PAGES.indexOf(id) !== -1 ? \"card-\" + id + \".html\" : \"product.html?id=\" + encodeURIComponent(id);\n"
            "};\n"
        )
    write_sitemap(products)
    write_merchant_feed(products)
    print(f"Built {len(ids)} card pages and share images, sitemap.xml and google-merchant-feed.xml.")


if __name__ == "__main__":
    main()
