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
      a.innerHTML = 'Cart <span class="cart-count" hidden>0</span>';
      container.insertBefore(a, container.firstChild);
    });
    updateBadge();
  }

  window.EPSACart = { getCartIds, addToCart, removeFromCart, isInCart, updateBadge };

  document.addEventListener("DOMContentLoaded", injectCartLink);
})();
