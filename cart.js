// Site-wide cart: stored in localStorage, shared across every page.
// Note: because this is a static site with no backend, checkout still pays
// for each cart item via its own Stripe Payment Link (see cart.html) rather
// than one combined payment — see SETUP.md for the upgrade path.
(function () {
  const CART_KEY = "epsa_cart_v1";

  function getCartIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function setCartIds(ids) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(ids));
    } catch (e) {
      // localStorage unavailable (private mode etc.) — cart just won't persist
    }
    updateBadge();
  }

  function addToCart(id) {
    const ids = getCartIds();
    if (!ids.includes(id)) ids.push(id);
    setCartIds(ids);
  }

  function removeFromCart(id) {
    setCartIds(getCartIds().filter((x) => x !== id));
  }

  function isInCart(id) {
    return getCartIds().includes(id);
  }

  function updateBadge() {
    const count = getCartIds().length;
    document.querySelectorAll(".cart-count").forEach((el) => {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  }

  function injectCartLink() {
    document.querySelectorAll(".nav-actions").forEach((container) => {
      if (container.querySelector(".cart-link")) return;
      const a = document.createElement("a");
      a.href = "cart.html";
      a.className = "cart-link";
      a.setAttribute("aria-label", "View cart");
      a.innerHTML =
        '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5H4.8L3.6 7v1.2h1.9l3.6 8.1-1.35 2.45c-.16.28-.25.6-.25.95 0 1.1.9 2 2 2h12.1v-1.8H9.7c-.14 0-.25-.11-.25-.25l.02-.12.85-1.53h7.53c.75 0 1.42-.41 1.76-1.04l3.4-6.5c.08-.15.12-.31.12-.48 0-.55-.45-1-1-1H7.35L6.4 4.5H7z"/><circle cx="9.5" cy="21" r="1.4" fill="currentColor"/><circle cx="18" cy="21" r="1.4" fill="currentColor"/></svg><span class="cart-count" hidden>0</span>';
      container.insertBefore(a, container.firstChild);
    });
    updateBadge();
  }

  window.EPSACart = { getCartIds, addToCart, removeFromCart, isInCart, updateBadge };

  document.addEventListener("DOMContentLoaded", injectCartLink);
})();
