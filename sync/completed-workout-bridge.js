/* Account-bound completed-workout bridge. No network operations.
   Uploads remain OFF unless the caller explicitly enables this bridge AND
   supplies a matching verified identity plus an enabled isolated journal. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2CompletedSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ID=/^[a-zA-Z0-9_:.\-]{1,160}$/;
 const OWNER=/^[a-zA-Z0-9_-]{1,128}$/;
 const RECEIPT_PREFIX='mlc2-completed-queued-v1:';
 function validSession(s){
  return !!s&&ID.test(s.id||'')&&OWNER.test(s.ownerId||'')&&
   typeof s.created==='string'&&!Number.isNaN(Date.parse(s.created))&&
   Array.isArray(s.sets)&&s.sets.length>0&&s.sets.length<=250&&
   s.sets.every(x=>x&&typeof x.exerciseId==='string'&&
    Number.isFinite(Number(x.reps))&&Number(x.reps)>0&&
    Number.isFinite(Number(x.weight))&&Number(x.weight)>=0);
 }
 function stage({session,verifiedOwner,storage,journal,enabled=false}={}){
  if(!enabled)return {status:'disabled'};
  if(!OWNER.test(verifiedOwner||'')||!session||session.ownerId!==verifiedOwner)
   return {status:'owner-unverified'};
  if(!validSession(session))return {status:'invalid-session'};
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||
   !journal||typeof journal.enqueue!=='function'||typeof journal.list!=='function')
   throw Error('Durable storage and journal required');
  const key=RECEIPT_PREFIX+verifiedOwner+':'+session.id;
  if(storage.getItem(key)!==null)return {status:'already-queued'};
  const pending=journal.list();
  if(pending.owner!==verifiedOwner)throw Error('Journal owner mismatch');
  if(pending.items.some(x=>x.type==='session'&&x.id===session.id))
   return {status:'already-pending'};
  // Persist the journal operation first; the receipt records local enqueue only.
  // Do not infer server delivery from this receipt.
  const item=journal.enqueue('session',session.id,session,0);
  try{storage.setItem(key,item.opId)}catch{
   return {status:'queued-receipt-unavailable',operationId:item.opId};
  }
  return {status:'queued',operationId:item.opId};
 }
 return Object.freeze({stage,validSession,RECEIPT_PREFIX});
});
