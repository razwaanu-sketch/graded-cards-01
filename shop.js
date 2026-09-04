// Renders the shop grid from products.js and wires up Buy Now / Sold state.
(function () {
  const grid = document.getElementById("shop-grid");
  if (!grid || typeof PRODUCTS === "undefined") return;

  const formatPrice = (amount, currency) => {
    try {
      return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
    } catch (e) {
      return `£${amount}`;
    }
  };

  PRODUCTS.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.setAttribute("role", "listitem");

    const media = document.createElement("div");
    media.className = "product-media";

    const img = document.createElement("img");
    img.src = product.image;
    img.alt = `${product.name} — ${product.grade} graded Pokémon card, front view`;
    img.loading = "lazy";
    img.addEventListener("error", () => {
      img.src = "images/cards/placeholder.svg";
    });
    media.appendChild(img);

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

    let action;
    if (product.sold) {
      action = document.createElement("span");
      action.className = "btn-outline btn-disabled";
      action.textContent = "Sold out";
    } else if (product.stripeLink) {
      action = document.createElement("a");
      action.className = "btn-gold";
      action.href = product.stripeLink;
      action.target = "_blank";
      action.rel = "noopener";
      action.textContent = "Buy now";
      action.setAttribute("aria-label", `Buy ${product.name} now`);
    } else {
      action = document.createElement("a");
      action.className = "btn-outline";
      action.href = "contact.html";
      action.textContent = "Contact to buy";
      action.setAttribute("aria-label", `Contact to buy ${product.name}`);
    }

    footer.appendChild(price);
    footer.appendChild(action);

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(cert);
    body.appendChild(footer);

    card.appendChild(media);
    card.appendChild(body);
    grid.appendChild(card);
  });
})();
