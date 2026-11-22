/* Isolated 2.0 auth persistence for iPhone Home Screen reloads.
   Never grants trust from storage: the caller MUST revalidate the bearer token
   against Supabase Auth /user before restoring an authenticated owner.
   Same-origin localStorage is persistent and readable to page scripts; keep this
   limited to the 2.0 origin and never copy to production auth keys. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2AuthStore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const KEY='mlc2-auth-session-v1';
 function valid(value){
  return !!value&&typeof value==='object'&&
   typeof value.access_token==='string'&&value.access_token.length>20&&
   typeof value.refresh_token==='string'&&value.refresh_token.length>10&&
   typeof value.user?.id==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value.user.id)&&
   Number.isFinite(value.expires_at);
 }
 function read(session,persistent){
  for(const storage of [session,persistent]){
   try{
    const raw=storage?.getItem(KEY);if(!raw)continue;
    const record=JSON.parse(raw);
    if(valid(record))return record;
   }catch{}
  }
  return null;
 }
 function save(session,persistent,value){
  if(!valid(value))throw Error('Invalid verified account session');
  const payload=JSON.stringify(value);
  let stored=false;
  for(const storage of [persistent,session]){
   try{
    storage?.setItem(KEY,payload);
    stored=storage?.getItem(KEY)===payload||stored;
   }catch{}
  }
  if(!stored)throw Error('Account session could not be saved to this browser');
  return true;
 }
 function clear(session,persistent){
  for(const storage of [session,persistent]){
   try{storage?.removeItem(KEY)}catch{}
  }
 }
 return Object.freeze({KEY,valid,read,save,clear});
});
