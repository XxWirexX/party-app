/* Zeste — noyau d'interface : utilitaires, icônes, Limo, verres, feuilles, toasts, confettis. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const plural = (n, one, many) => n + ' ' + (n > 1 ? many || one + 's' : one);
const euro = n => n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* pas de vibreur */ } };
const hue = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const initials = s => String(s).trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

const ICONS = {
  qg: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  guests: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6M16 4.5a3.5 3.5 0 0 1 0 6.6M18 14.3c2 .8 3.5 2.9 3.5 5.7',
  shop: 'M5 8h14l-1.2 11a1 1 0 0 1-1 1H7.2a1 1 0 0 1-1-1zM9 8V6a3 3 0 0 1 6 0v2',
  bar: 'M4 5h16l-8 9zM12 14v6M8 20h8M15 5l2-3',
  gallery: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 16l4.5-4.5 4 4 2.5-2.5 5 5M15.5 9.5h.01',
  back: 'M15 5l-7 7 7 7', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', check: 'M5 12.5l4.5 4.5L19 7.5',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', edit: 'M4 20l1-4L16 5l3 3L8 19z', play: 'M8 5l11 7-11 7z',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z', copy: 'M9 9h10v11H9zM5 15V4h10',
  disco: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 2v3M4 13h16M6 9h12M6 17h12M12 5v16',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
};
const ico = (n, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

/* Limo, le citron vert. mood : happy | wow | wink | cool | sad ; hat : chapeau de fête. */
function limo(mood = 'happy', size = 96, hat = false) {
  const ink = 'var(--ink)';
  const eye = (x, closed) => closed
    ? `<path d="M${x - 6} 59q6 -6 12 0" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`
    : `<g class="eye"><circle cx="${x}" cy="58" r="5.5" fill="${ink}"/><circle cx="${x + 1.8}" cy="56" r="1.8" fill="var(--white)"/></g>`;
  const mouths = {
    happy: `<path d="M47 71q13 14 26 0z" fill="${ink}"/><path d="M53 76q7 5 14 0" fill="none" stroke="var(--w-pink)" stroke-width="3" stroke-linecap="round"/>`,
    wow: `<ellipse cx="60" cy="76" rx="6.5" ry="8" fill="${ink}"/>`,
    wink: `<path d="M48 72q12 10 24 0" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`,
    cool: `<path d="M49 73q11 8 23 -2" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`,
    sad: `<path d="M49 78q11 -9 22 0" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`,
  };
  const eyes = mood === 'cool'
    ? `<path d="M34 52h52v8a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10 2 2 0 0 0-4 0 10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10z" fill="${ink}"/><path d="M40 56l8 0M66 56l8 0" stroke="var(--white)" stroke-width="2.5" stroke-linecap="round"/>`
    : eye(46, false) + eye(74, mood === 'wink');
  const party = hat ? `<path d="M44 22L62 -6 78 24z" fill="var(--w-pink)" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="62" cy="-7" r="5" fill="var(--w-sun)" stroke="${ink}" stroke-width="3"/>` : '';
  return `<svg class="limo" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="Limo">
    <ellipse class="shadow" cx="60" cy="114" rx="30" ry="5" fill="${ink}" opacity=".22"/>
    <g class="body">
      <path d="M22 70q-12 2 -14 14" fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round"/>
      <path class="arm-r" d="M98 66q12 -4 14 -18" fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M48 104v8h-7M72 104v8h7" fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="60" cy="64" r="44" fill="var(--lime)" stroke="${ink}" stroke-width="4"/>
      <circle cx="60" cy="64" r="35" fill="var(--lime-flesh)"/>
      <path d="M60 29v70M25 64h70M35 39l50 50M85 39l-50 50" stroke="var(--lime-seg)" stroke-width="3" stroke-linecap="round" fill="none"/>
      <circle cx="60" cy="64" r="22" fill="var(--lime-flesh)"/>
      <circle cx="38" cy="70" r="5" fill="var(--w-pink)" opacity=".8"/><circle cx="82" cy="70" r="5" fill="var(--w-pink)" opacity=".8"/>
      ${eyes}${mouths[mood] || mouths.happy}${party}
    </g></svg>`;
}
const limoSay = (text, mood, size = 92, extra = '') =>
  `<div class="limo-say">${limo(mood, size)}<div class="bubble"><span>${text}</span>${extra}</div></div>`;

/* Verres dessinés : la forme sert aussi de masque au liquide. */
let glassN = 0;
const GLASSES = {
  highball: { d: 'M22 12H58L54 90H26Z', top: 22 },
  tumbler: { d: 'M17 38H63L58 90H22Z', top: 46 },
  coupe: { d: 'M10 16H70L43 52V84L57 90H23L37 84V52Z', top: 22, cut: 54 },
  wine: { d: 'M21 10Q15 58 37 62V84L25 90H55L43 84V62Q65 58 59 10Z', top: 24, cut: 62 },
  pitcher: { d: 'M14 16H58L55 90H18Z', top: 28, handle: 'M57 30Q76 32 74 50Q72 66 56 66' },
};
function glassSVG(ck, size = 84) {
  const g = GLASSES[ck.glass] || GLASSES.highball, id = 'gl' + (++glassN);
  const bottom = g.cut || 90;
  const garnish = ck.garnish === 'lime'
    ? `<circle cx="60" cy="${g.top - 10}" r="9" fill="var(--lime-flesh)" stroke="var(--lime)" stroke-width="3.5"/>`
    : ck.garnish === 'orange' ? `<circle cx="60" cy="${g.top - 10}" r="9" fill="#FFD9A0" stroke="var(--w-orange)" stroke-width="3.5"/>` : '';
  return `<svg class="glass" width="${size * 0.8}" height="${size}" viewBox="0 0 80 100" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="${g.d}"/></clipPath>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ck.c[0]}"/><stop offset="1" stop-color="${ck.c[1]}"/></linearGradient></defs>
    ${g.handle ? `<path d="${g.handle}" fill="none" stroke="var(--fg)" stroke-width="3.5" stroke-linecap="round"/>` : ''}
    <path d="${g.d}" fill="var(--card2)"/>
    <g clip-path="url(#${id})"><rect class="liq" x="0" y="${g.top}" width="80" height="${bottom - g.top}" fill="url(#${id}g)"/>
      <rect x="30" y="${g.top + 6}" width="11" height="11" rx="2.5" fill="var(--white)" opacity=".55" transform="rotate(14 35 ${g.top + 11})"/>
      <rect x="42" y="${g.top + 16}" width="10" height="10" rx="2.5" fill="var(--white)" opacity=".4" transform="rotate(-12 47 ${g.top + 21})"/></g>
    <path d="${g.d}" fill="none" stroke="var(--fg)" stroke-width="3.5" stroke-linejoin="round"/>${garnish}</svg>`;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3100);
}

const Sheet = {
  open(html) {
    const L = $('#sheet-layer');
    $('#sheet-body').innerHTML = html;
    $('#sheet').scrollTop = 0;
    $('#sheet').style.transform = '';
    L.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => L.classList.add('open')));
    const f = $('#sheet-body [data-focus]');
    if (f) setTimeout(() => f.focus(), 420);
  },
  set(html) { $('#sheet-body').innerHTML = html; },
  close() {
    const L = $('#sheet-layer');
    if (L.hidden) return;
    L.classList.remove('open');
    $('#sheet').style.transform = '';
    setTimeout(() => { if (!L.classList.contains('open')) L.hidden = true; }, 320);
  },
};
/* Tirer la poignée vers le bas ferme la feuille. */
(() => {
  let y0 = null;
  document.addEventListener('touchstart', e => { if (e.target.closest('.sheet-handle')) y0 = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (y0 == null) return;
    const dy = Math.max(0, e.touches[0].clientY - y0);
    $('#sheet').style.transition = 'none';
    $('#sheet').style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0;
    y0 = null;
    $('#sheet').style.transition = '';
    if (dy > 90) Sheet.close(); else $('#sheet').style.transform = '';
  });
})();

/* Confettis sur canvas. */
const Confetti = (() => {
  let parts = [], raf = null, cv, ctx;
  const colors = ['#FFD43B', '#FF9BD2', '#6FE3A5', '#FF9248', '#7CC4FF', '#A77BFF', '#8BDD3C'];
  function frame() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => p.life > 0 && p.y < cv.height + 40);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(frame) : null;
    if (!raf) ctx.clearRect(0, 0, cv.width, cv.height);
  }
  return function burst(x, y, n = 70) {
    if (reduced()) return;
    cv = $('#fx'); ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    x = (x == null ? innerWidth / 2 : x) * dpr; y = (y == null ? innerHeight * 0.35 : y) * dpr;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (4 + Math.random() * 9) * dpr;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6 * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        w: (6 + Math.random() * 8) * dpr, h: (4 + Math.random() * 5) * dpr, c: pick(colors), life: 90 + Math.random() * 50 });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  };
})();

/* Texte de bulle tapé lettre par lettre. */
function typeInto(el, text) {
  if (!el) return;
  if (reduced()) { el.textContent = text; return; }
  el.textContent = '';
  let i = 0;
  const id = setInterval(() => {
    if (!el.isConnected) return clearInterval(id);
    i += 2;
    el.textContent = text.slice(0, i);
    if (i >= text.length) clearInterval(id);
  }, 22);
}

/* Limo explique chaque section la première fois qu'on y passe. */
function coach(key) {
  const seen = Store.lsGet('zeste:seen', {});
  const el = $('#coach');
  if (seen[key] || !COACH[key]) { el.classList.remove('on'); return; }
  el.classList.toggle('low', key === 'night');
  el.innerHTML = `${limo('wink', 78)}<div class="bubble"><span></span><button class="btn sm world" data-act="coach-ok" data-key="${key}">Compris</button></div>`;
  setTimeout(() => { el.classList.add('on'); typeInto($('span', el), COACH[key]); }, 500);
}

/* Change de « monde » : la nouvelle couleur inonde l'écran depuis le point touché. */
const WORLD_VAR = { home: '--w-sun', guests: '--w-pink', shop: '--w-mint', bar: '--w-orange', gallery: '--w-sky' };
function setWorld(w, pt) {
  const root = document.documentElement, cur = root.dataset.world || 'home';
  if (cur === w) return;
  const mode = getComputedStyle(root).getPropertyValue('--mode').trim();
  const apply = () => { root.dataset.world = w; };
  const toNight = w === 'night', fromNight = cur === 'night';
  const flood = toNight ? '#12071F' : (mode === 'light' || (fromNight && !matchDark())) ? `var(${WORLD_VAR[w]})` : null;
  const wipe = $('#wipe');
  if (!flood || reduced() || !pt || fromNight) { apply(); return; }
  wipe.classList.remove('go');
  wipe.style.background = flood;
  wipe.style.setProperty('--x', pt.x + 'px');
  wipe.style.setProperty('--y', pt.y + 'px');
  void wipe.offsetWidth;
  wipe.classList.add('go');
  setTimeout(() => { apply(); wipe.classList.remove('go'); }, 430);
}
function matchDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copié dans le presse-papiers'); return true; }
  catch (e) { toast('Copie impossible ici : sélectionne le texte à la main'); return false; }
}

/* Réduit une photo pour qu'elle tienne dans un document de la base (256 Kio max). */
function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
async function compressPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    let max = 1280, q = 0.78, out, w, h;
    for (let i = 0; i < 6; i++) {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      w = Math.round(img.naturalWidth * s); h = Math.round(img.naturalHeight * s);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      out = c.toDataURL('image/jpeg', q);
      if (out.length < 185000) break;
      max = Math.round(max * 0.8); q = Math.max(0.5, q - 0.07);
    }
    return { src: out, w, h };
  } finally { URL.revokeObjectURL(url); }
}
