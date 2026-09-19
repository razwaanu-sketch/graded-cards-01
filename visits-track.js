// Anonymous page-visit beacon for the site owner's private traffic
// dashboard (visits.html, not linked anywhere on the storefront). Records
// only the page path and a timestamp — no cookies, no PII. Best-effort:
// failures are swallowed so a slow/unreachable endpoint never affects the
// page for visitors.
(function () {
  var ACCOUNTS_API = "https://gradedcards01-accounts.gradedcards01.workers.dev";
  try {
    fetch(ACCOUNTS_API + "/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: location.pathname }),
      keepalive: true,
    }).catch(function () {});
  } catch (e) {}
})();
