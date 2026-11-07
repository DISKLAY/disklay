/* Temporary deployment loader: pinned source plus a content hash, never untrusted input.
 * Cold starts need GitHub. Replace with a directly bundled upload when available. */
const r=await fetch('https://raw.githubusercontent.com/DISKLAY/disklay/bae313be1d7789494ce75e7e159c26b0f2ec3bc2/supabase/functions/medzo-credentials/bundle.js');
if(!r.ok)throw Error('bundle_fetch_failed');
const code=await r.text();
const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code))),x=>x.toString(16).padStart(2,'0')).join('');
if(hash!=='6a06268ba50d4969d3c970b417e497c8649cbed76537c0fdd7d3e0c7bde7420a')throw Error('bundle_checksum_mismatch');
(0,eval)(code);
