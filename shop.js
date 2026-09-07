// Renders the shop grid + category tiles from products.js, and wires up
// search, tag filtering, Add to Cart, and Sold state.
(function () {
  const grid = document.getElementById("shop-grid");
  const tilesEl = document.getElementById("category-tiles");
  if ((!grid && !tilesEl) || typeof PRODUCTS === "undefined") return;

  const formatPrice = (amount, currency) => {
    try {
      return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
    } catch (e) {
      return `£${amount}`;
    }
  };

  let activeTag = "";
  let activeQuery = "";

  function cardMatches(product) {
    const matchesTag = !activeTag || (product.tags || []).includes(activeTag);
    const q = activeQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      product.name.toLowerCase().includes(q) ||
      product.set.toLowerCase().includes(q) ||
      product.cardNumber.toLowerCase().includes(q);
    return matchesTag && matchesQuery;
  }

  function renderCartAction(footer, product) {
    if (product.sold) {
      const span = document.createElement("span");
      span.className = "btn-outline btn-disabled";
      span.textContent = "Sold out";
      footer.appendChild(span);
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    const inCart = window.EPSACart && window.EPSACart.isInCart(product.id);
    btn.className = inCart ? "btn-outline cart-toggle in-cart" : "btn-gold cart-toggle";
    btn.textContent = inCart ? "In cart ✓" : "Add to cart";
    btn.setAttribute("aria-label", `${inCart ? "Remove" : "Add"} ${product.name} ${inCart ? "from" : "to"} cart`);
    btn.addEventListener("click", () => {
      if (!window.EPSACart) return;
      if (window.EPSACart.isInCart(product.id)) {
        window.EPSACart.removeFromCart(product.id);
        btn.className = "btn-gold cart-toggle";
        btn.textContent = "Add to cart";
      } else {
        window.EPSACart.addToCart(product.id);
        btn.className = "btn-outline cart-toggle in-cart";
        btn.textContent = "In cart ✓";
      }
    });
    footer.appendChild(btn);
  }

  function renderCard(product) {
    const card = document.createElement("article");
    card.className = "product-card";
    card.setAttribute("role", "listitem");

    const media = document.createElement("div");
    media.className = "product-media";
    // Built as one innerHTML assignment (not createElement/appendChild) so the
    // browser's <picture> source-selection sees the <source> before the <img>
    // starts loading — appending an already-src'd <img> into <picture> after
    // the fact causes some browsers to fetch both the source and the img src.
    media.innerHTML = `<picture>
      <source srcset="${product.image.replace(/\.jpg$/, ".webp")}" type="image/webp">
      <img src="${product.image}" alt="${product.name} — ${product.grade} graded Pokémon card, front view" loading="lazy">
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

    const body = document.createElement("div");
    body.className = "product-body";

    const title = document.createElement("h3");
    title.className = "product-title";
    title.textContent = product.name;

    const meta = document.createElement("p");
    meta.className = "product-meta";
    meta.textContent = `${product.set} · #${product.cardNumber}`;

    const cert = document.createElement("p");
    cert.className = "product-cert";
    cert.textContent = `PSA cert #${product.certNumber}`;

    const footer = document.createElement("div");
    footer.className = "product-footer";

    const price = document.createElement("span");
    price.className = "price";
    price.textContent = formatPrice(product.price, product.currency);
    footer.appendChild(price);
    renderCartAction(footer, product);

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(cert);
    body.appendChild(footer);

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  function renderGrid() {
    if (!grid) return;
    grid.innerHTML = "";
    const filtered = PRODUCTS.filter(cardMatches);

    const countEl = document.getElementById("shop-count");
    if (countEl) {
      countEl.textContent = `Showing ${filtered.length} of ${PRODUCTS.length} card${PRODUCTS.length === 1 ? "" : "s"}`;
    }

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "shop-empty";
      empty.textContent = "No cards match your search — try a different name, set, or clear the filter.";
      grid.appendChild(empty);
      return;
    }

    filtered.forEach((p) => grid.appendChild(renderCard(p)));
  }

  function setFilter(tag, query) {
    if (typeof tag === "string") activeTag = tag;
    if (typeof query === "string") activeQuery = query;
    renderGrid();

    document.querySelectorAll("[data-tag]").forEach((el) => {
      el.classList.toggle("active", (el.getAttribute("data-tag") || "") === activeTag);
    });
    document.querySelectorAll(".shop-search-input, .hero-search-input").forEach((el) => {
      if (document.activeElement !== el) el.value = activeQuery;
    });

    const shopSection = document.getElementById("shop");
    if (shopSection) shopSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  window.EPSAShop = { setFilter };

  function renderTiles() {
    if (!tilesEl || typeof CATEGORIES === "undefined") return;
    tilesEl.innerHTML = "";
    CATEGORIES.forEach((cat, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-tile";
      btn.setAttribute("data-tag", cat.tag);
      btn.innerHTML = `
        <span class="category-tile-num">${String(i + 1).padStart(2, "0")}</span>
        <span class="category-tile-thumb"><picture><source srcset="${cat.image.replace(/\.jpg$/, ".webp")}" type="image/webp"><img src="${cat.image}" alt="" loading="lazy"></picture></span>
        <span class="category-tile-text">
          <span class="category-tile-label">${cat.label}</span>
          <span class="category-tile-sub">${cat.sub}</span>
        </span>
        <span class="category-tile-arrow" aria-hidden="true">→</span>
      `;
      btn.querySelector("img").addEventListener("error", (e) => {
        e.target.src = "images/cards/placeholder.svg";
      });
      btn.addEventListener("click", () => setFilter(cat.tag, ""));
      tilesEl.appendChild(btn);
    });
  }

  // Wire search inputs (hero + in-shop toolbar) and tag chip buttons.
  document.addEventListener("DOMContentLoaded", () => {
    renderTiles();
    renderGrid();

    document.querySelectorAll(".hero-search-form, .shop-search-form").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = form.querySelector("input[type='search']");
        setFilter(activeTag, input ? input.value : "");
      });
    });

    document.querySelectorAll(".tag-chip[data-tag], [data-tag].shop-filter-btn").forEach((el) => {
      el.addEventListener("click", () => setFilter(el.getAttribute("data-tag") || "", ""));
    });
  });
})();
