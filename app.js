/* MYLIFTCOACH 2.0 · Phase 1. No writes to production Supabase tables. */
(()=>{
'use strict';
const BACKEND='https://kirlpjflaoriiusfamsk.supabase.co';
const PUBLIC_KEY='sb_publishable_yYMnCM3k14zaEtpHo4-xkQ_Cd1Aty90';
const DEMO_KEY='mlc2-demo-workouts-v1'; // independent namespace, never original workout keys
const AUTH_KEY='mlc2-auth-session-v1'; // separate from original production auth storage
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
let demoSessions=loadDemo();
const TRACK_KEY='mlc2-local-daily-v1'; // New 2.0 log, NEVER a legacy key
let trackingEntries=loadLocalTracking();
let originalSnapshot=null;

let toastTimer;
let muscleFilter='';
let restSeconds=90,restPaused=true,restClock=null;
function loadDemo(){try{const a=JSON.parse(localStorage.getItem(DEMO_KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&Array.isArray(x.sets)).slice(0,100):[]}catch{return []}}
function storeDemo(){localStorage.setItem(DEMO_KEY,JSON.stringify(demoSessions))}
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
  title:String(x.workoutTitle||x.title||'Workout').slice(0,110),
  date:String(x.date||x.created||'').slice(0,35),
  exercises:x.exercises.filter(y=>y&&Array.isArray(y.sets)).map(y=>({
   id:String(y.id||y.name||'Exercise').slice(0,110),
   name:String(y.name||y.id||'Exercise').slice(0,110),
   sets:y.sets.filter(z=>z&&Number.isFinite(Number(z.weight))&&Number.isFinite(Number(z.reps))&&Number(z.weight)>=0&&Number(z.reps)>0).slice(0,20).map(z=>({weight:Number(z.weight),reps:Number(z.reps)}))
  })).slice(0,55)
 }));
 const plans=rawPlans.filter(x=>x&&typeof x==='object'&&Array.isArray(x.exercises)).slice(0,100).map(x=>({
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
 try{const data=JSON.parse(localStorage.getItem(TRACK_KEY)||'[]');return Array.isArray(data)?data.filter(x=>x&&['water','weight'].includes(x.type)&&Number.isFinite(Number(x.value))&&Number(x.value)>0&&/^\d{4}-\d\d-\d\d$/.test(x.day)).slice(0,400):[]}catch{return []}
}
function persistLocalTracking(){localStorage.setItem(TRACK_KEY,JSON.stringify(trackingEntries))}
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
function nextPlan(){return window.MLC2Custom?.currentPlan(plans,demoSessions.length)||plans[demoSessions.length%plans.length]}
function renderHome(){
 $('metricWorkouts').textContent=demoSessions.length;
 $('metricSets').textContent=totalSets();
 const plan=nextPlan();$('todayTitle').textContent=plan.title;$('todayDescription').textContent=plan.ids.length+' exercises · '+(plan.ids.length*3)+' sets · ~45 min';
 $('todayExercises').innerHTML=plan.ids.map(id=>{const e=libraryExercises().find(x=>x.id===id)||exercises.find(x=>x.id===id);return '<div class="preview-exercise"><strong>'+escapeHTML(e.name)+'</strong><small>'+e.sets+' × '+escapeHTML(e.reps)+'</small></div>'}).join('');
 $('recentActivity').innerHTML=demoSessions.length?demoSessions.slice(0,3).map(x=>'<div class="recent-item"><div><strong>'+escapeHTML(x.title)+'</strong><small>'+new Date(x.created).toLocaleDateString()+'</small></div><span>'+x.sets.length+' sets</span></div>').join(''):'<div class="empty-note">Your next session starts here. Practice workouts you complete in this demo will appear in this section.</div>';
}
function renderWorkouts(){
 $('workoutGrid').innerHTML=(window.MLC2Custom?.allPlans(plans)||plans).map((p,i)=>'<div class="workout-item"><button type="button" class="workout-card" data-workout="'+p.id+'"><span class="number">SESSION 0'+(i+1)+' · '+escapeHTML(p.kind.toUpperCase())+'</span><h3>'+escapeHTML(p.title)+'</h3><p>'+escapeHTML(p.description)+'</p><div class="workout-meta"><span>'+p.ids.length+' movements · '+p.ids.length*3+' recommended sets</span><b>Open session ↗</b></div></button>'+window.MLC2Custom.controls(p,nextPlan().id)+'</div>').join('');
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
function renderCoach(){window.MLC2Coach?.render($('coachSuggestions'),demoSessions,libraryExercises())}
function renderSettings(){
 $('accountIdentity').textContent=account?.email?account.email+' · authenticated (production workout data is not loaded)':'Not signed in. You can still explore the demo.';
 $('backendStatus').textContent=account?'AUTHENTICATED':'NOT CONNECTED';
 $('cloudPill').textContent=account?'ACCOUNT CONNECTED · DEMO':'DEMO WORKSPACE';
 $('authAction').textContent=account?'Sign out':'Sign in with existing account';
}
function openModal(content){$('modalContent').innerHTML=content;$('modal').hidden=false;document.body.style.overflow='hidden';$('closeModal').focus()}
function closeModal(){closeRest();$('modal').hidden=true;document.body.style.overflow='';activePlan=null;session=null}
function openWorkout(id){
 const plan=(window.MLC2Custom?.allPlans(plans)||plans).find(x=>x.id===id);if(!plan)return;activePlan=plan;
 session={sets:[]};
 openModal('<div class="modal-eyebrow">PRACTICE SESSION · LOCAL ONLY</div><h2>'+escapeHTML(plan.title)+'</h2><p>'+escapeHTML(plan.description)+' All entries stay in the isolated demo workspace and will not be uploaded to Supabase.</p><div id="workoutLog" class="workout-log"></div><div class="modal-footer"><button type="button" class="button-outline" id="cancelWorkout">Cancel</button><button type="button" class="button-outline" id="startRest">Rest 1:30</button><button type="button" class="button-primary" id="finishWorkout">Finish session</button></div>');
 renderWorkoutLog();
 $('cancelWorkout').addEventListener('click',closeModal);
 $('startRest').addEventListener('click',openRest);
 $('finishWorkout').addEventListener('click',()=>{
  if(!session?.sets.length){notice('Add at least one practice set first.');return}
  const entry={id:'demo-'+Date.now(),created:new Date().toISOString(),title:plan.title,planId:plan.id,sets:session.sets};
  demoSessions.unshift(entry);demoSessions=demoSessions.slice(0,100);
  try{storeDemo();closeModal();renderHome();setPage('progress');notice('Practice session saved in this browser.')}catch{notice('Could not save demo session; check browser storage.')}
 });
}
function renderWorkoutLog(){
 if(!activePlan)return;
 $('workoutLog').innerHTML=activePlan.ids.map(id=>{
  const e=libraryExercises().find(x=>x.id===id)||exercises.find(x=>x.id===id);
  const count=session.sets.filter(x=>x.exerciseId===id).length;
  return '<article class="log-card" data-exercise-card="'+id+'"><div class="log-title"><h4>'+escapeHTML(e.name)+'</h4><span class="logged-count" data-count="'+id+'">'+count+' logged</span></div><small>Target: '+e.sets+' sets × '+escapeHTML(e.reps)+' reps</small><div class="inputs"><label>Weight (lb)<input aria-label="'+escapeHTML(e.name)+' weight in pounds" type="number" min="0" max="1500" step="2.5" inputmode="decimal" data-weight="'+id+'" value="40"></label><label>Reps<input aria-label="'+escapeHTML(e.name)+' repetitions" type="number" min="1" max="100" step="1" inputmode="numeric" data-reps="'+id+'" value="10"></label><button class="button-outline" data-addset="'+id+'" type="button">Log set</button></div><div class="set-feedback" data-feedback="'+id+'" role="status" aria-live="polite"></div><button class="undo-set" data-undo="'+id+'" type="button" hidden>Undo last set</button></article>'
 }).join('');
}
function updateExerciseFeedback(id){
 const sets=session.sets.filter(x=>x.exerciseId===id);
 const count=document.querySelector('[data-count="'+id+'"]');
 const feedback=document.querySelector('[data-feedback="'+id+'"]');
 const undo=document.querySelector('[data-undo="'+id+'"]');
 if(count)count.textContent=sets.length+' logged';
 if(feedback)feedback.textContent=sets.length?('Last set: '+sets[sets.length-1].weight+' lb × '+sets[sets.length-1].reps+' reps'):'';
 if(undo)undo.hidden=sets.length===0;
}
function addSet(id){
 if(!session||!activePlan?.ids.includes(id))return;
 const weightField=document.querySelector('[data-weight="'+id+'"]');
 const repsField=document.querySelector('[data-reps="'+id+'"]');
 if(!weightField||!repsField)return;
 const weight=Number(weightField.value),reps=Number(repsField.value);
 if(weightField.value.trim()===''||repsField.value.trim()===''||!Number.isFinite(weight)||weight<0||weight>1500||!Number.isInteger(reps)||reps<1||reps>100){
  notice('Enter a valid weight and rep count.');return;
 }
 session.sets.push({exerciseId:id,weight,reps});
 // Update only this exercise: never erase inputs, keyboard focus, or scroll position.
 updateExerciseFeedback(id);
}
function undoSet(id){
 if(!session||!activePlan?.ids.includes(id))return;
 const index=session.sets.findLastIndex(x=>x.exerciseId===id);
 if(index<0)return;
 session.sets.splice(index,1);
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
 const e=exercises.find(x=>x.id===next);
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
 sessionStorage.setItem(AUTH_KEY,JSON.stringify(session));auth=session;account=data.user;renderSettings();
}
function clearAuth(){sessionStorage.removeItem(AUTH_KEY);auth=null;account=null;originalSnapshot=null;renderSettings();renderHistory();renderTracking();renderOriginalPlans()}
async function validateStoredAuth(){
 try{
  const saved=JSON.parse(sessionStorage.getItem(AUTH_KEY)||'null');
  if(!saved?.access_token||!saved?.user?.id)return;
  let token=saved.access_token;
  if(saved.expires_at<Date.now()/1000+45&&saved.refresh_token){
    const refreshed=await authRequest('token?grant_type=refresh_token',{refresh_token:saved.refresh_token});
    saveAuth(refreshed);token=refreshed.access_token;
  }else{auth=saved;account=saved.user}
  const user=await authRequest('user',null,token,'GET');
  if(!user?.id||user.id!==account.id)clearAuth();
 }catch{clearAuth()}
 renderSettings();
}
function openSignIn(){
 openModal('<div class="modal-eyebrow">EXISTING SUPABASE ACCOUNT</div><h2>Welcome back</h2><p>Use the email and password from your original MYLIFTCOACH account. This only verifies your identity; it will not import, overwrite, or modify workout records.</p><form id="loginForm" class="login-form"><label>Email<input name="email" type="email" autocomplete="email" autocapitalize="none" required></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><button class="button-primary" id="loginSubmit" type="submit">Sign in securely</button></form><p id="loginMessage" role="status"></p><p class="small">The training area stays in demo mode until the legacy data mapping is verified.</p>');
 $('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();const submit=$('loginSubmit');submit.disabled=true;submit.textContent='Connecting…';$('loginMessage').textContent='';
  const form=new FormData(event.currentTarget);
  try{
   const response=await authRequest('token?grant_type=password',{email:String(form.get('email')).trim(),password:String(form.get('password'))});
   if(!response?.access_token||!response?.user?.id)throw Error('No verified account was returned.');
   saveAuth(response);closeModal();notice('Account verified. This workspace remains demo-only.');setPage('home');
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

 $('heroStart').addEventListener('click',()=>openWorkout(nextPlan().id));
 $('heroViewPlan').addEventListener('click',()=>setPage('workouts'));
 $('todayStart').addEventListener('click',()=>openWorkout(nextPlan().id));
 $('workoutGrid').addEventListener('click',e=>{if(window.MLC2Custom?.handleClick(e,()=>{renderHome();renderWorkouts()},openWorkout))return;const el=e.target.closest('[data-workout]');if(el)openWorkout(el.dataset.workout)});
 $('createWorkout').addEventListener('click',()=>window.MLC2Custom?.openEditor(null,libraryExercises(),()=>{renderHome();renderWorkouts()}));
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
 $('clearDemo').addEventListener('click',()=>{if(!confirm('Delete only MYLIFTCOACH 2.0 practice sessions stored in this browser?'))return;demoSessions=[];localStorage.removeItem(DEMO_KEY);renderProgress();renderHome();notice('Local demo history cleared. Production data untouched.')});
 $('authAction').addEventListener('click',()=>{if(!account){openSignIn();return}clearAuth();notice('Signed out of 2.0. Original app session remains unchanged.')});
}
$('waterDay').value=localDayString();$('weightDay').value=localDayString();
document.body.classList.add('home-active');bind();window.MLC2BodyProgress?.init();renderHome();renderWorkouts();renderLibrary();renderProgress();renderSettings();validateStoredAuth();
})();