#!/usr/bin/env node
/**
 * decrypt_submission.mjs
 * Admin utility for contest payloads v2/v3/v4.
 * Usage:
 *   node scripts/decrypt_submission.mjs <payload.json>
 *   echo '{"type":"contest",...}' | node scripts/decrypt_submission.mjs
 * v4 requires SUBMIT_PRIVATE_KEY in env or --key=key.pem (PKCS#8 PEM for RSA-OAEP).
 */
import fs from 'fs';

function fromHex(h){ const arr=new Uint8Array(h.length/2); for(let i=0;i<arr.length;i++){ arr[i]=parseInt(h.substr(i*2,2),16); } return arr; }
function xorBytes(a,b){ const out=new Uint8Array(a.length); for(let i=0;i<a.length;i++){ out[i]=a[i]^b[i%b.length]; } return out; }
function b64ToBytes(b64){ return new Uint8Array(Buffer.from(b64,'base64')); }
function pemToBuf(pem){ const b64=pem.replace(/-----[^-]+-----/g,'').replace(/\s+/g,''); return new Uint8Array(Buffer.from(b64,'base64')).buffer; }

async function decryptV4(obj, privPem){
  if(!privPem) throw new Error('Missing private key');
  const subtle = globalThis.crypto?.subtle || (await import('node:crypto')).webcrypto.subtle;
  const iv = b64ToBytes(obj.iv);
  const wrapped = b64ToBytes(obj.keyWrap);
  const encBundle = b64ToBytes(obj.encBundle);
  const privKey = await subtle.importKey('pkcs8', pemToBuf(privPem), { name:'RSA-OAEP', hash:'SHA-256' }, false, ['decrypt']);
  const rawAes = await subtle.decrypt({ name:'RSA-OAEP' }, privKey, wrapped);
  const aesKey = await subtle.importKey('raw', rawAes, { name:'AES-GCM' }, false, ['decrypt']);
  const plain = await subtle.decrypt({ name:'AES-GCM', iv }, aesKey, encBundle);
  const bundle = JSON.parse(Buffer.from(plain).toString('utf8'));
  return bundle;
}

async function main(){
  const args = process.argv.slice(2);
  const keyFlag = args.find(a=>a.startsWith('--key='));
  let privPem = process.env.SUBMIT_PRIVATE_KEY || '';
  if(keyFlag){ try{ privPem = fs.readFileSync(keyFlag.split('=')[1], 'utf8'); }catch(e){ console.error('Read key failed:', e.message); process.exit(1); } }
  // Read file or stdin
  let file = args.find(a=>!a.startsWith('--'));
  let raw='';
  if(file){ try{ raw = fs.readFileSync(file,'utf8'); }catch(e){ console.error('Read file failed:', e.message); process.exit(1); } }
  if(!raw.trim()){
    try{ raw = fs.readFileSync(0,'utf8'); }catch(e){ /* ignore */ }
  }
  if(!raw.trim()){ console.error('No JSON provided'); process.exit(1); }
  let obj; try{ obj = JSON.parse(raw); }catch(e){ console.error('Invalid JSON:', e.message); process.exit(1); }
  if(obj.type!=='contest'){ console.error('Not contest payload'); process.exit(1); }
  let meta, code;
  if(obj.version===2){
    if(!obj.enc || !obj.key || !obj.code){ console.error('Bad v2 payload'); process.exit(1); }
    meta = JSON.parse(Buffer.from(xorBytes(fromHex(obj.enc), fromHex(obj.key))).toString('utf8'));
    code = obj.code;
  } else if(obj.version===3){
    if(!obj.enc || !obj.key || !obj.encCode){ console.error('Bad v3 payload'); process.exit(1); }
    meta = JSON.parse(Buffer.from(xorBytes(fromHex(obj.enc), fromHex(obj.key))).toString('utf8'));
    code = Buffer.from(xorBytes(fromHex(obj.encCode), fromHex(obj.key))).toString('utf8');
  } else if(obj.version===4){
    try{ const bundle = await decryptV4(obj, privPem); meta=bundle.meta; code=bundle.code; }catch(e){ console.error('Decrypt v4 failed:', e.message); process.exit(1); }
  } else { console.error('Unsupported version'); process.exit(1); }
  const result = { version: obj.version, challenge: obj.challenge, meta, codeLength: Buffer.byteLength(code), codePreview: code.slice(0,200) };
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e=>{ console.error(e); process.exit(1); });
