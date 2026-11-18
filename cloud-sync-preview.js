/* Explicit dry-run of original MYLIFTCOACH reconciliation rules. NO WRITES.
   2.0 local custom plans/sets are NOT mapped to the legacy schema here.
   Only safe, readable original-app keys may be compared; account data never persisted. */
(function(){
'use strict';
const model=window.PRISMStorageModel,reconcile=window.PRISMReconcile;
const SESSION_TABLES=Array.isArray(model?.TABLES)?model.TABLES:[];
const safeKey=key=>Object.prototype.hasOwnProperty.call(model.RULES,key);
function captureLegacy(readStorage){
 const snapshot={};
 for(const key of Object.keys(model.RULES)){
  const raw=readStorage.getItem(key);
  if(raw!==null&&raw!==undefined)snapshot[key]=raw;
 }
 return snapshot;
}
async function run({url,publishableKey,token,userId,fetcher=fetch,storage=localStorage}){
 if(!model||!reconcile)throw Error('Original reconciliation library was not loaded.');
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)||!token||!userId||!publishableKey)throw Error('Verified Supabase account required.');
 const base=url.replace(/\/$/,''),headers={apikey:publishableKey,Authorization:'Bearer '+token,Accept:'application/json'};
 const auth=await fetcher(base+'/auth/v1/user',{method:'GET',cache:'no-store',headers});
 if(!auth.ok)throw Error('Account verification failed.');
 const user=await auth.json();
 if(user?.id!==userId)throw Error('Account ownership mismatch.');
 const raw=captureLegacy(storage);
 const local=await model.normalize(raw);
 const remote=[];
 for(const table of SESSION_TABLES){
  let offset=0;
  for(;;){
   if(offset>5000)throw Error('Account contains more records than the preview limit. Nothing was changed.');
   const endpoint=new URL(base+'/rest/v1/prism_account_'+table);
   endpoint.searchParams.set('user_id','eq.'+userId);
   endpoint.searchParams.set('select','*');
   endpoint.searchParams.set('order','id');
   endpoint.searchParams.set('limit','500');
   endpoint.searchParams.set('offset',String(offset));
   const response=await fetcher(endpoint.toString(),{method:'GET',headers,cache:'no-store'});
   if(!response.ok)throw Error('Cloud table '+table+' is unavailable ('+response.status+'). No records changed.');
   const rows=await response.json();
   if(!Array.isArray(rows)||rows.some(r=>r.user_id!==userId))throw Error('Cloud ownership validation failed.');
   remote.push(...rows.map(row=>({...row,table})));
   if(rows.length<500)break;
   offset+=500;
  }
 }
 // Without original baseline checkpoints, this is NOT a full three-way merge.
 // plan() is used only to identify overlapping source-key conflicts.
 const planned=reconcile.plan(local,remote,[]);
 const localSources=new Set(Object.keys(raw));
 const cloudSources=new Set(remote.filter(r=>r.table==='sources').map(r=>r.source_key));
 const overlaps=[...localSources].filter(k=>cloudSources.has(k));
 // Rehydrate only in memory to inspect original cloud data without ever writing
 // legacy keys into the 2.0 app's browser storage. Malformed cloud shapes fail closed.
 const restored=model.restoreSnapshot(remote);
 const originalList=key=>{
  if(typeof restored[key]!=='string')return [];
  const value=JSON.parse(restored[key]);
  if(!Array.isArray(value))throw Error('Unexpected '+key+' cloud record format. No data changed.');
  return value;
 };
 const cloudPlans=originalList('customWorkoutsV5');
 const cloudSessions=originalList('workoutHistoryV52');
 const local2Plans=JSON.parse(storage.getItem('mlc2-custom-plans-v1')||'[]');
 const local2Sessions=JSON.parse(storage.getItem('mlc2-demo-workouts-v1')||'[]');
 if(!Array.isArray(local2Plans)||!Array.isArray(local2Sessions))throw Error('Invalid 2.0 local history shape. No data changed.');
 const cloudPlanIds=new Set(cloudPlans.map(x=>String(x.id)));
 const cloudSessionIds=new Set(cloudSessions.map(x=>String(x.id)));
 const planIdCollisions=local2Plans.filter(x=>x&&cloudPlanIds.has(String(x.id))).length;
 const sessionIdCollisions=local2Sessions.filter(x=>x&&cloudSessionIds.has(String(x.id))).length;
 return Object.freeze({
  localSources:localSources.size,localRows:local.length,cloudRows:remote.length,
  cloudWorkouts:cloudPlans.length,cloudSessions:cloudSessions.length,
  local2Workouts:local2Plans.length,local2Sessions:local2Sessions.length,
  idCollisions:planIdCollisions+sessionIdCollisions,
  overlappingSources:overlaps.length,conflicts:planned.conflicts.length,
  prospectiveCreates:planned.writes.length,
  cloudOnly:remote.filter(r=>!local.some(v=>v.table===r.table&&v.id===r.id)).length,
  cannotAutoMerge:true,
  advisory:'Read-only preview. Original records and 2.0 practice records are separate. No full three-way checkpoint or 2.0-to-original mapping has been authorized. This comparison cannot approve syncing, even if zero conflicts are shown.'
 });
}
function render(element,result){
 if(!element)return;
 const metrics=[
 ['Original keys visible locally',result.localSources],['Local legacy rows',result.localRows],
 ['Cloud rows',result.cloudRows],['Original cloud workouts',result.cloudWorkouts],
 ['Original cloud sessions',result.cloudSessions],['2.0 custom workouts',result.local2Workouts],
 ['2.0 practice sessions',result.local2Sessions],['ID collisions across apps',result.idCollisions],
 ['Overlapping data sources',result.overlappingSources],
 ['Potential conflicting records',result.conflicts],['Potential new legacy records',result.prospectiveCreates],
 ['Cloud-only records',result.cloudOnly]];
 element.replaceChildren();
 const note=document.createElement('p');note.textContent='Dry run only — no cloud or local records were modified.';element.append(note);
 for(const [name,value] of metrics){
  const row=document.createElement('div');row.className='mlc-cloud-audit-row';
  const title=document.createElement('strong');title.textContent=name;
  const count=document.createElement('span');count.textContent=String(value);
  row.append(title,count);element.append(row);
 }
 const message=document.createElement('p');message.textContent=result.advisory;element.append(message);
}
window.MLC2SyncPreview={captureLegacy,run,render};
})();
