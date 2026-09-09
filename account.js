// Powers account.html: sign up, log in, and order history.
//
// NOT LIVE — ACCOUNTS_API is intentionally blank until the backend Worker
// (see accounts-worker/) is actually deployed. Until then this page just
// shows an "aren't switched on yet" notice, so it's harmless if it ever
// gets linked or found before the backend exists. See ACCOUNTS-SETUP.md.
(function () {
  const ACCOUNTS_API = "";
  const TOKEN_KEY = "epsa_auth_token";

  const unavailableEl = document.getElementById("account-unavailable");
  const signedOutEl = document.getElementById("account-signed-out");
  const signedInEl = document.getElementById("account-signed-in");
  if (!unavailableEl || !signedOutEl || !signedInEl) return;

  if (!ACCOUNTS_API) {
    unavailableEl.hidden = false;
    return;
  }

  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const emailEl = document.getElementById("account-email");
  const logoutBtn = document.getElementById("logout-btn");
  const orderListEl = document.getElementById("order-list");
  const orderEmptyEl = document.getElementById("order-empty");

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }
  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      // localStorage unavailable — session just won't persist across visits
    }
  }

  function formatAmount(amountMinor, currency) {
    try {
      return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amountMinor / 100);
    } catch (e) {
      return `${(amountMinor / 100).toFixed(2)} ${currency}`;
    }
  }

  function showError(form, message) {
    const el = form.querySelector(".account-error");
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
  }

  function switchTab(tab) {
    document.querySelectorAll(".account-tab").forEach((btn) => {
      const active = btn.getAttribute("data-tab") === tab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    loginForm.hidden = tab !== "login";
    signupForm.hidden = tab !== "signup";
  }

  function renderOrders(orders) {
    orderListEl.innerHTML = "";
    if (!orders.length) {
      orderEmptyEl.hidden = false;
      return;
    }
    orderEmptyEl.hidden = true;
    orders.forEach((order) => {
      const row = document.createElement("div");
      row.className = "order-row";
      const date = new Date(order.created_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      row.innerHTML = `
        <span class="order-row-name">${order.product_name}</span>
        <span class="order-row-date">${date}</span>
        <span class="order-row-status">${order.status}</span>
        <span class="order-row-amount">${formatAmount(order.amount, order.currency)}</span>
      `;

      const returnEl = document.createElement("div");
      returnEl.className = "order-return";
      if (order.return_status) {
        returnEl.innerHTML = `<span class="return-status-pill">Return: ${order.return_status}</span>`;
      } else {
        returnEl.innerHTML = `
          <button type="button" class="btn-ghost return-request-btn">Request a return</button>
          <form class="return-request-form" hidden>
            <textarea rows="2" placeholder="Reason for return" required maxlength="1000"></textarea>
            <button type="submit" class="btn-outline">Submit request</button>
            <p class="account-error" hidden></p>
          </form>
        `;
        const btn = returnEl.querySelector(".return-request-btn");
        const form = returnEl.querySelector(".return-request-form");
        btn.addEventListener("click", () => {
          btn.hidden = true;
          form.hidden = false;
        });
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          submitReturn(order.order_id, form);
        });
      }
      row.appendChild(returnEl);

      orderListEl.appendChild(row);
    });
  }

  async function submitReturn(orderId, form) {
    const reason = form.querySelector("textarea").value.trim();
    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    try {
      const res = await fetch(`${ACCOUNTS_API}/api/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ order_id: orderId, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit return request.");
      loadAccount();
    } catch (err) {
      showError(form, err.message);
      submitBtn.disabled = false;
    }
  }

  async function loadAccount() {
    const token = getToken();
    if (!token) {
      signedOutEl.hidden = false;
      signedInEl.hidden = true;
      return;
    }
    try {
      const res = await fetch(`${ACCOUNTS_API}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("session invalid");
      const data = await res.json();
      emailEl.textContent = data.email;
      renderOrders(data.orders || []);
      signedInEl.hidden = false;
      signedOutEl.hidden = true;
    } catch (e) {
      setToken(null);
      signedOutEl.hidden = false;
      signedInEl.hidden = true;
    }
  }

  document.querySelectorAll(".account-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(loginForm, "");
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
      const res = await fetch(`${ACCOUNTS_API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not log in.");
      setToken(data.token);
      loginForm.reset();
      loadAccount();
    } catch (err) {
      showError(loginForm, err.message);
    }
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(signupForm, "");
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    try {
      const res = await fetch(`${ACCOUNTS_API}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create account.");
      setToken(data.token);
      signupForm.reset();
      loadAccount();
    } catch (err) {
      showError(signupForm, err.message);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    const token = getToken();
    setToken(null);
    signedInEl.hidden = true;
    signedOutEl.hidden = false;
    switchTab("login");
    if (token) {
      fetch(`${ACCOUNTS_API}/api/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(
        () => {}
      );
    }
  });

  document.addEventListener("DOMContentLoaded", loadAccount);
})();
