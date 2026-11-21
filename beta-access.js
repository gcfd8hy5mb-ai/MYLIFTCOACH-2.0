/* MYLIFTCOACH 2.0 private beta entitlement.
   Authorization comes only from server-controlled Auth app_metadata.
   Selected private-beta display mode is persisted in the signed-in account's
   user_metadata, never treated as payment, subscription or production Pro status.
   No localStorage writes and no paid billing integrations. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2BetaAccess=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const validOwner=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
 const modes=Object.freeze(['free','pro']);
 const FIELD='mlc2_private_beta_mode';
 function allowed(user){
  return !!user&&validOwner(user.id)&&
   (user.app_metadata?.mlc2_beta_tester===true||
    user.app_metadata?.myliftcoach_beta_tester===true);
 }
 function resolve(user){
  const authorized=allowed(user),raw=user?.user_metadata?.[FIELD];
  return {owner:user?.id||null,authorized,mode:authorized&&modes.includes(raw)?raw:'free',
   paidSubscription:false};
 }
 async function change({user,mode,verify,update,stillCurrent}){
  if(!allowed(user))throw Error('This account is not authorized for private-beta switching');
  if(!modes.includes(mode))throw Error('Unsupported beta access mode');
  if(typeof verify!=='function'||typeof update!=='function'||typeof stillCurrent!=='function')
   throw Error('Verified account operations required');
  const owner=user.id;
  if(!stillCurrent(owner))throw Error('Account changed before beta switch');
  const fresh=await verify();
  if(!stillCurrent(owner)||fresh?.id!==owner||!allowed(fresh))
   throw Error('Beta authorization changed');
  const metadata={...(fresh.user_metadata||{}),[FIELD]:mode};
  // This updates preference only; immutable app_metadata authorization is never modified.
  const saved=await update(metadata);
  if(!stillCurrent(owner)||saved?.id!==owner||!allowed(saved))
   throw Error('Account changed while saving beta preference');
  if(saved.user_metadata?.[FIELD]!==mode)
   throw Error('Server did not confirm beta preference');
  // Re-verify after saving to prevent a stale response on account-switch.
  const confirmed=await verify();
  if(!stillCurrent(owner)||confirmed?.id!==owner||!allowed(confirmed)||
     confirmed.user_metadata?.[FIELD]!==mode)
   throw Error('Unable to confirm saved beta preference');
  return resolve(confirmed);
 }
 return Object.freeze({FIELD,modes,allowed,resolve,change});
});
