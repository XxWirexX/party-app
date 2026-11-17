'use strict';
/* Zeste — serveur : API JSON, flux temps réel (SSE) et fichiers statiques. */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { pool, q, tx, migrate } = require('./db');

const PROD = process.env.NODE_ENV === 'production';
const COOKIE = 'zeste_sid';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = m => new HttpError(400, m || 'Requête invalide.');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const rand = n => crypto.randomBytes(n).toString('base64url');

/* ---------- validation ---------- */
const V = {
  str: (max, min = 0) => v => {
    if (typeof v !== 'string') throw bad();
    v = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (v.length < min || v.length > max) throw bad('Texte trop ' + (v.length < min ? 'court.' : 'long.'));
    return v;
  },
  num: (min, max) => v => { v = Number(v); if (!Number.isFinite(v) || v < min || v > max) throw bad('Nombre invalide.'); return Math.round(v * 100) / 100; },
  int: (min, max) => v => { v = Number(v); if (!Number.isInteger(v) || v < min || v > max) throw bad('Nombre invalide.'); return v; },
  bool: v => { if (typeof v !== 'boolean') throw bad(); return v; },
  oneOf: (...list) => v => { if (!list.includes(v)) throw bad(); return v; },
  uuid: v => { if (typeof v !== 'string' || !UUID.test(v)) throw bad(); return v; },
  nullable: fn => v => (v === null || v === '' ? null : fn(v)),
  match: re => v => { if (typeof v !== 'string' || !re.test(v)) throw bad(); return v; },
};
function pick(body, spec, required = []) {
  if (!body || typeof body !== 'object') throw bad();
  const out = {};
  for (const k of Object.keys(spec)) if (body[k] !== undefined) out[k] = spec[k](body[k]);
  for (const r of required) if (out[r] === undefined) throw bad('Champ manquant : ' + r);
  return out;
}
const optId = v => (v === undefined ? undefined : V.uuid(v));

/* ---------- petits helpers SQL (les noms de tables et de colonnes viennent du code, jamais du client) ---------- */
async function insert(table, obj, run = q) {
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined);
  const rows = await run(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING id`, keys.map(k => obj[k]));
  return rows[0].id;
}
async function update(table, id, pid, obj) {
  const keys = Object.keys(obj);
  if (!keys.length) return true;
  const rows = await q(`UPDATE ${table} SET ${keys.map((k, i) => `${k}=$${i + 3}`).join(',')} WHERE id=$1 AND party_id=$2 RETURNING id`, [id, pid, ...keys.map(k => obj[k])]);
  return rows.length > 0;
}
async function checkMembers(pid, ids) {
  ids = [...new Set(ids.filter(Boolean))];
  if (!ids.length) return;
  const rows = await q('SELECT id FROM members WHERE party_id=$1 AND id = ANY($2::uuid[])', [pid, ids]);
  if (rows.length !== ids.length) throw bad('Membre inconnu.');
}

/* ---------- limiteur simple en mémoire ---------- */
const hits = new Map();
function limit(key, max, windowMs) {
  const now = Date.now(), recent = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (recent.length >= max) throw new HttpError(429, 'Trop de tentatives, réessaie dans un moment.');
  recent.push(now);
  hits.set(key, recent);
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

/* ---------- temps réel : un flux SSE par soirée ---------- */
const streams = new Map();
function bump(pid) {
  const set = streams.get(pid);
  if (set) for (const res of set) res.write('event: change\ndata: {}\n\n');
}
setInterval(() => { for (const set of streams.values()) for (const res of set) res.write(': ping\n\n'); }, 25e3).unref();

/* ---------- application ---------- */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-ancestors 'self'",
  });
  next();
});
app.use(express.json({ limit: '700kb' }));

/* Les écritures doivent venir de notre propre page. */
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.headers.origin) {
    let host = '';
    try { host = new URL(req.headers.origin).host; } catch (e) { /* origine illisible */ }
    if (host !== req.headers.host) return next(new HttpError(403, 'Origine refusée.'));
  }
  next();
});

/* Session : un jeton aléatoire dans un cookie httpOnly, seul son hash est en base. */
app.use('/api', wrap(async (req, res, next) => {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|; )' + COOKIE + '=([^;]+)'));
  if (m) {
    const rows = await q('SELECT id, name FROM users WHERE token_hash=$1', [sha(m[1])]);
    if (rows[0]) req.user = rows[0];
  }
  next();
}));
function setSession(req, res, token) {
  const secure = req.secure || PROD;
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? '; Secure' : ''}`);
}
const auth = (req, res, next) => (req.user ? next() : next(new HttpError(401, 'Pas de session.')));
/* Charge le membre courant de la soirée :pid (404 si on n'en fait pas partie). */
const member = [auth, wrap(async (req, res, next) => {
  if (!UUID.test(req.params.pid)) throw new HttpError(404, 'Soirée introuvable.');
  const rows = await q('SELECT * FROM members WHERE party_id=$1 AND user_id=$2', [req.params.pid, req.user.id]);
  if (!rows[0]) throw new HttpError(404, 'Soirée introuvable.');
  req.m = rows[0];
  next();
})];
const canEdit = m => m.role === 'host' || m.role === 'editor';
const edit = (req, res, next) => (canEdit(req.m) ? next() : next(new HttpError(403, 'Tu suis cette soirée : seuls les participants peuvent modifier.')));
const host = (req, res, next) => (req.m.role === 'host' ? next() : next(new HttpError(403, 'Réservé aux organisateurs.')));

/* ---------- compte ---------- */
app.post('/api/session', wrap(async (req, res) => {
  const { name } = pick(req.body, { name: V.str(40, 1) }, ['name']);
  if (req.user) {
    await q('UPDATE users SET name=$2 WHERE id=$1', [req.user.id, name]);
    return res.json({ id: req.user.id, name });
  }
  limit('session:' + req.ip, Number(process.env.RATE_SESSIONS || 40), 3600e3);
  const token = rand(32);
  const rows = await q('INSERT INTO users (name, token_hash) VALUES ($1,$2) RETURNING id, name', [name, sha(token)]);
  setSession(req, res, token);
  res.status(201).json(rows[0]);
}));

app.get('/api/me', wrap(async (req, res) => {
  if (!req.user) return res.json({ user: null, parties: [] });
  const parties = await q(`
    SELECT p.id, p.name, p.date, p.time, p.place, p.theme, m.role, m.status,
      (SELECT coalesce(sum(1 + x.plus), 0) FROM members x WHERE x.party_id = p.id AND x.status = 'yes')::int AS going
    FROM members m JOIN parties p ON p.id = m.party_id
    WHERE m.user_id = $1 ORDER BY p.date, p.time`, [req.user.id]);
  res.json({ user: req.user, parties });
}));

app.patch('/api/me', auth, wrap(async (req, res) => {
  const { name } = pick(req.body, { name: V.str(40, 1) }, ['name']);
  await q('UPDATE users SET name=$2 WHERE id=$1', [req.user.id, name]);
  res.json({ id: req.user.id, name });
}));

/* Ouvrir son compte sur un autre appareil : code à usage unique, valable 15 minutes. */
app.post('/api/me/link-code', auth, wrap(async (req, res) => {
  limit('link:' + req.user.id, 10, 3600e3);
  const code = rand(18);
  await q('DELETE FROM login_codes WHERE user_id=$1 OR expires_at < now()', [req.user.id]);
  await q("INSERT INTO login_codes (code_hash, user_id, expires_at) VALUES ($1,$2, now() + interval '15 minutes')", [sha(code), req.user.id]);
  res.json({ code });
}));
app.post('/api/session/claim', wrap(async (req, res) => {
  limit('claim:' + req.ip, 20, 3600e3);
  const { code } = pick(req.body, { code: V.str(60, 10) }, ['code']);
  const rows = await q('DELETE FROM login_codes WHERE code_hash=$1 AND expires_at > now() RETURNING user_id', [sha(code)]);
  if (!rows[0]) throw new HttpError(404, 'Ce lien a expiré ou a déjà servi.');
  // Un nouveau jeton remplace l'ancien : le compte suit la personne sur son nouvel appareil.
  const token = rand(32);
  const u = await q('UPDATE users SET token_hash=$2 WHERE id=$1 RETURNING id, name', [rows[0].user_id, sha(token)]);
  setSession(req, res, token);
  res.json(u[0]);
}));

/* ---------- soirées ---------- */
const partySpec = {
  name: V.str(60, 1), date: V.match(/^\d{4}-\d{2}-\d{2}$/), time: V.match(/^\d{2}:\d{2}$/), place: V.str(80),
  theme: V.str(20), expected: V.int(1, 500), default_role: V.oneOf('editor', 'viewer'),
};
const DEFAULT_TASKS = [
  ['J-7', 'Envoyer les invitations'], ['J-5', 'Relancer ceux qui n’ont pas répondu'], ['J-3', 'Boucler la liste de courses'],
  ['J-1', 'Faire les courses'], ['J-1', 'Glaçons au congélateur'], ['Jour J', 'Playlist prête, enceinte chargée'],
  ['Jour J', 'Planquer les objets fragiles'], ['J+1', 'Poster les photos dans la galerie'],
];

app.post('/api/parties', auth, wrap(async (req, res) => {
  limit('party:' + req.user.id, 30, 3600e3);
  const d = pick(req.body, partySpec, ['name', 'date']);
  const id = await tx(async run => {
    const pid = await insert('parties', { ...d, invite_code: rand(9), created_by: req.user.id }, run);
    await insert('members', { party_id: pid, user_id: req.user.id, name: req.user.name, role: 'host', status: 'yes' }, run);
    for (const [i, t] of DEFAULT_TASKS.entries()) await insert('tasks', { party_id: pid, when_label: t[0], label: t[1], position: i }, run);
    return pid;
  });
  res.status(201).json({ id });
}));

async function bundle(pid, me) {
  const [party, members, items, expenses, transfers, tasks, cocktails, photos] = await Promise.all([
    q('SELECT id, name, date, time, place, theme, expected, default_role, menu, invite_code FROM parties WHERE id=$1', [pid]),
    q('SELECT id, name, role, status, plus, brings, in_split, (user_id IS NOT NULL) AS linked FROM members WHERE party_id=$1 ORDER BY created_at, id', [pid]),
    q('SELECT id, name, qty, unit, cat, price, note, assignee, bought, level, paid_by, paid_amount, created_at FROM items WHERE party_id=$1 ORDER BY created_at, id', [pid]),
    q('SELECT id, label, amount, paid_by, created_at FROM expenses WHERE party_id=$1 ORDER BY created_at, id', [pid]),
    q('SELECT id, from_member, to_member, amount, created_at FROM transfers WHERE party_id=$1 ORDER BY created_at, id', [pid]),
    q('SELECT id, label, when_label, done, position FROM tasks WHERE party_id=$1 ORDER BY position, created_at, id', [pid]),
    q('SELECT id, name, glass, color, strength, batch, ingredients, steps FROM cocktails WHERE party_id=$1 ORDER BY created_at, id', [pid]),
    q(`SELECT p.id, p.member_id, p.w, p.h, p.created_at,
         coalesce(array_agg(l.member_id) FILTER (WHERE l.member_id IS NOT NULL), '{}') AS likes
       FROM photos p LEFT JOIN photo_likes l ON l.photo_id = p.id
       WHERE p.party_id=$1 GROUP BY p.id ORDER BY p.created_at, p.id`, [pid]),
  ]);
  return { party: party[0], me, members, items, expenses, transfers, tasks, cocktails, photos };
}

app.get('/api/parties/:pid', member, wrap(async (req, res) => res.json(await bundle(req.params.pid, req.m.id))));

app.get('/api/parties/:pid/events', member, (req, res) => {
  const pid = req.params.pid;
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  if (!streams.has(pid)) streams.set(pid, new Set());
  streams.get(pid).add(res);
  req.on('close', () => { const s = streams.get(pid); if (s) { s.delete(res); if (!s.size) streams.delete(pid); } });
});

app.patch('/api/parties/:pid', member, host, wrap(async (req, res) => {
  const d = pick(req.body, partySpec), keys = Object.keys(d);
  if (keys.length) await q(`UPDATE parties SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1`, [req.params.pid, ...keys.map(k => d[k])]);
  bump(req.params.pid);
  res.json({ ok: true });
}));
app.delete('/api/parties/:pid', member, host, wrap(async (req, res) => {
  await q('DELETE FROM parties WHERE id=$1', [req.params.pid]);
  bump(req.params.pid);
  res.json({ ok: true });
}));
/* Nouveau lien d'invitation : l'ancien ne marche plus. */
app.post('/api/parties/:pid/invite/reset', member, host, wrap(async (req, res) => {
  const rows = await q('UPDATE parties SET invite_code=$2 WHERE id=$1 RETURNING invite_code', [req.params.pid, rand(9)]);
  bump(req.params.pid);
  res.json(rows[0]);
}));
app.put('/api/parties/:pid/menu', member, edit, wrap(async (req, res) => {
  const { key, on } = pick(req.body, { key: V.str(40, 1), on: V.bool }, ['key', 'on']);
  await q(`UPDATE parties SET menu = CASE WHEN $3 THEN (CASE WHEN menu ? $2::text THEN menu ELSE menu || to_jsonb($2::text) END) ELSE menu - $2::text END WHERE id=$1`, [req.params.pid, key, on]);
  bump(req.params.pid);
  res.json({ ok: true });
}));

/* ---------- rejoindre par le lien ---------- */
app.get('/api/join/:code', wrap(async (req, res) => {
  limit('joinview:' + req.ip, 120, 3600e3);
  const rows = await q(`SELECT p.id, p.name, p.date, p.time, p.place, p.theme,
      (SELECT name FROM members h WHERE h.party_id = p.id AND h.role = 'host' ORDER BY created_at LIMIT 1) AS host
    FROM parties p WHERE invite_code=$1`, [String(req.params.code)]);
  if (!rows[0]) throw new HttpError(404, 'Ce lien d’invitation n’existe plus.');
  const p = rows[0];
  const ghosts = await q('SELECT id, name FROM members WHERE party_id=$1 AND user_id IS NULL ORDER BY name', [p.id]);
  const mine = req.user ? await q('SELECT id FROM members WHERE party_id=$1 AND user_id=$2', [p.id, req.user.id]) : [];
  res.json({ party: p, ghosts, already: mine.length > 0, user: req.user || null });
}));

app.post('/api/join/:code', auth, wrap(async (req, res) => {
  limit('join:' + req.user.id, 60, 3600e3);
  const d = pick(req.body, { claim: V.nullable(V.uuid), status: V.oneOf('wait', 'yes', 'maybe', 'no') });
  const rows = await q('SELECT id, default_role FROM parties WHERE invite_code=$1', [String(req.params.code)]);
  if (!rows[0]) throw new HttpError(404, 'Ce lien d’invitation n’existe plus.');
  const p = rows[0];
  const mine = await q('SELECT id FROM members WHERE party_id=$1 AND user_id=$2', [p.id, req.user.id]);
  if (!mine[0]) {
    let claimed = [];
    // « C'est moi » : on rattache le compte à la personne déjà inscrite sur la liste.
    if (d.claim) claimed = await q(`UPDATE members SET user_id=$3, role=$4, status=coalesce($5::text, status) WHERE id=$1 AND party_id=$2 AND user_id IS NULL RETURNING id`,
      [d.claim, p.id, req.user.id, p.default_role, d.status || null]);
    if (!claimed[0]) await insert('members', { party_id: p.id, user_id: req.user.id, name: req.user.name, role: p.default_role, status: d.status || 'wait' });
  } else if (d.status) await q('UPDATE members SET status=$2 WHERE id=$1', [mine[0].id, d.status]);
  bump(p.id);
  res.json({ id: p.id });
}));

/* ---------- membres ---------- */
const memberSpec = { name: V.str(40, 1), status: V.oneOf('wait', 'yes', 'maybe', 'no'), plus: V.int(0, 9), brings: V.str(60), in_split: V.bool, role: V.oneOf('host', 'editor', 'viewer') };
const hostCount = async pid => (await q("SELECT count(*)::int AS n FROM members WHERE party_id=$1 AND role='host' AND user_id IS NOT NULL", [pid]))[0].n;

/* Ajouter quelqu'un qui n'est pas (encore) sur l'appli. */
app.post('/api/parties/:pid/members', member, edit, wrap(async (req, res) => {
  const d = pick(req.body, memberSpec, ['name']);
  delete d.role;
  const id = await insert('members', { id: optId(req.body.id), party_id: req.params.pid, ...d });
  bump(req.params.pid);
  res.status(201).json({ id });
}));

app.patch('/api/parties/:pid/members/:id', member, wrap(async (req, res) => {
  const pid = req.params.pid;
  const t = (await q('SELECT * FROM members WHERE id=$1 AND party_id=$2', [V.uuid(req.params.id), pid]))[0];
  if (!t) throw new HttpError(404, 'Membre introuvable.');
  const d = pick(req.body, memberSpec), self = t.id === req.m.id;
  // Chacun gère sa propre réponse ; les participants gèrent aussi celle des autres.
  if (!self && !canEdit(req.m)) throw new HttpError(403, 'Tu ne peux modifier que ta propre réponse.');
  if (d.in_split !== undefined && !canEdit(req.m)) throw new HttpError(403, 'Réservé aux participants.');
  if (d.role !== undefined && d.role !== t.role) {
    if (req.m.role !== 'host') throw new HttpError(403, 'Réservé aux organisateurs.');
    if (!t.user_id) throw bad('Cette personne n’est pas encore sur l’appli.');
    if (t.role === 'host' && (await hostCount(pid)) <= 1) throw bad('Il faut au moins un organisateur.');
  }
  await update('members', t.id, pid, d);
  bump(pid);
  res.json({ ok: true });
}));

app.delete('/api/parties/:pid/members/:id', member, wrap(async (req, res) => {
  const pid = req.params.pid;
  const t = (await q('SELECT * FROM members WHERE id=$1 AND party_id=$2', [V.uuid(req.params.id), pid]))[0];
  if (!t) throw new HttpError(404, 'Membre introuvable.');
  const self = t.id === req.m.id;
  const allowed = self || req.m.role === 'host' || (req.m.role === 'editor' && !t.user_id);
  if (!allowed) throw new HttpError(403, 'Réservé aux organisateurs.');
  if (t.role === 'host' && t.user_id && (await hostCount(pid)) <= 1) throw bad('Nomme un autre organisateur avant de partir, ou supprime la soirée.');
  await q('DELETE FROM members WHERE id=$1', [t.id]);
  bump(pid);
  res.json({ ok: true });
}));

/* ---------- ressources d'une soirée : courses, dépenses, check-list, cocktails ---------- */
function resource(name, table, spec, { required = [], refs = [] } = {}) {
  const base = '/api/parties/:pid/' + name;
  app.post(base, member, edit, wrap(async (req, res) => {
    const d = pick(req.body, spec, required);
    await checkMembers(req.params.pid, refs.map(r => d[r]));
    const id = await insert(table, { id: optId(req.body.id), party_id: req.params.pid, ...d });
    bump(req.params.pid);
    res.status(201).json({ id });
  }));
  app.patch(base + '/:id', member, edit, wrap(async (req, res) => {
    const d = pick(req.body, spec);
    await checkMembers(req.params.pid, refs.map(r => d[r]));
    if (!(await update(table, V.uuid(req.params.id), req.params.pid, d))) throw new HttpError(404, 'Introuvable.');
    bump(req.params.pid);
    res.json({ ok: true });
  }));
  app.delete(base + '/:id', member, edit, wrap(async (req, res) => {
    await q(`DELETE FROM ${table} WHERE id=$1 AND party_id=$2`, [V.uuid(req.params.id), req.params.pid]);
    bump(req.params.pid);
    res.json({ ok: true });
  }));
}

const itemSpec = {
  name: V.str(60, 1), qty: V.num(0, 9999), unit: V.str(24), cat: V.oneOf('alcool', 'soft', 'food', 'frais', 'divers'), price: V.num(0, 9999), note: V.str(60),
  assignee: V.nullable(V.uuid), bought: V.bool, level: V.nullable(V.int(0, 3)), paid_by: V.nullable(V.uuid), paid_amount: V.nullable(V.num(0, 99999)),
};
/* Plusieurs articles d'un coup (calculateur, ingrédients d'un cocktail). Déclaré avant /items/:id. */
app.post('/api/parties/:pid/items/bulk', member, edit, wrap(async (req, res) => {
  const list = req.body && req.body.items;
  if (!Array.isArray(list) || !list.length || list.length > 40) throw bad();
  const rows = list.map(it => ({ id: optId(it.id), ...pick(it, itemSpec, ['name']) }));
  await checkMembers(req.params.pid, rows.flatMap(r => [r.assignee, r.paid_by]));
  await tx(async run => { for (const r of rows) await insert('items', { party_id: req.params.pid, ...r }, run); });
  bump(req.params.pid);
  res.status(201).json({ ok: true });
}));
resource('items', 'items', itemSpec, { required: ['name'], refs: ['assignee', 'paid_by'] });
resource('expenses', 'expenses', { label: V.str(60, 1), amount: V.num(0, 99999), paid_by: V.uuid }, { required: ['label', 'amount', 'paid_by'], refs: ['paid_by'] });
resource('tasks', 'tasks', { label: V.str(80, 1), when_label: V.str(12), done: V.bool, position: V.int(0, 9999) }, { required: ['label'] });

/* Un cocktail supprimé sort aussi de la carte du soir. */
app.delete('/api/parties/:pid/cocktails/:id', member, edit, wrap(async (req, res, next) => {
  await q('UPDATE parties SET menu = menu - $2::text WHERE id=$1', [req.params.pid, String(req.params.id)]);
  next();
}));
const jsonList = (max, each) => v => { if (!Array.isArray(v) || v.length > max) throw bad(); return JSON.stringify(v.map(each)); };
resource('cocktails', 'cocktails', {
  name: V.str(40, 1), glass: V.oneOf('highball', 'tumbler', 'coupe', 'wine', 'pitcher'), color: V.match(/^#[0-9a-f]{6}$/i), strength: V.int(0, 3), batch: V.int(1, 50),
  ingredients: jsonList(15, x => pick(x, { n: V.str(40, 1), q: V.num(0, 9999), u: V.str(16) }, ['n'])),
  steps: jsonList(10, V.str(200, 1)),
}, { required: ['name'] });

/* Remboursements : un participant, ou l'une des deux personnes concernées. */
app.post('/api/parties/:pid/transfers', member, wrap(async (req, res) => {
  const d = pick(req.body, { from_member: V.uuid, to_member: V.uuid, amount: V.num(0.01, 99999) }, ['from_member', 'to_member', 'amount']);
  if (d.from_member === d.to_member) throw bad();
  if (!canEdit(req.m) && ![d.from_member, d.to_member].includes(req.m.id)) throw new HttpError(403, 'Tu ne peux noter que tes propres remboursements.');
  await checkMembers(req.params.pid, [d.from_member, d.to_member]);
  const id = await insert('transfers', { id: optId(req.body.id), party_id: req.params.pid, ...d });
  bump(req.params.pid);
  res.status(201).json({ id });
}));
app.delete('/api/parties/:pid/transfers/:id', member, wrap(async (req, res) => {
  const rows = await q('DELETE FROM transfers WHERE id=$1 AND party_id=$2 AND ($3::boolean OR from_member=$4 OR to_member=$4) RETURNING id',
    [V.uuid(req.params.id), req.params.pid, canEdit(req.m), req.m.id]);
  if (!rows[0]) throw new HttpError(403, 'Impossible de supprimer ce remboursement.');
  bump(req.params.pid);
  res.json({ ok: true });
}));

/* ---------- photos : tout membre peut en ajouter, on ne supprime que les siennes (ou en tant qu'orga) ---------- */
app.post('/api/parties/:pid/photos', member, wrap(async (req, res) => {
  limit('photo:' + req.user.id, 120, 3600e3);
  const b = req.body || {};
  const m = typeof b.data === 'string' && b.data.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw bad('Image illisible.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 450 * 1024) throw new HttpError(413, 'Image trop lourde.');
  const n = (await q('SELECT count(*)::int AS n FROM photos WHERE party_id=$1', [req.params.pid]))[0].n;
  if (n >= 400) throw bad('La galerie est pleine (400 photos).');
  const id = await insert('photos', { id: optId(b.id), party_id: req.params.pid, member_id: req.m.id, mime: m[1], data: buf, w: V.int(1, 20000)(b.w || 4), h: V.int(1, 20000)(b.h || 3) });
  bump(req.params.pid);
  res.status(201).json({ id });
}));
app.get('/api/parties/:pid/photos/:id', member, wrap(async (req, res) => {
  const rows = await q('SELECT mime, data FROM photos WHERE id=$1 AND party_id=$2', [V.uuid(req.params.id), req.params.pid]);
  if (!rows[0]) throw new HttpError(404, 'Photo introuvable.');
  res.set({ 'Content-Type': rows[0].mime, 'Cache-Control': 'private, max-age=31536000, immutable' }).end(rows[0].data);
}));
app.delete('/api/parties/:pid/photos/:id', member, wrap(async (req, res) => {
  const rows = await q('DELETE FROM photos WHERE id=$1 AND party_id=$2 AND ($3::boolean OR member_id=$4) RETURNING id', [V.uuid(req.params.id), req.params.pid, req.m.role === 'host', req.m.id]);
  if (!rows[0]) throw new HttpError(403, 'Tu ne peux supprimer que tes photos.');
  bump(req.params.pid);
  res.json({ ok: true });
}));
app.put('/api/parties/:pid/photos/:id/like', member, wrap(async (req, res) => {
  const { on } = pick(req.body, { on: V.bool }, ['on']);
  const ph = await q('SELECT id FROM photos WHERE id=$1 AND party_id=$2', [V.uuid(req.params.id), req.params.pid]);
  if (!ph[0]) throw new HttpError(404, 'Photo introuvable.');
  if (on) await q('INSERT INTO photo_likes (photo_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [ph[0].id, req.m.id]);
  else await q('DELETE FROM photo_likes WHERE photo_id=$1 AND member_id=$2', [ph[0].id, req.m.id]);
  bump(req.params.pid);
  res.json({ ok: true });
}));

app.get('/api/health', wrap(async (req, res) => { await q('SELECT 1'); res.json({ ok: true }); }));
app.use('/api', (req, res, next) => next(new HttpError(404, 'Route inconnue.')));

/* ---------- fichiers statiques + application monopage ---------- */
const PUBLIC = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC, { maxAge: PROD ? '1h' : 0 }));
app.get(['/p/*', '/j/*', '/l/*'], (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  let status = err.status || 500, message = err.message;
  if (err.type === 'entity.too.large') { status = 413; message = 'Envoi trop lourd.'; }
  else if (err.type === 'entity.parse.failed') { status = 400; message = 'Requête illisible.'; }
  else if (err.code === '23505') { status = 409; message = 'Déjà enregistré.'; }
  else if (err.code && /^(22|23)/.test(err.code)) { status = 400; message = 'Données invalides.'; }
  if (status >= 500) { console.error(err); message = 'Erreur du serveur.'; }
  res.status(status).json({ error: message });
});

async function start(port = Number(process.env.PORT || 3000)) {
  // Au démarrage d'un conteneur, la base peut mettre quelques secondes à accepter les connexions.
  for (let i = 1; ; i++) {
    try { await migrate(); break; } catch (e) {
      if (i >= 30 || !['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', '57P03'].includes(e.code)) throw e;
      console.log(`base indisponible (${e.code}), nouvel essai dans 2 s…`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return new Promise(resolve => { const srv = app.listen(port, () => { console.log('Zeste écoute sur le port ' + srv.address().port); resolve(srv); }); });
}
if (require.main === module) start().catch(e => { console.error(e); process.exit(1); });

module.exports = { app, start, pool };
