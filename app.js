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
  const previousMode=betaView().mode;
  if(!authStore.replace(sessionStorage,localStorage,auth,session))throw Error('Account session changed in another window');
  auth=session;account=session.user;renderSettings();
  if(betaView().mode!==previousMode){renderHome();renderWorkouts();renderCoach()}
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
 const owner=verifiedOwnerId;
 const selected='mlc2-selected-workout-v1';
 const map=k=>owner&&[selected,'mlc2-weekly-schedule-v1','mlc2-schedule-library-v1'].includes(k)?k+':user:'+owner:k;
 return {
  getItem:k=>{const raw=localStorage.getItem(map(k));return owner&&k===selected&&raw===''?null:raw},
  setItem:(k,v)=>localStorage.setItem(map(k),v),
  removeItem:k=>{
   if(owner&&k===selected){localStorage.setItem(map(k),'');try{window.MLC2ScheduleAuxSync?.()}catch{}}
   else localStorage.removeItem(map(k));
  }
 };
};
const healthStorage=()=>({getItem:k=>{const scoped=['mlc2-custom-plans-v1','mlc2-local-daily-v1','mlc2-measurements-v1','mlc2-selected-workout-v1','mlc2-weekly-schedule-v1','mlc2-schedule-library-v1','mlc2-coach-readiness-v1','mlc2-weekly-goal-v1'];return localStorage.getItem(verifiedOwnerId&&scoped.includes(k)?k+':user:'+verifiedOwnerId:k)}});
let trackingEntries=loadLocalTracking();
let originalSnapshot=null;
let cloudHistorySnapshot=null; // in-memory, account-bound, original archive only
let cloudHistoryRequestId=0; // invalidates any pending read when account or view changes

let toastTimer;
let muscleFilter='';
let restSeconds=90,restPaused=true,restClock=null;
function loadDemo(){try{return window.MLC2AccountWorkouts?.read(localStorage,null)||[]}catch{return []}}
function withAccountLock(kind,owner,epoch,work){
 const guarded=()=>{
  if(owner!==verifiedOwnerId||epoch!==authEpoch)throw Error('Workout account changed');
  return work();
 };
 return navigator.locks?.request('myliftcoach2:'+kind+':'+(owner===null?'guest':'user:'+owner),guarded)??guarded();
}
function recoverInterruptedPlans(owner){
 const epoch=authEpoch;
 void (async()=>{
  try{
   const recovered=await withAccountLock('plans',owner,epoch,()=>window.MLC2Custom?.recoverPlanWrite());
   if(recovered&&epoch===authEpoch&&owner===verifiedOwnerId){
    renderHome();renderWorkouts();if(page==='coaching')renderCoach();
    scheduleAuxSync();
   }
  }catch{
   if(epoch===authEpoch&&owner===verifiedOwnerId)notice('A pending workout schedule needs review. Existing records were kept.');
  }
 })();
}
function loadCurrentWorkouts(){try{demoSessions=window.MLC2AccountWorkouts.read(localStorage,verifiedOwnerId)}catch{demoSessions=[];notice('Workout history is unreadable; it has not been overwritten.')}}
function switchWorkoutOwner(owner){
 coachAutonomousDraft=null;
 if(workoutSyncTimer!==null){clearTimeout(workoutSyncTimer);workoutSyncTimer=null}
 if(auxSyncTimer!==null){clearTimeout(auxSyncTimer);auxSyncTimer=null}
 syncAgainAfterCurrent=false;workoutSyncFailures=0;auxSyncAttempts=0;
 if(verifiedOwnerId!==owner){
  document.getElementById('sessionEditor')?.close();
  closeModal(false);closeCoachSchedule();$('calorieGoalForm')?.reset();
  for(const id of ['cloudPreviewResult','cloudAuditResult','cloudArchiveResult','inspectCloudSessionsStatus','accountRecoveryStatus','otherFitnessCloudStatus']){
   $(id)?.replaceChildren();
  }
  workoutSyncText='Checking account workout backup status…';
  auxSyncMessage='Checking account fitness backup status…';
 }
 verifiedOwnerId=owner;
 window.MLC2Custom?.setOwner(owner);recoverInterruptedPlans(owner);window.MLC2BodyProgress?.setOwner(owner);window.MLC2CoachReadiness?.setOwner(owner);
 trackingEntries=loadLocalTracking();pendingAccountRecovery=null;
 const file=$('accountRecoveryFile');if(file)file.value='';
 loadCurrentWorkouts();renderHome();renderProgress();renderWorkouts();renderHistory();renderTracking();renderSettings();
 if(page==='nutrition')renderCalorieGoal();
 if(page==='coaching')renderCoach();
 if(owner){scheduleWorkoutSync();scheduleAuxSync(2500)}
}
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
  const result=await withAccountLock('journal',owner,epoch,()=>auxEngine(owner).backup());
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
  else{
   // Backup never silently restores categories from another device.
   // Distinguish confirmed cloud backup from a missing local routine/schedule.
   const recovery=await auxEngine(owner).previewRecovery();
   if(owner!==verifiedOwnerId||epoch!==authEpoch)return;
   const wanted=recovery.missing.filter(label=>[
    'Custom workouts','Weekly workout schedule','Selected workout'
   ].includes(label));
   if(wanted.length)
    setAuxSyncMessage('Cloud data available for this device: '+wanted.join(', ')+'. Open Data & Backup → Recover missing data. Existing data will not be overwritten.');
   else setAuxSyncMessage('Up to date · '+(result.uploaded||0)+' fitness categories uploaded.');
  }
 }catch{
  if(owner!==verifiedOwnerId||epoch!==authEpoch)return;
  auxSyncAttempts=Math.min(6,auxSyncAttempts+1);
  setAuxSyncMessage('Fitness data saved locally — cloud retry scheduled.');
  scheduleAuxSync(Math.min(300000,5000*Math.pow(2,auxSyncAttempts-1)));
 }finally{
  auxOperationBusy=false;
  if(syncAgainAfterCurrent&&!workoutSyncBusy){
   syncAgainAfterCurrent=false;
   scheduleWorkoutSync(800);
  }
  renderSettings();
 }
}
function auxEngine(owner){
 if(owner!==verifiedOwnerId||owner!==account?.id||!auth?.access_token)throw Error('Verified sign-in required');
 const epoch=authEpoch;
 const verifier=window.MLC2VerifiedAuth.create({baseUrl:BACKEND,publishableKey:PUBLIC_KEY,getSession:()=>sessionRefresh.sessionFor(owner),fetcher:fetch,enabled:true});
 const transport=window.MLC2SupabaseTransport.create({baseUrl:BACKEND,publishableKey:PUBLIC_KEY,fetcher:fetch,enabled:true,getVerifiedAuth:()=>verifier.verify(owner)});
 return window.MLC2AuxCloud.create({owner,storage:localStorage,aux:window.MLC2AuxData,Sync:window.MLC2Sync,transport,verify:id=>verifier.verify(id),active:()=>epoch===authEpoch&&account?.id===verifiedOwnerId?verifiedOwnerId:null,online:()=>navigator.onLine,
  withLocalAccess:work=>withAccountLock('plans',owner,epoch,()=>{window.MLC2Custom.requireStablePlans();return work()}),
  writePlans:changes=>window.MLC2Custom.commitRecoveredPlans(changes)});
}
function syncEngine(owner){
 if(owner!==verifiedOwnerId||owner!==account?.id||!auth?.access_token)throw Error('Verified sign-in required');
 const epoch=authEpoch;
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
  active:()=>epoch===authEpoch&&verifiedOwnerId===account?.id?verifiedOwnerId:null,
  online:()=>navigator.onLine,
  withHistoryWrite:work=>withAccountLock('history',owner,epoch,work)
 });
}
async function queueWorkoutForSync(entry){
 if(!verifiedOwnerId||account?.id!==verifiedOwnerId||entry?.ownerId!==verifiedOwnerId)return;
 // When a workout upload is running, it owns an in-memory journal snapshot.
 // Never write to that journal concurrently: the in-flight flush could overwrite it.
 // The completed workout is ALREADY durably saved. A second flush rescans the
 // device and safely queues any new local workouts missing from cloud history.
 if(workoutSyncBusy){
  syncAgainAfterCurrent=true;
  setWorkoutSyncState('Workout saved locally — syncing immediately after current upload.');
  return;
 }
 const owner=verifiedOwnerId,epoch=authEpoch;
 try{
  await withAccountLock('journal',owner,epoch,()=>syncEngine(owner).queue(entry));
  if(owner!==verifiedOwnerId||epoch!==authEpoch)return;
  if(auxOperationBusy){
   syncAgainAfterCurrent=true;
   setWorkoutSyncState('Workout queued locally — syncing after fitness backup.');
   return;
  }
  setWorkoutSyncState(navigator.onLine?'Workout saved — queued for cloud sync.':'Saved offline — queued for cloud sync.');
 }catch{
  if(owner!==verifiedOwnerId||epoch!==authEpoch)return;
  setWorkoutSyncState('Workout saved locally — cloud queue requires attention.');
 }
 scheduleWorkoutSync();
}
async function runWorkoutSync(){
 if(workoutSyncBusy||auxOperationBusy){syncAgainAfterCurrent=true;return}
 if(!verifiedOwnerId||account?.id!==verifiedOwnerId)return;
 if(!navigator.onLine){setWorkoutSyncState('Offline — workouts remain saved on device.');return}
 const owner=verifiedOwnerId,epoch=authEpoch;
 workoutSyncBusy=true;setWorkoutSyncState('Checking your private workout cloud…');
 try{
  let result=await withAccountLock('journal',owner,epoch,()=>syncEngine(owner).flush());
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
  if(account?.id&&account.id!==verifiedOwnerId)return kind==='array'?[]:{};
  const keyForOwner=verifiedOwnerId?'prismAccountLocalV1:'+verifiedOwnerId+':'+key:key;
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
 const exerciseNames=new Map(libraryExercises().map(exercise=>[exercise.id,exercise.name]));
 $('legacyHistoryStatus').textContent=originalSnapshot?original.length+' original sessions available on this browser (read-only).':'Not loaded. Tap View original records to check this browser. For signed-in original records, sign in to the same account first.';
 const setCount=original.reduce((n,x)=>n+x.exercises.reduce((m,e)=>m+e.sets.length,0),0);
 $('originalHistorySummary').textContent=originalSnapshot?original.length+' workouts · '+setCount+' sets':'';
 $('originalHistoryList').innerHTML=originalSnapshot?(original.length?original.slice(0,80).map(x=>'<details class="history-entry"><summary><strong>'+escapeHTML(x.title)+'</strong><small>'+escapeHTML(formatDate(x.date))+' · '+x.exercises.length+' movements</small></summary>'+x.exercises.map(y=>'<div class="history-exercise"><b>'+escapeHTML(y.name)+'</b><small>'+y.sets.map(t=>escapeHTML(String(t.weight))+' lb × '+escapeHTML(String(t.reps))).join(' · ')+'</small></div>').join('')+'</details>').join(''):'<p class="empty-note">No original session records found in this browser. Your original app or Supabase may store them elsewhere; no data was changed.</p>'):'';
 $('detailedDemoHistory').innerHTML=demo.length?demo.slice(0,80).map(x=>'<details class="history-entry"><summary><strong>'+escapeHTML(x.title)+'</strong><small>'+escapeHTML(formatDate(x.created))+' · '+x.sets.length+' sets</small></summary>'+x.sets.map(y=>'<div class="history-exercise"><span>'+escapeHTML(exerciseNames.get(y.exerciseId)||y.exerciseId||'Exercise')+'</span><small>'+escapeHTML(String(y.weight||0))+' lb × '+escapeHTML(String(y.reps||0))+'</small></div>').join('')+'</details>').join(''):'<p class="empty-note">No 2.0 practice sessions yet. Completing a workout will add it here.</p>';
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
function renderGoalProgramSources(){
 const form=$('calorieGoalForm');
 if(!form)return;
 const source=form.elements.namedItem('programSource'),selection=form.elements.namedItem('programCustom');
 const program=window.MLC2GoalProgram?.read(localStorage,verifiedOwnerId);
 const saved=window.MLC2ProgramSource?.read(localStorage,verifiedOwnerId,program);
 const custom=window.MLC2Custom?.allPlans(plans).filter(p=>p.id.startsWith('custom-'))||[];
 selection.replaceChildren(new Option('All my custom workouts (rotate)',''));
 for(const plan of custom)selection.add(new Option(plan.title,plan.id));
 source.value=saved?.mode||'generated';
 selection.value=saved?.customId&&custom.some(p=>p.id===saved.customId)?saved.customId:'';
 $('goalProgramCustomGroup').hidden=source.value==='generated';
}
function programCustomOptions(){
 return window.MLC2Custom?.allPlans(plans).filter(p=>p.id.startsWith('custom-'))||[];
}
function programCompletedCount(program,source){
 // Use the exact validated, deduplicated history the Goals screen uses.
 // A malformed, future, or duplicated log cannot skip Coach to another day.
 const progress=window.MLC2GoalProgram?.progress(program);
 const preferences=window.MLC2CoachPreferences?.read(localStorage,verifiedOwnerId)||{days:4};
 return window.MLC2ProgramAdherence?.summary({
  program,progress,source,sessions:coachEvidence(),
  customPlans:programCustomOptions(),days:preferences.days
 })?.completed||0;
}

function goalProgramAdherence(program,progress){
 if(!program||!progress)return null;
 const source=window.MLC2ProgramSource?.read(localStorage,verifiedOwnerId,program);
 const preferences=window.MLC2CoachPreferences?.read(localStorage,verifiedOwnerId)||{days:4};
 return window.MLC2ProgramAdherence?.summary({
  program,progress,source,sessions:coachEvidence(),customPlans:programCustomOptions(),
  days:preferences.days
 })||null;
}
function renderCalorieGoal(){
 const form=$('calorieGoalForm'),out=$('calorieGoalResult');
 if(!form||!out)return;
 renderGoalProgramSources();
 const p=window.MLC2CalorieGoal?.read(localStorage,verifiedOwnerId);
 const program=window.MLC2GoalProgram?.read(localStorage,verifiedOwnerId);
 const status=$('goalProgramProgress');
 const restart=$('goalProgramRestart');if(restart)restart.hidden=!program;
 if(status)status.textContent=program?
  (()=>{const x=window.MLC2GoalProgram.progress(program);
   const adherence=goalProgramAdherence(program,x);
   const count=adherence?' · '+adherence.completed+' qualifying workouts logged · '+
    adherence.weekCompleted+' this week (goal '+adherence.weekTarget+')'+
    (adherence.missedPriorSessions?' · '+adherence.missedPriorSessions+' missed session(s) in previous weeks':''):'';
   return (x.status==='completed'?'Program completed':'Program active')+
    ' · Week '+x.week+' of '+x.totalWeeks+' · '+x.phase+' phase · Ends '+x.endDate+count+
    '. Missed sessions are never recorded as complete. Your custom routines and history remain unchanged.'})():
  'Choose a goal and a 6, 8 or 12 week program to get started.';
 if(program)form.elements.namedItem('programWeeks').value=String(program.weeks);
 if(!p){out.textContent='Enter your profile to see an estimated daily calorie target. No food tracking needed.';return}
 form.elements.namedItem('goal').value=p.goal;
 form.elements.namedItem('age').value=p.age;
 form.elements.namedItem('weightLb').value=(p.weightKg/0.45359237).toFixed(1);
 const savedHeight=window.MLC2CalorieGoal.feetInchesFromCm(p.heightCm);
 form.elements.namedItem('heightFt').value=String(savedHeight.feet);
 form.elements.namedItem('heightIn').value=String(savedHeight.inches);
 form.elements.namedItem('sex').value=p.sex;
 form.elements.namedItem('activity').value=p.activity;
 const result=window.MLC2CalorieGoal.estimate(p);
 out.textContent=result.needsReview?
  'Estimated target: '+result.target+' calories/day. This estimate is unusually low; consult a qualified clinician or dietitian before using it.':
  'Estimated goal: '+result.target+' calories/day · maintenance estimate: '+result.maintenance+' calories/day. No meals to log.';
}
function setPage(next){if(!['welcome','home','workouts','library','progress','settings','coaching','nutrition','history','tracking'].includes(next))return;page=next;
 document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==next);
 document.querySelectorAll('[data-page]').forEach(el=>{const is=el.dataset.page===next;el.classList.toggle('selected',is);el.classList.toggle('active',is);if(is)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
 $('pageTitle').textContent=({welcome:'Welcome',home:'Home',workouts:'Workouts',library:'Exercise library',progress:'Progress',settings:'More',coaching:'Coaching',nutrition:'Nutrition',history:'Workout history',tracking:'Daily tracking'})[next];
 $('sidebar').classList.remove('open');document.body.classList.toggle('welcome-view',next==='welcome');document.body.classList.toggle('home-active',next==='home');window.scrollTo({top:0,behavior:'instant'});
 if(next==='home')renderHome();if(next==='workouts')renderWorkouts();if(next==='library')renderLibrary();
 if(next==='coaching')renderCoach();if(next==='nutrition')renderCalorieGoal();if(next==='progress')renderProgress();if(next==='settings')renderSettings();if(next==='history')renderHistory();if(next==='tracking')renderTracking();
}
// Compact Progress tabs navigate through the normal page router only; no data mutations.
window.MLC2ProgressNavigate=next=>{if(next==='history'||next==='tracking')setPage(next)};
function totalSets(){return demoSessions.reduce((n,x)=>n+x.sets.length,0)}
function presetWorkouts(){
 return plans.map(plan=>window.MLC2Custom?.applyOverride(plan)||plan);
}
function nextPlan(){
 const standard=window.MLC2WeeklySchedule?.resolve({presets:presetWorkouts(),
  custom:window.MLC2Custom?.allPlans(plans).filter(p=>p.id.startsWith('custom-'))||[],
  sessionsCompleted:demoSessions.length,storage:planStorage()})||
  window.MLC2Custom?.currentPlan(plans,demoSessions.length)||plans[demoSessions.length%plans.length];
 // Explicit manual choices and weekday schedule ALWAYS win, even during an active program.
 if(standard?.scheduleSource==='manual'||standard?.scheduleSource==='weekly'||standard?.scheduleSource==='rest')return standard;
 if(window.MLC2ScheduleLibrary?.active(planStorage())?.mode==='coach'){
  const coach=coachAutonomousPlan();
  if(coach){coachAutonomousDraft=coach;return {...coach,scheduleSource:coach.scheduleSource||'program'}}
  return {id:'coach-unavailable',title:'No Coach session available',description:'Choose a saved weekly program or check your Coach settings.',ids:[],scheduleSource:'rest'};
 }
 if(betaView().mode!=='pro')return standard;
 const program=window.MLC2GoalProgram?.read(localStorage,verifiedOwnerId);
 const active=program&&window.MLC2GoalProgram.progress(program)?.status==='active';
 const source=active?window.MLC2ProgramSource?.read(localStorage,verifiedOwnerId,program):null;
 if(!source)return standard;
 const proposal=coachAutonomousPlan();
 if(!proposal)return standard;
 coachAutonomousDraft=proposal; // Let the Home start action resolve a generated session.
 return {...proposal,scheduleSource:proposal.scheduleSource||'program'};
}
function pendingWorkout(){
 try{
 const scope=window.MLC2AccountDraft.scope(localStorage,verifiedOwnerId);
 const draft=window.MLC2SessionDraft.read(scope,Date.now(),true);
 if(!draft || (draft.workoutId && (demoSessions.some(row=>row.id===draft.workoutId) ||
  window.MLC2AccountWorkouts.removed(localStorage,verifiedOwnerId).has(draft.workoutId))))return null;
 return draft;
 }catch{return null}
}
function homeConfiguration(plan){
 return SessionEditor.effective(plan,verifiedOwnerId,pendingWorkout());
}
function editSession(duringWorkout){
 const owner=verifiedOwnerId,epoch=authEpoch;
 const original=duringWorkout?null:nextHomeSession();
 const plan=duringWorkout?activePlan:homeConfiguration(original);
 if(!plan)return;
 const date=plan.sessionDate||SessionEditor.dateFor(plan);
 const key=SessionEditor.dayKey(owner,date),before=localStorage.getItem(key);
 const store=duringWorkout?activeDraftStore:window.MLC2AccountDraft.scope(localStorage,owner,{guarded:true});
 const draft=duringWorkout?null:unfinishedDraftFor(plan);
 const locked=new Set((duringWorkout?session.sets:draft?.sets||[]).map(set=>set.exerciseId));
 const custom=window.MLC2Custom,choices=custom.allPlans(plans);
 const versions=new Map(choices.filter(p=>p.id.startsWith('custom-')).map(p=>[p.id,JSON.stringify(p)]));
 const overrideVersion=custom.overrideVersion();
 const coachDays=plan.programDays||window.MLC2CoachPreferences?.read(localStorage,owner)?.days||4;
 const persist=(config,options)=>{
   store.assertCurrent();
   if(localStorage.getItem(key)!==before)throw Error('Session changed in another window. Reopen the editor.');
   if(duringWorkout && (plan!==activePlan || $('finishWorkout').disabled))throw Error('Reopen the active workout.');
   const sets=duringWorkout?session.sets:draft?.sets||[];
   if(sets.some(set=>!config.ids.includes(set.exerciseId)))throw Error('An exercise with logged sets must stay in this workout.');
   if(!duringWorkout){
    const current=nextHomeSession();
    if(SessionEditor.dateFor(current)!==date || current?.id!==original.id)
     throw Error('Schedule changed. Reopen the editor.');
   }
   const routineId=config.routineId||plan.id;
   const edited={...plan,...config,routineId,sessionDate:date,workoutId:duringWorkout?plan.workoutId:draft?.workoutId};
   const hasDraft=duringWorkout||draft;
   const draftAPI=window.MLC2SessionDraft;
   const sameAsScheduled=original&&routineId===original.id&&
    JSON.stringify({...config,routineId:undefined})===JSON.stringify(SessionEditor.configuration(original));
   const dayValue=sameAsScheduled || (options.mode==='permanent'&&routineId===original?.id)?null:
    JSON.stringify({...config,routineId,planId:original?.id});
   if(options.mode==='today'){
    if(hasDraft)draftAPI.save(store,edited,sets);
    else if(dayValue===null)localStorage.removeItem(key);
    else localStorage.setItem(key,dayValue);
   }else{
    const routine=choices.find(p=>p.id===routineId) ||
     (routineId===plan.id&&/^coach-auto-day-[1-5]$/.test(routineId)?{id:routineId,programDays:coachDays}:null);
    const sessionChange=hasDraft?{key:window.MLC2AccountDraft.scopedKey(owner),
     before:store.getItem(draftAPI.KEY),after:JSON.stringify(draftAPI.capture(edited,sets))}:
     {key,before,after:dayValue};
    custom.saveSessionRoutine({...options,routine,config,sessionChange,
     expectedVersion:routineId.startsWith('custom-')?versions.get(routineId):overrideVersion});
    if(duringWorkout)activeDraftStore=window.MLC2AccountDraft.scope(localStorage,owner,{guarded:true});
   }
   if(duringWorkout){
    const inputs=[...$('workoutLog').querySelectorAll('[data-weight],[data-reps]')].map(el=>[el.dataset.weight?'weight':'reps',el.dataset.weight||el.dataset.reps,el.value]);
    Object.assign(activePlan,edited);renderWorkoutLog();
    const coach=$('modalContent').querySelector('.live-coach-dropdown');
    if(coach)coach.outerHTML=liveCoachPreview(activePlan);
    for(const [kind,id,value] of inputs){
     const field=$('workoutLog').querySelector('[data-'+kind+'="'+CSS.escape(id)+'"]');if(field)field.value=value;
    }
   }
   renderHome();renderWorkouts();if(page==='coaching')renderCoach();
   if(options.mode!=='today')notice(options.mode==='new'?'New workout saved under Workouts.':'Future sessions updated.');
 };
 SessionEditor.show({plan,original,choices,catalog:libraryExercises(),search:searchExercises,thumbnail:approvedThumbnail,fullImage:approvedFullImage,locked,
  weekdays:window.MLC2WeeklySchedule.DAYS,
  save:(config,options)=>withAccountLock('history',owner,epoch,()=>{
   if(options.mode==='today')return persist(config,options);
   return custom.runPlanWrite(()=>{
    if(verifiedOwnerId!==owner||authEpoch!==epoch)throw Error('Workout account changed.');
    return persist(config,options);
   });
  })
 });
}
function wireWorkoutPreviewImages(root){
 if(!root)return;
 const placeholder='./assets/image-coming-approved.webp';
 for(const image of root.querySelectorAll('img[data-workout-preview-image]')){
  image.addEventListener('error',()=>{
   if(!image.getAttribute('src')?.endsWith('image-coming-approved.webp')){
    image.src=placeholder;
    image.alt='Exercise artwork temporarily unavailable';
   }
  },{once:true});
 }
}
function unfinishedDraftFor(plan){
 if(!plan?.id||!Array.isArray(plan.ids)||!plan.ids.length)return null;
 try{
  const scoped=window.MLC2AccountDraft.scope(localStorage,verifiedOwnerId);
  const draft=window.MLC2SessionDraft?.read(scoped);
  if(!draft||(!draft.sets.length&&!draft.sessionDate)||(draft.workoutId&&(demoSessions.some(row=>row.id===draft.workoutId)||
     window.MLC2AccountWorkouts?.removed(localStorage,verifiedOwnerId).has(draft.workoutId)))||draft.planId!==plan.id||
     (draft.sessionDate?draft.sessionDate!==SessionEditor.dateFor(plan):JSON.stringify(draft.ids)!==JSON.stringify(plan.ids)))return null;
  return draft;
 }catch{return null}
}
/* Home separates today's selection (which may be a rest day) from the next
   scheduled workout that can actually be started. Never rewrites the schedule. */
function nextHomeSession(today=nextPlan()){
 if(today?.scheduleSource!=='rest')return today;
 if(today.id==='coach-rest-day'){
  const date=new Date();
  for(let offset=1;offset<=7;offset++){
   const next=new Date(date);next.setDate(date.getDate()+offset);
   const plan=coachAutonomousPlan(next,true);
   if(plan?.ids?.length)return {...plan,scheduleSource:'program',daysAhead:offset,scheduledWeekday:next.getDay()};
  }
  return null;
 }
 const custom=window.MLC2Custom?.allPlans(plans).filter(p=>p.id.startsWith('custom-'))||[];
 return window.MLC2WeeklySchedule?.nextTraining({storage:planStorage(),presets:presetWorkouts(),custom})||null;
}
function renderHomeTrainingPlan(plan=nextPlan()){
 const store=planStorage();
 const state=window.MLC2ScheduleLibrary?.active(store);
 const schedule=window.MLC2WeeklySchedule?.read(store)||{};
 const known=new Set((window.MLC2Custom?.allPlans(plans)||plans).map(p=>p.id));
 const assigned=Object.values(schedule);
 const days=assigned.filter(id=>id!=='rest-day'&&known.has(id)).length;
 const profile=state?.profiles.find(p=>p.id===state.activeId);
 let count='',name='No program selected';
 if(state?.mode==='coach'||(!assigned.length&&plan?.scheduleSource==='program')){
  const coachDays=plan?.scheduleSource==='program'?plan.programDays:null;
  const configuredDays=coachDays??window.MLC2CoachPreferences?.read(localStorage,verifiedOwnerId)?.days;
  if(Number.isInteger(configuredDays)&&configuredDays>=1&&configuredDays<=7)count=configuredDays+'-day';
  name='Coach Program';
 }else if(days){
  count=days+'-day';
  name=profile?.name|| (assigned.some(id=>id.startsWith('custom-')&&known.has(id))?'Custom Program':'Weekly Program');
  name=name.replace(new RegExp('^'+count+'\\s+','i'),'');
 }else if(assigned.length===7&&assigned.every(id=>id==='rest-day')){
  count='Rest week';name=profile?.name||'Weekly Program';
 }else if(profile){
  name=profile.name;
 }
 $('metricTrainingPlanDays').textContent=count||'—';
 $('metricTrainingPlanType').textContent=name;
}
function renderHome(){
 $('metricWorkouts').textContent=demoSessions.length;
 $('metricSets').textContent=totalSets();
 const scheduled=nextPlan(), plan=homeConfiguration(scheduled), upcoming=homeConfiguration(nextHomeSession(scheduled));
 $('editDaySession').disabled=!upcoming;
 const pending=pendingWorkout();
 $('resumeOtherSession').hidden=!pending || !!unfinishedDraftFor(upcoming);
 renderHomeTrainingPlan(plan);
 $('heroStart').dataset.workoutPreview=workoutPreviewKey(plan);
 $('todayStart').dataset.workoutPreview=$('homeNextSession').dataset.workoutPreview=workoutPreviewKey(upcoming);
 const unfinished=unfinishedDraftFor(plan),upcomingDraft=unfinishedDraftFor(upcoming);
 const restDay=plan?.scheduleSource==='rest';
 $('heroStart').disabled=restDay;
 $('todayStart').disabled=$('homeNextSession').disabled=!upcoming;
 $('heroStart').innerHTML=unfinished?'Resume Workout <span aria-hidden="true">▶</span>':'Start Workout <span aria-hidden="true">▶</span>';
 $('todayStart').innerHTML=upcomingDraft?'Resume this session <span aria-hidden="true">↗</span>':restDay&&upcoming?'Start next workout <span aria-hidden="true">↗</span>':upcoming?'Begin this session <span aria-hidden="true">↗</span>':'No workout scheduled';
 $('homeNextSession').textContent=upcoming?'NEXT SESSION ↗':'NO SESSION';
 const plannedSets=plan.ids.reduce((total,id)=>total+(plan.targets?.[id]?.sets??libraryExercises().find(e=>e.id===id)?.sets??3),0);
 $('todayTitle').textContent=plan.title;$('todayDescription').textContent=restDay?plan.description:plan.ids.length+' exercises · '+plannedSets+' planned sets';
 const nextTitle=$('homeNextSessionTitle');
 if(nextTitle)nextTitle.textContent=restDay&&upcoming?'Next workout · '+window.MLC2WeeklySchedule.DAYS[upcoming.scheduledWeekday]:upcoming?'Session outline':'No upcoming workout';
 $('todayExercises').innerHTML=(upcoming?.ids||[]).map(id=>{
  const e=libraryExercises().find(x=>x.id===id)||exercises.find(x=>x.id===id);
  if(!e)return '';
  const approved=approvedThumbnail(e);
  const picture=approved||'./assets/image-coming-approved.webp';
  const alt=approved?'Approved demonstration of '+e.name:'Exercise image awaiting approval';
  const saved=upcoming?.targets?.[id]||{};
  const sets=Number.isInteger(saved.sets)?saved.sets:(e.sets||3),reps=Number.isInteger(saved.reps)?saved.reps:(e.reps||'8–12');
  return '<div class="preview-exercise"><span class="preview-exercise-picture"><img src="'+escapeHTML(picture)+'" alt="'+escapeHTML(alt)+'" loading="lazy" decoding="async" data-workout-preview-image></span><span class="preview-exercise-copy"><strong>'+escapeHTML(e.name)+'</strong><small>'+escapeHTML(String(sets))+' × '+escapeHTML(String(reps))+'</small></span></div>';
 }).join('');
 wireWorkoutPreviewImages($('todayExercises'));
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

/* Automatic Coach proposal: generated from the catalog and completed sessions.
   A user's selected custom/scheduled workout is never changed by this proposal. */
let coachAutonomousDraft=null;
function coachAutonomousPlan(date=new Date(),allowUpcoming=false){
 if(betaView().mode!=='pro'||!window.MLC2ProgramBuilder)return null;
 const sessions=coachEvidence(),catalog=libraryExercises();
 // Four days is a transparent starting default; training preferences are not inferred.
 const preferences=window.MLC2CoachPreferences?.read(localStorage,verifiedOwnerId)||{goal:'balanced',days:4,equipment:'Any'};
 const program=window.MLC2GoalProgram?.read(localStorage,verifiedOwnerId);
 const progress=program?window.MLC2GoalProgram.progress(program):null;
 if(progress?.status==='completed')return null;
 const focus=program?({strength:'strength',bulk:'muscle',maintain:'balanced',cut:'balanced'}[program.goal]):preferences.goal;
 const options={...preferences,goal:focus};
 const proposal=window.MLC2ProgramBuilder.build(catalog,sessions,options);
 const source=program?window.MLC2ProgramSource?.read(localStorage,verifiedOwnerId,program):null;
 const completed=program?programCompletedCount(program,source):sessions.filter(row=>
  typeof row.planId==='string'&&row.planId.startsWith('coach-auto-day-')).length;
 const weekday=(date.getDay()+6)%7;
 if(proposal?.status==='ready'&&proposal.days.length&&weekday>=proposal.days.length){
  if(allowUpcoming)return null;
  return {id:'coach-rest-day',title:'Rest day',description:'Recovery day on your Coach program.',ids:[],kind:'Rest',scheduleSource:'rest',programDays:proposal.days.length};
 }
 const day=proposal?.status==='ready'?proposal.days[weekday]||null:null;
 const generated=day?.exercises?.length?{id:'coach-auto-day-'+day.day,title:'Coach · Day '+day.day,
  description:'Coach-generated '+options.goal+' session'+(progress?' · Week '+progress.week+' of '+progress.totalWeeks:'')+'. Review exercises and loads before training.',
  kind:'Coach',ids:day.exercises.map(e=>e.id),day:day.day,programWeek:progress?.week||null}:null;
 const personalized=window.MLC2Custom?.applyOverride(generated,proposal?.days?.length)||generated;
 const choice=window.MLC2ProgramSource?.choose({source:source||{mode:'generated',customId:''},
  customPlans:programCustomOptions(),generated:personalized,completed})||null;
 return choice&&{...choice,programDays:proposal?.days?.length||null};
}

function coachProgramAdvice(plan){
 const program=window.MLC2GoalProgram?.read(localStorage,verifiedOwnerId);
 const progress=program&&window.MLC2GoalProgram.progress(program);
 if(!progress||progress.status!=='active'||!plan?.ids?.length)return null;
 const current=coachAutonomousPlan();
 // Never relabel an unrelated manual workout or routine as this program.
 if(!current||current.id!==plan.id)return null;
 const readiness=window.MLC2CoachReadiness?.current(plan.id)||'Normal';
 return window.MLC2Periodization?.propose({program,progress,plan,
  sessions:coachEvidence(),readiness,catalog:libraryExercises()})||null;
}
function coachAdviceText(advice){
 if(advice?.status!=='ready')return '';
 const example=advice.recommendations?.slice(0,2).map(x=>x.adjustment===0?'keep '+x.originalSets+' sets':
  x.adjustment>0?'consider '+x.sets+' sets instead of '+x.originalSets:'consider '+x.sets+' sets instead of '+x.originalSets).join(' · ');
 return 'Week '+advice.week+'/'+advice.totalWeeks+' · '+advice.phase+
  ' · '+advice.goalTarget+'. '+advice.rationale+(example?' '+example+'.':'')+
  ' Suggestions only; your routine and logged weights remain unchanged.';
}

function renderAutonomousCoach(){
 const panel=$('coachAutoPanel'),title=$('coachAutoTitle'),details=$('coachAutoDetails'),start=$('coachAutoStart');
 if(!panel||!title||!details||!start)return;
 const enabled=betaView().mode==='pro';
 panel.hidden=!enabled;
 if(!enabled){coachAutonomousDraft=null;return}
 const preferences=window.MLC2CoachPreferences?.read(localStorage,verifiedOwnerId)||{goal:'balanced',days:4,equipment:'Any'};
 const program=window.MLC2GoalProgram?.read(localStorage,verifiedOwnerId);
 const progress=program?window.MLC2GoalProgram.progress(program):null;
 for(const [key,id] of [['goal','coachAutoGoal'],['days','coachAutoDays'],['equipment','coachAutoEquipment']]){
  const field=$(id);if(field)field.value=String(preferences[key]);
 }
 const goalField=$('coachAutoGoal');
 if(goalField&&program){
  goalField.value={strength:'strength',bulk:'muscle',maintain:'balanced',cut:'balanced'}[program.goal];
  goalField.disabled=progress?.status==='active';
 }else if(goalField)goalField.disabled=false;
 coachAutonomousDraft=coachAutonomousPlan();
 if(!coachAutonomousDraft){
  title.textContent=progress?.status==='completed'?'Your program is complete':'No matching workout available';
  const source=program?window.MLC2ProgramSource?.read(localStorage,verifiedOwnerId,program):null;
  details.textContent=progress?.status==='completed'?'Your '+program.weeks+'-week program has ended. Review your progress or choose a new program under Your Calorie Goal.':
   source?.mode==='custom'?'The selected custom routine is missing or was deleted. Choose another routine under Your Calorie Goal.':
   'No matching routine is available. Check your equipment and workout source under Your Calorie Goal. Your current workout is unchanged.';
  start.disabled=true;return;
 }
 title.textContent=coachAutonomousDraft.title;
 const names=coachAutonomousDraft.ids.map(id=>libraryExercises().find(e=>e.id===id)?.name).filter(Boolean);
 const phaseAdvice=coachProgramAdvice(coachAutonomousDraft);
 details.textContent=(progress?'Week '+progress.week+' of '+progress.totalWeeks+' · '+progress.phase+' phase. ':'')+
  (coachAutonomousDraft.programSource==='custom'?'Using your original custom routine. ':'Coach-generated routine. ')+
  names.join(' · ')+' — '+preferences.days+' training days per cycle. Your chosen workout above is unchanged.'+
  (phaseAdvice?.status==='ready'?' '+coachAdviceText(phaseAdvice):'');
 start.dataset.workoutPreview=workoutPreviewKey(coachAutonomousDraft);
 start.disabled=false;
}

let pendingCoachSchedule=null;
function closeCoachSchedule(){
 pendingCoachSchedule=null;
 $('coachSchedulePanel').hidden=true;
}
function openCoachSchedule(plan){
 pendingCoachSchedule={id:plan.id,owner:verifiedOwnerId,epoch:authEpoch};
 $('coachScheduleTitle').textContent=plan.title;
 $('coachScheduleStatus').textContent='';
 $('coachSchedulePanel').hidden=false;
 setWorkoutTab('schedule');
 $('coachScheduleDay').focus();
}
async function assignCoachSchedule(){
 const pending=pendingCoachSchedule;
 if(!pending||pending.owner!==verifiedOwnerId||pending.epoch!==authEpoch){closeCoachSchedule();return}
 const allPlans=window.MLC2Custom.allPlans(plans);
 const routine=allPlans.find(plan=>plan.id===pending.id&&plan.id.startsWith('custom-'));
 if(!routine){closeCoachSchedule();notice('That routine is no longer available.');return}
 const day=Number($('coachScheduleDay').value);
 if(!confirm('Assign '+routine.title+' to '+window.MLC2WeeklySchedule.DAYS[day]+'?'))return;
 if(pending.owner!==verifiedOwnerId||pending.epoch!==authEpoch)return;
 try{
  await window.MLC2Custom.runPlanWrite(()=>{
   if(pending!==pendingCoachSchedule||pending.epoch!==authEpoch)throw Error('Schedule selection changed');
   return window.MLC2WeeklySchedule.assign(planStorage(),day,routine.id,window.MLC2Custom.allPlans(plans));
  });
  if(pending!==pendingCoachSchedule)return;
  closeCoachSchedule();renderHome();renderWorkouts();if(page==='coaching')renderCoach();
  notice('Weekly schedule updated.');
 }catch(err){$('coachScheduleStatus').textContent=err.message}
}
function renderScheduleLibrary(){
 const library=window.MLC2ScheduleLibrary,choice=$('savedScheduleChoice'),status=$('savedScheduleStatus');
 if(!library||!choice||!status)return;
 try{
  const state=library.read(planStorage()),prior=choice.value;
  choice.replaceChildren();
  const empty=document.createElement('option');
  empty.value='';empty.textContent=state.profiles.length?'Choose saved program':'No saved programs yet';choice.append(empty);
  for(const p of state.profiles){
   const option=document.createElement('option');option.value=p.id;
   option.textContent=p.name+(p.id===state.activeId&&state.mode==='weekly'?' · active':'');
   choice.append(option);
  }
  choice.value=state.profiles.some(p=>p.id===prior)?prior:state.activeId||'';
  const selected=state.profiles.find(p=>p.id===choice.value);
  $('activateSavedSchedule').disabled=!selected||(state.mode==='weekly'&&selected.id===state.activeId);
  $('saveScheduleChanges').disabled=!state.activeId;
  $('removeSavedSchedule').disabled=!selected;
  $('activateCoachMode').disabled=state.mode==='coach';
  status.textContent=state.mode==='coach'?'Coach is active. Weekly programs are saved and paused.':
   selected?.id===state.activeId?'Active weekly program: '+selected.name:
   'Select a saved program to activate it without deleting the current schedule.';
 }catch(error){
  status.textContent='Saved program library needs review: '+String(error.message||error).slice(0,120);
  for(const id of ['activateSavedSchedule','saveScheduleCopy','saveScheduleChanges','removeSavedSchedule','activateCoachMode'])$(id).disabled=true;
 }
}
async function changeScheduleLibrary(work,success){
 const owner=verifiedOwnerId,epoch=authEpoch;
 try{
  await window.MLC2Custom.runPlanWrite(()=>{
   if(owner!==verifiedOwnerId||epoch!==authEpoch)throw Error('Workout account changed.');
   return window.MLC2Custom.transactScheduleLibrary(work);
  });
  if(owner!==verifiedOwnerId||epoch!==authEpoch)return;
  renderHome();renderWorkouts();if(page==='coaching')renderCoach();
  if(success)notice(success);
 }catch(error){
  if(owner===verifiedOwnerId&&epoch===authEpoch)
   $('savedScheduleStatus').textContent='Could not switch: '+String(error.message||error).slice(0,140);
 }
}
function renderWorkouts(){ 
 renderScheduleLibrary();
 const selected=nextPlan();
 const activeId=selected?.id||'';
 const ownerReady=!!verifiedOwnerId&&account?.id===verifiedOwnerId;
 const custom=(window.MLC2Custom?.allPlans(plans)||plans).filter(p=>p.id.startsWith('custom-'));
 const presets=presetWorkouts();
 const all=[...custom,...presets],scheduleOwner=verifiedOwnerId,scheduleEpoch=authEpoch;
 const top=$('workoutTodayName'),meta=$('workoutTodayMeta'),source=$('workoutTodaySource');
 if(top)top.textContent=selected?.title||'Choose a workout';
 if(meta)meta.textContent=selected?.scheduleSource==='rest'?'Recovery day · No scheduled exercises':selected?selected.ids.length+' exercises · '+
  (selected.scheduleSource==='program'?
    (selected.programSource==='custom'?'Custom goal program':'Coach goal program'):
   selected.kind==='Custom'?'Custom routine':selected.kind==='Coach'?'Coach session':'Preset routine'):'';
 if(source)source.textContent=selected?(selected.scheduleSource==='manual'?'Selected by you':
  selected.scheduleSource==='weekly'?'From your weekly schedule':
  selected.scheduleSource==='rest'?'Rest day in your weekly program':
  selected.scheduleSource==='program'?'Part of your active goal program':'Recommended next session'):'';
 const savedDraft=unfinishedDraftFor(selected);
 if(savedDraft&&source)source.textContent+=' · '+savedDraft.sets.length+' saved set(s) ready to resume';
 const start=$('workoutTodayStart');if(start){
  start.dataset.workoutPreview=workoutPreviewKey(selected);
  start.dataset.workout=activeId;start.disabled=!activeId||selected?.scheduleSource==='rest';
  start.textContent=savedDraft?'Resume workout':'Start workout';
 }
 const guestBox=$('guestWorkoutRecovery'),guestStatus=$('guestWorkoutRecoveryStatus');
 const recoverable=ownerReady?window.MLC2Custom?.guestRecovery():null;
 if(guestBox)guestBox.hidden=!(recoverable?.available>0);
 if(guestStatus&&recoverable?.available>0)
  guestStatus.textContent=recoverable.available+' guest workout(s) available to copy to this verified account. Existing workouts will not be replaced.';
 window.MLC2WeeklySchedule?.render($('weeklySchedule'),{
  presets,custom,
  storage:planStorage(),runWrite:work=>{
   return window.MLC2Custom.runPlanWrite(()=>{
    if(scheduleOwner!==verifiedOwnerId||scheduleEpoch!==authEpoch)throw Error('Workout account changed');
    return work(window.MLC2Custom.allPlans(plans));
   });
  },onChanged:(action,plan)=>{renderHome();renderWorkouts();if(page==='coaching')renderCoach();
   if(action==='follow'){
    if(page!=='workouts')setPage('workouts');
    setWorkoutTab('today');
    notice(plan?.scheduleSource==='weekly'?'Following weekly schedule · Today: '+plan.title:'Manual selection cleared · No scheduled workout today.');
   }
  }
 });
 const weeklyMap=window.MLC2WeeklySchedule?.read(planStorage())||{};
 const scheduledDays=new Map();
 for(let day=0;day<7;day++){
  const id=weeklyMap[String(day)];
  if(!id||!all.some(p=>p.id===id))continue;
  if(!scheduledDays.has(id))scheduledDays.set(id,[]);
  scheduledDays.get(id).push(window.MLC2WeeklySchedule.DAYS[day]);
 }
 const scheduled=all.filter(p=>scheduledDays.has(p.id));
 const unscheduledCustom=custom.filter(p=>!scheduledDays.has(p.id));
 const otherPresets=presets.filter(p=>!scheduledDays.has(p.id));
 const section=(items,label,emptyMessage)=> {
  const cards=items.map(p=>{
   const imageExercise=(p.ids||[]).map(id=>libraryExercises().find(e=>e.id===id)).find(e=>e&&approvedThumbnail(e));
   const imagePath=imageExercise?approvedThumbnail(imageExercise):'./assets/image-coming-approved.webp';
   const imageAlt=imageExercise?'Approved exercise illustration of '+imageExercise.name:'Exercise illustration awaiting approval';
   const current=p.id===activeId;
   const pinned=current&&selected.scheduleSource==='manual';
   const isCustom=p.id.startsWith('custom-');
   return '<article class="workout-compact-card'+(current?' is-selected':'')+'">'+
    '<div class="workout-compact-heading"><span class="workout-compact-illustration"><img src="'+escapeHTML(imagePath)+'" alt="'+escapeHTML(imageAlt)+'" loading="lazy" decoding="async" data-workout-preview-image></span><div><h3>'+escapeHTML(p.title)+'</h3>'+
    '<p>'+p.ids.length+' exercises · '+(isCustom?'Custom':'Preset')+'</p>'+
    (scheduledDays.has(p.id)?'<p class="workout-assigned-days">Scheduled: '+escapeHTML(scheduledDays.get(p.id).join(', '))+'</p>':'')+'</div>'+
    (current?'<span class="workout-selected-tag">Today ✓</span>':'')+'</div>'+
    '<div class="workout-compact-actions">'+
    '<button type="button" class="workout-compact-start" data-workout="'+escapeHTML(p.id)+'">Start workout</button>'+
    '<button type="button" class="workout-compact-select" data-custom-select="'+escapeHTML(p.id)+'"'+(pinned?' disabled':'')+'>'+(pinned?'Selected':'Use for today')+'</button>'+
    (isCustom?'<button type="button" class="button-outline" data-custom-schedule="'+escapeHTML(p.id)+'">Schedule</button>':'')+
    (isCustom?'<button type="button" class="workout-compact-icon" data-custom-edit="'+escapeHTML(p.id)+'" aria-label="Edit '+escapeHTML(p.title)+'">Edit</button>'+
    '<button type="button" class="workout-compact-icon workout-compact-delete" data-custom-delete="'+escapeHTML(p.id)+'" aria-label="Delete '+escapeHTML(p.title)+'">Delete</button>':'')+
    '</div></article>';
  }).join('');
  return '<div class="workout-compact-section"><h3 class="workout-compact-label">'+label+'</h3>'+
   (cards||'<p class="workout-compact-empty">'+emptyMessage+'</p>')+ '</div>';
 };
 const scheduledSection=section(scheduled,'Your scheduled workouts','No workouts assigned to your weekly schedule. Choose workouts in the Schedule tab.');
 const customSection=unscheduledCustom.length?section(unscheduledCustom,'Other custom workouts',''):'';
 const otherSection=otherPresets.length?'<details class="workout-other-presets"><summary>Other available presets ('+
  otherPresets.length+') · Not in your weekly schedule</summary>'+
  section(otherPresets,'Available to add or use manually','')+'</details>':'';
 $('workoutGrid').innerHTML=scheduledSection+customSection+otherSection;
 wireWorkoutPreviewImages($('workoutGrid'));
 renderAutonomousCoach();
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
function approvedFullImage(e){
 const d=e.demonstration;
 if(!d||d.status!=='approved'||typeof d.image!=='string')return '';
 return /^assets\/exercise-demonstrations\/[A-Za-z0-9._-]+\.webp$/.test(d.image)?'./'+d.image:'';
}
function searchExercises(catalog, query, group=''){
 const search=query.trim().toLowerCase();
 return catalog.filter(e=>(!group||e.group===group)&&(e.name+' '+e.group).toLowerCase().includes(search));
}
function renderLibrary(){
 const catalog=libraryExercises();
 const status=$('approvedMediaStatus');
 if(status){
  const ready=window.MLC2_VISUALS_344_READY===true&&catalog.length===344;
  const approved=ready?catalog.filter(e=>e.demonstration?.status==='approved').length:0;
  const pending=ready?catalog.filter(e=>e.demonstration?.status==='withheld').length:catalog.length;
  status.textContent=ready?approved+' approved exercise demonstrations · '+pending+' awaiting approved artwork':'Demonstration inventory not verified in this build; exercise instructions remain available.';
 }
 const query=$('exerciseSearch').value.trim().toLowerCase();
 const matches=searchExercises(catalog,query,muscleFilter);
 document.querySelectorAll('[data-muscle]').forEach(b=>b.classList.toggle('selected',b.dataset.muscle===muscleFilter));
 $('libraryGrid').innerHTML=matches.map(e=>{
  const image=approvedThumbnail(e);
  const thumbnail=image?'<img class="library-thumb approved-thumb" src="'+escapeHTML(image)+'" alt="Starting position of '+escapeHTML(e.name)+'" loading="lazy" data-approved-thumb>':'<img class="library-thumb approved-coming-thumb" src="./assets/image-coming-approved.webp" alt="Image coming — realistic dumbbell placeholder" loading="lazy" data-approved-thumb>';
  const full=approvedFullImage(e);
  const demonstration=full?'<details class="library-full-guide"><summary>View approved exercise demonstration</summary><img src="'+escapeHTML(full)+'" alt="Approved full-size demonstration of '+escapeHTML(e.name)+'" loading="lazy" data-library-full><p class="library-image-error" hidden>Full-size demonstration unavailable in this build.</p></details>':'';
  return '<article class="library-card reference-exercise"><div class="library-media">'+thumbnail+'</div><div class="library-info"><h3>'+escapeHTML(e.name)+'</h3><p>'+escapeHTML(e.group)+' · '+escapeHTML(String(e.sets||3))+' sets · '+escapeHTML(String(e.reps||'8–12'))+' reps</p><details><summary>Technique notes</summary><p>'+escapeHTML(e.cue||'Follow correct setup and controlled movement.')+'</p></details>'+demonstration+'</div><span class="library-chevron">›</span></article>';
 }).join('')||'<p class="empty-note">No exercises match that search.</p>';
 $('libraryGrid').querySelectorAll('img[data-approved-thumb]').forEach(img=>img.addEventListener('error',()=>img.remove(),{once:true}));
 $('libraryGrid').querySelectorAll('img[data-library-full]').forEach(img=>img.addEventListener('error',()=>{
  img.hidden=true;
  const feedback=img.nextElementSibling;
  if(feedback)feedback.hidden=false;
 },{once:true}));
}
function renderProgress(){
 window.MLC2ProgressWeekly?.render($('progressWeeklyComparison'),coachEvidence().filter(s=>!s.id.startsWith('SIMULATED-COACH-')));
 window.MLC2PostWorkout?.render($('postWorkoutRecap'),demoSessions);
 const movements=new Set(demoSessions.flatMap(x=>x.sets.map(y=>y.exerciseId)));
 $('progressSessions').textContent=demoSessions.length;$('progressSets').textContent=totalSets();$('progressMovements').textContent=movements.size;
 renderProgressChart();
 const exerciseNames=new Map(libraryExercises().map(exercise=>[exercise.id,exercise.name]));
 window.MLC2Progress?.renderVolumeAudit($('progressVolumeAudit'),demoSessions,id=>exerciseNames.get(id)||id);
 window.MLC2Progress?.renderRecords($('demoRecords'),demoSessions,'demo',(id)=>libraryExercises().find(e=>e.id===id)?.name||id);
 window.MLC2Progress?.renderRecords($('legacyRecords'),originalSnapshot?.sessions||[],'original',(id,name)=>libraryExercises().find(e=>e.id===id)?.name||name);
 $('legacyRecordsNote').textContent=originalSnapshot?'Read-only snapshot from original device storage.':'Tap View original records in Workout History to load a local read-only snapshot. No cloud data is queried.';
 $('sessionHistory').innerHTML=demoSessions.length?demoSessions.map(x=>'<div class="recent-item"><div><strong>'+escapeHTML(x.title)+'</strong><small>'+new Date(x.created).toLocaleString()+'</small></div><span>'+x.sets.length+' sets</span></div>').join(''):'<div class="empty-note">No completed workouts yet. Open Workouts to start your first session.</div>';
}
function renderProgressChart(){
 const root=$('progressChart');if(!root)return;
 const rows=demoSessions.slice(0,8).reverse();
 if(!rows.length){root.innerHTML='<div class="chart-empty">Your volume chart will appear after your first completed workout.<span>No invented progress numbers.</span></div>';return;}
 const values=rows.map(x=>window.MLC2Progress?.volumeTotal(x.sets)||0);
 const peak=Math.max(1,...values),count=values.length;
 const xy=values.map((n,i)=>({x:22+(i*(276/Math.max(1,count-1))),y:175-(n/peak)*142}));
 const points=xy.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
 const fill='22,184 '+points+' '+xy[xy.length-1].x.toFixed(1)+',184';
 root.innerHTML='<svg viewBox="0 0 320 220" role="img" aria-label="Training volume trend based on '+count+' locally saved completed workouts"><defs><linearGradient id="volumeFill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#f6d88c" stop-opacity=".48"/><stop offset="1" stop-color="#f6d88c" stop-opacity=".02"/></linearGradient></defs><path d="M22 28 V184 H304" fill="none" stroke="#bbdfd2" stroke-opacity=".35"/><path d="M22 80 H304 M22 132 H304" fill="none" stroke="#bbdfd2" stroke-opacity=".2"/><polygon points="'+fill+'" fill="url(#volumeFill)"/><polyline points="'+points+'" fill="none" stroke="#ffe1a0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+xy.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="3.5" fill="#ffeba8"/>').join('')+'<text x="25" y="207" fill="#c9e5da" font-size="11">Earliest</text><text x="293" y="207" text-anchor="end" fill="#c9e5da" font-size="11">Latest</text></svg><p>'+count+' practice sessions · '+Math.round(values[values.length-1]).toLocaleString()+' lb-reps last session</p>';
}
function renderCoach(){
 const selected=nextPlan(),catalog=libraryExercises(),history=coachEvidence();
 const mode=betaView();
 const pro=mode.mode==='pro';
 document.querySelectorAll('[data-pro-coach]').forEach(el=>{el.hidden=!pro});
 const note=$('coachFreeNotice');if(note)note.hidden=pro;
 if(pro){
  const coachOwner=verifiedOwnerId,coachEpoch=authEpoch;
  window.MLC2Coach?.render($('coachSuggestions'),history,catalog);
  window.MLC2Coach?.renderTools($('coachSubstitutions'),catalog,selected);
  window.MLC2ProgramBuilder?.render($('coachProgramBuilder'),catalog,history,{
   mode:'pro',initial:window.MLC2CoachPreferences?.read(localStorage,verifiedOwnerId),
   onSaveDay:day=>{
    return window.MLC2Custom.runPlanWrite(()=>{
     if(coachOwner!==verifiedOwnerId||coachEpoch!==authEpoch||betaView().mode!=='pro')throw Error('Pro beta access is required for this account.');
     const saved=window.MLC2Custom?.saveCoachDay(day);
     if(!saved)throw Error('Could not save Coach workout');
     renderHome();renderWorkouts();return saved;
    });
   }
  });
  window.MLC2CoachPlan?.render($('coachPlanPreview'),selected,catalog,history,{
   mode:'pro',readiness:window.MLC2CoachReadiness?.current(selected.id)||'Normal',
   coach:window.MLC2Coach,
   onOpenWorkout:id=>{
    if(betaView().mode!=='pro')return;
    if(workoutPreviewKey(nextPlan())!==workoutPreviewKey(selected)){notice('Your workout selection changed. Review Today first.');renderCoach();return}
    openWorkout(id);
   }
  });
 }else{
  for(const id of ['coachSuggestions','coachSubstitutions','coachProgramBuilder','coachPlanPreview'])$(id)?.replaceChildren();
 }
 window.MLC2Coach?.renderNextWorkout($('coachNextWorkout'),selected,history,catalog);
 window.MLC2Coach?.renderTechnique($('coachTechnique'),selected,catalog);
 const updateCoachPlan=()=>{
  const currentHistory=coachEvidence();
  window.MLC2CoachTrends?.render($('coachTrends'),currentHistory,
   window.MLC2CoachReadiness?.weeklyGoal()??4);
  if(betaView().mode!=='pro')return;
  if(nextPlan()?.id!==selected.id){renderCoach();return}
  window.MLC2CoachPlan?.render($('coachPlanPreview'),selected,catalog,coachEvidence(),{
   mode:'pro',readiness:window.MLC2CoachReadiness?.current(selected.id)||'Normal',
   coach:window.MLC2Coach,
   onOpenWorkout:id=>{
    if(betaView().mode!=='pro'||workoutPreviewKey(nextPlan())!==workoutPreviewKey(selected)){notice('Workout selection changed. Review Today first.');return}
    openWorkout(id);
   }
  });
  if(page==='workouts')renderAutonomousCoach();
 };
 window.MLC2CoachReadiness?.render($('coachReadiness'),history,selected,updateCoachPlan);
 window.MLC2CoachTrends?.render($('coachTrends'),history,window.MLC2CoachReadiness?.weeklyGoal()??4);
}
function canViewAdvancedTools(owner, user){
 return Boolean(owner&&owner===user?.id&&user.app_metadata?.myliftcoach_advanced_tools===true);
}
function renderSettings(){
 const advanced=$('advancedTools');
 if(advanced){
  advanced.hidden=!canViewAdvancedTools(verifiedOwnerId,account);
  if(advanced.hidden||advanced.dataset.owner!==verifiedOwnerId)advanced.open=false;
  advanced.dataset.owner=advanced.hidden?'':verifiedOwnerId;
 }
 $('accountIdentity').textContent=account?.email?account.email+' · authenticated (production workout data is not loaded)':'Not signed in. You can still explore the demo.';
 $('backendStatus').textContent=account?'AUTHENTICATED':'NOT CONNECTED';
 $('cloudPill').textContent=verifiedOwnerId&&account?.id===verifiedOwnerId?'ACCOUNT CONNECTED · 2.0 SYNC':'DEMO WORKSPACE';
 $('authAction').textContent=account?'Sign out':'Sign in with existing account';
 if($('authCreateAction'))$('authCreateAction').hidden=!!account;
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
function openModal(content){
 const modal=$('modal'),close=$('closeModal'),panel=modal.querySelector('.modal-panel');
 $('modalContent').innerHTML=content;
 if($('modalContent').querySelector('.active-workout-header')){
  // Keep the close button outside the scrolling workout panel so iOS cannot clip it.
  modal.appendChild(close);
  modal.classList.add('workout-close-overlay');
 }else{
  panel.prepend(close);
  modal.classList.remove('workout-close-overlay');
 }
 modal.hidden=false;document.body.style.overflow='hidden';close.focus();
}
function closeModal(refresh=true){
 if(!activePlan||refresh===false)return closeModalForOwner(refresh);
 const plan=activePlan,owner=activeDraftOwner,epoch=authEpoch;
 void (async()=>{
  try{
   await withAccountLock('history',owner,epoch,()=>{
    if(plan===activePlan)closeModalForOwner(refresh);
   });
  }catch{if(epoch===authEpoch)notice('The workout is still open. Try closing again.')}
 })();
}
function closeModalForOwner(refresh){
 const hadWorkout=!!activePlan;
 if(hadWorkout&&refresh){
  if($('finishWorkout')?.disabled)return;
  try{window.MLC2SessionDraft.save(activeDraftStore,activePlan,session.sets)}
  catch(error){
   if(error.code!=='STALE_DRAFT'){notice('Draft could not be saved. Your workout is still open for retry.');return}
   notice('Kept the newer draft from another window. Reopen the workout to continue.');
  }
 }
 $('modal').releaseViewport?.();
 previewCoachHistory=null;closeRest();
 $('modal').hidden=true;$('modal').classList.remove('auth-fullscreen','workout-close-overlay');
 $('modal').querySelector('.modal-panel').prepend($('closeModal'));
 $('modalContent').replaceChildren();
 document.body.style.overflow='';
 activePlan=null;session=null;activeDraftStore=null;activeDraftOwner=null;
 if(hadWorkout&&refresh){renderHome();renderWorkouts()}
}


/* Strictly isolated, RAM-only Coach demo history for the independent iPhone preview.
   Never enters demoSessions, workout drafts, progress, or the cloud sync journal. */
const isCoachTestPreview=()=>typeof location!=='undefined'&&/(?:^|\/)coach-live-test(?:\/|$)/.test(location.pathname||'');
let previewCoachHistory=null;
function coachEvidence(){
 if(isCoachTestPreview()&&previewCoachHistory)return previewCoachHistory;
 // Completed 2.0 sessions are loaded through account-scoped storage.
 // Never admit a synthetic sample into personal progression calculations.
 const now=Date.now();
 return demoSessions.filter(row=>row&&typeof row.id==='string'&&
  !row.id.startsWith('SIMULATED-COACH-')&&
  (verifiedOwnerId===null?!row.ownerId:row.ownerId===verifiedOwnerId)&&
  Number.isFinite(Date.parse(row.created))&&Date.parse(row.created)<=now&&
  Array.isArray(row.sets)&&row.sets.some(set=>set?.exerciseId&&window.MLC2WorkoutUX.validSet(set,set.exerciseId)));
}
function coachEvidenceLabel(){
 if(isCoachTestPreview()&&previewCoachHistory)
  return 'SIMULATED TEST DATA · '+previewCoachHistory.length+' example sessions; not your workout history';
 const rows=coachEvidence();
 return rows.length?
  rows.length+' saved 2.0 workout'+(rows.length===1?'':'s')+' · personal history only':
  'No saved 2.0 workout history · Coach will learn as you log sessions';
}
function generatePreviewCoachHistory(plan){
 if(!isCoachTestPreview()||!plan?.ids?.length)return [];
 const catalog=libraryExercises();
 return [0,1].map(n=>({
  id:'SIMULATED-COACH-'+n,planId:plan.id,title:'SIMULATED Coach evidence',
  created:n===0?'2026-11-12T12:00:00Z':'2026-11-19T12:00:00Z',
  sets:plan.ids.flatMap(id=>{
   const e=catalog.find(x=>x.id===id)||exercises.find(x=>x.id===id);
   if(!e||e.group==='Cardio')return [];
   // Two sets per session at the same load. The latest session reaches the
   // Coach engine's default 8-10 rep range, enabling a sample increase.
   return [0,1].map(()=>({exerciseId:id,weight:50,reps:n===0?8:10}));
  })
 }));
}
function coachTestControls(){
 if(!isCoachTestPreview())return '';
 return '<div class="coach-test-tools" role="group" aria-label="Simulated Coach history controls">'+
 '<strong>SIMULATED COACH TEST DATA</strong><p>Use two fictional completed sessions to test weight recommendations. This is not your real workout history.</p>'+
 '<button type="button" data-coach-test="load">Load sample Coach history</button>'+
 '<button type="button" data-coach-test="clear">Clear sample Coach history</button>'+
 '<small>Preview-only memory. Refreshing clears sample evidence; no workout history, draft, or cloud account is changed.</small></div>';
}
function toggleCoachTestHistory(action){
 if(!isCoachTestPreview()||!activePlan||!session)return;
 if(session.sets.length){notice('Finish or exit the current practice sets before changing test history.');return}
 if(action==='load')previewCoachHistory=generatePreviewCoachHistory(activePlan);
 else if(action==='clear')previewCoachHistory=null;
 else return;
 const old=document.querySelector('.live-coach-dropdown');
 const opened=Boolean(old?.open);
 const replacement=document.createElement('div');replacement.innerHTML=liveCoachPreview(activePlan);
 if(old){const next=replacement.firstElementChild;next.open=opened;old.replaceWith(next)}
 renderWorkoutLog();
 notice(action==='load'?'SIMULATED Coach history loaded for this preview only.':'SIMULATED Coach history cleared.');
}

function liveCoachSuggestion(id){
 const catalog=libraryExercises(),e=catalog.find(x=>x.id===id)||exercises.find(x=>x.id===id);
 if(betaView().mode!=='pro')return {e,message:'Free beta mode: follow your planned targets. Pro enables progression advice.'};
 if(e?.group==='Cardio')return {e,message:'Follow your planned cardio targets and adjust effort as needed.'};
 const v=window.MLC2Coach?.suggestion(id,coachEvidence(),catalog);
 const phase=coachProgramAdvice(activePlan);
 if(v?.status==='ready'&&v.action==='increase'&&phase?.status==='ready'&&!phase.allowLoadIncrease){
  const safe=Number(v.lastWeight);
  return {e,advice:Number.isFinite(safe)&&safe>0?{...v,action:'hold',weight:safe,
   reason:'Program recovery guidance: hold the last completed working weight.'}:{status:'insufficient'},
   message:'Recovery phase: do not increase load. Keep your most recent working weight only if comfortable.'};
 }
 return {e,advice:v,message:v?.status==='ready'?v.action.toUpperCase()+' · '+v.weight+' lb suggested. '+v.reason :'Log more completed working sets to unlock weight progression.'};
}
function liveCoachPreview(plan){
 const readiness=window.MLC2CoachReadiness?.current(plan.id)||'Normal';
 const status=readiness==='Tired'?'Tired · Lower the effort or rest if needed.':readiness==='Great'?'Great · Progress carefully with good form.':'Normal · Follow your plan and adjust to comfort.';
 const review=plan.ids.map(id=>({id,...liveCoachSuggestion(id)})).filter(row=>row.e);
 const ready=review.filter(row=>row.advice?.status==='ready').length;
 const summary=ready?ready+' weight recommendation'+(ready===1?'':'s')+' available':'Workout guidance';
 const rows=review.map(({id,e,message})=>'<div><strong>'+escapeHTML(e.name)+'</strong><small>'+escapeHTML(String(plan.targets?.[id]?.sets??e.sets??3))+' sets × '+escapeHTML(String(plan.targets?.[id]?.reps??e.reps??'8–12'))+' reps</small><p>'+escapeHTML(message)+'</p></div>').join('');
 const phase=coachProgramAdvice(plan);
 const phaseLabel=phase?.status==='ready'?'<p class="live-coach-phase">'+escapeHTML(coachAdviceText(phase))+'</p>':'';
 return '<details class="live-coach-box live-coach-dropdown" aria-label="Coach before workout">'+
 '<summary class="live-coach-dropdown-toggle"><span class="live-coach-dropdown-heading"><strong>✦ Coach · Before you start</strong><small>'+escapeHTML(summary)+'</small></span><span class="live-coach-dropdown-side"><span class="live-coach-mode">'+escapeHTML(betaView().mode.toUpperCase())+'</span><span class="live-coach-chevron" aria-hidden="true">⌄</span></span></summary>'+
 '<div class="live-coach-dropdown-content"><p class="live-coach-evidence-source">'+escapeHTML(coachEvidenceLabel())+'</p>'+phaseLabel+'<p class="live-coach-readiness">'+escapeHTML(status)+'</p><div class="live-coach-list">'+rows+'</div>'+
 '<small>Your chosen workout and logged values never change automatically.</small></div></details>';
}

function liveCoachFeedback(id){
 const {e,message,advice}=liveCoachSuggestion(id);
 const sets=session?.sets?.filter(x=>x.exerciseId===id)||[];
 if(!sets.length)return (advice?.status==='ready')?message:'✦ Coach ready · Log a set for feedback.';
 const latest=sets[sets.length-1],range=String(e?.reps||'').match(/(\d+)\s*[–-]\s*(\d+)/);
 const target=activePlan?.targets?.[id]?.reps;
 const lo=target??(range?Number(range[1]):null),hi=target??(range?Number(range[2]):null);
 const feedback=lo!==null&&latest.reps<lo?'Last set below target reps; consider reducing load or resting if needed.':hi!==null&&latest.reps>hi?'Last set above target reps; future increases require completed-session history.':'Last set within the planned rep range. Keep form controlled.';
 return message+' '+feedback+(window.MLC2CoachReadiness?.current(activePlan?.id)==='Tired'?' Readiness is Tired: do not force a progression.':'');
}
function liveCoachRecap(history){
 const v=window.MLC2PostWorkout?.summarize(history);
 if(!v?.hasHistory)return '';
 return '<section class="live-coach-box" role="status"><div class="live-coach-title"><strong>✦ Coach · Workout recap</strong></div><p>'+v.current.sets+' weighted working sets across '+v.current.movements+' exercises saved.</p>'+
 (v.previous?'<p>'+escapeHTML(String(Math.round(v.deltaVolume)))+' lb volume difference from your previous saved session of the same workout. '+v.improvedExercises+' exercises improved their top logged weight.</p>':'<p>No previous completed session of this exact workout is available for comparison.</p>')+
 '<p>Future recommendations will reflect completed history. No workout plan was changed automatically.</p></section>';
}

function applyCoachWeight(id){
 if(!session||!activePlan?.ids.includes(id))return false;
 if(activeDraftOwner!==verifiedOwnerId){notice('Account changed; restart this workout before applying a Coach suggestion.');return false}
 if(betaView().mode!=='pro'){notice('Pro beta is required for weight recommendations.');return false}
 const result=liveCoachSuggestion(id).advice;
 const weight=Number(result?.weight);
 if(result?.status!=='ready'||!Number.isFinite(weight)||weight<=0||weight>1500){notice('No verified weight recommendation is available for this exercise.');return false}
 const card=[...document.querySelectorAll('[data-exercise-card]')].find(el=>el.dataset.exerciseCard===id);
 const input=card?.querySelector('[data-weight]');
 if(!input){notice('Weight input is unavailable for this exercise.');return false}
 // Explicit opt-in edits only the next unlogged set field. It does not save, complete, or overwrite a set.
 input.value=String(weight);
 const status=card.querySelector('[data-coach-applied]');
 if(status)status.textContent='Suggested '+weight+' lb filled in. Review it before logging the next set.';
 return true;
}

function workoutPreviewKey(plan){
 return plan?JSON.stringify([plan.id,plan.title,plan.ids,plan.programWeek,plan.ids.map(id=>{
  const target=plan.targets?.[id];
  return [target?.sets,target?.reps,target?.weight,target?.restSeconds];
 })]):'';
}
function startPreviewWorkout(button,resolve){
 loadCurrentWorkouts();
 const home=['heroStart','todayStart','homeNextSession'].includes(button.id);
 const plan=home?homeConfiguration(resolve()):resolve();
 if(!plan||plan.scheduleSource==='rest'){notice('Today is a rest day. Choose a workout manually if you want to train.');return}
 if(button.dataset.workoutPreview!==workoutPreviewKey(plan)){
  renderHome();renderWorkouts();
  notice('Your workout selection changed. Review the updated workout before starting.');
  return;
 }
 openWorkout(plan.id,home?plan:null);
}
function openWorkout(id,preview=null,resumeId=null){
 const owner=verifiedOwnerId,epoch=authEpoch;
 void (async()=>{
  try{await withAccountLock('history',owner,epoch,()=>openWorkoutForOwner(id,preview,resumeId))}
  catch{if(epoch===authEpoch)notice('Could not open the workout. Check browser storage and try again.')}
 })();
}
function openWorkoutForOwner(id,preview=null,resumeId=null){
 if(activePlan)return;
 $('modal').classList.remove('auth-fullscreen');
 const workoutStartedOwner=verifiedOwnerId;
 // A Coach recommendation is ephemeral: never trust a cached plan after
 // account, beta entitlement, training preferences, or history changes.
 const selected=(window.MLC2Custom?.allPlans(plans)||plans).find(x=>x.id===id);
 const freshCoach=!selected&&betaView().mode==='pro'?coachAutonomousPlan():null;
 const requested=resumeId?pendingWorkout():null;
 if(resumeId && (!requested || requested.planId!==id || (requested.workoutId||requested.planId)!==resumeId)){
  renderHome();notice('The saved workout changed. Review the latest session.');return;
 }
 let plan=selected||(freshCoach?.id===id?freshCoach:null);
 if(requested)
  plan={id,title:requested.title,description:'Unfinished session',ids:requested.ids,targets:requested.targets||{},routineId:requested.routineId,programDays:requested.programDays};
 if(preview && plan){
  const current=homeConfiguration(nextHomeSession());
  if(workoutPreviewKey(current)!==workoutPreviewKey(preview)){notice('Session changed. Review the Home outline.');return}
  plan={...plan,...current};
 }
 if(!plan){notice('That workout is no longer available. Review your current selection and try again.');return}
 if(freshCoach&&plan===freshCoach)coachAutonomousDraft=freshCoach;
 const draftAPI=window.MLC2SessionDraft;
 const draftStore=window.MLC2AccountDraft.scope(localStorage,workoutStartedOwner,{guarded:true});
 let other=draftAPI?.read(draftStore,Date.now(),true);
 loadCurrentWorkouts();
 if(other?.workoutId&&(demoSessions.some(row=>row.id===other.workoutId)||
    window.MLC2AccountWorkouts.removed(localStorage,workoutStartedOwner).has(other.workoutId))){
  try{draftAPI.clear(draftStore,other.planId,other.workoutId)}catch{notice('Could not clear a completed draft. Check browser storage.');return}
  other=null;
 }
 if(!other && draftStore.getItem(draftAPI.KEY)!==null && !confirm('The saved draft cannot be opened. Cancel to keep it, or confirm to replace it with a new session.'))return;
 const match=other?.planId===id && (requested || (other.sessionDate?other.sessionDate===SessionEditor.dateFor(plan):JSON.stringify(other.ids)===JSON.stringify(plan.ids)));
 if(other&&!match){
  if(!confirm('An unfinished workout has '+other.sets.length+' saved sets. Start this session and discard that saved draft?'))return;
 }
 if(match)plan={...plan,title:other.title||plan.title,ids:[...other.ids],targets:other.targets||plan.targets,routineId:other.routineId||plan.routineId,programDays:other.programDays||plan.programDays,sessionDate:other.sessionDate||SessionEditor.dateFor(plan)};
 const restoredSets=match?draftAPI?.resume(draftStore,plan,Date.now(),true)||[]:[];
 const workoutId=(match&&other?.workoutId)||'demo-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
 activePlan={...plan,workoutId,sessionDate:plan.sessionDate||SessionEditor.dateFor(plan)};activeDraftStore=draftStore;activeDraftOwner=workoutStartedOwner;
 session={sets:restoredSets};
 try{draftAPI?.save(draftStore,activePlan,session.sets)}
 catch(error){
  if(error.code==='STALE_DRAFT'){activePlan=null;session=null;activeDraftStore=null;activeDraftOwner=null;notice(error.message);return}
  notice('This browser could not save the workout draft. Use Finish session to save completed sets.');
 }
 openModal('<div class="active-workout-scroll"><div class="active-workout-header"><span class="modal-eyebrow">ACTIVE WORKOUT · 2.0 BETA</span><h2>'+escapeHTML(plan.title)+'</h2><p>'+escapeHTML(plan.description)+'</p><div class="active-workout-progress" id="activeWorkoutProgress" role="status" aria-live="polite"></div>'+ (restoredSets.length?'<p class="active-resume-confirmation" role="status">Resumed workout · '+restoredSets.length+' saved set'+(restoredSets.length===1?'':'s')+' restored. Finish workout when you are done.</p>':'')+'</div>'+liveCoachPreview(plan)+coachTestControls()+'<div class="active-workout-toolbar"><button id="editActiveSession" class="button-outline" type="button">Edit workout</button><label class="active-rest-toggle"><input type="checkbox" id="autoRestToggle"> Auto rest after each set</label><button type="button" class="button-outline" id="startRest">Rest 1:30</button></div><div id="workoutLog" class="workout-log"></div></div><div class="modal-footer active-workout-footer"><button type="button" class="button-outline" id="cancelWorkout">Save draft &amp; exit</button><button type="button" class="button-primary" id="finishWorkout">Finish workout</button></div>');
 renderWorkoutLog();
 for(const exerciseId of plan.ids)updateExerciseFeedback(exerciseId);
 $('editActiveSession').onclick=()=>editSession(true);
 const viewport=window.visualViewport;
 if(viewport){
  const modal=$('modal');
  const size=()=>{modal.style.setProperty('--workout-height',viewport.height+'px');modal.style.setProperty('--workout-top',viewport.offsetTop+'px')};
  size();window.addEventListener('resize',size);viewport.addEventListener('resize',size);viewport.addEventListener('scroll',size);
  modal.releaseViewport=()=>{window.removeEventListener('resize',size);viewport.removeEventListener('resize',size);viewport.removeEventListener('scroll',size)};
 }
 $('cancelWorkout').addEventListener('click',closeModal);
 $('startRest').addEventListener('click',openRest);
 $('finishWorkout').addEventListener('click',async event=>{
  if(workoutStartedOwner!==verifiedOwnerId){notice('Account changed during this workout. Return to the original account or restart before saving.');return}
  // Persist history first, then clear the exact draft from this window.
  const button=event.currentTarget,epoch=authEpoch,draftStore=activeDraftStore;
  button.disabled=true;
  let proposed;
  try{
   proposed=await withAccountLock('history',workoutStartedOwner,epoch,()=>{
    if(!session?.sets.length){notice('Add at least one practice set first.');return null}
    draftStore.assertCurrent();
    const entry={id:workoutId,created:new Date().toISOString(),title:plan.title,planId:plan.id,
     sets:session.sets.map(set=>({...set})),...(workoutStartedOwner?{ownerId:workoutStartedOwner}:{})};
    const next=window.MLC2AccountWorkouts.complete(localStorage,workoutStartedOwner,entry);
    try{window.MLC2SessionDraft?.clear(draftStore,plan.id,workoutId)}catch{}
    return next;
   });
  }catch(error){
   if(epoch===authEpoch)notice(error.code==='STALE_DRAFT'?'This workout changed in another window. Reopen the latest saved draft.':'Could not save the session; it stays open for retry. Check browser storage.');
   return;
  }finally{button.disabled=false}
  if(!proposed)return;
  if(epoch!==authEpoch)return;
  demoSessions=proposed;
  queueWorkoutForSync(proposed.find(row=>row.id===workoutId));
  if($('finishWorkout')!==button){renderHome();renderProgress();return}
  closeModal(false);renderHome();setPage('progress');
  notice(verifiedOwnerId?'Workout saved on this device. Account backup will sync when connected.':'Workout saved on this device.');
  if(betaView().mode==='pro')openModal(liveCoachRecap(proposed));
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
  const defaults=ux?.defaults(id,session.sets,demoSessions,activePlan.id)||{weight:'',reps:''};
  const optional=activePlan.targets?.[id]||{};
  const targetSets=Number.isInteger(optional.sets)?optional.sets:e.sets||3;
  const targetReps=Number.isInteger(optional.reps)?optional.reps:e.reps||'8–12';
  const targetExtra=[Number.isFinite(optional.weight)?'Target weight: '+optional.weight+' lb':'',Number.isInteger(optional.restSeconds)?'Rest: '+optional.restSeconds+' sec':''].filter(Boolean);
  const targetSummary=targetExtra.length?'<span class="active-optional-targets">'+escapeHTML(targetExtra.join(' · '))+'</span>':'';
  const suggestedWeight=Number.isFinite(optional.weight)?String(optional.weight):defaults.weight;
  const suggestedReps=Number.isInteger(optional.reps)?String(optional.reps):defaults.reps;
  const previousText=last?'Last workout: '+last.weight+' lb × '+last.reps+' reps':'No previous session for this workout';
  const coach=betaView().mode==='pro'&&e.group!=='Cardio'?liveCoachSuggestion(id).advice:null;
  const coachHint=coach?.status==='ready'?
   '<p class="active-coach-hint"><strong>✦ Coach</strong> '+escapeHTML(coach.action.toUpperCase()+': '+coach.weight+' lb suggested')+' · '+escapeHTML(coach.reason)+' <small>Optional · no weights changed</small><button type="button" class="coach-apply-weight" data-coach-apply="'+escapeHTML(id)+'">Use '+escapeHTML(String(coach.weight))+' lb for next set</button><span class="coach-applied-note" data-coach-applied="'+escapeHTML(id)+'" role="status"></span></p>':'';
  const count=logged.length;
  return '<article class="log-card active-log-card" data-exercise-card="'+escapeHTML(id)+'"><div class="log-title"><div class="active-exercise-heading"><span class="active-exercise-index">'+(i+1)+'</span><h4>'+escapeHTML(e.name)+'</h4></div><span class="logged-count" data-count="'+escapeHTML(id)+'">'+count+' logged</span></div><div class="active-exercise-context"><span>Target: '+escapeHTML(String(targetSets))+' × '+escapeHTML(String(targetReps))+'</span>'+targetSummary+'<span class="active-previous">'+escapeHTML(previousText)+'</span></div>'+coachHint+'<div class="active-set-header"><span>SET</span><span>PREVIOUS</span><span>WEIGHT</span><span>REPS</span><span>DONE</span></div><div class="active-set-rows" data-set-rows="'+escapeHTML(id)+'"></div><div class="inputs active-set-entry"><span class="active-entry-number" data-next-set="'+escapeHTML(id)+'">'+(count+1)+'</span><span class="active-prev-mini">'+(last?escapeHTML(last.weight+' × '+last.reps):'—')+'</span><label><span class="sr-only">Weight (lb)</span><input aria-label="'+escapeHTML(e.name)+' weight in pounds" type="number" min="0" max="1500" step="2.5" inputmode="decimal" data-weight="'+escapeHTML(id)+'" value="'+escapeHTML(String(suggestedWeight??''))+'" placeholder="lb"></label><label><span class="sr-only">Reps</span><input aria-label="'+escapeHTML(e.name)+' repetitions" type="number" min="1" max="100" step="1" inputmode="numeric" data-reps="'+escapeHTML(id)+'" value="'+escapeHTML(String(suggestedReps??''))+'"></label><button class="active-complete-set" data-addset="'+escapeHTML(id)+'" type="button" aria-label="Complete set for '+escapeHTML(e.name)+'">✓</button></div><div class="live-coach-set" data-live-coach="'+escapeHTML(id)+'" aria-live="polite">'+escapeHTML(liveCoachFeedback(id))+'</div><div class="active-card-actions"><span class="set-feedback" data-feedback="'+escapeHTML(id)+'" role="status" aria-live="polite"></span><button class="undo-set" data-undo="'+escapeHTML(id)+'" type="button" hidden>Undo last set</button></div></article>';
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
 const coachText=card.querySelector('[data-live-coach]');if(coachText)coachText.textContent=liveCoachFeedback(id);
 if(rows){
  rows.innerHTML=sets.map((set,i)=>'<div class="active-logged-row"><span>'+(i+1)+'</span><span>—</span><strong>'+escapeHTML(String(set.weight))+' lb</strong><strong>'+escapeHTML(String(set.reps))+'</strong><span class="active-done-check" aria-label="Set completed">✓</span></div>').join('');
 }
 const next=card.querySelector('[data-next-set]');if(next)next.textContent=sets.length+1;
 updateWorkoutProgress();
}
function addSet(id){
 if($('finishWorkout')?.disabled)return;
 if(!session||!activePlan?.ids.includes(id))return;
 if(activeDraftOwner!==verifiedOwnerId){notice('Account changed; restart the workout before logging sets.');return}
 if(session.sets.length>=window.MLC2SessionDraft.MAX_SETS){
  notice('This workout has reached 250 sets. Finish the workout before logging more sets.');
  return;
 }
 const weightField=document.querySelector('[data-weight="'+id+'"]');
 const repsField=document.querySelector('[data-reps="'+id+'"]');
 if(!weightField||!repsField)return;
 const weight=Number(weightField.value),reps=Number(repsField.value);
 if(weightField.value.trim()===''||repsField.value.trim()===''||!Number.isFinite(weight)||weight<0||weight>1500||!Number.isInteger(reps)||reps<1||reps>100){
  notice('Enter a valid weight and rep count.');return;
 }
 updateDraftSets(id,sets=>sets.length<window.MLC2SessionDraft.MAX_SETS?
  [...sets,{exerciseId:id,weight,reps}]:null,true);
}
function undoSet(id){
 if($('finishWorkout')?.disabled)return;
 if(!session||!activePlan?.ids.includes(id))return;
 if(activeDraftOwner!==verifiedOwnerId){notice('Account changed; restart the workout before changing sets.');return}
 updateDraftSets(id,sets=>{
  const index=sets.findLastIndex(set=>set.exerciseId===id);
  return index<0?null:sets.filter((_,i)=>i!==index);
 });
}
function updateDraftSets(id,change,autoRest=false){
 const owner=activeDraftOwner,epoch=authEpoch,plan=activePlan,draft=activeDraftStore;
 void (async()=>{
  try{
   await withAccountLock('history',owner,epoch,()=>{
    if(plan!==activePlan)return;
    draft.assertCurrent();
    const next=change(session.sets);
    if(!next)return;
    window.MLC2SessionDraft.save(draft,plan,next);
    session.sets=next;
    updateExerciseFeedback(id);
    if(autoRest&&$('autoRestToggle')?.checked)openRest(id);
   });
  }catch(error){
   if(plan===activePlan&&epoch===authEpoch)notice(error.code==='STALE_DRAFT'?
    'This draft changed in another window. Exit and reopen the latest draft.':
    'The set change was not saved. Your previously saved sets are available. Try again.');
  }
 })();
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
function openRest(exerciseId){
 restSeconds=typeof exerciseId==='string'&&Number.isInteger(activePlan?.targets?.[exerciseId]?.restSeconds)?activePlan.targets[exerciseId].restSeconds:90;restPaused=false;
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
function clearAuth(expected=auth||authStore.read(sessionStorage,localStorage)){authEpoch++;switchWorkoutOwner(null);cloudHistoryRequestId++;authStore.clear(sessionStorage,localStorage,expected);auth=null;account=null;originalSnapshot=null;cloudHistorySnapshot=null;if($('cloudOriginalHistoryResults'))$('cloudOriginalHistoryResults').replaceChildren();if($('cloudOriginalHistoryStatus'))$('cloudOriginalHistoryStatus').textContent='Signed out. Cloud archive cleared from memory.';renderSettings();renderHistory();renderTracking();renderOriginalPlans();renderProgress()}
async function validateStoredAuth(){
 if(activePlan||document.querySelector('.custom-editor-backdrop'))return;
 const saved=authStore.read(sessionStorage,localStorage);
 if(!saved)return;
 const thisEpoch=++authEpoch;
 if(!navigator.onLine){notice('Connect to verify this account and reopen its saved workouts.');return}
 try{
  let candidate=saved;
  if(saved.expires_at<Date.now()/1000+45){
   const refreshed=await authRequest('token?grant_type=refresh_token',{refresh_token:saved.refresh_token});
   if(thisEpoch!==authEpoch)return;
   if(!refreshed?.access_token||!refreshed?.user?.id||refreshed.user.id!==saved.user.id){
    clearAuth(saved);return;
   }
   candidate={access_token:refreshed.access_token,refresh_token:refreshed.refresh_token,
    user:refreshed.user,expires_at:Math.floor(Date.now()/1000)+(refreshed.expires_in||3600)};
  }
  // Stored auth is untrusted: never activate or sync an account before /user verifies.
  const user=await authRequest('user',null,candidate.access_token,'GET');
  if(thisEpoch!==authEpoch)return;
  if(!user?.id||user.id!==saved.user.id){clearAuth(saved);return}
  candidate.user=user;
  if(!authStore.replace(sessionStorage,localStorage,saved,candidate))return;
  if(activePlan||document.querySelector('.custom-editor-backdrop'))return;
  auth=candidate;account=user;switchWorkoutOwner(user.id);
 }catch(err){
  if(thisEpoch!==authEpoch)return;
  if([400,401,403].includes(err?.status)){
   if(authStore.read(sessionStorage,localStorage)?.access_token===saved.access_token)clearAuth(saved);
   return;
  }
  // Transient network/offline/storage errors are not sign-outs.
  // Do not discard the refresh token or falsely show authenticated access.
  auth=null;account=null;
  if(verifiedOwnerId!==null)switchWorkoutOwner(null);
 }
 if(thisEpoch===authEpoch)renderSettings();
}
function openSignUp(){
 openModal('<div class="modal-eyebrow">MYLIFTCOACH ACCOUNT</div><h2>Create your account</h2><p>Start a new MYLIFTCOACH 2.0 training profile using your email. Your original workout data will not be imported.</p><form id="signupForm" class="login-form"><label>Name (optional)<input name="name" autocomplete="name" maxlength="80"></label><label>Email<input name="email" type="email" autocomplete="email" autocapitalize="none" required></label><label>Password<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><button class="button-primary" id="signupSubmit" type="submit">Create account</button></form><p id="signupMessage" role="status" aria-live="polite"></p><button id="signupReturnSignIn" class="button-outline" type="button">Already have an account? Sign in</button>');
 $('modal').classList.add('auth-fullscreen');
 $('signupReturnSignIn').addEventListener('click',openSignIn);
 $('signupForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,submit=$('signupSubmit'),message=$('signupMessage');
  if(submit.disabled)return;
  const epoch=authEpoch,current=()=>epoch===authEpoch&&$('signupForm')===form&&!$('modal').hidden;
  const data=new FormData(form);
  submit.disabled=true;submit.textContent='Creating account…';message.textContent='';
  try{
   const result=await window.MLC2Signup.register({
    name:data.get('name'),email:data.get('email'),password:data.get('password'),confirmPassword:data.get('confirmPassword')
   },authRequest);
   if(!current())return;
   if(result.kind==='confirmation'){
    form.reset();form.hidden=true;
    message.className='auth-success';
    message.textContent='Check your email for a confirmation link, then return here and sign in. If you already have an account, use Sign In instead.';
    return;
   }
   const response=result.session;
   const verified=await authRequest('user',null,response.access_token,'GET');
   if(!current())return;
   if(!verified?.id||verified.id!==response.user.id)throw Error('Account identity could not be verified.');
   authEpoch++;saveAuth({...response,user:verified});switchWorkoutOwner(verified.id);
   if(verifiedOwnerId!==verified.id||account?.id!==verified.id||
      authStore.read(sessionStorage,localStorage)?.user?.id!==verified.id)
    throw Error('Account session was not retained; sign-in was not completed.');
   closeModal();setPage('home');renderSettings();
   notice('Your MYLIFTCOACH 2.0 account is ready.');
  }catch(err){
   if(!current())return;
   message.className='auth-error';
   message.textContent=err.name==='AbortError'?'The account service timed out.':
    /password|valid email|match|name must/i.test(err.message)?err.message:
    'Registration could not be completed. Check your email or try again later.';
  }finally{if(current()){submit.disabled=false;submit.textContent='Create account'}}
 });
}
function openPasswordRecovery(){
 openModal('<div class="modal-eyebrow">MYLIFTCOACH ACCOUNT</div><h2>Reset your password</h2><form id="passwordRecoveryForm" class="login-form"><label>Email<input name="email" type="email" autocomplete="email" autocapitalize="none" required></label><button class="button-primary" type="submit">Send reset link</button></form><p id="passwordRecoveryStatus" role="status"></p><button id="passwordRecoveryBack" class="button-outline">Back to sign in</button>');
 $('modal').classList.add('auth-fullscreen');
 $('passwordRecoveryBack').addEventListener('click',openSignIn);
 $('passwordRecoveryForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button'),status=$('passwordRecoveryStatus');
  if(button.disabled)return;
  button.disabled=true;
  try{
   const email=String(new FormData(form).get('email')).trim();
   await authRequest('recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{email});
   status.textContent='If the address can receive a reset link, check your email and open the link in Safari.';
  }catch{status.textContent='The reset link could not be requested. Wait a moment and try again.'}
  finally{button.disabled=false}
 });
}
async function openPasswordReset(token){
 const epoch=authEpoch;
 openModal('<h2>Set a new password</h2><p id="passwordResetStatus" role="status">Verifying the reset link…</p><form id="passwordResetForm" class="login-form" hidden><label>New password<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><button type="submit" class="button-primary">Update password</button></form><button id="passwordResetBack" class="button-outline">Back to sign in</button>');
 $('modal').classList.add('auth-fullscreen');
 const form=$('passwordResetForm'),status=$('passwordResetStatus');
 const current=()=>epoch===authEpoch&&$('passwordResetForm')===form&&!$('modal').hidden;
 $('passwordResetBack').addEventListener('click',openSignIn);
 try{
  const user=await authRequest('user',null,token,'GET');
  if(!current())return;
  if(!user?.id||!user.email)throw Error('Invalid reset identity');
  status.textContent='Set a new password for '+user.email+'.';
  form.hidden=false;
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const button=form.querySelector('button');
   if(button.disabled)return;
   const data=new FormData(form),password=data.get('password');
   if(typeof password!=='string'||password.length<8||password.length>128||password!==data.get('confirmPassword')){
    status.textContent='Enter matching passwords of 8–128 characters.';return;
   }
   button.disabled=true;
   try{
    await authRequest('user',{password},token,'PUT');
    if(current()){form.reset();openSignIn();$('loginMessage').textContent='Password updated. Sign in with your new password.'}
   }catch{if(current())status.textContent='Could not update the password. Request a fresh reset link if this one expired.'}
   finally{button.disabled=false}
  });
 }catch{if(current())status.textContent='This reset link is invalid or expired. Request a fresh link from Sign In.'}
}
function handlePasswordResetLink(){
 const params=new URLSearchParams(location.hash.slice(1));
 if(params.get('type')==='signup'&&params.has('access_token')){
  history.replaceState(history.state,'',location.pathname+location.search);
  openSignIn();$('loginMessage').textContent='Email confirmed. Sign in to continue.';
  return true;
 }
 if(params.get('type')!=='recovery')return false;
 const token=params.get('access_token');
 history.replaceState(history.state,'',location.pathname+location.search);
 if(token)openPasswordReset(token);
 else{openPasswordRecovery();$('passwordRecoveryStatus').textContent='This reset link is invalid or expired.'}
 return true;
}
function openSignIn(){
 openModal('<div class="modal-eyebrow">EXISTING SUPABASE ACCOUNT</div><h2>Welcome back</h2><p>Use the email and password from your original MYLIFTCOACH account. This only verifies your identity; it will not import, overwrite, or modify workout records.</p><form id="loginForm" class="login-form"><label>Email<input name="email" type="email" autocomplete="email" autocapitalize="none" required></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><button class="button-primary" id="loginSubmit" type="submit">Sign in securely</button></form><p id="loginMessage" role="status"></p><p class="small">Use your verified account to save your training in 2.0.</p><button id="loginCreateAccount" class="button-outline" type="button">New here? Create an account</button><button id="loginForgotPassword" class="button-outline" type="button">Forgot password?</button>');
 $('modal').classList.add('auth-fullscreen');
 $('loginCreateAccount')?.addEventListener('click',openSignUp);
 $('loginForgotPassword')?.addEventListener('click',openPasswordRecovery);
 // Do not focus through the id-only $ helper: the old selector threw before
 // the submit handler was attached. Avoid autofocus on iPhone to prevent keyboard jumps.
 $('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();const submit=$('loginSubmit');submit.disabled=true;submit.textContent='Connecting…';$('loginMessage').textContent='';
  const loginForm=event.currentTarget,epoch=authEpoch;
  const current=()=>epoch===authEpoch&&$('loginForm')===loginForm&&!$('modal').hidden;
  const form=new FormData(loginForm);
  try{
   const response=await authRequest('token?grant_type=password',{email:String(form.get('email')).trim(),password:String(form.get('password'))});
   if(!current())return;
   if(!response?.access_token||!response?.user?.id)throw Error('No verified account was returned.');
   const verified=await authRequest('user',null,response.access_token,'GET');
   if(!current())return;
   if(!verified?.id||verified.id!==response.user.id)throw Error('Account identity could not be verified.');
   authEpoch++;saveAuth({...response,user:verified});switchWorkoutOwner(verified.id);
   if(verifiedOwnerId!==verified.id||account?.id!==verified.id||
      authStore.read(sessionStorage,localStorage)?.user?.id!==verified.id)
    throw Error('Account session was not retained; sign-in was not completed.');
   closeModal();setPage('home');renderSettings();
   notice('Signed in to your verified MYLIFTCOACH 2.0 account.');
  }catch(err){if(!current())return;$('loginMessage').className='auth-error';$('loginMessage').textContent=err.name==='AbortError'?'The account service timed out.':/invalid/i.test(err.message)?'Email or password was not accepted.':'Could not sign in: '+String(err.message).slice(0,120)}
  finally{submit.disabled=false;submit.textContent='Sign in securely'}
 });
}
function bind(){
 $('goalProgramSource').addEventListener('change',()=>{
  $('goalProgramCustomGroup').hidden=$('goalProgramSource').value==='generated';
 });
 $('goalProgramRestart').addEventListener('click',async()=>{
  const profile=window.MLC2CalorieGoal?.read(localStorage,verifiedOwnerId);
  const program=window.MLC2GoalProgram?.read(localStorage,verifiedOwnerId);
  if(!profile||!program)return;
  if(!confirm('Restart this '+program.weeks+'-week '+program.goal+' program from today? Workout history and custom routines will be kept.'))return;
  try{
   const owner=verifiedOwnerId,epoch=authEpoch;
   await withAccountLock('plans',owner,epoch,()=>window.MLC2Custom.transactProgram(store=>{
    const latest=window.MLC2GoalProgram.read(store,owner);
    if(JSON.stringify(latest)!==JSON.stringify(program))throw Error('Training program changed. Review it before restarting.');
    const previousSource=window.MLC2ProgramSource?.read(store,owner,program);
    const renewed=window.MLC2GoalProgram.start(store,owner,{goal:program.goal,weeks:program.weeks});
    if(previousSource)window.MLC2ProgramSource.save(store,owner,renewed,previousSource);
   }));
   if(epoch!==authEpoch)return;
   try{window.MLC2ScheduleAuxSync?.()}catch{}
   renderCalorieGoal();renderHome();renderWorkouts();notice('New '+program.weeks+'-week program started. Your prior workouts are retained.');
  }catch(e){notice('Could not restart program: '+String(e.message||e).slice(0,100))}
 });
 $('calorieGoalForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,field=name=>form.elements.namedItem(name).value;
  try{
   const profile={goal:field('goal'),age:Number(field('age')),weightKg:Number(field('weightLb'))*0.45359237,
    heightCm:window.MLC2CalorieGoal.heightCmFromFeetInches(field('heightFt'),field('heightIn')),
    sex:field('sex'),activity:field('activity')};
   const estimate=window.MLC2CalorieGoal.estimate(profile);
   const weeks=Number(field('programWeeks'));
   if(!window.MLC2GoalProgram.DURATIONS.includes(weeks))throw Error('Choose a 6, 8 or 12 week program');
   const old=window.MLC2GoalProgram.read(localStorage,verifiedOwnerId);
   if(old&&(old.goal!==profile.goal||old.weeks!==weeks)&&
      !confirm('Start a new '+weeks+'-week '+profile.goal+' program? The old program date will be replaced, but your workout history and custom routines will be preserved.'))return;
   const mode=field('programSource'),customId=field('programCustom');
   if(!window.MLC2ProgramSource.MODES.includes(mode))throw Error('Select a workout source');
   if(mode!=='generated'&&!programCustomOptions().length)
    throw Error('Create a custom workout before choosing custom or combined programs');
   if(customId&&!programCustomOptions().some(p=>p.id===customId))
    throw Error('Selected custom routine is unavailable');
   const owner=verifiedOwnerId,epoch=authEpoch;
   await withAccountLock('plans',owner,epoch,()=>window.MLC2Custom.transactProgram(store=>{
    const latest=window.MLC2GoalProgram.read(store,owner);
    if(JSON.stringify(latest)!==JSON.stringify(old))throw Error('Training program changed. Review it before saving.');
    if(customId&&!programCustomOptions().some(plan=>plan.id===customId))throw Error('Selected custom routine is unavailable');
    const next=(!old||old.goal!==profile.goal||old.weeks!==weeks)?
     window.MLC2GoalProgram.start(store,owner,{goal:profile.goal,weeks}):old;
    window.MLC2ProgramSource.save(store,owner,next,{mode,customId:mode==='generated'?'':customId});
    window.MLC2CalorieGoal.save(store,owner,profile);
   }));
   if(epoch!==authEpoch)return;
   try{window.MLC2ScheduleAuxSync?.()}catch{}
   renderCalorieGoal();renderHome();renderWorkouts();
   if(estimate.needsReview)notice('Calorie estimate requires review before use.');
   else notice('Estimated calorie target saved on this iPhone.');
  }catch(e){$('calorieGoalResult').textContent='Could not calculate: '+String(e.message||e).slice(0,120)}
 });

 document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.page)));
 $('avatarBtn').addEventListener('click',()=>setPage('settings'));
 $('previewWelcome').addEventListener('click',()=>setPage('welcome'));
 $('welcomeExplore').addEventListener('click',()=>setPage('home'));
 $('welcomeSignIn').addEventListener('click',openSignIn);
 $('welcomeSignUp')?.addEventListener('click',openSignUp);
 document.querySelectorAll('[data-shortcut]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.shortcut)));
 document.querySelectorAll('[data-coach-link]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.coachLink)));

 $('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
 $('homeMenuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
 $('sidebarClose').addEventListener('click',()=>$('sidebar').classList.remove('open'));
 $('homeAccountBtn').addEventListener('click',()=>setPage('settings'));

 $('editDaySession').onclick=()=>editSession(false);
 $('resumeOtherSession').onclick=()=>{const draft=pendingWorkout();if(draft)openWorkout(draft.planId,null,draft.workoutId||draft.planId)};
 $('heroStart').addEventListener('click',event=>startPreviewWorkout(event.currentTarget,nextPlan));
 $('heroViewPlan').addEventListener('click',()=>setPage('workouts'));
 $('todayStart').addEventListener('click',event=>startPreviewWorkout(event.currentTarget,nextHomeSession));
 $('homeNextSession').addEventListener('click',event=>startPreviewWorkout(event.currentTarget,nextHomeSession));
 $('coachScheduleApply').addEventListener('click',assignCoachSchedule);
 $('coachScheduleCancel').addEventListener('click',closeCoachSchedule);
 $('workoutGrid').addEventListener('click',e=>{if(window.MLC2Custom?.handleClick(e,()=>{renderHome();renderWorkouts();if(page==='coaching')renderCoach()},openCoachSchedule))return;const el=e.target.closest('[data-workout]');if(el)openWorkout(el.dataset.workout)});
 $('createWorkout').addEventListener('click',()=>window.MLC2Custom?.openEditor(null,libraryExercises(),()=>{renderHome();renderWorkouts();if(page==='coaching')renderCoach()}));
 $('createWeeklyProgram').addEventListener('click',()=>window.MLC2FullWeekBuilder?.open(()=>{renderHome();renderWorkouts();if(page==='coaching')renderCoach();notice('Your full weekly program is saved and the new schedule is active.')}));
 $('workoutTodayStart').addEventListener('click',event=>startPreviewWorkout(event.currentTarget,nextPlan));
 $('workoutTodayChange').addEventListener('click',()=>setWorkoutTab('routines'));
 const scheduleLib=window.MLC2ScheduleLibrary;
 $('savedScheduleChoice').addEventListener('change',renderScheduleLibrary);
 $('activateSavedSchedule').addEventListener('click',()=>{
  const id=$('savedScheduleChoice').value;if(!id)return;
  void changeScheduleLibrary(store=>scheduleLib.activate(store,id,window.MLC2Custom.allPlans(plans)),'Saved program activated.');
 });
 $('activateCoachMode').addEventListener('click',()=>{
  void changeScheduleLibrary(store=>scheduleLib.useCoach(store),'Coach is active. Weekly programs are saved.');
 });
 $('saveScheduleCopy').addEventListener('click',()=>{
  const name=prompt('Name this saved weekly program:','My weekly program');
  if(name===null)return;
  void changeScheduleLibrary(store=>scheduleLib.saveCopy(store,name),'Weekly program saved as a new copy.');
 });
 $('saveScheduleChanges').addEventListener('click',()=>{
  const state=scheduleLib.read(planStorage()),active=state.profiles.find(p=>p.id===state.activeId);
  if(!active)return;
  void changeScheduleLibrary(store=>scheduleLib.saveCurrent(store,active.name),'Weekly program changes saved.');
 });
 $('removeSavedSchedule').addEventListener('click',()=>{
  const id=$('savedScheduleChoice').value;if(!id)return;
  const saved=scheduleLib.read(planStorage()).profiles.find(p=>p.id===id);
  if(!saved||!confirm('Remove saved copy “'+saved.name+'”? Workouts and history are retained.'))return;
  void changeScheduleLibrary(store=>scheduleLib.remove(store,id),'Saved program removed. Workouts kept.');
 });
 $('coachAutoStart').addEventListener('click',event=>startPreviewWorkout(event.currentTarget,coachAutonomousPlan));
 $('coachAutoPreferences').addEventListener('change',async event=>{
  if(betaView().mode!=='pro')return;
  try{
   const fields={coachAutoGoal:'goal',coachAutoDays:'days',coachAutoEquipment:'equipment'};
   const name=fields[event.target.id];if(!name)return;
   const value=name==='days'?Number(event.target.value):event.target.value,owner=verifiedOwnerId,epoch=authEpoch;
   await withAccountLock('plans',owner,epoch,()=>{
    if(betaView().mode!=='pro')throw Error('Pro beta access is required.');
    const preferences=window.MLC2CoachPreferences;
    preferences.save(localStorage,owner,{...preferences.read(localStorage,owner),[name]:value});
   });
   if(epoch!==authEpoch)return;
   try{window.MLC2ScheduleAuxSync?.()}catch{}
   renderAutonomousCoach();renderHome();notice('Coach training preferences saved on this device.');
  }catch(err){notice('Coach preference update failed: '+String(err.message||err).slice(0,100));renderAutonomousCoach()}
 });
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

 $('recoverGuestWorkouts').addEventListener('click',async()=>{
  if(!verifiedOwnerId||verifiedOwnerId!==account?.id){notice('Sign in to recover guest workouts.');return}
  const recovery=window.MLC2Custom?.guestRecovery();
  if(!recovery?.available)return;
  if(!confirm('Copy '+recovery.available+' guest workout(s) into this account? The guest copies and existing account routines will remain untouched.'))return;
  try{
   const result=await window.MLC2Custom.runPlanWrite(()=>window.MLC2Custom.recoverGuest());
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

 $('modalContent').addEventListener('click',e=>{const simulation=e.target.closest('[data-coach-test]');if(simulation){toggleCoachTestHistory(simulation.dataset.coachTest);return}const suggest=e.target.closest('[data-coach-apply]');if(suggest){applyCoachWeight(suggest.dataset.coachApply);return}const add=e.target.closest('[data-addset]');if(add){addSet(add.dataset.addset);return}const undo=e.target.closest('[data-undo]');if(undo)undoSet(undo.dataset.undo)});
 $('closeModal').addEventListener('click',closeModal);
 $('restClose').addEventListener('click',closeRest);
 $('restSkip').addEventListener('click',closeRest);
 $('restPause').addEventListener('click',()=>{restPaused=!restPaused;updateRestClock()});
 $('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('sessionEditor')&&!$('modal').hidden)closeModal()});
 let reviewedTestCleanup=null,testCleanupBusy=false;
 function testCleanupEngine(owner,epoch){
  const verifier=window.MLC2VerifiedAuth.create({baseUrl:BACKEND,publishableKey:PUBLIC_KEY,getSession:()=>sessionRefresh.sessionFor(owner),fetcher:fetch,enabled:true});
  const transport=window.MLC2SupabaseTransport.create({baseUrl:BACKEND,publishableKey:PUBLIC_KEY,fetcher:fetch,enabled:true,getVerifiedAuth:()=>verifier.verify(owner)});
  return window.MLC2TestHistoryCleanup.create({owner,storage:localStorage,accountStore:window.MLC2AccountWorkouts,
   transport,verify:id=>verifier.verify(id),active:()=>epoch===authEpoch&&owner===verifiedOwnerId&&account?.id===owner?owner:null});
 }
 $('previewTestHistoryCleanup').addEventListener('click',async()=>{
  const owner=verifiedOwnerId,epoch=authEpoch,status=$('testHistoryCleanupStatus');
  reviewedTestCleanup=null;$('confirmTestHistoryCleanup').disabled=true;
  if(!owner||owner!==account?.id){status.textContent='Sign in before reviewing test history.';return}
  if(workoutSyncBusy||auxOperationBusy||testCleanupBusy){status.textContent='Finish the current cloud operation first.';return}
  const button=$('previewTestHistoryCleanup');button.disabled=true;testCleanupBusy=true;
  try{
   const engine=testCleanupEngine(owner,epoch);
   if(engine.hasPending()){
    status.textContent='An earlier cleanup was interrupted. Confirm to resume only the already selected records.';
    reviewedTestCleanup={status:'resume',owner,epoch};
    $('confirmTestHistoryCleanup').disabled=false;
    return;
   }
   const inspected=await engine.prepare();
   if(epoch!==authEpoch||owner!==verifiedOwnerId)return;
   if(inspected.status!=='ready')throw Error('Cleanup preview unavailable');
   const backup=JSON.stringify(inspected.backup,null,2);
   const blob=new Blob([backup],{type:'application/json'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download='MYLIFTCOACH-private-8-test-workouts-'+new Date().toISOString().slice(0,10)+'.json';
   document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   reviewedTestCleanup={...inspected,owner,epoch};
   status.textContent='Backup download started: '+inspected.count+' workouts / '+inspected.sets+' sets. Review each one before deletion: '+inspected.rows.map(item=>String(item.payload.title||'Untitled').slice(0,65)+' ('+String(item.payload.created||'').slice(0,10)+', '+item.payload.sets.length+' sets)').join(' · ')+'. Save the JSON in Files before confirming deletion. Nothing has been deleted.';
   $('confirmTestHistoryCleanup').disabled=false;
  }catch(err){if(epoch===authEpoch)status.textContent='Cleanup not permitted: '+String(err.message||err).slice(0,190)}
  finally{button.disabled=false;testCleanupBusy=false}
 });
 $('confirmTestHistoryCleanup').addEventListener('click',async()=>{
  const plan=reviewedTestCleanup,owner=verifiedOwnerId,epoch=authEpoch,status=$('testHistoryCleanupStatus');
  if(!plan||plan.owner!==owner||plan.epoch!==epoch||owner!==account?.id){status.textContent='Review this account again.';return}
  if(workoutSyncBusy||auxOperationBusy||testCleanupBusy){status.textContent='Another sync operation is active. Try again.';return}
  const message=plan.status==='resume'
   ?'An earlier cleanup stopped partway through. Resume deleting only those original eight records?'
   :'Have you saved the private JSON backup in Files? This permanently deletes your eight reviewed test workouts from this device AND your account cloud. Your plans, Coach settings and photos will stay.';
  if(!confirm(message))return;
  if(prompt('Type CLEAR 8 TEST WORKOUTS to confirm this account-only deletion:')!=='CLEAR 8 TEST WORKOUTS'){
   status.textContent='Cancelled; no additional records deleted.';return;
  }
  if(!navigator.onLine){status.textContent='Online connection required. No cleanup started.';return}
  const button=$('confirmTestHistoryCleanup');
  button.disabled=true;testCleanupBusy=true;workoutSyncBusy=true;status.textContent='Deleting only the confirmed cloud test records. Do not close this app.';
  try{
   const result=await withAccountLock('journal',owner,epoch,()=>withAccountLock('history',owner,epoch,()=>{
    const engine=testCleanupEngine(owner,epoch);
    return plan.status==='resume'?engine.resume():engine.execute(plan);
   }));
   if(epoch!==authEpoch||owner!==verifiedOwnerId)return;
   if(result.status!=='complete')throw Error('Cleanup was not fully verified');
   reviewedTestCleanup=null;loadCurrentWorkouts();renderHome();renderProgress();renderHistory();renderCoach();
   status.textContent='Verified: all eight cloud test workouts deleted and this installation history cleared. Five-day Coach settings and custom programs remain unchanged.';
   setWorkoutSyncState('Test workout history cleared locally and in account cloud.');
  }catch(err){
   if(epoch===authEpoch&&owner===verifiedOwnerId){
    status.textContent='Cleanup paused: '+String(err.message||err).slice(0,160)+'. Your backup and checkpoint are retained. Select Review and download test backup to resume safely.';
    reviewedTestCleanup=null;
   }
  }finally{
   button.disabled=true;testCleanupBusy=false;workoutSyncBusy=false;
  }
 });
 $('clearDemo').addEventListener('click',async()=>{
  const owner=verifiedOwnerId,epoch=authEpoch;
  const readHistory=()=>localStorage.getItem(window.MLC2AccountWorkouts.key(owner));
  let approved;try{approved=readHistory()}catch{notice('Unable to inspect this device history.');return}
  if(!confirm('Delete only the local 2.0 workout history for the current '+(owner?'account':'guest')+'?'))return;
  try{
   await withAccountLock('journal',owner,epoch,()=>withAccountLock('history',owner,epoch,()=>{
    if(readHistory()!==approved)throw Error('Device history changed. Review it before clearing.');
    window.MLC2AccountWorkouts.clear(localStorage,owner);
   }));
   if(epoch!==authEpoch)return;
   loadCurrentWorkouts();renderProgress();renderHome();notice('Current local workout history cleared. Production data untouched.');
  }catch{if(epoch===authEpoch)notice('Unable to clear this device history.')}
 });
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
 $('recoveryRestoreAction').addEventListener('click',async()=>{
  if(verifiedOwnerId){$('recoveryImportResult').textContent='Legacy guest recovery cannot run while signed in. Account history was not changed.';return}
  if(!pendingRecovery)return;
  const preview=window.MLC2RecoveryImport.planRestore(pendingRecovery,localStorage);
  if(!preview.canRestore){$('recoveryImportResult').textContent='Existing data changed or conflicts. Restore blocked.';$('recoveryRestoreAction').disabled=true;pendingRecovery=null;return}
  if(!confirm('Restore '+preview.writes.length+' missing 2.0 storage categories in this browser? Existing records will NOT be replaced. Photos and cloud are unchanged.'))return;
  try{
   const backup=pendingRecovery,epoch=authEpoch;
   const result=await withAccountLock('history',null,epoch,()=>{
    if(pendingRecovery!==backup)throw Error('Backup selection changed');
    return window.MLC2RecoveryImport.restore(backup,localStorage);
   });
   if(epoch!==authEpoch||pendingRecovery!==backup)return;
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
 $('deviceArchiveAction').addEventListener('click',()=>{
  const output=$('cloudArchiveResult'),owner=verifiedOwnerId;
  if(!owner||account?.id!==owner){output.textContent='Sign in to verify your original account first.';return}
  if(!confirm('Download a private checkpoint of your original account data on this device? It can contain workout and health information.'))return;
  try{
   const file=window.MLC2LegacyDeviceArchive.capture(localStorage,owner);
   window.MLC2LegacyDeviceArchive.download(file,document,URL,Blob,callback=>setTimeout(callback,60000));
   output.textContent='Private checkpoint prepared with '+file.categories+' original categories and any pending deletion metadata. Photo files are separate.';
  }catch(error){output.textContent='Device checkpoint unavailable: '+String(error.message||error).slice(0,160)}
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
  const epoch=authEpoch;
  button.disabled=true;output.textContent='Inspecting original cloud records without changing them…';
  try{
   const result=await window.MLC2SyncPreview.run({url:BACKEND,publishableKey:PUBLIC_KEY,token:auth.access_token,userId:account.id});
   if(epoch===authEpoch)window.MLC2SyncPreview.render(output,result);
  }catch(e){if(epoch===authEpoch)output.textContent='Read-only preview unavailable: '+String(e.message||e).slice(0,200)}
  finally{button.disabled=false}
 });
 $('cloudAuditAction').addEventListener('click',async()=>{
  const output=$('cloudAuditResult'),button=$('cloudAuditAction');
  if(!account?.id||!auth?.access_token){output.textContent='Sign in to your existing account before checking cloud compatibility.';return}
  const epoch=authEpoch;
  button.disabled=true;output.textContent='Checking authenticated records read-only…';
  try{
   const report=await window.MLC2CloudAudit.check({baseUrl:BACKEND,publishableKey:PUBLIC_KEY,token:auth.access_token,userId:account.id});
   if(epoch===authEpoch)window.MLC2CloudAudit.render(output,report);
  }catch(err){if(epoch===authEpoch)output.textContent='Compatibility check unavailable: '+String(err.message||err).slice(0,160)}
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
 $('restoreAccountWorkouts').addEventListener('click',async()=>{
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
   const report=await withAccountLock('history',pending.owner,pending.epoch,()=>{
    if(pendingAccountRecovery!==pending)throw Error('Backup selection changed');
    return window.MLC2AccountRecovery.restore(localStorage,pending.backup,pending.owner);
   });
   if(pending.epoch!==authEpoch)return;
   pendingAccountRecovery=null;$('restoreAccountWorkouts').disabled=true;
   loadCurrentWorkouts();renderHome();renderProgress();renderHistory();if(page==='coaching')renderCoach();scheduleWorkoutSync();
   output.textContent='Restored '+report.restored+' missing account workouts. Existing data was preserved; nothing uploaded to Supabase.';
  }catch(err){if(pending.epoch===authEpoch)output.textContent='Restore blocked: '+String(err.message||err).slice(0,160)}
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
   const result=action==='backup'?await withAccountLock('journal',owner,epoch,()=>engine.backup()):await engine.restore({
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
    if(page==='nutrition')renderCalorieGoal();
    }
    output.textContent=result.status==='restored'?'Restored '+result.restored.join(', ')+'. Existing data preserved.':
     result.status==='changed-reconfirm'?'Cloud data changed during confirmation. Nothing imported. Tap Recover again to review the new categories.':
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
    renderHome();renderWorkouts();renderCoach();
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
   const currentSession=await sessionRefresh.sessionFor(selectedOwner);
   if(epoch!==authEpoch||verifiedOwnerId!==selectedOwner)return;
   const current=await authRequest('user',null,currentSession.access_token,'GET');
   if(epoch!==authEpoch||current?.id!==selectedOwner)return;
   if(current.user_metadata?.[window.MLC2BetaAccess.FIELD]!==requested)
    throw Error('Updated beta mode was not confirmed by the account');
   account=current;auth.user=current;authStore.save(sessionStorage,localStorage,auth);
   output.textContent=updated.mode.toUpperCase()+' beta access saved. No purchase required.';
   renderHome();renderWorkouts();renderCoach();
  }catch(err){
   if(epoch===authEpoch){output.textContent='Beta mode unchanged: '+String(err.message||err).slice(0,125);select.value=before}
  }finally{betaModeSaving=false;renderSettings()}
 });
 let incomingTransfer=null,transferOwner=null,receivingBackup=null;
 const transferKeys=window.MLC2ProgramTransfer.KEYS;
 const currentProgramState=owner=>JSON.stringify(transferKeys.map(key=>
  localStorage.getItem(key+':user:'+owner)));
 function refreshTransferPreview(){
  const output=$('inspectAccountProgramsStatus'),button=$('applyAccountPrograms');
  button.disabled=true;
  const owner=verifiedOwnerId;
  if(!incomingTransfer||transferOwner!==owner||account?.id!==owner){output.textContent='Choose a private file from your source installation.';return}
  try{
   const merge=window.MLC2ProgramTransfer.planMerge(incomingTransfer,localStorage,owner,window.MLC2AuxData,
    {activateSource:$('activateImportedProgram').checked});
   output.textContent=merge.canApply
    ?merge.changes.length+' categories would change: '+merge.changes.map(change=>{const category=window.MLC2AuxData.CONFIG.find(item=>item.key===change.category);return category?.label||change.category}).join(', ')+'. Existing workout history and progress photos remain untouched. This preview makes no cloud changes.'
    :'Import blocked: '+merge.conflicts.slice(0,4).join('; ')+'. No data changed.';
   button.disabled=!merge.canApply||!merge.changes.length||
    !receivingBackup||receivingBackup.owner!==owner||
    receivingBackup.state!==currentProgramState(owner);
   $('applyAccountProgramsStatus').textContent=button.disabled
    ?'Save a fresh receiving-installation backup before importing. Conflicts must be resolved without overwriting existing routines.'
    :'Ready for explicit confirmation. This changes only account settings in the receiving installation; cloud conflicts remain protected.';
  }catch(err){output.textContent='Merge preview rejected: '+String(err.message||err).slice(0,160)}
 }
 $('exportAccountPrograms').addEventListener('click',()=>{
  const status=$('exportAccountProgramsStatus'),owner=verifiedOwnerId;
  if(!owner||account?.id!==owner){status.textContent='Sign in to your verified account before exporting programs.';return}
  if(!confirm('Download a PRIVATE copy of this installation’s custom routines, saved schedules and Coach settings? Keep it in Files and do not share it. No cloud data will change.'))return;
  try{
   const state=currentProgramState(owner);
   const record=window.MLC2ProgramTransfer.capture(localStorage,owner,window.MLC2AuxData);
   if(verifiedOwnerId!==owner||account?.id!==owner||state!==currentProgramState(owner))
    throw Error('Account or programs changed before download');
   const result=window.MLC2ProgramTransfer.download(record);
   receivingBackup={owner,state};
   status.textContent='Exported '+result.categories+' account program categories ('+result.bytes+' bytes). Keep your private backup. No Supabase records changed.';
   refreshTransferPreview();
  }catch(err){status.textContent='Export unavailable: '+String(err.message||err).slice(0,160)}
 });
 $('inspectAccountProgramsFile').addEventListener('change',async event=>{
  const status=$('inspectAccountProgramsStatus'),file=event.target.files?.[0],owner=verifiedOwnerId,epoch=authEpoch;
  incomingTransfer=null;transferOwner=null;$('applyAccountPrograms').disabled=true;
  if(!file){status.textContent='No private transfer file selected.';return}
  if(!owner||account?.id!==owner){status.textContent='Sign in to the same verified account first.';return}
  if(file.size>500000){status.textContent='File exceeds private transfer size limit.';return}
  try{
   const record=window.MLC2ProgramTransfer.parse(await file.text(),owner,window.MLC2AuxData);
   if(epoch!==authEpoch||verifiedOwnerId!==owner||account?.id!==owner)throw Error('Account changed during comparison');
   incomingTransfer=record;transferOwner=owner;refreshTransferPreview();
  }catch(err){status.textContent='Comparison rejected: '+String(err.message||err).slice(0,160)}
  finally{event.target.value=''}
 });
 $('activateImportedProgram').addEventListener('change',refreshTransferPreview);
 $('applyAccountPrograms').addEventListener('click',async()=>{
  const status=$('applyAccountProgramsStatus'),owner=verifiedOwnerId,epoch=authEpoch,record=incomingTransfer;
  if(!record||transferOwner!==owner||account?.id!==owner){status.textContent='Re-select the private source backup.';return}
  if(!receivingBackup||receivingBackup.owner!==owner||
     receivingBackup.state!==currentProgramState(owner)){status.textContent='Receiving installation changed. Export a fresh backup first.';refreshTransferPreview();return}
  const sourceActive=$('activateImportedProgram').checked;
  const preview=window.MLC2ProgramTransfer.planMerge(record,localStorage,owner,window.MLC2AuxData,{activateSource:sourceActive});
  if(!preview.canApply||!preview.changes.length){status.textContent='There is no safe change to import. No data changed.';refreshTransferPreview();return}
  if(!confirm('Apply '+preview.changes.length+' reviewed program categories to THIS installation? Existing custom workouts are combined, and any same-ID differences are blocked. Cloud backups may still require conflict review. Your source app remains untouched.'))return;
  $('applyAccountPrograms').disabled=true;
  try{
   await window.MLC2Custom.runPlanWrite(()=>{
    if(epoch!==authEpoch||owner!==verifiedOwnerId||owner!==account?.id)
     throw Error('Account changed; import cancelled');
    if(receivingBackup.state!==currentProgramState(owner))
     throw Error('Receiving installation changed; export another backup');
    const fresh=window.MLC2ProgramTransfer.planMerge(record,localStorage,owner,window.MLC2AuxData,{activateSource:sourceActive});
    if(!fresh.canApply||JSON.stringify(fresh.changes)!==JSON.stringify(preview.changes))
     throw Error('Import preview changed. Review again');
    window.MLC2Custom.commitRecoveredPlans(fresh.changes);
   });
   if(epoch!==authEpoch||owner!==verifiedOwnerId)return;
   incomingTransfer=null;transferOwner=null;receivingBackup=null;
   renderHome();renderWorkouts();renderCoach();renderSettings();
   status.textContent='Imported '+preview.changes.length+' reviewed program categories into this installation. Local workout history and photos were preserved. Cloud conflict must be reviewed separately; no cloud record was force-overwritten.';
   $('inspectAccountProgramsStatus').textContent='Import completed. Source backup remains in Files.';
  }catch(err){status.textContent='Import blocked: '+String(err.message||err).slice(0,165)}
  finally{refreshTransferPreview()}
 });
 $('diagnoseOtherFitnessCloud').addEventListener('click',async()=>{
  const output=$('otherFitnessCloudDiagnostic'),button=$('diagnoseOtherFitnessCloud');
  const owner=verifiedOwnerId,epoch=authEpoch;
  if(!owner||owner!==account?.id){output.textContent='Sign in to your verified account before comparing cloud categories.';return}
  button.disabled=true;output.textContent='Reading cloud category revisions without writing…';
  try{
   const report=await auxEngine(owner).diagnose();
   if(epoch!==authEpoch||verifiedOwnerId!==owner)return;
   const changed=report.categories.filter(item=>!['matching','absent'].includes(item.state));
   output.textContent=changed.length
    ?'Read-only review: '+changed.map(item=>item.label+': '+item.state.replaceAll('-',' ')).join(' · ')+'. No backups were overwritten.'
    :'No missing or divergent fitness categories detected. Cloud records unchanged.';
  }catch(err){if(epoch===authEpoch)output.textContent='Read-only cloud review unavailable: '+String(err.message||err).slice(0,150)}
  finally{button.disabled=false}
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
   }else if(result.status==='changed-reconfirm'){
    setWorkoutSyncState('Cloud history changed during confirmation. Nothing imported. Tap Recover again to review the updated count.');
   }else setWorkoutSyncState(result.status==='cancelled'?'Recovery canceled; no records changed.':'All cloud workouts already present.');
  }catch(err){
   if(owner===verifiedOwnerId&&epoch===authEpoch)
    setWorkoutSyncState('Recovery paused: '+String(err.message||err).slice(0,120)+'. Local records preserved.');
  }finally{button.disabled=!verifiedOwnerId}
 });
 window.addEventListener('online',()=>{
  if(!verifiedOwnerId){void validateStoredAuth();return}
  scheduleWorkoutSync(0);scheduleAuxSync(1200);
 });
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
 $('authCreateAction')?.addEventListener('click',openSignUp);
}
$('waterDay').value=localDayString();$('weightDay').value=localDayString();
document.body.classList.add('home-active');bind();window.MLC2BodyProgress?.init();renderHome();renderWorkouts();renderLibrary();renderProgress();renderSettings();if(!handlePasswordResetLink())validateStoredAuth();recoverInterruptedPlans(null);
})();
