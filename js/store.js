/* Zeste — stockage. Deux modes derrière la même API :
   - « cloud » : base partagée de l'artifact (tous ceux qui ouvrent le lien voient les mêmes soirées) ;
   - « local » : localStorage + IndexedDB (photos) quand la base n'est pas disponible. */
const Store = (() => {
  const COLS = ['parties', 'guests', 'items', 'photos'];
  const data = {};
  COLS.forEach(c => (data[c] = new Map()));
  const subs = new Set();
  const S = { mode: 'boot', ready: false, stale: false, uid: null, canWrite: true };
  let db = null, notice = () => {};
  const emit = () => subs.forEach(f => f());

  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } };
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  let idbP = null;
  const idb = () => idbP || (idbP = new Promise((res, rej) => {
    try {
      const r = indexedDB.open('zeste', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  }));
  const idbTx = (mode, fn) => idb().then(d => new Promise((res, rej) => {
    const t = d.transaction('photos', mode);
    const rq = fn(t.objectStore('photos'));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
  })).catch(() => null);

  function startLocal() {
    S.mode = 'local';
    ['parties', 'guests', 'items'].forEach(c => {
      data[c] = new Map(lsGet('zeste:' + c, []).map(d => [d.id, d]));
    });
    S.ready = true;
    emit();
  }

  async function init() {
    S.uid = lsGet('zeste:uid', null) || 'u' + newId();
    lsSet('zeste:uid', S.uid);
    if (!(window.claude && window.claude.use)) return startLocal();
    let d = null, u = null;
    try { [d, u] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); } catch (e) { /* absent */ }
    if (!d) return startLocal();
    db = d;
    S.mode = 'cloud';
    try {
      const id = u && await u.id();
      if (id) S.uid = id;
      if (u && (await u.can('data.write')) === false) S.canWrite = false;
    } catch (e) { /* on laisse les écritures décider */ }
    const got = new Set(), sure = new Set();
    const timer = setTimeout(() => { S.stale = true; S.ready = true; emit(); }, 10000);
    ['parties', 'guests', 'items'].forEach(c => {
      db.collection(c).onSnapshot(snap => {
        data[c] = new Map(snap.docs.map(x => [x.id, { ...x.data(), id: x.id }]));
        got.add(c);
        if (!snap.metadata.fromCache) sure.add(c);
        if (got.size === 3) S.ready = true;
        if (sure.size === 3) { clearTimeout(timer); S.stale = false; }
        emit();
      }, () => { clearTimeout(timer); S.ready = true; S.stale = true; emit(); });
    });
  }

  const chains = new Map();
  function onErr(e) {
    const code = e && e.code;
    if (code === 'invalid_argument' || code === 'not_granted' || code === 'revoked') { S.canWrite = false; notice('ro'); }
    else if (code === 'quota_exceeded') notice('quota');
    else notice('err');
    emit();
  }
  function persist(col, id, op, patch) {
    if (S.mode === 'cloud') {
      const ref = db.collection(col).doc(id);
      const body = () => { const { id: _drop, ...b } = data[col].get(id) || {}; return b; };
      const k = col + '/' + id;
      const run = () => (op === 'delete' ? ref.delete() : op === 'set' ? ref.set(body()) : ref.update(patch));
      chains.set(k, (chains.get(k) || Promise.resolve()).then(run).catch(onErr));
    } else if (col === 'photos') {
      const doc = data[col].get(id);
      idbTx('readwrite', s => (op === 'delete' ? s.delete(id) : s.put(doc)));
    } else {
      lsSet('zeste:' + col, [...data[col].values()]);
    }
  }
  const guard = () => { if (!S.canWrite) { notice('ro'); return false; } return true; };

  function add(col, obj) {
    if (!guard()) return null;
    const id = newId();
    data[col].set(id, { ...obj, id });
    emit();
    persist(col, id, 'set');
    return id;
  }
  function update(col, id, patch) {
    if (!guard()) return;
    const cur = data[col].get(id);
    if (!cur) return;
    data[col].set(id, { ...cur, ...patch });
    emit();
    persist(col, id, 'update', patch);
  }
  function remove(col, id) {
    if (!guard()) return;
    data[col].delete(id);
    emit();
    persist(col, id, 'delete');
  }

  let unPhotos = null, photosFor = null;
  function watchPhotos(pid) {
    if (photosFor === pid) return;
    photosFor = pid;
    if (unPhotos) unPhotos();
    unPhotos = null;
    data.photos = new Map();
    if (!pid) return;
    if (S.mode === 'cloud') {
      unPhotos = db.collection('photos').where('partyId', '==', pid).onSnapshot(snap => {
        if (photosFor !== pid) return;
        data.photos = new Map(snap.docs.map(x => [x.id, { ...x.data(), id: x.id }]));
        emit();
      }, () => {});
    } else {
      idbTx('readonly', s => s.getAll()).then(all => {
        if (photosFor !== pid) return;
        (all || []).filter(p => p.partyId === pid).forEach(p => data.photos.set(p.id, p));
        emit();
      });
    }
  }

  return {
    S, init, add, update, remove, watchPhotos, lsGet, lsSet,
    on: f => subs.add(f),
    onNotice: f => (notice = f),
    get: (col, id) => data[col].get(id),
    list: (col, pred) => { const a = [...data[col].values()]; return pred ? a.filter(pred) : a; },
  };
})();
