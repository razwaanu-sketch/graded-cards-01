// Powers account.html: sign up, log in, and order history.
//
// Backend: accounts-worker/, deployed as its own Cloudflare Workers Builds
// project (see ../ACCOUNTS-SETUP.md). This page is not yet linked from the
// site navigation while it's being tested end-to-end with the real Worker
// and Stripe flows — it's reachable only by direct URL until that's done.
(function () {
  const ACCOUNTS_API = "https://gradedcards01-accounts.gradedcards01.workers.dev";
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
  const accountTabsEl = document.querySelector(".account-tabs");
  const forgotLink = document.getElementById("forgot-password-link");
  const forgotForm = document.getElementById("forgot-password-form");
  const backToLoginLink = document.getElementById("back-to-login-link");
  const resetSectionEl = document.getElementById("reset-password-section");
  const resetForm = document.getElementById("reset-password-form");
  const noticeEl = document.getElementById("account-notice");
  const verifyBannerEl = document.getElementById("verify-banner");
  const resendBtn = document.getElementById("resend-verification-btn");
  const orderSectionEl = document.getElementById("order-section");
  let currentResetToken = "";

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

  function showNotice(message) {
    noticeEl.textContent = message;
    noticeEl.hidden = !message;
  }

  function showForgotPasswordForm() {
    accountTabsEl.hidden = true;
    loginForm.hidden = true;
    signupForm.hidden = true;
    forgotForm.hidden = false;
  }

  function showLoginTabs() {
    forgotForm.hidden = true;
    accountTabsEl.hidden = false;
    switchTab("login");
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
      const refundNote =
        order.refunded_amount > 0
          ? `<span class="order-row-refunded">Refunded ${formatAmount(order.refunded_amount, order.currency)}</span>`
          : "";
      const receiptLink = order.receipt_url
        ? `<a class="order-row-receipt" href="${order.receipt_url}" target="_blank" rel="noopener">Receipt</a>`
        : "";
      row.innerHTML = `
        <span class="order-row-name">${order.product_name}</span>
        <span class="order-row-date">${date}</span>
        <span class="order-row-status">${order.status}</span>
        <span class="order-row-amount">${formatAmount(order.amount, order.currency)}</span>
        ${refundNote}
        ${receiptLink}
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
    resetSectionEl.hidden = true;
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
      verifyBannerEl.hidden = !!data.email_verified;
      orderSectionEl.hidden = !data.email_verified;
      if (data.email_verified) renderOrders(data.orders || []);
      signedInEl.hidden = false;
      signedOutEl.hidden = true;
    } catch (e) {
      setToken(null);
      signedOutEl.hidden = false;
      signedInEl.hidden = true;
    }
  }

  async function handleVerifyAndResetParams() {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify");
    const resetToken = params.get("reset");

    if (verifyToken) {
      try {
        const res = await fetch(`${ACCOUNTS_API}/api/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: verifyToken }),
        });
        const data = await res.json();
        showNotice(res.ok ? "Your email is verified." : data.error || "That verification link is invalid or has expired.");
      } catch (e) {
        showNotice("Could not verify your email — please try again.");
      }
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (resetToken) {
      currentResetToken = resetToken;
      resetSectionEl.hidden = false;
      signedOutEl.hidden = true;
      signedInEl.hidden = true;
      window.history.replaceState({}, "", window.location.pathname);
      return true;
    }
    return false;
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

  forgotLink.addEventListener("click", () => {
    showNotice("");
    showForgotPasswordForm();
  });
  backToLoginLink.addEventListener("click", showLoginTabs);

  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(forgotForm, "");
    const email = document.getElementById("forgot-password-email").value;
    const btn = forgotForm.querySelector("button[type='submit']");
    btn.disabled = true;
    try {
      const res = await fetch(`${ACCOUNTS_API}/api/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      forgotForm.reset();
      showLoginTabs();
      showNotice(data.message || "If that email has an account, we've sent a password reset link.");
    } catch (err) {
      showError(forgotForm, "Something went wrong — please try again.");
    } finally {
      btn.disabled = false;
    }
  });

  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(resetForm, "");
    const password = document.getElementById("reset-password-new").value;
    const btn = resetForm.querySelector("button[type='submit']");
    btn.disabled = true;
    try {
      const res = await fetch(`${ACCOUNTS_API}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentResetToken, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reset password.");
      resetForm.reset();
      resetSectionEl.hidden = true;
      signedOutEl.hidden = false;
      showLoginTabs();
      showNotice("Password updated — please log in below.");
    } catch (err) {
      showError(resetForm, err.message);
    } finally {
      btn.disabled = false;
    }
  });

  resendBtn.addEventListener("click", async () => {
    const errEl = verifyBannerEl.querySelector(".account-error");
    errEl.hidden = true;
    resendBtn.disabled = true;
    resendBtn.textContent = "Sending…";
    try {
      const res = await fetch(`${ACCOUNTS_API}/api/resend-verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not resend email.");
      resendBtn.textContent = "Sent!";
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend verification email";
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    const showingReset = await handleVerifyAndResetParams();
    if (!showingReset) loadAccount();
  });
})();
