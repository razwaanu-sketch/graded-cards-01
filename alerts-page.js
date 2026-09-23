// Drives the private new-card alerts page (alerts.html). Gated by the same
// shared admin key as visits.html and orders.html, and not linked from
// anywhere on the storefront.
(function () {
  const ACCOUNTS_API = "https://gradedcards01-accounts.gradedcards01.workers.dev";
  const KEY_STORAGE = "gc01_admin_key";

  const gate = document.getElementById("alerts-gate");
  const dash = document.getElementById("alerts-dash");
  const keyInput = document.getElementById("alerts-key-input");
  const unlockBtn = document.getElementById("alerts-unlock-btn");
  const errorEl = document.getElementById("alerts-error");
  const lockBtn = document.getElementById("alerts-lock-btn");
  const form = document.getElementById("alerts-form");
  const sendBtn = document.getElementById("alerts-send-btn");
  const result = document.getElementById("alerts-result");

  let confirmedCount = 0;

  function showGate(message) {
    dash.hidden = true;
    gate.hidden = false;
    errorEl.textContent = message || "";
    errorEl.hidden = !message;
  }

  function showResult(text, isError) {
    result.textContent = text;
    result.classList.toggle("notify-msg-error", !!isError);
    result.hidden = false;
  }

  async function loadCounts() {
    const key = localStorage.getItem(KEY_STORAGE) || "";
    try {
      const res = await fetch(`${ACCOUNTS_API}/api/admin/subscribers?key=${encodeURIComponent(key)}`);
      if (res.status === 403) {
        localStorage.removeItem(KEY_STORAGE);
        showGate("That key was rejected — try again.");
        return;
      }
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      confirmedCount = data.confirmed;
      document.getElementById("alerts-confirmed").textContent = data.confirmed;
      document.getElementById("alerts-pending").textContent = data.pending;
      sendBtn.textContent = `Send to ${data.confirmed} subscriber${data.confirmed === 1 ? "" : "s"}`;
      sendBtn.disabled = data.confirmed === 0;
    } catch (e) {
      showResult("Couldn't load subscriber numbers. Refresh to try again.", true);
    }
  }

  function showDash() {
    gate.hidden = true;
    dash.hidden = false;
    loadCounts();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const subject = document.getElementById("alerts-subject").value.trim();
    const message = document.getElementById("alerts-message").value.trim();
    if (!subject || !message) return;
    // Can't be unsent, so ask once before it goes out.
    if (!window.confirm(`Send "${subject}" to ${confirmedCount} subscriber${confirmedCount === 1 ? "" : "s"}?`)) return;

    sendBtn.disabled = true;
    result.hidden = true;
    try {
      const res = await fetch(`${ACCOUNTS_API}/api/admin/send-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: localStorage.getItem(KEY_STORAGE) || "", subject, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sending failed.");
      if (data.ok) {
        showResult(`Sent to ${data.sent} of ${data.total} subscriber${data.total === 1 ? "" : "s"}.`, false);
        form.reset();
      } else {
        showResult(`Sent to ${data.sent} of ${data.total}. Some failed: ${data.errors.join(" | ")}`, true);
      }
    } catch (err) {
      showResult(err.message || "Sending failed.", true);
    }
    sendBtn.disabled = false;
  });

  unlockBtn.addEventListener("click", () => {
    const key = (keyInput.value || "").trim();
    if (!key) return;
    localStorage.setItem(KEY_STORAGE, key);
    showDash();
  });
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") unlockBtn.click();
  });
  lockBtn.addEventListener("click", () => {
    localStorage.removeItem(KEY_STORAGE);
    showGate();
  });

  if (localStorage.getItem(KEY_STORAGE)) showDash();
  else showGate();
})();
