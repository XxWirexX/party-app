/* Zeste — écrans : bienvenue, invitation, accueil, assistant, et les cinq onglets d'une soirée. */
let R = { screen: 'home', pid: null, tab: 'qg', night: false, game: null, shopMode: 'list', barFilter: 'all', code: null };
let W = null; // assistant de création
let J = null; // invitation en cours : { code, data, claim }
const TABS = [['qg', 'QG'], ['guests', 'Invités'], ['shop', 'Courses'], ['bar', 'Bar'], ['gallery', 'Galerie']];
const TAB_WORLD = { qg: 'home', guests: 'guests', shop: 'shop', bar: 'bar', gallery: 'gallery' };
const STATUS = { wait: 'En attente', yes: 'Vient', maybe: 'Peut-être', no: 'Ne vient pas' };
const ROLES = { host: 'Orga', editor: 'Participe', viewer: 'Suit' };

/* ---------- accès à la soirée ouverte ---------- */
const P = () => Store.S.P;
const myM = () => P().members.find(m => m.id === P().me) || {};
const canEdit = () => ['host', 'editor'].includes(myM().role);
const isHost = () => myM().role === 'host';
const mName = id => { const m = P().members.find(x => x.id === id); return m ? m.name : ''; };
const me = () => (Store.S.me ? Store.S.me.name : '');

const partyDate = p => new Date((p.date || '2030-01-01') + 'T' + (p.time || '20:00'));
const dayDiff = p => { const a = new Date(); a.setHours(0, 0, 0, 0); const b = partyDate(p); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5); };
const fmtDate = p => partyDate(p).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = p => partyDate(p).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const headcount = ms => ms.filter(g => g.status === 'yes').reduce((s, g) => s + 1 + (g.plus || 0), 0);
const theme = p => THEMES.find(t => t.id === p.theme) || THEMES[0];
const jLabel = d => (d === 0 ? 'Ce soir' : d > 0 ? 'J-' + d : 'J+' + -d);
const estOf = i => (i.qty || 1) * (i.price || 0);
const costOf = i => (i.bought && i.paid_amount != null ? i.paid_amount : estOf(i));
const photoURL = id => `${Store.base()}/photos/${id}`;
const inviteLink = extra => `${location.origin}/j/${P().party.invite_code}${extra || ''}`;
const sortedMembers = () => [...P().members].sort((a, b) => (b.id === P().me) - (a.id === P().me) || (b.role === 'host') - (a.role === 'host') || a.name.localeCompare(b.name));

/* ---------- routes ---------- */
function parsePath() {
  const s = location.pathname.split('/').filter(Boolean);
  if (s[0] === 'p' && s[1]) return s[2] === 'night' ? { screen: 'party', pid: s[1], night: true } : { screen: 'party', pid: s[1], night: false, tab: TABS.some(t => t[0] === s[2]) ? s[2] : 'qg' };
  if (s[0] === 'j' && s[1]) return { screen: 'join', code: s[1] };
  if (s[0] === 'l' && s[1]) return { screen: 'link', code: s[1] };
  return { screen: 'home', pid: null, night: false };
}
const pathOf = r => (r.screen === 'party' ? `/p/${r.pid}${r.night ? '/night' : r.tab === 'qg' ? '' : '/' + r.tab}` : r.screen === 'join' ? '/j/' + r.code : '/');

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(false); });
}
function render(anim) {
  const v = $('#view'), nav = $('#tabs'), S = Store.S;
  if (!S.ready) return;
  const top = v.scrollTop;
  let html, tabs = false;
  if (R.screen === 'join') html = joinView();
  else if (!S.me) html = welcomeView();
  else if (R.screen === 'wizard') html = wizardView();
  else if (R.screen === 'party' && P()) { if (R.night) html = nightView(P().party); else { html = partyView(); tabs = true; } }
  else html = homeView();
  v.innerHTML = html;
  v.classList.toggle('no-tabs', !tabs);
  v.dataset.screen = R.screen === 'party' && R.night ? 'night' : R.screen;
  $('#app').classList.toggle('has-rail', tabs);
  nav.hidden = !tabs;
  if (tabs) {
    if (!nav.children.length) nav.innerHTML = `<button class="rail-head logo" data-act="home">Zeste<i></i></button>
      <div class="tab-set"><i class="blob"></i>${TABS.map(([k, l]) => `<button data-act="tab" data-tab="${k}">${ico(k)}<span>${l}</span></button>`).join('')}</div>
      <button class="rail-foot night-cta" data-act="night"><span class="disco"></span><span><b>Mode soirée</b></span></button>`;
    const i = TABS.findIndex(t => t[0] === R.tab);
    $('.blob', nav).style.setProperty('--i', i);
    $$('.tab-set button', nav).forEach((b, n) => { b.classList.toggle('on', n === i); b.setAttribute('aria-current', n === i ? 'page' : 'false'); });
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
  $$('[data-type]').forEach(el => typeInto(el, el.dataset.type));
  if (R.screen === 'party' && P()) coach(R.night ? (R.game ? '' : 'night') : R.tab); else $('#coach').classList.remove('on');
}
async function go(patch, pt, opts = {}) {
  const next = { ...R, ...patch };
  if (next.screen === 'party') {
    if (!Store.S.me || !(await Store.open(next.pid))) { if (Store.S.me) toast('Soirée introuvable, ou tu n’y as plus accès.'); Object.assign(next, { screen: 'home', pid: null, night: false, game: null }); }
  }
  if (next.screen !== 'party') { Store.close(); if (next.screen === 'home' && Store.S.me) Store.refreshHome(); }
  R = next;
  if (!opts.silent) { const path = pathOf(R); if (path !== location.pathname) history[opts.replace ? 'replaceState' : 'pushState'](null, '', path); }
  setWorld(R.screen === 'party' ? (R.night ? 'night' : TAB_WORLD[R.tab]) : 'home', pt);
  if (reduced() || opts.instant) return render(true);
  $('#view').classList.add('leave');
  setTimeout(() => render(true), 130);
}
const ptOf = e => (e && e.clientX != null ? { x: e.clientX, y: e.clientY } : { x: innerWidth / 2, y: innerHeight / 2 });

/* ---------- bienvenue et invitation ---------- */
function welcomeView() {
  return `<header class="home-head"><div class="logo">Zeste<i></i></div></header>
    <div class="limo-say">${limo('happy', 120, true)}<div class="bubble"><span data-type="Salut ! Moi c’est Limo, ton citron vert de soirée. Invités, courses, comptes, cocktails, jeux : je gère avec toi. C’est quoi ton prénom ?"></span></div></div>
    <form class="form" data-form="welcome"><input class="in" id="w-name" name="name" placeholder="Ton prénom" maxlength="24" autocomplete="given-name" required data-focus>
    <button class="btn">C’est parti</button></form>
    ${Store.S.offline ? '<p class="note">Impossible de joindre le serveur pour l’instant.</p>' : ''}`;
}
function ticketHTML(p, i, o = {}) {
  const t = theme(p), d = dayDiff(p), tag = o.static ? 'div' : 'button';
  return `<${tag} class="ticket${d < 0 ? ' past' : ''}" ${o.static ? '' : `data-act="open" data-id="${p.id}"`} style="--tilt:${[-1.4, 1.1, -0.6][i % 3]}deg;--c:var(${t.c})">
    <span class="tk-main"><span class="tk-emo">${t.emo}</span><h3>${esc(p.name)}</h3><p>${esc(fmtShort(p))} · ${esc(p.time || '')}${p.place ? ' · ' + esc(p.place) : ''}</p>
    ${o.static ? '' : `<p><span class="tag">${p.role === 'host' ? 'Tu organises' : STATUS[p.status] === 'Vient' ? 'Tu viens' : p.status === 'wait' ? 'Réponse attendue' : STATUS[p.status]}</span></p>`}</span>
    <span class="tk-stub"><b>${jLabel(d)}</b><span>${p.going ? plural(p.going, 'présent') : o.static ? '' : 'Voir'}</span></span></${tag}>`;
}
function joinView() {
  if (!J || !J.data) return `<div class="loading">${limo('wow', 110)}<p>${J && J.error ? esc(J.error) : 'J’ouvre l’invitation…'}</p>${J && J.error ? '<button class="btn sm" data-act="home">Aller à l’accueil</button>' : ''}</div>`;
  const d = J.data, p = d.party, user = Store.S.me;
  const claimName = J.claim ? (d.ghosts.find(g => g.id === J.claim) || {}).name : '';
  return `<header class="home-head"><div class="logo">Zeste<i></i></div></header>
    <div class="limo-say">${limo('happy', 104, true)}<div class="bubble"><span data-type="${esc((p.host || 'Quelqu’un') + ' t’invite ! Dis-moi qui tu es et si tu viens.')}"></span></div></div>
    ${ticketHTML(p, 0, { static: true })}
    <form class="form" data-form="join">
      ${d.ghosts.length ? `<p class="eyebrow">Tu es déjà sur la liste ?</p><div class="chips">${d.ghosts.map(g => `<button type="button" class="chip${J.claim === g.id ? ' on' : ''}" data-act="join-claim" data-id="${g.id}">C’est moi, ${esc(g.name)}</button>`).join('')}
        <button type="button" class="chip${J.claim ? '' : ' on'}" data-act="join-claim" data-id="">Non, je suis nouveau</button></div>` : ''}
      ${user ? `<p class="muted" style="font-weight:700">Tu rejoins en tant que ${esc(claimName || user.name)}.</p>`
        : `<label class="f">Ton prénom<input class="in" id="j-name" name="name" maxlength="24" required autocomplete="given-name" value="${esc(claimName)}" placeholder="Ton prénom"></label>`}
      <p class="eyebrow">Tu viens ?</p>
      <div class="rsvp"><button class="btn rs-yes" name="status" value="yes">Je viens</button><button class="btn rs-maybe" name="status" value="maybe">Peut-être</button><button class="btn rs-no" name="status" value="no">Pas dispo</button></div>
    </form>`;
}

/* ---------- accueil ---------- */
function homeView() {
  const S = Store.S, ps = S.parties;
  const next = ps.filter(p => dayDiff(p) >= 0), past = ps.filter(p => dayDiff(p) < 0).reverse(), name = me();
  let say, mood = 'happy';
  if (!ps.length) say = `Salut ${name} ! Aucune soirée en vue… On en organise une ?`;
  else if (!next.length) { say = 'Plus rien au programme ? C’est triste. Relance la machine !'; mood = 'sad'; }
  else {
    const d = dayDiff(next[0]);
    say = d === 0 ? `C’est CE SOIR : « ${next[0].name} ». Tout est prêt ?` : d === 1 ? `« ${next[0].name} », c’est demain. Les glaçons sont au congélateur ?` : `Plus que ${d} jours avant « ${next[0].name} ». On fait le point ?`;
    mood = d <= 1 ? 'wow' : 'happy';
  }
  return `<header class="home-head"><div class="logo">Zeste<i></i></div><button class="me-chip" data-act="me">${esc(name)}</button></header>
    <div class="limo-say">${limo(mood, 108, true)}<div class="bubble"><span data-type="${esc(say)}">${esc(say)}</span></div></div>
    ${S.offline ? '<p class="note">Connexion capricieuse : ces infos ne sont peut-être pas à jour.</p>' : ''}
    ${next.length ? `<p class="eyebrow">À venir</p><div class="tickets">${next.map((p, i) => ticketHTML(p, i)).join('')}</div>` : ''}
    <button class="btn" data-act="new">${ico('plus')} Nouvelle soirée</button>
    ${past.length ? `<p class="eyebrow">Souvenirs</p><div class="tickets">${past.map((p, i) => ticketHTML(p, i)).join('')}</div>` : ''}`;
}

/* ---------- assistant de création ---------- */
function startWizard() {
  const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  W = { i: 0, steps: ['name', 'when', 'where', 'theme', 'count', 'access'], name: '', date: iso, time: '21:00', place: '', theme: 'dance', count: 12, access: 'editor' };
}
const countLine = n => (n <= 6 ? 'Petit comité, grandes discussions.' : n <= 15 ? 'Le format parfait : assez pour danser, pas assez pour fâcher les voisins.' : n <= 30 ? 'Ça commence à faire du monde. Préviens les voisins !' : 'Là, c’est un festival. Respect.');
function wizardLine() {
  return { name: `Allez ${me()}, elle s’appelle comment, cette soirée ?`, when: 'C’est noté. On cale ça quand ?', where: 'Et ça se passe où ?', theme: 'C’est quoi l’ambiance ?',
    count: 'Vous serez combien, à peu près ? ' + countLine(W.count), access: 'Dernière question : tes invités, ils mettent la main à la pâte ou ils suivent ? Tu pourras changer, même personne par personne.' }[W.steps[W.i]];
}
const ACCESS = [['editor', 'Tout le monde participe', 'Chacun peut modifier les courses, la check-list, le bar et les comptes.'], ['viewer', 'Les invités suivent', 'Ils voient tout, répondent à l’invitation et postent leurs photos. Toi seul modifies.']];
function wizardView() {
  const k = W.steps[W.i], last = W.i === W.steps.length - 1;
  const body = {
    name: `<input class="in" id="wz-name" name="name" placeholder="Anniv de Léa" maxlength="40" value="${esc(W.name)}" data-focus>
      <div class="chips">${NAME_IDEAS.map(n => `<button type="button" class="chip" data-act="wz-idea">${n}</button>`).join('')}</div>`,
    when: `<div class="f-row"><label class="f">Le<input class="in" id="wz-date" type="date" name="date" value="${W.date}" required></label>
      <label class="f">À<input class="in" id="wz-time" type="time" name="time" value="${W.time}" required></label></div>`,
    where: `<input class="in" id="wz-place" name="place" placeholder="Chez moi, 3e étage" maxlength="60" value="${esc(W.place)}" data-focus>`,
    theme: `<div class="theme-grid">${THEMES.map(t => `<button type="button" class="theme${t.id === W.theme ? ' on' : ''}" style="--c:var(${t.c})" data-act="wz-theme" data-id="${t.id}"><span>${t.emo}</span>${t.label}</button>`).join('')}</div>`,
    count: `<div class="stepper"><button type="button" class="ico-btn" data-act="wz-count" data-d="-1" aria-label="Moins">−</button><b id="wz-n" class="num">${W.count}</b><button type="button" class="ico-btn" data-act="wz-count" data-d="1" aria-label="Plus">${ico('plus')}</button></div>`,
    access: `<div class="stack">${ACCESS.map(a => `<button type="button" class="choice${W.access === a[0] ? ' on' : ''}" data-act="wz-access" data-id="${a[0]}"><b>${a[1]}</b><small>${a[2]}</small></button>`).join('')}</div>`,
  }[k];
  return `<div class="wz-top"><button class="ico-btn" data-act="wz-back" aria-label="Retour">${ico(W.i ? 'back' : 'x')}</button><div class="wz-bar"><i style="width:${((W.i + 1) / W.steps.length) * 100}%"></i></div></div>
    <div class="limo-say">${limo(k === 'count' ? 'wow' : 'happy', 104)}<div class="bubble"><span id="wz-say" data-type="${esc(wizardLine())}"></span></div></div>
    <form class="wz-body" data-form="wz" style="flex:1">${body}<div class="wz-foot"><button class="btn">${last ? 'Créer la soirée' : 'Continuer'}</button></div></form>`;
}

/* ---------- soirée ---------- */
function partyView() {
  const p = P().party, t = theme(p);
  const head = `<header class="p-head"><button class="ico-btn" data-act="home" aria-label="Mes soirées">${ico('back')}</button>
    <div class="p-name">${t.emo} ${esc(p.name)}</div>${Store.S.offline ? '<span class="tag">Hors ligne</span>' : ''}<button class="night-btn" data-act="night">${ico('disco', 18)} Mode soirée</button></header>`;
  return head + { qg: qgView, guests: guestsView, shop: shopView, bar: barView, gallery: galleryView }[R.tab](p);
}
const rsvpCard = (title) => {
  const m = myM();
  return `<section class="card stack"><p class="h2">${title}</p>
    <div class="rsvp">${[['yes', 'Je viens'], ['maybe', 'Peut-être'], ['no', 'Pas dispo']].map(([k, l]) => `<button class="btn rs-${k}${m.status === k ? ' on' : ''}" data-act="rsvp" data-s="${k}" aria-pressed="${m.status === k}">${l}</button>`).join('')}</div>
    <button class="link" data-act="member-edit" data-id="${m.id}">${m.plus || m.brings ? `${m.plus ? '+' + m.plus + ' · ' : ''}${m.brings ? 'Je ramène : ' + esc(m.brings) : 'Rien à ramener pour l’instant'} · Modifier` : 'Je viens accompagné, je ramène quelque chose…'}</button></section>`;
};

function tipFor(p, d) {
  const b = P(), gs = b.members, its = b.items;
  const pend = gs.filter(g => g.status === 'wait').length, left = its.filter(i => !i.bought).length, ed = canEdit();
  if (d < 0) return { t: 'Quelle soirée ! Balance les photos dans la galerie avant d’oublier.', mood: 'cool', act: 'tab', tab: 'gallery', label: 'Ouvrir la galerie' };
  if (gs.length <= 1) return { t: 'Une soirée sans invités, ça s’appelle une soirée télé. Envoie le lien !', mood: 'sad', act: 'invite', label: 'Inviter du monde' };
  if (!its.length && ed) return { t: 'La liste de courses est vide. Laisse-moi calculer les quantités.', mood: 'wink', act: 'calc', label: 'Calculer les courses' };
  if (d === 0) return { t: 'C’est ce soir ! Lance le mode soirée quand tout le monde est là.', mood: 'wow' };
  if (pend && d <= 5) return { t: `${plural(pend, 'invité')} ${pend > 1 ? 'n’ont' : 'n’a'} toujours pas répondu. Relance, sans pitié.`, mood: 'wink', act: 'tab', tab: 'guests', label: 'Voir les invités' };
  if (its.length && !its.some(i => /gla[cç]/i.test(i.name))) return { t: 'Pas de glaçons dans la liste. Compte 1 kg pour 5 personnes.', mood: 'wow', act: 'tab', tab: 'shop', label: 'Ouvrir les courses' };
  if (left && d <= 1) return { t: `Il reste ${plural(left, 'article')} à acheter et c’est demain !`, mood: 'wow', act: 'tab', tab: 'shop', label: 'Voir la liste' };
  const acc = computeAccounts(b), mine = acc.sugg.find(s => s.from === b.me);
  if (mine) return { t: `Tu dois ${euro(mine.amount)} à ${mName(mine.to)}. Les bons comptes font les bons amis.`, mood: 'wink', act: 'shop-mode', mode: 'accounts', label: 'Voir les comptes' };
  return { t: 'Tout roule. On gère comme des chefs.', mood: 'cool' };
}

function qgView(p) {
  const b = P(), gs = b.members, its = b.items, d = dayDiff(p), ed = canEdit();
  const yes = headcount(gs), answered = gs.filter(g => g.status !== 'wait').length, bought = its.filter(i => i.bought).length;
  const total = its.reduce((s, i) => s + costOf(i), 0) + b.expenses.reduce((s, e) => s + e.amount, 0), heads = Math.max(yes, p.expected || 1);
  const tip = tipFor(p, d), future = partyDate(p) > new Date(), done = b.tasks.filter(t => t.done).length;
  return `<div class="title-row"><h1 class="title">${esc(p.name)}</h1>${isHost() ? `<button class="ico-btn" data-act="party-edit" aria-label="Modifier la soirée">${ico('edit', 20)}</button>` : ''}</div>
    <div class="cols"><div class="col">
    <section class="card stack">
      <div class="hero-meta"><span>${esc(fmtDate(p))} à ${esc(p.time || '')}</span>${p.place ? `<span class="muted">${esc(p.place)}</span>` : ''}</div>
      ${future ? `<div class="cd" id="cd" data-at="${partyDate(p).getTime()}"><div><b>0</b><span>jours</span></div><div><b>0</b><span>heures</span></div><div><b>0</b><span>min</span></div><div><b>0</b><span>sec</span></div></div>`
        : `<p class="h2">${d === 0 ? 'C’est maintenant !' : 'C’était il y a ' + plural(-d, 'jour') + '.'}</p>`}
    </section>
    ${myM().status === 'wait' ? rsvpCard('Tu viens ?') : ''}
    <div class="gauges">
      <button class="gauge-card" data-act="tab" data-tab="guests"><span class="ring" style="--p:${gs.length ? (answered / gs.length) * 100 : 0};--c:var(--w-pink)"><b class="num">${yes}</b></span><small>${yes > 1 ? 'présents' : 'présent'}<br>sur ${plural(gs.length, 'invité')}</small></button>
      <button class="gauge-card" data-act="tab" data-tab="shop"><span class="ring" style="--p:${its.length ? (bought / its.length) * 100 : 0};--c:var(--w-mint)"><b class="num">${bought}</b></span><small>${bought > 1 ? 'achetés' : 'acheté'}<br>sur ${plural(its.length, 'article')}</small></button>
      <button class="gauge-card" data-act="shop-mode" data-mode="accounts"><span class="ring" style="--p:100;--c:var(--w-orange)"><b class="num">${Math.round(total / heads)}€</b></span><small>par personne<br>${euro(Math.round(total))} au total</small></button>
    </div>
    ${limoSay(esc(tip.t), tip.mood, 84, tip.act ? `<button class="btn sm world" data-act="${tip.act}" data-tab="${tip.tab || ''}" data-mode="${tip.mode || ''}">${tip.label}</button>` : '')}
    <button class="night-cta" data-act="night"><span class="disco"></span><span><b>Mode soirée</b><small>Jeux, roue, bouteille, bombe…</small></span></button>
    </div><div class="col">
    <div class="list-label"><p class="eyebrow">Check-list · ${done} / ${b.tasks.length}</p>${ed ? `<button class="link" data-act="task-add">${ico('plus', 14)} Ajouter une tâche</button>` : ''}</div>
    ${b.tasks.length ? `<ul class="list">${b.tasks.map(t => `<li class="row${t.done ? ' done' : ''}"><button class="check${t.done ? ' on' : ''}" data-act="task" data-id="${t.id}" aria-label="${esc(t.label)}" aria-pressed="${!!t.done}" ${ed ? '' : 'disabled'}>${ico('check', 18)}</button>
      <${ed ? 'button' : 'div'} class="row-main" ${ed ? `data-act="task-edit" data-id="${t.id}"` : ''}><b>${esc(t.label)}</b></${ed ? 'button' : 'div'}>${t.when_label ? `<span class="when">${esc(t.when_label)}</span>` : ''}</li>`).join('')}</ul>`
      : '<p class="note">La check-list est vide.</p>'}
    </div></div>`;
}

function guestsView() {
  const gs = sortedMembers(), n = k => gs.filter(g => g.status === k).length, yes = headcount(gs), ed = canEdit(), meId = P().me;
  const bar = ['yes', 'maybe', 'no', 'wait'].map(k => `<i style="flex-grow:${n(k)};background:var(--${k})"></i>`).join('');
  const tags = g => [g.id === meId ? 'Toi' : '', g.role === 'host' ? 'Orga' : '', g.linked && g.role === 'viewer' ? 'Suit' : '', g.plus ? '+' + g.plus : ''].filter(Boolean).map(t => `<span class="tag">${t}</span>`).join(' ');
  const row = g => {
    const mine = g.id === meId, open = ed || mine;
    const sub = [g.linked ? '' : 'Pas encore sur l’appli', g.brings ? 'Ramène : ' + esc(g.brings) : ''].filter(Boolean).join(' · ');
    return `<li class="row"><span class="ava${g.linked ? '' : ' ghost'}" style="--h:${hue(g.name)}">${esc(initials(g.name))}</span>
      <${open ? 'button' : 'div'} class="row-main" ${open ? `data-act="member-edit" data-id="${g.id}"` : ''}><b>${esc(g.name)} ${tags(g)}</b>${sub ? `<small>${sub}</small>` : ''}</${open ? 'button' : 'div'}>
      <${open ? 'button' : 'span'} class="status s-${g.status}" ${open ? `data-act="guest-cycle" data-id="${g.id}"` : ''}>${STATUS[g.status]}</${open ? 'button' : 'span'}></li>`;
  };
  return `<div class="title-row"><h1 class="title">Invités</h1><button class="btn sm" data-act="invite">${ico('plus', 18)} Inviter</button></div>
    <div class="cols"><div class="col">
    ${rsvpCard('Ta réponse')}
    <section class="card stack"><div class="big-count"><b class="num">${yes}</b><span>${yes > 1 ? 'personnes viennent' : 'personne vient'}<br><span class="muted">${plural(gs.length, 'personne')} sur la liste</span></span></div>
      <div class="statbar">${bar}</div>
      <div class="legend"><span style="--c:var(--yes)">${n('yes')} oui</span><span style="--c:var(--maybe)">${n('maybe')} peut-être</span><span style="--c:var(--no)">${n('no')} non</span><span style="--c:var(--wait)">${n('wait')} en attente</span></div></section>
    ${ed ? `<button class="btn alt" data-act="member-add">${ico('plus')} Ajouter quelqu’un sans l’appli</button>` : ''}
    ${!ed ? `<p class="note">Tu suis cette soirée : tu gères ta réponse et tes photos, les organisateurs s’occupent du reste.</p>` : ''}
    </div><div class="col">
    <ul class="list">${gs.map(row).join('')}</ul>
    </div></div>`;
}

function shopView(p) {
  const b = P(), its = b.items, ed = canEdit(), mode = R.shopMode;
  const seg = `<div class="seg" role="tablist">${[['list', 'Liste'], ['stock', 'Stock'], ['accounts', 'Comptes']].map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="shop-mode" data-mode="${k}">${l}</button>`).join('')}</div>`;
  const head = `<div class="title-row"><h1 class="title">Courses</h1>${ed ? (mode === 'accounts' ? `<button class="btn sm" data-act="expense-add">${ico('plus', 18)} Dépense</button>` : `<button class="btn sm" data-act="item-add">${ico('plus', 18)} Article</button>`) : ''}</div>`;
  if (mode === 'accounts') return head + seg + accountsView();
  const stock = mode === 'stock';
  const total = its.reduce((s, i) => s + costOf(i), 0), paid = its.filter(i => i.bought).reduce((s, i) => s + costOf(i), 0);
  const heads = Math.max(headcount(b.members), p.expected || 1);
  const row = i => {
    const sub = [i.qty ? `${fmtQ(i.qty)} ${esc(i.unit || '')}`.trim() : '', esc(i.note || ''), i.bought ? (i.paid_by ? 'payé par ' + esc(mName(i.paid_by)) : '') : (i.assignee && mName(i.assignee) ? esc(mName(i.assignee)) + ' s’en charge' : '')].filter(Boolean).join(' · ');
    if (stock) {
      const lv = i.level == null ? 3 : i.level, col = ['--no', '--no', '--maybe', '--yes'][lv];
      return `<li class="row"><div class="row-main"><b>${esc(i.name)}</b><small>${['À sec', 'Presque vide', 'Entamé', 'Plein'][lv]}</small></div>
        <div class="lvl" style="--c:var(${col})">${[1, 2, 3].map(n => `<button class="${lv >= n ? 'f' : ''}" data-act="stock" data-id="${i.id}" data-lvl="${n}" aria-label="Niveau ${n} sur 3" ${ed ? '' : 'disabled'}></button>`).join('')}</div></li>`;
    }
    return `<li class="row${i.bought ? ' done' : ''}"><button class="check${i.bought ? ' on' : ''}" data-act="item-toggle" data-id="${i.id}" aria-label="Acheté : ${esc(i.name)}" aria-pressed="${!!i.bought}" ${ed ? '' : 'disabled'}>${ico('check', 18)}</button>
      <${ed ? 'button' : 'div'} class="row-main" ${ed ? `data-act="item-edit" data-id="${i.id}"` : ''}><b>${esc(i.name)}</b>${sub ? `<small>${sub}</small>` : ''}</${ed ? 'button' : 'div'}>
      ${costOf(i) ? `<span class="price">${euro(costOf(i))}</span>` : ''}</li>`;
  };
  const shown = stock ? its.filter(i => i.bought) : its, dry = its.filter(i => i.bought && i.level === 0);
  const groups = CATS.map(c => [c, shown.filter(i => (i.cat || 'divers') === c.id)]).filter(g => g[1].length);
  let body;
  if (!its.length) body = `<div class="empty">${limoSay(ed ? 'Liste vide. Dis-moi combien vous êtes et je calcule tout : bières, softs, glaçons, chips.' : 'La liste de courses est vide pour l’instant.', 'wink', 96, ed ? `<button class="btn sm world" data-act="calc">${ico('spark', 18)} Calculer pour moi</button>` : '')}</div>`;
  else if (stock && !shown.length) body = `<div class="empty">${limoSay('Rien en stock pour l’instant. Les achats cochés dans la liste arrivent ici.', 'happy', 96)}</div>`;
  else body = (stock && dry.length ? `<p class="alert">À sec : ${dry.map(i => esc(i.name)).join(', ')}. Qui retourne à l’épicerie ?</p>` : '') +
    groups.map(([c, l]) => `<div class="list-label"><p class="eyebrow">${c.label}</p><p class="eyebrow num">${stock ? l.length : l.filter(i => i.bought).length + ' / ' + l.length}</p></div><ul class="list">${l.map(row).join('')}</ul>`).join('');
  return head + seg + `<div class="cols"><div class="col">
    ${its.length && !stock ? `<section class="card budget"><div><b>${euro(Math.round(total))}</b><small>budget estimé</small></div><div><b>${euro(Math.round(paid))}</b><small>déjà acheté</small></div><div><b>${euro(Math.round(total / heads))}</b><small>par personne</small></div></section>` : ''}
    ${its.length && !stock && ed ? `<button class="btn alt" data-act="calc">${ico('spark')} Limo recalcule les quantités</button>` : ''}
    ${stock && shown.length ? '<p class="note">Touche les jauges pendant la soirée pour suivre ce qu’il reste.</p>' : ''}
    </div><div class="col">${body}</div></div>`;
}

function accountsView() {
  const b = P(), a = computeAccounts(b), ed = canEdit(), meId = b.me;
  const rows = a.rows.filter(r => r.paid > 0.004 || r.share > 0.004 || r.up > 0.004 || Math.abs(r.bal) > 0.004).sort((x, y) => y.bal - x.bal);
  const spends = [...b.items.filter(i => i.bought && i.paid_by).map(i => ({ id: i.id, label: i.name, amount: costOf(i), by: i.paid_by, at: i.created_at, item: true })),
    ...b.expenses.map(e => ({ id: e.id, label: e.label, amount: e.amount, by: e.paid_by, at: e.created_at }))].sort((x, y) => String(y.at).localeCompare(String(x.at)));
  const chip = v => (Math.abs(v) < 0.005 ? '<span class="status">Quitte</span>' : `<span class="status ${v > 0 ? 's-yes' : 's-no'}">${v > 0 ? 'On lui doit ' : 'Doit '}${euro(Math.abs(v))}</span>`);
  if (!a.total && !a.upcoming) return `<div class="empty">${limoSay('Aucune dépense pour l’instant. Coche un achat dans la liste, ou note une dépense : je calcule qui doit quoi.', 'happy', 96)}</div>`;
  return `<div class="cols"><div class="col">
    <section class="card budget"><div><b>${euro(a.total)}</b><small>déjà dépensé</small></div><div><b>${euro(a.upcoming)}</b><small>encore à acheter</small></div><div><b>${euro(a.perShare)}</b><small>par personne</small></div></section>
    <div class="list-label"><p class="eyebrow">Qui doit quoi</p></div>
    ${a.sugg.length ? `<ul class="list">${a.sugg.map(s => `<li class="row"><div class="row-main"><b>${esc(mName(s.from))} → ${esc(mName(s.to))}</b><small>${s.from === meId ? 'C’est toi qui dois' : s.to === meId ? 'On te doit' : 'Remboursement conseillé'}</small></div><span class="price">${euro(s.amount)}</span>
        ${ed || s.from === meId || s.to === meId ? `<button class="btn sm world" data-act="settle" data-from="${s.from}" data-to="${s.to}" data-amount="${s.amount}">Réglé</button>` : ''}</li>`).join('')}</ul>`
      : `<p class="note">${a.total ? 'Tout le monde est quitte. Les bons comptes font les bons amis.' : 'Rien à rembourser pour l’instant.'}</p>`}
    <p class="muted" style="font-size:13px;font-weight:600">Partage entre ceux qui viennent, accompagnants compris${a.shares ? ` : ${plural(a.shares, 'part')}` : ''}. ${ed ? 'Tu peux exclure quelqu’un du partage depuis sa fiche.' : ''}</p>
    ${b.transfers.length ? `<div class="list-label"><p class="eyebrow">Déjà remboursé</p></div><ul class="list">${b.transfers.map(t => `<li class="row"><div class="row-main"><b>${esc(mName(t.from_member))} → ${esc(mName(t.to_member))}</b></div><span class="price">${euro(t.amount)}</span>
        ${ed || t.from_member === meId || t.to_member === meId ? `<button class="ico-btn sm" data-act="transfer-del" data-id="${t.id}" aria-label="Annuler ce remboursement">${ico('x', 16)}</button>` : ''}</li>`).join('')}</ul>` : ''}
    </div><div class="col">
    <div class="list-label"><p class="eyebrow">Chacun</p></div>
    <ul class="list">${rows.map(r => `<li class="row"><span class="ava${r.m.linked ? '' : ' ghost'}" style="--h:${hue(r.m.name)}">${esc(initials(r.m.name))}</span>
      <div class="row-main"><b>${esc(r.m.name)}</b><small>A payé ${euro(r.paid)} · sa part ${euro(r.share)}${r.up > 0.004 ? ' · ' + euro(r.up) + ' à venir' : ''}</small></div>${chip(r.bal)}</li>`).join('')}</ul>
    ${a.unassigned > 0.004 ? `<p class="note">${euro(a.unassigned)} d’achats à venir n’ont pas encore de responsable.</p>` : ''}
    ${spends.length ? `<div class="list-label"><p class="eyebrow">Dépenses</p><p class="eyebrow num">${spends.length}</p></div><ul class="list">${spends.map(s => `<li class="row"><${ed ? 'button' : 'div'} class="row-main" ${ed ? `data-act="${s.item ? 'item-edit' : 'expense-edit'}" data-id="${s.id}"` : ''}><b>${esc(s.label)}</b><small>Payé par ${esc(mName(s.by))}${s.item ? ' · courses' : ''}</small></${ed ? 'button' : 'div'}><span class="price">${euro(s.amount)}</span></li>`).join('')}</ul>` : ''}
    </div></div>`;
}

/* ---------- bar ---------- */
const STOP = ['frais', 'fraiche', 'blanc', 'blanche', 'ambre', 'rouge', 'sirop', 'sucre', 'pour', 'avec', 'pile', 'pilee'];
const keysOf = n => { const s = norm(n), w = s.split(/[^a-z0-9]+/).filter(x => x.length >= 3 && !STOP.includes(x)); return [...new Set([s, ...w.slice(0, 1)])]; };
function lighten(hex) { const n = parseInt(hex.slice(1), 16), f = c => Math.round(c + (255 - c) * 0.6); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join(''); }
const customToCk = c => ({ id: c.id, custom: true, raw: c, name: c.name, glass: c.glass, c: [lighten(c.color), c.color], str: c.strength, batch: c.batch > 1 ? c.batch : 0, garnish: 'none',
  ing: (c.ingredients || []).map(g => ({ n: g.n, q: g.q || 0, u: g.u || '', k: keysOf(g.n), cat: 'divers', base: false })), steps: c.steps || [] });
const allCocktails = () => [...P().cocktails.map(customToCk), ...COCKTAILS];
const findCk = id => allCocktails().find(c => c.id === id);
const missingFor = ck => {
  const names = P().items.filter(i => !(i.bought && i.level === 0)).map(i => norm(i.name));
  return ck.ing.filter(g => !g.base && !g.k.some(k => names.some(n => n.includes(k))));
};
const fmtQ = q => { const r = Math.round(q * 2) / 2; return r === 0.5 ? '½' : r.toLocaleString('fr-FR'); };
const strLabel = c => (c.str === 0 ? 'Sans alcool' : ['', 'Léger', 'Classique', 'Costaud'][c.str]);

function barView() {
  const f = R.barFilter, menu = P().party.menu || [], ed = canEdit();
  const all = allCocktails().map(c => ({ c, miss: missingFor(c).length }));
  const list = all.filter(x => (f === 'ok' ? !x.miss : f === 'soft' ? x.c.str === 0 : f === 'fav' ? menu.includes(x.c.id) : f === 'mine' ? x.c.custom : true));
  const chips = [['all', 'Tous'], ['fav', 'La carte du soir'], ['ok', 'Faisables'], ['soft', 'Sans alcool'], ['mine', 'Maison']];
  const empty = { fav: 'Ta carte du soir est vide. Ouvre un cocktail et mets-le à la carte.', mine: 'Aucun cocktail maison. Crée ta recette signature !', ok: 'Rien de faisable avec la liste actuelle. Ouvre une recette et ajoute ce qui manque aux courses.' }[f] || 'Aucun cocktail ici.';
  return `<div class="title-row"><h1 class="title">Le bar</h1><div class="row-btns tight">${ed ? `<button class="btn sm" data-act="ck-new">${ico('plus', 18)} Créer</button>` : ''}<button class="btn sm alt" data-act="shake">Shaker</button></div></div>
    <div class="chips scroll">${chips.map(([k, l]) => `<button class="chip${f === k ? ' on' : ''}" data-act="bar-filter" data-f="${k}">${l}${k === 'fav' && menu.length ? ' · ' + menu.length : ''}</button>`).join('')}</div>
    ${f === 'fav' && list.length ? `<button class="btn alt" data-act="print">${ico('print')} Imprimer la carte du soir</button>` : ''}
    ${list.length ? `<div class="bar-grid">${list.map(({ c, miss }) => `<button class="ck" data-act="ck-open" data-id="${c.id}">
      <span class="badge${miss ? '' : ' ok'}">${miss ? 'manque ' + miss : 'faisable'}</span>${glassSVG(c, 84)}<b>${esc(c.name)}</b>
      <span class="dots" aria-label="Force ${c.str} sur 3">${[1, 2, 3].map(n => `<i class="${c.str >= n ? 'f' : ''}"></i>`).join('')}</span>
      <small>${c.custom ? 'Maison' : c.batch ? 'Pour ' + c.batch + ' verres' : strLabel(c)}${menu.includes(c.id) ? ' · à la carte' : ''}</small></button>`).join('')}</div>`
      : `<div class="empty">${limoSay(empty, 'sad', 96)}</div>`}`;
}

function galleryView() {
  const ph = P().photos;
  return `<div class="title-row"><h1 class="title">Galerie</h1><button class="btn sm" data-act="photo-add">${ico('camera', 18)} Ajouter</button></div>
    ${ph.length ? `<div class="row-btns"><button class="btn alt sm" data-act="slideshow">${ico('play', 18)} Diaporama</button><span class="chip num">${plural(ph.length, 'photo')}</span></div>
      <div class="pgrid">${ph.map((f, i) => `<button class="ph" data-act="photo-open" data-i="${i}" style="--r:${(hue(f.id) % 7) - 3}deg">
        <img src="${photoURL(f.id)}" alt="Photo de ${esc(mName(f.member_id) || 'la soirée')}" loading="lazy" style="aspect-ratio:${f.w || 4}/${f.h || 3}">
        <span><span>${esc(mName(f.member_id))}</span><span>${f.likes.length ? f.likes.length + ' 🔥' : ''}</span></span></button>`).join('')}</div>`
      : `<div class="empty">${limoSay('Aucune photo. Sans preuve, cette soirée n’a jamais existé. Tout le monde peut en ajouter !', 'wow', 100)}</div>`}`;
}

/* ---------- feuilles (formulaires) ---------- */
const opt = (v, l, sel) => `<option value="${esc(v)}"${String(sel) === String(v) ? ' selected' : ''}>${esc(l)}</option>`;
const memberOpts = (sel, none) => (none ? opt('', none, sel || '') : '') + sortedMembers().map(g => opt(g.id, g.name + (g.id === P().me ? ' (toi)' : ''), sel)).join('');

function memberSheet(m) {
  const isNew = !m, ed = canEdit(), mine = m && m.id === P().me;
  m = m || { name: '', status: 'wait', plus: 0, brings: '', in_split: true };
  const canDel = !isNew && (mine || isHost() || (ed && !m.linked));
  return `<h2 class="h2">${isNew ? 'Ajouter quelqu’un' : mine ? 'Ma réponse' : esc(m.name)}</h2>
    ${isNew ? '<p class="muted" style="font-weight:600">Pour ceux qui n’ont pas l’appli : tu gères leur réponse à leur place. S’ils rejoignent plus tard avec le lien, ils se reconnaîtront dans la liste.</p>' : ''}
    <form class="form" data-form="member" data-id="${m.id || ''}">
      <label class="f">Prénom<input class="in" id="m-name" name="name" required maxlength="30" value="${esc(m.name)}" ${isNew ? 'data-focus' : ''} autocomplete="off"></label>
      <div class="f-row"><label class="f">Réponse<select class="in" id="m-status" name="status">${Object.entries(STATUS).map(([k, l]) => opt(k, l, m.status)).join('')}</select></label>
      <label class="f">Accompagnants<select class="in" id="m-plus" name="plus">${[0, 1, 2, 3, 4].map(n => opt(n, n ? '+' + n : 'Aucun', m.plus || 0)).join('')}</select></label></div>
      <label class="f">Ramène quoi ?<input class="in" id="m-brings" name="brings" maxlength="40" placeholder="Chips, enceinte, bonne humeur" value="${esc(m.brings)}"></label>
      ${ed && !isNew ? `<label class="switch"><input type="checkbox" id="m-split" name="in_split" ${m.in_split ? 'checked' : ''}><span>Participe au partage des frais</span></label>` : ''}
      ${isHost() && m.linked && !isNew ? `<label class="f">Rôle<select class="in" id="m-role" name="role">${opt('host', 'Orga : gère tout, membres compris', m.role)}${opt('editor', 'Participe : modifie courses, check-list, bar, comptes', m.role)}${opt('viewer', 'Suit : voit tout, gère sa réponse et ses photos', m.role)}</select></label>` : ''}
      <button class="btn world" name="go" value="save">${isNew ? 'Ajouter' : 'Enregistrer'}</button>
      ${isNew ? '<button class="btn alt" name="go" value="more">Ajouter et continuer</button>' : ''}
      ${!isNew && !m.linked && ed ? `<button type="button" class="btn alt" data-act="member-link" data-id="${m.id}">${ico('copy')} Copier son lien d’invitation perso</button>` : ''}
      ${canDel ? `<button type="button" class="btn danger" data-act="member-del" data-id="${m.id}">${mine ? 'Quitter la soirée' : 'Retirer de la liste'}</button>` : ''}
    </form>`;
}
function inviteText() {
  const p = P().party;
  return `${theme(p).emo} ${p.name}\n${fmtDate(p)} à ${p.time}${p.place ? '\n' + p.place : ''}\n\nRéponds et suis la soirée ici :\n${inviteLink()}`;
}
function inviteSheet() {
  const p = P().party, link = inviteLink();
  let qr = '';
  try { const q = qrcode(0, 'M'); q.addData(link); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) { /* lien trop long : pas de QR */ }
  return `<h2 class="h2">Inviter du monde</h2>
    <p class="muted" style="font-weight:600">Envoie ce lien ou fais scanner le code : chacun répond, puis ${p.default_role === 'editor' ? 'participe à l’organisation' : 'suit la soirée'}.</p>
    ${qr ? `<div class="qr">${qr}</div>` : ''}
    <div class="invite" id="invite-link">${esc(link)}</div>
    <div class="row-btns"><button class="btn world" data-act="invite-copy" data-what="link">${ico('copy')} Copier le lien</button><button class="btn alt" data-act="invite-copy" data-what="text">Copier l’invitation</button></div>
    ${isHost() ? `<p class="eyebrow">Ceux qui rejoignent</p><div class="seg">${[['editor', 'Participent'], ['viewer', 'Suivent']].map(([k, l]) => `<button class="${p.default_role === k ? 'on' : ''}" data-act="default-role" data-role="${k}">${l}</button>`).join('')}</div>
      <p class="muted" style="font-size:13px;font-weight:600">${p.default_role === 'editor' ? 'Les nouveaux peuvent modifier les courses, la check-list, le bar et les comptes.' : 'Les nouveaux voient tout, répondent et postent leurs photos, sans rien modifier d’autre.'} Tu peux changer le rôle de chacun depuis sa fiche.</p>
      <button class="btn danger" data-act="invite-reset">Générer un nouveau lien</button>` : ''}`;
}
function itemSheet(i) {
  const isNew = !i;
  i = i || { name: '', qty: 1, unit: '', cat: 'alcool', price: '', assignee: '', note: '' };
  return `<h2 class="h2">${isNew ? 'Nouvel article' : 'Modifier l’article'}</h2>
    <form class="form" data-form="item" data-id="${i.id || ''}">
      <label class="f">Quoi ?<input class="in" id="i-name" name="name" required maxlength="40" value="${esc(i.name)}" ${isNew ? 'data-focus' : ''} autocomplete="off" placeholder="Tonic"></label>
      <div class="f-row"><label class="f">Quantité<input class="in" id="i-qty" name="qty" type="number" inputmode="decimal" min="0" step="any" value="${i.qty || ''}"></label>
      <label class="f">Unité<input class="in" id="i-unit" name="unit" maxlength="20" value="${esc(i.unit)}" placeholder="bouteilles"></label></div>
      <div class="f-row"><label class="f">Rayon<select class="in" id="i-cat" name="cat">${CATS.map(c => opt(c.id, c.label, i.cat)).join('')}</select></label>
      <label class="f">Prix estimé à l’unité (€)<input class="in" id="i-price" name="price" type="number" inputmode="decimal" min="0" step="any" value="${i.price || ''}"></label></div>
      <label class="f">Qui s’en charge ?<select class="in" id="i-who" name="assignee">${memberOpts(i.assignee, 'Personne pour l’instant')}</select></label>
      ${i.bought ? `<p class="eyebrow">Acheté</p><div class="f-row"><label class="f">Payé par<select class="in" id="i-paid-by" name="paid_by">${memberOpts(i.paid_by, 'Hors comptes')}</select></label>
        <label class="f">Montant payé (€)<input class="in" id="i-paid" name="paid_amount" type="number" inputmode="decimal" min="0" step="any" value="${i.paid_amount != null ? i.paid_amount : ''}" placeholder="${estOf(i) || ''}"></label></div>` : ''}
      <button class="btn world">${isNew ? 'Ajouter à la liste' : 'Enregistrer'}</button>
      ${isNew ? '' : `<button type="button" class="btn danger" data-act="item-del" data-id="${i.id}">Supprimer</button>`}
    </form>`;
}
function expenseSheet(e) {
  const isNew = !e;
  e = e || { label: '', amount: '', paid_by: P().me };
  return `<h2 class="h2">${isNew ? 'Nouvelle dépense' : 'Modifier la dépense'}</h2>
    <p class="muted" style="font-weight:600">Pour ce qui n’est pas dans la liste de courses : taxi, location, pizza de 3 h du matin.</p>
    <form class="form" data-form="expense" data-id="${e.id || ''}">
      <label class="f">Quoi ?<input class="in" id="e-label" name="label" required maxlength="40" value="${esc(e.label)}" ${isNew ? 'data-focus' : ''} autocomplete="off" placeholder="Taxi retour"></label>
      <div class="f-row"><label class="f">Montant (€)<input class="in" id="e-amount" name="amount" type="number" inputmode="decimal" min="0" step="any" required value="${e.amount}"></label>
      <label class="f">Payé par<select class="in" id="e-by" name="paid_by">${memberOpts(e.paid_by)}</select></label></div>
      <button class="btn world">${isNew ? 'Ajouter' : 'Enregistrer'}</button>
      ${isNew ? '' : `<button type="button" class="btn danger" data-act="expense-del" data-id="${e.id}">Supprimer</button>`}
    </form>`;
}
function taskSheet(t) {
  const isNew = !t;
  t = t || { label: '', when_label: '' };
  return `<h2 class="h2">${isNew ? 'Nouvelle tâche' : 'Modifier la tâche'}</h2>
    <form class="form" data-form="task" data-id="${t.id || ''}">
      <label class="f">À faire<input class="in" id="t-label" name="label" required maxlength="80" value="${esc(t.label)}" ${isNew ? 'data-focus' : ''} autocomplete="off" placeholder="Gonfler les ballons"></label>
      <label class="f">Quand ?<input class="in" id="t-when" name="when_label" maxlength="12" value="${esc(t.when_label)}" placeholder="J-2" list="t-when-list"></label>
      <datalist id="t-when-list">${['J-7', 'J-5', 'J-3', 'J-2', 'J-1', 'Jour J', 'J+1'].map(w => `<option value="${w}">`).join('')}</datalist>
      <button class="btn world">${isNew ? 'Ajouter' : 'Enregistrer'}</button>
      ${isNew ? '' : `<button type="button" class="btn danger" data-act="task-del" data-id="${t.id}">Supprimer</button>`}
    </form>`;
}
function partySheet() {
  const p = P().party;
  return `<h2 class="h2">La soirée</h2>
    <form class="form" data-form="party">
      <label class="f">Nom<input class="in" id="p-name" name="name" required maxlength="40" value="${esc(p.name)}"></label>
      <div class="f-row"><label class="f">Date<input class="in" id="p-date" type="date" name="date" required value="${esc(p.date)}"></label><label class="f">Heure<input class="in" id="p-time" type="time" name="time" required value="${esc(p.time)}"></label></div>
      <label class="f">Lieu<input class="in" id="p-place" name="place" maxlength="60" value="${esc(p.place)}"></label>
      <div class="f-row"><label class="f">Ambiance<select class="in" id="p-theme" name="theme">${THEMES.map(t => opt(t.id, t.emo + ' ' + t.label, p.theme)).join('')}</select></label>
      <label class="f">Personnes attendues<input class="in" id="p-expected" name="expected" type="number" inputmode="numeric" min="1" max="500" value="${p.expected}"></label></div>
      <button class="btn world">Enregistrer</button>
      <button type="button" class="btn danger" data-act="party-del">Supprimer la soirée</button>
    </form>`;
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
function cocktailSheet() {
  const ck = findCk(CK.id);
  if (!ck) return '<p class="h2">Ce cocktail n’existe plus.</p>';
  const miss = missingFor(ck), scale = CK.serv / (ck.batch || 1), fav = (P().party.menu || []).includes(ck.id), ed = canEdit();
  return `<div class="ck-hero">${glassSVG(ck, 130)}<div class="stack" style="gap:8px"><h2>${esc(ck.name)}</h2>
      <span class="dots" style="justify-content:flex-start">${[1, 2, 3].map(n => `<i class="${ck.str >= n ? 'f' : ''}"></i>`).join('')}<small style="margin-left:6px;font-weight:800">${strLabel(ck)}</small></span>
      <div class="stepper sm" style="justify-content:flex-start"><button class="ico-btn" data-act="ck-serv" data-d="-1" aria-label="Moins">−</button><b class="num">${CK.serv}</b><button class="ico-btn" data-act="ck-serv" data-d="1" aria-label="Plus">${ico('plus', 18)}</button><span class="muted" style="font-weight:700">${CK.serv > 1 ? 'verres' : 'verre'}</span></div></div></div>
    <div>${ck.ing.map(g => `<div class="ing"><i class="${miss.includes(g) ? 'ko' : 'ok'}">${miss.includes(g) ? '!' : '✓'}</i><span>${esc(g.n)}</span><em>${g.q ? fmtQ(g.q * scale) + ' ' + esc(g.u) : ''}</em></div>`).join('') || '<p class="muted">Pas d’ingrédients renseignés.</p>'}</div>
    ${ed && miss.length ? `<button class="btn world" data-act="ck-missing">Ajouter ${plural(miss.length, 'ingrédient manquant', 'ingrédients manquants')} aux courses pour ${plural(CK.serv, 'verre')}</button>`
      : ck.ing.length && !miss.length ? '<p class="tag" style="align-self:flex-start;background:var(--yes);color:var(--ink);padding:6px 10px">Tout est déjà dans la liste de courses</p>' : ''}
    ${ck.steps.length ? `<ol class="steps">${ck.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    ${ed ? `<button class="btn alt" data-act="ck-fav">${fav ? 'Retirer de la carte du soir' : 'Mettre à la carte du soir'}</button>
      <button class="btn alt" data-act="ck-edit">${ico('edit', 18)} ${ck.custom ? 'Modifier la recette' : 'Dupliquer pour créer ma version'}</button>` : ''}`;
}
const CK_COLORS = ['#FF9248', '#FF6B6B', '#FF9BD2', '#A77BFF', '#7CC4FF', '#6FE3A5', '#FFD43B', '#8A4B2A'];
const GLASS_LABEL = { highball: 'Grand verre', tumbler: 'Verre bas', coupe: 'Coupe', wine: 'Verre ballon', pitcher: 'Pichet' };
const ingLine = g => `${g.q ? fmtQ(g.q).replace('½', '0,5') + ' ' : ''}${g.u ? g.u + ' ' : ''}${g.n}`;
function parseIng(line) {
  const m = line.match(/^([\d.,]+)\s*(cl|ml|l|g|kg|c\. ?à ?café|c\. ?à ?soupe|cuillères?|feuilles?|tranches?|quartiers?|pincées?|traits?|pièces?|verres?|tasses?|bâtons?)?\s+(.+)$/i);
  return m ? { q: Math.min(9999, parseFloat(m[1].replace(',', '.')) || 0), u: (m[2] || '').toLowerCase(), n: m[3].trim().slice(0, 40) } : { q: 0, u: '', n: line.slice(0, 40) };
}
function cocktailForm(src, id) {
  const c = src || { name: '', glass: 'highball', color: CK_COLORS[0], strength: 2, batch: 1, ingredients: [], steps: [] };
  return `<h2 class="h2">${id ? 'Modifier la recette' : 'Nouveau cocktail maison'}</h2>
    <form class="form" data-form="cocktail" data-id="${id || ''}">
      <label class="f">Nom<input class="in" id="c-name" name="name" required maxlength="40" value="${esc(c.name)}" placeholder="Le Léa" autocomplete="off" ${src ? '' : 'data-focus'}></label>
      <div class="f-row"><label class="f">Verre<select class="in" id="c-glass" name="glass">${Object.entries(GLASS_LABEL).map(([k, l]) => opt(k, l, c.glass)).join('')}</select></label>
      <label class="f">Force<select class="in" id="c-str" name="strength">${['Sans alcool', 'Léger', 'Classique', 'Costaud'].map((l, i) => opt(i, l, c.strength)).join('')}</select></label></div>
      <div class="f"><span>Couleur</span><div class="swatches">${CK_COLORS.map((col, i) => `<label><input type="radio" name="color" value="${col}" ${col.toLowerCase() === String(c.color).toLowerCase() || (!CK_COLORS.some(x => x.toLowerCase() === String(c.color).toLowerCase()) && i === 0) ? 'checked' : ''}><i style="background:${col}"></i><span class="sr">Couleur ${i + 1}</span></label>`).join('')}</div></div>
      <label class="f">Ingrédients, un par ligne<textarea class="in" id="c-ing" name="ingredients" rows="5" placeholder="4 cl gin&#10;1 cl sirop de rose&#10;10 cl tonic">${esc((c.ingredients || []).map(ingLine).join('\n'))}</textarea></label>
      <label class="f">La recette donne combien de verres ?<input class="in" id="c-batch" name="batch" type="number" inputmode="numeric" min="1" max="50" value="${c.batch || 1}"></label>
      <label class="f">Étapes, une par ligne<textarea class="in" id="c-steps" name="steps" rows="4" placeholder="Secoue avec des glaçons.&#10;Filtre dans le verre.">${esc((c.steps || []).join('\n'))}</textarea></label>
      <button class="btn world">Enregistrer</button>
      ${id ? `<button type="button" class="btn danger" data-act="ck-del" data-id="${id}">Supprimer ce cocktail</button>` : ''}
    </form>`;
}

/* Carte du soir à imprimer. */
function printView() {
  const p = P().party, menu = p.menu || [], list = allCocktails().filter(c => menu.includes(c.id));
  return `<div class="print-bar no-print"><button class="btn sm alt" data-act="print-close">${ico('x', 18)} Fermer</button><button class="btn sm" data-act="print-go">${ico('print', 18)} Imprimer</button></div>
    <article class="menu-page"><header><p class="eyebrow">${esc(fmtDate(p))}${p.place ? ' · ' + esc(p.place) : ''}</p><h1>La carte</h1><p class="menu-sub">${theme(p).emo} ${esc(p.name)}</p></header>
    <div class="menu-list">${list.map(c => `<section class="menu-item">${glassSVG(c, 76)}<div><h2>${esc(c.name)}</h2><p>${c.ing.filter(g => !/gla[cç]/i.test(g.n)).map(g => esc(g.n)).join(' · ')}</p>
      <p class="menu-meta">${strLabel(c)}</p></div></section>`).join('')}</div>
    <footer>Santé ! À consommer avec modération.</footer></article>`;
}

/* ---------- visionneuse photo ---------- */
const LB = { i: 0, show: false, timer: null };
function lbRender(full) {
  const el = $('#lightbox'), ph = P() ? P().photos : [];
  if (!ph.length) return lbClose();
  LB.i = (LB.i + ph.length) % ph.length;
  const f = ph[LB.i], meId = P().me, by = mName(f.member_id);
  const bot = `<div class="lb-cap">${by ? 'Par ' + esc(by) : ''}</div>
    <button class="lb-btn${f.likes.includes(meId) ? ' on' : ''}" data-act="lb-like" aria-label="J’adore">${ico('flame', 20)}<span class="num">${f.likes.length || ''}</span></button>
    ${f.member_id === meId || isHost() ? `<button class="lb-btn" data-act="lb-del" aria-label="Supprimer la photo">${ico('trash', 20)}</button>` : ''}`;
  if (!full && el.dataset.id === f.id) { $('.lb-bot', el).innerHTML = bot; return; }
  el.dataset.id = f.id;
  el.classList.toggle('show', LB.show);
  el.innerHTML = `<div class="lb-top"><button class="lb-btn" data-act="lb-close" aria-label="Fermer">${ico('x', 20)}</button><span class="num" style="font-weight:800">${LB.i + 1} / ${ph.length}</span>
      <button class="lb-btn${LB.show ? ' on' : ''}" data-act="lb-show">${ico('play', 18)} Diaporama</button></div>
    <div class="lb-stage"><img src="${photoURL(f.id)}" alt="Photo ${LB.i + 1}"><button class="lb-nav l" data-act="lb-prev" aria-label="Photo précédente"></button><button class="lb-nav r" data-act="lb-next" aria-label="Photo suivante"></button></div>
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
  const s = Math.max(0, Math.floor((+el.dataset.at - Date.now()) / 1000));
  const v = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
  $$('div', el).forEach((d, i) => {
    const b = $('b', d), t = String(v[i]).padStart(i ? 2 : 1, '0');
    if (b.textContent !== t) { b.textContent = t; d.classList.remove('tick'); void d.offsetWidth; d.classList.add('tick'); }
  });
}
