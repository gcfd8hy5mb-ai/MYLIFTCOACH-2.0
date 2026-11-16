/* MYLIFTCOACH 2.0 isolated sync journal. NO network calls or account writes
   without explicit injected transport and enabled:true. The browser preview does
   not construct a live transport. This module also runs in Node tests. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2Sync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION=1,PREFIX='mlc2-sync-journal-v1:';
 const TYPES=new Set(['session','custom-plan','tracking','measurement','meal','goal']);
 function validOwner(owner){return typeof owner==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(owner)}
 function validId(id){return typeof id==='string'&&id.length>=1&&id.length<=160&&/^[a-zA-Z0-9_:.\-]+$/.test(id)}
 function clone(value){return JSON.parse(JSON.stringify(value))}
 function load(store,owner){
  try{
   const raw=store.getItem(PREFIX+owner);
   if(!raw)return {version:VERSION,owner,items:[],conflicts:[]};
   if(raw.length>2500000)throw Error('Journal too large');
   const doc=JSON.parse(raw);
   if(doc?.version!==VERSION||doc.owner!==owner||!Array.isArray(doc.items)||!Array.isArray(doc.conflicts)||doc.items.length>3000)throw Error('Invalid journal');
   return doc;
  }catch(err){throw Error('Journal unreadable; do not overwrite it: '+err.message)}
 }
 function create({owner,storage,transport=null,enabled=false,makeId=null}){
  if(!validOwner(owner))throw Error('Verified owner ID required');
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw Error('Durable storage required');
  const key=PREFIX+owner;
  const random=makeId||(()=>{if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();throw Error('Secure random ID unavailable')});
  let state=load(storage,owner),busy=false;
  function persist(next){
   // Treat failed write as no-op so displayed state never outruns durable data.
   storage.setItem(key,JSON.stringify(next));
   state=next;
  }
  function validate(type,id){if(!TYPES.has(type)||!validId(id))throw Error('Unsupported sync record')}
  function enqueue(type,id,value,baseRevision=0){
   validate(type,id);
   if(!Number.isSafeInteger(baseRevision)||baseRevision<0)throw Error('Invalid base revision');
   if(value===undefined)throw Error('Record payload required');
   const payload=clone(value);
   if(JSON.stringify(payload).length>100000)throw Error('Payload too large');
   const opId=random();
   if(!validId(opId))throw Error('Invalid operation ID');
   // Never overwrite an unacknowledged operation for the same record.
   if(state.items.some(item=>item.type===type&&item.id===id))throw Error('Record has pending operation; resolve before editing');
   const item={opId,owner,type,id,kind:'upsert',baseRevision,payload,status:'queued',attempts:0};
   persist({...state,items:[...state.items,item]});
   return clone(item);
  }
  function enqueueDelete(type,id,baseRevision){
   validate(type,id);
   if(!Number.isSafeInteger(baseRevision)||baseRevision<1)throw Error('Delete needs known server revision');
   const opId=random();
   if(!validId(opId))throw Error('Invalid operation ID');
   if(state.items.some(item=>item.type===type&&item.id===id))throw Error('Record has pending operation');
   const item={opId,owner,type,id,kind:'delete',baseRevision,payload:null,status:'queued',attempts:0};
   persist({...state,items:[...state.items,item]});
   return clone(item);
  }
  function list(){return clone(state)}
  async function drain({verifiedOwner,online=true,maxOperations=50}={}){
   if(!enabled)return {status:'disabled',pending:state.items.length};
   if(verifiedOwner!==owner)return {status:'owner-unverified',pending:state.items.length};
   if(!online)return {status:'offline',pending:state.items.length};
   if(!transport||typeof transport.commit!=='function')throw Error('Verified cloud transport missing');
   if(busy)return {status:'busy',pending:state.items.length};
   busy=true;
   try{
    let sent=0;
    for(const item of [...state.items].slice(0,Math.min(50,maxOperations))){
     if(item.status==='conflict')return {status:'conflict',pending:state.items.length};
     if(verifiedOwner!==owner)break;
     const next={...item,attempts:item.attempts+1};
     persist({...state,items:state.items.map(x=>x.opId===item.opId?next:x)});
     let ack;
     try{ack=await transport.commit(clone(next),owner)}
     catch(err){
      if(err?.status===409||err?.code==='CONFLICT'){
       const conflict={...next,status:'conflict',serverRevision:Number(err.revision)||null};
       persist({...state,items:state.items.map(x=>x.opId===item.opId?conflict:x),conflicts:[...state.conflicts,{opId:item.opId,type:item.type,id:item.id}]});
       return {status:'conflict',pending:state.items.length};
      }
      // Network/server failure: leave the SAME immutable operation ID queued for retry.
      return {status:'retry',pending:state.items.length};
     }
     if(ack?.owner!==owner||ack?.opId!==item.opId||!Number.isSafeInteger(ack.revision)||ack.revision<=item.baseRevision)
      return {status:'unverified-ack',pending:state.items.length};
     persist({...state,items:state.items.filter(x=>x.opId!==item.opId)});
     sent++;
    }
    return {status:state.items.length?'pending':'idle',sent,pending:state.items.length};
   }finally{busy=false}
  }
  function resolveConflict(opId,{strategy,revision}={}){
   const item=state.items.find(x=>x.opId===opId&&x.status==='conflict');
   if(!item)throw Error('No matching conflict');
   if(strategy==='keep-server'){
    persist({...state,items:state.items.filter(x=>x.opId!==opId),conflicts:state.conflicts.filter(x=>x.opId!==opId)});
    return;
   }
   // Must explicitly inspect server state and resolve before retry.
   if(strategy==='retry-local'&&Number.isSafeInteger(revision)&&revision>=1){
    const next={...item,baseRevision:revision,status:'queued',attempts:0,opId:random()};
    persist({...state,items:state.items.map(x=>x.opId===opId?next:x),conflicts:state.conflicts.filter(x=>x.opId!==opId)});
    return;
   }
   throw Error('Conflict must be resolved explicitly against server revision');
  }
  return Object.freeze({enqueue,enqueueDelete,list,drain,resolveConflict});
 }
 return Object.freeze({create,load,VERSION,PREFIX});
});
