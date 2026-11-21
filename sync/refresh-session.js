/* Safe token renewal for isolated MYLIFTCOACH 2.0 cloud operations.
 * Refreshes at most once per concurrent expiry and never commits a refreshed
 * session after sign-out/account switching. No network access except callbacks.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2FreshAuth=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function create({getSession,getOwner,getEpoch,refresh,fetchUser,commit,now=()=>Date.now()}){
  if([getSession,getOwner,getEpoch,refresh,fetchUser,commit,now].some(x=>typeof x!=='function'))
   throw Error('Fresh Auth requires authenticated callbacks');
  let pending=null,pendingOwner=null;
  async function sessionFor(owner){
   const epoch=getEpoch();
   if(!owner||owner!==getOwner())throw Error('Account changed');
   const saved=getSession();
   if(!saved||saved.user?.id!==owner||!saved.access_token)throw Error('Authenticated session unavailable');
   if(Number.isFinite(Number(saved.expires_at))&&Number(saved.expires_at)>Math.floor(now()/1000)+60)
    return saved;
   if(!saved.refresh_token)throw Error('Session expired; sign in again');
   if(pending&&pendingOwner===owner)return pending;
   const operation=(async()=>{
    const renewed=await refresh(saved.refresh_token);
    if(!renewed?.access_token||!renewed?.user?.id||renewed.user.id!==owner)
     throw Error('Refreshed account mismatch');
    const user=await fetchUser(renewed.access_token);
    if(user?.id!==owner)throw Error('Verified account mismatch');
    if(getOwner()!==owner||getEpoch()!==epoch||
       getSession()?.access_token!==saved.access_token)
     throw Error('Account changed during renewal');
    const session={
     access_token:renewed.access_token,
     refresh_token:renewed.refresh_token||saved.refresh_token,
     user,expires_at:Number(renewed.expires_at)||
       Math.floor(now()/1000)+Number(renewed.expires_in||3600)
    };
    if(!Number.isFinite(session.expires_at)||session.expires_at<=Math.floor(now()/1000)+30)
     throw Error('Refreshed token has invalid expiry');
    await commit(session);
    if(getOwner()!==owner||getEpoch()!==epoch||
       getSession()?.access_token!==session.access_token)
     throw Error('Account changed after session renewal');
    return session;
   })();
   pending=operation;pendingOwner=owner;
   try{return await operation}finally{
    if(pending===operation){pending=null;pendingOwner=null}
   }
  }
  return Object.freeze({sessionFor});
 }
 return Object.freeze({create});
});
