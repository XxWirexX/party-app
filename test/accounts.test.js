'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeAccounts } = require('../public/js/accounts.js');

const member = (id, o = {}) => ({ id, name: id, status: 'yes', plus: 0, in_split: true, ...o });
const base = o => ({ members: [], items: [], expenses: [], transfers: [], ...o });

test('partage égal entre trois présents', () => {
  const a = computeAccounts(base({
    members: [member('lea'), member('tom'), member('zoe')],
    items: [{ bought: true, paid_by: 'lea', paid_amount: 60, qty: 1, price: 50 }],
    expenses: [{ paid_by: 'tom', amount: 30 }],
  }));
  assert.equal(a.total, 90);
  assert.equal(a.perShare, 30);
  assert.deepEqual(a.sugg, [{ from: 'zoe', to: 'lea', amount: 30 }]);
});

test('les accompagnants comptent, les absents et exclus ne paient pas', () => {
  const a = computeAccounts(base({
    members: [member('lea', { plus: 1 }), member('tom'), member('zoe', { status: 'no' }), member('max', { in_split: false })],
    expenses: [{ paid_by: 'tom', amount: 90 }],
  }));
  assert.equal(a.shares, 3);
  const by = Object.fromEntries(a.rows.map(r => [r.m.id, r]));
  assert.equal(by.lea.share, 60);
  assert.equal(by.zoe.share, 0);
  assert.equal(by.max.share, 0);
  assert.deepEqual(a.sugg, [{ from: 'lea', to: 'tom', amount: 60 }]);
});

test('un remboursement noté solde la dette', () => {
  const a = computeAccounts(base({
    members: [member('lea'), member('tom')],
    expenses: [{ paid_by: 'lea', amount: 40 }],
    transfers: [{ from_member: 'tom', to_member: 'lea', amount: 20 }],
  }));
  assert.deepEqual(a.sugg, []);
});

test('achats à venir par responsable, sans prix payé on prend l’estimation', () => {
  const a = computeAccounts(base({
    members: [member('lea'), member('tom')],
    items: [
      { bought: false, assignee: 'tom', qty: 2, price: 5 },
      { bought: false, assignee: null, qty: 1, price: 7 },
      { bought: true, paid_by: 'lea', paid_amount: null, qty: 3, price: 4 },
    ],
  }));
  assert.equal(a.upcoming, 17);
  assert.equal(a.unassigned, 7);
  assert.equal(a.rows.find(r => r.m.id === 'tom').up, 10);
  assert.equal(a.total, 12);
});

test('personne n’a répondu oui : on partage entre ceux qui ont payé', () => {
  const a = computeAccounts(base({
    members: [member('lea', { status: 'wait' }), member('tom', { status: 'wait' })],
    expenses: [{ paid_by: 'lea', amount: 10 }],
  }));
  assert.deepEqual(a.sugg, []);
  assert.equal(a.rows[0].bal, 0);
});
