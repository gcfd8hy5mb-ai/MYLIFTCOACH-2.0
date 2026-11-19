/* Original-app exercise image review, not approved demonstrations.
 * Original media remains at its user-owned source; no files or app catalog are replaced.
 * Previews require network; failures show a clear unavailable message.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2LegacyMediaReview=api;
})(globalThis,function(){
'use strict';
const SOURCE='https://gcfd8hy5mb-ai.github.io/workout-tracker/';
const CANDIDATES=Object.freeze([
 {
  "id": "machine-chest-press",
  "path": "images/machine-chest-press.png",
  "blob": "b88c4d26dec5f3b3c070e90e98c3f8b3f238793a"
 },
 {
  "id": "pec-deck",
  "path": "images/pec-deck.png",
  "blob": "201500e4a6019c544ea0c795c164b7cfd92d4d60"
 },
 {
  "id": "triceps-pushdown",
  "path": "images/triceps-pushdown.png",
  "blob": "5bb006ecaf9cd34c3a922900da5ecdabcd7b60d1"
 },
 {
  "id": "lat-pulldown",
  "path": "images/lat-pulldown.png",
  "blob": "6c64684076c9a092704fd015d74f5131158a6f22"
 },
 {
  "id": "seated-row",
  "path": "images/seated-row.png",
  "blob": "67ca6f74cbc6825a19017c64baa347c5d2df0f5f"
 },
 {
  "id": "preacher-curl",
  "path": "images/preacher-curl.png",
  "blob": "9519c7935589aa81233be63ad3561c5824aad87e"
 },
 {
  "id": "leg-press",
  "path": "images/leg-press.png",
  "blob": "2cb0248de84e8b7b524163204af38cbe4c275223"
 },
 {
  "id": "leg-extension",
  "path": "images/leg-extension.png",
  "blob": "304865c91d5073ebead02e1cdd77c3409b210f52"
 },
 {
  "id": "seated-leg-curl",
  "path": "images/seated-leg-curl.png",
  "blob": "b237362d3ba96f16cadfc4e5d0f722a74260c8b3"
 },
 {
  "id": "calf-raise",
  "path": "images/calf-raise.png",
  "blob": "394528618bd8a84ab34ea9960621fd04419b1a36"
 },
 {
  "id": "shoulder-press",
  "path": "images/shoulder-press.png",
  "blob": "6bdb0214a6ec7c961c88b3f8eab6582711461e59"
 },
 {
  "id": "lateral-raise",
  "path": "images/lateral-raise.png",
  "blob": "32ddf96112cba2a47519055793409247ac48fe93"
 },
 {
  "id": "biceps-curl",
  "path": "images/biceps-curl.png",
  "blob": "695dc66df05d8974abf913a211a55b4275272682"
 },
 {
  "id": "triceps-extension",
  "path": "images/triceps-extension.png",
  "blob": "208f8b7ec4fa2368c14361a610d3f37e37fa2d05"
 }
]);
function inspect(catalog,candidates=CANDIDATES){
 if(!Array.isArray(catalog)||!Array.isArray(candidates))throw Error('Exercise catalog unavailable');
 const ids=new Set(catalog.map(x=>x.id));const seen=new Set();
 const items=candidates.map(c=>{
  if(!c||!/^([a-z0-9]+-)*[a-z0-9]+$/.test(c.id)||
   c.path!=='images/'+c.id+'.png'||!/^[a-f0-9]{40}$/.test(c.blob)||seen.has(c.id))throw Error('Original media reference invalid');
  seen.add(c.id);
  return Object.freeze({id:c.id,name:catalog.find(x=>x.id===c.id)?.name||c.id,
   existsInCatalog:ids.has(c.id),previewUrl:SOURCE+c.path,
   blob:c.blob,status:'approval-pending'});
 });
 return Object.freeze({items,total:items.length,unmatched:items.filter(x=>!x.existsInCatalog).length,approved:0});
}
function render(root,catalog,doc=document){
 if(!root)return;
 const data=inspect(catalog);root.replaceChildren();
 const summary=doc.createElement('p');summary.textContent=data.total+' recoverable original image references · '+data.approved+' verified approvals · '+data.unmatched+' unmatched exercise IDs.';
 root.append(summary);
 const note=doc.createElement('p');note.textContent='Review only. These original-site previews have not been approved for the 2.0 exercise library. Do not substitute them for the separately approved 268 media files.';root.append(note);
 const list=doc.createElement('div');list.className='mlc-media-review-grid';
 for(const item of data.items){
  const card=doc.createElement('article');card.className='mlc-media-review-item';
  const name=doc.createElement('h4');name.textContent=item.name;card.append(name);
  const img=doc.createElement('img');img.src=item.previewUrl;img.alt='Original app candidate image for '+item.name+' — pending review';img.loading='lazy';
  img.referrerPolicy='no-referrer';
  const availability=doc.createElement('p');availability.className='mlc-media-review-meta';availability.textContent='Original media · approval pending';
  img.addEventListener('error',()=>{img.remove();availability.textContent='Original-site image preview unavailable. Source blob is still catalogued.'},{once:true});
  card.append(img,availability);
  const link=doc.createElement('a');link.href='https://github.com/gcfd8hy5mb-ai/workout-tracker/blob/main/images/'+item.id+'.png';
  link.target='_blank';link.rel='noopener noreferrer';link.textContent='Inspect original source';card.append(link);
  list.append(card);
 }
 root.append(list);
 return data;
}
return Object.freeze({inspect,render,CANDIDATES});
});
