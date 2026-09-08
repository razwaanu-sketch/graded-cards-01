// Renders the cart.html page: line items, subtotal, and per-item payment links.
(function () {
  // Set this to your deployed Cloudflare Worker URL (see checkout-worker/worker.js
  // and SETUP.md) to enable a single combined Stripe checkout for the whole cart.
  // Left blank, the page falls back to the existing "request a combined invoice" flow.
  const CHECKOUT_ENDPOINT = "https://graded-cards-01.gradedcards01.workers.dev";

  const listEl = document.getElementById("cart-list");
  const emptyEl = document.getElementById("cart-empty");
  const summaryEl = document.getElementById("cart-summary");
  const subtotalEl = document.getElementById("cart-subtotal");
  const invoiceLink = document.getElementById("combined-invoice-link");
  const invoiceNote = document.getElementById("combined-invoice-note");
  const checkoutBtn = document.getElementById("combined-checkout-btn");
  const checkoutStatus = document.getElementById("combined-checkout-status");
  const resultEl = document.getElementById("checkout-result");
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
      // See shop.js for why this is one innerHTML assignment rather than
      // createElement/appendChild (avoids double-fetching source + img src).
      thumb.innerHTML = `<picture>
        <source srcset="${product.image.replace(/\.jpg$/, ".webp")}" type="image/webp">
        <img src="${product.image}" alt="${product.name} — ${product.grade}" loading="lazy">
      </picture>`;
      const img = thumb.querySelector("img");
      img.addEventListener("error", () => {
        img.src = "images/cards/placeholder.svg";
      });

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
        payBtn.addEventListener("click", () => {
          if (window.EPSAAnalytics) {
            window.EPSAAnalytics.trackEvent("begin_checkout", { item_id: product.id, item_name: product.name, value: product.price });
          }
        });
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
        if (window.EPSAAnalytics) {
          window.EPSAAnalytics.trackEvent("remove_from_cart", { item_id: product.id, item_name: product.name, value: product.price });
        }
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

    if (CHECKOUT_ENDPOINT && checkoutBtn) {
      const anySold = items.some((p) => p.sold);
      checkoutBtn.hidden = anySold;
      if (invoiceNote) invoiceNote.hidden = !anySold;
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = "Pay for everything (1 checkout)";
      checkoutBtn.onclick = () => startCombinedCheckout(ids);
    } else if (checkoutBtn) {
      checkoutBtn.hidden = true;
    }
  }

  async function startCombinedCheckout(ids) {
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Redirecting to secure checkout…";
    checkoutStatus.hidden = true;
    try {
      const res = await fetch(CHECKOUT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Something went wrong starting checkout.");
      }
      if (window.EPSAAnalytics) {
        window.EPSAAnalytics.trackEvent("begin_checkout", { items: ids.length, checkout_type: "combined" });
      }
      window.location.href = data.url;
    } catch (err) {
      checkoutStatus.hidden = false;
      checkoutStatus.textContent = err.message || "Could not start checkout — please try again, or use the individual payment links above.";
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = "Pay for everything (1 checkout)";
    }
  }

  function handleCheckoutReturn() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("checkout");
    if (!status || !resultEl) return;

    if (status === "success") {
      const ids = window.EPSACart.getCartIds();
      const items = ids.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);

      // Only the combined-checkout flow (via CHECKOUT_ENDPOINT) returns here
      // with ?checkout=success — a single "Pay for this card" Stripe Payment
      // Link redirects to Stripe's own confirmation page instead, so a
      // purchase from that flow currently won't fire this event. See
      // GA4-SETUP.md for the trade-off.
      if (window.EPSAAnalytics && items.length) {
        const sessionId = params.get("session_id");
        window.EPSAAnalytics.trackEvent("purchase", {
          transaction_id: sessionId || `local-${Date.now()}`,
          value: items.reduce((sum, p) => sum + p.price, 0),
          currency: items[0].currency || "GBP",
          items: items.map((p) => ({ item_id: p.id, item_name: p.name, price: p.price })),
        });
      }

      ids.forEach((id) => window.EPSACart.removeFromCart(id));
      resultEl.hidden = false;
      resultEl.classList.add("checkout-result-success");
      resultEl.textContent = "Payment received — thank you! We'll email you tracking details once your order ships.";
    } else if (status === "cancelled") {
      resultEl.hidden = false;
      resultEl.classList.add("checkout-result-cancelled");
      resultEl.textContent = "Checkout was cancelled — your cart is still saved below.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    handleCheckoutReturn();
    render();

    const items = window.EPSACart.getCartIds().map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);
    if (window.EPSAAnalytics && items.length) {
      window.EPSAAnalytics.trackEvent("view_cart", {
        value: items.reduce((sum, p) => sum + p.price, 0),
        currency: items[0].currency || "GBP",
        items: items.map((p) => ({ item_id: p.id, item_name: p.name, price: p.price })),
      });
    }
  });
})();
