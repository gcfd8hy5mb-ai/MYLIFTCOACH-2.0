/* MYLIFTCOACH 2.0 opt-in auxiliary cloud backup/recovery.
   Reuses the original isolated RPC transport, journal and AuxData validators.
   No automatic overwrite, deletion, guest transfer or original-app writes. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2AuxCloud=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function create({owner,storage,aux,Sync,transport,verify,active,online=()=>true}){
  if(!owner||!storage||!aux||!Sync||!transport||typeof verify!=='function'||typeof active!=='function')
   throw Error('Verified auxiliary backup dependencies required');
  let busy=false;
  const still=()=>active()===owner;
  async function authorized(){
   if(!still())throw Error('Account changed');
   const auth=await verify(owner);
   if(auth?.userId!==owner||!still())throw Error('Account verification failed');
  }
  async function inspect(){
   await authorized();
   const records=[];
   for(const config of aux.CONFIG){
    const row=await transport.read(config.type,aux.id,owner);
    if(!still())throw Error('Account changed');
    if(row!==null&&(row.owner!==owner||row.type!==config.type||row.id!==aux.id||
       !Number.isSafeInteger(row.revision)||row.revision<1))
      throw Error('Unverified remote category '+config.label);
    records.push(row);
   }
   return records;
  }
  async function backup(){
   if(busy)throw Error('Cloud operation already active');
   if(!online())return {status:'offline'};
   busy=true;
   try{
    const records=await inspect();
    const journal=Sync.create({owner,storage,transport,enabled:true});
    const pending=journal.list().items;
    let skipped=0,queued=0,conflicts=0;
    for(let index=0;index<aux.CONFIG.length;index++){
     if(!still())throw Error('Account changed');
     const config=aux.CONFIG[index];
     const local=aux.loadLocal(storage,owner,config);
     if(!local.exists||aux.empty(config,local.value)){skipped++;continue}
     const row=records[index];
     if(row&&!row.deleted){
      const existing=aux.validateRemote(config,row);
      if(aux.equal(existing,local.value))skipped++;else conflicts++;
      continue;
     }
     if(row?.deleted){conflicts++;continue}
     if(pending.some(op=>op.type===config.type&&op.id===aux.id)){skipped++;continue}
     journal.enqueue(config.type,aux.id,aux.payload(local.value),0);queued++;
    }
    // Avoid writing anything if a conflicting cloud category exists.
    if(conflicts)return {status:'conflict',conflicts,queued,skipped,
      pending:journal.list().items.length};
    if(!still())throw Error('Account changed');
    const result=await journal.drain({verifiedOwner:owner,online:online(),maxOperations:50});
    return {status:result.status,queued,uploaded:result.sent||0,
      skipped,pending:result.pending,conflicts:0};
   }finally{busy=false}
  }
  async function previewRecovery(){
   const records=await inspect(),missing=[];
   for(let i=0;i<aux.CONFIG.length;i++){
    const config=aux.CONFIG[i],row=records[i];
    if(!row||row.deleted)continue;
    const entries=aux.validateRemote(config,row);
    const local=aux.loadLocal(storage,owner,config);
    if((!local.exists||aux.empty(config,local.value))&&
       (config.type==='goal'||entries.length))missing.push(config.label);
   }
   return {missing,canRestore:missing.length>0,readOnly:true};
  }
  async function restore({confirmRestore}={}){
   if(typeof confirmRestore!=='function')throw Error('Explicit recovery approval required');
   if(busy)throw Error('Cloud operation already active');
   busy=true;
   try{
    const first=await previewRecovery();
    if(!first.canRestore)return {status:'up-to-date',restored:[]};
    if(!await confirmRestore(first.missing))return {status:'cancelled',restored:[]};
    if(!still())throw Error('Account changed during confirmation');
    // Revalidate all records against current owner and local state after approval.
    const records=await inspect();
    if(!still())throw Error('Account changed');
    const restored=aux.restoreMissing(storage,owner,records.filter(Boolean));
    return {status:'restored',restored};
   }finally{busy=false}
  }
  return Object.freeze({backup,previewRecovery,restore});
 }
 return Object.freeze({create});
});
