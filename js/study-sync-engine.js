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
  function makeEngine({store, snapshot, request, userId, isActive=()=>true, metaKey=META}) {
    const getMeta = () => {
      try { const x = JSON.parse(store.getItem(metaKey) || 'null'); return x && x.userId === userId ? x : null; }
      catch (_) { return null; }
    };
    const setMeta = (revision, hash) => {try {store.setItem(metaKey, JSON.stringify({userId, revision, hash}));} catch (_) {throw Error('metadata_storage');}};
    async function inspect() {
      if (!isActive()) throw Error('changed');
      const remote = await request({action:'get'});
      if (!Number.isSafeInteger(remote.revision) || remote.revision < 0 || !snapshot.validate(remote.snapshot)) throw Error('invalid_remote');
      const local = snapshot.capture(store);
      const [localHash, remoteHash] = await Promise.all([digest(local), digest(remote.snapshot)]);
      if (!isActive()) throw Error('changed');
      const meta = getMeta();
      let state;
      if (remote.revision > 0 && localHash === remoteHash) { setMeta(remote.revision, localHash); state = 'equal'; }
      else if (remote.revision === 0) state = 'initial';
      else if (meta && meta.revision === remote.revision && meta.hash === remoteHash) state = 'local-changed';
      else if (meta && meta.hash === localHash && meta.revision !== remote.revision) state = 'remote-changed';
      else state = 'conflict';
      return {state, remote, local, localHash, remoteHash, hasBaseline:!!meta};
    }
    async function push(plan, beforeCommit=()=>true) {
      const current = await inspect();
      if (current.remote.revision !== plan.remote.revision || current.localHash !== plan.localHash) throw Error('changed');
      if (!beforeCommit() || canonical(snapshot.capture(store)) !== canonical(current.local)) throw Error('changed');
      const result = await request({action:'put', revision:current.remote.revision, snapshot:current.local});
      if (!Number.isSafeInteger(result.revision) || result.revision !== current.remote.revision + 1) throw Error('invalid_response');
      if (!beforeCommit()) throw Error('changed');
      setMeta(result.revision, current.localHash);
      return result;
    }
    async function pull(plan, beforeApply=()=>true, options={}) {
      const current = await inspect();
      if (current.remote.revision !== plan.remote.revision || current.localHash !== plan.localHash || current.remoteHash !== plan.remoteHash) throw Error('changed');
      // Recheck storage after the last asynchronous operation, immediately before writing.
      if (!await beforeApply()) throw Error('changed');
      const latest = snapshot.capture(store);
      if (canonical(latest) !== canonical(current.local)) throw Error('changed');
      const backup = snapshot.apply(store, current.remote.snapshot);
      let metaSaved = true;
      try { setMeta(current.remote.revision, current.remoteHash); } catch (_) { metaSaved = false; }
      // Only remove a temporary backup once data and metadata have both been
      // written. First-contact and manual restores always retain their backup.
      if(metaSaved && options.ephemeralBackup){try{store.removeItem(backup.backupKey);}catch(_){/* retaining it is safe */}}
      return {backup, metaSaved};
    }
    function forget() { store.removeItem(metaKey); }
    return {inspect, push, pull, forget};
  }
  const api = {makeEngine, canonical, digest, META};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MedzoSyncEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
