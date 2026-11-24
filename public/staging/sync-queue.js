/** Memory-only, explicitly synchronized correction outbox. No persistence or background sends. */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId=x=>typeof x==='string'&&uuid.test(x);
const validReason=(reason,status)=>reason==='incorrect_mark'||(reason==='verified_attendance'&&status==='present')||(reason==='verified_absence'&&status==='absent');
export function correctionDraft({sessionId,rosterId,requestId,expectedVersion,status,reason}){
 if(![sessionId,rosterId,requestId].every(validId)||!Number.isSafeInteger(expectedVersion)||expectedVersion<1||expectedVersion>2147483647||!['present','absent'].includes(status)||!validReason(reason,status))throw Error('INVALID_DRAFT');
 return Object.freeze({action:'submit',sessionId:sessionId.toLowerCase(),rosterId:rosterId.toLowerCase(),requestId:requestId.toLowerCase(),expectedVersion,status,reason});
}
export class CorrectionQueue{
 #owner=null;#items=[];#generation=0;#busy=false;
 get busy(){return this.#busy;}
 get items(){return this.#items.map(i=>({draft:i.draft,state:i.state,createdAt:i.createdAt}));}
 bind(owner){
  if(typeof owner!=='string'||!owner)throw Error('IDENTITY_REQUIRED');
  if(owner!==this.#owner){this.clear();this.#owner=owner;}
 }
 clear(){this.#generation++;this.#owner=null;this.#items=[];this.#busy=false;}
 enqueue(input){
  if(!this.#owner)throw Error('IDENTITY_REQUIRED');
  if(this.#busy)throw Error('SYNC_IN_PROGRESS');
  const draft=correctionDraft(input);
  if(this.#items.length>=20)throw Error('QUEUE_FULL');
  if(this.#items.some(i=>i.draft.requestId===draft.requestId||i.draft.sessionId===draft.sessionId&&i.draft.rosterId===draft.rosterId))throw Error('DRAFT_ALREADY_QUEUED');
  this.#items.push({draft,state:'queued',createdAt:Date.now()});
  return draft;
 }
 restore(items){
  if(!this.#owner||this.#busy||this.#items.length)throw Error('QUEUE_NOT_EMPTY');
  if(!Array.isArray(items)||items.length>20)throw Error('INVALID_DRAFT');
  const seen=new Set(),pairs=new Set();
  this.#items=items.map(i=>{const draft=correctionDraft(i.draft),pair=draft.sessionId+':'+draft.rosterId;if(seen.has(draft.requestId)||pairs.has(pair)||!['queued','retry','blocked'].includes(i.state)||!Number.isSafeInteger(i.createdAt))throw Error('INVALID_DRAFT');seen.add(draft.requestId);pairs.add(pair);return {draft,state:i.state,createdAt:i.createdAt};});
 }
 discard(requestId){
  if(this.#busy)throw Error('SYNC_IN_PROGRESS');
  this.#items=this.#items.filter(i=>i.draft.requestId!==requestId);
 }
 async sync(owner,send,{online=true,current=()=>true}={}){
  if(!this.#owner||owner!==this.#owner||this.#busy||!online||!current())return {sent:0,stopped:true};
  const generation=this.#generation;this.#busy=true;let sent=0;
  const active=()=>generation===this.#generation&&owner===this.#owner&&current();
  try{
   for(const item of [...this.#items]){
    if(!active())return {sent,stopped:true};
    if(item.state==='blocked')continue;
    try{
     const result=await send(item.draft);
     if(!active())return {sent,stopped:true};
     if(result?.requestId!==item.draft.requestId||result?.sessionId!==item.draft.sessionId||result?.rosterId!==item.draft.rosterId||result?.baseVersion!==item.draft.expectedVersion||result?.proposedStatus!==item.draft.status||result?.reason!==item.draft.reason||result?.madeByMe!==true)throw Error('AMBIGUOUS_RESPONSE');
     this.#items=this.#items.filter(i=>i!==item);sent++;
    }catch(error){
     if(!active())return {sent,stopped:true};
     if([400,403,409,422].includes(error?.status)){item.state='blocked';return {sent,stopped:true};}
     item.state='retry';return {sent,stopped:true};
    }
   }
   return {sent,stopped:false};
  }finally{if(generation===this.#generation)this.#busy=false;}
 }
}
