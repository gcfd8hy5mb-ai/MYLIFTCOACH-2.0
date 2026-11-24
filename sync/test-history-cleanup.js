/* Explicit, account-bound cleanup of the eight known test workouts only.
   Never touches plans, coach preferences, photos or original PRISM tables. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2TestHistoryCleanup=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PREFIX='mlc2-test-workout-cleanup-v1:';
 const EXPECTED_SESSIONS=8,EXPECTED_SETS=48;
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_:.-]{1,160}$/.test(id);
 function create({owner,storage,accountStore,transport,verify,active}){
  if(!owner||!storage||!accountStore||!transport||!verify||!active)
   throw Error('Authenticated cleanup dependencies required');
  const key=PREFIX+owner;
  const ensure=()=>{if(active()!==owner)throw Error('Account changed; cleanup stopped')};
  async function cloudRows(){
   ensure();
   const auth=await verify(owner);
   if(auth?.userId!==owner){throw Error('Verified account required')}
   let afterId='',rows=[];
   for(let page=0;page<101;page++){
    ensure();
    const part=await transport.listSessions(owner,{afterId,limit:50});
    ensure();
    if(!Array.isArray(part)||part.length>50||part.some(r=>r.owner!==owner||r.type!=='session'||
       !validId(r.id)||!Number.isSafeInteger(r.revision)||r.revision<1))throw Error('Unexpected cloud workout data');
    if(part.some((r,i)=>r.id<=afterId||(i>0&&r.id<=part[i-1].id)))throw Error('Unordered cloud workout records');
    rows=rows.concat(part);
    if(rows.length>5000)throw Error('Cloud workout list too long');
    if(part.length<50)return rows;
    afterId=part[part.length-1].id;
   }
   throw Error('Incomplete cloud workout inventory');
  }
  function localRows(){ensure();return accountStore.read(storage,owner)}
  function pending(){const raw=storage.getItem(key);if(!raw)return null;
   if(raw.length>200000)throw Error('Cleanup checkpoint unreadable');
   const m=JSON.parse(raw);
   if(m?.owner!==owner||m?.version!==1||!Array.isArray(m.rows)||
      m.rows.length!==EXPECTED_SESSIONS||new Set(m.rows.map(r=>r.id)).size!==EXPECTED_SESSIONS||
      m.rows.some(r=>!validId(r.id)||!Number.isSafeInteger(r.revision)||r.revision<1))
    throw Error('Cleanup checkpoint invalid');
   return m;
  }
  async function prepare(){
   ensure();
   if(pending())return {status:'incomplete',count:EXPECTED_SESSIONS};
   const rows=await cloudRows(),activeRows=rows.filter(r=>!r.deleted);
   if(activeRows.length!==EXPECTED_SESSIONS)throw Error('Expected exactly 8 cloud test workouts; found '+activeRows.length+'. Nothing changed.');
   const full=[];
   for(const row of activeRows){
    const record=await transport.read('session',row.id,owner);
    ensure();
    if(!record||record.deleted||record.revision!==row.revision||record.owner!==owner||
       !record.payload||record.payload.id!==row.id||!Array.isArray(record.payload.sets))
     throw Error('Cloud workout changed during inspection');
    full.push({id:row.id,revision:row.revision,payload:record.payload});
   }
   const sets=full.reduce((n,r)=>n+r.payload.sets.length,0);
   if(sets!==EXPECTED_SETS)throw Error('Expected 48 logged sets, found '+sets+'. No cleanup is allowed.');
   const local=localRows(),target=new Set(full.map(r=>r.id));
   if(local.some(r=>!target.has(r.id)))throw Error('Additional local workout history detected; cleanup cancelled.');
   const backup={format:'myliftcoach-private-test-workout-backup',version:1,owner,created:new Date().toISOString(),
    count:full.length,sets,cloud:full,device:local};
   return {status:'ready',count:full.length,sets,backup,rows:full};
  }
  async function execute(plan){
   ensure();
   if(!plan||plan.status!=='ready'||plan.count!==EXPECTED_SESSIONS||plan.sets!==EXPECTED_SETS)
    throw Error('Fresh verified preview and backup required');
   if(pending())throw Error('A cleanup needs resuming first');
   const remote=await cloudRows(),live=remote.filter(x=>!x.deleted);
   if(live.length!==EXPECTED_SESSIONS||live.some(row=>{
    const approved=plan.rows.find(x=>x.id===row.id);
    return !approved||approved.revision!==row.revision;
   }))throw Error('Cloud history changed after preview. Restart review.');
   const stored={version:1,owner,rows:plan.rows};
   const raw=JSON.stringify(stored);
   storage.setItem(key,raw);
   if(storage.getItem(key)!==raw)throw Error('Could not protect cleanup checkpoint');
   return resume();
  }
  async function resume(){
   ensure();
   const m=pending();
   if(!m)throw Error('No incomplete cleanup to resume');
   const ids=new Set(m.rows.map(r=>r.id));
   const all=await cloudRows();
   if(all.some(r=>!r.deleted&&!ids.has(r.id)))throw Error('New workout records detected. Cleanup paused; no other records touched.');
   for(const approved of m.rows){
    ensure();
    const remote=all.find(r=>r.id===approved.id);
    if(!remote)throw Error('Cloud workout disappeared unexpectedly; cleanup paused');
    if(remote.deleted)continue;
    if(remote.revision!==approved.revision)throw Error('Cloud workout revision changed; cleanup paused');
    const checked=await transport.read('session',approved.id,owner);
    ensure();
    if(!checked||checked.deleted||checked.revision!==approved.revision||!same(checked.payload,approved.payload))
     throw Error('Cloud workout changed; cleanup paused');
    const op={owner,opId:crypto.randomUUID(),type:'session',id:approved.id,kind:'delete',
     baseRevision:approved.revision,payload:null};
    try{await transport.commit(op,owner)}
    catch(err){
     // The server may have committed before a network acknowledgement was lost.
     const latest=await transport.read('session',approved.id,owner);
     ensure();
     if(!latest?.deleted)throw Error('Cloud deletion interrupted. Retry this protected cleanup.');
    }
   }
   const final=await cloudRows();
   ensure();
   if(m.rows.some(r=>!final.find(x=>x.id===r.id)?.deleted))
    throw Error('Cloud deletion not fully verified. Retry cleanup.');
   const current=localRows();
   if(current.some(r=>!ids.has(r.id)))throw Error('New local workout detected. Keep installation and request review.');
   // Local deletion occurs only after all eight cloud tombstones are confirmed.
   accountStore.clear(storage,owner);
   ensure();
   storage.removeItem(key);
   return {status:'complete',removed:EXPECTED_SESSIONS};
  }
  return Object.freeze({prepare,execute,resume,hasPending:()=>!!pending()});
 }
 return Object.freeze({create});
});
