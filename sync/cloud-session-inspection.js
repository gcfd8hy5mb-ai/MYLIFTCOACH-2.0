/* MYLIFTCOACH 2.0 — explicit read-only cloud workout inspection.
   Never imports, stages, commits or deletes records. Enabled only via a
   user gesture and a verified current owner. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2CloudSessionInspection=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const OWNER=/^[a-zA-Z0-9_-]{1,128}$/;
 async function inspect({owner,auth,transport,local,accountStillCurrent,maxPages=10}={}){
  if(!OWNER.test(owner||'')||!auth||typeof auth.verify!=='function'||
     !transport||typeof transport.listSessions!=='function'||!Array.isArray(local)||
     typeof accountStillCurrent!=='function')throw Error('Read-only inspection configuration unavailable');
  const verified=await auth.verify(owner);
  if(verified.userId!==owner||!accountStillCurrent(owner))throw Error('Account changed during inspection');
  const ids=new Set(),known=new Set(local.map(x=>x&&x.ownerId===owner?x.id:null).filter(Boolean));
  let afterId='',count=0,overlap=0,deleted=0;
  for(let page=0;page<maxPages;page++){
   const rows=await transport.listSessions(owner,{afterId,limit:50});
   if(!accountStillCurrent(owner))throw Error('Account changed during inspection');
   if(!Array.isArray(rows)||rows.length>50)throw Error('Invalid cloud page');
   for(const row of rows){
    if(!row||row.owner!==owner||row.type!=='session'||typeof row.id!=='string'||
      ids.has(row.id)||!Number.isSafeInteger(row.revision)||row.revision<1)
      throw Error('Unexpected cloud workout record');
    ids.add(row.id);
    if(row.deleted){deleted++;continue}
    count++;if(known.has(row.id))overlap++;
   }
   if(rows.length<50)return Object.freeze({
    owner,cloudWorkouts:count,localWorkouts:known.size,idOverlaps:overlap,
    cloudOnly:count-overlap,deleted,readOnly:true,canAutoRestore:false
   });
   if(!rows[rows.length-1].id||rows[rows.length-1].id===afterId)
    throw Error('Cloud pagination did not advance');
   afterId=rows[rows.length-1].id;
  }
  throw Error('Cloud history exceeds inspection limit; nothing was changed');
 }
 return Object.freeze({inspect});
});
