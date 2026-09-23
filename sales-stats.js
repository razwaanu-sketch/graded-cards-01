// Small, honest social-proof line on the shop section — how many cards
// have actually sold, sourced from real order data. Stays hidden if there
// are zero sales yet, or if the request fails, rather than showing a
// hollow "0 sold" (see /api/public-stats in accounts-worker/worker.js).
(function () {
  const ACCOUNTS_API = "https://gradedcards01-accounts.gradedcards01.workers.dev";
  const el = document.getElementById("sales-stat");
  if (!el) return;

  function formatRelative(sqliteTimestamp) {
    // D1's datetime('now') stores UTC without a "Z" suffix — append it so
    // Date parses it as UTC instead of local time.
    const then = new Date(sqliteTimestamp.replace(" ", "T") + "Z").getTime();
    const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  fetch(`${ACCOUNTS_API}/api/public-stats`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || !data.sold_count) return;
      const plural = data.sold_count === 1 ? "card sold" : "cards sold";
      let text = `${data.sold_count} ${plural} to date`;
      if (data.last_sale_at) text += ` · last sale ${formatRelative(data.last_sale_at)}`;
      el.textContent = text;
      el.hidden = false;
    })
    .catch(() => {});
})();
