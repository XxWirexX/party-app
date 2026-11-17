/* Zeste — interactions et démarrage. */
function armed(el, label) {
  if (el.dataset.armed) return true;
  el.dataset.armed = '1';
  const old = el.innerHTML;
  el.textContent = label || 'Sûr ? Touche encore pour confirmer';
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.innerHTML = old; } }, 3000);
  return false;
}
function armedIcon(el) {
  if (el.dataset.armed) return true;
  el.dataset.armed = '1';
  el.classList.add('on');
  toast('Touche encore la corbeille pour supprimer');
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.classList.remove('on'); } }, 3000);
  return false;
}
const flash = sel => requestAnimationFrame(() => requestAnimationFrame(() => { const el = $(sel); if (el) el.classList.add('pop'); }));
const num = v => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
const now = () => new Date().toISOString();
const ITEM_DEFAULTS = () => ({ bought: false, level: null, paid_by: null, paid_amount: null, note: '', assignee: null, created_at: now() });

function qrSVG(text) {
  try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) { return ''; }
}
function selectText(el) {
  if (!el) return;
  const r = document.createRange(); r.selectNodeContents(el);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
async function copyOrSelect(text, el) { if (!(await copyText(text))) selectText(el); }

/* Ajoute des lignes à la liste de courses ; une ligne au nom déjà présent met à jour la quantité. */
function addItems(lines, { merge = false } = {}) {
  const its = P().items, fresh = [];
  let updated = 0;
  for (const l of lines) {
    const ex = merge && its.find(x => norm(x.name) === norm(l.name));
    if (ex) { if (ex.qty !== l.qty) { Store.update('items', ex.id, { qty: l.qty }); updated++; } continue; }
    fresh.push({ id: Store.uuid(), name: l.name, qty: l.qty, unit: l.unit || '', cat: l.cat || 'divers', price: l.price || 0, note: l.note || '' });
  }
  if (fresh.length) Store.mutate(B => fresh.forEach(f => B.items.push({ ...ITEM_DEFAULTS(), ...f })), 'POST', Store.base() + '/items/bulk', { items: fresh });
  return { added: fresh.length, updated };
}

const Acts = {
  /* navigation */
  home: (el, e) => go({ screen: 'home', pid: null, night: false, game: null }, ptOf(e)),
  open: (el, e) => go({ screen: 'party', pid: el.dataset.id, tab: 'qg', night: false, game: null }, ptOf(e)),
  new: () => { startWizard(); go({ screen: 'wizard' }); },
  tab: (el, e) => { Sheet.close(); if (el.dataset.tab && el.dataset.tab !== R.tab) go({ tab: el.dataset.tab }, ptOf(e)); },
  night: (el, e) => { buzz(30); go({ night: true, game: null }, ptOf(e)); setTimeout(() => Confetti(innerWidth / 2, innerHeight * 0.3, 90), 450); },
  'night-exit': () => { clearTimers(); go({ night: false, game: null }); },
  'coach-ok': el => { const s = lsGet('zeste:seen', {}); s[el.dataset.key] = 1; lsSet('zeste:seen', s); $('#coach').classList.remove('on'); },
  'sheet-close': () => Sheet.close(),

  /* compte */
  me: () => Sheet.open(`<h2 class="h2">Ton compte</h2><form class="form" data-form="me"><label class="f">Prénom<input class="in" id="me-name" name="name" maxlength="24" required value="${esc(me())}" autocomplete="given-name"></label><button class="btn world">Enregistrer</button></form>
    <p class="eyebrow">Autre appareil</p><p class="muted" style="font-weight:600">Pas de mot de passe : ouvre ce lien à usage unique sur ton autre téléphone ou ordinateur pour y retrouver tes soirées.</p>
    <button class="btn alt" data-act="link-device">${ico('copy')} Créer le lien</button>`),
  'link-device': async () => {
    let r;
    try { r = await Store.api('POST', '/api/me/link-code'); } catch (e) { return toast(e.message); }
    const link = `${location.origin}/l/${r.code}`;
    Sheet.set(`<h2 class="h2">Ouvre-le sur l’autre appareil</h2><p class="muted" style="font-weight:600">Valable 15 minutes, une seule fois. Ne l’envoie qu’à toi-même : il ouvre ton compte.</p>
      <div class="qr">${qrSVG(link)}</div><div class="invite" id="device-link">${esc(link)}</div><button class="btn world" data-act="copy-device">${ico('copy')} Copier le lien</button>`);
    $('#device-link').dataset.link = link;
  },
  'copy-device': () => copyOrSelect($('#device-link').dataset.link, $('#device-link')),
  'link-claim': async () => {
    try { const u = await Store.api('POST', '/api/session/claim', { code: R.code }); toast('Content de te revoir, ' + u.name + ' !'); }
    catch (e) { toast(e.message); }
    await Store.init();
    go({ screen: 'home', code: null }, null, { replace: true });
  },

  /* invitation */
  'join-claim': el => { J.claim = el.dataset.id || null; render(false); },

  /* assistant */
  'wz-back': () => { if (W.i) { W.i--; go({}); } else go({ screen: 'home' }); },
  'wz-idea': el => { const i = $('#wz-name'); i.value = el.textContent; i.focus(); },
  'wz-theme': el => { W.theme = el.dataset.id; $$('.theme').forEach(b => b.classList.toggle('on', b === el)); buzz(10); },
  'wz-access': el => { W.access = el.dataset.id; $$('.choice').forEach(b => b.classList.toggle('on', b === el)); buzz(10); },
  'wz-count': el => {
    W.count = Math.max(2, Math.min(200, W.count + +el.dataset.d * (W.count >= 30 ? 5 : 1)));
    const n = $('#wz-n'); n.textContent = W.count; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
    $('#wz-say').textContent = wizardLine();
  },

  /* QG et check-list */
  task: el => {
    const t = P().tasks.find(x => x.id === el.dataset.id);
    Store.update('tasks', t.id, { done: !t.done });
    buzz(10);
    if (!t.done && P().tasks.every(x => x.done)) { Confetti(); toast('Check-list bouclée. Vous êtes prêts !'); }
  },
  'task-add': () => Sheet.open(taskSheet()),
  'task-edit': el => Sheet.open(taskSheet(P().tasks.find(t => t.id === el.dataset.id))),
  'task-del': el => { if (armed(el)) { Store.remove('tasks', el.dataset.id); Sheet.close(); } },
  'party-edit': () => Sheet.open(partySheet()),
  'party-del': async el => {
    if (!armed(el, 'Tout sera effacé pour tout le monde. Touche encore.')) return;
    Sheet.close();
    await Store.mutate(null, 'DELETE', Store.base());
    go({ screen: 'home', pid: null });
  },

  /* invités */
  rsvp: (el, e) => {
    const s = el.dataset.s;
    Store.update('members', P().me, { status: s });
    buzz(15);
    if (s === 'yes') Confetti(e.clientX, e.clientY, 40);
  },
  invite: () => Sheet.open(inviteSheet()),
  'invite-copy': el => copyOrSelect(el.dataset.what === 'text' ? inviteText() : inviteLink(), $('#invite-link')),
  'default-role': el => {
    const role = el.dataset.role;
    Store.mutate(B => { B.party.default_role = role; }, 'PATCH', Store.base(), { default_role: role });
    Sheet.set(inviteSheet());
  },
  'invite-reset': async el => {
    if (!armed(el, 'L’ancien lien ne marchera plus. Touche encore.')) return;
    const r = await Store.mutate(null, 'POST', Store.base() + '/invite/reset');
    if (r) { P().party.invite_code = r.invite_code; Sheet.set(inviteSheet()); toast('Nouveau lien prêt'); }
  },
  'member-add': () => Sheet.open(memberSheet()),
  'member-edit': el => Sheet.open(memberSheet(P().members.find(m => m.id === el.dataset.id))),
  'member-link': el => copyText(inviteLink('?m=' + el.dataset.id)),
  'member-del': async el => {
    const mine = el.dataset.id === P().me;
    if (!armed(el)) return;
    Sheet.close();
    if (mine) { await Store.mutate(null, 'DELETE', `${Store.base()}/members/${el.dataset.id}`); return go({ screen: 'home', pid: null }); }
    Store.remove('members', el.dataset.id);
  },
  'guest-cycle': (el, e) => {
    const g = P().members.find(m => m.id === el.dataset.id), next = { wait: 'yes', yes: 'maybe', maybe: 'no', no: 'wait' }[g.status];
    Store.update('members', g.id, { status: next });
    buzz(10);
    flash(`.status[data-id="${g.id}"]`);
    if (next === 'yes') Confetti(e.clientX, e.clientY, 24);
  },

  /* courses, stock, comptes */
  'shop-mode': (el, e) => {
    R.shopMode = el.dataset.mode || 'list';
    if (R.tab !== 'shop') go({ tab: 'shop' }, ptOf(e)); else render(false);
  },
  'item-add': () => Sheet.open(itemSheet()),
  'item-edit': el => Sheet.open(itemSheet(P().items.find(i => i.id === el.dataset.id))),
  'item-del': el => { if (armed(el)) { Store.remove('items', el.dataset.id); Sheet.close(); } },
  'item-toggle': el => {
    const i = P().items.find(x => x.id === el.dataset.id), on = !i.bought;
    Store.update('items', i.id, on ? { bought: true, level: 3, paid_by: P().me, paid_amount: null } : { bought: false, level: null, paid_by: null, paid_amount: null });
    buzz(10);
    flash(`.check[data-id="${i.id}"]`);
    if (on) toast(estOf(i) ? `Noté : payé par toi, ${euro(estOf(i))}. Touche l’article pour corriger.` : 'Noté : acheté par toi. Ajoute le prix pour les comptes.');
    if (on && P().items.every(x => x.bought)) { Confetti(); toast('Toutes les courses sont faites !'); }
  },
  stock: el => {
    const i = P().items.find(x => x.id === el.dataset.id), n = +el.dataset.lvl, cur = i.level == null ? 3 : i.level;
    const lvl = cur === n ? n - 1 : n;
    Store.update('items', i.id, { level: lvl });
    buzz(10);
    if (lvl === 0) toast(`${i.name} : à sec !`);
  },
  calc: () => {
    const p = P().party, gs = P().members;
    C = { n: Math.max(headcount(gs) + gs.filter(g => g.status === 'maybe').length, p.expected || 0) || 10, hours: 5, thirst: 1, off: new Set() };
    Sheet.open(calcSheet());
  },
  'calc-step': el => { const k = el.dataset.k, lim = k === 'n' ? [2, 200] : [1, 12]; C[k] = Math.max(lim[0], Math.min(lim[1], C[k] + +el.dataset.d)); Sheet.set(calcSheet()); },
  'calc-thirst': el => { C.thirst = +el.dataset.i; Sheet.set(calcSheet()); },
  'calc-toggle': el => { const i = +el.dataset.i; C.off.has(i) ? C.off.delete(i) : C.off.add(i); Sheet.set(calcSheet()); },
  'calc-apply': () => {
    const lines = estimateShopping(C.n, C.hours, C.thirst).filter((_, i) => !C.off.has(i));
    const { added, updated } = addItems(lines, { merge: true });
    Sheet.close();
    if (added || updated) { toast([added ? plural(added, 'article ajouté', 'articles ajoutés') : '', updated ? plural(updated, 'quantité mise à jour', 'quantités mises à jour') : ''].filter(Boolean).join(', ')); Confetti(null, null, 40); }
    R.shopMode = 'list';
    if (R.tab !== 'shop') go({ tab: 'shop' }); else render(false);
  },
  'expense-add': () => Sheet.open(expenseSheet()),
  'expense-edit': el => Sheet.open(expenseSheet(P().expenses.find(x => x.id === el.dataset.id))),
  'expense-del': el => { if (armed(el)) { Store.remove('expenses', el.dataset.id); Sheet.close(); } },
  settle: (el, e) => {
    const d = { from_member: el.dataset.from, to_member: el.dataset.to, amount: +el.dataset.amount };
    Store.add('transfers', d, { created_at: now() });
    Confetti(e.clientX, e.clientY, 30);
    toast(`${mName(d.from_member)} a remboursé ${euro(d.amount)} à ${mName(d.to_member)}`);
  },
  'transfer-del': el => Store.remove('transfers', el.dataset.id),

  /* bar */
  'bar-filter': el => { R.barFilter = el.dataset.f; render(false); },
  'ck-open': el => { const ck = findCk(el.dataset.id); CK = { id: ck.id, serv: ck.batch || 1 }; Sheet.open(cocktailSheet()); },
  'ck-serv': el => { const ck = findCk(CK.id), st = ck.batch ? 5 : 1; CK.serv = Math.max(st, Math.min(60, CK.serv + +el.dataset.d * st)); Sheet.set(cocktailSheet()); },
  'ck-missing': () => {
    const ck = findCk(CK.id), scale = CK.serv / (ck.batch || 1);
    const lines = missingFor(ck).map(g => ({ name: g.n, qty: g.q ? Math.ceil(g.q * scale * 2) / 2 : 1, unit: g.q ? g.u : '', cat: g.cat, note: `${ck.name} × ${CK.serv}` }));
    addItems(lines);
    toast(`${plural(lines.length, 'ingrédient ajouté', 'ingrédients ajoutés')} aux courses`);
    Sheet.set(cocktailSheet());
  },
  'ck-fav': () => {
    const key = CK.id, on = !(P().party.menu || []).includes(key);
    Store.mutate(B => { B.party.menu = on ? [...(B.party.menu || []), key] : (B.party.menu || []).filter(k => k !== key); }, 'PUT', Store.base() + '/menu', { key, on });
    toast(on ? 'Ajouté à la carte du soir' : 'Retiré de la carte');
    Sheet.set(cocktailSheet());
  },
  'ck-new': () => Sheet.open(cocktailForm()),
  'ck-edit': () => {
    const ck = findCk(CK.id);
    if (ck.custom) return Sheet.set(cocktailForm(ck.raw, ck.id));
    Sheet.set(cocktailForm({ name: (ck.name + ' maison').slice(0, 40), glass: ck.glass, color: ck.c[1], strength: ck.str, batch: ck.batch || 1, ingredients: ck.ing.map(g => ({ n: g.n, q: g.q, u: g.u })), steps: ck.steps }));
  },
  'ck-del': el => {
    if (!armed(el)) return;
    const id = el.dataset.id;
    Store.mutate(B => { B.cocktails = B.cocktails.filter(c => c.id !== id); B.party.menu = (B.party.menu || []).filter(k => k !== id); }, 'DELETE', `${Store.base()}/cocktails/${id}`);
    Sheet.close();
  },
  shake: () => {
    const ok = allCocktails().filter(c => !missingFor(c).length), ck = pick(ok.length ? ok : allCocktails());
    Sheet.open(`<div class="empty" style="padding:30px 0"><svg class="shaker" width="90" height="140" viewBox="0 0 90 140" aria-hidden="true"><path d="M20 46h50l-6 84a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6z" fill="var(--card2)" stroke="var(--fg)" stroke-width="4"/><path d="M24 46q0-24 21-24t21 24z" fill="var(--world)" stroke="var(--fg)" stroke-width="4"/><rect x="36" y="6" width="18" height="16" rx="4" fill="var(--card2)" stroke="var(--fg)" stroke-width="4"/></svg><p class="h2">Je secoue…</p></div>`);
    buzz([40, 60, 40, 60, 40]);
    setTimeout(() => { if ($('.shaker')) { CK = { id: ck.id, serv: ck.batch || 1 }; Sheet.set(cocktailSheet()); Confetti(null, innerHeight * 0.5, 40); } }, reduced() ? 100 : 1500);
  },
  print: () => { const l = $('#print-layer'); l.innerHTML = printView(); l.hidden = false; l.scrollTop = 0; },
  'print-go': () => window.print(),
  'print-close': () => { const l = $('#print-layer'); l.hidden = true; l.innerHTML = ''; },

  /* galerie */
  'photo-add': () => $('#file-in').click(),
  'photo-open': el => { LB.i = +el.dataset.i; LB.show = false; lbRender(true); },
  slideshow: () => { LB.i = 0; lbShow(true); },
  'lb-close': () => lbClose(),
  'lb-prev': () => { LB.i--; lbRender(true); },
  'lb-next': () => { LB.i++; lbRender(true); },
  'lb-show': () => lbShow(!LB.show),
  'lb-like': () => {
    const f = P().photos[LB.i], meId = P().me, on = !f.likes.includes(meId);
    Store.mutate(B => { const x = B.photos.find(p => p.id === f.id); if (x) x.likes = on ? [...x.likes, meId] : x.likes.filter(i => i !== meId); }, 'PUT', `${Store.base()}/photos/${f.id}/like`, { on });
    buzz(15);
  },
  'lb-del': el => { if (armedIcon(el)) Store.remove('photos', P().photos[LB.i].id); },

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

const Forms = {
  async welcome(o) {
    const name = (o.name || '').trim();
    if (!name) return nudge('#w-name');
    try { await Store.signup(name); } catch (e) { return toast(e.message); }
    await Store.refreshHome();
    render(true);
  },
  async join(o, f, sub) {
    const status = sub && sub.value;
    try {
      if (!Store.S.me) {
        const ghost = J.claim && J.data.ghosts.find(g => g.id === J.claim);
        const name = (o.name || '').trim() || (ghost && ghost.name);
        if (!name) return nudge('#j-name');
        await Store.signup(name);
      }
      const r = await Store.api('POST', '/api/join/' + J.code, { claim: J.claim || null, status });
      if (status === 'yes') setTimeout(() => Confetti(null, null, 100), 400);
      J = null;
      go({ screen: 'party', pid: r.id, tab: 'qg', night: false, game: null, code: null }, null, { replace: true });
    } catch (e) { toast(e.message); }
  },
  async wz(o) {
    const k = W.steps[W.i];
    if (k === 'name') { if (!o.name.trim()) return nudge('#wz-name'); W.name = o.name.trim(); }
    if (k === 'when') { W.date = o.date; W.time = o.time; }
    if (k === 'where') W.place = o.place.trim();
    if (W.i < W.steps.length - 1) { W.i++; return go({}); }
    let r;
    try { r = await Store.api('POST', '/api/parties', { name: W.name, date: W.date, time: W.time, place: W.place, theme: W.theme, expected: W.count, default_role: W.access }); }
    catch (e) { return toast(e.message); }
    await go({ screen: 'party', pid: r.id, tab: 'qg', night: false, game: null });
    setTimeout(() => { Confetti(null, null, 120); buzz([30, 40, 80]); Sheet.open(inviteSheet()); }, 700);
  },
  async me(o) {
    const name = o.name.trim();
    if (!name) return nudge('#me-name');
    try { Store.S.me = await Store.api('PATCH', '/api/me', { name }); } catch (e) { return toast(e.message); }
    Sheet.close();
    render(false);
  },
  member(o, f, sub) {
    const d = { name: o.name.trim(), status: o.status, plus: +o.plus || 0, brings: o.brings.trim() };
    if (!d.name) return nudge('#m-name');
    if ($('#m-split', f)) d.in_split = !!o.in_split;
    if (o.role) d.role = o.role;
    if (f.dataset.id) {
      const cur = P().members.find(m => m.id === f.dataset.id);
      if (d.role === cur.role) delete d.role;
      Store.update('members', f.dataset.id, d);
    } else Store.add('members', d, { role: 'viewer', linked: false, in_split: true });
    if (sub && sub.value === 'more') { toast(d.name + ' est sur la liste'); Sheet.set(memberSheet()); setTimeout(() => $('#m-name') && $('#m-name').focus(), 50); }
    else Sheet.close();
  },
  item(o, f) {
    const d = { name: o.name.trim(), qty: num(o.qty) || 0, unit: o.unit.trim(), cat: o.cat, price: num(o.price) || 0, assignee: o.assignee || null };
    if (!d.name) return nudge('#i-name');
    if ('paid_by' in o) { d.paid_by = o.paid_by || null; d.paid_amount = num(o.paid_amount); }
    if (f.dataset.id) Store.update('items', f.dataset.id, d);
    else Store.add('items', d, ITEM_DEFAULTS());
    Sheet.close();
  },
  expense(o, f) {
    const d = { label: o.label.trim(), amount: num(o.amount), paid_by: o.paid_by };
    if (!d.label) return nudge('#e-label');
    if (d.amount == null || !(d.amount >= 0)) return nudge('#e-amount');
    if (f.dataset.id) Store.update('expenses', f.dataset.id, d);
    else Store.add('expenses', d, { created_at: now() });
    Sheet.close();
  },
  task(o, f) {
    const d = { label: o.label.trim(), when_label: o.when_label.trim() };
    if (!d.label) return nudge('#t-label');
    if (f.dataset.id) Store.update('tasks', f.dataset.id, d);
    else Store.add('tasks', { ...d, position: P().tasks.reduce((m, t) => Math.max(m, t.position || 0), 0) + 1 }, { done: false });
    Sheet.close();
  },
  party(o) {
    const d = { name: o.name.trim() || P().party.name, date: o.date, time: o.time, place: o.place.trim(), theme: o.theme, expected: Math.max(1, Math.min(500, +o.expected || 1)) };
    Store.mutate(B => Object.assign(B.party, d), 'PATCH', Store.base(), d);
    Sheet.close();
  },
  cocktail(o, f) {
    const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
    const d = { name: o.name.trim(), glass: o.glass, color: o.color || CK_COLORS[0], strength: +o.strength, batch: Math.max(1, Math.min(50, +o.batch || 1)),
      ingredients: lines(o.ingredients).slice(0, 15).map(parseIng), steps: lines(o.steps).slice(0, 10).map(x => x.slice(0, 200)) };
    if (!d.name) return nudge('#c-name');
    let id = f.dataset.id;
    if (id) Store.update('cocktails', id, d);
    else id = Store.add('cocktails', d);
    CK = { id, serv: d.batch > 1 ? d.batch : 1 };
    toast(f.dataset.id ? 'Recette mise à jour' : 'Cocktail maison créé');
    Sheet.set(cocktailSheet());
  },
  player(o) { const n = o.name.trim(); if (n) N.players.push({ n, st: 'on' }); Sheet.close(); render(false); },
};
function nudge(sel) { const el = $(sel); if (!el) return; el.focus(); el.style.animation = 'wiggle .15s 3'; setTimeout(() => (el.style.animation = ''), 500); }

document.addEventListener('click', e => {
  if (e.target.id === 'sheet-layer') return Sheet.close();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
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
  if (!$('#print-layer').hidden) Acts['print-close']();
  else if (!$('#lightbox').hidden) lbClose();
  else Sheet.close();
});
window.addEventListener('popstate', () => { Sheet.close(); lbClose(); route(parsePath(), { silent: true }); });

/* Ajout de photos : compressées dans le navigateur, puis envoyées une par une. */
$('#file-in').addEventListener('change', async e => {
  const files = [...e.target.files].slice(0, 12);
  e.target.value = '';
  if (!files.length || !P()) return;
  const base = Store.base();
  toast(files.length > 1 ? `Je développe ${files.length} photos…` : 'Je développe la photo…');
  let ok = 0;
  for (const file of files) {
    try {
      const ph = await compressPhoto(file);
      if (await Store.mutate(null, 'POST', base + '/photos', { id: Store.uuid(), data: ph.src, w: ph.w, h: ph.h })) ok++;
    } catch (err) { /* fichier illisible : on passe au suivant */ }
  }
  if (ok) { Confetti(null, null, 50); toast(plural(ok, 'photo ajoutée', 'photos ajoutées')); }
  else toast('Impossible d’ajouter ces images. Essaie en JPEG ou PNG.');
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

Store.onNotice((k, msg) => {
  if (k === 'gone') { toast('Cette soirée n’est plus accessible.'); go({ screen: 'home', pid: null, night: false, game: null }); }
  else toast(msg || 'Enregistrement impossible, réessaie dans un instant.');
});
Store.on(() => {
  if (!Store.S.ready || !booted) return;
  if (!$('#lightbox').hidden) lbRender(false);
  if (R.screen === 'wizard' || R.screen === 'join' || (R.night && R.game)) return;
  scheduleRender();
});

/* Ouvre l'écran correspondant à l'adresse. */
async function route(r, opts = {}) {
  if (r.screen === 'join') {
    const m = new URLSearchParams(location.search).get('m');
    J = { code: r.code, data: null, claim: null };
    R = { ...R, screen: 'join', code: r.code };
    render(true);
    try {
      const d = await Store.api('GET', '/api/join/' + encodeURIComponent(r.code));
      if (d.already) return go({ screen: 'party', pid: d.party.id, tab: 'qg', night: false, game: null }, null, { replace: true });
      J.data = d;
      if (m && d.ghosts.some(g => g.id === m)) J.claim = m;
    } catch (e) { J.error = e.message; }
    return render(true);
  }
  if (r.screen === 'link') {
    R = { ...R, screen: 'home', code: r.code };
    history.replaceState(null, '', '/');
    render(true);
    if (Store.S.me) return Sheet.open(`<h2 class="h2">Changer de compte ?</h2><p class="muted" style="font-weight:600">Tu es connecté en tant que ${esc(me())} sur cet appareil. Ce lien ouvre un autre compte à la place.</p>
      <button class="btn world" data-act="link-claim">Ouvrir l’autre compte</button><button class="btn alt" data-act="sheet-close">Rester ${esc(me())}</button>`);
    return Acts['link-claim']();
  }
  return go({ ...r, game: null }, null, { ...opts, instant: true });
}

let booted = false;
setInterval(tickCountdown, 1000);
(async () => {
  await Store.init();
  booted = true;
  document.documentElement.dataset.world = 'home';
  route(parsePath(), { replace: true });
})();
