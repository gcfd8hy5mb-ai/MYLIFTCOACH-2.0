/* MYLIFTCOACH 2.0 · isolated device measurements and private progress photos.
   The original photo gallery is opt-in and read-only. */
(function(){
'use strict';
const MEASUREMENT_KEY='mlc2-measurements-v1';
let owner=null,photoEpoch=0,photoRender=0;
const originalPhotoUrls=[];
function clearOriginalPhotos(){
 for(const url of originalPhotoUrls.splice(0))URL.revokeObjectURL(url);
 document.getElementById('mlcOriginalPhotoList')?.replaceChildren();
 setStatus('mlcOriginalPhotoStatus','');
}
const measurementKey=()=>owner?MEASUREMENT_KEY+':user:'+owner:MEASUREMENT_KEY;
function setOwner(id){
 if(id!==null&&!/^[a-zA-Z0-9_-]{1,128}$/.test(id||''))throw Error('Invalid measurement owner');
 if(owner===id)return;
 owner=id;photoEpoch++;clearOriginalPhotos();
 const input=document.getElementById('mlcPhotoInput');if(input)input.value='';
 document.getElementById('mlcPhotoList')?.replaceChildren();
 setStatus('mlcPhotoStatus','');
 showMeasurements();void renderPhotos();
}
const PHOTO_DATABASE='mlc2-private-progress-photos-v1';
const AREAS=['Waist','Chest','Arm','Thigh','Hips'];
const MAX_PHOTOS=150;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T00:00:00Z').getTime());
function normalizeMeasurement(v){
 if(!v||!AREAS.includes(v.area)||!validDay(v.day))return null;
 const value=Number(v.value);
 if(!Number.isFinite(value)||value<1||value>200)return null;
 return {id:String(v.id||''),area:v.area,day:v.day,value:Math.round(value*10)/10};
}
function readMeasurements(){
 try{
  const v=JSON.parse(localStorage.getItem(measurementKey())||'[]');
  return Array.isArray(v)?v.slice(0,1000).map(normalizeMeasurement).filter(Boolean):[];
 }catch{return []}
}
function saveMeasurements(rows){localStorage.setItem(measurementKey(),JSON.stringify(rows));try{window.MLC2ScheduleAuxSync?.()}catch{}}
function measurementTrend(rows,area){
 return rows.filter(x=>x.area===area).sort((a,b)=>a.day.localeCompare(b.day)).slice(-12);
}
function drawTrend(points){
 if(!points.length)return '<p class="empty-note">Save a measurement to see the trend.</p>';
 const numbers=points.map(p=>p.value),min=Math.min(...numbers),max=Math.max(...numbers),range=Math.max(1,max-min);
 const coords=points.map((p,i)=>({x:points.length===1?160:28+i*264/(points.length-1),y:132-(p.value-min)/range*104}));
 const poly=coords.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
 return '<svg viewBox="0 0 320 170" role="img" aria-label="'+escape(points[0].day)+' to '+escape(points[points.length-1].day)+' measurement trend"><polyline points="'+poly+'" fill="none" stroke="#d9b66c" stroke-width="3"/>'+coords.map((p,i)=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="4" fill="#e5c684"><title>'+escape(points[i].day)+': '+points[i].value+' inches</title></circle>').join('')+'</svg><p>'+escape(points[0].day)+': '+points[0].value+' in · '+escape(points[points.length-1].day)+': '+points[points.length-1].value+' in</p>';
}
let photoUrls=[];
function revokePhotoUrls(){photoUrls.forEach(url=>URL.revokeObjectURL(url));photoUrls=[]}
function photoDb(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window))return reject(new Error('Private photo storage is unavailable in this browser.'));
  const request=indexedDB.open(PHOTO_DATABASE,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('photos'))request.result.createObjectStore('photos',{keyPath:'id'})};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Cannot open private photo storage.'));
 });
}
async function photoAction(mode,fn){
 const db=await photoDb();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('photos',mode),store=tx.objectStore('photos');
  let result;
  const request=fn(store);
  request.onsuccess=()=>{result=request.result};
  tx.oncomplete=()=>resolve(result);
  tx.onerror=()=>reject(tx.error||new Error('Photo transaction failed.'));
  tx.onabort=()=>reject(tx.error||new Error('Photo transaction aborted.'));
 })}finally{db.close()}
}
const scopedPhoto=(photo,scope)=>photo?.ownerId===scope;
async function listPhotos(scope){
 const all=await photoAction('readonly',store=>store.getAll());
 return all.filter(photo=>scopedPhoto(photo,scope));
}
const savePhoto=record=>photoAction('readwrite',store=>store.put(record));
const deletePhoto=(id,scope,epoch)=>photoAction('readwrite',store=>{
 const request=store.get(id);
 request.addEventListener('success',()=>{if(epoch===photoEpoch&&scopedPhoto(request.result,scope))store.delete(id)});
 return request;
});
function setStatus(id,message){const el=document.getElementById(id);if(el)el.textContent=message}
function showMeasurements(){
 const list=document.getElementById('mlcMeasurementsList'),graph=document.getElementById('mlcMeasurementsChart');
 if(!list||!graph)return;
 const rows=readMeasurements(),area=document.getElementById('mlcMeasurementChartArea').value;
 graph.innerHTML=drawTrend(measurementTrend(rows,area));
 list.innerHTML=rows.slice().sort((a,b)=>b.day.localeCompare(a.day)).map(x=>
  '<div class="mlc-measurement-row"><span>'+escape(x.day)+' · '+escape(x.area)+': '+x.value+' in</span><button type="button" data-measurement-delete="'+escape(x.id)+'">Remove</button></div>').join('')||'<p class="empty-note">No 2.0 measurements saved on this device.</p>';
}
async function renderPhotos(){
 const list=document.getElementById('mlcPhotoList');if(!list)return;
 const scope=owner,epoch=photoEpoch,generation=++photoRender;
 revokePhotoUrls();
 try{
  const rows=(await listPhotos(scope)).filter(p=>p&&p.data instanceof Blob&&validDay(p.day)).sort((a,b)=>b.day.localeCompare(a.day));
  if(epoch!==photoEpoch||generation!==photoRender)return;
  if(!rows.length){list.innerHTML='<p class="empty-note">No photos saved in this 2.0 preview. Original-app photos are not imported.</p>';return}
  list.replaceChildren();
  for(const p of rows){
   const item=document.createElement('article');item.className='mlc-photo-card';
   const img=document.createElement('img');img.alt='Private progress photo from '+p.day;img.loading='lazy';
   const url=URL.createObjectURL(p.data);photoUrls.push(url);img.src=url;
   const footer=document.createElement('div'),caption=document.createElement('span'),button=document.createElement('button');
   caption.textContent=p.day;button.type='button';button.textContent='Remove photo';button.dataset.photoDelete=p.id;
   const saveButton=document.createElement('button');saveButton.type='button';saveButton.textContent='Save copy';saveButton.dataset.photoExport=p.id;
   footer.append(caption,saveButton,button);item.append(img,footer);list.append(item);
  }
 }catch(e){if(epoch===photoEpoch&&generation===photoRender)setStatus('mlcPhotoStatus',e.message||'Photos unavailable on this device.')}
}
async function showOriginalPhotos(event){
 const button=event.currentTarget,account=owner,epoch=photoEpoch;
 clearOriginalPhotos();
 if(!account){setStatus('mlcOriginalPhotoStatus','Sign in to view original account photos on this device.');return}
 button.disabled=true;
 try{
  const items=await window.MLC2LegacyDevicePhotos.read(indexedDB,localStorage,account,
   selected=>selected===owner&&epoch===photoEpoch);
  if(epoch!==photoEpoch)return;
  const list=document.getElementById('mlcOriginalPhotoList');
  for(const {day,data} of items){
   const item=document.createElement('article');item.className='mlc-photo-card';
   const image=document.createElement('img');image.alt='Original progress photo from '+day;image.loading='lazy';
   const url=URL.createObjectURL(data);originalPhotoUrls.push(url);image.src=url;
   const footer=document.createElement('div'),date=document.createElement('span'),save=document.createElement('a');
   date.textContent=day;save.href=url;save.download='MYLIFTCOACH-original-progress-'+day+'.'+data.type.split('/')[1];
   save.textContent='Save copy';footer.append(date,save);item.append(image,footer);list.append(item);
  }
  setStatus('mlcOriginalPhotoStatus',items.length?items.length+' original photos on this device.':'No original account photos found in this browser.');
 }catch(error){if(epoch===photoEpoch)setStatus('mlcOriginalPhotoStatus',error.message)}
 finally{button.disabled=false}
}
async function preparePhoto(file){
 if(!file||!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)||file.size>20_000_000)throw new Error('Choose a supported image under 20 MB.');
 let source;
 try{
  source=await createImageBitmap(file);
  const scale=Math.min(1,1200/Math.max(source.width,source.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing is unavailable.');
  ctx.drawImage(source,0,0,canvas.width,canvas.height);
  const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));
  if(!output)throw new Error('Could not prepare that photo.');
  return output;
 }finally{source?.close?.()}
}
function init(){
 const form=document.getElementById('mlcMeasurementForm'),area=document.getElementById('mlcMeasurementChartArea');
 if(!form||!area)return;
 const day=document.getElementById('mlcMeasurementDay');if(day)day.value=today();
 area.addEventListener('change',showMeasurements);
 form.addEventListener('submit',e=>{
  e.preventDefault();
  const form=e.currentTarget,measurementArea=form.elements.area.value,measurementDay=form.elements.day.value,value=Number(form.elements.value.value);
  const entry=normalizeMeasurement({id:'measure-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),area:measurementArea,day:measurementDay,value});
  if(!entry){setStatus('mlcMeasurementStatus','Enter a valid date and a measurement from 1 to 200 inches.');return}
  try{
   const all=readMeasurements();saveMeasurements([entry,...all].slice(0,1000));
   form.elements.value.value='';area.value=entry.area;showMeasurements();setStatus('mlcMeasurementStatus','Saved in 2.0 on this device only.');
  }catch{setStatus('mlcMeasurementStatus','Could not save in this browser. No original data was changed.')}
 });
 document.getElementById('mlcMeasurementsList').addEventListener('click',e=>{
  const b=e.target.closest('[data-measurement-delete]');if(!b||!confirm('Remove this 2.0 measurement?'))return;
  try{saveMeasurements(readMeasurements().filter(x=>x.id!==b.dataset.measurementDelete));showMeasurements()}
  catch{setStatus('mlcMeasurementStatus','Could not remove measurement.')}
 });
 document.getElementById('mlcOriginalPhotoLoad')?.addEventListener('click',showOriginalPhotos);
 const input=document.getElementById('mlcPhotoInput');
 input?.addEventListener('change',async e=>{
  const file=e.currentTarget.files?.[0];if(!file)return;
  const scope=owner,epoch=photoEpoch;
  try{
   setStatus('mlcPhotoStatus','Preparing photo locally…');
   const existing=await listPhotos(scope);if(existing.length>=MAX_PHOTOS)throw new Error('Device preview limit of 150 photos reached.');
   const blob=await preparePhoto(file);
   if(epoch!==photoEpoch)return;
   await savePhoto({ownerId:scope,id:'photo-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),day:today(),data:blob});
   if(epoch!==photoEpoch)return;
   setStatus('mlcPhotoStatus','Saved privately on this device. No cloud upload occurred.');await renderPhotos();
  }catch(err){if(epoch===photoEpoch)setStatus('mlcPhotoStatus',err.message||'Could not save photo.')}
  finally{if(epoch===photoEpoch)input.value=''}
 });
 document.getElementById('mlcPhotoList')?.addEventListener('click',async e=>{
  const scope=owner,epoch=photoEpoch;
  const save=e.target.closest('[data-photo-export]');
  if(save){
   try{
    const photo=(await listPhotos(scope)).find(p=>p.id===save.dataset.photoExport);
    if(epoch!==photoEpoch)return;
    if(!photo||!(photo.data instanceof Blob))throw Error('Photo was not found');
    // Export one original locally held JPEG. No network transfer or remote processing.
    const url=URL.createObjectURL(photo.data),link=document.createElement('a');
    link.href=url;link.download='MYLIFTCOACH-2.0-progress-'+photo.day+'-'+String(photo.id).replace(/[^a-zA-Z0-9-]/g,'').slice(-15)+'.jpg';
    document.body.appendChild(link);
    try{link.click()}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
    setStatus('mlcPhotoStatus','Photo copy prepared for download. Keep it private.');
   }catch{if(epoch===photoEpoch)setStatus('mlcPhotoStatus','Could not export the photo from this browser.')}
   return;
  }
  const b=e.target.closest('[data-photo-delete]');if(!b||!confirm('Permanently remove this 2.0 photo from this device?'))return;
  try{await deletePhoto(b.dataset.photoDelete,scope,epoch);if(epoch!==photoEpoch)return;await renderPhotos();if(epoch===photoEpoch)setStatus('mlcPhotoStatus','2.0 photo removed from this device.')}
  catch{if(epoch===photoEpoch)setStatus('mlcPhotoStatus','Could not remove photo.')}
 });
 showMeasurements();
 renderPhotos();
}
window.MLC2BodyProgress={AREAS,normalizeMeasurement,measurementTrend,readMeasurements,showMeasurements,renderPhotos,init,setOwner};
})();
