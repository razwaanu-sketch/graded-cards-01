// Renders the cart.html page: line items, subtotal, and per-item payment links.
(function () {
  const listEl = document.getElementById("cart-list");
  const emptyEl = document.getElementById("cart-empty");
  const summaryEl = document.getElementById("cart-summary");
  const subtotalEl = document.getElementById("cart-subtotal");
  const invoiceLink = document.getElementById("combined-invoice-link");
  if (!listEl || typeof PRODUCTS === "undefined" || !window.EPSACart) return;

  const formatPrice = (amount, currency) => {
    try {
      return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
    } catch (e) {
      return `£${amount}`;
    }
  };

  function render() {
    const ids = window.EPSACart.getCartIds();
    const items = ids.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);
    listEl.innerHTML = "";

    if (items.length === 0) {
      emptyEl.hidden = false;
      summaryEl.hidden = true;
      return;
    }
    emptyEl.hidden = true;
    summaryEl.hidden = false;

    let subtotal = 0;
    items.forEach((product) => {
      subtotal += product.price;

      const row = document.createElement("div");
      row.className = "cart-row";

      const thumb = document.createElement("div");
      thumb.className = "cart-row-thumb";
      const img = document.createElement("img");
      img.src = product.image;
      img.alt = `${product.name} — ${product.grade}`;
      img.loading = "lazy";
      img.addEventListener("error", () => {
        img.src = "images/cards/placeholder.svg";
      });
      thumb.appendChild(img);

      const info = document.createElement("div");
      info.className = "cart-row-info";
      const title = document.createElement("p");
      title.className = "cart-row-title";
      title.textContent = product.name;
      const meta = document.createElement("p");
      meta.className = "cart-row-meta";
      meta.textContent = `${product.set} · #${product.cardNumber} · ${product.grade} ${product.gradeLabel}`;
      const price = document.createElement("p");
      price.className = "cart-row-price";
      price.textContent = formatPrice(product.price, product.currency);
      info.appendChild(title);
      info.appendChild(meta);
      info.appendChild(price);

      const actions = document.createElement("div");
      actions.className = "cart-row-actions";

      let payBtn;
      if (product.sold) {
        payBtn = document.createElement("span");
        payBtn.className = "btn-outline btn-disabled";
        payBtn.textContent = "Sold out";
      } else if (product.stripeLink) {
        payBtn = document.createElement("a");
        payBtn.className = "btn-gold";
        payBtn.href = product.stripeLink;
        payBtn.target = "_blank";
        payBtn.rel = "noopener";
        payBtn.textContent = "Pay for this card";
      } else {
        payBtn = document.createElement("a");
        payBtn.className = "btn-outline";
        payBtn.href = "contact.html";
        payBtn.textContent = "Contact to buy";
      }

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-ghost cart-remove-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        window.EPSACart.removeFromCart(product.id);
        render();
      });

      actions.appendChild(payBtn);
      actions.appendChild(removeBtn);

      row.appendChild(thumb);
      row.appendChild(info);
      row.appendChild(actions);
      listEl.appendChild(row);
    });

    subtotalEl.textContent = formatPrice(subtotal, "GBP");

    if (invoiceLink) {
      const list = items.map((p) => `${p.name} (${formatPrice(p.price, p.currency)})`).join(", ");
      const msg = `Hi, I'd like a combined invoice for these cards from my cart: ${list}. Subtotal: ${formatPrice(subtotal, "GBP")}.`;
      invoiceLink.href = `contact.html?prefill=${encodeURIComponent(msg)}`;
    }
  }

  document.addEventListener("DOMContentLoaded", render);
})();
