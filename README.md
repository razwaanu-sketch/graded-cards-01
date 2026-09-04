# graded-cards-01
A modern, responsive website for Pokémon Graded Cards

---

This branch (premium-redesign) contains a visual and performance-focused redesign: dark luxury theme, gold accents, full-screen hero with PSA 10 card, sticky transparent nav, polished product cards (glass effect), trust badges, accessibility improvements, and performance optimizations (lazy images, deferred JS, reduced motion support).

Testing checklist

1. Checkout the premium-redesign branch:
   git fetch origin
   git checkout premium-redesign

2. Open index.html in a static server (VS Code Live Server or python -m http.server) and review on mobile/desktop.

3. Manual tests:
   - Keyboard navigation (Tab through header, hero CTA, products)
   - Reduced motion (OS setting)
   - Mobile menu behavior and touch targets
   - Contact form submission and validation

4. Performance:
   - Check Lighthouse (Mobile & Desktop) and note improvements

Notes

- Images used are placeholder external URLs; replace them with optimized AVIF/WebP assets in the repo's public/images directory for best performance.
- I did not change product data or site structure; only presentation and client behavior were updated.
