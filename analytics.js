// Google Analytics (GA4), loaded only after cookie consent — see privacy.html.
// Consent choice is remembered in localStorage so the banner only shows once.
(function () {
  const GA_MEASUREMENT_ID = "G-WGG2PJMTFW";
  const CONSENT_KEY = "epsa_cookie_consent";

  function loadGA() {
    if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID === "G-XXXXXXXXXX") return;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", GA_MEASUREMENT_ID);
  }

  function trackEvent(name, params) {
    if (typeof window.gtag === "function") window.gtag("event", name, params || {});
  }
  window.EPSAAnalytics = { trackEvent };

  function getConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch (e) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (e) {
      // localStorage unavailable — banner will just reappear next visit
    }
  }

  function showBanner() {
    const banner = document.createElement("div");
    banner.className = "cookie-banner";
    banner.innerHTML = `
      <p>We use cookies to understand site traffic via Google Analytics. See our
        <a href="privacy.html">Privacy Policy</a>.</p>
      <div class="cookie-banner-actions">
        <button type="button" class="btn-outline" data-choice="declined">Decline</button>
        <button type="button" class="btn-gold" data-choice="accepted">Accept</button>
      </div>
    `;
    document.body.appendChild(banner);

    banner.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const choice = btn.getAttribute("data-choice");
        setConsent(choice);
        banner.remove();
        if (choice === "accepted") loadGA();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const consent = getConsent();
    if (consent === "accepted") loadGA();
    else if (consent !== "declined") showBanner();
  });
})();
