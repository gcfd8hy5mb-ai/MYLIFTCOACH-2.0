/* Direct integration of the previously verified isolated MYLIFTCOACH 2.0
   automatic-sync flow with account-scoped completed workout storage.
   Original PRISM keys/tables are never read or written. Browser calls are
   initiated by the signed-in integration candidate only. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2AutoWorkouts=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const canon=value=>Array.isArray(value)?value.map(canon):
  value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canon(value[k])])):value;
 const same=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
 const idOk=id=>typeof id==='string'&&/^[a-zA-Z0-9_:.\-]{1,160}$/.test(id);
 function create({owner,storage,accountStore,Sync,transport,verify,active,online=()=>true}){
  if(!owner||!storage||!accountStore||!Sync||!transport||typeof verify!=='function'||
     typeof active!=='function')throw Error('Authenticated sync dependencies required');
  let busy=false;
  const isActive=()=>active()===owner;
  function local(){if(!isActive())throw Error('Account changed');return accountStore.read(storage,owner)}
  async function pageCloud(){
   const result=[],seen=new Set();let afterId='';
   for(let p=0;p<20;p++){
    if(!isActive())throw Error('Account changed');
    const rows=await transport.listSessions(owner,{afterId,limit:50});
    if(!isActive())throw Error('Account changed');
    if(!Array.isArray(rows)||rows.length>50)throw Error('Invalid cloud workout page');
    for(const row of rows){
     if(row.owner!==owner||row.type!=='session'||!idOk(row.id)||
        !Number.isSafeInteger(row.revision)||row.revision<1||typeof row.deleted!=='boolean'||
        seen.has(row.id)||row.id<=afterId)throw Error('Invalid or unordered cloud workout');
     seen.add(row.id);result.push(row);
    }
    if(rows.length<50)return result;
    afterId=rows[rows.length-1].id;
   }
   throw Error('Cloud history exceeds safe limit');
  }
  async function inspected(){
   if(!isActive())throw Error('Account changed');
   const auth=await verify(owner);
   if(auth?.userId!==owner||!isActive())throw Error('Authenticated owner changed');
   const rows=await pageCloud(),device=local();
   const byId=new Map(rows.map(row=>[row.id,row]));
   const missing=[],conflicts=[],matched=[],newLocal=[];
   for(const record of device){
    if(record.ownerId!==owner)throw Error('Foreign device workout');
    const cloud=byId.get(record.id);
    if(!cloud)newLocal.push(record);
    else if(cloud.deleted||!same(cloud.payload,record))conflicts.push(record.id);
    else matched.push(record.id);
   }
   const ids=new Set(device.map(row=>row.id));
   for(const row of rows){
    if(row.deleted||ids.has(row.id))continue;
    const payload=row.payload;
    if(!payload||payload.ownerId!==owner||payload.id!==row.id||
       !idOk(payload.id)||!Array.isArray(payload.sets)||!payload.sets.length||
       !payload.sets.every(s=>s&&typeof s.exerciseId==='string'&&
         Number.isFinite(Number(s.weight))&&Number(s.weight)>=0&&
         Number.isInteger(Number(s.reps))&&Number(s.reps)>0)){
      conflicts.push(row.id);continue;
    }
    missing.push(payload);
   }
   return {device,rows,missing,conflicts,matched,newLocal};
  }
  function queue(session){
   if(!isActive()||session?.ownerId!==owner)throw Error('Session owner mismatch');
   const current=local();
   if(!current.some(row=>row.id===session.id&&same(row,session)))
    throw Error('Workout must be durably saved on device before cloud queue');
   const journal=Sync.create({owner,storage});
   if(journal.list().items.some(op=>op.type==='session'&&op.id===session.id))
    return {status:'already-pending'};
   journal.enqueue('session',session.id,session,0);
   return {status:'queued'};
  }
  async function flush(){
   if(busy)return {status:'busy'};
   if(!isActive())return {status:'owner-changed'};
   if(!online())return {status:'offline'};
   busy=true;
   try{
    const report=await inspected();
    if(!isActive())return {status:'owner-changed'};
    const journal=Sync.create({owner,storage,transport,enabled:true});
    const pending=new Set(journal.list().items.filter(op=>op.type==='session').map(op=>op.id));
    for(const record of report.newLocal){
     if(!pending.has(record.id)){journal.enqueue('session',record.id,record,0);pending.add(record.id)}
    }
    // If a same-ID remote record differs, abort instead of writing or overwriting.
    if(report.conflicts.length)return {status:'conflict',conflicts:report.conflicts.length,
      available:report.missing.length,pending:journal.list().items.length};
    const sent=await journal.drain({verifiedOwner:owner,online:online(),maxOperations:50});
    if(!isActive())return {status:'owner-changed'};
    if(sent.status==='retry'||sent.status==='unverified-ack')return {status:'retry',pending:sent.pending};
    return {status:sent.status,uploaded:sent.sent||0,pending:sent.pending||0,
      available:report.missing.length,alreadySaved:report.matched.length};
   }finally{busy=false}
  }
  async function previewRecovery(){
   const report=await inspected();
   if(!isActive())throw Error('Account changed');
   return {missing:report.missing.length,conflicts:report.conflicts.length,
    existing:report.device.length,canRestore:report.conflicts.length===0&&
    report.device.length+report.missing.length<=500};
  }
  async function restore({confirmRestore}={}){
   if(typeof confirmRestore!=='function')throw Error('Explicit restore confirmation required');
   const report=await inspected();
   if(report.conflicts.length)throw Error('Cloud conflicts must be reviewed before restoration');
   if(!report.missing.length)return {status:'up-to-date',restored:0};
   if(report.device.length+report.missing.length>500)throw Error('Device workout limit reached');
   if(!await confirmRestore(report.missing.length))return {status:'cancelled',restored:0};
   if(!isActive())throw Error('Account changed while confirming recovery');
   // Re-fetch remotely and locally after confirmation, never trust a stale snapshot.
   const fresh=await inspected();
   if(fresh.conflicts.length)throw Error('Cloud conflicts appeared; restoration blocked');
   if(!isActive())throw Error('Account changed during restore');
   const latest=local(),byId=new Map(latest.map(x=>[x.id,x]));
   const added=[];
   for(const row of fresh.missing){
    if(byId.has(row.id)){if(!same(byId.get(row.id),row))throw Error('Local record changed');}
    else added.push(row);
   }
   if(latest.length+added.length>500)throw Error('Device workout limit reached');
   if(!added.length)return {status:'up-to-date',restored:0};
   const key=accountStore.key(owner),prior=storage.getItem(key);
   // Prevent concurrent edits from being overwritten.
   if(prior!==null&&prior!==JSON.stringify(latest))throw Error('Local history changed');
   accountStore.save(storage,owner,[...latest,...added].sort((a,b)=>Date.parse(b.created)-Date.parse(a.created)));
   return {status:'restored',restored:added.length};
  }
  return Object.freeze({queue,flush,previewRecovery,restore});
 }
 return Object.freeze({create,same});
});
