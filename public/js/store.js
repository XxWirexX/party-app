/* Zeste — état côté client : session, liste des soirées, soirée ouverte.
   Les modifications sont appliquées tout de suite à l'écran, envoyées au serveur,
   puis l'état est relu. Un flux SSE prévient quand quelqu'un d'autre change quelque chose. */
const Store = (() => {
  const S = { ready: false, me: null, parties: [], P: null, offline: false };
  const subs = new Set();
  const emit = () => subs.forEach(f => f());
  let es = null, pending = 0, dirty = false, timer = null, notice = () => {};

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

  async function api(method, path, body) {
    let r;
    try {
      r = await fetch(path, { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    } catch (e) { const err = new Error('Pas de connexion.'); err.status = 0; throw err; }
    let data = null;
    try { data = await r.json(); } catch (e) { /* pas de corps */ }
    if (!r.ok) { const err = new Error((data && data.error) || 'Erreur du serveur.'); err.status = r.status; throw err; }
    return data;
  }

  async function init() {
    try { const d = await api('GET', '/api/me'); S.me = d.user; S.parties = d.parties; }
    catch (e) { if (e.status !== 401) S.offline = true; }
    S.ready = true;
    emit();
  }
  async function signup(name) { S.me = await api('POST', '/api/session', { name }); emit(); }
  async function refreshHome() {
    try { const d = await api('GET', '/api/me'); S.me = d.user; S.parties = d.parties; emit(); } catch (e) { /* on garde l'ancienne liste */ }
  }

  function close() {
    if (es) { es.close(); es = null; }
    clearTimeout(timer);
    S.P = null;
  }
  async function open(pid) {
    if (S.P && S.P.party.id === pid) return true;
    close();
    try { S.P = await api('GET', '/api/parties/' + pid); } catch (e) { return false; }
    es = new EventSource(`/api/parties/${pid}/events`);
    es.addEventListener('change', () => refetchSoon());
    es.onopen = () => { if (S.offline) { S.offline = false; refetchSoon(); } };
    es.onerror = () => { if (!S.offline) { S.offline = true; emit(); } };
    return true;
  }
  function refetchSoon() { clearTimeout(timer); timer = setTimeout(refetch, 120); }
  async function refetch() {
    if (!S.P) return;
    if (pending) { dirty = true; return; }
    const pid = S.P.party.id;
    try {
      const b = await api('GET', '/api/parties/' + pid);
      if (!S.P || S.P.party.id !== pid) return;
      if (pending) { dirty = true; return; }
      S.P = b;
      emit();
    } catch (e) {
      if (e.status === 404) { close(); notice('gone'); }
    }
  }

  /* apply(P) modifie la copie locale tout de suite ; le serveur confirme ensuite. */
  async function mutate(apply, method, path, body) {
    if (apply && S.P) { apply(S.P); emit(); }
    pending++;
    try { return await api(method, path, body); }
    catch (e) { notice('err', e.message); return null; }
    finally { pending--; dirty = false; if (!pending) refetch(); }
  }
  const base = () => '/api/parties/' + S.P.party.id;
  function add(col, obj, local) {
    const id = uuid();
    mutate(P => P[col].push({ id, ...local, ...obj }), 'POST', `${base()}/${col}`, { id, ...obj });
    return id;
  }
  const update = (col, id, patch) => mutate(P => { const r = P[col].find(x => x.id === id); if (r) Object.assign(r, patch); }, 'PATCH', `${base()}/${col}/${id}`, patch);
  const remove = (col, id) => mutate(P => { P[col] = P[col].filter(x => x.id !== id); }, 'DELETE', `${base()}/${col}/${id}`);

  return {
    S, api, uuid, init, signup, refreshHome, open, close, refetch, mutate, add, update, remove, base,
    on: f => subs.add(f),
    onNotice: f => (notice = f),
  };
})();
