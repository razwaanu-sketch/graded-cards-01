// Drives the private order dashboard (orders.html). Gated by the same
// shared admin key as visits.html (the ADMIN_KEY secret on the accounts
// Worker) — this page isn't linked from anywhere on the storefront and is
// only meant for the site owner.
(function () {
  const ACCOUNTS_API = "https://gradedcards01-accounts.gradedcards01.workers.dev";
  const KEY_STORAGE = "gc01_admin_key";

  const gate = document.getElementById("orders-gate");
  const dash = document.getElementById("orders-dash");
  const keyInput = document.getElementById("orders-key-input");
  const unlockBtn = document.getElementById("orders-unlock-btn");
  const errorEl = document.getElementById("orders-error");
  const lockBtn = document.getElementById("orders-lock-btn");
  const refreshBtn = document.getElementById("orders-refresh-btn");
  const list = document.getElementById("orders-list");
  const emptyEl = document.getElementById("orders-empty");

  function formatMoney(amount, currency) {
    try {
      return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount / 100);
    } catch (e) {
      return `${(amount / 100).toFixed(2)} ${currency}`;
    }
  }

  function showGate(message) {
    if (dash) dash.hidden = true;
    if (gate) gate.hidden = false;
    if (errorEl) {
      errorEl.textContent = message || "";
      errorEl.hidden = !message;
    }
  }

  function statusLabel(order) {
    if (order.status === "refunded") return "Refunded";
    if (order.status === "partially_refunded") return "Partially refunded";
    if (order.shipped_at) return "Shipped";
    return "Paid — not shipped";
  }

  function statusClass(order) {
    if (order.status === "refunded" || order.status === "partially_refunded") return "status-refunded";
    if (order.shipped_at) return "status-shipped";
    return "status-paid";
  }

  function renderOrders(orders) {
    list.innerHTML = "";
    if (!orders.length) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    orders.forEach((order) => {
      const row = document.createElement("div");
      row.className = "order-row";

      const top = document.createElement("div");
      top.className = "order-row-top";
      const left = document.createElement("span");
      left.textContent = `#${order.id} · ${order.customer_email} · ${order.created_at}`;
      const status = document.createElement("span");
      status.className = `order-row-status ${statusClass(order)}`;
      status.textContent = statusLabel(order);
      top.appendChild(left);
      top.appendChild(status);

      const product = document.createElement("div");
      product.className = "order-row-product";
      product.textContent = `${order.product_name} — ${formatMoney(order.amount, order.currency)}`;

      row.appendChild(top);
      row.appendChild(product);

      if (order.shipped_at) {
        const info = document.createElement("p");
        info.className = "order-tracking-info";
        info.textContent = order.carrier
          ? `Shipped ${order.shipped_at} — ${order.carrier} ${order.tracking_number}`
          : `Shipped ${order.shipped_at} — tracking ${order.tracking_number}`;
        row.appendChild(info);

        const photoInfo = document.createElement("p");
        photoInfo.className = order.dispatch_photo_taken ? "order-tracking-info" : "order-tracking-info order-photo-missing";
        photoInfo.textContent = order.dispatch_photo_taken ? "📷 Dispatch photo recorded" : "⚠ No dispatch photo recorded";
        row.appendChild(photoInfo);
      } else if (order.status !== "refunded" && order.status !== "partially_refunded") {
        const form = document.createElement("form");
        form.className = "ship-form";

        const carrierInput = document.createElement("input");
        carrierInput.type = "text";
        carrierInput.placeholder = "Carrier (optional)";

        const trackingInput = document.createElement("input");
        trackingInput.type = "text";
        trackingInput.placeholder = "Tracking number";
        trackingInput.required = true;

        const photoLabel = document.createElement("label");
        photoLabel.className = "ship-form-photo-check";
        const photoCheckbox = document.createElement("input");
        photoCheckbox.type = "checkbox";
        photoLabel.appendChild(photoCheckbox);
        photoLabel.appendChild(document.createTextNode("Photographed before boxing"));

        const submitBtn = document.createElement("button");
        submitBtn.type = "submit";
        submitBtn.className = "btn-outline";
        submitBtn.textContent = "Mark shipped";

        const note = document.createElement("p");
        note.className = "account-error";
        note.hidden = true;

        form.appendChild(carrierInput);
        form.appendChild(trackingInput);
        form.appendChild(photoLabel);
        form.appendChild(submitBtn);
        form.appendChild(note);

        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const trackingNumber = trackingInput.value.trim();
          if (!trackingNumber) return;
          submitBtn.disabled = true;
          note.hidden = true;
          try {
            const key = localStorage.getItem(KEY_STORAGE) || "";
            const res = await fetch(`${ACCOUNTS_API}/api/admin/ship-order`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key,
                order_id: order.id,
                tracking_number: trackingNumber,
                carrier: carrierInput.value.trim(),
                dispatch_photo_taken: photoCheckbox.checked,
              }),
            });
            if (!res.ok) throw new Error("request failed");
            const data = await res.json().catch(() => ({}));
            if (data.email_sent === false) {
              note.textContent = `Saved, but the email failed: ${data.email_error || "unknown error"}`;
              note.hidden = false;
              submitBtn.disabled = false;
              return;
            }
            await refresh();
          } catch (err) {
            note.textContent = "Couldn't save that — please try again.";
            note.hidden = false;
            submitBtn.disabled = false;
          }
        });

        row.appendChild(form);
      }

      list.appendChild(row);
    });
  }

  async function refresh() {
    const key = localStorage.getItem(KEY_STORAGE) || "";
    try {
      const res = await fetch(`${ACCOUNTS_API}/api/admin/orders?key=${encodeURIComponent(key)}`);
      if (res.status === 403) {
        localStorage.removeItem(KEY_STORAGE);
        showGate("That key was rejected — try again.");
        return;
      }
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      renderOrders(data.orders || []);
    } catch (e) {
      // Transient network hiccup — leave the last good list showing.
    }
  }

  function showDash() {
    if (gate) gate.hidden = true;
    if (dash) dash.hidden = false;
    refresh();
  }

  if (unlockBtn) {
    unlockBtn.addEventListener("click", () => {
      const key = (keyInput.value || "").trim();
      if (!key) return;
      localStorage.setItem(KEY_STORAGE, key);
      showDash();
    });
  }
  if (keyInput) {
    keyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") unlockBtn.click();
    });
  }
  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      localStorage.removeItem(KEY_STORAGE);
      showGate();
    });
  }
  if (refreshBtn) refreshBtn.addEventListener("click", refresh);

  if (localStorage.getItem(KEY_STORAGE)) showDash();
  else showGate();
})();
