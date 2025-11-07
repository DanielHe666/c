// Cloudflare Worker example: One-click submission endpoint
// - Accepts POST with JSON payload produced by secureContestPayload(version:2)
// - Decrypts metadata (handle, challenge, bytes, ts)
// - Creates a PR to the target GitHub repo by committing submissions/week-<n>/<handle>/solution.c
// Requirements:
//   - Set secrets in Cloudflare Worker: GITHUB_APP_ID, GITHUB_INSTALLATION_ID, GITHUB_PRIVATE_KEY (PEM) OR GITHUB_TOKEN (fine-grained PAT)
//   - Set REPO (e.g., "ChenyuHeee/c") and BASE_BRANCH (e.g., "main")
// Notes:
//   - For production, prefer GitHub App over PAT, and implement additional validation (rate-limit, size checks, signature, captcha as needed)

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }
    if (request.method !== 'POST') {
      return cors(new Response('Method Not Allowed', { status: 405 }));
    }
    let body;
    try { body = await request.json(); } catch { return json({ ok:false, error:'Invalid JSON' }, 400); }
    if (!body || body.type !== 'contest') {
      return json({ ok:false, error:'Bad payload type' }, 400);
    }
    if (body.version === 2) {
      if(!body.enc || !body.key || !body.code) return json({ ok:false, error:'Bad v2 payload' }, 400);
    } else if (body.version === 3) {
      if(!body.enc || !body.key || !body.encCode) return json({ ok:false, error:'Bad v3 payload' }, 400);
    } else if (body.version === 4) {
      if(!body.iv || !body.keyWrap || !body.encBundle) return json({ ok:false, error:'Bad v4 payload' }, 400);
    } else {
      return json({ ok:false, error:'Unsupported version' }, 400);
    }
    // Limit code size to 64KB
    let codeText = '';
    if(body.version === 2){
      codeText = String(body.code||'');
    } else if(body.version === 3){
      // decrypt code
      try {
        const encCode = hexToBytes(body.encCode);
        const key = hexToBytes(body.key);
        const out = new Uint8Array(encCode.length);
        for(let i=0;i<encCode.length;i++){ out[i] = encCode[i] ^ key[i % key.length]; }
        codeText = new TextDecoder().decode(out);
      } catch(e){ return json({ ok:false, error:'Decrypt code failed' }, 400); }
    } else if(body.version === 4){
      // AES-GCM decrypt with RSA-OAEP wrapped key
      try{
        const privPem = env.SUBMIT_PRIVATE_KEY;
        if(!privPem) return json({ ok:false, error:'Missing SUBMIT_PRIVATE_KEY' }, 500);
        const iv = b64ToBytes(body.iv);
        const wrapped = b64ToBytes(body.keyWrap);
        const encBundle = b64ToBytes(body.encBundle);
        const privKey = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(privPem), { name:'RSA-OAEP', hash:'SHA-256' }, false, ['decrypt']);
        const rawAes = await crypto.subtle.decrypt({ name:'RSA-OAEP' }, privKey, wrapped);
        const aesKey = await crypto.subtle.importKey('raw', rawAes, { name:'AES-GCM' }, false, ['decrypt']);
        const plainBuf = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, aesKey, encBundle);
        const bundle = JSON.parse(new TextDecoder().decode(new Uint8Array(plainBuf)));
        if(!bundle || typeof bundle.code!=='string' || !bundle.meta){ return json({ ok:false, error:'Bad v4 bundle' }, 400); }
        codeText = bundle.code;
        body.__v4meta = bundle.meta; // carry for later use
      }catch(e){ return json({ ok:false, error:'Decrypt v4 failed: '+(e&&e.message) }, 400); }
    }
    if (new TextEncoder().encode(codeText).length > 64*1024) {
      return json({ ok:false, error:'Code too large' }, 413);
    }
    // Decrypt metadata
    let meta;
    if(body.version === 4){
      meta = body.__v4meta;
    } else {
      try {
        const encMeta = hexToBytes(body.enc);
        const key = hexToBytes(body.key);
        const out = new Uint8Array(encMeta.length);
        for (let i=0;i<encMeta.length;i++) out[i] = encMeta[i] ^ key[i % key.length];
        meta = JSON.parse(new TextDecoder().decode(out));
      } catch (e) {
        return json({ ok:false, error:'Decrypt meta failed' }, 400);
      }
    }
    const handle = sanitizeHandle(meta.handle||'');
    const week = parseWeek(meta.challenge||'');
    if (!handle || !week) return json({ ok:false, error:'Missing handle or week' }, 400);

  const repo = env.REPO || 'ChenyuHeee/c';
    const base = env.BASE_BRANCH || 'main';
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    const branch = `contest/week-${week}/${handle}/${ts}`;
    const path = `submissions/week-${week}/${handle}/solution.c`;

    try {
      const gh = await getGitHub(env);
      // Get base sha
      const { default_branch } = await api(gh, `/repos/${repo}`);
      const baseBranch = base || default_branch;
      const baseRef = await api(gh, `/repos/${repo}/git/refs/heads/${baseBranch}`);
      const baseSha = baseRef.object.sha;
      // Create branch
      await api(gh, `/repos/${repo}/git/refs`, 'POST', { ref: `refs/heads/${branch}`, sha: baseSha });
      // Create blob
      const blob = await api(gh, `/repos/${repo}/git/blobs`, 'POST', { content: codeText, encoding: 'utf-8' });
      // Create tree
      const tree = await api(gh, `/repos/${repo}/git/trees`, 'POST', { base_tree: baseSha, tree: [{ path, mode: '100644', type: 'blob', sha: blob.sha }] });
      // Create commit
      const commit = await api(gh, `/repos/${repo}/git/commits`, 'POST', { message: `chore: week-${week} submission (${handle})`, tree: tree.sha, parents: [baseSha] });
      // Update branch ref
      await api(gh, `/repos/${repo}/git/refs/heads/${branch}`, 'PATCH', { sha: commit.sha, force: true });
      // Open PR
      const pr = await api(gh, `/repos/${repo}/pulls`, 'POST', { title: `Week-${week} Submission ${handle}`, head: branch, base: baseBranch, body: `Auto-submitted via one-click endpoint. Handle: ${handle}` });
      return json({ ok:true, prUrl: pr.html_url });
    } catch (e) {
      return json({ ok:false, error: String(e && e.message || e) }, 500);
    }
  }
};

function cors(res){
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'content-type');
  return new Response(res.body, { status: res.status, headers: h });
}
function json(obj, status=200){
  const res = new Response(JSON.stringify(obj), { status, headers: { 'content-type':'application/json' } });
  return cors(res);
}
function hexToBytes(hex){ if(hex.length%2) throw new Error('bad hex'); const arr=new Uint8Array(hex.length/2); for(let i=0;i<arr.length;i++){ arr[i]=parseInt(hex.substr(i*2,2),16); } return arr; }
function b64ToBytes(b64){ const bin = atob(b64); const out = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out; }
// Allow spaces in path handle; forbid slashes, collapse spaces, trim, cap length
function sanitizeHandle(s){ return String(s).replace(/[\\/]/g,'-').trim().replace(/\s+/g,' ').slice(0,64); }
function parseWeek(ch){ const m=String(ch).match(/week-(\d+)/i); return m? parseInt(m[1],10): 0; }

async function getGitHub(env){
  if (env.GITHUB_TOKEN) return { token: env.GITHUB_TOKEN };
  // GitHub App JWT flow (simplified). For production use a library.
  const appId = env.GITHUB_APP_ID; const instId = env.GITHUB_INSTALLATION_ID; const pk = env.GITHUB_PRIVATE_KEY;
  if(!appId || !instId || !pk) throw new Error('Missing GitHub credentials');
  const now = Math.floor(Date.now()/1000);
  const jwt = await signJWT({ iat: now-60, exp: now+540, iss: appId }, pk);
  const app = await fetch('https://api.github.com/app/installations/'+instId+'/access_tokens', { method:'POST', headers:{ Authorization:`Bearer ${jwt}`, Accept:'application/vnd.github+json' } });
  if(!app.ok) throw new Error('App token fetch failed');
  const tok = await app.json();
  return { token: tok.token };
}

async function api(gh, path, method='GET', body){
  const res = await fetch('https://api.github.com'+path, { method, headers:{ Authorization:`Bearer ${gh.token}`, Accept:'application/vnd.github+json', 'content-type':'application/json' }, body: body? JSON.stringify(body): undefined });
  if(!res.ok) throw new Error(`GitHub API ${method} ${path} failed: ${res.status}`);
  return await res.json();
}

// Minimal JWT (RS256) signer for Workers using WebCrypto
async function signJWT(payload, pem){
  const header = { alg:'RS256', typ:'JWT' };
  const enc = str => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
  const data = enc(JSON.stringify(header)) + '.' + enc(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(pem), { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name:'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(data)));
  const signature = btoa(String.fromCharCode(...sig)).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
  return data + '.' + signature;
}
function pemToArrayBuffer(pem){ const b64 = pem.replace(/-----[^-]+-----/g,'').replace(/\s+/g,''); const raw = atob(b64); const arr = new Uint8Array(raw.length); for (let i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i); return arr.buffer; }
