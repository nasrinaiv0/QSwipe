import {createRoomService} from './service.mjs';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const unavailable=()=>Object.assign(Error('ROOM_STORE_UNAVAILABLE'),{code:'ROOM_STORE_UNAVAILABLE',status:503});
export function createPersistentRoomService(store,options={}){
 return {async command(body,secret){
  for(let attempt=0;attempt<5;attempt++){
   const old=await store.load();
   if(!old||!Number.isSafeInteger(old.version)||!Array.isArray(old.rooms)||old.rooms.length>100)throw unavailable();
   const engine=createRoomService({...options,initial:old.rooms});
   const result=engine.command(body,secret),rooms=engine.exportState();
   if(JSON.stringify(rooms)===JSON.stringify(old.rooms))return result;
   if(await store.compareAndSwap(old.version,rooms))return result;
  }
  throw unavailable();
 }};
}
// Local single-writer file store for isolated testing only.
export function createFileStore(path){
 let tail=Promise.resolve();
 const load=async()=>{try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return {version:0,rooms:[]};throw e;}};
 return {load,compareAndSwap(version,rooms){
  const task=tail.then(async()=>{const old=await load();if(old.version!==version)return false;const temp=path+'.'+randomBytes(8).toString('hex');await writeFile(temp,JSON.stringify({version:version+1,rooms}),{mode:0o600,flag:'wx'});await rename(temp,path);return true;});tail=task.catch(()=>{});return task;
 }};
}
export function createSupabaseStore(config,fetchImpl=fetch){
 async function rpc(op,version,rooms){let res;try{res=await fetchImpl(config.origin+'/rest/v1/rpc/qs_room_snapshot',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000),headers:{apikey:config.key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({p_secret:config.secret,p_op:op,p_version:version,p_rooms:rooms})});if(!res.ok)throw unavailable();return await res.json();}catch{throw unavailable();}}
 return {load:()=>rpc('load',null,null),compareAndSwap:async(version,rooms)=>(await rpc('cas',version,rooms))===true};
}
