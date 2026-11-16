/* Opt-in Supabase transport for isolated MYLIFTCOACH 2.0 RPC.
   Not loaded or enabled by the live preview. Requires a deployed, verified
   mlc2_v1_commit RPC and real authenticated ownership confirmation. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2SupabaseTransport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function create({baseUrl,publishableKey,getVerifiedAuth,fetcher,enabled=false}){
  if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(baseUrl||''))throw Error('Approved HTTPS Supabase URL required');
  if(typeof publishableKey!=='string'||!publishableKey.startsWith('sb_publishable_'))throw Error('Publishable key required');
  if(typeof getVerifiedAuth!=='function')throw Error('Authenticated identity provider required');
  if(typeof fetcher!=='function')throw Error('fetch required');
  async function authFor(owner){
   const verified=await getVerifiedAuth();
   if(!verified||verified.userId!==owner||!verified.accessToken)throw Error('Owner authentication unavailable');
   return verified;
  }
  return Object.freeze({
   async listSessions(owner,{afterId='',limit=50}={}){
    if(!enabled)throw Error('Cloud sync deliberately disabled');
    if(typeof owner!=='string'||!owner||typeof afterId!=='string'||afterId.length>160||
       !Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid session page request');
    const verified=await authFor(owner);
    const response=await fetcher(baseUrl.replace(/\/$/,'')+'/rest/v1/rpc/mlc2_v1_list_sessions',{
      method:'POST',cache:'no-store',headers:{
       'Content-Type':'application/json','apikey':publishableKey,'Authorization':'Bearer '+verified.accessToken
      },
      body:JSON.stringify({p_after_id:afterId,p_limit:limit})
    });
    let rows;
    try{rows=await response.json()}catch{rows=null}
    if(!response.ok){const err=Error('Cloud session list request failed');err.status=response.status;throw err}
    if(!Array.isArray(rows)||rows.length>limit)throw Error('Invalid cloud session page');
    for(const row of rows){
     if(row.owner!==owner||row.type!=='session'||typeof row.id!=='string'||row.id.length>160||
        !Number.isSafeInteger(Number(row.revision))||Number(row.revision)<1||
        typeof row.deleted!=='boolean')throw Error('Unverified cloud session');
    }
    return rows.map(row=>({...row,revision:Number(row.revision)}));
   },
   async read(type,id,owner){
    if(!enabled)throw Error('Cloud sync deliberately disabled');
    if(!/^[a-z0-9_-]{1,128}$/i.test(owner||'')||!['session','custom-plan','tracking','measurement','meal','goal'].includes(type)||
      !/^[a-z0-9_:.\-]{1,160}$/i.test(id||''))throw Error('Invalid owner or record');
    const verified=await authFor(owner);
    const response=await fetcher(baseUrl.replace(/\/$/,'')+'/rest/v1/rpc/mlc2_v1_read',{
      method:'POST',cache:'no-store',
      headers:{'Content-Type':'application/json','apikey':publishableKey,'Authorization':'Bearer '+verified.accessToken},
      body:JSON.stringify({p_type:type,p_record_id:id})
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok){const error=Error('Remote read failed');error.status=response.status;throw error}
    if(payload===null)return null;
    if(String(payload.owner)!==owner||String(payload.type)!==type||String(payload.id)!==id||!Number.isSafeInteger(Number(payload.revision)))throw Error('Unverified remote record');
    return {owner,type,id,revision:Number(payload.revision),payload:payload.payload,deleted:payload.deleted===true};
   },
   async commit(op,owner){
    if(!enabled)throw Error('Cloud sync deliberately disabled');
    if(!op||op.owner!==owner||typeof owner!=='string')throw Error('Account mismatch');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(op.opId))throw Error('UUID operation ID required');
    const verified=await authFor(owner);
    const response=await fetcher(baseUrl.replace(/\/$/,'')+'/rest/v1/rpc/mlc2_v1_commit',{
     method:'POST',cache:'no-store',headers:{
      'Content-Type':'application/json','apikey':publishableKey,'Authorization':'Bearer '+verified.accessToken
     },
     body:JSON.stringify({
      p_op_id:op.opId,p_type:op.type,p_record_id:op.id,
      p_base_revision:op.baseRevision,p_deleted:op.kind==='delete',p_payload:op.kind==='delete'?null:op.payload
     })
    });
    let payload={};
    try{payload=await response.json()}catch{}
    if(!response.ok){
     const error=Error(String(payload.message||'Cloud commit rejected').slice(0,130));
     error.status=response.status;
     if(response.status===409||payload.code==='PT409'||/REVISION_CONFLICT/.test(payload.message||''))error.code='CONFLICT';
     throw error;
    }
    if(String(payload.owner)!==owner||String(payload.opId)!==op.opId||
      !Number.isSafeInteger(Number(payload.revision)))throw Error('Unverified server response');
    return {owner,opId:op.opId,revision:Number(payload.revision)};
   }
  });
 }
 return Object.freeze({create});
});
