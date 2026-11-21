/* Account-scoped, opt-in auxiliary cloud backup and fill-only recovery.
 * Supports continued backups via server revision checks against a previously
 * confirmed account/device baseline. Never blindly overwrites cloud changes.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2AuxCloud=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const BASELINE_PREFIX='mlc2-aux-confirmed-v1:';
 function create({owner,storage,aux,Sync,transport,verify,active,online=()=>true}){
  if(!owner||!storage||!aux||!Sync||!transport||typeof verify!=='function'||typeof active!=='function')
   throw Error('Verified auxiliary backup dependencies required');
  let busy=false;
  const still=()=>active()===owner;
  const baselineKey=config=>BASELINE_PREFIX+owner+':'+config.type+':'+aux.recordId(config);
  const expectedKey=config=>config.type+':'+aux.recordId(config);
  function baseline(config){
   const raw=storage.getItem(baselineKey(config));
   if(raw===null)return null;
   if(raw.length>120000)throw Error('Confirmed '+config.label+' baseline too large');
   let b;
   try{b=JSON.parse(raw)}catch{throw Error('Confirmed '+config.label+' baseline unreadable')}
   if(!b||b.owner!==owner||b.type!==config.type||b.id!==aux.recordId(config)||
      !Number.isSafeInteger(b.revision)||b.revision<1||!aux.valid(config,b.entries))
    throw Error('Confirmed '+config.label+' baseline invalid');
   return b;
  }
  function remember(config,row){
   const entries=aux.validateRemote(config,row);
   const record=JSON.stringify({owner,type:config.type,id:aux.recordId(config),
    revision:row.revision,entries});
   if(record.length>120000)throw Error('Confirmed '+config.label+' baseline too large');
   storage.setItem(baselineKey(config),record);
   if(storage.getItem(baselineKey(config))!==record)
    throw Error('Confirmed '+config.label+' baseline not retained');
  }
  async function authorized(){
   if(!still())throw Error('Account changed');
   const auth=await verify(owner);
   if(auth?.userId!==owner||!still())throw Error('Account verification failed');
  }
  async function inspect(){
   await authorized();
   const records=[];
   for(const config of aux.CONFIG){
    const row=await transport.read(config.type,aux.recordId(config),owner);
    if(!still())throw Error('Account changed');
    if(row!==null&&(row.owner!==owner||row.type!==config.type||row.id!==aux.recordId(config)||
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
    const proposals=[],expected=new Map();
    for(let i=0;i<aux.CONFIG.length;i++){
     if(!still())throw Error('Account changed');
     const config=aux.CONFIG[i],local=aux.loadLocal(storage,owner,config);
     if(!local.exists||aux.empty(config,local.value)){skipped++;continue}
     const row=records[i];
     if(row?.deleted){conflicts++;continue}
     const existingPending=pending.find(op=>op.type===config.type&&op.id===aux.recordId(config));
     if(existingPending){
      if(existingPending.status==='conflict'||existingPending.kind!=='upsert'||
         !aux.equal(existingPending.payload?.entries,local.value)){conflicts++;continue}
      // Pending operation is immutable: replay the same ID rather than enqueue twice.
      expected.set(expectedKey(config),existingPending.payload.entries);
      skipped++;continue;
     }
     if(row){
      const remote=aux.validateRemote(config,row);
      if(aux.equal(remote,local.value)){
       expected.set(expectedKey(config),local.value);
       skipped++;continue;
      }
      // Update only if this device previously confirmed EXACTLY the version
      // currently on the server. Never claim a foreign device's newer version.
      const b=baseline(config);
      if(!b||b.revision!==row.revision||!aux.equal(b.entries,remote)){
       conflicts++;continue;
      }
      proposals.push({config,value:local.value,revision:row.revision});
     }else proposals.push({config,value:local.value,revision:0});
     expected.set(expectedKey(config),local.value);
    }
    if(conflicts)return {status:'conflict',conflicts,queued:0,skipped,
      pending:journal.list().items.length};
    for(const p of proposals){
     if(!still())throw Error('Account changed');
     journal.enqueue(p.config.type,aux.recordId(p.config),aux.payload(p.value),p.revision);
     queued++;
    }
    if(!still())throw Error('Account changed');
    const result=await journal.drain({verifiedOwner:owner,online:online(),maxOperations:50});
    if(!still())throw Error('Account changed');
    if(result.status==='conflict'||result.status==='retry'||result.status==='unverified-ack')
     return {status:result.status,queued,uploaded:result.sent||0,skipped,
       pending:result.pending,conflicts:result.status==='conflict'?1:0};
    // Confirm actual cloud revisions before allowing a future local edit to
    // overwrite a previously uploaded snapshot. Never store an unconfirmed base.
    const after=await inspect();
    let baselines=0;
    for(let i=0;i<aux.CONFIG.length;i++){
     const config=aux.CONFIG[i],row=after[i],wanted=expected.get(expectedKey(config));
     if(!row||row.deleted||wanted===undefined)continue;
     if(aux.equal(aux.validateRemote(config,row),wanted)){
      remember(config,row);baselines++;
     }
    }
    return {status:result.status,queued,uploaded:result.sent||0,
      skipped,pending:result.pending||0,conflicts:0,baselines};
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
       !aux.empty(config,entries))missing.push(config.label);
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
    const records=await inspect();
    if(!still())throw Error('Account changed');
    const restored=aux.restoreMissing(storage,owner,records.filter(Boolean));
    return {status:'restored',restored};
   }finally{busy=false}
  }
  return Object.freeze({backup,previewRecovery,restore});
 }
 return Object.freeze({create,BASELINE_PREFIX});
});
