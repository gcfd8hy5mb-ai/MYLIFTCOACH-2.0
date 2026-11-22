/* Account verification boundary for future isolated Supabase sync.
   Read-only Auth check. Does not create a journal or enable transport writes. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2VerifiedAuth=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const OWNER=/^[a-zA-Z0-9_-]{1,128}$/;
 function create({baseUrl,publishableKey,getSession,fetcher,enabled=false}){
  if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(baseUrl||''))
   throw Error('Approved HTTPS Supabase host required');
  if(typeof publishableKey!=='string'||!publishableKey.startsWith('sb_publishable_'))
   throw Error('Publishable key required');
  if(typeof getSession!=='function'||typeof fetcher!=='function')throw Error('Session provider and fetch required');
  async function verify(expectedOwner){
   if(!enabled)throw Error('Account verification for cloud sync disabled');
   if(!OWNER.test(expectedOwner||''))throw Error('Expected owner required');
   const session=await getSession();
   if(!session||!session.access_token||session.user?.id!==expectedOwner)
    throw Error('Account session does not match requested owner');
   if(!Number.isFinite(Number(session.expires_at))||Number(session.expires_at)<=Math.floor(Date.now()/1000)+30)
    throw Error('Expired or expiring token; refresh before cloud sync');
   const response=await fetcher(baseUrl.replace(/\/$/,'')+'/auth/v1/user',{
    method:'GET',cache:'no-store',
    headers:{apikey:publishableKey,Authorization:'Bearer '+session.access_token}
   });
   if(!response.ok)throw Error('Authenticated identity could not be confirmed');
   const user=await response.json();
   if(!user||user.id!==expectedOwner)throw Error('Authenticated owner mismatch');
   // Re-read state after the asynchronous network request to reject sign-out or account switch.
   const current=await getSession();
   if(current?.access_token!==session.access_token||current?.user?.id!==expectedOwner)
    throw Error('Account changed during verification');
   return {userId:expectedOwner,accessToken:session.access_token};
  }
  return Object.freeze({verify});
 }
 return Object.freeze({create});
});
