/* Conflict-safe, study-only sync. All network and storage are injected for testing. */
(function (root) {
  'use strict';
  const META = 'medzo-study-sync-meta-v1';
  const canonical = value => JSON.stringify(sort(value));
  function sort(value) {
    if (Array.isArray(value)) return value.map(sort);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sort(value[k])]));
    return value;
  }
  async function digest(value) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
    return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
  }
  function makeEngine({store, snapshot, request, userId}) {
    const getMeta = () => {
      try { const x = JSON.parse(store.getItem(META) || 'null'); return x && x.userId === userId ? x : null; }
      catch (_) { return null; }
    };
    const setMeta = (revision, hash) => store.setItem(META, JSON.stringify({userId, revision, hash}));
    async function inspect() {
      const remote = await request({action:'get'});
      if (!Number.isSafeInteger(remote.revision) || remote.revision < 0 || !snapshot.validate(remote.snapshot)) throw Error('invalid_remote');
      const local = snapshot.capture(store);
      const [localHash, remoteHash] = await Promise.all([digest(local), digest(remote.snapshot)]);
      const meta = getMeta();
      let state;
      if (remote.revision > 0 && localHash === remoteHash) { setMeta(remote.revision, localHash); state = 'equal'; }
      else if (remote.revision === 0) state = 'initial';
      else if (meta && meta.revision === remote.revision && meta.hash === remoteHash) state = 'local-changed';
      else if (meta && meta.hash === localHash && meta.revision !== remote.revision) state = 'remote-changed';
      else state = 'conflict';
      return {state, remote, local, localHash, remoteHash};
    }
    async function push(plan) {
      const current = await inspect();
      if (current.remote.revision !== plan.remote.revision || current.localHash !== plan.localHash) throw Error('changed');
      const result = await request({action:'put', revision:current.remote.revision, snapshot:current.local});
      if (!Number.isSafeInteger(result.revision) || result.revision !== current.remote.revision + 1) throw Error('invalid_response');
      setMeta(result.revision, current.localHash);
      return result;
    }
    async function pull(plan) {
      const current = await inspect();
      if (current.remote.revision !== plan.remote.revision || current.localHash !== plan.localHash || current.remoteHash !== plan.remoteHash) throw Error('changed');
      // Recheck storage after the last asynchronous operation, immediately before writing.
      const latest = snapshot.capture(store);
      if (canonical(latest) !== canonical(current.local)) throw Error('changed');
      const backup = snapshot.apply(store, current.remote.snapshot);
      let metaSaved = true;
      try { setMeta(current.remote.revision, current.remoteHash); } catch (_) { metaSaved = false; }
      return {backup, metaSaved};
    }
    function forget() { store.removeItem(META); }
    return {inspect, push, pull, forget};
  }
  const api = {makeEngine, canonical, digest, META};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MedzoSyncEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
