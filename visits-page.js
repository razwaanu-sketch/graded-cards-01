// Drives the private traffic dashboard (visits.html). Gated by a shared
// admin key (the ADMIN_KEY secret on the accounts Worker) rather than a
// full login system — this page isn't linked from anywhere on the
// storefront and is only meant for the site owner. The key is kept in
// localStorage after first entry so it doesn't need retyping each visit.
(function () {
  const ACCOUNTS_API = "https://gradedcards01-accounts.gradedcards01.workers.dev";
  const KEY_STORAGE = "gc01_admin_key";
  const REFRESH_MS = 5000;

  const gate = document.getElementById("visits-gate");
  const dash = document.getElementById("visits-dash");
  const keyInput = document.getElementById("visits-key-input");
  const unlockBtn = document.getElementById("visits-unlock-btn");
  const errorEl = document.getElementById("visits-error");
  const lockBtn = document.getElementById("visits-lock-btn");

  let timer = null;

  function formatRelative(sqliteTimestamp) {
    // D1's datetime('now') stores UTC without a "Z" suffix — append it so
    // Date parses it as UTC instead of local time.
    const then = new Date(sqliteTimestamp.replace(" ", "T") + "Z").getTime();
    const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  function showGate(message) {
    if (timer) clearInterval(timer);
    timer = null;
    if (dash) dash.hidden = true;
    if (gate) gate.hidden = false;
    if (errorEl) {
      errorEl.textContent = message || "";
      errorEl.hidden = !message;
    }
  }

  async function refresh() {
    const key = localStorage.getItem(KEY_STORAGE) || "";
    try {
      const res = await fetch(`${ACCOUNTS_API}/api/visit-stats?key=${encodeURIComponent(key)}`);
      if (res.status === 403) {
        localStorage.removeItem(KEY_STORAGE);
        showGate("That key was rejected — try again.");
        return;
      }
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();

      document.getElementById("stat-total").textContent = data.total;
      document.getElementById("stat-today").textContent = data.today;
      document.getElementById("stat-hour").textContent = data.last_hour;
      document.getElementById("stat-5min").textContent = data.last_5_min;

      const list = document.getElementById("visits-recent-list");
      if (list) {
        list.innerHTML = "";
        (data.recent || []).forEach((row) => {
          const div = document.createElement("div");
          div.className = "visits-recent-row";
          const path = document.createElement("span");
          path.textContent = row.path;
          const time = document.createElement("span");
          time.textContent = formatRelative(row.created_at);
          div.appendChild(path);
          div.appendChild(time);
          list.appendChild(div);
        });
      }
    } catch (e) {
      // Transient network hiccup — keep showing the last good numbers and
      // just try again on the next tick rather than kicking back to the gate.
    }
  }

  function showDash() {
    if (gate) gate.hidden = true;
    if (dash) dash.hidden = false;
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, REFRESH_MS);
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

  if (localStorage.getItem(KEY_STORAGE)) showDash();
  else showGate();
})();
