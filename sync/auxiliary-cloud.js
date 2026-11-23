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
 function create({owner,storage,aux,Sync,transport,verify,active,online=()=>true,withLocalAccess=work=>work(),writePlans}){
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
    const localRecords=await withLocalAccess(()=>aux.CONFIG.map(config=>aux.loadLocal(storage,owner,config)));
    if(!still())throw Error('Account changed');
    const journal=Sync.create({owner,storage,transport,enabled:true});
    const pending=journal.list().items;
    let skipped=0,queued=0,conflicts=0;
    const proposals=[],expected=new Map(),superseded=new Set();
    for(let i=0;i<aux.CONFIG.length;i++){
     if(!still())throw Error('Account changed');
     const config=aux.CONFIG[i],local=localRecords[i];
     const row=records[i];
     // An intentionally cleared category may be committed only when this
     // device has a verified previous version. Never treat missing storage
     // as permission to erase cloud data.
     const existingPending=pending.find(op=>op.type===config.type&&op.id===aux.recordId(config));
     if(existingPending){
      if(row?.deleted||existingPending.status==='conflict'||existingPending.kind!=='upsert'||
         !aux.valid(config,existingPending.payload?.entries)){conflicts++;continue}
      if(!local.exists){conflicts++;continue}
      if(aux.equal(existingPending.payload.entries,local.value)){
       expected.set(expectedKey(config),existingPending.payload.entries);
       skipped++;continue;
      }
      // If an acknowledgement was lost, reconcile the exact committed snapshot
      // from its next revision. Otherwise the newer local intent replaces an
      // unsent snapshot only if the original server base is still current.
      if(row&&row.revision===existingPending.baseRevision+1&&
         aux.equal(aux.validateRemote(config,row),existingPending.payload.entries)){
       remember(config,row);
      }else if((row?.revision||0)!==existingPending.baseRevision){
       conflicts++;continue;
      }
      superseded.add(existingPending.opId);
     }
     if(!local.exists){skipped++;continue}
     if(aux.empty(config,local.value)&&(!row||!baseline(config))){skipped++;continue}
     if(row?.deleted){conflicts++;continue}
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
    journal.discardUpserts(op=>superseded.has(op.opId));
    for(const p of proposals){
     if(!still())throw Error('Account changed');
     journal.enqueue(p.config.type,aux.recordId(p.config),aux.payload(p.value),p.revision);
     queued++;
    }
    if(!still())throw Error('Account changed');
    const result=await journal.drain({verifiedOwner:owner,online:online(),maxOperations:50,
     types:aux.CONFIG.map(config=>config.type),
     canSend:op=>withLocalAccess(()=>{
      if(!still())throw Error('Account changed');
      const config=aux.CONFIG.find(item=>item.type===op.type&&aux.recordId(item)===op.id);
      if(!config)return false;
      const current=aux.loadLocal(storage,owner,config);
      return current.exists&&aux.equal(current.value,op.payload?.entries);
     }),
     onAcknowledged:(op,ack)=>{
      if(!still())throw Error('Account changed');
      const config=aux.CONFIG.find(item=>item.type===op.type&&aux.recordId(item)===op.id);
      if(config&&op.kind==='upsert')remember(config,{owner,type:op.type,id:op.id,
       revision:ack.revision,deleted:false,payload:op.payload});
     }});

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
  function recoverable(records){
   return new Map(aux.recoveryCandidates(storage,owner,records).map(({config,record})=>[config.label,record]));
  }
  async function previewRecovery(){
   const records=await inspect();
   return withLocalAccess(()=>{
    if(!still())throw Error('Account changed');
    const missing=[...recoverable(records).keys()];
    return {missing,canRestore:missing.length>0,readOnly:true};
   });
  }
  async function restore({confirmRestore}={}){
   if(typeof confirmRestore!=='function')throw Error('Explicit recovery approval required');
   if(busy)throw Error('Cloud operation already active');
   busy=true;
   try{
    const before=await inspect();
    const approved=await withLocalAccess(()=>{
     if(!still())throw Error('Account changed');
     return recoverable(before);
    });
    if(!approved.size)return {status:'up-to-date',restored:[]};
    if(!await confirmRestore([...approved.keys()]))return {status:'cancelled',restored:[]};
    if(!still())throw Error('Account changed during confirmation');
    const records=await inspect();
    return await withLocalAccess(()=>{
     if(!still())throw Error('Account changed');
     const fresh=recoverable(records);
     for(const [label,row] of fresh){
      const original=approved.get(label);
      if(!original||row.revision!==original.revision||!aux.equal(row.payload,original.payload))
       return {status:'changed-reconfirm',restored:[]};
     }
     if(!fresh.size)return {status:'up-to-date',restored:[]};
     const restored=aux.restoreMissing(storage,owner,records,{writePlans});
     return {status:'restored',restored};
    });
   }finally{busy=false}
  }
  return Object.freeze({backup,previewRecovery,restore});
 }
 return Object.freeze({create,BASELINE_PREFIX});
});
