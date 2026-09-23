"""Shared SEO logic: set/era lookup, per-card SEO text and category membership.

Everything here is derived from products.js plus the two editable data files:
  seo/sets.json        every Pokémon TCG era and set (add new sets here)
  seo/categories.json  category landing-page copy and rules
Product names in products.js are never changed; SEO titles are built alongside them.
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://www.gradedcards01.com"
STORE = "Graded Cards 01"

LANGS = {"ja": "Japanese", "en": "English"}

GRADE_NOTES = {
    ("PSA", "10"): "PSA 10 Gem Mint is PSA's highest standard grade, given to a virtually perfect card.",
    ("PSA", "9"): "PSA 9 Mint is given to a superb card with no more than one minor flaw.",
    ("PSA", "8"): "PSA 8 NM-MT is a high-end card that looks Mint at first glance, with a minor flaw on close inspection.",
    ("ACE", "10"): "ACE 10 Gem Mint is awarded by ACE Grading, a UK grading company, to cards in gem mint condition.",
}

# Words stripped from a product name to find the Pokémon it shows.
NAME_SUFFIXES = r"\s+(ex|EX|GX|V|VMAX|VSTAR|V-UNION|BREAK|LV\.X|Prime|LEGEND|δ)$"


def esc(text):
    return html.escape(str(text), quote=True)


def slug(text):
    text = text.lower().replace("é", "e").replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def load_json(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


class Registry:
    """Looks up the set and era a product belongs to from its 'set' text."""

    def __init__(self):
        data = load_json("seo/sets.json")
        self.eras = data["eras"]
        self.era_by_id = {e["id"]: e for e in self.eras}
        self._patterns = []
        for era in self.eras:
            for s in era.get("sets", []):
                rec = {"name": s["name"], "year": s["year"], "era": era["id"], "lang": "en",
                       "kind": s.get("kind", "expansion"), "code": None}
                for alias in [s["name"]] + s.get("aliases", []):
                    self._patterns.append((alias, rec))
            for s in era.get("japanese_sets", []):
                rec = {"name": s["name"], "year": s["year"], "era": era["id"], "lang": "ja",
                       "kind": "Japanese set", "code": s["code"]}
                for alias in [s["code"], s["name"]] + s.get("aliases", []):
                    self._patterns.append((alias, rec))
        # Longest alias first, so "XY Evolutions" wins over "XY" and "Base Set 2" over "Base Set".
        self._patterns.sort(key=lambda p: -len(p[0]))

    def match(self, set_text):
        head = set_text.split("—")[0]
        for alias, rec in self._patterns:
            if re.search(r"(?<![\w-])" + re.escape(alias) + r"(?![\w-])", head, flags=re.IGNORECASE):
                return rec
        return None

    def era_label(self, era_id):
        era = self.era_by_id[era_id]
        return era.get("short", era["name"])


def pokemon_name(product_name):
    name = re.sub(r"^Mega\s+", "", product_name.strip())
    name = re.sub(NAME_SUFFIXES, "", name)
    return name.strip()


def enrich(p, registry):
    """Adds derived SEO facts to a product dict (without changing the product itself)."""
    company, grade_num = (p["grade"].split(" ") + [""])[:2]
    parts = [x.strip() for x in p["set"].split("—")]
    rarity = parts[1] if len(parts) > 1 else ""
    year_m = re.match(r"(\d{4})", p["set"])
    lang = "ja" if "(Japanese)" in p["set"] else "en"
    s = registry.match(p["set"])
    info = {
        "company": company,
        "grade_num": grade_num,
        "rarity": rarity,
        "year": int(year_m.group(1)) if year_m else (s["year"] if s else None),
        "lang": lang,
        "lang_name": LANGS[lang],
        "set_rec": s,
        "era": s["era"] if s else None,
        "pokemon": pokemon_name(p["name"]),
        "in_stock": not p.get("sold"),
    }
    if s:
        info["set_display"] = f"{s['name']} ({s['code']})" if s.get("code") else s["name"]
        info["set_short"] = f"{s['name']} {s['code']}" if s.get("code") else s["name"]
    else:
        info["set_display"] = info["set_short"] = re.sub(r"^\d{4}\s+Pokémon\s+", "", parts[0]).replace(" (Japanese)", "").replace(" (English)", "")
    return info


def price_text(p):
    return "Sold" if p.get("sold") else f"£{p['price']:,.2f}"


def seo_title(p, i):
    num = p["cardNumber"].split("/")[0]
    core = f"{p['name']} {i['company']} {i['grade_num']} – {i['set_short']} {i['lang_name']} #{num}"
    full = f"{core} | {STORE}"
    return full if len(full) <= 65 else core


def seo_description(p, i):
    rarity = f"{i['rarity']} " if i["rarity"] else ""
    options = [
        f"Buy {p['name']} {i['company']} {i['grade_num']} {p['gradeLabel']}, {rarity}#{p['cardNumber']} from "
        f"{i['set_display']} ({i['lang_name']}, {i['year']}). {i['company']} cert #{p['certNumber']}. "
        f"{price_text(p)}, tracked UK delivery, 14-day returns.",
        f"Buy {p['name']} {i['company']} {i['grade_num']} {p['gradeLabel']}, #{p['cardNumber']} from "
        f"{i['set_short']} ({i['lang_name']}). Cert #{p['certNumber']}. {price_text(p)}, tracked UK delivery.",
        f"{p['name']} {i['company']} {i['grade_num']}, {i['set_short']} #{p['cardNumber']}. "
        f"Cert #{p['certNumber']}. {price_text(p)}, tracked UK delivery.",
    ]
    for d in options:
        if len(d) <= 160:
            return d
    return options[-1][:157].rstrip() + "…"


def about_html(p, i, registry, category_links):
    """Unique, factual 'About this card' copy for a card page."""
    era = registry.era_label(i["era"]) if i["era"] else None
    s = i["set_rec"]
    if s:
        kind = "Japanese" if s["lang"] == "ja" else ("English special expansion" if s["kind"] == "special expansion" else "English")
        where = f"{s['name']}{' (' + s['code'] + ')' if s.get('code') else ''}, a {s['year']} {kind} set from the {era} era"
    else:
        where = i["set_display"]
    rarity = f", printed as {'an' if i['rarity'][:1].lower() in 'aeiou' else 'a'} {i['rarity']}" if i["rarity"] else ""
    p1 = f"{esc(p['name'])} is card #{esc(p['cardNumber'])} from {esc(where)}{esc(rarity)}."
    grade_note = GRADE_NOTES.get((i["company"], i["grade_num"]),
                                 f"This card is graded {i['company']} {i['grade_num']} {p['gradeLabel']}.")
    verify = "PSA's" if i["company"] == "PSA" else ("ACE Grading's" if i["company"] == "ACE" else "the grader's")
    p2 = (f"{esc(grade_note)} This slab's cert number, {esc(p['certNumber'])}, can be checked on {verify} "
          f"website before you buy, and our authenticity guarantee covers it with no time limit.")
    p3 = ("It ships from the UK by tracked, signed-for delivery under a numbered tamper-evident seal, "
          "and you can return it within 14 days of delivery.")
    rows = [("Pokémon", i["pokemon"]), ("Set", i["set_display"]), ("Era", era or "—"),
            ("Language", i["lang_name"]), ("Card number", p["cardNumber"])]
    if i["rarity"]:
        rows.append(("Rarity", i["rarity"]))
    rows += [("Grading company", i["company"]), ("Grade", f"{i['grade_num']} {p['gradeLabel']}"),
             ("Cert number", p["certNumber"])]
    dl = "\n".join(f"          <div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>" for k, v in rows)
    links = ""
    if category_links:
        items = "\n".join(f'          <li><a href="{esc(href)}">{esc(text)}</a></li>' for href, text in category_links)
        links = f"""
        <h3 class="pdp-about-subhead">More like this</h3>
        <ul class="pdp-about-links">
{items}
        </ul>"""
    return f"""
        <h2 id="pdp-about-heading">About this {esc(p['name'])} {esc(i['company'])} {esc(i['grade_num'])}</h2>
        <p>{p1}</p>
        <p>{p2}</p>
        <p>{p3}</p>
        <dl class="pdp-details">
{dl}
        </dl>{links}
"""


# ---------------------------------------------------------------- categories

def _grade_key(p):
    company, num = (p["grade"].split(" ") + ["0"])[:2]
    try:
        return (company, float(num))
    except ValueError:
        return (company, 0.0)


def grade_range(cards):
    """'PSA 8 to PSA 10', or per grader when mixed: 'PSA 8 to PSA 9 and ACE 10'."""
    by_company = {}
    for company, num in {_grade_key(c) for c in cards}:
        by_company.setdefault(company, []).append(num)
    parts = []
    for company in sorted(by_company, key=lambda c: (c != "PSA", c)):
        nums = sorted(by_company[company])
        parts.append(f"{company} {nums[0]:g}" if len(nums) == 1 else f"{company} {nums[0]:g} to {company} {nums[-1]:g}")
    return " and ".join(parts)


def grades_list(cards):
    grades = sorted({_grade_key(c) for c in cards}, key=lambda g: (g[0], g[1]))
    labels = [f"{g[0]} {g[1]:g}" for g in grades]
    return labels[0] if len(labels) == 1 else ", ".join(labels[:-1]) + " & " + labels[-1]


def languages_text(infos):
    langs = sorted({i["lang_name"] for i in infos}, key=lambda x: ["Japanese", "English"].index(x))
    return " and ".join(langs)


def sets_text(infos, limit=4):
    seen = []
    for i in infos:
        if i["set_rec"] and i["set_rec"]["name"] not in seen:
            seen.append(i["set_rec"]["name"])
    names = seen[:limit]
    if not names:
        return "several sets"
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def matches(rule, p, i):
    if "grader" in rule and i["company"] != rule["grader"]:
        return False
    if "grade" in rule and i["grade_num"] != rule["grade"]:
        return False
    if "language" in rule and i["lang"] != rule["language"]:
        return False
    if "tag" in rule and rule["tag"] not in p.get("tags", []):
        return False
    if "era" in rule and i["era"] != rule["era"]:
        return False
    if "pokemon" in rule and i["pokemon"] != rule["pokemon"]:
        return False
    return True


def build_categories(products, infos, registry):
    """Returns the category pages to publish, each with its matching cards."""
    cfg = load_json("seo/categories.json")
    minimum = cfg["min_in_stock"]
    defs = []
    for c in cfg["fixed"]:
        defs.append(dict(c, kind="fixed"))
    for era in registry.eras:
        t = cfg["era"]
        label = era.get("short", era["name"])
        defs.append({
            "kind": "era", "id": era["id"], "match": {"era": era["id"]},
            "file": t["file"].replace("{era_id}", era["id"]),
            "vars": {"era": label, "era_summary": era["summary"]},
            **{k: t[k] for k in ("link_text", "title", "h1", "description", "lede", "about_heading", "about")},
        })
    for name in sorted({i["pokemon"] for i in infos.values()}):
        t = cfg["pokemon"]
        defs.append({
            "kind": "pokemon", "id": slug(name), "match": {"pokemon": name},
            "file": t["file"].replace("{pokemon_id}", slug(name)),
            "vars": {"pokemon": name},
            **{k: t[k] for k in ("link_text", "title", "h1", "description", "lede", "about_heading", "about")},
        })

    pages = []
    for d in defs:
        cards = [p for p in products if matches(d["match"], p, infos[p["id"]])]
        in_stock = [p for p in cards if infos[p["id"]]["in_stock"]]
        if len(in_stock) < minimum:
            continue
        # Pokémon pages that would just repeat a family page with the same cards are skipped.
        stock_infos = [infos[p["id"]] for p in in_stock]
        v = dict(d.get("vars", {}))
        v.update({
            "count": str(len(in_stock)),
            "grade_range": grade_range(in_stock),
            "grades": grades_list(in_stock),
            "languages": languages_text(stock_infos),
            "sets": sets_text(stock_infos),
            "sets2": sets_text(stock_infos, limit=2),
            "guide_link": '<a href="pokemon-tcg-sets.html">Pokémon TCG sets guide</a>',
        })
        fill = lambda text: re.sub(r"\{(\w+)\}", lambda m: v.get(m.group(1), m.group(0)), text)
        pages.append({
            "id": d["id"], "kind": d["kind"], "file": d["file"],
            "title": fill(d["title"]), "h1": fill(d["h1"]), "link_text": fill(d["link_text"]),
            "description": fit_description(fill(d["description"])), "lede": fill(d["lede"]),
            "about_heading": fill(d["about_heading"]),
            "about": [fill(x) for x in d["about"]],
            "cards": sorted(cards, key=lambda p: (p.get("sold", False), -p["price"])),
            "in_stock": len(in_stock),
        })
    # A Pokémon page that only repeats a family page (e.g. Eeveelutions) with the same cards is dropped.
    family = {tuple(sorted(c["id"] for c in pg["cards"])) for pg in pages
              if pg["kind"] == "fixed" and "tag" in next(d for d in defs if d["id"] == pg["id"])["match"]}
    return [pg for pg in pages
            if not (pg["kind"] == "pokemon" and tuple(sorted(c["id"] for c in pg["cards"])) in family)]


def fit_description(text, limit=160):
    """Keeps a meta description within Google's display limit by dropping whole trailing sentences."""
    if len(text) <= limit:
        return text
    sentences = re.split(r"(?<=\.)\s+", text)
    while len(sentences) > 1 and len(" ".join(sentences)) > limit:
        sentences.pop()
    out = " ".join(sentences)
    return out if len(out) <= limit else out[: limit - 1].rstrip() + "…"


def category_links_for(product, info, pages):
    """Category pages a card belongs to, most specific first, for internal links."""
    order = {"pokemon": 0, "fixed": 1, "era": 2}
    links = []
    for page in sorted(pages, key=lambda pg: order[pg["kind"]]):
        if any(c["id"] == product["id"] for c in page["cards"]):
            links.append((page["file"], "More " + page["link_text"]))
    return links[:5]
