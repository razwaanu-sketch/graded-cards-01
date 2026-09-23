// Minimal JS for interactions, deferred for performance
(function(){
  // Year
  try{
    const year = document.getElementById('year');
    if(year) year.textContent = new Date().getFullYear();
  }catch(e){}

  // Header search toggle
  const searchToggle = document.getElementById('nav-search-toggle');
  const searchBar = document.getElementById('nav-search-bar');
  if(searchToggle && searchBar){
    searchToggle.addEventListener('click', () => {
      const open = searchToggle.getAttribute('aria-expanded') === 'true';
      searchToggle.setAttribute('aria-expanded', String(!open));
      searchBar.hidden = open;
      if(!open){
        const input = searchBar.querySelector('input[type="search"]');
        if(input) input.focus();
      }
    });
  }

  // Menu drawer
  const menuToggle = document.getElementById('nav-menu-toggle');
  const drawer = document.getElementById('nav-drawer');
  const drawerOverlay = document.getElementById('nav-drawer-overlay');
  const drawerClose = document.getElementById('nav-drawer-close');
  function openDrawer(){
    if(!drawer || !drawerOverlay) return;
    drawer.classList.add('is-open');
    drawerOverlay.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    if(menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-open');
  }
  function closeDrawer(){
    if(!drawer || !drawerOverlay) return;
    drawer.classList.remove('is-open');
    drawerOverlay.hidden = true;
    drawer.setAttribute('aria-hidden', 'true');
    if(menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
  }
  if(menuToggle) menuToggle.addEventListener('click', () => {
    if(drawer && drawer.classList.contains('is-open')) closeDrawer(); else openDrawer();
  });
  if(drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if(drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);
  if(drawer) drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', closeDrawer));
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeDrawer(); });

  // Smooth internal links
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', e=>{
      const href = a.getAttribute('href');
      if(href.length > 1){
        const el = document.querySelector(href);
        if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth', block:'start'}); }
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
    document.querySelectorAll('.hero-title, .hero-sub, .hero-showcase').forEach((el,i)=>{
      el.style.opacity = 0; el.style.transform = 'translateY(8px)';
      setTimeout(()=>{ el.style.transition = 'opacity .8s cubic-bezier(.2,.9,.2,1), transform .8s cubic-bezier(.2,.9,.2,1)'; el.style.opacity = 1; el.style.transform = 'none'; }, 200 + i*140);
    });
  });

  // Keyboard tab indicator
  document.addEventListener('keydown', (e) => { if(e.key === 'Tab') document.body.classList.add('user-is-tabbing'); });
})();
