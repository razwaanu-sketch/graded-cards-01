// Cloudflare Worker: creates ONE Stripe Checkout Session covering every card
// in a buyer's cart, instead of a separate Payment Link per card.
//
// Deploy: paste this file into a new Worker at https://dash.cloudflare.com
// (Workers & Pages -> Create -> Worker -> paste, replacing the sample code),
// then set STRIPE_SECRET_KEY under Settings -> Variables and Secrets as an
// encrypted secret (never put the key directly in this file). Full steps in
// SETUP.md.
//
// Why the price data is re-fetched from products.js on every request rather
// than hardcoded here: it's the single source of truth the storefront
// already uses, so a price/sold-status change on the site is picked up here
// automatically with nothing to keep in sync, and a buyer can never spoof a
// lower price by editing the request body — only an id is trusted from the
// client.
const SITE_ORIGIN = "https://www.gradedcards01.com";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": SITE_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

async function loadCatalog() {
  const res = await fetch(`${SITE_ORIGIN}/products.js?t=${Date.now()}`);
  const text = await res.text();
  const match = text.match(/const PRODUCTS = (\[[\s\S]*?\]);/);
  if (!match) throw new Error("Could not parse products.js");
  return new Function(`return ${match[1]}`)();
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    let ids;
    try {
      const body = await request.json();
      ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : [];
    } catch (e) {
      return jsonResponse({ error: "Bad request" }, 400);
    }
    if (ids.length === 0) {
      return jsonResponse({ error: "Cart is empty" }, 400);
    }

    let catalog;
    try {
      catalog = await loadCatalog();
    } catch (e) {
      return jsonResponse({ error: "Could not load catalog" }, 502);
    }

    const items = ids.map((id) => catalog.find((p) => p.id === id)).filter(Boolean);
    if (items.length === 0) {
      return jsonResponse({ error: "No valid items in cart" }, 400);
    }
    const soldOut = items.filter((p) => p.sold);
    if (soldOut.length > 0) {
      return jsonResponse({ error: `Sold out, please remove: ${soldOut.map((p) => p.name).join(", ")}` }, 409);
    }

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${SITE_ORIGIN}/cart.html?checkout=success`);
    params.set("cancel_url", `${SITE_ORIGIN}/cart.html?checkout=cancelled`);
    params.append("shipping_address_collection[allowed_countries][]", "GB");

    items.forEach((p, i) => {
      params.set(`line_items[${i}][quantity]`, "1");
      params.set(`line_items[${i}][price_data][currency]`, (p.currency || "GBP").toLowerCase());
      params.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(p.price * 100)));
      params.set(`line_items[${i}][price_data][product_data][name]`, p.name);
      params.set(
        `line_items[${i}][price_data][product_data][description]`,
        `${p.set} - #${p.cardNumber} - PSA cert #${p.certNumber}`
      );
      params.set(`line_items[${i}][price_data][product_data][images][0]`, `${SITE_ORIGIN}/${p.image}`);
    });

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      return jsonResponse({ error: session.error && session.error.message ? session.error.message : "Stripe error" }, 502);
    }

    return jsonResponse({ url: session.url });
  },
};
