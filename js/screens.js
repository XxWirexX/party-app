/* Zeste — écrans : accueil, assistant de création, et les cinq onglets d'une soirée. */
let R = { screen: 'home', pid: null, tab: 'qg', night: false, game: null, shopMode: 'list', barFilter: 'all' };
let W = null; // état de l'assistant de création
const TABS = [['qg', 'QG'], ['guests', 'Invités'], ['shop', 'Courses'], ['bar', 'Bar'], ['gallery', 'Galerie']];
const TAB_WORLD = { qg: 'home', guests: 'guests', shop: 'shop', bar: 'bar', gallery: 'gallery' };
const STATUS = { wait: 'En attente', yes: 'Vient', maybe: 'Peut-être', no: 'Ne vient pas' };

const me = () => Store.lsGet('zeste:name', '');
const partyDate = p => new Date((p.date || '2030-01-01') + 'T' + (p.time || '20:00'));
const dayDiff = p => { const a = new Date(); a.setHours(0, 0, 0, 0); const b = partyDate(p); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5); };
const fmtDate = p => partyDate(p).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = p => partyDate(p).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const guestsOf = pid => Store.list('guests', g => g.partyId === pid).sort((a, b) => a.name.localeCompare(b.name));
const itemsOf = pid => Store.list('items', i => i.partyId === pid).sort((a, b) => (a.at || 0) - (b.at || 0));
const photosOf = pid => Store.list('photos', f => f.partyId === pid).sort((a, b) => (a.at || 0) - (b.at || 0));
const headcount = gs => gs.filter(g => g.status === 'yes').reduce((s, g) => s + 1 + (g.plus || 0), 0);
const theme = p => THEMES.find(t => t.id === p.theme) || THEMES[0];
const jLabel = d => (d === 0 ? 'Ce soir' : d > 0 ? 'J-' + d : 'J+' + -d);
const cur = () => Store.get('parties', R.pid);

/* ---------- rendu et navigation ---------- */
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(false); });
}
function render(anim) {
  const v = $('#view'), nav = $('#tabs');
  if (!Store.S.ready) return;
  if (R.screen === 'party' && !cur()) R = { ...R, screen: 'home', pid: null, night: false, game: null };
  const top = v.scrollTop;
  let html, tabs = false;
  if (R.screen === 'wizard') html = wizardView();
  else if (R.screen === 'party' && R.night) html = nightView(cur());
  else if (R.screen === 'party') { html = partyView(cur()); tabs = true; }
  else html = homeView();
  v.innerHTML = html;
  v.classList.toggle('no-tabs', !tabs);
  nav.hidden = !tabs;
  if (tabs) {
    if (!nav.children.length) nav.innerHTML = '<i class="blob"></i>' + TABS.map(([k, l]) => `<button data-act="tab" data-tab="${k}">${ico(k)}<span>${l}</span></button>`).join('');
    const i = TABS.findIndex(t => t[0] === R.tab);
    $('.blob', nav).style.setProperty('--i', i);
    $$('button', nav).forEach((b, n) => { b.classList.toggle('on', n === i); b.setAttribute('aria-current', n === i ? 'page' : 'false'); });
  }
  if (anim) {
    v.scrollTop = 0;
    v.classList.remove('leave', 'enter');
    void v.offsetWidth;
    v.classList.add('enter');
    setTimeout(() => v.classList.remove('enter'), 900);
    afterEnter();
  } else v.scrollTop = top;
  tickCountdown();
}
function afterEnter() {
  if (R.screen === 'wizard') typeInto($('#wz-say'), wizardLine());
  if (R.screen === 'home') { const s = $('#home-say'); if (s) typeInto(s, s.dataset.t); }
  if (R.screen === 'party') coach(R.night ? (R.game ? '' : 'night') : R.tab); else $('#coach').classList.remove('on');
  Store.lsSet('zeste:route', { screen: R.screen === 'wizard' ? 'home' : R.screen, pid: R.pid, tab: R.tab });
}
function go(patch, pt) {
  R = { ...R, ...patch };
  const world = R.screen === 'party' ? (R.night ? 'night' : TAB_WORLD[R.tab]) : 'home';
  setWorld(world, pt);
  Store.watchPhotos(R.screen === 'party' ? R.pid : null);
  const v = $('#view');
  if (reduced()) return render(true);
  v.classList.add('leave');
  setTimeout(() => render(true), 130);
}
const ptOf = e => (e && e.clientX != null ? { x: e.clientX, y: e.clientY } : { x: innerWidth / 2, y: innerHeight / 2 });

/* ---------- accueil ---------- */
function homeView() {
  const ps = Store.list('parties').sort((a, b) => partyDate(a) - partyDate(b));
  const next = ps.filter(p => dayDiff(p) >= 0), past = ps.filter(p => dayDiff(p) < 0).reverse();
  const name = me();
  let say, mood = 'happy';
  if (!ps.length) say = `Salut${name ? ' ' + name : ''} ! Moi c’est Limo. Aucune soirée en vue… On en organise une ?`;
  else if (!next.length) { say = 'Plus rien au programme ? C’est triste. Relance la machine !'; mood = 'sad'; }
  else {
    const d = dayDiff(next[0]);
    say = d === 0 ? `C’est CE SOIR : « ${next[0].name} ». Tout est prêt ?` : d === 1 ? `« ${next[0].name} », c’est demain. Les glaçons sont au congélateur ?` : `Plus que ${d} jours avant « ${next[0].name} ». On fait le point ?`;
    mood = d <= 1 ? 'wow' : 'happy';
  }
  const ticket = (p, i, isPast) => {
    const t = theme(p), yes = headcount(guestsOf(p.id)), d = dayDiff(p);
    return `<button class="ticket${isPast ? ' past' : ''}" data-act="open" data-id="${p.id}" style="--tilt:${[-1.4, 1.1, -0.6][i % 3]}deg;--c:var(${t.c})">
      <span class="tk-main"><span class="tk-emo">${t.emo}</span><h3>${esc(p.name)}</h3><p>${esc(fmtShort(p))} · ${esc(p.time || '')}${p.place ? ' · ' + esc(p.place) : ''}</p></span>
      <span class="tk-stub"><b>${jLabel(d)}</b><span>${yes ? plural(yes, 'présent') : 'Voir'}</span></span></button>`;
  };
  const S = Store.S;
  return `<header class="home-head"><div class="logo">Zeste<i></i></div><button class="me-chip" data-act="me">${esc(name || 'Ton prénom')}</button></header>
    <div class="limo-say">${limo(mood, 108, true)}<div class="bubble"><span id="home-say" data-t="${esc(say)}">${esc(say)}</span></div></div>
    ${S.mode === 'local' ? '<p class="note">Mode solo : tes soirées sont enregistrées sur cet appareil.</p>' : ''}
    ${S.stale ? '<p class="note">Connexion capricieuse : ces infos ne sont peut-être pas à jour.</p>' : ''}
    ${!S.canWrite ? '<p class="note">Mode spectateur : seul l’organisateur peut modifier.</p>' : ''}
    ${next.length ? `<p class="eyebrow">À venir</p><div class="stack">${next.map((p, i) => ticket(p, i)).join('')}</div>` : ''}
    <button class="btn" data-act="new">${ico('plus')} Nouvelle soirée</button>
    ${past.length ? `<p class="eyebrow">Souvenirs</p><div class="stack">${past.map((p, i) => ticket(p, i, true)).join('')}</div>` : ''}`;
}

/* ---------- assistant de création ---------- */
function startWizard() {
  const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  W = { i: 0, steps: (me() ? [] : ['me']).concat(['name', 'when', 'where', 'theme', 'count']), name: '', date: d.toISOString().slice(0, 10), time: '21:00', place: '', theme: 'dance', count: 12 };
}
const countLine = n => (n <= 6 ? 'Petit comité, grandes discussions.' : n <= 15 ? 'Le format parfait : assez pour danser, pas assez pour fâcher les voisins.' : n <= 30 ? 'Ça commence à faire du monde. Préviens les voisins !' : 'Là, c’est un festival. Respect.');
function wizardLine() {
  const k = W.steps[W.i], n = me();
  return { me: 'Moi c’est Limo, ton citron vert de soirée. Et toi, c’est quoi ton prénom ?', name: `${n ? 'Enchanté ' + n + ' ! ' : ''}Elle s’appelle comment, cette soirée ?`,
    when: 'C’est noté. On cale ça quand ?', where: 'Et ça se passe où ?', theme: 'C’est quoi l’ambiance ?', count: 'Vous serez combien, à peu près ? ' + countLine(W.count) }[k];
}
function wizardView() {
  const k = W.steps[W.i], last = W.i === W.steps.length - 1;
  const body = {
    me: `<input class="in" id="wz-me" name="me" placeholder="Ton prénom" maxlength="24" autocomplete="given-name" data-focus>`,
    name: `<input class="in" id="wz-name" name="name" placeholder="Anniv de Léa" maxlength="40" value="${esc(W.name)}" data-focus>
      <div class="chips">${NAME_IDEAS.map(n => `<button type="button" class="chip" data-act="wz-idea">${n}</button>`).join('')}</div>`,
    when: `<div class="f-row"><label class="f">Le<input class="in" id="wz-date" type="date" name="date" value="${W.date}" required></label>
      <label class="f">À<input class="in" id="wz-time" type="time" name="time" value="${W.time}" required></label></div>`,
    where: `<input class="in" id="wz-place" name="place" placeholder="Chez moi, 3e étage" maxlength="60" value="${esc(W.place)}" data-focus>`,
    theme: `<div class="theme-grid">${THEMES.map(t => `<button type="button" class="theme${t.id === W.theme ? ' on' : ''}" style="--c:var(${t.c})" data-act="wz-theme" data-id="${t.id}"><span>${t.emo}</span>${t.label}</button>`).join('')}</div>`,
    count: `<div class="stepper"><button type="button" class="ico-btn" data-act="wz-count" data-d="-1" aria-label="Moins">−</button><b id="wz-n" class="num">${W.count}</b><button type="button" class="ico-btn" data-act="wz-count" data-d="1" aria-label="Plus">${ico('plus')}</button></div>`,
  }[k];
  return `<div class="wz-top"><button class="ico-btn" data-act="wz-back" aria-label="Retour">${ico(W.i ? 'back' : 'x')}</button><div class="wz-bar"><i style="width:${((W.i + 1) / W.steps.length) * 100}%"></i></div></div>
    <div class="limo-say">${limo(k === 'count' ? 'wow' : 'happy', 104)}<div class="bubble"><span id="wz-say"></span></div></div>
    <form class="wz-body" data-form="wz" style="flex:1">${body}<div class="wz-foot"><button class="btn">${last ? 'Créer la soirée' : 'Continuer'}</button></div></form>`;
}

/* ---------- soirée : en-tête commun + onglets ---------- */
function partyView(p) {
  const t = theme(p);
  const head = `<header class="p-head"><button class="ico-btn" data-act="home" aria-label="Mes soirées">${ico('back')}</button>
    <div class="p-name">${t.emo} ${esc(p.name)}</div><button class="night-btn" data-act="night">${ico('disco', 18)} Mode soirée</button></header>`;
  return head + { qg: qgView, guests: guestsView, shop: shopView, bar: barView, gallery: galleryView }[R.tab](p);
}

function tipFor(p, gs, its, d) {
  const pend = gs.filter(g => g.status === 'wait').length, left = its.filter(i => !i.bought).length;
  if (d < 0) return { t: 'Quelle soirée ! Balance les photos dans la galerie avant d’oublier.', mood: 'cool', act: 'tab', tab: 'gallery', label: 'Ouvrir la galerie' };
  if (!gs.length) return { t: 'Une soirée sans invités, ça s’appelle une soirée télé. Ajoute du monde !', mood: 'sad', act: 'tab', tab: 'guests', label: 'Ajouter des invités' };
  if (!its.length) return { t: 'La liste de courses est vide. Laisse-moi calculer les quantités.', mood: 'wink', act: 'calc', label: 'Calculer les courses' };
  if (d === 0) return { t: 'C’est ce soir ! Lance le mode soirée quand tout le monde est là.', mood: 'wow' };
  if (pend && d <= 5) return { t: `${plural(pend, 'invité')} ${pend > 1 ? 'n’ont' : 'n’a'} toujours pas répondu. Relance, sans pitié.`, mood: 'wink', act: 'tab', tab: 'guests', label: 'Voir les invités' };
  if (!its.some(i => /gla[cç]/i.test(i.name))) return { t: 'Pas de glaçons dans la liste. Compte 1 kg pour 5 personnes.', mood: 'wow', act: 'tab', tab: 'shop', label: 'Ouvrir les courses' };
  if (left && d <= 1) return { t: `Il reste ${plural(left, 'article')} à acheter et c’est demain !`, mood: 'wow', act: 'tab', tab: 'shop', label: 'Voir la liste' };
  return { t: 'Tout roule. Tu gères comme un chef.', mood: 'cool' };
}

function qgView(p) {
  const gs = guestsOf(p.id), its = itemsOf(p.id), d = dayDiff(p);
  const yes = headcount(gs), answered = gs.filter(g => g.status !== 'wait').length;
  const bought = its.filter(i => i.bought).length;
  const total = its.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0), heads = Math.max(yes, p.count || 1);
  const tip = tipFor(p, gs, its, d), tasks = p.tasks || {};
  const future = partyDate(p) > new Date();
  return `<div class="title-row"><h1 class="title">${esc(p.name)}</h1><button class="ico-btn" data-act="party-edit" aria-label="Modifier la soirée">${ico('edit', 20)}</button></div>
    <section class="card stack">
      <div class="hero-meta"><span>${esc(fmtDate(p))} à ${esc(p.time || '')}</span>${p.place ? `<span class="muted">${esc(p.place)}</span>` : ''}</div>
      ${future ? `<div class="cd" id="cd" data-at="${partyDate(p).getTime()}"><div><b>0</b><span>jours</span></div><div><b>0</b><span>heures</span></div><div><b>0</b><span>min</span></div><div><b>0</b><span>sec</span></div></div>`
        : `<p class="h2">${d === 0 ? 'C’est maintenant !' : 'C’était il y a ' + plural(-d, 'jour') + '.'}</p>`}
    </section>
    <div class="gauges">
      <button class="gauge-card" data-act="tab" data-tab="guests"><span class="ring" style="--p:${gs.length ? (answered / gs.length) * 100 : 0};--c:var(--w-pink)"><b class="num">${yes}</b></span><small>${yes > 1 ? 'présents' : 'présent'}<br>sur ${plural(gs.length, 'invité')}</small></button>
      <button class="gauge-card" data-act="tab" data-tab="shop"><span class="ring" style="--p:${its.length ? (bought / its.length) * 100 : 0};--c:var(--w-mint)"><b class="num">${bought}</b></span><small>${bought > 1 ? 'achetés' : 'acheté'}<br>sur ${plural(its.length, 'article')}</small></button>
      <button class="gauge-card" data-act="tab" data-tab="shop"><span class="ring" style="--p:100;--c:var(--w-orange)"><b class="num">${Math.round(total / heads)}€</b></span><small>par personne<br>${euro(Math.round(total))} au total</small></button>
    </div>
    ${limoSay(esc(tip.t), tip.mood, 84, tip.act ? `<button class="btn sm world" data-act="${tip.act}" data-tab="${tip.tab || ''}">${tip.label}</button>` : '')}
    <button class="night-cta" data-act="night"><span class="disco"></span><span><b>Mode soirée</b><small>Jeux, roue, bouteille, bombe…</small></span></button>
    <div class="list-label"><p class="eyebrow">Check-list</p><p class="eyebrow num">${TASKS.filter(t => tasks[t.id]).length} / ${TASKS.length}</p></div>
    <ul class="list">${TASKS.map(t => `<li class="row${tasks[t.id] ? ' done' : ''}"><button class="check${tasks[t.id] ? ' on' : ''}" data-act="task" data-id="${t.id}" aria-label="${esc(t.label)}" aria-pressed="${!!tasks[t.id]}">${ico('check', 18)}</button>
      <div class="row-main"><b>${t.label}</b></div><span class="when">${t.when}</span></li>`).join('')}</ul>`;
}

function guestsView(p) {
  const gs = guestsOf(p.id), n = k => gs.filter(g => g.status === k).length, yes = headcount(gs);
  const bar = gs.length ? ['yes', 'maybe', 'no', 'wait'].map(k => `<i style="flex-grow:${n(k)};background:var(--${k})"></i>`).join('') : '';
  return `<div class="title-row"><h1 class="title">Invités</h1><button class="btn sm" data-act="guest-add">${ico('plus', 18)} Ajouter</button></div>
    ${gs.length ? `<section class="card stack"><div class="big-count"><b class="num">${yes}</b><span>${yes > 1 ? 'personnes viennent' : 'personne vient'}<br><span class="muted">${plural(gs.length, 'invitation')} envoyée${gs.length > 1 ? 's' : ''}</span></span></div>
      <div class="statbar">${bar}</div>
      <div class="legend"><span style="--c:var(--yes)">${n('yes')} oui</span><span style="--c:var(--maybe)">${n('maybe')} peut-être</span><span style="--c:var(--no)">${n('no')} non</span><span style="--c:var(--wait)">${n('wait')} en attente</span></div></section>
      <ul class="list">${gs.map(g => `<li class="row"><button class="ava" style="--h:${hue(g.name)}" data-act="guest-edit" data-id="${g.id}" aria-label="Modifier ${esc(g.name)}">${esc(initials(g.name))}</button>
        <button class="row-main" data-act="guest-edit" data-id="${g.id}"><b>${esc(g.name)}${g.plus ? ` <span class="tag">+${g.plus}</span>` : ''}</b>${g.brings ? `<small>Ramène : ${esc(g.brings)}</small>` : ''}</button>
        <button class="status s-${g.status}" data-act="guest-cycle" data-id="${g.id}">${STATUS[g.status]}</button></li>`).join('')}</ul>`
      : `<div class="empty">${limoSay('Personne sur la liste pour l’instant. Ajoute tes premiers invités, je m’occupe des comptes.', 'happy', 96)}</div>`}
    <button class="btn alt" data-act="invite">${ico('copy')} Préparer l’invitation</button>`;
}

function shopView(p) {
  const its = itemsOf(p.id), gs = guestsOf(p.id);
  const total = its.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);
  const paid = its.filter(i => i.bought).reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);
  const heads = Math.max(headcount(gs), p.count || 1);
  const stock = R.shopMode === 'stock';
  const whoName = id => { const g = gs.find(x => x.id === id); return g ? g.name : ''; };
  const row = i => {
    const sub = [i.qty ? `${i.qty} ${esc(i.unit || '')}`.trim() : '', i.who && whoName(i.who) ? esc(whoName(i.who)) + ' s’en charge' : ''].filter(Boolean).join(' · ');
    if (stock) {
      const lv = i.level == null ? 3 : i.level, col = ['--no', '--no', '--maybe', '--yes'][lv];
      return `<li class="row"><div class="row-main"><b>${esc(i.name)}</b><small>${['À sec', 'Presque vide', 'Entamé', 'Plein'][lv]}</small></div>
        <div class="lvl" style="--c:var(${col})">${[1, 2, 3].map(n => `<button class="${lv >= n ? 'f' : ''}" data-act="stock" data-id="${i.id}" data-lvl="${n}" aria-label="Niveau ${n} sur 3"></button>`).join('')}</div></li>`;
    }
    return `<li class="row${i.bought ? ' done' : ''}"><button class="check${i.bought ? ' on' : ''}" data-act="item-toggle" data-id="${i.id}" aria-label="Acheté : ${esc(i.name)}" aria-pressed="${!!i.bought}">${ico('check', 18)}</button>
      <button class="row-main" data-act="item-edit" data-id="${i.id}"><b>${esc(i.name)}</b>${sub ? `<small>${sub}</small>` : ''}</button>
      ${i.price ? `<span class="price">${euro((i.qty || 1) * i.price)}</span>` : ''}</li>`;
  };
  const shown = stock ? its.filter(i => i.bought) : its;
  const dry = its.filter(i => i.bought && i.level === 0);
  const groups = CATS.map(c => [c, shown.filter(i => (i.cat || 'divers') === c.id)]).filter(g => g[1].length);
  let body;
  if (!its.length) body = `<div class="empty">${limoSay('Liste vide. Dis-moi combien vous êtes et je calcule tout : bières, softs, glaçons, chips.', 'wink', 96, `<button class="btn sm world" data-act="calc">${ico('spark', 18)} Calculer pour moi</button>`)}</div>`;
  else if (stock && !shown.length) body = `<div class="empty">${limoSay('Rien en stock pour l’instant. Coche tes achats dans la liste, ils arriveront ici.', 'happy', 96)}</div>`;
  else body = (stock && dry.length ? `<p class="alert">À sec : ${dry.map(i => esc(i.name)).join(', ')}. Qui retourne à l’épicerie ?</p>` : '') +
    groups.map(([c, l]) => `<div class="list-label"><p class="eyebrow">${c.label}</p><p class="eyebrow num">${stock ? l.length : l.filter(i => i.bought).length + ' / ' + l.length}</p></div><ul class="list">${l.map(row).join('')}</ul>`).join('');
  return `<div class="title-row"><h1 class="title">Courses</h1><button class="btn sm" data-act="item-add">${ico('plus', 18)} Article</button></div>
    <div class="seg" role="tablist"><button class="${stock ? '' : 'on'}" data-act="shop-mode" data-mode="list">Liste</button><button class="${stock ? 'on' : ''}" data-act="shop-mode" data-mode="stock">Stock</button></div>
    ${its.length && !stock ? `<section class="card budget"><div><b>${euro(Math.round(total))}</b><small>budget estimé</small></div><div><b>${euro(Math.round(paid))}</b><small>déjà acheté</small></div><div><b>${euro(Math.round(total / heads))}</b><small>par personne</small></div></section>` : ''}
    ${body}
    ${its.length && !stock ? `<button class="btn alt" data-act="calc">${ico('spark')} Limo recalcule les quantités</button>` : ''}`;
}

const missingFor = (ck, its) => {
  const names = its.filter(i => !(i.bought && i.level === 0)).map(i => norm(i.name));
  return ck.ing.filter(g => !g.base && !g.k.some(k => names.some(n => n.includes(k))));
};
function barView(p) {
  const its = itemsOf(p.id), favs = p.favs || {}, f = R.barFilter;
  const all = COCKTAILS.map(c => ({ c, miss: missingFor(c, its).length }));
  const list = all.filter(x => (f === 'ok' ? !x.miss : f === 'soft' ? x.c.str === 0 : f === 'fav' ? favs[x.c.id] : true));
  const chips = [['all', 'Tous'], ['ok', 'Faisables'], ['soft', 'Sans alcool'], ['fav', 'La carte du soir']];
  return `<div class="title-row"><h1 class="title">Le bar</h1><button class="btn sm" data-act="shake">Shaker surprise</button></div>
    <div class="chips scroll">${chips.map(([k, l]) => `<button class="chip${f === k ? ' on' : ''}" data-act="bar-filter" data-f="${k}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="bar-grid">${list.map(({ c, miss }) => `<button class="ck" data-act="ck-open" data-id="${c.id}">
      <span class="badge${miss ? '' : ' ok'}">${miss ? 'manque ' + miss : 'faisable'}</span>${glassSVG(c, 84)}<b>${c.name}</b>
      <span class="dots" aria-label="Force ${c.str} sur 3">${[1, 2, 3].map(n => `<i class="${c.str >= n ? 'f' : ''}"></i>`).join('')}</span>
      <small>${c.str === 0 ? 'Sans alcool' : c.batch ? 'Pour ' + c.batch + ' verres' : ['', 'Léger', 'Classique', 'Costaud'][c.str]}${favs[c.id] ? ' · à la carte' : ''}</small></button>`).join('')}</div>`
      : `<div class="empty">${limoSay(f === 'fav' ? 'Ta carte du soir est vide. Ouvre un cocktail et ajoute-le à la carte.' : 'Rien de faisable avec ta liste actuelle. Ouvre une recette et ajoute ce qui manque aux courses.', 'sad', 96)}</div>`}`;
}

function galleryView(p) {
  const ph = photosOf(p.id);
  return `<div class="title-row"><h1 class="title">Galerie</h1><button class="btn sm" data-act="photo-add">${ico('camera', 18)} Ajouter</button></div>
    ${ph.length ? `<div class="row-btns"><button class="btn alt sm" data-act="slideshow">${ico('play', 18)} Diaporama</button><span class="chip num">${plural(ph.length, 'photo')}</span></div>
      <div class="pgrid">${ph.map((f, i) => `<button class="ph" data-act="photo-open" data-i="${i}" style="--r:${(hue(f.id) % 7) - 3}deg">
        <img src="${f.src}" alt="Photo de ${esc(f.byName || 'la soirée')}" loading="lazy" style="aspect-ratio:${f.w || 4}/${f.h || 3}">
        <span><span>${esc(f.byName || '')}</span><span>${Object.values(f.likes || {}).filter(Boolean).length || ''}${Object.values(f.likes || {}).some(Boolean) ? ' 🔥' : ''}</span></span></button>`).join('')}</div>`
      : `<div class="empty">${limoSay('Aucune photo. Sans preuve, cette soirée n’a jamais existé. Ajoute les premières !', 'wow', 100)}</div>`}`;
}

/* ---------- feuilles (formulaires) ---------- */
const opt = (v, l, sel) => `<option value="${esc(v)}"${sel === v ? ' selected' : ''}>${esc(l)}</option>`;
function guestSheet(g) {
  g = g || { name: '', plus: 0, brings: '', status: 'wait' };
  return `<h2 class="h2">${g.id ? 'Modifier l’invité' : 'Nouvel invité'}</h2>
    <form class="form" data-form="guest" data-id="${g.id || ''}">
      <label class="f">Prénom<input class="in" id="g-name" name="name" required maxlength="30" value="${esc(g.name)}" ${g.id ? '' : 'data-focus'} autocomplete="off"></label>
      <div class="f-row"><label class="f">Réponse<select class="in" id="g-status" name="status">${Object.entries(STATUS).map(([k, l]) => opt(k, l, g.status)).join('')}</select></label>
      <label class="f">Accompagnants<select class="in" id="g-plus" name="plus">${[0, 1, 2, 3, 4].map(n => opt(String(n), n ? '+' + n : 'Aucun', String(g.plus || 0))).join('')}</select></label></div>
      <label class="f">Ramène quoi ?<input class="in" id="g-brings" name="brings" maxlength="40" placeholder="Chips, enceinte, bonne humeur" value="${esc(g.brings)}"></label>
      <button class="btn world" name="go" value="save">${g.id ? 'Enregistrer' : 'Ajouter'}</button>
      ${g.id ? `<button type="button" class="btn danger" data-act="guest-del" data-id="${g.id}">Retirer de la liste</button>` : `<button class="btn alt" name="go" value="more">Ajouter et continuer</button>`}
    </form>`;
}
function itemSheet(i, p) {
  i = i || { name: '', qty: 1, unit: '', cat: 'alcool', price: '', who: '' };
  return `<h2 class="h2">${i.id ? 'Modifier l’article' : 'Nouvel article'}</h2>
    <form class="form" data-form="item" data-id="${i.id || ''}">
      <label class="f">Quoi ?<input class="in" id="i-name" name="name" required maxlength="40" value="${esc(i.name)}" ${i.id ? '' : 'data-focus'} autocomplete="off" placeholder="Tonic"></label>
      <div class="f-row"><label class="f">Quantité<input class="in" id="i-qty" name="qty" type="number" inputmode="decimal" min="0" step="any" value="${i.qty || ''}"></label>
      <label class="f">Unité<input class="in" id="i-unit" name="unit" maxlength="20" value="${esc(i.unit)}" placeholder="bouteilles"></label></div>
      <div class="f-row"><label class="f">Rayon<select class="in" id="i-cat" name="cat">${CATS.map(c => opt(c.id, c.label, i.cat)).join('')}</select></label>
      <label class="f">Prix à l’unité (€)<input class="in" id="i-price" name="price" type="number" inputmode="decimal" min="0" step="any" value="${i.price || ''}"></label></div>
      <label class="f">Qui s’en charge ?<select class="in" id="i-who" name="who">${opt('', 'L’organisateur', i.who || '')}${guestsOf(p.id).map(g => opt(g.id, g.name, i.who)).join('')}</select></label>
      <button class="btn world">${i.id ? 'Enregistrer' : 'Ajouter à la liste'}</button>
      ${i.id ? `<button type="button" class="btn danger" data-act="item-del" data-id="${i.id}">Supprimer</button>` : ''}
    </form>`;
}
function partySheet(p) {
  return `<h2 class="h2">La soirée</h2>
    <form class="form" data-form="party">
      <label class="f">Nom<input class="in" id="p-name" name="name" required maxlength="40" value="${esc(p.name)}"></label>
      <div class="f-row"><label class="f">Date<input class="in" id="p-date" type="date" name="date" required value="${esc(p.date)}"></label><label class="f">Heure<input class="in" id="p-time" type="time" name="time" required value="${esc(p.time)}"></label></div>
      <label class="f">Lieu<input class="in" id="p-place" name="place" maxlength="60" value="${esc(p.place)}"></label>
      <label class="f">Ambiance<select class="in" id="p-theme" name="theme">${THEMES.map(t => opt(t.id, t.emo + ' ' + t.label, p.theme)).join('')}</select></label>
      <button class="btn world">Enregistrer</button>
      <button type="button" class="btn danger" data-act="party-del">Supprimer la soirée</button>
    </form>`;
}
function inviteText(p) {
  return `${theme(p).emo} ${p.name}\n${fmtDate(p)} à ${p.time}${p.place ? '\n' + p.place : ''}\n\nTu viens ? Dis-moi aussi si tu ramènes quelqu’un ou quelque chose.${p.host ? '\n' + p.host : ''}`;
}

/* Calculateur de courses. */
let C = null;
function calcSheet() {
  const lines = estimateShopping(C.n, C.hours, C.thirst);
  const total = lines.reduce((s, l, i) => s + (C.off.has(i) ? 0 : l.qty * l.price), 0);
  const step = (k, label, v, suffix) => `<div class="sugg"><span>${label}</span><div class="stepper sm"><button class="ico-btn" data-act="calc-step" data-k="${k}" data-d="-1" aria-label="Moins">−</button><b class="num">${v}${suffix}</b><button class="ico-btn" data-act="calc-step" data-k="${k}" data-d="1" aria-label="Plus">${ico('plus', 18)}</button></div></div>`;
  return `<div class="limo-say">${limo('wink', 72)}<div class="bubble" style="margin-bottom:14px">Règle maison : un verre par personne et par heure, plus celui de l’arrivée.</div></div>
    ${step('n', 'Personnes', C.n, '')}${step('hours', 'Durée', C.hours, ' h')}
    <div class="seg">${['Sages', 'Normaux', 'Assoiffés'].map((l, i) => `<button class="${C.thirst === i ? 'on' : ''}" data-act="calc-thirst" data-i="${i}">${l}</button>`).join('')}</div>
    <div>${lines.map((l, i) => `<div class="sugg"><button class="check${C.off.has(i) ? '' : ' on'}" data-act="calc-toggle" data-i="${i}" aria-label="${esc(l.name)}" aria-pressed="${!C.off.has(i)}">${ico('check', 18)}</button><span>${l.name}</span><em class="num muted" style="font-style:normal;font-weight:700">${l.qty} ${l.unit}</em></div>`).join('')}</div>
    <button class="btn world" data-act="calc-apply">Ajouter à la liste · environ ${euro(Math.round(total))}</button>`;
}

/* Fiche cocktail. */
let CK = null;
const fmtQ = q => { const r = Math.round(q * 2) / 2; return r === 0.5 ? '½' : r.toLocaleString('fr-FR'); };
function cocktailSheet() {
  const ck = COCKTAILS.find(c => c.id === CK.id), p = cur(), its = itemsOf(p.id);
  const miss = missingFor(ck, its), scale = CK.serv / (ck.batch || 1), fav = (p.favs || {})[ck.id];
  return `<div class="ck-hero">${glassSVG(ck, 130)}<div class="stack" style="gap:8px"><h2>${ck.name}</h2>
      <span class="dots" style="justify-content:flex-start">${[1, 2, 3].map(n => `<i class="${ck.str >= n ? 'f' : ''}"></i>`).join('')}</span>
      <div class="stepper sm" style="justify-content:flex-start"><button class="ico-btn" data-act="ck-serv" data-d="-1" aria-label="Moins">−</button><b class="num">${CK.serv}</b><button class="ico-btn" data-act="ck-serv" data-d="1" aria-label="Plus">${ico('plus', 18)}</button><span class="muted" style="font-weight:700">${CK.serv > 1 ? 'verres' : 'verre'}</span></div></div></div>
    <div>${ck.ing.map(g => `<div class="ing"><i class="${miss.includes(g) ? 'ko' : 'ok'}">${miss.includes(g) ? '!' : '✓'}</i><span>${g.n}</span><em>${fmtQ(g.q * scale)} ${g.u}</em></div>`).join('')}</div>
    ${miss.length ? `<button class="btn world" data-act="ck-missing">Ajouter ${plural(miss.length, 'ingrédient manquant', 'ingrédients manquants')} aux courses</button>` : '<p class="tag" style="align-self:flex-start;background:var(--yes);color:var(--ink);padding:6px 10px">Tu as tout ce qu’il faut</p>'}
    <ol class="steps">${ck.steps.map(s => `<li>${s}</li>`).join('')}</ol>
    <button class="btn alt" data-act="ck-fav">${fav ? 'Retirer de la carte du soir' : 'Mettre à la carte du soir'}</button>`;
}

/* ---------- visionneuse photo ---------- */
const LB = { i: 0, show: false, timer: null };
function lbRender(full) {
  const el = $('#lightbox'), ph = photosOf(R.pid);
  if (!ph.length) return lbClose();
  LB.i = (LB.i + ph.length) % ph.length;
  const f = ph[LB.i], likes = f.likes || {}, n = Object.values(likes).filter(Boolean).length;
  const bot = `<div class="lb-cap">${f.byName ? 'Par ' + esc(f.byName) : ''}</div>
    <button class="lb-btn${likes[Store.S.uid] ? ' on' : ''}" data-act="lb-like" aria-label="J’adore">${ico('flame', 20)}<span class="num">${n || ''}</span></button>
    <button class="lb-btn" data-act="lb-del" aria-label="Supprimer la photo">${ico('trash', 20)}</button>`;
  if (!full && el.dataset.id === f.id) { $('.lb-bot', el).innerHTML = bot; return; }
  el.dataset.id = f.id;
  el.classList.toggle('show', LB.show);
  el.innerHTML = `<div class="lb-top"><button class="lb-btn" data-act="lb-close" aria-label="Fermer">${ico('x', 20)}</button><span class="num" style="font-weight:800">${LB.i + 1} / ${ph.length}</span>
      <button class="lb-btn${LB.show ? ' on' : ''}" data-act="lb-show">${ico('play', 18)} Diaporama</button></div>
    <div class="lb-stage"><img src="${f.src}" alt="Photo ${LB.i + 1}"><button class="lb-nav l" data-act="lb-prev" aria-label="Photo précédente"></button><button class="lb-nav r" data-act="lb-next" aria-label="Photo suivante"></button></div>
    <div class="lb-bot">${bot}</div>`;
  el.hidden = false;
}
function lbClose() { clearInterval(LB.timer); LB.show = false; const el = $('#lightbox'); el.hidden = true; el.dataset.id = ''; el.innerHTML = ''; }
function lbShow(on) {
  LB.show = on;
  clearInterval(LB.timer);
  if (on) LB.timer = setInterval(() => { LB.i++; lbRender(true); }, 3800);
  lbRender(true);
}

/* ---------- compte à rebours ---------- */
function tickCountdown() {
  const el = $('#cd');
  if (!el) return;
  let s = Math.max(0, Math.floor((+el.dataset.at - Date.now()) / 1000));
  const v = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
  $$('div', el).forEach((d, i) => {
    const b = $('b', d), t = String(v[i]).padStart(i ? 2 : 1, '0');
    if (b.textContent !== t) { b.textContent = t; d.classList.remove('tick'); void d.offsetWidth; d.classList.add('tick'); }
  });
}
