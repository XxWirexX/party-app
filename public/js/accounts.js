/* Zeste — les comptes : qui a payé quoi, la part de chacun, qui doit combien à qui.
   Fonction pure, partagée entre le navigateur et les tests Node. */
function computeAccounts(b) {
  const ms = b.members, paid = {}, up = {};
  ms.forEach(m => { paid[m.id] = 0; up[m.id] = 0; });
  const est = i => (i.qty || 1) * (i.price || 0);
  const cost = i => (i.paid_amount != null ? i.paid_amount : est(i));
  let total = 0, upcoming = 0, unassigned = 0;
  for (const i of b.items) {
    if (i.bought) {
      if (i.paid_by && paid[i.paid_by] != null) { paid[i.paid_by] += cost(i); total += cost(i); }
    } else {
      upcoming += est(i);
      if (i.assignee && up[i.assignee] != null) up[i.assignee] += est(i); else unassigned += est(i);
    }
  }
  for (const e of b.expenses) if (paid[e.paid_by] != null) { paid[e.paid_by] += e.amount; total += e.amount; }

  // Parts : ceux qui viennent, accompagnants compris. Si personne n'a encore répondu oui, on partage entre ceux qui ont payé.
  const w = {};
  let W = 0;
  ms.forEach(m => { w[m.id] = m.in_split !== false && m.status === 'yes' ? 1 + (m.plus || 0) : 0; W += w[m.id]; });
  if (!W) ms.forEach(m => { w[m.id] = m.in_split !== false && paid[m.id] > 0 ? 1 : 0; W += w[m.id]; });

  const rows = ms.map(m => ({ m, paid: paid[m.id], share: W ? (total * w[m.id]) / W : 0, up: up[m.id], bal: 0 }));
  const by = Object.fromEntries(rows.map(r => [r.m.id, r]));
  rows.forEach(r => { r.bal = r.paid - r.share; });
  for (const t of b.transfers) {
    if (by[t.from_member]) by[t.from_member].bal += t.amount;
    if (by[t.to_member]) by[t.to_member].bal -= t.amount;
  }

  // Remboursements conseillés : le plus gros débiteur rembourse le plus gros créancier, et ainsi de suite.
  const deb = rows.filter(r => r.bal < -0.005).map(r => ({ id: r.m.id, a: -r.bal })).sort((x, y) => y.a - x.a);
  const cre = rows.filter(r => r.bal > 0.005).map(r => ({ id: r.m.id, a: r.bal })).sort((x, y) => y.a - x.a);
  const sugg = [];
  let i = 0, j = 0;
  while (i < deb.length && j < cre.length) {
    const a = Math.min(deb[i].a, cre[j].a), amount = Math.round(a * 100) / 100;
    if (amount >= 0.01) sugg.push({ from: deb[i].id, to: cre[j].id, amount });
    deb[i].a -= a; cre[j].a -= a;
    if (deb[i].a < 0.005) i++;
    if (cre[j].a < 0.005) j++;
  }
  return { rows, total, upcoming, unassigned, sugg, perShare: W ? total / W : 0, shares: W };
}
if (typeof module !== 'undefined') module.exports = { computeAccounts };
