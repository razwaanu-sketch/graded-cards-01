// Renders a single product's detail page (product.html?id=<id>) from
// products.js — the same data source the shop grid uses, so there's
// nothing to keep in sync between the two.
(function () {
  const params = new URLSearchParams(location.search);
  // card-<id>.html pages set GC01_PRODUCT_ID; product.html?id=<id> still works.
  const id = window.GC01_PRODUCT_ID || params.get("id");
  const product = typeof PRODUCTS !== "undefined" ? PRODUCTS.find((p) => p.id === id) : null;
  const productUrl = (pid) => (window.gc01ProductUrl ? window.gc01ProductUrl(pid) : `product.html?id=${pid}`);

  // Old product.html?id= links move to the card's own page, so the address
  // people copy and share is the one with a proper link preview.
  if (!window.GC01_PRODUCT_ID && product && productUrl(product.id).startsWith("card-")) {
    location.replace(productUrl(product.id) + location.hash);
    return;
  }

  const loaded = document.getElementById("pdp-loaded");
  const notFound = document.getElementById("pdp-notfound");
  const breadcrumb = document.getElementById("pdp-breadcrumb");

  const formatPrice = (amount, currency) => {
    try {
      return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
    } catch (e) {
      return `£${amount}`;
    }
  };

  // Click-to-zoom lightbox — same pattern as shop.js, showing the
  // full-resolution photo (images/cards-full/) for close inspection.
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxClose = document.getElementById("lightbox-close");

  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt;
    lightbox.hidden = false;
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightboxImg.src = "";
  }

  if (lightbox) {
    lightboxClose.addEventListener("click", closeLightbox);
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
    });
  }

  // `onChange` lets a caller keep more than one instance of this button in
  // sync (the main CTA and the sticky bar's copy both represent the same
  // product) — it defaults to just re-rendering this one container.
  function renderCartAction(container, p, onChange) {
    container.innerHTML = "";
    if (p.sold) {
      const span = document.createElement("span");
      span.className = "btn-outline btn-disabled btn-block";
      span.textContent = "Sold out";
      container.appendChild(span);
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    const inCart = window.EPSACart && window.EPSACart.isInCart(p.id);
    btn.className = inCart ? "btn-outline cart-toggle in-cart btn-block" : "btn-gold cart-toggle btn-block";
    btn.textContent = inCart ? "In cart ✓" : "Add to cart";
    btn.setAttribute("aria-label", `${inCart ? "Remove" : "Add"} ${p.name} ${inCart ? "from" : "to"} cart`);
    btn.addEventListener("click", () => {
      if (!window.EPSACart) return;
      if (window.EPSACart.isInCart(p.id)) {
        window.EPSACart.removeFromCart(p.id);
      } else {
        window.EPSACart.addToCart(p.id);
        if (window.EPSAAnalytics) {
          window.EPSAAnalytics.trackEvent("add_to_cart", { item_id: p.id, item_name: p.name, value: p.price });
        }
      }
      if (onChange) onChange();
      else renderCartAction(container, p);
    });
    container.appendChild(btn);
  }

  // Keeps the main product-page CTA and the sticky bar's copy of it in sync
  // — clicking either one updates both immediately.
  function renderMainCartActions() {
    const mainContainer = document.getElementById("pdp-cart-action");
    const stickyContainer = document.getElementById("pdp-sticky-cart-action");
    if (mainContainer) renderCartAction(mainContainer, product, renderMainCartActions);
    if (stickyContainer) renderCartAction(stickyContainer, product, renderMainCartActions);
  }

  // Shows the sticky bar once the main "Add to cart" button has scrolled out
  // of view, so buying never requires scrolling back up.
  function setupStickyBar(p) {
    const bar = document.getElementById("pdp-sticky-bar");
    const mainCta = document.getElementById("pdp-cart-action");
    if (!bar || !mainCta || typeof IntersectionObserver === "undefined") return;

    const thumb = document.getElementById("pdp-sticky-thumb");
    if (thumb) {
      thumb.src = p.image;
      thumb.alt = imageAlt(p);
    }
    const name = document.getElementById("pdp-sticky-name");
    if (name) name.textContent = p.name;
    const price = document.getElementById("pdp-sticky-price");
    if (price) price.textContent = formatPrice(p.price, p.currency);

    const observer = new IntersectionObserver(([entry]) => {
      bar.hidden = entry.isIntersecting;
    });
    observer.observe(mainCta);
  }

  // Descriptive image text: card, grade, set and number (used for accessibility and image search).
  const imageAlt = (p) => `${p.name} ${p.grade} ${p.gradeLabel} graded Pokémon card, ${p.set} #${p.cardNumber}`;

  function setMetaContent(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute("content", value);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Prefers cards sharing a category tag with the one being viewed, then
  // fills any remaining slots from the rest of the catalog — never the
  // current or sold-out cards.
  function pickRelated(current, all, count) {
    const pool = all.filter((p) => p.id !== current.id && !p.sold);
    const sameCategory = pool.filter((p) => (p.tags || []).some((t) => (current.tags || []).includes(t)));
    const sameCategoryIds = new Set(sameCategory.map((p) => p.id));
    const rest = pool.filter((p) => !sameCategoryIds.has(p.id));
    return shuffle(sameCategory).concat(shuffle(rest)).slice(0, count);
  }

  // Same card markup/behaviour as the shop grid (shop.js renderCard), minus
  // nothing — reused here so a related card is fully consistent, including
  // its own working Add to cart.
  function renderRelatedCard(p) {
    const card = document.createElement("article");
    card.className = "product-card";
    card.setAttribute("role", "listitem");

    const media = document.createElement("div");
    media.className = "product-media";
    media.innerHTML = `<a class="product-media-link" href="${productUrl(p.id)}" aria-label="View ${p.name} details">
      <picture>
        <source srcset="${p.image.replace(/\.jpg$/, ".webp")}" type="image/webp">
        <img src="${p.image}" alt="${imageAlt(p)}" loading="lazy">
      </picture>
    </a>`;
    const img = media.querySelector("img");
    img.addEventListener("error", () => {
      img.src = "images/cards/placeholder.svg";
    });

    const gradeBadge = document.createElement("span");
    gradeBadge.className = "grade-badge";
    gradeBadge.textContent = `${p.grade} ${p.gradeLabel}`;
    media.appendChild(gradeBadge);

    const body = document.createElement("div");
    body.className = "product-body";

    const title = document.createElement("h3");
    title.className = "product-title";
    const titleLink = document.createElement("a");
    titleLink.className = "product-title-link";
    titleLink.href = productUrl(p.id);
    titleLink.textContent = p.name;
    title.appendChild(titleLink);

    const meta = document.createElement("p");
    meta.className = "product-meta";
    meta.textContent = `${p.set} · #${p.cardNumber}`;

    const cert = document.createElement("p");
    cert.className = "product-cert";
    const gradingCompany = p.grade.split(" ")[0];
    cert.textContent = `${gradingCompany} cert #${p.certNumber}`;

    const footer = document.createElement("div");
    footer.className = "product-footer";
    const price = document.createElement("span");
    price.className = "price";
    price.textContent = formatPrice(p.price, p.currency);
    footer.appendChild(price);

    const cartActionContainer = document.createElement("div");

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(cert);
    body.appendChild(footer);
    body.appendChild(cartActionContainer);
    renderCartAction(cartActionContainer, p);

    card.appendChild(media);
    card.appendChild(body);

    card.addEventListener("click", (e) => {
      if (e.target.closest("a, .cart-toggle")) return;
      window.location.href = productUrl(p.id);
    });

    return card;
  }

  function renderRelated() {
    const section = document.getElementById("pdp-related-section");
    const grid = document.getElementById("pdp-related-grid");
    if (!section || !grid || typeof PRODUCTS === "undefined") return;

    const related = pickRelated(product, PRODUCTS, 4);
    if (related.length === 0) return;

    grid.innerHTML = "";
    related.forEach((p) => grid.appendChild(renderRelatedCard(p)));
    section.hidden = false;
  }

  function render() {
    if (!product) {
      if (notFound) notFound.hidden = false;
      return;
    }

    // Card pages (card-<id>.html) ship with search-optimised titles, meta tags
    // and breadcrumbs built by tools/build_card_pages.py; only the product.html
    // fallback fills them in here.
    if (!window.GC01_PRODUCT_ID) fillPageMeta();
    renderProductBody();
  }

  function fillPageMeta() {
    document.title = `${product.name} — ${product.grade} ${product.gradeLabel} — Graded Cards 01`;
    const description = `${product.name}, ${product.set}, #${product.cardNumber} — ${product.grade} ${product.gradeLabel}, ${formatPrice(product.price, product.currency)}.`;
    const imageUrl = `https://www.gradedcards01.com/${product.image}`;
    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:title"]', `${product.name} — Graded Cards 01`);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:image"]', imageUrl);
    setMetaContent('meta[property="og:url"]', `https://www.gradedcards01.com/${productUrl(product.id)}`);
    setMetaContent('meta[name="twitter:image"]', imageUrl);

    if (breadcrumb) {
      const categoryLabel =
        (product.tags || []).includes("eeveelution") ? "Eeveelutions" :
        (product.tags || []).includes("mega-evolution") ? "Mega Evolutions" :
        "Other Singles";
      breadcrumb.innerHTML = `<a href="index.html#shop">Shop</a> / <span>${categoryLabel}</span> / <span>${product.name}</span>`;
    }
  }

  function renderProductBody() {

    const media = document.getElementById("pdp-media");
    media.innerHTML = `<picture>
      <source srcset="${product.image.replace(/\.jpg$/, ".webp")}" type="image/webp">
      <img src="${product.image}" alt="${imageAlt(product)}" decoding="async">
    </picture>`;
    const img = media.querySelector("img");
    img.addEventListener("error", () => {
      img.src = "images/cards/placeholder.svg";
    });

    const gradeBadge = document.createElement("span");
    gradeBadge.className = "grade-badge";
    gradeBadge.textContent = `${product.grade} ${product.gradeLabel}`;
    media.appendChild(gradeBadge);

    if (product.sold) {
      const soldBadge = document.createElement("span");
      soldBadge.className = "sold-badge";
      soldBadge.textContent = "Sold";
      media.appendChild(soldBadge);
    }

    const zoomBtn = document.createElement("button");
    zoomBtn.type = "button";
    zoomBtn.className = "zoom-btn";
    zoomBtn.setAttribute("aria-label", `Zoom in on ${product.name}`);
    zoomBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="10.5" y1="7.5" x2="10.5" y2="13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="7.5" y1="10.5" x2="13.5" y2="10.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    zoomBtn.addEventListener("click", () => {
      const fullSrc = product.image.replace("images/cards/", "images/cards-full/");
      openLightbox(fullSrc, `${product.name} — ${product.grade} graded Pokémon card, front view`);
    });
    media.appendChild(zoomBtn);

    document.getElementById("pdp-product-title").textContent = product.name;
    document.getElementById("pdp-product-meta").textContent = `${product.set} · #${product.cardNumber}`;
    const gradingCompany = product.grade.split(" ")[0];
    document.getElementById("pdp-product-cert").textContent =
      `${gradingCompany} cert #${product.certNumber} · ${product.grade} ${product.gradeLabel}`;

    // Links straight to the grader's own record for this cert, so a buyer
    // can confirm the card is genuine without taking our word for it.
    const certUrls = {
      PSA: (n) => `https://www.psacard.com/cert/${encodeURIComponent(n)}`,
      ACE: (n) => `https://acegrading.com/cert/${encodeURIComponent(n)}`,
    };
    const verifyLink = document.getElementById("pdp-verify");
    if (verifyLink && certUrls[gradingCompany]) {
      verifyLink.href = certUrls[gradingCompany](product.certNumber);
      verifyLink.textContent = `Verify this cert on ${gradingCompany}'s website ↗`;
      verifyLink.hidden = false;
    }
    document.getElementById("pdp-product-price").textContent = formatPrice(product.price, product.currency);

    renderMainCartActions();
    setupStickyBar(product);
    renderRelated();

    if (loaded) loaded.hidden = false;

    if (window.EPSAAnalytics) {
      window.EPSAAnalytics.trackEvent("view_item", { item_id: product.id, item_name: product.name, value: product.price });
    }
  }

  document.addEventListener("DOMContentLoaded", render);
})();
