'use strict';
/* Tests d'API sur une vraie base Postgres (DATABASE_URL, par défaut la base zeste_test locale). */
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://zeste:zeste@127.0.0.1:5432/zeste_test';
process.env.RATE_SESSIONS = '1000';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, pool } = require('../server');

let srv, base;
/* Un « navigateur » minimal : garde son cookie de session. */
function client() {
  let cookie = '';
  const call = async (method, url, body) => {
    const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const ct = r.headers.get('content-type') || '';
    return { status: r.status, body: ct.includes('json') ? await r.json() : await r.arrayBuffer() };
  };
  return { get: u => call('GET', u), post: (u, b) => call('POST', u, b || {}), patch: (u, b) => call('PATCH', u, b), put: (u, b) => call('PUT', u, b), del: u => call('DELETE', u) };
}
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

before(async () => {
  srv = await start(0);
  base = 'http://127.0.0.1:' + srv.address().port;
  await pool.query('TRUNCATE users, parties CASCADE');
});
after(async () => { srv.close(); await pool.end(); });

let lea, tom, zoe, pid, code;

test('sans session, l’API refuse', async () => {
  assert.equal((await client().get('/api/me')).body.user, null);
  assert.equal((await client().get('/api/parties/11111111-1111-4111-8111-111111111111')).status, 401);
});

test('créer un compte puis une soirée', async () => {
  lea = client();
  assert.equal((await lea.post('/api/session', { name: 'Léa' })).status, 201);
  const r = await lea.post('/api/parties', { name: 'Anniv de Léa', date: '2030-06-01', time: '21:00', place: 'Chez Léa', theme: 'anniv', expected: 12 });
  assert.equal(r.status, 201);
  pid = r.body.id;
  const b = (await lea.get('/api/parties/' + pid)).body;
  code = b.party.invite_code;
  assert.equal(b.members.length, 1);
  assert.equal(b.members[0].role, 'host');
  assert.equal(b.tasks.length, 8);
  assert.equal((await lea.get('/api/me')).body.parties[0].going, 1);
});

test('un inconnu ne voit pas la soirée', async () => {
  const x = client();
  await x.post('/api/session', { name: 'Intrus' });
  assert.equal((await x.get('/api/parties/' + pid)).status, 404);
  assert.equal((await x.post(`/api/parties/${pid}/items`, { name: 'Bière' })).status, 404);
});

test('quelqu’un « pas sur l’appli » puis qui rejoint et se reconnaît', async () => {
  const g = await lea.post(`/api/parties/${pid}/members`, { name: 'Tom', status: 'yes', plus: 1 });
  assert.equal(g.status, 201);
  tom = client();
  const view = await tom.get('/api/join/' + code);
  assert.equal(view.body.party.host, 'Léa');
  assert.deepEqual(view.body.ghosts.map(x => x.name), ['Tom']);
  await tom.post('/api/session', { name: 'Thomas' });
  assert.equal((await tom.post('/api/join/' + code, { claim: g.body.id })).status, 200);
  const b = (await tom.get('/api/parties/' + pid)).body;
  assert.equal(b.members.length, 2, 'pas de doublon');
  const me = b.members.find(m => m.id === b.me);
  assert.equal(me.id, g.body.id);
  assert.equal(me.linked, true);
  assert.equal(me.status, 'yes');
  assert.equal(me.plus, 1);
  assert.equal(me.role, 'editor');
});

test('mode « les invités suivent » : le nouveau venu ne peut modifier que sa réponse', async () => {
  assert.equal((await tom.patch('/api/parties/' + pid, { default_role: 'viewer' })).status, 403, 'réglage réservé à l’orga');
  assert.equal((await lea.patch('/api/parties/' + pid, { default_role: 'viewer' })).status, 200);
  zoe = client();
  await zoe.post('/api/session', { name: 'Zoé' });
  await zoe.post('/api/join/' + code, { status: 'maybe' });
  const b = (await zoe.get('/api/parties/' + pid)).body;
  const me = b.members.find(m => m.id === b.me);
  assert.equal(me.role, 'viewer');
  assert.equal(me.status, 'maybe');
  assert.equal((await zoe.post(`/api/parties/${pid}/items`, { name: 'Chips' })).status, 403);
  assert.equal((await zoe.post(`/api/parties/${pid}/members`, { name: 'Pote' })).status, 403);
  assert.equal((await zoe.patch(`/api/parties/${pid}/members/${me.id}`, { status: 'yes', brings: 'Chips' })).status, 200);
  const lm = b.members.find(m => m.role === 'host');
  assert.equal((await zoe.patch(`/api/parties/${pid}/members/${lm.id}`, { status: 'no' })).status, 403);
  assert.equal((await zoe.patch(`/api/parties/${pid}/members/${me.id}`, { role: 'host' })).status, 403);
  // L'orga la passe participante : elle peut modifier.
  assert.equal((await lea.patch(`/api/parties/${pid}/members/${me.id}`, { role: 'editor' })).status, 200);
  assert.equal((await zoe.post(`/api/parties/${pid}/items`, { name: 'Chips', qty: 3, price: 1.5 })).status, 201);
});

test('le dernier organisateur ne peut pas partir ni se rétrograder', async () => {
  const b = (await lea.get('/api/parties/' + pid)).body;
  assert.equal((await lea.patch(`/api/parties/${pid}/members/${b.me}`, { role: 'editor' })).status, 400);
  assert.equal((await lea.del(`/api/parties/${pid}/members/${b.me}`)).status, 400);
});

test('courses, achats, dépenses et remboursements', async () => {
  const b = (await lea.get('/api/parties/' + pid)).body;
  const tomM = b.members.find(m => m.name === 'Tom');
  const bulk = await lea.post(`/api/parties/${pid}/items/bulk`, { items: [{ name: 'Rhum', qty: 1, price: 16, cat: 'alcool', note: 'Mojito × 6' }, { name: 'Menthe', qty: 2, price: 1.5, cat: 'frais', assignee: tomM.id }] });
  assert.equal(bulk.status, 201);
  const items = (await lea.get('/api/parties/' + pid)).body.items;
  const rhum = items.find(i => i.name === 'Rhum');
  assert.equal(rhum.note, 'Mojito × 6');
  assert.equal((await tom.patch(`/api/parties/${pid}/items/${rhum.id}`, { bought: true, level: 3, paid_by: tomM.id, paid_amount: 17.9 })).status, 200);
  assert.equal((await lea.patch(`/api/parties/${pid}/items/${rhum.id}`, { paid_by: '11111111-1111-4111-8111-111111111111' })).status, 400, 'payeur hors soirée refusé');
  assert.equal((await lea.post(`/api/parties/${pid}/expenses`, { label: 'Taxi', amount: 24, paid_by: b.me })).status, 201);
  assert.equal((await tom.post(`/api/parties/${pid}/transfers`, { from_member: tomM.id, to_member: b.me, amount: 5 })).status, 201);
  const after = (await lea.get('/api/parties/' + pid)).body;
  assert.equal(after.items.find(i => i.id === rhum.id).paid_amount, 17.9);
  assert.equal(after.expenses[0].amount, 24);
  assert.equal(after.transfers.length, 1);
});

test('check-list et cocktails maison', async () => {
  const t = await lea.post(`/api/parties/${pid}/tasks`, { label: 'Gonfler les ballons', when_label: 'Jour J', position: 99 });
  assert.equal(t.status, 201);
  assert.equal((await lea.patch(`/api/parties/${pid}/tasks/${t.body.id}`, { done: true, label: 'Gonfler 30 ballons' })).status, 200);
  const c = await lea.post(`/api/parties/${pid}/cocktails`, { name: 'Le Léa', glass: 'coupe', color: '#FF9BD2', strength: 1, batch: 1, ingredients: [{ n: 'Gin', q: 4, u: 'cl' }, { n: 'Sirop de rose', q: 1, u: 'cl' }], steps: ['Secoue.', 'Sers.'] });
  assert.equal(c.status, 201);
  assert.equal((await lea.put(`/api/parties/${pid}/menu`, { key: c.body.id, on: true })).status, 200);
  assert.equal((await lea.put(`/api/parties/${pid}/menu`, { key: 'mojito', on: true })).status, 200);
  let b = (await lea.get('/api/parties/' + pid)).body;
  assert.deepEqual(b.party.menu, [c.body.id, 'mojito']);
  assert.equal(b.cocktails[0].ingredients[1].n, 'Sirop de rose');
  assert.equal(b.tasks.at(-1).label, 'Gonfler 30 ballons');
  assert.equal((await lea.del(`/api/parties/${pid}/cocktails/${c.body.id}`)).status, 200);
  b = (await lea.get('/api/parties/' + pid)).body;
  assert.deepEqual(b.party.menu, ['mojito'], 'le cocktail supprimé quitte la carte');
  assert.equal((await lea.post(`/api/parties/${pid}/cocktails`, { name: 'X', glass: 'seau' })).status, 400);
});

test('photos : ajout par tous, suppression par l’auteur ou l’orga', async () => {
  const p = await zoe.post(`/api/parties/${pid}/photos`, { data: PIXEL, w: 1, h: 1 });
  assert.equal(p.status, 201);
  const img = await tom.get(`/api/parties/${pid}/photos/${p.body.id}`);
  assert.equal(img.status, 200);
  assert.ok(img.body.byteLength > 20);
  assert.equal((await tom.put(`/api/parties/${pid}/photos/${p.body.id}/like`, { on: true })).status, 200);
  assert.equal((await lea.get('/api/parties/' + pid)).body.photos[0].likes.length, 1);
  assert.equal((await tom.del(`/api/parties/${pid}/photos/${p.body.id}`)).status, 403);
  assert.equal((await lea.del(`/api/parties/${pid}/photos/${p.body.id}`)).status, 200);
  assert.equal((await zoe.post(`/api/parties/${pid}/photos`, { data: 'data:text/html;base64,PGI+' })).status, 400);
});

test('changer d’appareil avec un code à usage unique', async () => {
  const { code: c } = (await zoe.post('/api/me/link-code')).body;
  const phone = client();
  assert.equal((await phone.post('/api/session/claim', { code: c })).body.name, 'Zoé');
  assert.equal((await phone.get('/api/me')).body.parties.length, 1);
  assert.equal((await client().post('/api/session/claim', { code: c })).status, 404, 'le code ne sert qu’une fois');
  zoe = phone;
});

test('nouveau lien d’invitation et suppression de la soirée', async () => {
  const r = await lea.post(`/api/parties/${pid}/invite/reset`);
  assert.notEqual(r.body.invite_code, code);
  assert.equal((await client().get('/api/join/' + code)).status, 404);
  assert.equal((await tom.del('/api/parties/' + pid)).status, 403);
  assert.equal((await lea.del('/api/parties/' + pid)).status, 200);
  assert.equal((await tom.get('/api/parties/' + pid)).status, 404);
});
