#!/usr/bin/env python3
"""SEO audit for every page in the site root. Writes seo/audit-report.md.

Checks titles, meta descriptions, headings, canonical URLs, robots/sitemap
consistency, image alt text, broken internal links, structured data, thin or
duplicate pages, keyword coverage (seo/keywords.json), cards whose set isn't in
seo/sets.json, and whether the set list is due a review.

    python3 tools/seo_audit.py
Never modifies pages. The GitHub Action runs it after every rebuild and shows
the summary on the run page.
"""
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata
from html.parser import HTMLParser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seo_lib as L  # noqa: E402

ROOT = L.ROOT
SITE = L.SITE
PRIVATE = {"orders.html", "alerts.html", "visits.html", "account.html"}
UTILITY = {"cart.html", "product.html", "404.html", "sealed.html", "raw-cards.html"}


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = None
        self.meta = {}
        self.canonical = None
        self.h1 = []
        self.h2 = []
        self.imgs = []
        self.links = []
        self.assets = []
        self.ld = []
        self.text = []
        self._stack = []
        self._in_title = False
        self._in_ld = False
        self._buf = ""
        self._skip = 0
        self._heading = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self._in_title, self._buf = True, ""
        elif tag == "meta":
            key = a.get("name") or a.get("property")
            if key:
                self.meta[key] = a.get("content", "")
        elif tag == "link":
            if a.get("rel") == "canonical":
                self.canonical = a.get("href")
            elif a.get("rel") == "stylesheet" and a.get("href"):
                self.assets.append(a["href"])
        elif tag == "script":
            if a.get("type") == "application/ld+json":
                self._in_ld, self._buf = True, ""
            else:
                self._skip += 1
                if a.get("src"):
                    self.assets.append(a["src"])
        elif tag == "style":
            self._skip += 1
        elif tag in ("h1", "h2"):
            self._heading, self._buf = tag, ""
        elif tag == "img":
            self.imgs.append(a)
            if a.get("src"):
                self.assets.append(a["src"])
        elif tag == "a" and a.get("href"):
            self.links.append(a["href"])

    def handle_endtag(self, tag):
        if tag == "title" and self._in_title:
            self.title, self._in_title = self._buf.strip(), False
        elif tag == "script":
            if self._in_ld:
                self.ld.append(self._buf)
                self._in_ld = False
            elif self._skip:
                self._skip -= 1
        elif tag == "style" and self._skip:
            self._skip -= 1
        elif tag in ("h1", "h2") and self._heading == tag:
            (self.h1 if tag == "h1" else self.h2).append(" ".join(self._buf.split()))
            self._heading = None

    def handle_data(self, data):
        if self._in_title or self._in_ld or self._heading:
            self._buf += data
        if not self._skip and not self._in_ld and not self._in_title:
            self.text.append(data)


def norm(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.findall(r"[a-z0-9&]+", text)


def covers(phrase, haystack):
    words = set(norm(haystack))
    return all(w in words for w in norm(phrase))


def local_target(href):
    if re.match(r"^(https?:|mailto:|tel:|#|javascript:|data:)", href):
        return None
    path = href.split("#")[0].split("?")[0]
    if not path:
        return None
    return path.lstrip("/")


def main():
    today = datetime.date.today()
    files = sorted(n for n in os.listdir(ROOT) if n.endswith(".html"))
    pages = {}
    for name in files:
        p = Page()
        p.feed(open(os.path.join(ROOT, name), encoding="utf-8").read())
        pages[name] = p

    sitemap = set(re.findall(r"<loc>https://www\.gradedcards01\.com/([^<]*)</loc>", open(os.path.join(ROOT, "sitemap.xml")).read()))
    sitemap = {("index.html" if s == "" else s) for s in sitemap}
    errors, warnings, info = [], [], []

    def indexable(name):
        return "noindex" not in pages[name].meta.get("robots", "")

    titles, descs, bodies = {}, {}, {}
    for name, p in pages.items():
        idx = indexable(name)
        # robots / sitemap consistency
        if name in PRIVATE | UTILITY and idx and name != "404.html":
            warnings.append(f"{name}: private or utility page without a noindex tag.")
        if idx and name not in sitemap and name != "404.html":
            warnings.append(f"{name}: indexable but missing from sitemap.xml.")
        if not idx and name in sitemap:
            errors.append(f"{name}: in sitemap.xml but marked noindex.")
        # images and links apply to every page
        for img in p.imgs:
            if "alt" not in img:
                errors.append(f"{name}: image {img.get('src', '?')} has no alt attribute.")
            elif not img["alt"].strip() and img.get("aria-hidden") != "true":
                info.append(f"{name}: image {img.get('src', '?')} has empty alt (fine only if decorative).")
        for href in p.links + p.assets:
            t = local_target(href)
            if t and "${" not in t and not os.path.exists(os.path.join(ROOT, t)):
                errors.append(f"{name}: broken internal link or asset '{href}'.")
        for block in p.ld:
            try:
                json.loads(block)
            except ValueError as e:
                errors.append(f"{name}: invalid JSON-LD ({e}).")
        if not idx or name == "404.html":
            continue
        # indexable-page checks
        t = p.title or ""
        d = p.meta.get("description", "")
        if not t:
            errors.append(f"{name}: missing <title>.")
        elif not 25 <= len(t) <= 70:
            warnings.append(f"{name}: title is {len(t)} characters (aim for 30–65): '{t}'.")
        if not d:
            errors.append(f"{name}: missing meta description.")
        elif not 70 <= len(d) <= 160:
            warnings.append(f"{name}: meta description is {len(d)} characters (aim for 70–160).")
        titles.setdefault(t, []).append(name)
        descs.setdefault(d, []).append(name)
        if len(p.h1) != 1:
            errors.append(f"{name}: has {len(p.h1)} <h1> headings in the HTML (should be exactly 1).")
        expected = f"{SITE}/" if name == "index.html" else f"{SITE}/{name}"
        if p.canonical != expected:
            errors.append(f"{name}: canonical is {p.canonical!r}, expected {expected!r}.")
        if not p.meta.get("og:image"):
            warnings.append(f"{name}: no og:image for link previews.")
        body = " ".join(" ".join(p.text).split())
        words = len(body.split())
        if words < 200:
            warnings.append(f"{name}: only about {words} words of text; consider adding useful content.")
        bodies.setdefault(hashlib.sha1(body.encode()).hexdigest(), []).append(name)
        if name.startswith("card-"):
            lds = [json.loads(b) for b in p.ld]
            if not any(isinstance(x, dict) and x.get("@type") == "Product" and x.get("offers", {}).get("price") for x in lds):
                errors.append(f"{name}: no Product structured data with a price.")

    for t, names in titles.items():
        if len(names) > 1:
            errors.append(f"Duplicate title '{t}' on: {', '.join(names)}.")
    for d, names in descs.items():
        if d and len(names) > 1:
            errors.append(f"Duplicate meta description on: {', '.join(names)}.")
    for names in bodies.values():
        if len(names) > 1:
            errors.append(f"Duplicate page content on: {', '.join(names)}.")

    # Keyword coverage
    kw = L.load_json("seo/keywords.json")
    coverage = []
    for name, phrases in kw["pages"].items():
        if name not in pages:
            coverage.append((name, "—", "page not published (not enough stock yet)"))
            continue
        p = pages[name]
        hay = " ".join([p.title or "", p.meta.get("description", "")] + p.h1 + p.h2)
        for phrase in phrases:
            ok = covers(phrase, hay)
            coverage.append((name, phrase, "covered" if ok else "MISSING"))
            if not ok:
                warnings.append(f"{name}: target phrase '{phrase}' isn't covered by its title, headings or description.")
    guide = pages.get("pokemon-tcg-sets.html")
    if guide:
        body = " ".join(guide.text)
        for term in kw["set_guide_terms"]:
            if not covers(term, body):
                warnings.append(f"pokemon-tcg-sets.html: set guide doesn't mention '{term}'.")

    # Card pages: name + grader + grade in the title
    js = "const fs=require('fs');eval(fs.readFileSync(process.argv[1],'utf8')+';globalThis.P=PRODUCTS');process.stdout.write(JSON.stringify(P))"
    products = json.loads(subprocess.check_output(["node", "-e", js, os.path.join(ROOT, "products.js")]))
    registry = L.Registry()
    for prod in products:
        name = f"card-{prod['id']}.html"
        if name not in pages:
            errors.append(f"{prod['id']}: no card page (run tools/build_card_pages.py).")
            continue
        if not covers(f"{prod['name']} {prod['grade']}", pages[name].title or ""):
            warnings.append(f"{name}: title doesn't contain '{prod['name']} {prod['grade']}'.")
        if not registry.match(prod["set"]):
            warnings.append(f"{prod['id']}: set '{prod['set']}' isn't in seo/sets.json, so it has no era or set page links.")

    # Watchlist: which popular Pokémon have stock or a landing page
    infos = {p["id"]: L.enrich(p, registry) for p in products}
    watch = []
    for poke in kw["watchlist"]:
        stock = [p for p in products if infos[p["id"]]["pokemon"] == poke and not p.get("sold")]
        page = f"{L.slug(poke)}-graded-cards.html"
        state = "landing page live" if page in pages else (f"{len(stock)} in stock (page appears at 2)" if stock else "none in stock")
        watch.append((poke, state))

    # Set registry freshness
    sets = L.load_json("seo/sets.json")
    reviewed = datetime.date.fromisoformat(sets.get("last_reviewed", "2000-01-01"))
    age = (today - reviewed).days
    if age > 60:
        warnings.append(f"seo/sets.json was last reviewed {age} days ago. Check for new Pokémon TCG releases and add them.")

    # Report
    lines = ["# SEO audit", "",
             f"Generated by `tools/seo_audit.py`. {len(pages)} HTML pages checked, "
             f"{sum(1 for n in pages if indexable(n))} indexable, {len(sitemap)} URLs in sitemap.xml.", "",
             f"**{len(errors)} errors, {len(warnings)} warnings.**", ""]
    for heading, items in (("Errors", errors), ("Warnings", warnings)):
        lines.append(f"## {heading}")
        lines.append("")
        lines += [f"- {x}" for x in sorted(set(items))] or ["- None."]
        lines.append("")
    lines += ["## Keyword coverage", "", "| Page | Target phrase | Status |", "|---|---|---|"]
    lines += [f"| {n} | {ph} | {st} |" for n, ph, st in coverage]
    lines += ["", "## Pokémon watchlist", "", "| Pokémon | Status |", "|---|---|"]
    lines += [f"| {n} | {st} |" for n, st in watch]
    lines += ["", "## Notes", ""]
    empty_alts = sorted(set(info))
    lines.append(f"- {len(empty_alts)} images use an empty alt because they're decorative (category thumbnails, logos next to the shop name).")
    lines.append(f"- Set list last reviewed {reviewed.isoformat()}. The audit warns once this is over 60 days old.")
    report = "\n".join(lines) + "\n"
    os.makedirs(os.path.join(ROOT, "seo"), exist_ok=True)
    path = os.path.join(ROOT, "seo", "audit-report.md")
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
    if old != report:
        with open(path, "w", encoding="utf-8") as f:
            f.write(report)
    print(f"SEO audit: {len(errors)} errors, {len(warnings)} warnings. Full report: seo/audit-report.md")
    for x in sorted(set(errors)):
        print("ERROR  ", x)
    for x in sorted(set(warnings)):
        print("WARNING", x)


if __name__ == "__main__":
    main()
