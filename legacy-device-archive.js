/* Owner-bound, read-only export for an in-place upgrade. */
(function(root,factory){
 const model=typeof module==='object'?require('./legacy-storage-model.js'):root.PRISMStorageModel;
 const api=factory(model);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2LegacyDeviceArchive=api;
})(globalThis,function(model){
 'use strict';
 const ownerPattern=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
 const limit=20*1024*1024;
 function capture(storage,owner,stamp=new Date().toISOString()){
  if(typeof owner!=='string'||!ownerPattern.test(owner))throw Error('Verified original account required');
  const data=Object.create(null);
  for(const key of Object.keys(model.RULES)){
   const raw=storage.getItem('prismAccountLocalV1:'+owner+':'+key);
   if(raw!==null)data[key]=raw;
  }
  const deletions=storage.getItem('prismAccountDeletionsV1:'+owner);
  const photoDeletions=storage.getItem('prismAccountPhotoDeletesV1:'+owner);
  const contents=JSON.stringify({format:'MYLIFTCOACH-original-account-device-checkpoint',version:1,
   accountId:owner,createdAt:stamp,data,deletions,photoDeletions,containsPhotoFiles:false,containsAuthentication:false});
  if(new TextEncoder().encode(contents).length>limit)throw Error('Original account device checkpoint exceeds 20 MiB');
  return {contents,categories:Object.keys(data).length};
 }
 function download(file,doc,urlAPI,BlobClass,release){
  const url=urlAPI.createObjectURL(new BlobClass([file.contents],{type:'application/json'}));
  const link=doc.createElement('a');
  link.href=url;link.download='MYLIFTCOACH-original-device-checkpoint.json';
  doc.body.appendChild(link);
  try{link.click()}finally{link.remove();release(()=>urlAPI.revokeObjectURL(url))}
 }
 return Object.freeze({capture,download});
});
