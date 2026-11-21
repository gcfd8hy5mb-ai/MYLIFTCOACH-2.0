/* Owner-scoped local draft storage adapter. No migration or network.
   Guest drafts continue using the original 2.0 key. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2AccountDraft=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const KEY='mlc2-active-session-v1',OWNER=/^[a-zA-Z0-9_-]{1,128}$/;
 function scopedKey(owner){
  if(owner===null)return KEY;
  if(!OWNER.test(owner||''))throw Error('Verified owner required for draft');
  return KEY+':owner:'+owner;
 }
 function scope(storage,owner){
  const prefix=scopedKey(owner);
  if(!storage||typeof storage.getItem!=='function'||
     typeof storage.setItem!=='function'||typeof storage.removeItem!=='function')
   throw Error('Draft storage unavailable');
  const check=key=>{if(key!==KEY)throw Error('Unsupported draft storage key');return prefix};
  return Object.freeze({
   getItem:key=>storage.getItem(check(key)),
   setItem:(key,value)=>storage.setItem(check(key),value),
   removeItem:key=>storage.removeItem(check(key))
  });
 }
 return Object.freeze({KEY,scopedKey,scope});
});
