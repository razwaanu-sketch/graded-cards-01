// Minimal JS for interactions, deferred for performance
(function(){
  // Year
  try{ document.getElementById('year').textContent = new Date().getFullYear(); }catch(e){}

  // Nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('nav-menu');
  if(toggle){
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      if(menu){
        if(expanded){ menu.style.display = ''; }
        else{ menu.style.display = 'flex'; menu.style.flexDirection = 'column'; }
      }
    });
  }

  // Smooth internal links
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', e=>{
      const href = a.getAttribute('href');
      if(href.length > 1){
        const el = document.querySelector(href);
        if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth', block:'start'});
          if(window.innerWidth < 780 && menu && toggle && toggle.getAttribute('aria-expanded') === 'true') toggle.click();
        }
      }
    });
  });

  // Reveal sections
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){ entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    });
  }, {root:null, rootMargin:'0px 0px -80px 0px', threshold: 0.12});
  document.querySelectorAll('.reveal-section').forEach(s => observer.observe(s));

  // Hero staggered fade-in
  window.addEventListener('load', ()=>{
    document.querySelectorAll('.hero-title, .hero-sub, .hero-ctas, .hero-card').forEach((el,i)=>{
      el.style.opacity = 0; el.style.transform = 'translateY(8px)';
      setTimeout(()=>{ el.style.transition = 'opacity .8s cubic-bezier(.2,.9,.2,1), transform .8s cubic-bezier(.2,.9,.2,1)'; el.style.opacity = 1; el.style.transform = 'none'; }, 200 + i*140);
    });
  });

  // Keyboard tab indicator
  document.addEventListener('keydown', (e) => { if(e.key === 'Tab') document.body.classList.add('user-is-tabbing'); });

  // Simple lazy image enhancement (already using loading=lazy)
  // Accessibility: ensure nav links focus
})();
