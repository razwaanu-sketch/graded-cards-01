// "New cards added" alerts: the signup form (any .notify-form on the page)
// and, on notify.html, the confirm/unsubscribe step that emailed links
// point to. Those links only open this page; the change itself needs a
// button click, so email scanners that prefetch links can't trigger it.
(function () {
  const ACCOUNTS_API = "https://gradedcards01-accounts.gradedcards01.workers.dev";

  function showMessage(el, text, isError) {
    el.textContent = text;
    el.classList.toggle("notify-msg-error", !!isError);
    el.hidden = false;
  }

  document.querySelectorAll(".notify-form").forEach((form) => {
    const input = form.querySelector("input[type='email']");
    const button = form.querySelector("button[type='submit']");
    const msg = form.parentElement.querySelector(".notify-msg");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      button.disabled = true;
      try {
        const res = await fetch(`${ACCOUNTS_API}/api/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: input.value.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
        form.hidden = true;
        showMessage(msg, "Nearly done: check your inbox and click the link to confirm your alerts.", false);
      } catch (err) {
        showMessage(msg, err.message || "Something went wrong. Please try again.", true);
        button.disabled = false;
      }
    });
  });

  // notify.html?action=confirm|unsubscribe&token=...
  const actionPanel = document.getElementById("notify-action");
  if (!actionPanel) return;
  const params = new URLSearchParams(location.search);
  const action = params.get("action");
  const token = params.get("token");
  if ((action !== "confirm" && action !== "unsubscribe") || !token) return;

  const signupPanel = document.getElementById("notify-signup");
  if (signupPanel) signupPanel.hidden = true;
  actionPanel.hidden = false;

  const title = document.getElementById("notify-action-title");
  const btn = document.getElementById("notify-action-btn");
  const msg = document.getElementById("notify-action-msg");
  const isConfirm = action === "confirm";
  title.textContent = isConfirm ? "Confirm your new-card alerts" : "Unsubscribe from new-card alerts";
  btn.textContent = isConfirm ? "Confirm my alerts" : "Unsubscribe";

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const res = await fetch(`${ACCOUNTS_API}/api/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      btn.hidden = true;
      showMessage(
        msg,
        isConfirm
          ? "You're on the list. We'll email you when new cards are added."
          : "You've been unsubscribed and your email has been removed from our list.",
        false
      );
    } catch (err) {
      showMessage(msg, err.message || "Something went wrong. Please try again.", true);
      btn.disabled = false;
    }
  });
})();
