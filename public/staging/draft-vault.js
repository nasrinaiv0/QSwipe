/** Opt-in encrypted correction outbox. No credentials or keys are persisted. */
import {correctionDraft} from './sync-queue.js';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const ITER=600000,TTL=7*24*60*60*1000,MAX=65536;
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const unhex=(s,n)=>{if(typeof s!=='string'||s.length!==n*2||!/^[0-9a-f]+$/.test(s))throw Error('VAULT_INVALID');return Uint8Array.from(s.match(/../g),x=>parseInt(x,16));};
const pack=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const unpack=s=>{if(typeof s!=='string'||s.length>MAX||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))throw Error('VAULT_INVALID');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));};
export function validateVaultItems(items,now=Date.now()){
 if(!Array.isArray(items)||items.length>20)throw Error('VAULT_INVALID');
 const seen=new Set(),pairs=new Set(),out=[];
 for(const item of items){
  if(!item||!['queued','retry','blocked'].includes(item.state)||!Number.isSafeInteger(item.createdAt)||item.createdAt<=0||item.createdAt>now+60000)throw Error('VAULT_INVALID');
  const draft=correctionDraft(item.draft),pair=draft.sessionId+':'+draft.rosterId;
  if(seen.has(draft.requestId)||pairs.has(pair))throw Error('VAULT_INVALID');
  seen.add(draft.requestId);pairs.add(pair);
  if(now-item.createdAt<TTL)out.push({draft,state:item.state,createdAt:item.createdAt});
 }
 return out;
}
export async function vaultNamespace(owner,cryptoImpl=globalThis.crypto){
 if(typeof owner!=='string'||!owner||owner.length>300)throw Error('IDENTITY_REQUIRED');
 return 'qswipe.p6.v1.'+hex(await cryptoImpl.subtle.digest('SHA-256',enc.encode(owner)));
}
export async function deriveVaultKey(passphrase,salt,cryptoImpl=globalThis.crypto){
 if(typeof passphrase!=='string'||passphrase.length<16||passphrase.length>256)throw Error('PASSPHRASE_LENGTH');
 const base=await cryptoImpl.subtle.importKey('raw',enc.encode(passphrase),'PBKDF2',false,['deriveKey']);
 return cryptoImpl.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITER,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function sealVault(key,salt,namespace,items,cryptoImpl=globalThis.crypto){
 const iv=cryptoImpl.getRandomValues(new Uint8Array(12));
 const cipher=await cryptoImpl.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(namespace),tagLength:128},key,enc.encode(JSON.stringify(validateVaultItems(items))));
 return JSON.stringify({v:1,salt:hex(salt),iv:hex(iv),cipher:pack(cipher)});
}
function parseEnvelope(raw){
 if(typeof raw!=='string'||raw.length>MAX)throw Error('VAULT_INVALID');
 const v=JSON.parse(raw);if(!v||v.v!==1||Object.keys(v).length!==4)throw Error('VAULT_INVALID');
 return {salt:unhex(v.salt,16),iv:unhex(v.iv,12),cipher:unpack(v.cipher)};
}
export async function openVault(raw,passphrase,namespace,cryptoImpl=globalThis.crypto){
 const {salt,iv,cipher}=parseEnvelope(raw),key=await deriveVaultKey(passphrase,salt,cryptoImpl);
 const plain=await cryptoImpl.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode(namespace),tagLength:128},key,cipher);
 return {key,salt,items:validateVaultItems(JSON.parse(dec.decode(plain)))};
}
export class DraftVault{
 #key=null;#salt=null;#namespace=null;#release=null;#generation=0;#saving=false;#unlocking=false;
 constructor({storage=globalThis.localStorage,locks=globalThis.navigator?.locks,cryptoImpl=globalThis.crypto}={}){this.storage=storage;this.locks=locks;this.crypto=cryptoImpl;}
 get unlocked(){return !!this.#key;}
 get busy(){return this.#saving||this.#unlocking;}
 lock(){this.#generation++;this.#key=null;this.#salt=null;this.#namespace=null;this.#release?.();this.#release=null;this.#saving=false;this.#unlocking=false;}
 async unlock(owner,passphrase,current=()=>true){
  if(this.busy||this.unlocked)throw Error('VAULT_BUSY');
  if(!this.locks||!this.crypto?.subtle||!this.storage)throw Error('VAULT_UNAVAILABLE');
  const g=++this.#generation;this.#unlocking=true;
  let release=null;
  const active=()=>g===this.#generation&&current();
  try{
   const namespace=await vaultNamespace(owner,this.crypto);
   if(!active())throw Error('VAULT_CANCELLED');
   await new Promise((resolve,reject)=>{
    this.locks.request(namespace,{mode:'exclusive',ifAvailable:true},lock=>{
     if(!lock){reject(Error('VAULT_OTHER_TAB'));return;}
     return new Promise(done=>{release=done;if(!active()){done();reject(Error('VAULT_CANCELLED'));return;}this.#release=done;resolve();});
    }).catch(reject);
   });
   if(!active())throw Error('VAULT_CANCELLED');
   const raw=this.storage.getItem(namespace);
   const opened=raw===null?{salt:this.crypto.getRandomValues(new Uint8Array(16)),items:[]}:await openVault(raw,passphrase,namespace,this.crypto);
   if(!opened.key)opened.key=await deriveVaultKey(passphrase,opened.salt,this.crypto);
   if(!active())throw Error('VAULT_CANCELLED');
   this.#key=opened.key;this.#salt=opened.salt;this.#namespace=namespace;
   return opened.items;
  }catch(e){release?.();if(g===this.#generation)this.lock();throw e;}
  finally{if(g===this.#generation)this.#unlocking=false;}
 }
 async save(items,current=()=>true){
  if(!this.unlocked||this.busy)throw Error('VAULT_LOCKED');
  const g=this.#generation,namespace=this.#namespace,key=this.#key,salt=this.#salt;this.#saving=true;
  try{
   const raw=await sealVault(key,salt,namespace,items,this.crypto);
   if(g!==this.#generation||!current())throw Error('VAULT_CANCELLED');
   this.storage.setItem(namespace,raw);
  }finally{if(g===this.#generation)this.#saving=false;}
 }
 delete(){if(!this.unlocked||this.busy)throw Error('VAULT_LOCKED');this.storage.removeItem(this.#namespace);this.lock();}
}
