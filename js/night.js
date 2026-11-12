/* Zeste — mode soirée : salon des joueurs et sept jeux. */
const N = { pid: null, players: [], level: 1, turn: 0, cursor: -1, g: {}, timers: [] };
const LEVELS = ['Soft', 'Classique', 'Corsé'];

function nightInit(p) {
  if (N.pid === p.id) return;
  N.pid = p.id; N.level = 1; N.turn = 0; N.cursor = -1;
  const host = me(), names = guestsOf(p.id).filter(g => g.status === 'yes').map(g => g.name);
  N.players = [...new Set([...(host ? [host] : []), ...names])].map(n => ({ n, st: 'on' }));
}
const active = () => N.players.filter(x => x.st !== 'off');
function nextPlayer() {
  const a = active();
  if (!a.length) return null;
  N.cursor = (N.cursor + 1) % a.length;
  return a[N.cursor];
}
function sip(n, pl) {
  n += N.level === 2 ? 1 : 0;
  return plural(n, 'gorgée') + (N.level === 0 || (pl && pl.st === 'sam') ? ' de soft' : '');
}
const fill = (t, n, pl) => t.replace('{n}', sip(n || 2, pl));
const pool = arr => shuffle(arr.filter(x => x[0] <= N.level).map(x => x[1]));
function clearTimers() { N.timers.forEach(t => { clearTimeout(t); clearInterval(t); }); N.timers = []; }
function turnDone() {
  N.turn++;
  if (N.turn % 8 === 0) toast('Pause hydratation : un verre d’eau pour tout le monde !');
}

function nightView(p) {
  nightInit(p);
  if (R.game) return gameView();
  return `<header class="p-head"><button class="ico-btn" data-act="night-exit" aria-label="Quitter le mode soirée">${ico('back')}</button><div class="p-name">${esc(p.name)}</div><span class="disco" style="width:40px;height:40px"></span></header>
    <h1 class="title">On joue à quoi ?</h1>
    <section class="card stack">
      <div class="list-label"><p class="eyebrow">Qui joue ?</p><p class="eyebrow">${active().length} en jeu</p></div>
      <div class="chips">${N.players.map((x, i) => `<button class="chip player ${x.st}" data-act="player" data-i="${i}" aria-label="${esc(x.n)} : ${x.st === 'sam' ? 'Sam, joue au soft' : x.st === 'on' ? 'joue' : 'ne joue pas'}">${esc(x.n)}${x.st === 'sam' ? ' · Sam' : x.st === 'off' ? ' · pause' : ''}</button>`).join('')}
        <button class="chip" data-act="player-add">${ico('plus', 16)} Joueur</button></div>
      <p class="muted" style="font-size:13px;font-weight:600">Tape un prénom pour le passer en Sam (il joue au soft), puis en pause.</p>
      <div class="seg">${LEVELS.map((l, i) => `<button class="${N.level === i ? 'on' : ''}" data-act="level" data-i="${i}">${l}</button>`).join('')}</div>
    </section>
    <div class="n-tiles">${GAMES.map(g => `<button class="n-tile" style="--c:var(${g.c})" data-act="game" data-id="${g.id}"><span>${g.emo}</span><span><b>${g.name}</b><small>${g.sub}</small></span></button>`).join('')}</div>
    <p class="muted center" style="font-size:13px;font-weight:600">Personne n’est obligé de boire. Un refus se respecte, et celui qui conduit reste au soft.</p>`;
}

function startGame(id) {
  clearTimers();
  const g = (N.g = { id });
  if (id === 'never') { g.deck = pool(NEVER); g.i = 0; }
  if (id === 'who') { g.deck = pool(WHO); g.i = 0; }
  if (id === 'tod') { g.who = nextPlayer(); g.mode = null; g.t = shuffle(pool(TRUTHS)); g.d = shuffle(pool(DARES)); }
  if (id === 'wheel') { g.rot = 0; g.who = nextPlayer(); g.res = null; }
  if (id === 'bottle') { g.rot = 0; g.hit = null; }
  if (id === 'cards') { g.deck = shuffle(['♠', '♥', '♦', '♣'].flatMap(s => ['A', 2, 3, 4, 5, 6, 7, 8, 9, 10, 'V', 'D', 'R'].map(v => ({ v, s })))); g.i = -1; g.kings = 0; }
  if (id === 'bomb') { g.state = 'idle'; g.cat = pick(BOMB_CATS); }
}

function gameView() {
  const g = N.g, meta = GAMES.find(x => x.id === g.id), a = active();
  const head = `<header class="p-head"><button class="ico-btn" data-act="game-quit" aria-label="Retour aux jeux">${ico('back')}</button><div class="p-name">${meta.emo} ${meta.name}</div><span class="tag">${LEVELS[N.level]}</span></header>`;
  const need2 = ['tod', 'wheel', 'bottle'].includes(g.id) && a.length < 2;
  if (need2) return head + `<div class="stage">${limoSay('Il faut au moins deux joueurs pour ce jeu. Retourne au salon et ajoute du monde.', 'sad', 96)}</div>`;
  const c = `--c:var(${meta.c})`;
  let stage = '', foot = '';
  if (g.id === 'never' || g.id === 'who') {
    const never = g.id === 'never';
    stage = `<div class="pcard" id="pcard" style="${c}"><span class="k">${never ? 'Je n’ai jamais…' : 'Qui de nous…'}</span><span class="t">${esc(g.deck[g.i % g.deck.length])}</span>
      <span class="r">${never ? 'Ceux qui l’ont déjà fait boivent ' + sip(1) + '.' : 'À trois, tout le monde pointe. Le plus désigné boit ' + sip(2) + '.'}</span></div>`;
    foot = `<button class="btn world" data-act="g-next">Carte suivante</button><p class="muted center" style="font-size:13px;font-weight:600">Tu peux aussi balayer la carte.</p>`;
  }
  if (g.id === 'tod') {
    stage = `<p class="eyebrow">Au tour de</p><div class="who">${esc(g.who.n)}</div>` + (g.mode
      ? `<div class="pcard" style="${c}"><span class="k">${g.mode === 't' ? 'Vérité' : 'Action'}</span><span class="t">${esc(g.text)}</span><span class="r">Refus : ${sip(2, g.who)}.</span></div>` : '');
    foot = g.mode ? `<button class="btn world" data-act="g-next">Joueur suivant</button>`
      : `<div class="row-btns"><button class="btn alt" data-act="g-tod" data-m="t">Vérité</button><button class="btn world" data-act="g-tod" data-m="d">Action</button></div>`;
  }
  if (g.id === 'wheel') {
    const cols = ['--w-sun', '--w-pink', '--w-mint', '--w-orange', '--w-sky', '--w-violet', '--lime', '--no'];
    const pt = deg => { const r = (deg * Math.PI) / 180; return (Math.sin(r) * 96).toFixed(2) + ' ' + (-Math.cos(r) * 96).toFixed(2); };
    const slices = WHEEL.map((w, i) => `<path d="M0 0L${pt(i * 45)}A96 96 0 0 1 ${pt(i * 45 + 45)}Z" fill="var(${cols[i]})" stroke="#05010A" stroke-width="2.5"/>
      <text transform="rotate(${i * 45 + 22.5}) translate(0 -62)" text-anchor="middle" font-size="11" font-weight="800" fill="#1D0F2E" font-family="inherit">${w.t}</text>`).join('');
    stage = `<p class="eyebrow">Au tour de</p><div class="who">${esc(g.who.n)}</div>
      <div class="wheel-wrap"><i class="wheel-pin"></i><svg class="wheel" id="wheel" viewBox="-100 -100 200 200" style="transform:rotate(${g.rot}deg)">${slices}<circle r="14" fill="#FFFFFF" stroke="#05010A" stroke-width="2.5"/></svg></div>
      ${g.res ? `<p class="h2 center pop">${esc(fill(g.res.l, g.res.n, g.who))}</p>` : ''}`;
    foot = g.res ? `<button class="btn world" data-act="g-next">Joueur suivant</button>` : `<button class="btn world" data-act="g-spin">Lancer la roue</button>`;
  }
  if (g.id === 'bottle') {
    const names = a.map((x, i) => { const r = (i / a.length) * Math.PI * 2; return `<span class="nm${g.hit === i ? ' hit' : ''}" style="left:${50 + Math.sin(r) * 50}%;top:${50 - Math.cos(r) * 50}%">${esc(x.n)}</span>`; }).join('');
    stage = `<div class="circle">${names}<svg class="bottle" id="bottle" viewBox="0 0 44 150" style="transform:rotate(${g.rot}deg)"><path d="M17 4h10v34q10 8 10 24v78a6 6 0 0 1-6 6H13a6 6 0 0 1-6-6V62q0-16 10-24z" fill="var(--w-mint)" stroke="#05010A" stroke-width="3"/><rect x="9" y="78" width="26" height="34" rx="3" fill="#FFFFFF" stroke="#05010A" stroke-width="2.5"/><rect x="16" y="1" width="12" height="9" rx="2" fill="var(--w-sun)" stroke="#05010A" stroke-width="2.5"/></svg></div>
      ${g.hit != null ? `<p class="h2 center pop">${esc(a[g.hit].n)} ${esc(fill(g.gage, 2, a[g.hit]))}.</p>` : '<p class="muted center" style="font-weight:700">Installez-vous en cercle, dans l’ordre des prénoms.</p>'}`;
    foot = `<button class="btn world" data-act="g-spin">${g.hit != null ? 'Relancer' : 'Faire tourner'}</button>`;
  }
  if (g.id === 'cards') {
    const cd = g.i >= 0 ? g.deck[g.i] : null, red = cd && (cd.s === '♥' || cd.s === '♦');
    const rule = cd ? (cd.v === 'R' && g.kings === 4 ? 'Quatrième roi : porte un toast à toute la tablée. Tout le monde trinque.' : fill(CARD_RULES[cd.v], 2)) : '';
    stage = cd ? `<div class="playing${red ? ' red' : ''}" id="playing"><span>${cd.v}${cd.s}</span><span class="mid">${cd.s}</span><span class="b">${cd.v}${cd.s}</span></div><p class="h2 center">${esc(rule)}</p>`
      : `<div class="playing" style="background:var(--w-violet);justify-content:center;align-items:center">🃏</div><p class="muted center" style="font-weight:700">Chacun pioche à son tour et applique la règle de la carte.</p>`;
    foot = g.i >= 51 ? `<button class="btn world" data-act="game" data-id="cards">Rebattre le paquet</button>` : `<button class="btn world" data-act="g-next">Piocher · ${51 - g.i} restantes</button>`;
  }
  if (g.id === 'bomb') {
    stage = `<p class="eyebrow">Catégorie</p><p class="who">${esc(g.cat)}</p><div class="bomb ${g.state === 'live' ? 'live' : g.state === 'boom' ? 'boom' : ''}" id="bomb">${g.state === 'boom' ? '💥' : '💣'}</div>
      <p class="h2 center">${g.state === 'boom' ? 'BOUM ! Celui qui tient le téléphone boit ' + sip(3) + '.' : g.state === 'live' ? 'Donne un mot, passe le téléphone !' : 'Chacun cite un mot de la catégorie puis passe le téléphone. Personne ne sait quand ça saute.'}</p>`;
    foot = g.state === 'live' ? '' : `<button class="btn world" data-act="g-bomb">${g.state === 'boom' ? 'Nouvelle manche' : 'Allumer la mèche'}</button>`;
  }
  return head + `<div class="stage">${stage}</div><div class="stack" style="gap:8px">${foot}</div>`;
}

const GameActs = {
  next(el, e) {
    const g = N.g, card = $('#pcard');
    const advance = () => {
      turnDone();
      if (g.id === 'never' || g.id === 'who') { g.i++; if (g.i >= g.deck.length) { g.deck = shuffle(g.deck); g.i = 0; } }
      if (g.id === 'tod') { g.who = nextPlayer(); g.mode = null; }
      if (g.id === 'wheel') { g.who = nextPlayer(); g.res = null; }
      if (g.id === 'cards') { g.i++; if (g.deck[g.i].v === 'R') g.kings++; buzz(20); }
      render(false);
    };
    if (card && !reduced()) {
      card.style.setProperty('--dx', (e && e.dir === 1 ? '' : '-') + '130%');
      card.style.setProperty('--rot', (e && e.dir === 1 ? '' : '-') + '22deg');
      card.classList.add('fling');
      setTimeout(advance, 260);
    } else advance();
  },
  tod(el) {
    const g = N.g, k = el.dataset.m, deck = k === 't' ? g.t : g.d;
    g.mode = k;
    g.text = fill(deck[0], 2, g.who);
    deck.push(deck.shift());
    render(false);
  },
  spin() {
    const g = N.g;
    if (g.busy) return;
    g.busy = true;
    const base = Math.ceil(g.rot / 360) * 360;
    if (g.id === 'wheel') {
      const idx = Math.floor(Math.random() * WHEEL.length);
      g.rot = base + 1800 + (360 - (idx * 45 + 22.5)) + (Math.random() * 24 - 12);
      $('#wheel').style.transform = `rotate(${g.rot}deg)`;
      N.timers.push(setTimeout(() => { g.busy = false; g.res = WHEEL[idx]; buzz(60); render(false); }, reduced() ? 50 : 4300));
    } else {
      const a = active(), idx = Math.floor(Math.random() * a.length);
      g.hit = null;
      $$('.nm.hit').forEach(n => n.classList.remove('hit'));
      g.rot = base + 1440 + (idx / a.length) * 360;
      $('#bottle').style.transform = `rotate(${g.rot}deg)`;
      N.timers.push(setTimeout(() => { g.busy = false; g.hit = idx; g.gage = pick(BOTTLE_GAGES.filter(x => x[0] <= N.level))[1]; buzz(60); turnDone(); render(false); }, reduced() ? 50 : 3700));
    }
  },
  bomb() {
    const g = N.g;
    clearTimers();
    if (g.state === 'boom') g.cat = pick(BOMB_CATS);
    g.state = 'live';
    render(false);
    const total = 12000 + Math.random() * 20000;
    N.timers.push(setTimeout(() => { const b = $('#bomb'); if (b) b.style.setProperty('--sp', '.4s'); }, total * 0.6));
    N.timers.push(setTimeout(() => { g.state = 'boom'; buzz([200, 80, 400]); turnDone(); render(false); Confetti(null, null, 40); }, total));
  },
};

/* Balayer une carte de jeu pour passer à la suivante. */
(() => {
  let x0 = null;
  document.addEventListener('touchstart', e => { x0 = e.target.closest('#pcard') ? e.touches[0].clientX : null; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 60) GameActs.next(null, { dir: dx > 0 ? 1 : -1 });
  });
})();
