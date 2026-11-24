import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {DraftVault,vaultNamespace,deriveVaultKey,sealVault,openVault,validateVaultItems} from '../public/staging/draft-vault.js';
const id=n=>String(n).repeat(8)+'-1111-4111-8111-111111111111';
const pass='fictional random words for test only';
const owner='https://aaaaaaaaaaaaaaaaaaaa.supabase.co:'+id(1);
const item={draft:{action:'submit',sessionId:id(2),rosterId:id(3),requestId:id(4),expectedVersion:1,status:'present',reason:'incorrect_mark'},state:'queued',createdAt:Date.now()};
const makeStorage=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
function makeLocks(){const held=new Set();return {async request(name,options,callback){if(held.has(name))return callback(null);held.add(name);try{return await callback({name});}finally{held.delete(name);}}};}
test('vault encrypts, restores and rejects wrong key, tamper and different namespace',async()=>{
 const ns=await vaultNamespace(owner,webcrypto),salt=webcrypto.getRandomValues(new Uint8Array(16)),key=await deriveVaultKey(pass,salt,webcrypto);
 assert.equal(key.extractable,false);
 const a=await sealVault(key,salt,ns,[item],webcrypto),b=await sealVault(key,salt,ns,[item],webcrypto);
 assert.notEqual(JSON.parse(a).iv,JSON.parse(b).iv);assert.ok(!a.includes(item.draft.requestId)&&!a.includes('incorrect_mark')&&!a.includes(pass));
 assert.deepEqual((await openVault(a,pass,ns,webcrypto)).items,[item]);
 await assert.rejects(()=>openVault(a,'different long passphrase',ns,webcrypto));
 await assert.rejects(()=>openVault(a,pass,ns+'x',webcrypto));
 const e=JSON.parse(a);e.cipher=(e.cipher[0]==='A'?'B':'A')+e.cipher.slice(1);
 await assert.rejects(()=>openVault(JSON.stringify(e),pass,ns,webcrypto));
});
test('durable vault locks per account, preserves ciphertext on wrong key and deletes only after unlock',async()=>{
 const storage=makeStorage(),locks=makeLocks(),v=new DraftVault({storage,locks,cryptoImpl:webcrypto}),w=new DraftVault({storage,locks,cryptoImpl:webcrypto});
 assert.deepEqual(await v.unlock(owner,pass),[]);await v.save([item]);
 const ns=await vaultNamespace(owner,webcrypto),saved=storage.getItem(ns);
 await assert.rejects(()=>w.unlock(owner,pass),/VAULT_OTHER_TAB/);
 v.lock();await assert.rejects(()=>w.unlock(owner,'different long passphrase'));assert.equal(storage.getItem(ns),saved);
 assert.deepEqual(await w.unlock(owner,pass),[item]);w.delete();assert.equal(storage.getItem(ns),null);
});
test('vault bounds and expires drafts, rejects duplicates, strips unexpected fields',()=>{
 assert.equal(validateVaultItems([{...item,createdAt:Date.now()-8*86400000}]).length,0);
 assert.throws(()=>validateVaultItems([item,item]));assert.throws(()=>validateVaultItems([{...item,state:'unknown'}]));assert.throws(()=>validateVaultItems(Array(21).fill(item)));
 assert.equal(Object.hasOwn(validateVaultItems([{...item,draft:{...item.draft,token:'secret'}}])[0].draft,'token'),false);
});
test('unsupported storage or cancellation fail closed; no late ciphertext write',async()=>{
 const storage=makeStorage(),v=new DraftVault({storage,locks:makeLocks(),cryptoImpl:webcrypto});
 await v.unlock(owner,pass);const pending=v.save([item]);v.lock();await assert.rejects(()=>pending,/VAULT_CANCELLED/);assert.equal(storage.map.size,0);
 const unsupported=new DraftVault({storage,locks:null,cryptoImpl:webcrypto});await assert.rejects(()=>unsupported.unlock(owner,pass),/VAULT_UNAVAILABLE/);
});
