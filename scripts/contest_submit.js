// contest_submit.js - Shared contest submission helpers for problem pages
(function(){
  function getProfile(){
    try{ return JSON.parse(localStorage.getItem('contest_profile')||'{}'); }catch(e){ return {}; }
  }
  function setProfile(p){ try{ localStorage.setItem('contest_profile', JSON.stringify(p||{})); }catch(e){} }
  function getHandle(){ const p=getProfile(); return (p.handle||'').trim(); }
  function sanitizeHandle(s){ return String(s||'').replace(/[\\/]/g,'-').trim().replace(/\s+/g,' '); }
  function bytesLen(str){ return new TextEncoder().encode(str||'').length; }
  // Encryption (v4 AES-GCM + RSA-OAEP; fallback v3 XOR)
  async function buildPayload(challenge, source){
    const handle = getHandle() || 'anon';
    const enc = new TextEncoder();
    const pubPem = (window.__CONFIG__ && window.__CONFIG__.submitPublicKey) || '';
    if(pubPem && crypto?.subtle){
      const meta = { handle, challenge, bytes: bytesLen(source), ts: new Date().toISOString() };
      const bundle = JSON.stringify({ meta, code: source });
      const pemToArrayBuffer = (pem)=>{ const b64=pem.replace(/-----BEGIN [^-]+-----/g,'').replace(/-----END [^-]+-----/g,'').replace(/\s+/g,''); const bin=atob(b64); const buf=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i); return buf.buffer; };
      const toB64 = (buf)=>{ const b=new Uint8Array(buf); let s=''; for(let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); };
      const aesKey = await crypto.subtle.generateKey({name:'AES-GCM', length:256}, true, ['encrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encBundle = await crypto.subtle.encrypt({name:'AES-GCM', iv}, aesKey, enc.encode(bundle));
      const rawAes = await crypto.subtle.exportKey('raw', aesKey);
      const spki = pemToArrayBuffer(pubPem);
      const publicKey = await crypto.subtle.importKey('spki', spki, {name:'RSA-OAEP', hash:'SHA-256'}, false, ['encrypt']);
      const keyWrap = await crypto.subtle.encrypt({name:'RSA-OAEP'}, publicKey, rawAes);
      return { type:'contest', version:4, challenge, alg:'aes-256-gcm', iv: toB64(iv), keyWrap: toB64(keyWrap), encBundle: toB64(encBundle) };
    }
    // v3 fallback
    const metaStr = JSON.stringify({ handle, challenge, bytes: bytesLen(source), ts: new Date().toISOString() });
    const keyBytes = new Uint8Array(8); (crypto.getRandomValues? crypto.getRandomValues(keyBytes): keyBytes.fill(7));
    const metaBytes = enc.encode(metaStr); const metaOut = new Uint8Array(metaBytes.length);
    for(let i=0;i<metaBytes.length;i++) metaOut[i] = metaBytes[i] ^ keyBytes[i % keyBytes.length];
    const codeBytes = enc.encode(source); const codeOut = new Uint8Array(codeBytes.length);
    for(let i=0;i<codeBytes.length;i++) codeOut[i] = codeBytes[i] ^ keyBytes[i % keyBytes.length];
    const toHex = b=> Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');
    return { type:'contest', version:3, challenge, enc: toHex(metaOut), encCode: toHex(codeOut), key: toHex(keyBytes) };
  }
  window.__ContestSubmit = { getHandle, setProfile, sanitizeHandle, buildPayload };
})();
