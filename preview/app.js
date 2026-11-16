/* MYLIFTCOACH 2.0 · Phase 1. No writes to production Supabase tables. */
(()=>{
'use strict';
const BACKEND='https://kirlpjflaoriiusfamsk.supabase.co';
const PUBLIC_KEY='sb_publishable_yYMnCM3k14zaEtpHo4-xkQ_Cd1Aty90';
const DEMO_KEY='mlc2-demo-workouts-v1'; // independent namespace, never original workout keys
const AUTH_KEY='mlc2-auth-session-v1'; // persistent login as original PRISM app; independent preview namespace
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
/* Guest data retain existing preview keys; signed-in data use distinct owner keys. */
const previewKey=key=>account?.id?key+':user:'+account.id:key;
let authChecking=Boolean(localStorage.getItem(AUTH_KEY)||sessionStorage.getItem(AUTH_KEY)),authUnavailable=false;
let demoSessions=loadDemo();
const TRACK_KEY='mlc2-local-daily-v1'; // New 2.0 log, NEVER a legacy key
let trackingEntries=loadLocalTracking();
let originalSnapshot=null;
const CUSTOM_KEY='mlc2-custom-plans-v1',MEASUREMENT_KEY='mlc2-measurements-v1',NUTRITION_KEY='mlc2-food-log-v1',GOALS_KEY='mlc2-food-goals-v1';
const readPreview=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(previewKey(key))||'null');return value??fallback}catch{return fallback}};
let customPlans=readPreview(CUSTOM_KEY,[]);if(!Array.isArray(customPlans))customPlans=[];
let measurements=readPreview(MEASUREMENT_KEY,[]);if(!Array.isArray(measurements))measurements=[];
let meals=readPreview(NUTRITION_KEY,[]);if(!Array.isArray(meals))meals=[];
let nutritionGoals=readPreview(GOALS_KEY,{calories:2000,protein:140});
const allPlans=()=>[...plans,...customPlans];

let toastTimer;
let muscleFilter='';
let restSeconds=90,restPaused=true,restClock=null;
function loadDemo(){try{const a=JSON.parse(localStorage.getItem(previewKey(DEMO_KEY))||'[]');return Array.isArray(a)?a.filter(x=>x&&Array.isArray(x.sets)).slice(0,100):[]}catch{return []}}
function storeDemo(){localStorage.setItem(previewKey(DEMO_KEY),JSON.stringify(demoSessions))}
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
 return {sessions,plans,water,weight};
}
function localDayString(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function loadLocalTracking(){
 try{const data=JSON.parse(localStorage.getItem(previewKey(TRACK_KEY))||'[]');return Array.isArray(data)?data.filter(x=>x&&['water','weight'].includes(x.type)&&Number.isFinite(Number(x.value))&&Number(x.value)>0&&/^\d{4}-\d\d-\d\d$/.test(x.day)).slice(0,400):[]}catch{return []}
}
function persistLocalTracking(){localStorage.setItem(previewKey(TRACK_KEY),JSON.stringify(trackingEntries))}
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
 if(!originalSnapshot){$('originalTrackingSummary').textContent='';$('originalTrackingList').innerHTML='';return}
 $('originalTrackingSummary').textContent=originalSnapshot.water.length+' water entries · '+originalSnapshot.weight.length+' weight entries';
 const combined=[...originalSnapshot.water.map(x=>({...x,type:'water'})),...originalSnapshot.weight.map(x=>({...x,type:'weight'}))].sort((a,b)=>b.day.localeCompare(a.day)).slice(0,60);
 $('originalTrackingList').innerHTML=combined.length?combined.map(x=>'<div class="history-entry tracking-row"><div><strong>'+escapeHTML(x.type==='water'?'Water':'Body weight')+'</strong><small>'+escapeHTML(x.day)+' · '+escapeHTML(String(x.type==='water'?Math.round(x.amount):x.value))+(x.type==='water'?' mL':' lb')+'</small></div><span class="micro-tag">ORIGINAL</span></div>').join(''):'<p class="empty-note">No original daily tracking records found on this browser. Cloud data was not queried or altered.</p>';
}
/* Read-only history-derived calendar. This does not write to original storage or Supabase. */
let calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let selectedCalendarDay='';
function dateKey(value){
 const d=new Date(value);
 if(!Number.isFinite(d.getTime()))return '';
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
function calendarSources(){
 return [...demoSessions.map(s=>({date:dateKey(s.created),title:s.title,kind:'2.0 practice',sets:s.sets.map(x=>({name:exercises.find(e=>e.id===x.exerciseId)?.name||x.exerciseId,weight:Number(x.weight),reps:Number(x.reps)}))})),...(originalSnapshot?.sessions||[]).map(s=>({date:dateKey(s.date),title:s.title,kind:'Original · read-only',sets:s.exercises.flatMap(e=>e.sets.map(x=>({name:e.name,weight:Number(x.weight),reps:Number(x.reps)})))}))].filter(s=>s.date);
}
function renderCalendar(){
 const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth();
 $('calendarMonthLabel').textContent=calendarCursor.toLocaleDateString(undefined,{month:'long',year:'numeric'});
 const first=new Date(year,month,1).getDay(),days=new Date(year,month+1,0).getDate();
 const entries=calendarSources(),counts=new Map();
 entries.forEach(s=>counts.set(s.date,(counts.get(s.date)||0)+1));
 let cells='<div class="calendar-weekday">Sun</div><div class="calendar-weekday">Mon</div><div class="calendar-weekday">Tue</div><div class="calendar-weekday">Wed</div><div class="calendar-weekday">Thu</div><div class="calendar-weekday">Fri</div><div class="calendar-weekday">Sat</div>';
 for(let i=0;i<first;i++)cells+='<span class="calendar-empty" aria-hidden="true"></span>';
 for(let i=1;i<=days;i++){
  const key=[year,String(month+1).padStart(2,'0'),String(i).padStart(2,'0')].join('-'),count=counts.get(key)||0;
  cells+='<button type="button" class="calendar-day'+(count?' has-session':'')+(selectedCalendarDay===key?' selected':'')+'" data-calendar-day="'+key+'" aria-label="'+key+', '+count+' workouts" aria-pressed="'+(selectedCalendarDay===key)+'">'+i+(count?'<small>'+count+'</small>':'')+'</button>';
 }
 $('calendarGrid').innerHTML=cells;
 const dayItems=entries.filter(s=>s.date===selectedCalendarDay);
 $('calendarDayDetails').innerHTML=selectedCalendarDay?(dayItems.length?dayItems.map(s=>'<div class="history-entry"><strong>'+escapeHTML(s.title)+'</strong><small>'+escapeHTML(s.kind)+' · '+s.sets.length+' sets</small></div>').join(''):'<p class="empty-note">No recorded sessions for '+escapeHTML(selectedCalendarDay)+'.</p>'):'<p class="empty-note">Select a date to review recorded sessions.</p>';
 const best=new Map();
 for(const session of entries)for(const set of session.sets){
  if(!Number.isFinite(set.weight)||!Number.isFinite(set.reps)||set.weight<0||set.reps<=0)continue;
  const key=String(set.name||'Exercise');
  const current=best.get(key);if(!current||set.weight>current.weight||(set.weight===current.weight&&set.reps>current.reps))best.set(key,{weight:set.weight,reps:set.reps,kind:session.kind});
 }
 $('calendarRecords').innerHTML=best.size?[...best].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,x])=>'<div class="history-entry"><strong>'+escapeHTML(name)+'</strong><small>Heaviest set: '+x.weight+' lb × '+x.reps+' reps · '+escapeHTML(x.kind)+'</small></div>').join(''):'<p class="empty-note">No saved sets to calculate records yet.</p>';
 $('calendarOriginalStatus').textContent=originalSnapshot?'Loaded '+originalSnapshot.sessions.length+' original sessions read-only from this browser.':'Original records not loaded. Preview data is separate.';
}

function viewOriginal(){originalSnapshot=getOriginalSnapshot();renderHistory();renderTracking();renderOriginalPlans();renderCalendar();notice('Original records checked locally. No original records were changed.')}
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
function setPage(next){if(!['welcome','home','workouts','library','progress','settings','coaching','nutrition','history','tracking','calendar','manage','measurements'].includes(next))return;page=next;
 document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==next);
 document.querySelectorAll('[data-page]').forEach(el=>{const is=el.dataset.page===next;el.classList.toggle('selected',is);el.classList.toggle('active',is);if(is)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
 $('pageTitle').textContent=({welcome:'Welcome',home:'Home',workouts:'Workouts',library:'Exercise library',progress:'Progress',settings:'My Account',coaching:'Coaching',nutrition:'Nutrition',history:'Workout history',tracking:'Daily tracking',calendar:'Calendar & records',manage:'Manage workouts',measurements:'Measurements'})[next];
 // A sidebar navigation click must move keyboard focus to the destination before
 // the mobile drawer becomes inert, rather than leaving focus in a hidden menu.
 const fromSidebar=$('sidebar').contains(document.activeElement);
 if(fromSidebar){const target=$(next);target.setAttribute('tabindex','-1');target.focus({preventScroll:true})}
 $('sidebar').classList.remove('open');$('sidebarScrim').classList.remove('open');document.body.classList.remove('sidebar-is-open');['menuBtn','homeMenuBtn','moreMenuBtn'].forEach(id=>$(id).setAttribute('aria-expanded','false'));$('sidebar').inert=window.matchMedia('(max-width:760px)').matches;document.body.classList.toggle('welcome-view',next==='welcome');document.body.classList.toggle('home-active',next==='home');window.scrollTo({top:0,behavior:'instant'});
 if(next==='home')renderHome();if(next==='workouts')renderWorkouts();if(next==='library')renderLibrary();
 if(next==='progress')renderProgress();if(next==='settings')renderSettings();if(next==='history')renderHistory();if(next==='tracking')renderTracking();if(next==='calendar')renderCalendar();if(next==='manage')renderCustomPlans();if(next==='measurements')renderMeasurements();if(next==='nutrition')renderNutrition();draftBanner();
}
function totalSets(){return demoSessions.reduce((n,x)=>n+x.sets.length,0)}
function nextPlan(){return plans[demoSessions.length%plans.length]}
function renderHome(){
 draftBanner();
 $('metricWorkouts').textContent=demoSessions.length;
 $('metricSets').textContent=totalSets();
 const plan=nextPlan();$('todayTitle').textContent=plan.title;$('todayDescription').textContent=plan.ids.length+' exercises · '+(plan.ids.length*3)+' sets · ~45 min';
 $('todayExercises').innerHTML=plan.ids.map(id=>{const e=exercises.find(x=>x.id===id);return '<div class="preview-exercise"><strong>'+escapeHTML(e.name)+'</strong><small>'+e.sets+' × '+escapeHTML(e.reps)+'</small></div>'}).join('');
 $('recentActivity').innerHTML=demoSessions.length?demoSessions.slice(0,3).map(x=>'<div class="recent-item"><div><strong>'+escapeHTML(x.title)+'</strong><small>'+new Date(x.created).toLocaleDateString()+'</small></div><span>'+x.sets.length+' sets</span></div>').join(''):'<div class="empty-note">Your next session starts here. Practice workouts you complete in this demo will appear in this section.</div>';
}
/* Device-only functionality. These namespaces are separate from the original app. */
function renderCustomPlans(){
 const list=$('customWorkoutList');
 list.innerHTML=customPlans.length?customPlans.map(p=>'<div class="history-entry mlc-list-row"><div><strong>'+escapeHTML(p.title)+'</strong><small>'+p.ids.length+' exercises</small></div><div class="mlc-mini-actions"><button type="button" data-custom-run="'+escapeHTML(p.id)+'">Start</button><button type="button" data-custom-edit="'+escapeHTML(p.id)+'">Edit</button><button type="button" data-custom-delete="'+escapeHTML(p.id)+'">Delete</button></div></div>').join(''):'<p class="empty-note">No custom workouts yet. Build one below.</p>';
 $('customExerciseOptions').innerHTML=exercises.map(e=>'<label class="mlc-option"><input type="checkbox" name="exercise" value="'+escapeHTML(e.id)+'"><span>'+escapeHTML(e.name)+'</span></label>').join('');
}
function clearCustomEditor(){
 $('customWorkoutForm').reset();$('customEditId').value='';$('customEditorTitle').textContent='Create a workout';
}
function saveCustomWorkout(e){
 e.preventDefault();const form=e.currentTarget,values=new FormData(form),title=String(values.get('title')||'').trim(),ids=values.getAll('exercise').filter(id=>exercises.some(x=>x.id===id));
 if(!title||title.length>65||ids.length<1||ids.length>12){notice('Give the workout a name and choose 1–12 exercises.');return}
 const editId=String(values.get('editId')||''),existing=customPlans.find(x=>x.id===editId),id=existing?.id||'custom-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
 const item={id,title,kind:'Custom',description:String(values.get('description')||'').trim().slice(0,160)||'My custom training session.',ids};
 const previous=[...customPlans];customPlans=existing?customPlans.map(x=>x.id===id?item:x):[...customPlans,item];
 try{localStorage.setItem(previewKey(CUSTOM_KEY),JSON.stringify(customPlans));clearCustomEditor();renderCustomPlans();renderWorkouts();notice('Custom workout saved in this preview.')}catch{customPlans=previous;notice('Could not save the custom workout.')}
}
function editCustomPlan(id){
 const p=customPlans.find(x=>x.id===id);if(!p)return;
 renderCustomPlans();$('customEditId').value=p.id;$('customWorkoutName').value=p.title;$('customWorkoutDesc').value=p.description;
 document.querySelectorAll('#customExerciseOptions input').forEach(x=>x.checked=p.ids.includes(x.value));
 $('customEditorTitle').textContent='Edit custom workout';$('customWorkoutName').focus();
}
function removeCustomPlan(id){
 const p=customPlans.find(x=>x.id===id);if(!p||!confirm('Delete this preview custom workout?'))return;
 const previous=[...customPlans];customPlans=customPlans.filter(x=>x.id!==id);
 try{localStorage.setItem(previewKey(CUSTOM_KEY),JSON.stringify(customPlans));renderCustomPlans();renderWorkouts();notice('Custom workout deleted from preview only.')}catch{customPlans=previous;notice('Could not delete custom workout.')}
}
function saveMeasurements(e){
 e.preventDefault();const data=new FormData(e.currentTarget),day=String(data.get('day')||'');
 const keys=['waist','chest','hips','arm','thigh'],values={};for(const key of keys){const raw=String(data.get(key)||'').trim();if(raw){const n=Number(raw);if(!Number.isFinite(n)||n<=0||n>100){notice('Check measurement values.');return}values[key]=n}}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Object.keys(values).length){notice('Enter a date and at least one measurement.');return}
 const previous=[...measurements];measurements.unshift({id:'measure-'+Date.now(),day,values});measurements=measurements.slice(0,200);
 try{localStorage.setItem(previewKey(MEASUREMENT_KEY),JSON.stringify(measurements));renderMeasurements();e.currentTarget.reset();$('measurementDate').value=localDayString();notice('Measurements saved locally.')}catch{measurements=previous;notice('Could not save measurements.')}
}
function renderMeasurements(){
 $('measurementHistory').innerHTML=measurements.length?measurements.slice(0,50).map(m=>'<div class="history-entry mlc-list-row"><div><strong>'+escapeHTML(m.day)+'</strong><small>'+Object.entries(m.values||{}).map(([k,v])=>escapeHTML(k)+': '+escapeHTML(String(v))+' in').join(' · ')+'</small></div><button type="button" data-measure-delete="'+escapeHTML(m.id)+'">Remove</button></div>').join(''):'<p class="empty-note">No body measurements saved yet.</p>';
}
function saveMeal(e){
 e.preventDefault();const data=new FormData(e.currentTarget),name=String(data.get('name')||'').trim(),day=String(data.get('day')||''),values={};
 for(const key of ['calories','protein','carbs','fat']){values[key]=Number(data.get(key));if(!Number.isFinite(values[key])||values[key]<0||values[key]>10000){notice('Enter valid meal numbers.');return}}
 if(!name||name.length>80||!/^\d{4}-\d{2}-\d{2}$/.test(day)){notice('Enter a meal name and date.');return}
 const old=[...meals];meals.unshift({id:'meal-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),day,name,...values});meals=meals.slice(0,500);
 try{localStorage.setItem(previewKey(NUTRITION_KEY),JSON.stringify(meals));renderNutrition();e.currentTarget.reset();$('mealDate').value=localDayString();notice('Meal saved in preview.')}catch{meals=old;notice('Could not save meal.')}
}
function renderNutrition(){
 const form=$('nutritionGoalForm');form.elements.calories.value=nutritionGoals.calories||2000;form.elements.protein.value=nutritionGoals.protein||140;
 const today=localDayString(),todayMeals=meals.filter(x=>x.day===today),sum=k=>todayMeals.reduce((n,m)=>n+Number(m[k]||0),0);
 $('nutritionSummary').textContent='Today: '+Math.round(sum('calories'))+' / '+nutritionGoals.calories+' kcal · '+Math.round(sum('protein'))+' / '+nutritionGoals.protein+' g protein · '+Math.round(sum('carbs'))+' g carbs · '+Math.round(sum('fat'))+' g fat';
 $('nutritionHistory').innerHTML=meals.length?meals.slice(0,80).map(x=>'<div class="history-entry mlc-list-row"><div><strong>'+escapeHTML(x.name)+'</strong><small>'+escapeHTML(x.day)+' · '+Math.round(x.calories)+' kcal · P '+x.protein+'g · C '+x.carbs+'g · F '+x.fat+'g</small></div><button type="button" data-meal-delete="'+escapeHTML(x.id)+'">Remove</button></div>').join(''):'<p class="empty-note">No meals logged yet.</p>';
}
function saveGoals(e){
 e.preventDefault();const d=new FormData(e.currentTarget),calories=Number(d.get('calories')),protein=Number(d.get('protein'));
 if(!Number.isFinite(calories)||calories<500||calories>8000||!Number.isFinite(protein)||protein<0||protein>600){notice('Check your daily goals.');return}
 const old=nutritionGoals;nutritionGoals={calories,protein};
 try{localStorage.setItem(previewKey(GOALS_KEY),JSON.stringify(nutritionGoals));renderNutrition();notice('Nutrition goals saved in this browser.')}catch{nutritionGoals=old;notice('Could not save goals.')}
}

function renderWorkouts(){
 draftBanner();
 $('workoutGrid').innerHTML=allPlans().map((p,i)=>'<button type="button" class="workout-card" data-workout="'+p.id+'"><span class="number">SESSION 0'+(i+1)+' · '+escapeHTML(p.kind.toUpperCase())+'</span><h3>'+escapeHTML(p.title)+'</h3><p>'+escapeHTML(p.description)+'</p><div class="workout-meta"><span>'+p.ids.length+' movements · '+p.ids.length*3+' recommended sets</span><b>Open session ↗</b></div></button>').join('');
}
function renderLibrary(){
 const query=$('exerciseSearch').value.trim().toLowerCase();
 const matches=exercises.filter(e=>(!muscleFilter||e.group===muscleFilter)&&(e.name+' '+e.group).toLowerCase().includes(query));
 document.querySelectorAll('[data-muscle]').forEach(b=>b.classList.toggle('selected',b.dataset.muscle===muscleFilter));
 $('libraryGrid').innerHTML=matches.map(e=>'<article class="library-card reference-exercise"><img class="library-thumb" src="../assets/chest-press.svg" alt="" loading="lazy"><div class="library-info"><h3>'+escapeHTML(e.name)+'</h3><p>'+escapeHTML(e.group)+' · '+e.sets+' sets · '+escapeHTML(e.reps)+' reps</p><details><summary>Technique notes</summary><p>'+escapeHTML(e.cue)+'</p></details></div><span class="library-chevron">›</span></article>').join('')||'<p class="empty-note">No exercises match that search.</p>';
}
function renderProgress(){
 const movements=new Set(demoSessions.flatMap(x=>x.sets.map(y=>y.exerciseId)));
 $('progressSessions').textContent=demoSessions.length;$('progressSets').textContent=totalSets();$('progressMovements').textContent=movements.size;
 renderProgressChart();
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
function refreshPreviewOwner(){
 demoSessions=loadDemo();
 trackingEntries=loadLocalTracking();
 customPlans=readPreview(CUSTOM_KEY,[]);if(!Array.isArray(customPlans))customPlans=[];
 measurements=readPreview(MEASUREMENT_KEY,[]);if(!Array.isArray(measurements))measurements=[];
 meals=readPreview(NUTRITION_KEY,[]);if(!Array.isArray(meals))meals=[];
 nutritionGoals=readPreview(GOALS_KEY,{calories:2000,protein:140});
 originalSnapshot=null;
 if(!document.getElementById('home'))return;
 if(session){closeModal()}
 draftBanner();renderHome();renderWorkouts();renderProgress();renderTracking();
 renderMeasurements();renderNutrition();renderCustomPlans();renderHistory();renderOriginalPlans();
}
function updateConnectivity(){
 const online=navigator.onLine;
 const status=$('connectivityStatus');
 if(status)status.textContent=online?'Online · records saved on this device only':'Offline · records saved on this device only';
 const cloud=$('cloudSyncStatus');
 if(cloud)cloud.textContent=authChecking?'Checking account…':authUnavailable?'Account service unavailable · no cloud sync':account?'Automatic workout sync · '+autoSyncState:'Sign in to enable automatic workout sync';
 renderSettings();
}
function downloadPreviewBackup(){
 const keys=[DEMO_KEY,TRACK_KEY,CUSTOM_KEY,MEASUREMENT_KEY,NUTRITION_KEY,GOALS_KEY],snapshot={};
 try{
  for(const key of keys){const raw=localStorage.getItem(previewKey(key));if(raw!==null){const value=JSON.parse(raw);snapshot[key]=value;}}
  const active=readDraft();
  if(active)snapshot.activeWorkout=active;
  const payload={format:'MYLIFTCOACH-2.0-local-export-v1',createdAt:new Date().toISOString(),owner:account?.id||'guest',data:snapshot};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='myliftcoach-preview-backup-'+localDayString()+'.json';document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  notice('Device backup export created. Keep this file private; it contains workout records.');
 }catch{notice('Could not export the preview backup. Your saved data was not changed.')}
}


/* Explicit opt-in 2.0-only cloud transfer. No upload on sign-in, app startup,
   session completion, refresh or reconnect. Never writes original PRISM tables. */
let cloudOperationBusy=false;
const cloudActionMessage=message=>{const el=$('cloudActionStatus');if(el)el.textContent=message};
function validCloudSession(value){
 return value&&typeof value==='object'&&typeof value.id==='string'&&/^demo-draft-[a-z0-9-]+$/.test(value.id)&&
  value.id.length<=160&&typeof value.title==='string'&&value.title.length<=110&&
  typeof value.created==='string'&&Number.isFinite(Date.parse(value.created))&&
  Array.isArray(value.sets)&&value.sets.length>=1&&value.sets.length<=300&&
  value.sets.every(set=>set&&typeof set.exerciseId==='string'&&set.exerciseId.length<=100&&
   Number.isFinite(set.weight)&&set.weight>=0&&set.weight<=1500&&
   Number.isInteger(set.reps)&&set.reps>=1&&set.reps<=100);
}
async function verifiedCloudAccess(){
 if(!account?.id||!navigator.onLine)throw Error('Sign in and connect to the internet first.');
 if(!window.MLC2Sync||!window.MLC2SupabaseTransport)throw Error('Cloud sync modules are unavailable.');
 let creds=readStoredAuth();
 if(!creds||creds.user?.id!==account.id)throw Error('Your account must be verified again.');
 if(creds.expires_at<Date.now()/1000+60){
  await validateStoredAuth();creds=readStoredAuth();
  if(!account?.id||!creds?.access_token||creds.user?.id!==account.id)throw Error('Account verification failed.');
 }
 const who=await authRequest('user',null,creds.access_token,'GET');
 if(!who?.id||who.id!==account.id)throw Error('Account identity mismatch.');
 return {
  owner:who.id,
  transport:window.MLC2SupabaseTransport.create({
   baseUrl:BACKEND,publishableKey:PUBLIC_KEY,fetcher:window.fetch.bind(window),
   enabled:true,
   getVerifiedAuth:async()=>{
    const c=readStoredAuth();
    if(!c||c.user?.id!==who.id||c.expires_at<Date.now()/1000+30)throw Error('Sign-in needs renewal.');
    return {userId:who.id,accessToken:c.access_token};
   }
  })
 };
}
async function listCloudSessions(transport,owner){
 let rows=[],afterId='';
 for(let page=0;page<20;page++){
  const next=await transport.listSessions(owner,{afterId,limit:50});
  if(!next.length)return rows;
  if(next.some(x=>x.id<=afterId))throw Error('Cloud pagination is not ordered.');
  rows.push(...next);
  if(next.length<50)return rows;
  afterId=next[next.length-1].id;
 }
 throw Error('Cloud session list exceeds recovery limit. No changes made.');
}
function canonicalCloudValue(value){
 if(Array.isArray(value))return value.map(canonicalCloudValue);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonicalCloudValue(value[k])]));
 return value;
}
async function manuallyUploadWorkouts(){
 if(cloudOperationBusy)return;
 if(!account?.id){cloudActionMessage('Sign in to your existing MYLIFTCOACH account first.');return}
 const local=demoSessions.filter(validCloudSession);
 if(!local.length){cloudActionMessage('No completed 2.0 workouts are ready to sync.');return}
 if(!confirm('Upload '+local.length+' completed MYLIFTCOACH 2.0 workouts to your private cloud space? Original workouts will not be changed.'))return;
 cloudOperationBusy=true;cloudActionMessage('Verifying your account and checking cloud history…');
 const selectedOwner=account.id;
 try{
  const {owner,transport}=await verifiedCloudAccess();
  if(owner!==selectedOwner)throw Error('Account changed.');
  const cloud=await listCloudSessions(transport,owner);
  const remote=new Map(cloud.map(x=>[x.id,x]));
  const engine=window.MLC2Sync.create({owner,storage:localStorage,transport,enabled:true});
  const queued=new Set(engine.list().items.map(x=>x.id));
  let added=0,conflicts=0,existing=0;
  for(const row of local){
   const previous=remote.get(row.id);
   if(previous){
    if(previous.deleted||JSON.stringify(canonicalCloudValue(previous.payload))!==JSON.stringify(canonicalCloudValue(row)))conflicts++;
    else existing++;
    continue;
   }
   if(queued.has(row.id))continue;
   engine.enqueue('session',row.id,row,0);added++;
  }
  const result=await engine.drain({verifiedOwner:owner,online:navigator.onLine});
  if(account?.id!==owner)throw Error('Account changed during sync. Review before retrying.');
  cloudActionMessage('Cloud upload: '+(result.sent||0)+' confirmed, '+existing+' already saved, '+conflicts+' different versions, '+result.pending+' pending. Status: '+result.status+'.');
 }catch(err){cloudActionMessage('Cloud upload paused: '+String(err.message||err).slice(0,130)+'. Local workouts preserved.')}
 finally{cloudOperationBusy=false}
}
async function manuallyRestoreWorkouts(){
 if(cloudOperationBusy)return;
 cloudOperationBusy=true;cloudActionMessage('Checking your cloud workout history…');
 const selectedOwner=account?.id;
 try{
  const {owner,transport}=await verifiedCloudAccess();
  if(owner!==selectedOwner)throw Error('Account changed.');
  const cloud=await listCloudSessions(transport,owner);
  const existing=new Set(demoSessions.map(x=>x.id));
  const missing=cloud.filter(row=>!row.deleted&&!existing.has(row.id)&&validCloudSession(row.payload)&&row.payload.id===row.id);
  const invalid=cloud.filter(row=>!row.deleted&&!validCloudSession(row.payload)).length;
  if(!missing.length){cloudActionMessage('No missing cloud workouts found. '+cloud.length+' cloud records checked'+(invalid?' · '+invalid+' invalid records skipped':'')+'.');return}
  if(!confirm('Restore '+missing.length+' missing MYLIFTCOACH 2.0 workouts to this device? Existing workouts will remain unchanged.')){cloudActionMessage('Recovery canceled. No workouts were changed.');return}
  if(account?.id!==owner)throw Error('Account changed.');
  const current=loadDemo(),ids=new Set(current.map(x=>x.id));
  const safe=missing.map(x=>x.payload).filter(x=>!ids.has(x.id));
  if(current.length+safe.length>100)throw Error('Local history limit reached. Export a device backup before restoring.');
  const previous=demoSessions;
  demoSessions=[...current,...safe].sort((a,b)=>String(b.created).localeCompare(String(a.created)));
  try{storeDemo()}catch(err){demoSessions=previous;throw Error('Local storage failed; nothing imported.')}
  renderHome();renderProgress();renderHistory();
  cloudActionMessage('Restored '+safe.length+' missing 2.0 workouts. Existing workouts preserved.');
 }catch(err){cloudActionMessage('Cloud recovery paused: '+String(err.message||err).slice(0,130)+'. Local workouts preserved.')}
 finally{cloudOperationBusy=false}
}

/* Automatic sync is account-only, local-first, and restricted to completed
   MYLIFTCOACH 2.0 sessions. Never uploads original PRISM records or guest data.
   Browser wake/online events schedule retries; there is no background-worker claim. */
let autoSyncTimer=null,autoSyncActive=false,autoSyncAttempts=0,autoSyncState='Waiting for sign-in';
function setAutoSyncState(message){
 autoSyncState=message;
 const el=$('autoSyncStatus');if(el)el.textContent=message;
 const cloud=$('cloudSyncStatus');if(cloud&&!authChecking&&!authUnavailable)cloud.textContent=
  account?'Automatic workout sync · '+message:'Sign in to enable automatic workout sync';
}
function cancelAutoSync(){
 if(autoSyncTimer!==null){clearTimeout(autoSyncTimer);autoSyncTimer=null}
 autoSyncAttempts=0;
 setAutoSyncState('Waiting for sign-in');
}
function scheduleAutoSync(delay=1200){
 if(!account?.id||!window.MLC2Sync||!window.MLC2SupabaseTransport)return;
 if(autoSyncTimer!==null)clearTimeout(autoSyncTimer);
 if(!navigator.onLine){setAutoSyncState('Offline · workouts safe on device');return}
 const owner=account.id;
 autoSyncTimer=setTimeout(()=>{
  autoSyncTimer=null;
  if(account?.id===owner)void flushAutoSync();
 },Math.max(0,delay));
}
function queueCompletedWorkout(entry){
 if(!account?.id||!validCloudSession(entry))return;
 try{
  const engine=window.MLC2Sync.create({owner:account.id,storage:localStorage});
  if(!engine.list().items.some(op=>op.type==='session'&&op.id===entry.id)){
   engine.enqueue('session',entry.id,entry,0);
  }
  setAutoSyncState(navigator.onLine?'Workout queued for cloud':'Offline · workout queued safely');
 }catch(err){
  // A successful completed workout is already committed locally; a failed
  // journal write does not remove the workout. Online reconciliation retries.
  setAutoSyncState('Saved locally · cloud queue needs retry');
 }
 scheduleAutoSync();
}
async function flushAutoSync(){
 if(!account?.id)return;
 if(autoSyncActive||cloudOperationBusy){scheduleAutoSync(8000);return}
 if(!navigator.onLine){setAutoSyncState('Offline · workouts safe on device');return}
 const selectedOwner=account.id;
 autoSyncActive=true;cloudOperationBusy=true;renderSettings();
 setAutoSyncState('Checking cloud…');
 try{
  const {owner,transport}=await verifiedCloudAccess();
  if(owner!==selectedOwner||account?.id!==owner)throw Error('Account changed');
  const remote=await listCloudSessions(transport,owner);
  if(account?.id!==owner)throw Error('Account changed');
  const cloudById=new Map(remote.map(row=>[row.id,row]));
  const engine=window.MLC2Sync.create({owner,storage:localStorage,transport,enabled:true});
  const pending=new Set(engine.list().items.filter(x=>x.type==='session').map(x=>x.id));
  let changed=0,already=0;
  for(const entry of loadDemo().filter(validCloudSession)){
   const exists=cloudById.get(entry.id);
   if(exists){
    if(exists.deleted||JSON.stringify(canonicalCloudValue(exists.payload))!==JSON.stringify(canonicalCloudValue(entry))){
     changed++;
    }else already++;
    continue;
   }
   if(!pending.has(entry.id)){engine.enqueue('session',entry.id,entry,0);pending.add(entry.id)}
  }
  const result=await engine.drain({verifiedOwner:owner,online:navigator.onLine,maxOperations:50});
  if(account?.id!==owner)return;
  const conflicts=engine.list().items.filter(x=>x.status==='conflict').length;
  if(changed||conflicts||result.status==='conflict'){
   setAutoSyncState('Needs review · cloud version differs ('+(changed+conflicts)+')');
   return; // NEVER overwrite a remote workout automatically.
  }
  if(result.status==='retry'||result.status==='unverified-ack')throw Error('Cloud unavailable');
  if(result.status==='pending'||result.pending>0){
   setAutoSyncState('Uploading queued workouts · '+result.pending+' remaining');
   autoSyncAttempts=0;
   scheduleAutoSync(2500);
  }else{
   autoSyncAttempts=0;
   setAutoSyncState('Up to date · '+(already+(result.sent||0))+' workouts');
  }
 }catch(err){
  if(account?.id!==selectedOwner)return;
  autoSyncAttempts=Math.min(autoSyncAttempts+1,6);
  const delay=Math.min(300000,5000*Math.pow(2,autoSyncAttempts-1));
  setAutoSyncState(navigator.onLine?'Upload paused · local workouts safe · retry scheduled':'Offline · local workouts safe');
  if(navigator.onLine)scheduleAutoSync(delay);
 }finally{
  autoSyncActive=false;cloudOperationBusy=false;renderSettings();
 }
}

function renderSettings(){
 $('accountIdentity').textContent=account?.email?account.email+' · authenticated (original training data not loaded)':authChecking?'Verifying your saved sign-in…':authUnavailable?'Account verification unavailable · preview records remain on this device':'Not signed in. You can still explore the demo.';
 $('backendStatus').textContent=account?'VERIFIED':authChecking?'CHECKING':authUnavailable?'OFFLINE':'NOT CONNECTED';
 $('cloudPill').textContent=account?'SIGNED IN · AUTO SYNC':'DEVICE-ONLY PREVIEW';
 if($('cloudModeChip'))$('cloudModeChip').textContent=account?(navigator.onLine?'AUTO ON':'OFFLINE'):'DEVICE ONLY';
 $('authAction').textContent=account?'Sign out':authChecking?'Checking sign-in…':'Sign in with existing account';
 $('authAction').disabled=authChecking;
 $('cloudUploadSessions').disabled=authChecking||!account||cloudOperationBusy;
 $('cloudRestoreSessions').disabled=authChecking||!account||cloudOperationBusy;
 if($('autoSyncStatus'))$('autoSyncStatus').textContent=account?autoSyncState:'Waiting for sign-in';
 if($('connectivityStatus'))$('connectivityStatus').textContent=navigator.onLine?'Online · local device saving':'Offline · local device saving';
 if($('cloudSyncStatus'))$('cloudSyncStatus').textContent=authChecking?'Checking account…':authUnavailable?'Verification unavailable · local records safe':account?'Automatic workout sync · '+autoSyncState:'Sign in to enable automatic workout sync';
}

/* Recovery foundation: a separate preview-only, account-scoped active-session journal.
   Commit each set to storage *before* displaying success. No production key or cloud write. */
const DRAFT_PREFIX='mlc2-active-session-v1:';
const draftKey=()=>DRAFT_PREFIX+(account?.id||'guest');
function readDraft(){
 try{
  const raw=localStorage.getItem(draftKey());
  if(!raw||raw.length>125000)return null;
  const d=JSON.parse(raw);
  if(!d||d.version!==1||typeof d.id!=='string'||!/^draft-[a-z0-9-]+$/.test(d.id)||
    typeof d.planId!=='string'||!Array.isArray(d.ids)||!Array.isArray(d.sets)||
    d.ids.length<1||d.ids.length>24||d.sets.length>300||
    !d.ids.every(id=>exercises.some(e=>e.id===id))||
    !d.sets.every(x=>d.ids.includes(x.exerciseId)&&Number.isFinite(x.weight)&&x.weight>=0&&x.weight<=1500&&Number.isInteger(x.reps)&&x.reps>=1&&x.reps<=100))return null;
  if(demoSessions.some(x=>x.id==='demo-'+d.id))return null;
  return d;
 }catch{return null}
}
function writeDraft(d){
 try{localStorage.setItem(draftKey(),JSON.stringify(d));return true}
 catch{notice('Save failed. Storage may be full or blocked. Your previous saved sets remain intact.');return false}
}
function draftBanner(){
 let holder=$('activeDraftNotice');
 if(!holder){
  holder=document.createElement('div');holder.id='activeDraftNotice';
  holder.className='active-draft-notice';holder.setAttribute('role','status');
  const home=$('home'),workouts=$('workouts');
  home.prepend(holder);
  const other=holder.cloneNode(false);other.id='activeDraftWorkouts';workouts.prepend(other);
 }
 for(const id of ['activeDraftNotice','activeDraftWorkouts']){
  const el=$(id),d=readDraft();
  if(!el)continue;
  el.hidden=!d;
  if(d)el.innerHTML='<div><strong>Unfinished workout saved</strong><small>'+escapeHTML(d.title)+' · '+d.sets.length+' logged sets · stored on this device</small></div><div class="active-draft-actions"><button type="button" data-draft-action="resume">Resume workout</button><button type="button" data-draft-action="discard">Discard</button></div>';
 }
}
function discardDraft(){
 const d=readDraft();if(!d)return;
 if(!confirm('Discard the unfinished preview workout and its '+d.sets.length+' sets? Completed history is not affected.'))return;
 try{localStorage.removeItem(draftKey());draftBanner();notice('Unfinished preview workout discarded.')}
 catch{notice('Unable to discard this workout. Try again.')}
}
function resumeDraft(){
 const d=readDraft();if(!d){draftBanner();notice('No unfinished workout was found.');return}
 const plan=allPlans().find(x=>x.id===d.planId);
 const snapshot=plan&&d.ids.every(id=>plan.ids.includes(id))?plan:{id:d.planId,title:d.title,description:'Recovered workout',ids:d.ids,kind:'Recovered'};
 openWorkout(d.planId,snapshot);
}

function openModal(content){$('modalContent').innerHTML=content;$('modal').hidden=false;document.body.style.overflow='hidden';$('closeModal').focus()}
function closeModal(){closeRest();$('modal').hidden=true;document.body.style.overflow='';activePlan=null;session=null;draftBanner()}
function openWorkout(id,recoveredPlan=null){
 const pending=readDraft();
 if(pending&&pending.planId!==id&&!recoveredPlan){
  notice('You have an unfinished workout. Resume it or discard it first to protect saved sets.');
  draftBanner();setPage('workouts');return;
 }
 const plan=recoveredPlan||allPlans().find(x=>x.id===id);
 if(!plan)return;
 const saved=pending?.planId===id?pending:null;
 const next=saved||{
  version:1,id:'draft-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
  planId:plan.id,title:plan.title,ids:[...plan.ids],startedAt:new Date().toISOString(),sets:[]
 };
 if(!saved&&!writeDraft(next))return;
 activePlan=plan;session=next;
 openModal('<div class="modal-eyebrow">PRACTICE SESSION · LOCAL ONLY</div><h2>'+escapeHTML(plan.title)+'</h2><p>'+escapeHTML(plan.description)+' Sets are saved to this device as you log them. Closing the dialog keeps the unfinished workout so you can resume after refresh.</p><div id="workoutLog" class="workout-log"></div><p id="draftSaveStatus" role="status" class="tracking-footnote">Saved on this device · '+session.sets.length+' sets</p><div class="modal-footer"><button type="button" class="button-outline" id="cancelWorkout">Close · keep saved</button><button type="button" class="button-outline" id="startRest">Rest 1:30</button><button type="button" class="button-primary" id="finishWorkout">Finish session</button></div>');
 renderWorkoutLog();
 for(const exerciseId of plan.ids)updateExerciseFeedback(exerciseId);
 draftBanner();
 $('cancelWorkout').addEventListener('click',closeModal);
 $('startRest').addEventListener('click',openRest);
 $('finishWorkout').addEventListener('click',()=>{
  if(!session?.sets.length){notice('Add at least one practice set first.');return}
  const entry={id:'demo-'+session.id,created:new Date().toISOString(),title:plan.title,planId:plan.id,sets:session.sets.map(x=>({...x}))};
  const previous=demoSessions;
  demoSessions=[entry,...demoSessions.filter(x=>x.id!==entry.id)].slice(0,100);
  try{storeDemo();}
  catch{demoSessions=previous;notice('Workout not finished: history could not be saved. Your draft remains available.');return;}
  try{localStorage.removeItem(draftKey());}catch{ /* completed ID prevents duplicate restoration */ }
  closeModal();renderHome();setPage('progress');
  queueCompletedWorkout(entry);
  notice('Workout saved on this device. Cloud sync will upload it when available.');
 });
}
function renderWorkoutLog(){
 if(!activePlan)return;
 $('workoutLog').innerHTML=activePlan.ids.map(id=>{
  const e=exercises.find(x=>x.id===id);
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
 const next={...session,sets:[...session.sets,{exerciseId:id,weight,reps}],updatedAt:new Date().toISOString()};
 if(!writeDraft(next))return;
 session=next;
 // Update only this exercise: never erase inputs, keyboard focus, or scroll position.
 updateExerciseFeedback(id);
 $('draftSaveStatus').textContent='Saved on this device · '+session.sets.length+' sets';
}
function undoSet(id){
 if(!session||!activePlan?.ids.includes(id))return;
 const index=session.sets.findLastIndex(x=>x.exerciseId===id);
 if(index<0)return;
 const next={...session,sets:session.sets.filter((_,i)=>i!==index),updatedAt:new Date().toISOString()};
 if(!writeDraft(next))return;
 session=next;
 updateExerciseFeedback(id);
 $('draftSaveStatus').textContent='Saved on this device · '+session.sets.length+' sets';
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

/* Original PRISM login lifecycle adapted to a separate 2.0 key:
   localStorage persistence, 60s refresh buffer, authenticated /user check,
   and server-side signout. Never read/write prismSupabaseSessionV1. */
function readStoredAuth(){
 try {
  const raw=localStorage.getItem(AUTH_KEY)||sessionStorage.getItem(AUTH_KEY);
  if(!raw||raw.length>30000)return null;
  const found=JSON.parse(raw);
  return found?.access_token&&found?.user?.id?found:null;
 }catch{return null}
}
function persistAuth(credentials){
 // Write before switching any in-memory identity. On quota failure,
 // refuse to claim login persisted; never write production auth keys.
 localStorage.setItem(AUTH_KEY,JSON.stringify(credentials));
 sessionStorage.removeItem(AUTH_KEY);
}
async function signOutAccount(){
 if(authChecking)return;
 const token=auth?.access_token||readStoredAuth()?.access_token;
 try {
  if(token)await authRequest('logout',null,token,'POST');
 }catch(e){
  // Local sign-out still hides this account's data even if offline;
  // server session naturally expires. Do not touch the original app's session.
 }
 clearAuth();
 notice('Signed out of MYLIFTCOACH 2.0. Original app login unchanged.');
}
function openPasswordRecovery(){
 openModal('<div class="modal-eyebrow">EXISTING PRISM ACCOUNT</div><h2>Reset password</h2><p>Enter the email for your existing MYLIFTCOACH account. We will email a recovery link using your original Supabase backend.</p><form id="resetPasswordForm" class="login-form"><label>Email<input type="email" name="email" autocomplete="email" autocapitalize="none" required></label><button type="submit" class="button-primary" id="resetPasswordSubmit">Email recovery link</button></form><p id="resetPasswordStatus" role="status"></p><button type="button" class="button-outline" id="resetBackToLogin">Back to sign in</button>');
 $('resetBackToLogin').addEventListener('click',openSignIn);
 $('resetPasswordForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=$('resetPasswordSubmit');btn.disabled=true;
  try{
   const email=String(new FormData(e.currentTarget).get('email')||'').trim();
   // Keep reset callback on the same 2.0 origin; do not modify production account routes.
   const redirect=new URL('.',window.location.href).href;
   await authRequest('recover?redirect_to='+encodeURIComponent(redirect),{email});
   $('resetPasswordStatus').textContent='If this email belongs to an account, a recovery link will be sent.';
  }catch(err){$('resetPasswordStatus').textContent='Could not send the recovery link. Check your connection and try again.'}
  finally{btn.disabled=false}
 });
}

function saveAuth(data){
 if(!data?.access_token||!data?.user?.id)throw Error('Verified credentials required.');
 const previous=account?.id||null;
 const credentials={access_token:data.access_token,refresh_token:data.refresh_token,user:data.user,expires_at:Number.isFinite(Number(data.expires_at))&&Number(data.expires_at)>0?Number(data.expires_at):Math.floor(Date.now()/1000)+(Number(data.expires_in)||3600)};
 persistAuth(credentials);
 auth=credentials;account=data.user;authChecking=false;authUnavailable=false;
 if(previous!==account.id){cancelAutoSync();refreshPreviewOwner()}
 renderSettings();scheduleAutoSync(900);
}
function clearAuth(){
 cancelAutoSync();
 localStorage.removeItem(AUTH_KEY);sessionStorage.removeItem(AUTH_KEY);auth=null;account=null;authChecking=false;authUnavailable=false;
 refreshPreviewOwner();renderSettings();
}
async function validateStoredAuth(){
 const saved=readStoredAuth();
 if(!saved?.access_token||!saved?.user?.id){authChecking=false;renderSettings();return}
 authChecking=true;renderSettings();
 try{
  let credentials=saved;
  if(saved.expires_at<Date.now()/1000+60&&saved.refresh_token){
    const refreshed=await authRequest('token?grant_type=refresh_token',{refresh_token:saved.refresh_token});
    credentials={...saved,...refreshed,user:refreshed.user||saved.user};
    credentials.expires_at=Math.floor(Date.now()/1000)+(refreshed.expires_in||3600);
  }
  const user=await authRequest('user',null,credentials.access_token,'GET');
  if(!user?.id||user.id!==saved.user.id){clearAuth();return}
  saveAuth({...credentials,user});
 }catch(e){
  // Connection drops are not sign-outs. Retain the token but do not expose
  // owner-scoped local data until Auth confirms the user.
  if(e?.status===400||e?.status===401||e?.status===403){clearAuth();return}
  authChecking=false;authUnavailable=true;auth=null;account=null;
  refreshPreviewOwner();renderSettings();
 }finally{authChecking=false;renderSettings()}
}
function openSignIn(){
 openModal('<div class="modal-eyebrow">EXISTING SUPABASE ACCOUNT</div><h2>Welcome back</h2><p>Use the email and password from your original MYLIFTCOACH account. This only verifies your identity; it will not import, overwrite, or modify workout records.</p><form id="loginForm" class="login-form"><label>Email<input name="email" type="email" autocomplete="email" autocapitalize="none" required></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><button class="button-primary" id="loginSubmit" type="submit">Sign in securely</button></form><button class="button-outline" id="forgotPassword" type="button">Forgot password?</button><p id="loginMessage" role="status"></p><p class="small">The training area stays in demo mode until the legacy data mapping is verified.</p>');
 $('forgotPassword').addEventListener('click',openPasswordRecovery);
 $('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();const submit=$('loginSubmit');submit.disabled=true;submit.textContent='Connecting…';$('loginMessage').textContent='';
  const form=new FormData(event.currentTarget);
  try{
   const response=await authRequest('token?grant_type=password',{email:String(form.get('email')).trim(),password:String(form.get('password'))});
   if(!response?.access_token||!response?.user?.id)throw Error('No verified account was returned.');
   const user=await authRequest('user',null,response.access_token,'GET');
   if(!user?.id||user.id!==response.user.id)throw Error('Sign-in identity verification failed.');
   saveAuth({...response,user});
   closeModal();notice('Account verified. Workout records remain device-only until cloud sync is enabled.');setPage('home');
  }catch(err){$('loginMessage').className='auth-error';$('loginMessage').textContent=err.name==='AbortError'?'The account service timed out.':/invalid/i.test(err.message)?'Email or password was not accepted.':'Could not sign in: '+String(err.message).slice(0,120)}
  finally{submit.disabled=false;submit.textContent='Sign in securely'}
 });
}
function bind(){
 document.addEventListener('click',e=>{const action=e.target.closest('[data-draft-action]');if(!action)return;if(action.dataset.draftAction==='resume')resumeDraft();else if(action.dataset.draftAction==='discard')discardDraft()});
 document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.page)));
 $('avatarBtn').addEventListener('click',()=>setPage('settings'));
 $('previewWelcome').addEventListener('click',()=>setPage('welcome'));
 $('welcomeExplore').addEventListener('click',()=>setPage('home'));
 $('welcomeSignIn').addEventListener('click',openSignIn);
 document.querySelectorAll('[data-shortcut]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.shortcut)));
 document.querySelectorAll('[data-coach-link]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.coachLink)));

 const sidebar=$('sidebar'),sidebarMobile=window.matchMedia('(max-width:760px)');
 let sidebarFocusReturn=null;
 function syncSidebar(){
  const open=sidebarMobile.matches&&sidebar.classList.contains('open');
  sidebar.inert=sidebarMobile.matches&&!open;
  $('sidebarScrim').classList.toggle('open',open);
  document.body.classList.toggle('sidebar-is-open',open);
  ['menuBtn','homeMenuBtn','moreMenuBtn'].forEach(id=>$(id).setAttribute('aria-expanded',String(open)));
 }
 function closeSidebar(){
  if(!sidebar.classList.contains('open'))return;
  if(sidebar.contains(document.activeElement)){
   const fallback=document.body.classList.contains('home-active')?$('homeMenuBtn'):$('menuBtn');
   const returnTarget=sidebarFocusReturn?.isConnected&&!sidebarFocusReturn.hidden?sidebarFocusReturn:fallback;
   returnTarget.focus();
  }
  sidebar.classList.remove('open');syncSidebar();
 }
 function openSidebar(){
  if(!sidebarMobile.matches)return;
  sidebarFocusReturn=document.activeElement;
  sidebar.classList.add('open');syncSidebar();$('sidebarClose').focus();
 }
 $('menuBtn').addEventListener('click',()=>sidebar.classList.contains('open')?closeSidebar():openSidebar());
 $('homeMenuBtn').addEventListener('click',()=>sidebar.classList.contains('open')?closeSidebar():openSidebar());
 $('moreMenuBtn').addEventListener('click',openSidebar);
 document.querySelectorAll('[data-sidebar-open]').forEach(el=>el.addEventListener('click',openSidebar));
 $('sidebarClose').addEventListener('click',closeSidebar);
 $('sidebarScrim').addEventListener('click',closeSidebar);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSidebar()});
 sidebarMobile.addEventListener('change',()=>{sidebar.classList.remove('open');syncSidebar()});
 syncSidebar();
 $('sidebarTimer').addEventListener('click',()=>{closeSidebar();openRest()});
 $('calendarPrevious').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar()});
 $('calendarNext').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar()});
 $('calendarGrid').addEventListener('click',event=>{const day=event.target.closest('[data-calendar-day]');if(day){selectedCalendarDay=day.dataset.calendarDay;renderCalendar()}});
 $('calendarLoadOriginal').addEventListener('click',viewOriginal);
 $('customWorkoutForm').addEventListener('submit',saveCustomWorkout);
 $('cancelCustomEdit').addEventListener('click',clearCustomEditor);
 $('customWorkoutList').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.customRun)openWorkout(b.dataset.customRun);else if(b.dataset.customEdit)editCustomPlan(b.dataset.customEdit);else if(b.dataset.customDelete)removeCustomPlan(b.dataset.customDelete)});
 $('measurementsForm').addEventListener('submit',saveMeasurements);
 $('measurementHistory').addEventListener('click',e=>{const b=e.target.closest('[data-measure-delete]');if(!b||!confirm('Remove this preview measurement?'))return;const old=[...measurements];measurements=measurements.filter(x=>x.id!==b.dataset.measureDelete);try{localStorage.setItem(previewKey(MEASUREMENT_KEY),JSON.stringify(measurements));renderMeasurements()}catch{measurements=old;notice('Could not remove entry.')}});
 $('mealForm').addEventListener('submit',saveMeal);
 $('nutritionGoalForm').addEventListener('submit',saveGoals);
 $('nutritionHistory').addEventListener('click',e=>{const b=e.target.closest('[data-meal-delete]');if(!b||!confirm('Remove this preview meal?'))return;const old=[...meals];meals=meals.filter(x=>x.id!==b.dataset.mealDelete);try{localStorage.setItem(previewKey(NUTRITION_KEY),JSON.stringify(meals));renderNutrition()}catch{meals=old;notice('Could not remove meal.')}});
 $('homeAccountBtn').addEventListener('click',()=>setPage('settings'));

 $('heroStart').addEventListener('click',()=>openWorkout(nextPlan().id));
 $('heroViewPlan').addEventListener('click',()=>setPage('workouts'));
 $('todayStart').addEventListener('click',()=>openWorkout(nextPlan().id));
 $('workoutGrid').addEventListener('click',e=>{const el=e.target.closest('[data-workout]');if(el)openWorkout(el.dataset.workout)});
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
 $('clearDemo').addEventListener('click',()=>{if(!confirm('Delete only MYLIFTCOACH 2.0 practice sessions stored in this browser?'))return;demoSessions=[];localStorage.removeItem(previewKey(DEMO_KEY));renderProgress();renderHome();notice('Local demo history cleared. Production data untouched.')});
 $('authAction').addEventListener('click',()=>{if(authChecking)return;if(!account){openSignIn();return}void signOutAccount()});
 $('backupPreview').addEventListener('click',downloadPreviewBackup);
 $('cloudUploadSessions').addEventListener('click',()=>void manuallyUploadWorkouts());
 $('cloudRestoreSessions').addEventListener('click',()=>void manuallyRestoreWorkouts());
 window.addEventListener('online',()=>{updateConnectivity();if(!account&&readStoredAuth())void validateStoredAuth();else scheduleAutoSync(400)});
 window.addEventListener('offline',()=>{updateConnectivity();if(autoSyncTimer!==null){clearTimeout(autoSyncTimer);autoSyncTimer=null}setAutoSyncState('Offline · workouts safe on device')});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateConnectivity();if(!account&&readStoredAuth()&&navigator.onLine)void validateStoredAuth();else scheduleAutoSync(500)}});
 window.addEventListener('storage',event=>{if(event.key&&event.key===previewKey(DEMO_KEY)){demoSessions=loadDemo();renderHome();renderProgress();scheduleAutoSync(1000)}});
 // Browser timers may pause in the background. Rechecking here is a best-effort
 // foreground retry, NOT a claim of persistent background execution.
 setInterval(()=>{if(!document.hidden&&account?.id&&navigator.onLine)scheduleAutoSync(200)},90000);

}
$('waterDay').value=localDayString();$('weightDay').value=localDayString();$('measurementDate').value=localDayString();$('mealDate').value=localDayString();
document.body.classList.add('home-active');bind();draftBanner();renderHome();renderWorkouts();renderLibrary();renderProgress();renderSettings();validateStoredAuth();
})();