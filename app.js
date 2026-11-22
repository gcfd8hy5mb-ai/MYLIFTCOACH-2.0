/* MYLIFTCOACH 2.0 · Phase 1. No writes to production Supabase tables. */
(()=>{
'use strict';
const BACKEND='https://kirlpjflaoriiusfamsk.supabase.co';
const PUBLIC_KEY='sb_publishable_yYMnCM3k14zaEtpHo4-xkQ_Cd1Aty90';
const DEMO_KEY='mlc2-demo-workouts-v1'; // independent namespace, never original workout keys
const authStore=window.MLC2AuthStore; // isolated 2.0 persistence, revalidated before use
const exercises=[
 {id:'chest-press',name:'Machine Chest Press',group:'Chest',sets:3,reps:'8–12',cue:'Set the handles near mid-chest. Press smoothly and control the return.'},
 {id:'pec-deck',name:'Pec Deck',group:'Chest',sets:3,reps:'10–15',cue:'Keep the chest tall and bring the arms together without swinging.'},
 {id:'shoulder-press',name:'Machine Shoulder Press',group:'Shoulders',sets:3,reps:'8–12',cue:'Keep elbows under the handles and avoid arching your back.'},
 {id:'lat-pulldown',name:'Lat Pulldown',group:'Back',sets:3,reps:'8–12',cue:'Pull elbows toward your sides and control the bar upward.'},
 {id:'seated-row',name:'Seated Cable Row',group:'Back',sets:3,reps:'10–12',cue:'Start tall and draw elbows back without leaning excessively.'},
 {id:'biceps-curl',name:'Machine Biceps Curl',group:'Arms',sets:3,reps:'10–12',cue:'Keep upper arms stable and lower slowly.'},
 {id:'triceps-push',name:'Triceps Pushdown',group:'Arms',sets:3,reps:'10–12',cue:'Keep elbows beside your torso and extend without swinging.'},
 {id:'leg-press',name:'Leg Press',group:'Legs',sets:3,reps:'8–12',cue:'Use a controlled range while keeping hips against the seat.'},
 {id:'leg-curl',name:'Seated Leg Curl',group:'Legs',sets:3,reps:'10–15',cue:'Position the knee joint with the machine pivot and move smoothly.'},
 {id:'leg-extension',name:'Leg Extension',group:'Legs',sets:3,reps:'10–15',cue:'Lift under control and avoid kicking the weight.'},
 {id:'calf-raise',name:'Calf Raise Machine',group:'Legs',sets:3,reps:'12–15',cue:'Reach a comfortable stretch, rise steadily, and pause.'},
 {id:'cable-crunch',name:'Cable Crunch',group:'Core',sets:3,reps:'10–15',cue:'Move the rib cage toward the pelvis without pulling with the arms.'}
];
const plans=[
 {id:'upper-a',title:'Upper Body A',kind:'Upper Strength',description:'A push-and-pull session for the upper body.',ids:['chest-press','lat-pulldown','shoulder-press','triceps-push']},
 {id:'lower-a',title:'Lower Body A',kind:'Lower Strength',description:'Controlled lower-body movements and core training.',ids:['leg-press','leg-curl','calf-raise','cable-crunch']},
 {id:'upper-b',title:'Upper Body B',kind:'Upper Hypertrophy',description:'Variation for chest, back and arms.',ids:['pec-deck','seated-row','biceps-curl','triceps-push']},
 {id:'lower-b',title:'Lower Body B',kind:'Lower Hypertrophy',description:'A second lower-body session with balanced emphasis.',ids:['leg-press','leg-extension','leg-curl','calf-raise']}
];
const $=(id)=>document.getElementById(id);
let page='home',activePlan=null,session=null,guest=true,account=null,auth=null;
let verifiedOwnerId=null,authEpoch=0; // Never use an unverified cached identity to access account history.
let pendingAccountRecovery=null;
let activeDraftStore=null,activeDraftOwner=null;
let betaModeSaving=false;
const GUEST_BETA_KEY='mlc2-guest-beta-mode-v1';
const readGuestBeta=()=>{try{return sessionStorage.getItem(GUEST_BETA_KEY)||'free'}catch{return 'free'}};
const betaView=()=>window.MLC2BetaAccess.resolve(verifiedOwnerId===account?.id?account:null,readGuestBeta());
const sessionRefresh=window.MLC2FreshAuth.create({
 getSession:()=>auth,
 getOwner:()=>verifiedOwnerId===account?.id?verifiedOwnerId:null,
 getEpoch:()=>authEpoch,
 refresh:refreshToken=>authRequest('token?grant_type=refresh_token',{refresh_token:refreshToken}),
 fetchUser:token=>authRequest('user',null,token,'GET'),
 commit:session=>{
  const serialized=JSON.stringify(session);
  authStore.save(sessionStorage,localStorage,session);
  auth=session;account=session.user;renderSettings();
 }
});
let workoutSyncTimer=null,workoutSyncBusy=false,workoutSyncFailures=0;
let auxSyncTimer=null,auxSyncAttempts=0,auxSyncMessage='Sign in for automatic fitness-data sync.';
let syncAgainAfterCurrent=false,auxOperationBusy=false;
let workoutSyncText='Sign in to enable automatic workout sync.';
let demoSessions=loadDemo();
const TRACK_KEY='mlc2-local-daily-v1'; // New 2.0 log, NEVER a legacy key
const currentTrackingKey=()=>verifiedOwnerId?TRACK_KEY+':user:'+verifiedOwnerId:TRACK_KEY;
const planStorage=()=>{
 const selected='mlc2-selected-workout-v1';
 const map=k=>verifiedOwnerId&&[selected,'mlc2-weekly-schedule-v1'].includes(k)?k+':user:'+verifiedOwnerId:k;
 return {
  getItem:k=>{const raw=localStorage.getItem(map(k));return verifiedOwnerId&&k===selected&&raw===''?null:raw},
  setItem:(k,v)=>localStorage.setItem(map(k),v),
  removeItem:k=>{
   if(verifiedOwnerId&&k===selected){localStorage.setItem(map(k),'');try{window.MLC2ScheduleAuxSync?.()}catch{}}
   else localStorage.removeItem(map(k));
  }
 };
};
const healthStorage=()=>({getItem:k=>{const scoped=['mlc2-custom-plans-v1','mlc2-local-daily-v1','mlc2-measurements-v1','mlc2-selected-workout-v1','mlc2-weekly-schedule-v1','mlc2-coach-readiness-v1','mlc2-weekly-goal-v1'];return localStorage.getItem(verifiedOwnerId&&scoped.includes(k)?k+':user:'+verifiedOwnerId:k)}});
let trackingEntries=loadLocalTracking();
let originalSnapshot=null;
let cloudHistorySnapshot=null; // in-memory, account-bound, original archive only
let cloudHistoryRequestId=0; // invalidates any pending read when account or view changes

let toastTimer;
let muscleFilter='';
let restSeconds=90,restPaused=true,restClock=null;
function loadDemo(){try{return window.MLC2AccountWorkouts?.read(localStorage,null)||[]}catch{return []}}
function storeDemo(){return window.MLC2AccountWorkouts.save(localStorage,verifiedOwnerId,demoSessions)}
function loadCurrentWorkouts(){try{demoSessions=window.MLC2AccountWorkouts.read(localStorage,verifiedOwnerId)}catch{demoSessions=[];notice('Workout history is unreadable; it has not been overwritten.')}}
function switchWorkoutOwner(owner){if(workoutSyncTimer!==null){clearTimeout(workoutSyncTimer);workoutSyncTimer=null}if(auxSyncTimer!==null){clearTimeout(auxSyncTimer);auxSyncTimer=null}syncAgainAfterCurrent=false;workoutSyncFailures=0;auxSyncAttempts=0;verifiedOwnerId=owner;window.MLC2Custom?.setOwner(owner);window.MLC2BodyProgress?.setOwner(owner);window.MLC2CoachReadiness?.setOwner(owner);trackingEntries=loadLocalTracking();pendingAccountRecovery=null;const file=$('accountRecoveryFile');if(file)file.value='';loadCurrentWorkouts();renderHome();renderProgress();renderWorkouts();renderHistory();renderTracking();renderSettings();if(page==='coaching')renderCoach();if(owner){scheduleWorkoutSync();scheduleAuxSync(2500)}}
function setWorkoutSyncState(message){
 workoutSyncText=message;
 const el=$('autoWorkoutSyncStatus');if(el)el.textContent=message;
}
function scheduleWorkoutSync(delay=1500){
 if(workoutSyncTimer!==null){clearTimeout(workoutSyncTimer);workoutSyncTimer=null}
 if(!verifiedOwnerId||account?.id!==verifiedOwnerId)return;
 if(!navigator.onLine){setWorkoutSyncState('Offline — workouts saved on device. Sync will retry when connected.');return}
 const owner=verifiedOwnerId,epoch=authEpoch;
 workoutSyncTimer=setTimeout(()=>{
  workoutSyncTimer=null;
  if(owner===verifiedOwnerId&&epoch===authEpoch)void runWorkoutSync();
 },delay);
}
function setAuxSyncMessage(message){
 auxSyncMessage=message;
 const el=$('otherFitnessCloudStatus');if(el)el.textContent=message;
}
function scheduleAuxSync(delay=1800){
 if(auxSyncTimer!==null){clearTimeout(auxSyncTimer);auxSyncTimer=null}
 if(!verifiedOwnerId||account?.id!==verifiedOwnerId)return;
 if(!navigator.onLine){setAuxSyncMessage('Offline — changes saved on device; backup retries when online.');return}
 const owner=verifiedOwnerId,epoch=authEpoch;
 auxSyncTimer=setTimeout(()=>{
  auxSyncTimer=null;
  if(owner===verifiedOwnerId&&epoch===authEpoch)void runAutomaticAuxSync();
 },delay);
}
window.MLC2ScheduleAuxSync=()=>scheduleAuxSync(1800);
async function runAutomaticAuxSync(){
 if(!verifiedOwnerId||account?.id!==verifiedOwnerId)return;
 if(workoutSyncBusy||auxOperationBusy){scheduleAuxSync(4000);return}
 if(!navigator.onLine){setAuxSyncMessage('Offline — local fitness data is safe.');return}
 const owner=verifiedOwnerId,epoch=authEpoch;
 auxOperationBusy=true;
 setAuxSyncMessage('Checking your account fitness-data backups…');
 try{
  const result=await auxEngine(owner).backup();
  if(owner!==verifiedOwnerId||epoch!==authEpoch)return;
  if(result.status==='conflict'){
   auxSyncAttempts=0;
   setAuxSyncMessage('Needs review: another cloud version differs. No records overwritten.');
   return;
  }
  if(result.status==='retry'||result.status==='unverified-ack')throw Error('Cloud backup needs retry');
  if(result.status==='offline'){setAuxSyncMessage('Offline — account data safe on device.');return}
  auxSyncAttempts=0;
  if(result.pending>0){setAuxSyncMessage(result.pending+' queued fitness backups — retrying.');scheduleAuxSync(4000)}
  else setAuxSyncMessage('Up to date · '+(result.uploaded||0)+' fitness categories uploaded.');
 }catch{
  if(owner!==verifiedOwnerId||epoch!==authEpoch)return;
  auxSyncAttempts=Math.min(6,auxSyncAttempts+1);
  setAuxSyncMessage('Fitness data saved locally — cloud retry scheduled.');
  scheduleAuxSync(Math.min(300000,5000*Math.pow(2,auxSyncAttempts-1)));
 }finally{
  auxOperationBusy=false;
  renderSettings();
 }
}
function auxEngine(owner){
 if(owner!==verifiedOwnerId||owner!==account?.id||!auth?.access_token)throw Error('Verified sign-in required');
 const verifier=window.MLC2VerifiedAuth.create({baseUrl:BACKEND,publishableKey:PUBLIC_KEY,getSession:()=>sessionRefresh.sessionFor(owner),fetcher:fetch,enabled:true});
 const transport=window.MLC2SupabaseTransport.create({baseUrl:BACKEND,publishableKey:PUBLIC_KEY,fetcher:fetch,enabled:true,getVerifiedAuth:()=>verifier.verify(owner)});
 return window.MLC2AuxCloud.create({owner,storage:localStorage,aux:window.MLC2AuxData,Sync:window.MLC2Sync,transport,verify:id=>verifier.verify(id),active:()=>account?.id===verifiedOwnerId?verifiedOwnerId:null,online:()=>navigator.onLine});
}
function syncEngine(owner){
 if(owner!==verifiedOwnerId||owner!==account?.id||!auth?.access_token)throw Error('Verified sign-in required');
 const verifier=window.MLC2VerifiedAuth.create({
  baseUrl:BACKEND,publishableKey:PUBLIC_KEY,getSession:()=>sessionRefresh.sessionFor(owner),fetcher:fetch,enabled:true
 });
 const transport=window.MLC2SupabaseTransport.create({
  baseUrl:BACKEND,publishableKey:PUBLIC_KEY,fetcher:fetch,enabled:true,
  getVerifiedAuth:()=>verifier.verify(owner)
 });
 return window.MLC2AutoWorkouts.create({
  owner,storage:localStorage,accountStore:window.MLC2AccountWorkouts,
  Sync:window.MLC2Sync,transport,verify:id=>verifier.verify(id),
  active:()=>verifiedOwnerId===account?.id?verifiedOwnerId:null,
  online:()=>navigator.onLine
 });
}
function queueWorkoutForSync(entry){
 if(!verifiedOwnerId||entry?.ownerId!==verifiedOwnerId)return;
 if(workoutSyncBusy){syncAgainAfterCurrent=true;setWorkoutSyncState('Workout saved locally — syncing after current upload.');return}
 try{syncEngine(verifiedOwnerId).queue(entry);
  setWorkoutSyncState(navigator.onLine?'Workout saved — queued for cloud sync.':'Saved offline — queued for cloud sync.');
 }catch{setWorkoutSyncState('Workout saved locally — cloud queue requires attention.')}
 scheduleWorkoutSync();
}
async function runWorkoutSync(){
 if(workoutSyncBusy||auxOperationBusy){syncAgainAfterCurrent=true;return}
 if(!verifiedOwnerId||account?.id!==verifiedOwnerId)return;
 if(!navigator.onLine){setWorkoutSyncState('Offline — workouts remain saved on device.');return}
 const owner=verifiedOwnerId,epoch=authEpoch;
 workoutSyncBusy=true;setWorkoutSyncState('Checking your private workout cloud…');
 try{
  let result=await syncEngine(owner).flush();
  if(owner!==verifiedOwnerId||epoch!==authEpoch)return;
  if(result.status==='owner-changed')return;
  if(result.status==='conflict'){
   workoutSyncFailures=0;setWorkoutSyncState('Needs review: '+result.conflicts+' cloud workout conflicts. Nothing overwritten.');return;
  }
  if(result.status==='retry')throw Error('Sync interrupted');
  if(result.status==='offline'){setWorkoutSyncState('Offline — workouts saved on device.');return}
  workoutSyncFailures=0;
  if(result.pending){setWorkoutSyncState(result.pending+' workouts queued — retrying.');scheduleWorkoutSync(2500)}
  else setWorkoutSyncState(result.available?
   'Synced · '+result.available+' cloud workouts available to restore':
   'Up to date · '+(result.uploaded||0)+' newly uploaded');
 }catch(err){
  if(owner!==verifiedOwnerId||epoch!==authEpoch)return;
  workoutSyncFailures=Math.min(6,workoutSyncFailures+1);
  setWorkoutSyncState('Cloud sync paused — workouts safe on device. Retrying.');
  scheduleWorkoutSync(Math.min(300000,5000*Math.pow(2,workoutSyncFailures-1)));
 }finally{workoutSyncBusy=false;if(syncAgainAfterCurrent){syncAgainAfterCurrent=false;scheduleWorkoutSync(800)}}
}


// All original-app reads are opt-in and strictly read-only. Never call setItem
// or removeItem with workoutHistoryV52, customWorkoutsV5 or dailyTrackingV1.
function safeOriginal(key,kind){
 try{
  // The original app stores signed-in data under a user-scoped key.
  // Never browse another user's scoped records or fall back to guest data
  // while an account is authenticated in 2.0.
  const keyForOwner=account?.id?'prismAccountLocalV1:'+account.id+':'+key:key;
  const raw=localStorage.getItem(keyForOwner);
  if(!raw||raw.length>5_000_000)return kind==='array'?[]:{};
  const value=JSON.parse(raw);
  return kind==='array'?(Array.isArray(value)?value.slice(0,1000):[]):(value&&typeof value==='object'&&!Array.isArray(value)?value:{});
 }catch{return kind==='array'?[]:{}}
}
function getOriginalSnapshot(){
 const rawSessions=safeOriginal('workoutHistoryV52','array');
 const rawPlans=safeOriginal('customWorkoutsV5','array');
 const rawTracking=safeOriginal('dailyTrackingV1','object');
 const sessions=rawSessions.filter(x=>x&&typeof x==='object'&&Array.isArray(x.exercises)).map(x=>({
  id:String(x.id??'').slice(0,100),
  title:String(x.workoutTitle||x.title||'Workout').slice(0,110),
  date:String(x.date||x.created||'').slice(0,35),
  exercises:x.exercises.filter(y=>y&&Array.isArray(y.sets)).map(y=>({
   id:String(y.id||y.name||'Exercise').slice(0,110),
   name:String(y.name||y.id||'Exercise').slice(0,110),
   sets:y.sets.filter(z=>z&&Number.isFinite(Number(z.weight))&&Number.isFinite(Number(z.reps))&&Number(z.weight)>=0&&Number(z.reps)>0).slice(0,20).map(z=>({weight:Number(z.weight),reps:Number(z.reps)}))
  })).slice(0,55)
 }));
 const plans=rawPlans.filter(x=>x&&typeof x==='object'&&Array.isArray(x.exercises)).slice(0,100).map(x=>({
  id:String(x.id??'').slice(0,100),
  title:String(x.name||x.title||'Custom workout').slice(0,110),
  exercises:x.exercises.slice(0,80).map(v=>String(v).slice(0,80))
 }));
 const water=Array.isArray(rawTracking.water)?rawTracking.water.filter(x=>x&&typeof x==='object'&&Number.isFinite(Number(x.amount))&&Number(x.amount)>0).slice(0,1000).map(x=>({day:String(x.day||'').slice(0,10),amount:Number(x.amount)})):[];
 const weight=Array.isArray(rawTracking.weight)?rawTracking.weight.filter(x=>x&&typeof x==='object'&&Number.isFinite(Number(x.value))&&Number(x.value)>0).slice(0,1000).map(x=>({day:String(x.day||'').slice(0,10),value:Number(x.value)})):[];
 const measurements=Array.isArray(rawTracking.measurements)?rawTracking.measurements.filter(x=>x&&['Waist','Chest','Arm','Thigh','Hips'].includes(x.area)&&/^\d{4}-\d{2}-\d{2}$/.test(String(x.day||''))&&Number.isFinite(Number(x.value))&&Number(x.value)>0&&Number(x.value)<=200).slice(0,1000).map(x=>({area:String(x.area),day:String(x.day),value:Number(x.value)})):[];
 return {sessions,plans,water,weight,measurements};
}
function localDayString(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function loadLocalTracking(){
 try{const data=JSON.parse(localStorage.getItem(currentTrackingKey())||'[]');return Array.isArray(data)?data.filter(x=>x&&['water','weight'].includes(x.type)&&Number.isFinite(Number(x.value))&&Number(x.value)>0&&/^\d{4}-\d\d-\d\d$/.test(x.day)).slice(0,400):[]}catch{return []}
}
function persistLocalTracking(){const data=JSON.stringify(trackingEntries),key=currentTrackingKey();localStorage.setItem(key,data);if(localStorage.getItem(key)!==data)throw Error('Tracking data could not be verified');try{window.MLC2ScheduleAuxSync?.()}catch{}}
function formatDate(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString():String(value||'Unknown date')}
function renderHistory(){
 const original=originalSnapshot?.sessions||[];
 const demo=demoSessions||[];
 $('legacyHistoryStatus').textContent=originalSnapshot?original.length+' original sessions available on this browser (read-only).':'Not loaded. Tap View original records to check this browser. For signed-in original records, sign in to the same account first.';
 const setCount=original.reduce((n,x)=>n+x.exercises.reduce((m,e)=>m+e.sets.length,0),0);
 $('originalHistorySummary').textContent=originalSnapshot?original.length+' workouts · '+setCount+' sets':'';
 $('originalHistoryList').innerHTML=originalSnapshot?(original.length?original.slice(0,80).map(x=>'<details class="history-entry"><summary><strong>'+escapeHTML(x.title)+'</strong><small>'+escapeHTML(formatDate(x.date))+' · '+x.exercises.length+' movements</small></summary>'+x.exercises.map(y=>'<div class="history-exercise"><b>'+escapeHTML(y.name)+'</b><small>'+y.sets.map(t=>escapeHTML(String(t.weight))+' lb × '+escapeHTML(String(t.reps))).join(' · ')+'</small></div>').join('')+'</details>').join(''):'<p class="empty-note">No original session records found in this browser. Your original app or Supabase may store them elsewhere; no data was changed.</p>'):'';
 $('detailedDemoHistory').innerHTML=demo.length?demo.slice(0,80).map(x=>'<details class="history-entry"><summary><strong>'+escapeHTML(x.title)+'</strong><small>'+escapeHTML(formatDate(x.created))+' · '+x.sets.length+' sets</small></summary>'+x.sets.map(y=>'<div class="history-exercise"><span>'+escapeHTML(exercises.find(e=>e.id===y.exerciseId)?.name||y.exerciseId||'Exercise')+'</span><small>'+escapeHTML(String(y.weight||0))+' lb × '+escapeHTML(String(y.reps||0))+'</small></div>').join('')+'</details>').join(''):'<p class="empty-note">No 2.0 practice sessions yet. Completing a workout will add it here.</p>';
}
function renderOriginalPlans(){
 const el=$('originalPlansList');if(!el)return;
 if(!originalSnapshot){el.innerHTML='';return}
 el.innerHTML=originalSnapshot.plans.length?originalSnapshot.plans.map(p=>'<details class="history-entry"><summary><strong>'+escapeHTML(p.title)+'</strong><small>'+p.exercises.length+' exercises</small></summary><p>'+p.exercises.map(v=>escapeHTML(v)).join(' · ')+'</p></details>').join(''):'<p class="empty-note">No original custom workouts were found on this browser.</p>';
}
function renderTracking(){
 const water=trackingEntries.filter(x=>x.type==='water');
 const weight=trackingEntries.filter(x=>x.type==='weight');
 const today=localDayString();
 const total=water.filter(x=>x.day===today).reduce((n,x)=>n+Number(x.value),0);
 $('localTrackingSummary').textContent='Today: '+Math.round(total)+' mL water · '+weight.length+' weight entries';
 $('localTrackingList').innerHTML=trackingEntries.length?trackingEntries.slice(0,40).map(x=>'<div class="history-entry tracking-row"><div><strong>'+escapeHTML(x.type==='water'?'Water':'Body weight')+'</strong><small>'+escapeHTML(x.day)+' · '+escapeHTML(String(x.value))+(x.type==='water'?' mL':' lb')+'</small></div><button type="button" class="tracking-delete" data-remove-track="'+escapeHTML(x.id)+'" aria-label="Remove this 2.0 entry">Remove</button></div>').join(''):'<p class="empty-note">No 2.0 daily entries yet.</p>';
 $('legacyTrackingStatus').textContent=originalSnapshot?'Original device data loaded read-only.':'Not loaded';
 if(!originalSnapshot){$('originalTrackingSummary').textContent='';$('originalTrackingList').innerHTML='';if($('mlcOriginalMeasurements'))$('mlcOriginalMeasurements').innerHTML='';return}
 $('originalTrackingSummary').textContent=originalSnapshot.water.length+' water entries · '+originalSnapshot.weight.length+' weight entries · '+(originalSnapshot.measurements?.length||0)+' body measurements';
 const combined=[...originalSnapshot.water.map(x=>({...x,type:'water'})),...originalSnapshot.weight.map(x=>({...x,type:'weight'}))].sort((a,b)=>b.day.localeCompare(a.day)).slice(0,60);
 const oldMeasurements=$('mlcOriginalMeasurements');
 if(oldMeasurements)oldMeasurements.innerHTML=(originalSnapshot.measurements||[]).slice().sort((a,b)=>b.day.localeCompare(a.day)).map(x=>'<div class="mlc-measurement-row"><span>'+escapeHTML(x.day)+' · '+escapeHTML(x.area)+': '+escapeHTML(String(x.value))+' in</span><span class="micro-tag">ORIGINAL</span></div>').join('')||'<p class="empty-note">No original measurements found on this browser.</p>';
 $('originalTrackingList').innerHTML=combined.length?combined.map(x=>'<div class="history-entry tracking-row"><div><strong>'+escapeHTML(x.type==='water'?'Water':'Body weight')+'</strong><small>'+escapeHTML(x.day)+' · '+escapeHTML(String(x.type==='water'?Math.round(x.amount):x.value))+(x.type==='water'?' mL':' lb')+'</small></div><span class="micro-tag">ORIGINAL</span></div>').join(''):'<p class="empty-note">No original daily tracking records found on this browser. Cloud data was not queried or altered.</p>';
}
function viewOriginal(){originalSnapshot=getOriginalSnapshot();renderHistory();renderTracking();renderOriginalPlans();renderProgress();notice('Original records checked locally. No original records were changed.')}
function logDaily(event,type){
 event.preventDefault();
 const form=new FormData(event.currentTarget);
 const day=String(form.get('day')||'');
 const value=Number(form.get(type==='water'?'amount':'value'));
 if(!/^\d{4}-\d\d-\d\d$/.test(day)||!Number.isFinite(value)||value<=0||(type==='water'&&value>5000)||(type==='weight'&&value>1500)){notice('Enter a valid date and amount.');return}
 const item={id:'mlc2-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),type,day,value};
 trackingEntries.unshift(item);trackingEntries=trackingEntries.slice(0,400);
 try{persistLocalTracking();renderTracking();event.currentTarget.querySelector('input[type="number"]').value='';notice('Saved in 2.0 on this device only.')}catch{trackingEntries.shift();notice('Could not save in this browser.')}
}

function escapeHTML(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function notice(message){const t=$('toast');t.textContent=message;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,3400)}
function setPage(next){if(!['welcome','home','workouts','library','progress','settings','coaching','nutrition','history','tracking'].includes(next))return;page=next;
 document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==next);
 document.querySelectorAll('[data-page]').forEach(el=>{const is=el.dataset.page===next;el.classList.toggle('selected',is);el.classList.toggle('active',is);if(is)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
 $('pageTitle').textContent=({welcome:'Welcome',home:'Home',workouts:'Workouts',library:'Exercise library',progress:'Progress',settings:'My Account',coaching:'Coaching',nutrition:'Nutrition',history:'Workout history',tracking:'Daily tracking'})[next];
 $('sidebar').classList.remove('open');document.body.classList.toggle('welcome-view',next==='welcome');document.body.classList.toggle('home-active',next==='home');window.scrollTo({top:0,behavior:'instant'});
 if(next==='home')renderHome();if(next==='workouts')renderWorkouts();if(next==='library')renderLibrary();
 if(next==='coaching')renderCoach();if(next==='progress')renderProgress();if(next==='settings')renderSettings();if(next==='history')renderHistory();if(next==='tracking')renderTracking();
}
function totalSets(){return demoSessions.reduce((n,x)=>n+x.sets.length,0)}
function nextPlan(){return window.MLC2WeeklySchedule?.resolve({presets:plans,custom:window.MLC2Custom?.allPlans(plans).filter(p=>p.id.startsWith('custom-'))||[],sessionsCompleted:demoSessions.length,storage:planStorage()})||window.MLC2Custom?.currentPlan(plans,demoSessions.length)||plans[demoSessions.length%plans.length]}
function renderHome(){
 $('metricWorkouts').textContent=demoSessions.length;
 $('metricSets').textContent=totalSets();
 const plan=nextPlan();
 $('heroStart').dataset.homeWorkout=plan.id;
 $('todayStart').dataset.homeWorkout=plan.id;
 $('todayTitle').textContent=plan.title;$('todayDescription').textContent=plan.ids.length+' exercises · '+(plan.ids.length*3)+' sets · ~45 min';
 $('todayExercises').innerHTML=plan.ids.map(id=>{const e=libraryExercises().find(x=>x.id===id)||exercises.find(x=>x.id===id);return '<div class="preview-exercise"><strong>'+escapeHTML(e.name)+'</strong><small>'+e.sets+' × '+escapeHTML(e.reps)+'</small></div>'}).join('');
 $('recentActivity').innerHTML=demoSessions.length?demoSessions.slice(0,3).map(x=>'<div class="recent-item"><div><strong>'+escapeHTML(x.title)+'</strong><small>'+new Date(x.created).toLocaleDateString()+'</small></div><span>'+x.sets.length+' sets</span></div>').join(''):'<div class="empty-note">Your next session starts here. Practice workouts you complete in this demo will appear in this section.</div>';
}
let workoutTab='today';
function setWorkoutTab(tab){
 if(!['today','routines','schedule'].includes(tab))return;
 workoutTab=tab;
 for(const name of ['today','routines','schedule']){
  const cap=name[0].toUpperCase()+name.slice(1);
  const panel=$('workoutPanel'+(name==='routines'?'Routines':cap));
  const button=$('workoutTab'+(name==='routines'?'Routines':cap));
  const active=name===tab;
  if(panel)panel.hidden=!active;
  if(button){
   button.setAttribute('aria-selected',String(active));
   button.tabIndex=active?0:-1;
  }
 }
}
function renderWorkouts(){
 const selected=nextPlan();
 const activeId=selected?.id||'';
 const ownerReady=!!verifiedOwnerId&&account?.id===verifiedOwnerId;
 const custom=(window.MLC2Custom?.allPlans(plans)||plans).filter(p=>p.id.startsWith('custom-'));
 const all=[...custom,...plans];
 const top=$('workoutTodayName'),meta=$('workoutTodayMeta'),source=$('workoutTodaySource');
 if(top)top.textContent=selected?.title||'Choose a workout';
 if(meta)meta.textContent=selected?selected.ids.length+' exercises · '+(selected.kind==='Custom'?'Custom routine':'Preset routine'):'';
 if(source)source.textContent=selected?(selected.scheduleSource==='manual'?'Selected by you':selected.scheduleSource==='weekly'?'From your weekly schedule':'Recommended next session'):'';
 const start=$('workoutTodayStart');if(start){start.dataset.workout=activeId;start.disabled=!activeId}
 const guestBox=$('guestWorkoutRecovery'),guestStatus=$('guestWorkoutRecoveryStatus');
 const recoverable=ownerReady?window.MLC2Custom?.guestRecovery():null;
 if(guestBox)guestBox.hidden=!(recoverable?.available>0);
 if(guestStatus&&recoverable?.available>0)
  guestStatus.textContent=recoverable.available+' guest workout(s) available to copy to this verified account. Existing workouts will not be replaced.';
 window.MLC2WeeklySchedule?.render($('weeklySchedule'),{
  presets:plans,custom,
  storage:planStorage(),onChanged:()=>{renderHome();renderWorkouts();if(page==='coaching')renderCoach()}
 });
 const section=(items,label)=>{
  const cards=items.map(p=>{
   const current=p.id===activeId;
   const isCustom=p.id.startsWith('custom-');
   return '<article class="workout-compact-card'+(current?' is-selected':'')+'">'+
    '<div class="workout-compact-heading"><div><h3>'+escapeHTML(p.title)+'</h3>'+
    '<p>'+p.ids.length+' exercises · '+(isCustom?'Custom':'Preset')+'</p></div>'+
    (current?'<span class="workout-selected-tag">Today ✓</span>':'')+'</div>'+
    '<div class="workout-compact-actions">'+
    '<button type="button" class="workout-compact-start" data-workout="'+escapeHTML(p.id)+'">Start workout</button>'+
    '<button type="button" class="workout-compact-select" data-custom-select="'+escapeHTML(p.id)+'"'+(current?' disabled':'')+'>'+(current?'Selected':'Use for today')+'</button>'+
    (isCustom?'<button type="button" class="workout-compact-icon" data-custom-edit="'+escapeHTML(p.id)+'" aria-label="Edit '+escapeHTML(p.title)+'">Edit</button>'+
    '<button type="button" class="workout-compact-icon workout-compact-delete" data-custom-delete="'+escapeHTML(p.id)+'" aria-label="Delete '+escapeHTML(p.title)+'">Delete</button>':'')+
    '</div></article>';
  }).join('');
  return '<div class="workout-compact-section"><h3 class="workout-compact-label">'+label+'</h3>'+
   (cards||'<p class="workout-compact-empty">No custom routines yet. Create one to get started.</p>')+ '</div>';
 };
 $('workoutGrid').innerHTML=section(custom,'Your custom workouts')+section(plans,'Ready-made presets');
 setWorkoutTab(workoutTab);
}
// An external catalog is optional. Never treat a readable file as visually approved.
// The 344-item private release manifest can populate window.MLC2_EXERCISE_CATALOG
// before app.js is loaded; the original demo catalog remains a safe fallback.
function libraryExercises(){
 const imported=window.MLC2_EXERCISE_CATALOG;
 return Array.isArray(imported)&&imported.length?imported.filter(e=>e&&typeof e.id==='string'&&typeof e.name==='string'&&typeof e.group==='string'):exercises;
}
function approvedThumbnail(e){
 const d=e.demonstration;
 if(!d||d.status!=='approved'||typeof d.thumbnail!=='string')return '';
 // Only same-site media paths. An unapproved or missing thumbnail displays the placeholder.
 return /^(?:\.\/)?(?:assets|media|images)\/[A-Za-z0-9_./-]+\.(?:webp|png|jpg|jpeg)$/i.test(d.thumbnail)?d.thumbnail:'';
}
function renderLibrary(){
 const query=$('exerciseSearch').value.trim().toLowerCase();
 const matches=libraryExercises().filter(e=>(!muscleFilter||e.group===muscleFilter)&&(e.name+' '+e.group).toLowerCase().includes(query));
 document.querySelectorAll('[data-muscle]').forEach(b=>b.classList.toggle('selected',b.dataset.muscle===muscleFilter));
 $('libraryGrid').innerHTML=matches.map(e=>{
  const image=approvedThumbnail(e);
  const thumbnail=image?'<img class="library-thumb approved-thumb" src="'+escapeHTML(image)+'" alt="Approved demonstration of '+escapeHTML(e.name)+'" loading="lazy" data-approved-thumb>':'';
  const placeholder='<div class="library-placeholder" aria-label="Demonstration coming soon"><span class="library-placeholder-icon" aria-hidden="true">◇</span><span>DEMONSTRATION<br>COMING SOON</span></div>';
  return '<article class="library-card reference-exercise"><div class="library-media">'+placeholder+thumbnail+'</div><div class="library-info"><h3>'+escapeHTML(e.name)+'</h3><p>'+escapeHTML(e.group)+' · '+escapeHTML(String(e.sets||3))+' sets · '+escapeHTML(String(e.reps||'8–12'))+' reps</p><details><summary>Technique notes</summary><p>'+escapeHTML(e.cue||'Follow correct setup and controlled movement.')+'</p></details></div><span class="library-chevron">›</span></article>';
 }).join('')||'<p class="empty-note">No exercises match that search.</p>';
 $('libraryGrid').querySelectorAll('img[data-approved-thumb]').forEach(img=>img.addEventListener('error',()=>img.remove(),{once:true}));
}
function renderProgress(){
 window.MLC2PostWorkout?.render($('postWorkoutRecap'),demoSessions);
 const movements=new Set(demoSessions.flatMap(x=>x.sets.map(y=>y.exerciseId)));
 $('progressSessions').textContent=demoSessions.length;$('progressSets').textContent=totalSets();$('progressMovements').textContent=movements.size;
 renderProgressChart();
 window.MLC2Progress?.renderRecords($('demoRecords'),demoSessions,'demo',(id)=>libraryExercises().find(e=>e.id===id)?.name||id);
 window.MLC2Progress?.renderRecords($('legacyRecords'),originalSnapshot?.sessions||[],'original',(id,name)=>libraryExercises().find(e=>e.id===id)?.name||name);
 $('legacyRecordsNote').textContent=originalSnapshot?'Read-only snapshot from original device storage.':'Tap View original records in Workout History to load a local read-only snapshot. No cloud data is queried.';
 $('sessionHistory').innerHTML=demoSessions.length?demoSessions.map(x=>'<div class="recent-item"><div><strong>'+escapeHTML(x.title)+'</strong><small>'+new Date(x.created).toLocaleString()+'</small></div><span>'+x.sets.length+' sets</span></div>').join(''):'<div class="empty-note">No demo sessions recorded yet. Open Workouts to start your first practice session.</div>';
}
function renderProgressChart(){
 const root=$('progressChart');if(!root)return;
 const rows=demoSessions.slice(0,8).reverse();
 if(!rows.length){root.innerHTML='<div class="chart-empty">Your volume chart will appear here after you finish a practice workout.<span>No invented progress numbers.</span></div>';return;}
 const values=rows.map(x=>x.sets.reduce((sum,set)=>sum+Number(set.weight||0)*Number(set.reps||0),0));
 const peak=Math.max(1,...values),count=values.length;
 const xy=values.map((n,i)=>({x:22+(i*(276/Math.max(1,count-1))),y:175-(n/peak)*142}));
 const points=xy.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
 const fill='22,184 '+points+' '+xy[xy.length-1].x.toFixed(1)+',184';
 root.innerHTML='<svg viewBox="0 0 320 220" role="img" aria-label="Training volume trend based on '+count+' locally saved practice sessions"><defs><linearGradient id="volumeFill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#f6d88c" stop-opacity=".48"/><stop offset="1" stop-color="#f6d88c" stop-opacity=".02"/></linearGradient></defs><path d="M22 28 V184 H304" fill="none" stroke="#bbdfd2" stroke-opacity=".35"/><path d="M22 80 H304 M22 132 H304" fill="none" stroke="#bbdfd2" stroke-opacity=".2"/><polygon points="'+fill+'" fill="url(#volumeFill)"/><polyline points="'+points+'" fill="none" stroke="#ffe1a0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+xy.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="3.5" fill="#ffeba8"/>').join('')+'<text x="25" y="207" fill="#c9e5da" font-size="11">Earliest</text><text x="293" y="207" text-anchor="end" fill="#c9e5da" font-size="11">Latest</text></svg><p>'+count+' practice sessions · '+Math.round(values[values.length-1]).toLocaleString()+' lb-reps last session</p>';
}
function renderCoach(){
 const selected=nextPlan(),catalog=libraryExercises();
 const mode=betaView();
 const pro=mode.mode==='pro';
 document.querySelectorAll('[data-pro-coach]').forEach(el=>{el.hidden=!pro});
 const note=$('coachFreeNotice');if(note)note.hidden=pro;
 if(pro){
  window.MLC2Coach?.render($('coachSuggestions'),demoSessions,catalog);
  window.MLC2Coach?.renderTools($('coachSubstitutions'),catalog,selected);
 }else{$('coachSuggestions').replaceChildren();$('coachSubstitutions').replaceChildren()}
 window.MLC2Coach?.renderNextWorkout($('coachNextWorkout'),selected,demoSessions,catalog);
 window.MLC2Coach?.renderTechnique($('coachTechnique'),selected,catalog);
 window.MLC2CoachReadiness?.render($('coachReadiness'),demoSessions,selected);
 window.MLC2CoachTrends?.render($('coachTrends'),demoSessions,window.MLC2CoachReadiness?.weeklyGoal()||4);
}
function renderSettings(){
 $('accountIdentity').textContent=account?.email?account.email+' · authenticated (production workout data is not loaded)':'Not signed in. You can still explore the demo.';
 $('backendStatus').textContent=account?'AUTHENTICATED':'NOT CONNECTED';
 $('cloudPill').textContent=verifiedOwnerId&&account?.id===verifiedOwnerId?'ACCOUNT CONNECTED · 2.0 SYNC':'DEMO WORKSPACE';
 $('authAction').textContent=account?'Sign out':'Sign in with existing account';
 const beta=betaView();
 const betaCard=$('betaAccessCard'),betaSelect=$('betaAccessSelect'),betaStatus=$('betaAccessStatus');
 if(betaCard)betaCard.hidden=false;
 if(betaSelect){betaSelect.disabled=betaModeSaving;betaSelect.value=beta.mode}
 if(betaStatus&&!betaModeSaving)betaStatus.textContent=verifiedOwnerId?
   ('Current beta mode: '+beta.mode.toUpperCase()+' · saved in your account. No payment required.'):
   ('Current beta mode: '+beta.mode.toUpperCase()+' · guest preview saved for this browser session. Sign in to save across devices.');
 const syncNow=$('autoWorkoutSyncNow'),recoverCloud=$('autoWorkoutRecover');
 for(const key of ['backupOtherFitnessData','restoreOtherFitnessData']){const button=$(key);if(button)button.disabled=!verifiedOwnerId||auxOperationBusy}
 if(syncNow)syncNow.disabled=!verifiedOwnerId||workoutSyncBusy;
 if(recoverCloud)recoverCloud.disabled=!verifiedOwnerId||workoutSyncBusy;
 if($('autoWorkoutSyncStatus'))$('autoWorkoutSyncStatus').textContent=verifiedOwnerId?workoutSyncText:'Sign in to enable automatic workout sync.';
 const accountBackup=$('exportAccountWorkouts'),accountFile=$('accountRecoveryFile'),restore=$('restoreAccountWorkouts');
 if(accountBackup)accountBackup.disabled=!verifiedOwnerId;
 if(accountFile)accountFile.disabled=!verifiedOwnerId;
 if(restore)restore.disabled=!verifiedOwnerId||!pendingAccountRecovery;
 const backupStatus=$('accountRecoveryStatus');
 if(backupStatus){
  if(!verifiedOwnerId)backupStatus.textContent='Sign in to back up or recover this account’s workouts.';
  else if(backupStatus.textContent.startsWith('Sign in'))
   backupStatus.textContent='Signed in · account workout backup and recovery are available.';
 }
}
function openModal(content){$('modalContent').innerHTML=content;$('modal').hidden=false;document.body.style.overflow='hidden';$('closeModal').focus()}
function closeModal(){closeRest();$('modal').hidden=true;$('modal').classList.remove('auth-fullscreen');document.body.style.overflow='';activePlan=null;session=null;activeDraftStore=null;activeDraftOwner=null}
function openWorkout(id){
 $('modal').classList.remove('auth-fullscreen');
 const workoutStartedOwner=verifiedOwnerId;
 const plan=(window.MLC2Custom?.allPlans(plans)||plans).find(x=>x.id===id);if(!plan)return;
 const draftAPI=window.MLC2SessionDraft;
 const draftStore=window.MLC2AccountDraft.scope(localStorage,workoutStartedOwner);
 const other=draftAPI?.read(draftStore);
 if(other?.sets.length&&(other.planId!==id||JSON.stringify(other.ids)!==JSON.stringify(plan.ids))){
  if(!confirm('An unfinished workout has '+other.sets.length+' saved sets. The workout or exercise list differs. Start again and discard that older draft?'))return;
 }
 activePlan=plan;activeDraftStore=draftStore;activeDraftOwner=workoutStartedOwner;
 session={sets:draftAPI?.resume(draftStore,plan)||[]};
 try{draftAPI?.save(draftStore,plan,session.sets)}
 catch{notice('This browser could not save the workout draft. Use Finish session to save completed sets.')}
 openModal('<div class="active-workout-header"><span class="modal-eyebrow">ACTIVE WORKOUT · 2.0 BETA</span><h2>'+escapeHTML(plan.title)+'</h2><p>'+escapeHTML(plan.description)+'</p><div class="active-workout-progress" id="activeWorkoutProgress" role="status" aria-live="polite"></div></div><div class="active-workout-toolbar"><label class="active-rest-toggle"><input type="checkbox" id="autoRestToggle"> Auto rest after each set</label><button type="button" class="button-outline" id="startRest">Rest 1:30</button></div><div id="workoutLog" class="workout-log"></div><div class="modal-footer active-workout-footer"><button type="button" class="button-outline" id="cancelWorkout">Save draft &amp; exit</button><button type="button" class="button-primary" id="finishWorkout">Finish workout</button></div>');
 renderWorkoutLog();
 for(const exerciseId of plan.ids)updateExerciseFeedback(exerciseId);
 $('cancelWorkout').addEventListener('click',closeModal);
 $('startRest').addEventListener('click',openRest);
 $('finishWorkout').addEventListener('click',()=>{
  if(workoutStartedOwner!==verifiedOwnerId){notice('Account changed during this workout. Return to the original account or restart before saving.');return}
  if(!session?.sets.length){notice('Add at least one practice set first.');return}
  const entry={id:'demo-'+Date.now()+'-'+Math.random().toString(36).slice(2,9),created:new Date().toISOString(),title:plan.title,planId:plan.id,sets:session.sets.map(set=>({...set})),...(verifiedOwnerId?{ownerId:verifiedOwnerId}:{})};
  // Persist first. A failed local write must not create a phantom completed workout.
  const proposed=[entry,...demoSessions]; // No silent history eviction.
  try{
   window.MLC2AccountWorkouts.save(localStorage,verifiedOwnerId,proposed);
   demoSessions=proposed;
   // Local write succeeded. Queue using the existing isolated Supabase journal.
   queueWorkoutForSync(entry);
   try{window.MLC2SessionDraft?.clear(activeDraftStore,plan.id)}catch{}
   closeModal();renderHome();setPage('progress');notice('Practice session saved in this browser.');
  }catch{notice('Could not save the session; it stays open for retry. Check browser storage.');}
 });
}
function renderWorkoutLog(){
 if(!activePlan)return;
 const ux=window.MLC2WorkoutUX;
 const catalog=libraryExercises();
 $('workoutLog').innerHTML=activePlan.ids.map((id,i)=>{
  const e=catalog.find(x=>x.id===id)||exercises.find(x=>x.id===id);
  if(!e)return '';
  const logged=session.sets.filter(x=>x.exerciseId===id);
  const prior=ux?.previous(id,demoSessions,activePlan.id);
  const last=prior?.sets?.[prior.sets.length-1];
  const defaults=ux?.defaults(id,session.sets,demoSessions,activePlan.id)||{weight:40,reps:10};
  const previousText=last?'Last workout: '+last.weight+' lb × '+last.reps+' reps':'No previous session for this workout';
  const coach=betaView().mode==='pro'&&e.group!=='Cardio'?window.MLC2Coach?.suggestion(id,demoSessions,catalog):null;
  const coachHint=coach?.status==='ready'?
   '<p class="active-coach-hint"><strong>✦ Coach</strong> '+escapeHTML(coach.action.toUpperCase()+': '+coach.weight+' lb suggested')+' · '+escapeHTML(coach.reason)+' <small>Optional · no weights changed</small></p>':'';
  const count=logged.length;
  return '<article class="log-card active-log-card" data-exercise-card="'+escapeHTML(id)+'"><div class="log-title"><div class="active-exercise-heading"><span class="active-exercise-index">'+(i+1)+'</span><h4>'+escapeHTML(e.name)+'</h4></div><span class="logged-count" data-count="'+escapeHTML(id)+'">'+count+' logged</span></div><div class="active-exercise-context"><span>Target: '+escapeHTML(String(e.sets||3))+' × '+escapeHTML(String(e.reps||'8–12'))+'</span><span class="active-previous">'+escapeHTML(previousText)+'</span></div>'+coachHint+'<div class="active-set-header"><span>SET</span><span>PREVIOUS</span><span>WEIGHT</span><span>REPS</span><span>DONE</span></div><div class="active-set-rows" data-set-rows="'+escapeHTML(id)+'"></div><div class="inputs active-set-entry"><span class="active-entry-number" data-next-set="'+escapeHTML(id)+'">'+(count+1)+'</span><span class="active-prev-mini">'+(last?escapeHTML(last.weight+' × '+last.reps):'—')+'</span><label><span class="sr-only">Weight (lb)</span><input aria-label="'+escapeHTML(e.name)+' weight in pounds" type="number" min="0" max="1500" step="2.5" inputmode="decimal" data-weight="'+escapeHTML(id)+'" value="'+defaults.weight+'"></label><label><span class="sr-only">Reps</span><input aria-label="'+escapeHTML(e.name)+' repetitions" type="number" min="1" max="100" step="1" inputmode="numeric" data-reps="'+escapeHTML(id)+'" value="'+defaults.reps+'"></label><button class="active-complete-set" data-addset="'+escapeHTML(id)+'" type="button" aria-label="Complete set for '+escapeHTML(e.name)+'">✓</button></div><div class="active-card-actions"><span class="set-feedback" data-feedback="'+escapeHTML(id)+'" role="status" aria-live="polite"></span><button class="undo-set" data-undo="'+escapeHTML(id)+'" type="button" hidden>Undo last set</button></div></article>';
 }).join('');
 updateWorkoutProgress();
 for(const id of activePlan.ids)updateExerciseFeedback(id);
}
function updateWorkoutProgress(){
 if(!activePlan||!session)return;
 const v=window.MLC2WorkoutUX?.progress(activePlan.ids,session.sets);
 const el=$('activeWorkoutProgress');if(!el||!v)return;
 el.textContent=v.logged+' sets completed · '+v.completedExercises+' of '+v.totalExercises+' exercises started';
}
function updateExerciseFeedback(id){
 if(!session)return;
 const sets=session.sets.filter(x=>x.exerciseId===id);
 const card=document.querySelector('[data-exercise-card="'+id+'"]');
 if(!card)return;
 const count=card.querySelector('[data-count]'),feedback=card.querySelector('[data-feedback]');
 const undo=card.querySelector('[data-undo]'),rows=card.querySelector('[data-set-rows]');
 if(count)count.textContent=sets.length+' logged';
 if(feedback)feedback.textContent=sets.length?'✓ Set saved to your workout draft':'';
 if(undo)undo.hidden=sets.length===0;
 if(rows){
  rows.innerHTML=sets.map((set,i)=>'<div class="active-logged-row"><span>'+(i+1)+'</span><span>—</span><strong>'+escapeHTML(String(set.weight))+' lb</strong><strong>'+escapeHTML(String(set.reps))+'</strong><span class="active-done-check" aria-label="Set completed">✓</span></div>').join('');
 }
 const next=card.querySelector('[data-next-set]');if(next)next.textContent=sets.length+1;
 updateWorkoutProgress();
}
function addSet(id){
 if(!session||!activePlan?.ids.includes(id))return;
 if(activeDraftOwner!==verifiedOwnerId){notice('Account changed; restart the workout before logging sets.');return}
 const weightField=document.querySelector('[data-weight="'+id+'"]');
 const repsField=document.querySelector('[data-reps="'+id+'"]');
 if(!weightField||!repsField)return;
 const weight=Number(weightField.value),reps=Number(repsField.value);
 if(weightField.value.trim()===''||repsField.value.trim()===''||!Number.isFinite(weight)||weight<0||weight>1500||!Number.isInteger(reps)||reps<1||reps>100){
  notice('Enter a valid weight and rep count.');return;
 }
 session.sets.push({exerciseId:id,weight,reps});
 try{window.MLC2SessionDraft?.save(activeDraftStore,activePlan,session.sets)}
 catch{notice('Set logged in memory, but browser draft saving failed.')}
 // Update only this exercise: never erase inputs, keyboard focus, or scroll position.
 updateExerciseFeedback(id);
 if($('autoRestToggle')?.checked)openRest();
}
function undoSet(id){
 if(!session||!activePlan?.ids.includes(id))return;
 if(activeDraftOwner!==verifiedOwnerId){notice('Account changed; restart the workout before changing sets.');return}
 const index=session.sets.findLastIndex(x=>x.exerciseId===id);
 if(index<0)return;
 session.sets.splice(index,1);
 try{window.MLC2SessionDraft?.save(activeDraftStore,activePlan,session.sets)}
 catch{notice('Set removed in memory, but browser draft saving failed.')}
 updateExerciseFeedback(id);
}
function stopRestClock(){
 if(restClock!==null){clearInterval(restClock);restClock=null;}
}
function updateRestClock(){
 const mins=Math.floor(restSeconds/60),secs=restSeconds%60;
 $('restTime').textContent=mins+':'+String(secs).padStart(2,'0');
 $('restDial').style.setProperty('--rest-fraction',String(Math.min(1,Math.max(0,restSeconds/90))));
 $('restPause').textContent=restPaused?'▶':'Ⅱ';
 $('restPause').setAttribute('aria-label',restPaused?'Resume rest timer':'Pause rest timer');
}
function closeRest(){
 stopRestClock();restPaused=true;$('restScreen').hidden=true;
 document.body.style.overflow=$('modal').hidden?'':'hidden';
}
function openRest(){
 restSeconds=90;restPaused=false;
 let next=activePlan?.ids.find(id=>!session?.sets.some(set=>set.exerciseId===id))||activePlan?.ids[0];
 const e=libraryExercises().find(x=>x.id===next)||exercises.find(x=>x.id===next);
 $('restNextName').textContent=e?.name||'Continue workout';
 $('restNextReps').textContent=e?e.sets+' sets · '+e.reps+' reps':'';
 $('restScreen').hidden=false;
 document.body.style.overflow='hidden';
 stopRestClock();updateRestClock();
 // Use wall-clock elapsed time so an iPhone screen lock does not stretch the timer.
 let tickAt=Date.now();
 restClock=setInterval(()=>{
  const now=Date.now();
  if(!restPaused){restSeconds=Math.max(0,restSeconds-Math.round((now-tickAt)/1000));}
  tickAt=now;updateRestClock();
  if(restSeconds===0){closeRest();notice('Rest complete — ready for the next set.')}
 },1000);
}
async function authRequest(path,body,token,method='POST'){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const headers={'apikey':PUBLIC_KEY,'Content-Type':'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  const res=await fetch(BACKEND+'/auth/v1/'+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:ctrl.signal,cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){const error=new Error(data.error_description||data.msg||data.message||('HTTP '+res.status));error.status=res.status;throw error}
  return data;
 }finally{clearTimeout(timer)}
}
function saveAuth(data){originalSnapshot=null;
 const session={access_token:data.access_token,refresh_token:data.refresh_token,user:data.user,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600)};
 authStore.save(sessionStorage,localStorage,session);auth=session;account=data.user;renderSettings();
}
function clearAuth(){authEpoch++;switchWorkoutOwner(null);cloudHistoryRequestId++;authStore.clear(sessionStorage,localStorage);auth=null;account=null;originalSnapshot=null;cloudHistorySnapshot=null;if($('cloudOriginalHistoryResults'))$('cloudOriginalHistoryResults').replaceChildren();if($('cloudOriginalHistoryStatus'))$('cloudOriginalHistoryStatus').textContent='Signed out. Cloud archive cleared from memory.';renderSettings();renderHistory();renderTracking();renderOriginalPlans();renderProgress()}
async function validateStoredAuth(){
 const thisEpoch=++authEpoch;
 const saved=authStore.read(sessionStorage,localStorage);
 if(!saved)return;
 try{
  let candidate=saved;
  if(saved.expires_at<Date.now()/1000+45){
   const refreshed=await authRequest('token?grant_type=refresh_token',{refresh_token:saved.refresh_token});
   if(thisEpoch!==authEpoch)return;
   if(!refreshed?.access_token||!refreshed?.user?.id||refreshed.user.id!==saved.user.id){
    clearAuth();return;
   }
   candidate={access_token:refreshed.access_token,refresh_token:refreshed.refresh_token,
    user:refreshed.user,expires_at:Math.floor(Date.now()/1000)+(refreshed.expires_in||3600)};
  }
  // Stored auth is untrusted: never activate or sync an account before /user verifies.
  const user=await authRequest('user',null,candidate.access_token,'GET');
  if(thisEpoch!==authEpoch)return;
  if(!user?.id||user.id!==saved.user.id){clearAuth();return}
  candidate.user=user;
  authStore.save(sessionStorage,localStorage,candidate);
  auth=candidate;account=user;switchWorkoutOwner(user.id);
 }catch(err){
  if(thisEpoch!==authEpoch)return;
  if([400,401,403].includes(err?.status)){clearAuth();return}
  // Transient network/offline/storage errors are not sign-outs.
  // Do not discard the refresh token or falsely show authenticated access.
  auth=null;account=null;
  if(verifiedOwnerId!==null)switchWorkoutOwner(null);
 }
 if(thisEpoch===authEpoch)renderSettings();
}
function openSignIn(){
 openModal('<div class="modal-eyebrow">EXISTING SUPABASE ACCOUNT</div><h2>Welcome back</h2><p>Use the email and password from your original MYLIFTCOACH account. This only verifies your identity; it will not import, overwrite, or modify workout records.</p><form id="loginForm" class="login-form"><label>Email<input name="email" type="email" autocomplete="email" autocapitalize="none" required></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><button class="button-primary" id="loginSubmit" type="submit">Sign in securely</button></form><p id="loginMessage" role="status"></p><p class="small">The training area stays in demo mode until the legacy data mapping is verified.</p>');
 $('modal').classList.add('auth-fullscreen');
 // Do not focus through the id-only $ helper: the old selector threw before
 // the submit handler was attached. Avoid autofocus on iPhone to prevent keyboard jumps.
 $('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();const submit=$('loginSubmit');submit.disabled=true;submit.textContent='Connecting…';$('loginMessage').textContent='';
  const form=new FormData(event.currentTarget);
  try{
   const response=await authRequest('token?grant_type=password',{email:String(form.get('email')).trim(),password:String(form.get('password'))});
   if(!response?.access_token||!response?.user?.id)throw Error('No verified account was returned.');
   const verified=await authRequest('user',null,response.access_token,'GET');
   if(!verified?.id||verified.id!==response.user.id)throw Error('Account identity could not be verified.');
   authEpoch++;saveAuth({...response,user:verified});switchWorkoutOwner(verified.id);
   if(verifiedOwnerId!==verified.id||account?.id!==verified.id||
      authStore.read(sessionStorage,localStorage)?.user?.id!==verified.id)
    throw Error('Account session was not retained; sign-in was not completed.');
   closeModal();setPage('home');renderSettings();
   notice('Signed in to your verified MYLIFTCOACH 2.0 account.');
  }catch(err){$('loginMessage').className='auth-error';$('loginMessage').textContent=err.name==='AbortError'?'The account service timed out.':/invalid/i.test(err.message)?'Email or password was not accepted.':'Could not sign in: '+String(err.message).slice(0,120)}
  finally{submit.disabled=false;submit.textContent='Sign in securely'}
 });
}
function bind(){
 document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.page)));
 $('avatarBtn').addEventListener('click',()=>setPage('settings'));
 $('previewWelcome').addEventListener('click',()=>setPage('welcome'));
 $('welcomeExplore').addEventListener('click',()=>setPage('home'));
 $('welcomeSignIn').addEventListener('click',openSignIn);
 document.querySelectorAll('[data-shortcut]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.shortcut)));
 document.querySelectorAll('[data-coach-link]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.coachLink)));

 $('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
 $('homeMenuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
 $('sidebarClose').addEventListener('click',()=>$('sidebar').classList.remove('open'));
 $('homeAccountBtn').addEventListener('click',()=>setPage('settings'));

 $('heroStart').addEventListener('click',()=>openWorkout($('heroStart').dataset.homeWorkout));
 $('heroViewPlan').addEventListener('click',()=>setPage('workouts'));
 $('todayStart').addEventListener('click',()=>openWorkout($('todayStart').dataset.homeWorkout));
 $('workoutGrid').addEventListener('click',e=>{if(window.MLC2Custom?.handleClick(e,()=>{renderHome();renderWorkouts();if(page==='coaching')renderCoach()},openWorkout))return;const el=e.target.closest('[data-workout]');if(el)openWorkout(el.dataset.workout)});
 $('createWorkout').addEventListener('click',()=>window.MLC2Custom?.openEditor(null,libraryExercises(),()=>{renderHome();renderWorkouts();if(page==='coaching')renderCoach()}));
 $('workoutTodayStart').addEventListener('click',()=>{
  const id=$('workoutTodayStart').dataset.workout;
  if(id)openWorkout(id);
 });
 $('workoutTodayChange').addEventListener('click',()=>setWorkoutTab('routines'));
 document.querySelectorAll('[data-workout-tab]').forEach(button=>{
  button.addEventListener('click',()=>setWorkoutTab(button.dataset.workoutTab));
  button.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();
   const order=['today','routines','schedule'];
   const current=order.indexOf(button.dataset.workoutTab);
   const target=event.key==='Home'?0:event.key==='End'?2:(current+(event.key==='ArrowLeft'?-1:1)+3)%3;
   setWorkoutTab(order[target]);
   document.querySelector('[data-workout-tab="'+order[target]+'"]')?.focus();
  });
 });

 $('recoverGuestWorkouts').addEventListener('click',()=>{
  if(!verifiedOwnerId||verifiedOwnerId!==account?.id){notice('Sign in to recover guest workouts.');return}
  const recovery=window.MLC2Custom?.guestRecovery();
  if(!recovery?.available)return;
  if(!confirm('Copy '+recovery.available+' guest workout(s) into this account? The guest copies and existing account routines will remain untouched.'))return;
  try{
   const result=window.MLC2Custom.recoverGuest();
   renderHome();renderWorkouts();if(page==='coaching')renderCoach();
   notice(result.added+' guest workout(s) copied. Original copies preserved.');
  }catch(err){notice('Recovery not completed: '+String(err?.message||err).slice(0,95))}
 });
 ['loadOriginalHistory','loadOriginalTracking','loadOriginalPlans'].forEach(id=>$(id).addEventListener('click',viewOriginal));
 $('waterForm').addEventListener('submit',e=>logDaily(e,'water'));
 $('weightForm').addEventListener('submit',e=>logDaily(e,'weight'));
 $('localTrackingList').addEventListener('click',e=>{
  const b=e.target.closest('[data-remove-track]');if(!b)return;
  const old=trackingEntries;trackingEntries=trackingEntries.filter(x=>x.id!==b.dataset.removeTrack);
  try{persistLocalTracking();renderTracking();notice('2.0 entry removed. Original data unchanged.')}catch{trackingEntries=old;notice('Could not remove local entry.')}
 });

 $('exerciseSearch').addEventListener('input',renderLibrary);
 $('libraryChips').addEventListener('click',event=>{const el=event.target.closest('[data-muscle]');if(!el)return;muscleFilter=el.dataset.muscle;renderLibrary()});
 document.querySelectorAll('[data-account-page]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.accountPage)));

 $('modalContent').addEventListener('click',e=>{const add=e.target.closest('[data-addset]');if(add){addSet(add.dataset.addset);return}const undo=e.target.closest('[data-undo]');if(undo)undoSet(undo.dataset.undo)});
 $('closeModal').addEventListener('click',closeModal);
 $('restClose').addEventListener('click',closeRest);
 $('restSkip').addEventListener('click',closeRest);
 $('restPause').addEventListener('click',()=>{restPaused=!restPaused;updateRestClock()});
 $('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modal').hidden)closeModal()});
 $('clearDemo').addEventListener('click',()=>{if(!confirm('Delete only the local 2.0 workout history for the current '+(verifiedOwnerId?'account':'guest')+'?'))return;try{window.MLC2AccountWorkouts.clear(localStorage,verifiedOwnerId);demoSessions=[];renderProgress();renderHome();notice('Current local workout history cleared. Production data untouched.')}catch{notice('Unable to clear this device history.')}});
 let pendingRecovery=null;
 $('recoveryImportFile').addEventListener('change',async e=>{
  pendingRecovery=null;
  $('recoveryRestoreAction').disabled=true;
  const status=$('recoveryImportResult'),file=e.target.files?.[0];
  if(!file){status.textContent='No recovery file selected.';return}
  if(file.size>4*1024*1024){status.textContent='Recovery file exceeds 4 MB.';return}
  try{
   const parsed=window.MLC2RecoveryImport.parse(await file.text());
   const preview=window.MLC2RecoveryImport.planRestore(parsed,localStorage);
   status.textContent='Backup '+parsed.created.slice(0,10)+': '+preview.writes.length+' categories absent, '+preview.identical.length+' already identical, '+preview.conflicts.length+' conflicting. '+(preview.canRestore?'Only absent categories can be restored.':'Conflicts detected: existing data will not be overwritten.')+' No photos or cloud records are included.';
   if(preview.canRestore&&preview.writes.length){pendingRecovery=parsed;$('recoveryRestoreAction').disabled=false}
  }catch(err){status.textContent='Rejected backup: '+String(err.message||err).slice(0,180)}
 });
 $('recoveryRestoreAction').addEventListener('click',()=>{
  if(verifiedOwnerId){$('recoveryImportResult').textContent='Legacy guest recovery cannot run while signed in. Account history was not changed.';return}
  if(!pendingRecovery)return;
  const preview=window.MLC2RecoveryImport.planRestore(pendingRecovery,localStorage);
  if(!preview.canRestore){$('recoveryImportResult').textContent='Existing data changed or conflicts. Restore blocked.';$('recoveryRestoreAction').disabled=true;pendingRecovery=null;return}
  if(!confirm('Restore '+preview.writes.length+' missing 2.0 storage categories in this browser? Existing records will NOT be replaced. Photos and cloud are unchanged.'))return;
  try{
   const result=window.MLC2RecoveryImport.restore(pendingRecovery,localStorage);
   $('recoveryImportResult').textContent='Recovered '+result.restored+' missing storage categories. Reload this page to display recovered workout data.';
   $('recoveryRestoreAction').disabled=true;pendingRecovery=null;
  }catch(err){$('recoveryImportResult').textContent='Restore blocked: '+String(err.message||err).slice(0,180)}
 });
 $('dataHealthAction').addEventListener('click',()=>{
  const output=$('dataHealthResult');
  try{
   const report=window.MLC2DataHealth.check(healthStorage(),libraryExercises(),plans,demoSessions);
   output.replaceChildren();
   const head=document.createElement('strong');head.textContent='Local data status: '+report.status.toUpperCase();output.append(head);
   const summary=document.createElement('p');summary.textContent=Object.entries(report.counts).map(([key,value])=>key+': '+value).join(' · ');output.append(summary);
   for(const line of [...report.errors,...report.warnings]){
    const p=document.createElement('p');p.textContent=line;output.append(p);
   }
   if(report.status==='pass'){const note=document.createElement('p');note.textContent='No local data structure problems detected. This does not verify cloud sync or private photos.';output.append(note)}
  }catch(err){output.textContent='Data check unavailable: '+String(err.message||err).slice(0,180)}
 });
 $('recoveryExportAction').addEventListener('click',()=>{
  const output=$('recoveryExportResult');
  if(verifiedOwnerId){output.textContent='This older backup format covers guest data only, not your signed-in account workouts. Export is blocked to avoid an incomplete recovery file.';return}
  try{
   const result=window.MLC2Recovery.download(localStorage);
   output.textContent='Local recovery file prepared ('+result.keys+' stored data categories; '+result.bytes+' bytes). Photos and account credentials are excluded.';
  }catch(err){output.textContent='Backup export failed: '+String(err.message||err).slice(0,180)}
 });
 $('mappingPreviewAction').addEventListener('click',()=>{
  const area=$('mappingPreviewResult');
  try{
   const plans=JSON.parse(localStorage.getItem('mlc2-custom-plans-v1')||'[]');
   const result=window.MLC2LegacyMapper.summarize({
    customPlans:plans,sessions:demoSessions,catalog:libraryExercises(),
    existingPlans:originalSnapshot?.plans||[],existingSessions:originalSnapshot?.sessions||[]
   });
   const messages=[
    'Convertible custom workouts: '+result.customWorkouts,
    'Convertible sessions: '+result.sessions,
    'Weighted sets: '+result.plannedSets,
    'Rejected records: '+result.rejected.length,
    'Potential ID collisions: '+(result.workoutIdCollisions.length+result.sessionIdCollisions.length)
   ];
   area.replaceChildren();
   const summary=document.createElement('p');summary.textContent=messages.join(' · ');area.append(summary);
   for(const message of result.warnings){const p=document.createElement('p');p.textContent=message;area.append(p)}
   const safety=document.createElement('strong');safety.textContent='DRY RUN ONLY — no upload or restore is enabled.';area.append(safety);
  }catch(err){area.textContent='Cannot prepare safe mapping: '+String(err.message||err).slice(0,200)}
 });
 $('checkpointCompareAction').addEventListener('click',async()=>{
  const oldFile=$('checkpointBaselineFile').files?.[0];
  const newFile=$('checkpointCurrentFile').files?.[0];
  const output=$('checkpointReviewResult');output.replaceChildren();
  if(!account?.id||!auth?.access_token){output.textContent='Sign in to the original account before comparing archives.';return}
  if(!oldFile||!newFile){output.textContent='Choose both an older baseline and a newer cloud archive.';return}
  if(oldFile.size>30*1024*1024||newFile.size>30*1024*1024){output.textContent='Archive exceeds the safe 30 MB limit.';return}
  const owner=account.id,token=auth.access_token;
  try{
   const [baselineText,currentText]=await Promise.all([oldFile.text(),newFile.text()]);
   if(account?.id!==owner||auth?.access_token!==token)throw Error('Account changed during comparison.');
   const result=window.MLC2CheckpointReview.inspect({
    baselineText,currentText,ownerId:owner,tables:window.PRISMStorageModel.TABLES,
    archiveInspector:window.MLC2MigrationReadiness.inspectArchive
   });
   const heading=document.createElement('strong');heading.textContent='Cloud checkpoint comparison — no writes permitted';output.append(heading);
   const numbers=[['Unchanged rows',result.changes.unchanged],['New rows',result.changes.added],
    ['Changed rows',result.changes.changed],['Deleted rows',result.changes.deleted],
    ['Revision anomalies',result.changes.revisionAnomalies],['Invalid revisions',result.changes.invalidRevision]];
   for(const [label,n] of numbers){const p=document.createElement('p');p.textContent=label+': '+n;output.append(p)}
   const notice=document.createElement('p');notice.textContent=result.checkpointCompatible?
    'No deletion/revision anomalies found, but this is not a live or atomic checkpoint. Sync remains blocked.':
    'Checkpoint anomalies or deletions detected. Sync remains blocked.';output.append(notice);
   for(const reason of result.blockers){const p=document.createElement('p');p.textContent='Required: '+reason;output.append(p)}
  }catch(error){output.textContent='Checkpoint comparison blocked: '+String(error.message||error).slice(0,190)}
 });
 $('loadCloudOriginalHistory').addEventListener('click',async()=>{
  const button=$('loadCloudOriginalHistory'),output=$('cloudOriginalHistoryResults'),status=$('cloudOriginalHistoryStatus');
  if(!account?.id||!auth?.access_token){status.textContent='Sign in to the original account to load cloud history.';return}
  const owner=account.id,token=auth.access_token,requestId=++cloudHistoryRequestId;
  button.disabled=true;cloudHistorySnapshot=null;output.replaceChildren();
  status.textContent='Loading original cloud workout records (read-only). This may take several requests…';
  try{
   const view=await window.MLC2LiveOriginalHistory.load({
    url:BACKEND,publishableKey:PUBLIC_KEY,token,userId:owner,
    tables:window.PRISMStorageModel.TABLES,fetcher:fetch,makeUrl:address=>new URL(address),
    archiveService:window.MLC2CloudArchive,historyViewer:window.MLC2CloudHistory,
    inspector:window.MLC2MigrationReadiness.inspectArchive,storageModel:window.PRISMStorageModel,
    stillAuthenticated:(userId,originalToken)=>requestId===cloudHistoryRequestId&&account?.id===userId&&auth?.access_token===originalToken
   });
   if(requestId!==cloudHistoryRequestId)return;
   cloudHistorySnapshot=view;
   window.MLC2CloudHistory.render(output,view,document);
   status.textContent='Original cloud data loaded for this view only. '+view.sessionCount+' sessions · '+view.planCount+' custom workouts. Nothing was saved or synchronized.';
  }catch(err){
   if(requestId!==cloudHistoryRequestId)return;
   cloudHistorySnapshot=null;output.replaceChildren();
   status.textContent='Original cloud history unavailable: '+String(err.message||err).slice(0,200);
  }finally{button.disabled=false}
 });
 $('cloudOriginalHistoryFile').addEventListener('change',async event=>{
  const requestId=++cloudHistoryRequestId;
  const output=$('cloudOriginalHistoryResults'),status=$('cloudOriginalHistoryStatus'),file=event.target.files?.[0];
  output.replaceChildren();cloudHistorySnapshot=null;
  status.textContent='No cloud archive loaded.';
  if(!file)return;
  if(file.size>30*1024*1024){status.textContent='Cloud archive is larger than 30 MB.';event.target.value='';return}
  if(!account?.id||!auth?.access_token){status.textContent='Sign in to the original account before opening its history.';event.target.value='';return}
  const owner=account.id,token=auth.access_token;
  try{
   const archiveText=await file.text();
   if(requestId!==cloudHistoryRequestId||account?.id!==owner||auth?.access_token!==token)throw Error('Signed-in account or history view changed while reading archive');
   const view=window.MLC2CloudHistory.open({
    archiveText,ownerId:owner,tables:window.PRISMStorageModel.TABLES,
    inspector:window.MLC2MigrationReadiness.inspectArchive,storageModel:window.PRISMStorageModel
   });
   if(requestId!==cloudHistoryRequestId)throw Error('Original archive view changed while loading');
   cloudHistorySnapshot=view;
   status.textContent='Original cloud archive opened for this session only. No cloud records or 2.0 history were changed.';
   window.MLC2CloudHistory.render(output,view,document);
  }catch(err){
   if(requestId===cloudHistoryRequestId){
    cloudHistorySnapshot=null;
    status.textContent='Could not open original cloud history: '+String(err.message||err).slice(0,200);
   }
  }finally{event.target.value=''}
 });
 $('clearCloudOriginalHistory').addEventListener('click',()=>{
  cloudHistoryRequestId++;cloudHistorySnapshot=null;$('cloudOriginalHistoryResults').replaceChildren();
  $('cloudOriginalHistoryStatus').textContent='Original cloud archive cleared from memory.';
 });
 $('migrationReadinessFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0],output=$('migrationReadinessResult');
  output.replaceChildren();
  if(!file){output.textContent='No cloud archive chosen.';return}
  if(file.size>30*1024*1024){output.textContent='Archive exceeds the safe 30 MB preview limit.';return}
  if(!account?.id||!auth?.access_token){output.textContent='Sign in to the same original account before inspecting its archive.';return}
  const owner=account.id;
  try{
   const contents=await file.text();
   if(!account||account.id!==owner)throw Error('Signed-in account changed during inspection');
   const plans=JSON.parse(localStorage.getItem('mlc2-custom-plans-v1')||'[]');
   const sessions=JSON.parse(localStorage.getItem('mlc2-demo-workouts-v1')||'[]');
   const result=window.MLC2MigrationReadiness.plan({
    archiveText:contents,ownerId:owner,allowedTables:window.PRISMStorageModel.TABLES,
    customPlans:plans,sessions,catalog:libraryExercises(),
    mapper:window.MLC2LegacyMapper,storageModel:window.PRISMStorageModel
   });
   const metrics=[
    ['Original cloud rows',result.cloudRows],['Original cloud workouts',result.originalWorkouts],
    ['Original cloud sessions',result.originalSessions],['Local 2.0 custom workouts',result.localWorkouts],
    ['Local 2.0 sessions',result.localSessions],['Convertible 2.0 workouts',result.convertibleWorkouts],
    ['Convertible 2.0 sessions',result.convertibleSessions],['Convertible weighted sets',result.convertibleSets],
    ['Rejected 2.0 records',result.rejected.length],['Original categories absent in archive',result.missingSourceCategories]
   ];
   const heading=document.createElement('strong');heading.textContent='Migration preview — READ ONLY; transfer blocked';output.append(heading);
   for(const [label,value] of metrics){const row=document.createElement('p');row.textContent=label+': '+value;output.append(row)}
   for(const message of result.blockers){const row=document.createElement('p');row.textContent='Blocked: '+message;output.append(row)}
   for(const message of result.warnings.slice(0,6)){const row=document.createElement('p');row.textContent='Note: '+message;output.append(row)}
  }catch(err){output.textContent='Cloud archive inspection blocked: '+String(err.message||err).slice(0,200)}
  finally{e.target.value=''}
 });
 $('reviewLegacyMedia').addEventListener('click',()=>{
  const root=$('legacyMediaReviewResults'),button=$('reviewLegacyMedia');
  if(!root)return;
  if(root.childElementCount){root.replaceChildren();button.textContent='Review 14 original image candidates';return}
  try{
   const report=window.MLC2LegacyMediaReview.render(root,libraryExercises(),document);
   button.textContent='Hide original image candidates';
   if(report.unmatched)notice(report.unmatched+' candidate images do not match a catalog ID.');
  }catch(err){root.textContent='Media review unavailable: '+String(err.message||err).slice(0,180)}
 });
 $('cloudArchiveAction').addEventListener('click',async()=>{
  const output=$('cloudArchiveResult'),button=$('cloudArchiveAction');
  if(!account?.id||!auth?.access_token){output.textContent='Sign in to your existing account before exporting original records.';return}
  if(!confirm('Download a PRIVATE copy of your original cloud account records? The archive may contain personal health and workout information. Keep it somewhere secure. This will not synchronize or change any cloud data.'))return;
  button.disabled=true;output.textContent='Reading your original account records (GET only)…';
  const originalId=account.id,originalToken=auth.access_token;
  try{
   const archive=await window.MLC2CloudArchive.collect({
    url:BACKEND,publishableKey:PUBLIC_KEY,token:originalToken,userId:originalId,
    tables:window.PRISMStorageModel.TABLES,fetcher:fetch,makeUrl:address=>new URL(address)
   });
   // Do not allow an archive to be delivered if sign-in identity changed during the request.
   if(account?.id!==originalId||auth?.access_token!==originalToken)throw Error('Account changed while reading; export cancelled');
   const result=window.MLC2CloudArchive.download(archive,document,URL,Blob,callback=>setTimeout(callback,60000));
   output.textContent='Original account archive prepared for download: '+result.records+' rows across '+result.tables+' table categories. Store this file privately. No data was changed.';
  }catch(e){output.textContent='Cloud archive unavailable: '+String(e.message||e).slice(0,210)}
  finally{button.disabled=false}
 });
 $('cloudPreviewAction').addEventListener('click',async()=>{
  const output=$('cloudPreviewResult'),button=$('cloudPreviewAction');
  if(!account?.id||!auth?.access_token){output.textContent='Sign in to your existing account first.';return}
  button.disabled=true;output.textContent='Inspecting original cloud records without changing them…';
  try{
   const result=await window.MLC2SyncPreview.run({url:BACKEND,publishableKey:PUBLIC_KEY,token:auth.access_token,userId:account.id});
   window.MLC2SyncPreview.render(output,result);
  }catch(e){output.textContent='Read-only preview unavailable: '+String(e.message||e).slice(0,200)}
  finally{button.disabled=false}
 });
 $('cloudAuditAction').addEventListener('click',async()=>{
  const output=$('cloudAuditResult'),button=$('cloudAuditAction');
  if(!account?.id||!auth?.access_token){output.textContent='Sign in to your existing account before checking cloud compatibility.';return}
  button.disabled=true;output.textContent='Checking authenticated records read-only…';
  try{
   const report=await window.MLC2CloudAudit.check({baseUrl:BACKEND,publishableKey:PUBLIC_KEY,token:auth.access_token,userId:account.id});
   window.MLC2CloudAudit.render(output,report);
  }catch(err){output.textContent='Compatibility check unavailable: '+String(err.message||err).slice(0,160)}
  finally{button.disabled=false}
 });
 $('exportAccountWorkouts').addEventListener('click',()=>{
  const output=$('accountRecoveryStatus');
  if(!verifiedOwnerId||verifiedOwnerId!==account?.id){output.textContent='Sign in to a verified account first.';return}
  try{
   const backup=window.MLC2AccountRecovery.make(localStorage,verifiedOwnerId);
   const data=JSON.stringify(backup,null,2),blob=new Blob([data],{type:'application/json'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download='MYLIFTCOACH-2.0-account-workouts-'+backup.created.slice(0,10)+'.json';
   document.body.appendChild(link);
   try{link.click()}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
   output.textContent='Downloaded '+backup.sessions.length+' account workouts. Save this file securely; no cloud records changed.';
  }catch(err){output.textContent='Account backup unavailable: '+String(err.message||err).slice(0,160)}
 });
 $('accountRecoveryFile').addEventListener('change',async e=>{
  const output=$('accountRecoveryStatus'),file=e.target.files?.[0];
  pendingAccountRecovery=null;$('restoreAccountWorkouts').disabled=true;
  if(!file)return;
  if(!verifiedOwnerId||verifiedOwnerId!==account?.id){output.textContent='Sign in to a verified account first.';return}
  if(file.size>4*1024*1024){output.textContent='Account backup exceeds 4 MB; nothing changed.';return}
  const owner=verifiedOwnerId,epoch=authEpoch;
  try{
   const data=await file.text();
   if(owner!==verifiedOwnerId||epoch!==authEpoch||owner!==account?.id)return;
   const backup=window.MLC2AccountRecovery.parse(data,owner);
   const plan=window.MLC2AccountRecovery.plan(localStorage,backup,owner);
   if(!plan.canRestore){
    output.textContent='Restore blocked: '+plan.conflicts.length+' conflicting IDs or storage limit. Existing history was not changed.';return
   }
   output.textContent=plan.missing.length+' missing workouts, '+plan.identical.length+' already present. Only missing workouts can be restored.';
   if(plan.missing.length){pendingAccountRecovery={owner,epoch,backup};$('restoreAccountWorkouts').disabled=false}
  }catch(err){output.textContent='Backup rejected: '+String(err.message||err).slice(0,160)}
 });
 $('restoreAccountWorkouts').addEventListener('click',()=>{
  const output=$('accountRecoveryStatus'),pending=pendingAccountRecovery;
  if(!pending||pending.owner!==verifiedOwnerId||pending.epoch!==authEpoch||
     pending.owner!==account?.id){output.textContent='Account changed. Select the backup again.';return}
  try{
   const plan=window.MLC2AccountRecovery.plan(localStorage,pending.backup,pending.owner);
   if(!plan.canRestore)throw Error('Records conflict or account storage limit reached');
   if(!plan.missing.length){pendingAccountRecovery=null;$('restoreAccountWorkouts').disabled=true;output.textContent='All backup workouts already exist locally.';return}
   if(!confirm('Restore '+plan.missing.length+' missing workouts for this account? Existing workouts will not be overwritten.'))return;
   // Re-check ownership and local state after the confirmation dialog.
   if(pending.owner!==verifiedOwnerId||pending.epoch!==authEpoch||
      pending.owner!==account?.id)throw Error('Account changed; restore cancelled');
   const report=window.MLC2AccountRecovery.restore(localStorage,pending.backup,pending.owner);
   pendingAccountRecovery=null;$('restoreAccountWorkouts').disabled=true;
   loadCurrentWorkouts();renderHome();renderProgress();renderHistory();if(page==='coaching')renderCoach();scheduleWorkoutSync();
   output.textContent='Restored '+report.restored+' missing account workouts. Existing data was preserved; nothing uploaded to Supabase.';
  }catch(err){output.textContent='Restore blocked: '+String(err.message||err).slice(0,160)}
 });
 async function manageOtherData(action){
  const output=$('otherFitnessCloudStatus');
  if(auxOperationBusy||workoutSyncBusy){output.textContent='Another sync is running. Try again once it finishes.';return}
  if(!verifiedOwnerId||account?.id!==verifiedOwnerId){output.textContent='Sign in to a verified account first.';return}
  const owner=verifiedOwnerId,epoch=authEpoch;
  auxOperationBusy=true;renderSettings();
  output.textContent=action==='backup'?'Checking existing private backups…':'Checking for missing fitness records…';
  try{
   const engine=auxEngine(owner);
   const result=action==='backup'?await engine.backup():await engine.restore({
    confirmRestore:labels=>{
     if(owner!==verifiedOwnerId||epoch!==authEpoch)return false;
     return confirm('Recover '+labels.join(', ')+' from your private 2.0 cloud? Only missing or empty data is filled.');
    }
   });
   if(owner!==verifiedOwnerId||epoch!==authEpoch)return;
   if(action==='backup')output.textContent=result.status==='conflict'?
    'Cloud conflict: '+result.conflicts+' categories differ. No cloud data overwritten.':
    'Other data backup: '+(result.uploaded||0)+' uploaded, '+(result.skipped||0)+' skipped, '+(result.pending||0)+' pending. Status: '+result.status+'.';
   else{
    if(result.status==='restored'){
     trackingEntries=loadLocalTracking();renderTracking();renderHome();renderWorkouts();
     window.MLC2BodyProgress?.showMeasurements();if(page==='coaching')renderCoach();
    }
    output.textContent=result.status==='restored'?'Restored '+result.restored.join(', ')+'. Existing data preserved.':
     result.status==='cancelled'?'Recovery canceled. No records changed.':'No missing fitness data found.';
   }
  }catch(err){
   if(owner===verifiedOwnerId&&epoch===authEpoch)
    output.textContent='Other fitness data '+action+' paused: '+String(err.message||err).slice(0,125)+'. Existing records preserved.';
  }finally{auxOperationBusy=false;renderSettings();if(syncAgainAfterCurrent){syncAgainAfterCurrent=false;scheduleWorkoutSync(800)}}
 }
 $('backupOtherFitnessData').addEventListener('click',()=>void manageOtherData('backup'));
 $('restoreOtherFitnessData').addEventListener('click',()=>void manageOtherData('restore'));
 $('betaAccessSelect').addEventListener('change',async valueEvent=>{
  const select=valueEvent.currentTarget,output=$('betaAccessStatus'),requested=select.value;
  const selectedOwner=verifiedOwnerId,epoch=authEpoch;
  const before=betaView().mode;
  if(betaModeSaving){select.value=before;return}
  if(!selectedOwner||selectedOwner!==account?.id){
   if(!window.MLC2BetaAccess.modes.includes(requested)){select.value=before;return}
   try{
    sessionStorage.setItem(GUEST_BETA_KEY,requested);
    output.textContent=requested.toUpperCase()+' preview enabled for this browser session. No payment required.';
    renderCoach();
   }catch{select.value=before;output.textContent='Unable to save this guest preview mode.'}
   return;
  }
  betaModeSaving=true;renderSettings();
  output.textContent='Saving '+requested.toUpperCase()+' beta preference to this account…';
  try{
   const updated=await window.MLC2BetaAccess.change({
    user:account,mode:requested,
    verify:async()=>authRequest('user',null,(await sessionRefresh.sessionFor(selectedOwner)).access_token,'GET'),
    update:async metadata=>authRequest('user',{data:metadata},(await sessionRefresh.sessionFor(selectedOwner)).access_token,'PUT'),
    stillCurrent:id=>id===verifiedOwnerId&&id===account?.id&&epoch===authEpoch
   });
   if(epoch!==authEpoch||verifiedOwnerId!==selectedOwner)return;
   const current=await authRequest('user',null,auth.access_token,'GET');
   if(epoch!==authEpoch||current?.id!==selectedOwner)return;
   account=current;auth.user=current;authStore.save(sessionStorage,localStorage,auth);
   output.textContent=updated.mode.toUpperCase()+' beta access saved. No purchase required.';
   renderCoach();
  }catch(err){
   if(epoch===authEpoch){output.textContent='Beta mode unchanged: '+String(err.message||err).slice(0,125);select.value=before}
  }finally{betaModeSaving=false;renderSettings()}
 });
 $('autoWorkoutSyncNow').addEventListener('click',()=>{scheduleWorkoutSync(0)});
 $('autoWorkoutRecover').addEventListener('click',async()=>{
  const button=$('autoWorkoutRecover'),output=$('autoWorkoutSyncStatus');
  if(!verifiedOwnerId||verifiedOwnerId!==account?.id){output.textContent='Sign in to recover account workouts.';return}
  const owner=verifiedOwnerId,epoch=authEpoch;
  button.disabled=true;
  setWorkoutSyncState('Checking isolated cloud workouts for safe recovery…');
  try{
   const result=await syncEngine(owner).restore({
    confirmRestore:count=>{
     if(owner!==verifiedOwnerId||epoch!==authEpoch)return false;
     return confirm('Restore '+count+' missing 2.0 workouts? Your existing workouts will not be replaced.');
    }
   });
   if(owner!==verifiedOwnerId||epoch!==authEpoch)return;
   if(result.status==='restored'||result.status==='restored-with-conflicts'){
    loadCurrentWorkouts();renderHome();renderProgress();renderHistory();if(page==='coaching')renderCoach();
    setWorkoutSyncState('Recovered '+result.restored+' missing cloud workouts. '+
      (result.conflicts?result.conflicts+' same-ID differences remain untouched.':'Existing history preserved.'));
   }else if(result.status==='conflict'){
    setWorkoutSyncState(result.conflicts+' same-ID workout differences need review. No workouts were overwritten or deleted.');
   }else setWorkoutSyncState(result.status==='cancelled'?'Recovery canceled; no records changed.':'All cloud workouts already present.');
  }catch(err){
   if(owner===verifiedOwnerId&&epoch===authEpoch)
    setWorkoutSyncState('Recovery paused: '+String(err.message||err).slice(0,120)+'. Local records preserved.');
  }finally{button.disabled=!verifiedOwnerId}
 });
 window.addEventListener('online',()=>{scheduleWorkoutSync(0);scheduleAuxSync(1200)});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){scheduleWorkoutSync(1000);scheduleAuxSync(1600)}});
 $('inspectCloudSessions').addEventListener('click',async()=>{
  const button=$('inspectCloudSessions'),output=$('inspectCloudSessionsStatus');
  if(!verifiedOwnerId||account?.id!==verifiedOwnerId||!auth?.access_token){
   output.textContent='Sign in and verify your account first.';return;
  }
  const owner=verifiedOwnerId,epoch=authEpoch;
  button.disabled=true;output.textContent='Checking isolated cloud records (read only)…';
  try{
   const verifier=window.MLC2VerifiedAuth.create({
    baseUrl:BACKEND,publishableKey:PUBLIC_KEY,enabled:true,
    getSession:()=>auth,fetcher:fetch
   });
   const transport=window.MLC2SupabaseTransport.create({
    baseUrl:BACKEND,publishableKey:PUBLIC_KEY,enabled:true,
    getVerifiedAuth:()=>verifier.verify(owner),fetcher:fetch
   });
   const report=await window.MLC2CloudSessionInspection.inspect({
    owner,auth:verifier,transport,local:demoSessions,
    accountStillCurrent:id=>id===verifiedOwnerId&&id===account?.id&&epoch===authEpoch
   });
   if(epoch!==authEpoch||verifiedOwnerId!==owner)return;
   output.textContent=report.cloudWorkouts+' cloud workouts available; '+
     report.cloudOnly+' not present locally; '+report.idOverlaps+
     ' matching IDs. Read-only inspection only. No workouts restored or uploaded.';
  }catch(err){
   if(epoch!==authEpoch||verifiedOwnerId!==owner)return;
   output.textContent='Read-only cloud check unavailable: '+String(err.message||err).slice(0,145)+
    '. Local history was not changed.';
  }finally{button.disabled=false}
 });
 $('authAction').addEventListener('click',()=>{if(!account){openSignIn();return}clearAuth();notice('Signed out of 2.0. Original app session remains unchanged.')});
}
$('waterDay').value=localDayString();$('weightDay').value=localDayString();
document.body.classList.add('home-active');bind();window.MLC2BodyProgress?.init();renderHome();renderWorkouts();renderLibrary();renderProgress();renderSettings();validateStoredAuth();
})();