/* MYLIFTCOACH image-only integration bridge.
   Private artwork and approval manifest are intentionally NOT bundled in this public repository.
   Load a validated window.MLC2_APPROVED_VISUALS manifest before this script.
   No workout, account, Coach or cloud state is read or written. */
(()=>{
'use strict';
const catalog=window.MLC2_EXERCISE_CATALOG;
const entries=window.MLC2_APPROVED_VISUALS;
if(!Array.isArray(catalog)||!Array.isArray(entries))return;
const safePath=p=>typeof p==='string'&&/^assets\/exercise-demonstrations\/[a-zA-Z0-9._-]+\.webp$/.test(p);
const ids=new Set(catalog.map(e=>e.id));
const approvals=new Map();
for(const e of entries){
 if(!e||typeof e.id!=='string'||!ids.has(e.id)||approvals.has(e.id)||!safePath(e.image)||!safePath(e.thumbnail)){
  console.warn('MYLIFTCOACH: incomplete or invalid image manifest; leaving the existing catalog unchanged.');
  return;
 }
 approvals.set(e.id,e);
}
if(approvals.size!==263||catalog.length!==344){
 console.warn('MYLIFTCOACH: expected 263 approved images and 344 exercise IDs; no changes applied.');
 return;
}
for(const exercise of catalog){
 const e=approvals.get(exercise.id);
 exercise.demonstration=e?{status:'approved',image:e.image,thumbnail:e.thumbnail}:{status:'withheld'};
}
window.MLC2_VISUALS_344_READY=true;
})();
