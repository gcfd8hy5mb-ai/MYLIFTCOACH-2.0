/* Read original browser photos without modifying databases or importing copies. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2LegacyDevicePhotos=api;
})(globalThis,function(){
 'use strict';
 const databases=['workoutTrackerPhotosV1','prismProgressPhotosDB'];
 const ownerPattern=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
 function existingPhotos(indexed,name){
  return new Promise((resolve,reject)=>{
   const request=indexed.open(name);
   let missing=false;
   request.onupgradeneeded=()=>{
    // Opening an absent database must not create it.
    missing=true;
    request.transaction.abort();
   };
   request.onerror=()=>missing?resolve([]):reject(Error('Could not read original photo database'));
   request.onsuccess=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains('photos')){db.close();resolve([]);return}
    db.onversionchange=()=>db.close();
    const tx=db.transaction('photos','readonly');
    const result=tx.objectStore('photos').getAll(undefined,501);
    tx.oncomplete=()=>{
     db.close();
     if(result.result.length>500)reject(Error('Original photo gallery exceeds 500 images. Keep the original backup.'));
     else resolve(result.result);
    };
    tx.onabort=()=>{db.close();reject(Error('Could not read original photos'))};
   };
  });
 }
 async function read(indexed,storage,owner,isCurrent){
  if(typeof owner!=='string'||!ownerPattern.test(owner)||!isCurrent(owner))
   throw Error('Verified original account required');
  const deletions=JSON.parse(storage.getItem('prismAccountPhotoDeletesV1:'+owner)||'[]');
  if(!Array.isArray(deletions))throw Error('Original photo deletion list needs review');
  const photos=[];
  for(const database of databases){
   if(!isCurrent(owner))throw Error('Account changed during the photo lookup');
   const rows=await existingPhotos(indexed,'prismAccountPhotosV1:'+owner+':'+database);
   for(const row of rows){
    if(!row||(typeof row.id!=='string'&&typeof row.id!=='number')||
       deletions.some(entry=>entry?.database===database&&String(entry.id)===String(row.id)))continue;
    const data=row.blob??row.data;
    const day=row.day??row.date;
    if(!(data instanceof Blob)||data.size<1||data.size>10*1024*1024||
       !['image/jpeg','image/png','image/webp'].includes(data.type)||
       typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))continue;
    photos.push({day,data});
   }
  }
  if(!isCurrent(owner))throw Error('Account changed during the photo lookup');
  return photos.sort((a,b)=>b.day.localeCompare(a.day));
 }
 return Object.freeze({read});
});
