/* Zeste — interactions et démarrage. */
function armed(el) {
  if (el.dataset.armed) return true;
  el.dataset.armed = '1';
  const label = el.textContent;
  el.textContent = 'Sûr ? Touche encore pour confirmer';
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.textContent = label; } }, 3000);
  return false;
}
const flash = sel => requestAnimationFrame(() => requestAnimationFrame(() => { const el = $(sel); if (el) el.classList.add('pop'); }));

const Acts = {
  /* navigation */
  home: (el, e) => go({ screen: 'home', pid: null, night: false, game: null }, ptOf(e)),
  open: (el, e) => go({ screen: 'party', pid: el.dataset.id, tab: 'qg', night: false, game: null }, ptOf(e)),
  new: () => { startWizard(); go({ screen: 'wizard' }); },
  tab: (el, e) => { Sheet.close(); if (el.dataset.tab !== R.tab) go({ tab: el.dataset.tab }, ptOf(e)); },
  night: (el, e) => { buzz(30); go({ night: true, game: null }, ptOf(e)); setTimeout(() => Confetti(innerWidth / 2, innerHeight * 0.3, 90), 450); },
  'night-exit': () => { clearTimers(); go({ night: false, game: null }); },
  'coach-ok': el => { const s = Store.lsGet('zeste:seen', {}); s[el.dataset.key] = 1; Store.lsSet('zeste:seen', s); $('#coach').classList.remove('on'); },
  'sheet-close': () => Sheet.close(),
  me: () => Sheet.open(`<h2 class="h2">Ton prénom</h2><form class="form" data-form="me"><input class="in" id="me-name" name="name" maxlength="24" value="${esc(me())}" placeholder="Ton prénom" autocomplete="given-name" data-focus><button class="btn world">Enregistrer</button></form>`),

  /* assistant */
  'wz-back': () => { if (W.i) { W.i--; go({}); } else go({ screen: 'home' }); },
  'wz-idea': el => { const i = $('#wz-name'); i.value = el.textContent; i.focus(); },
  'wz-theme': el => { W.theme = el.dataset.id; $$('.theme').forEach(b => b.classList.toggle('on', b === el)); buzz(10); },
  'wz-count': el => {
    W.count = Math.max(2, Math.min(200, W.count + +el.dataset.d * (W.count >= 30 ? 5 : 1)));
    const n = $('#wz-n'); n.textContent = W.count; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
    $('#wz-say').textContent = 'Vous serez combien, à peu près ? ' + countLine(W.count);
  },

  /* QG */
  task: el => { const p = cur(), t = { ...(p.tasks || {}) }; t[el.dataset.id] = !t[el.dataset.id]; Store.update('parties', p.id, { tasks: t }); buzz(10);
    if (TASKS.every(x => t[x.id])) { Confetti(); toast('Check-list bouclée. Tu es prêt !'); } },
  'party-edit': () => Sheet.open(partySheet(cur())),
  'party-del': el => {
    if (!armed(el)) return;
    const pid = R.pid;
    ['guests', 'items', 'photos'].forEach(c => Store.list(c, x => x.partyId === pid).forEach(x => Store.remove(c, x.id)));
    Store.remove('parties', pid);
    Sheet.close();
    go({ screen: 'home', pid: null });
  },

  /* invités */
  'guest-add': () => Sheet.open(guestSheet()),
  'guest-edit': el => Sheet.open(guestSheet(Store.get('guests', el.dataset.id))),
  'guest-cycle': (el, e) => {
    const g = Store.get('guests', el.dataset.id), next = { wait: 'yes', yes: 'maybe', maybe: 'no', no: 'wait' }[g.status];
    Store.update('guests', g.id, { status: next });
    buzz(10);
    flash(`.status[data-id="${g.id}"]`);
    if (next === 'yes') Confetti(e.clientX, e.clientY, 24);
  },
  'guest-del': el => { if (armed(el)) { Store.remove('guests', el.dataset.id); Sheet.close(); } },
  invite: () => Sheet.open(`<h2 class="h2">L’invitation</h2><p class="muted" style="font-weight:600">Copie ce texte et envoie-le dans ton groupe.</p><div class="invite" id="invite-text">${esc(inviteText(cur()))}</div><button class="btn world" data-act="invite-copy">${ico('copy')} Copier le texte</button>`),
  'invite-copy': async () => {
    if (!(await copyText(inviteText(cur())))) { const r = document.createRange(); r.selectNodeContents($('#invite-text')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  },

  /* courses */
  'item-add': () => Sheet.open(itemSheet(null, cur())),
  'item-edit': el => Sheet.open(itemSheet(Store.get('items', el.dataset.id), cur())),
  'item-del': el => { if (armed(el)) { Store.remove('items', el.dataset.id); Sheet.close(); } },
  'item-toggle': el => {
    const i = Store.get('items', el.dataset.id), on = !i.bought;
    Store.update('items', i.id, { bought: on, level: on ? 3 : null });
    buzz(10);
    flash(`.check[data-id="${i.id}"]`);
    const its = itemsOf(R.pid);
    if (on && its.every(x => x.bought)) { Confetti(); toast('Toutes les courses sont faites !'); }
  },
  'shop-mode': el => { R.shopMode = el.dataset.mode; render(false); },
  stock: el => {
    const i = Store.get('items', el.dataset.id), n = +el.dataset.lvl, cur = i.level == null ? 3 : i.level;
    const lvl = cur === n ? n - 1 : n;
    Store.update('items', i.id, { level: lvl });
    buzz(10);
    if (lvl === 0) toast(`${i.name} : à sec !`);
  },
  calc: () => {
    const p = cur(), gs = guestsOf(p.id), n = Math.max(headcount(gs) + gs.filter(g => g.status === 'maybe').length, p.count || 0) || 10;
    C = { n, hours: 5, thirst: 1, off: new Set() };
    Sheet.open(calcSheet());
  },
  'calc-step': el => { const k = el.dataset.k, lim = k === 'n' ? [2, 200] : [1, 12]; C[k] = Math.max(lim[0], Math.min(lim[1], C[k] + +el.dataset.d)); Sheet.set(calcSheet()); },
  'calc-thirst': el => { C.thirst = +el.dataset.i; Sheet.set(calcSheet()); },
  'calc-toggle': el => { const i = +el.dataset.i; C.off.has(i) ? C.off.delete(i) : C.off.add(i); Sheet.set(calcSheet()); },
  'calc-apply': () => {
    const its = itemsOf(R.pid);
    let added = 0, updated = 0;
    estimateShopping(C.n, C.hours, C.thirst).forEach((l, i) => {
      if (C.off.has(i)) return;
      const ex = its.find(x => norm(x.name) === norm(l.name));
      if (ex) { if (ex.qty !== l.qty) { Store.update('items', ex.id, { qty: l.qty }); updated++; } }
      else if (Store.add('items', { ...l, partyId: R.pid, bought: false, level: null, who: '', at: Date.now() + i })) added++;
    });
    Sheet.close();
    if (added || updated) { toast(`${added ? plural(added, 'article ajouté', 'articles ajoutés') : ''}${added && updated ? ', ' : ''}${updated ? plural(updated, 'quantité mise à jour', 'quantités mises à jour') : ''}`); Confetti(null, null, 40); }
    if (R.tab !== 'shop') go({ tab: 'shop' });
  },

  /* bar */
  'bar-filter': el => { R.barFilter = el.dataset.f; render(false); },
  'ck-open': el => { const ck = COCKTAILS.find(c => c.id === el.dataset.id); CK = { id: ck.id, serv: ck.batch || 1 }; Sheet.open(cocktailSheet()); },
  'ck-serv': el => { const ck = COCKTAILS.find(c => c.id === CK.id), st = ck.batch ? 5 : 1; CK.serv = Math.max(st, Math.min(60, CK.serv + +el.dataset.d * st)); Sheet.set(cocktailSheet()); },
  'ck-missing': () => {
    const ck = COCKTAILS.find(c => c.id === CK.id), miss = missingFor(ck, itemsOf(R.pid));
    miss.forEach((g, i) => Store.add('items', { partyId: R.pid, name: g.n, qty: 1, unit: '', cat: g.cat, price: 0, bought: false, level: null, who: '', at: Date.now() + i }));
    toast(`${plural(miss.length, 'ingrédient ajouté', 'ingrédients ajoutés')} aux courses`);
    Sheet.set(cocktailSheet());
  },
  'ck-fav': () => { const p = cur(), f = { ...(p.favs || {}) }; f[CK.id] = !f[CK.id]; Store.update('parties', p.id, { favs: f }); toast(f[CK.id] ? 'Ajouté à la carte du soir' : 'Retiré de la carte'); Sheet.set(cocktailSheet()); },
  shake: () => {
    const its = itemsOf(R.pid), ok = COCKTAILS.filter(c => !missingFor(c, its).length), ck = pick(ok.length ? ok : COCKTAILS);
    Sheet.open(`<div class="empty" style="padding:30px 0"><svg class="shaker" width="90" height="140" viewBox="0 0 90 140" aria-hidden="true"><path d="M20 46h50l-6 84a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6z" fill="var(--card2)" stroke="var(--fg)" stroke-width="4"/><path d="M24 46q0-24 21-24t21 24z" fill="var(--world)" stroke="var(--fg)" stroke-width="4"/><rect x="36" y="6" width="18" height="16" rx="4" fill="var(--card2)" stroke="var(--fg)" stroke-width="4"/></svg><p class="h2">Je secoue…</p></div>`);
    buzz([40, 60, 40, 60, 40]);
    setTimeout(() => { if ($('.shaker')) { CK = { id: ck.id, serv: ck.batch || 1 }; Sheet.set(cocktailSheet()); Confetti(null, innerHeight * 0.5, 40); } }, reduced() ? 100 : 1500);
  },

  /* galerie */
  'photo-add': () => { if (!Store.S.canWrite) return toast('Mode spectateur : seul l’organisateur peut ajouter des photos.'); $('#file-in').click(); },
  'photo-open': el => { LB.i = +el.dataset.i; LB.show = false; lbRender(true); },
  slideshow: () => { LB.i = 0; lbShow(true); },
  'lb-close': () => lbClose(),
  'lb-prev': () => { LB.i--; lbRender(true); },
  'lb-next': () => { LB.i++; lbRender(true); },
  'lb-show': () => lbShow(!LB.show),
  'lb-like': () => { const f = photosOf(R.pid)[LB.i], l = { ...(f.likes || {}) }; l[Store.S.uid] = !l[Store.S.uid]; Store.update('photos', f.id, { likes: l }); buzz(15); },
  'lb-del': el => { if (!armedIcon(el)) return; const f = photosOf(R.pid)[LB.i]; Store.remove('photos', f.id); },

  /* mode soirée */
  player: el => { const x = N.players[+el.dataset.i]; x.st = { on: 'sam', sam: 'off', off: 'on' }[x.st]; N.cursor = -1; render(false); },
  'player-add': () => Sheet.open(`<h2 class="h2">Nouveau joueur</h2><form class="form" data-form="player"><input class="in" id="pl-name" name="name" required maxlength="20" placeholder="Prénom" autocomplete="off" data-focus><button class="btn world">Ajouter</button></form>`),
  level: el => { N.level = +el.dataset.i; render(false); },
  game: el => { startGame(el.dataset.id); buzz(20); go({ game: el.dataset.id }); },
  'game-quit': () => { clearTimers(); go({ game: null }); },
  'g-next': (el, e) => GameActs.next(el, e),
  'g-tod': el => GameActs.tod(el),
  'g-spin': () => GameActs.spin(),
  'g-bomb': () => GameActs.bomb(),
};
function armedIcon(el) {
  if (el.dataset.armed) return true;
  el.dataset.armed = '1';
  el.classList.add('on');
  toast('Touche encore la corbeille pour supprimer');
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.classList.remove('on'); } }, 3000);
  return false;
}

const Forms = {
  wz(o) {
    const k = W.steps[W.i];
    if (k === 'me') { if (!o.me.trim()) return nudge('#wz-me'); Store.lsSet('zeste:name', o.me.trim()); }
    if (k === 'name') { if (!o.name.trim()) return nudge('#wz-name'); W.name = o.name.trim(); }
    if (k === 'when') { W.date = o.date; W.time = o.time; }
    if (k === 'where') W.place = o.place.trim();
    if (W.i < W.steps.length - 1) { W.i++; return go({}); }
    const id = Store.add('parties', { name: W.name, date: W.date, time: W.time, place: W.place, theme: W.theme, count: W.count, host: me(), tasks: {}, favs: {}, createdAt: Date.now() });
    if (!id) return go({ screen: 'home' });
    go({ screen: 'party', pid: id, tab: 'qg', night: false, game: null });
    setTimeout(() => { Confetti(null, null, 120); buzz([30, 40, 80]); }, 350);
  },
  me(o) { Store.lsSet('zeste:name', o.name.trim()); Sheet.close(); render(false); },
  guest(o, f, sub) {
    const d = { name: o.name.trim(), status: o.status, plus: +o.plus || 0, brings: o.brings.trim() };
    if (!d.name) return nudge('#g-name');
    if (f.dataset.id) Store.update('guests', f.dataset.id, d);
    else Store.add('guests', { ...d, partyId: R.pid, at: Date.now() });
    if (sub && sub.value === 'more') { toast(d.name + ' est sur la liste'); Sheet.set(guestSheet()); setTimeout(() => $('#g-name') && $('#g-name').focus(), 50); }
    else Sheet.close();
  },
  item(o, f) {
    const d = { name: o.name.trim(), qty: +o.qty || 0, unit: o.unit.trim(), cat: o.cat, price: +o.price || 0, who: o.who };
    if (!d.name) return nudge('#i-name');
    if (f.dataset.id) Store.update('items', f.dataset.id, d);
    else Store.add('items', { ...d, partyId: R.pid, bought: false, level: null, at: Date.now() });
    Sheet.close();
  },
  party(o) { Store.update('parties', R.pid, { name: o.name.trim() || cur().name, date: o.date, time: o.time, place: o.place.trim(), theme: o.theme }); Sheet.close(); },
  player(o) { const n = o.name.trim(); if (n) N.players.push({ n, st: 'on' }); Sheet.close(); render(false); },
};
function nudge(sel) { const el = $(sel); if (!el) return; el.focus(); el.style.animation = 'wiggle .15s 3'; setTimeout(() => (el.style.animation = ''), 500); }

document.addEventListener('click', e => {
  if (e.target.id === 'sheet-layer') return Sheet.close();
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = Acts[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, fn = Forms[f.dataset.form];
  if (fn) fn(Object.fromEntries(new FormData(f)), f, e.submitter);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#lightbox').hidden) lbClose(); else Sheet.close();
});

/* Ajout de photos. */
$('#file-in').addEventListener('change', async e => {
  const files = [...e.target.files].slice(0, 12), pid = R.pid;
  e.target.value = '';
  if (!files.length || !pid) return;
  toast(files.length > 1 ? `Je développe ${files.length} photos…` : 'Je développe la photo…');
  let ok = 0;
  for (const [i, file] of files.entries()) {
    try {
      const ph = await compressPhoto(file);
      if (Store.add('photos', { ...ph, partyId: pid, by: Store.S.uid, byName: me(), at: Date.now() + i, likes: {} })) ok++;
    } catch (err) { /* fichier illisible : on passe au suivant */ }
  }
  if (ok) { Confetti(null, null, 50); toast(plural(ok, 'photo ajoutée', 'photos ajoutées')); }
  else toast('Impossible de lire ces images. Essaie en JPEG ou PNG.');
});

/* Balayer dans la visionneuse. */
(() => {
  let x0 = null;
  const lb = $('#lightbox');
  lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) { LB.i += dx < 0 ? 1 : -1; lbRender(true); }
  });
})();

Store.onNotice(k => toast({ ro: 'Mode spectateur : seul l’organisateur peut modifier.', quota: 'Stockage plein : supprime des photos pour continuer.', err: 'Enregistrement impossible, réessaie dans un instant.' }[k]));

let booted = false;
Store.on(() => {
  if (!Store.S.ready) return;
  if (!booted) {
    booted = true;
    const saved = Store.lsGet('zeste:route', null);
    if (saved && saved.screen === 'party' && Store.get('parties', saved.pid)) R = { ...R, screen: 'party', pid: saved.pid, tab: saved.tab || 'qg' };
    document.documentElement.dataset.world = R.screen === 'party' ? TAB_WORLD[R.tab] : 'home';
    Store.watchPhotos(R.screen === 'party' ? R.pid : null);
    return render(true);
  }
  if (!$('#lightbox').hidden) lbRender(false);
  if (R.screen === 'wizard' || (R.night && R.game)) return;
  scheduleRender();
});
setInterval(tickCountdown, 1000);
Store.init();
