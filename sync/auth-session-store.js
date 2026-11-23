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
 function stored(storage){
  try{
   const record=JSON.parse(storage?.getItem(KEY)||'null');
   return valid(record)?record:null;
  }catch{return null}
 }
 function read(session,persistent){
  const here=stored(session),saved=stored(persistent);
  if(here&&saved?.user.id===here.user.id&&saved.expires_at>=here.expires_at)return saved;
  return here||saved;
 }
 const matches=(record,expected)=>record?.user.id===expected.user.id&&
  record.access_token===expected.access_token&&record.refresh_token===expected.refresh_token;
 function replace(session,persistent,expected,next){
  if(!valid(expected)||!valid(next)||expected.user.id!==next.user.id)throw Error('Account session changed');
  const payload=JSON.stringify(next);
  let updated=false;
  for(const storage of [persistent,session]){
   if(!matches(stored(storage),expected))continue;
   try{
    storage.setItem(KEY,payload);
    updated=storage.getItem(KEY)===payload||updated;
   }catch{}
  }
  return updated;
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
 function clear(session,persistent,expected){
  for(const storage of [session,persistent]){
   if(expected&&!matches(stored(storage),expected))continue;
   try{storage?.removeItem(KEY)}catch{}
  }
 }
 return Object.freeze({KEY,valid,read,save,replace,clear});
});
