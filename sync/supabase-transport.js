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
  return Object.freeze({
   async commit(op,owner){
    if(!enabled)throw Error('Cloud sync deliberately disabled');
    if(!op||op.owner!==owner||typeof owner!=='string')throw Error('Account mismatch');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(op.opId))throw Error('UUID operation ID required');
    const verified=await getVerifiedAuth();
    if(!verified||verified.userId!==owner||!verified.accessToken)throw Error('Owner authentication unavailable');
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
