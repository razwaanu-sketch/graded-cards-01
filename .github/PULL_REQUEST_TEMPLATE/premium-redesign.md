### Premium Redesign PR

This PR implements the premium dark luxury redesign, performance improvements, accessibility enhancements, and optimized interactions while preserving the site's content and structure.

#### Summary of changes
- Visual: dark luxury palette, gold accents, Inter + Space Grotesk fonts, hero PSA‑10 card, sticky transparent nav, glass-effect product cards, trust badges, and refined typography.
- Performance: lazy images, deferred JS, reveal-on-scroll via IntersectionObserver, minimized repaints.
- Accessibility: skip link, keyboard focus styles, prefers‑reduced‑motion support, semantic landmarks, and ARIA attributes where appropriate.
- No changes made to product data or page structure.

#### Files changed
- index.html — updated hero, meta tags, JSON-LD, semantic improvements
- style.css — full visual and responsive refactor
- script.js — refactored interactions and lazy-init behavior
- README.md — testing instructions and PR notes

#### Testing checklist
1. Open index.html locally (Live Server or python -m http.server)
2. Verify: hero, nav, product cards, trust badges, and footer
3. Keyboard navigation & reduced motion
4. Lighthouse audit (mobile & desktop)

---

Please review and merge when ready. If you'd like screenshots added to the PR description I can attach them in a follow-up commit.
