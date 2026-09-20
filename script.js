// Minimal JS for interactions, deferred for performance
(function(){
  // Year
  try{
    const year = document.getElementById('year');
    if(year) year.textContent = new Date().getFullYear();
  }catch(e){}

  // Mobile navigation. The menu must be taken out of the nav flex row when it
  // opens; otherwise each link becomes another item in the header and pushes
  // the logo, cart, and CTA into the page (especially on narrow screens).
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('nav-menu');
  const navInner = toggle && toggle.closest('.nav-inner');

  if(toggle && menu){
    const mobileNavStyles = document.createElement('style');
    mobileNavStyles.textContent = `
      @media (max-width: 779px) {
        .nav-inner { position: relative; }
        .nav-menu.nav-menu-open {
          display: flex;
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          width: 100%;
          flex-direction: column;
          align-items: stretch;
          gap: 0;
          padding: 8px 18px 18px;
          background: var(--bg-deep);
          border-bottom: 1px solid var(--line-soft);
          box-shadow: 0 14px 24px rgba(0, 0, 0, .28);
          z-index: 10;
        }
        .nav-menu.nav-menu-open li a {
          display: block;
          padding: 12px 0;
          border-top: 1px solid var(--line-soft);
        }
      }
    `;
    document.head.appendChild(mobileNavStyles);

    const closeMenu = () => {
      toggle.setAttribute('aria-expanded', 'false');
      menu.classList.remove('nav-menu-open');
    };

    toggle.addEventListener('click', () => {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      if(isOpen) closeMenu();
      else {
        if(navInner) navInner.style.position = 'relative';
        toggle.setAttribute('aria-expanded', 'true');
        menu.classList.add('nav-menu-open');
      }
    });

    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', event => {
      if(event.key === 'Escape') closeMenu();
    });
    window.addEventListener('resize', () => {
      if(window.innerWidth >= 780) closeMenu();
    });
  }

  // Smooth internal links
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', e=>{
      const href = a.getAttribute('href');
      if(href.length > 1){
        const el = document.querySelector(href);
        if(el){
          e.preventDefault();
          el.scrollIntoView({behavior:'smooth', block:'start'});
          if(window.innerWidth < 780 && toggle && toggle.getAttribute('aria-expanded') === 'true') toggle.click();
        }
      }
    });
  });

  // Reveal sections. threshold:0 fires as soon as any part enters view — a
  // percentage-based threshold can never be met by a section taller than the
  // viewport (e.g. the shop grid), leaving it permanently invisible.
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){ entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    });
  }, {root:null, rootMargin:'0px 0px -40px 0px', threshold: 0});
  document.querySelectorAll('.reveal-section').forEach(s => observer.observe(s));

  // Hero staggered fade-in
  window.addEventListener('load', ()=>{
    document.querySelectorAll('.hero-title, .hero-sub, .hero-search-wrap').forEach((el,i)=>{
      el.style.opacity = 0; el.style.transform = 'translateY(8px)';
      setTimeout(()=>{ el.style.transition = 'opacity .8s cubic-bezier(.2,.9,.2,1), transform .8s cubic-bezier(.2,.9,.2,1)'; el.style.opacity = 1; el.style.transform = 'none'; }, 200 + i*140);
    });
  });

  // Keyboard tab indicator
  document.addEventListener('keydown', (e) => { if(e.key === 'Tab') document.body.classList.add('user-is-tabbing'); });
})();
