const qs  = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => [...el.querySelectorAll(s)];

const cards       = qsa('.card');
const page        = qs('#page');
const hero        = qs('.page-hero');
const pageHeroImg = qs('#pageHeroImg');
const pageTitle   = qs('#pageTitle');
const pageDesc    = qs('#pageDesc');
const backBtn     = qs('#backBtn');
const ghostLayer  = qs('#ghostLayer');

let busy = false;
let lastCard = null;

/* ---------- helpers ---------- */
const pxSnap = (r)=>{
  const f = (n)=> Math.round(n * devicePixelRatio)/devicePixelRatio;
  return { left:f(r.left), top:f(r.top), width:f(r.width), height:f(r.height) };
};
const deltas = (from, to)=>{
  const sx = to.width / from.width, sy = to.height / from.height;
  const dx = to.left - from.left,   dy = to.top  - from.top;
  return { sx:+sx.toFixed(4), sy:+sy.toFixed(4), dx:+dx.toFixed(3), dy:+dy.toFixed(3) };
};
async function ensureDecoded(img){
  if (!img.complete || img.naturalWidth === 0) {
    await new Promise(res => img.addEventListener('load', res, {once:true}));
  }
  if ('decode' in img) { try { await img.decode(); } catch {} }
}
function lockInteractions(lock){
  document.body.classList.toggle('is-animating', !!lock);
  document.documentElement.style.overflow = lock ? 'hidden' : '';
}

/* Logo fallback */
(function(){
  const img = qs('#peerlistLogo'), fallback = qs('#peerlistLogoFallback');
  if (!img) return;
  img.addEventListener('error', ()=>{ img.style.display='none'; fallback.style.display='block'; }, {once:true});
})();

/* Theme toggle */
qs('#themeToggle').addEventListener('click', ()=>{
  document.documentElement.classList.toggle('light');
});

/* Populate page content from a card */
function populateFromCard(card){
  const img = qs('.card-media img', card);
  pageHeroImg.src = img.currentSrc || img.src;      // exact same bitmap
  pageTitle.textContent = qs('h3', card).textContent.trim();
  pageDesc.textContent  = qs('p', card).textContent.trim();
}

/* Progressive upgrade to high-res AFTER transition (optional) */
async function upgradeHeroAfter(v){
  // If you ever want to swap to a higher-res silently after the motion:
  // const hi = v.dataset.hires; if (!hi) return;
  // if (hi && hi !== pageHeroImg.src) {
  //   const tmp = new Image(); tmp.src = hi; await ensureDecoded(tmp);
  //   const oldSrc = pageHeroImg.src; pageHeroImg.src = hi;
  // }
}

/* Event bindings */
cards.forEach(card => card.addEventListener('click', ()=> openFromCard(card)));
backBtn.addEventListener('click', ()=> closeToCard());

/* ---------- OPEN ---------- */
async function openFromCard(card){
  if (busy) return; busy = true; lockInteractions(true); lastCard = card;

  const media = qs('.card-media', card);
  const mediaImg = qs('img', media);

  // Match bitmap on both ends and decode BEFORE any animation
  populateFromCard(card);
  await ensureDecoded(mediaImg);
  await ensureDecoded(pageHeroImg);

  const canVT = 'startViewTransition' in document && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (canVT){
    // Use View Transition with a shared element name
    const vtName = `vt-${card.dataset.id}-${Date.now()}`;
    media.classList.add('vt-source'); hero.classList.add('vt-target');
    media.style.viewTransitionName = vtName; hero.style.viewTransitionName = vtName;

    await document.startViewTransition(()=>{
      page.classList.add('active');
      page.removeAttribute('aria-hidden');
    }).finished.catch(()=>{});

    // Cleanup
    media.style.viewTransitionName = 'none'; hero.style.viewTransitionName = 'none';
    media.classList.remove('vt-source');     hero.classList.remove('vt-target');

    await upgradeHeroAfter(card);
    lockInteractions(false); busy = false;
    return;
  }

  // Fallback FLIP (no overlap, no mid-swap)
  await openFLIP(card, media);
}

async function openFLIP(card, media){
  const from = pxSnap(card.getBoundingClientRect());
  page.classList.add('active'); page.style.opacity = 0; // fade later
  const to = pxSnap(hero.getBoundingClientRect());

  // Hide source media to avoid seeing two during motion
  media.classList.add('hidden-during-anim');

  const ghostMedia = media.cloneNode(true); // exact clone (so it looks identical)
  const shell = document.createElement('div');
  shell.className = 'ghost';
  Object.assign(shell.style, {
    left: from.left + 'px', top: from.top + 'px',
    width: from.width + 'px', height: from.height + 'px'
  });
  shell.appendChild(ghostMedia);
  ghostLayer.appendChild(shell);

  const {dx,dy,sx,sy} = deltas(from, to);

  const fade = page.animate([{opacity:0},{opacity:1}], {duration:220, delay:120, easing:'linear'});
  fade.pause();

  const anim = shell.animate([
    { transform:'translate3d(0,0,0) scale(1,1)' },
    { transform:`translate3d(${dx}px,${dy}px,0) scale(${sx},${sy})` }
  ], { duration: 520, easing: 'cubic-bezier(.22,.72,.16,1)' });

  setTimeout(()=>fade.play(), 80);

  anim.onfinish = async ()=>{
    shell.remove();
    page.style.opacity = 1;
    media.classList.remove('hidden-during-anim');
    await upgradeHeroAfter(card);
    lockInteractions(false); busy = false;
  };
}

/* ---------- CLOSE ---------- */
async function closeToCard(){
  if (!page.classList.contains('active')) return;
  if (busy) return; busy = true; lockInteractions(true);

  const card = lastCard;
  const media = card ? qs('.card-media', card) : null;
  if (media){ const img = qs('img', media); await ensureDecoded(img); }

  const canVT = 'startViewTransition' in document && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (canVT && card){
    const vtName = `vt-${card.dataset.id}-${Date.now()}`;
    media.classList.add('vt-source'); hero.classList.add('vt-target');
    media.style.viewTransitionName = vtName; hero.style.viewTransitionName = vtName;

    await document.startViewTransition(()=>{
      page.classList.remove('active');
      page.setAttribute('aria-hidden','true');
    }).finished.catch(()=>{});

    media.style.viewTransitionName = 'none'; hero.style.viewTransitionName = 'none';
    media.classList.remove('vt-source');     hero.classList.remove('vt-target');

    lockInteractions(false); busy = false;
    return;
  }

  await closeFLIP(card, media);
}

async function closeFLIP(card, media){
  const from = pxSnap(hero.getBoundingClientRect());
  const to   = pxSnap(card.getBoundingClientRect());

  // Hide hero to avoid overlap
  hero.classList.add('hidden-during-anim');

  const ghostMedia = qs('.card-media', card).cloneNode(true);
  const shell = document.createElement('div');
  shell.className = 'ghost';
  Object.assign(shell.style, {
    left: from.left + 'px', top: from.top + 'px',
    width: from.width + 'px', height: from.height + 'px'
  });
  shell.appendChild(ghostMedia);
  ghostLayer.appendChild(shell);

  const {dx,dy,sx,sy} = deltas(from, to);

  const fade = page.animate([{opacity:1},{opacity:0}], {duration:180, easing:'linear'});
  fade.addEventListener('finish', ()=>{
    page.classList.remove('active');
    page.setAttribute('aria-hidden','true');
  });

  const anim = shell.animate([
    { transform:'translate3d(0,0,0) scale(1,1)' },
    { transform:`translate3d(${dx}px,${dy}px,0) scale(${sx},${sy})` }
  ], { duration: 500, easing: 'cubic-bezier(.22,.72,.16,1)' });

  anim.addEventListener('finish', ()=>{
    shell.remove();
    hero.classList.remove('hidden-during-anim');
    lockInteractions(false); busy = false;
  });
}

/* Share */
qs('#shareBtn').addEventListener('click', async ()=>{
  const url = location.href;
  try{
    if(navigator.share){
      await navigator.share({title: document.title, text: 'Card → Page (Polished Minimal)', url});
    }else{
      await navigator.clipboard.writeText(url);
      toast('Link copied ✨');
    }
  }catch{ toast('Could not share'); }
});

/* Tiny toast */
function toast(msg){
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `
    position:fixed; left:50%; bottom:20px; transform:translateX(-50%);
    background:rgba(0,0,0,.7); color:#fff; padding:8px 12px; border-radius:999px;
    border:1px solid rgba(0,0,0,.1); z-index:9999; font-weight:600;
  `;
  document.body.appendChild(el);
  setTimeout(()=> el.animate([{opacity:1},{opacity:0, transform:'translateX(-50%) translateY(6px)'}], {duration:340, easing:'ease'}).onfinish = ()=> el.remove(), 900);
}
