// Renders a single product's detail page (product.html?id=<id>) from
// products.js — the same data source the shop grid uses, so there's
// nothing to keep in sync between the two.
(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const product = typeof PRODUCTS !== "undefined" ? PRODUCTS.find((p) => p.id === id) : null;

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

  function renderCartAction(container, p) {
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
      renderCartAction(container, p);
    });
    container.appendChild(btn);
  }

  function setMetaContent(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute("content", value);
  }

  function render() {
    if (!product) {
      if (notFound) notFound.hidden = false;
      return;
    }

    document.title = `${product.name} — ${product.grade} ${product.gradeLabel} — Graded Cards 01`;
    const description = `${product.name}, ${product.set}, #${product.cardNumber} — ${product.grade} ${product.gradeLabel}, ${formatPrice(product.price, product.currency)}.`;
    const imageUrl = `https://www.gradedcards01.com/${product.image}`;
    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:title"]', `${product.name} — Graded Cards 01`);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:image"]', imageUrl);
    setMetaContent('meta[property="og:url"]', `https://www.gradedcards01.com/product.html?id=${product.id}`);
    setMetaContent('meta[name="twitter:image"]', imageUrl);

    if (breadcrumb) {
      const categoryLabel =
        (product.tags || []).includes("eeveelution") ? "Eeveelutions" :
        (product.tags || []).includes("mega-evolution") ? "Mega Evolutions" :
        "Other Singles";
      breadcrumb.innerHTML = `<a href="index.html#shop">Shop</a> / <span>${categoryLabel}</span> / <span>${product.name}</span>`;
    }

    const media = document.getElementById("pdp-media");
    media.innerHTML = `<picture>
      <source srcset="${product.image.replace(/\.jpg$/, ".webp")}" type="image/webp">
      <img src="${product.image}" alt="${product.name} — ${product.grade} graded Pokémon card, front view" decoding="async">
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
    document.getElementById("pdp-product-price").textContent = formatPrice(product.price, product.currency);

    renderCartAction(document.getElementById("pdp-cart-action"), product);

    if (loaded) loaded.hidden = false;

    if (window.EPSAAnalytics) {
      window.EPSAAnalytics.trackEvent("view_item", { item_id: product.id, item_name: product.name, value: product.price });
    }
  }

  document.addEventListener("DOMContentLoaded", render);
})();
