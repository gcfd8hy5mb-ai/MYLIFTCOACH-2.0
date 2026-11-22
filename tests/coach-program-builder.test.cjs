'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Builder=require('../coach-program-builder.js');
const catalog=[
 {id:'chest-a',name:'Chest A',group:'Chest',equipment:'Machine'},
 {id:'chest-b',name:'Chest B',group:'Chest',equipment:'Dumbbell'},
 {id:'back-a',name:'Back A',group:'Back',equipment:'Machine'},
 {id:'back-b',name:'Back B',group:'Back',equipment:'Dumbbell'},
 {id:'legs-a',name:'Legs A',group:'Legs',equipment:'Machine'},
 {id:'legs-b',name:'Legs B',group:'Legs',equipment:'Dumbbell'},
 {id:'legs-c',name:'Legs C',group:'Legs',equipment:'Machine'},
 {id:'shoulder',name:'Shoulder',group:'Shoulders',equipment:'Machine'},
 {id:'arms',name:'Arms',group:'Arms',equipment:'Machine'},
 {id:'core',name:'Core',group:'Core',equipment:'Machine'},
 {id:'cardio',name:'Cardio',group:'Cardio',equipment:'Machine'}
];
test('3 4 5 day schedules are deterministic, catalog-only and do not assign imaginary weights',()=>{
 for(const days of [3,4,5]){
  const a=Builder.build(catalog,[],{days,goal:'balanced'});
  const b=Builder.build(catalog,[],{days,goal:'balanced'});
  assert.equal(a.status,'ready');assert.equal(a.days.length,days);
  assert.deepEqual(a,b);
  for(const day of a.days){
   const ids=day.exercises.map(e=>e.id);
   assert.equal(new Set(ids).size,ids.length);
   assert.ok(ids.every(id=>catalog.some(e=>e.id===id)));
   assert.ok(day.exercises.every(e=>e.weight===null));
  }
 }
});
test('Equipment filter never selects unavailable equipment and reports shortfalls',()=>{
 const result=Builder.build(catalog,[],{days:4,equipment:'Dumbbell'});
 assert.equal(result.status,'ready');assert.equal(result.limited,true);
 assert.ok(result.days.flatMap(d=>d.exercises).every(e=>e.equipment==='Dumbbell'));
 assert.equal(Builder.build(catalog,[],{days:3,equipment:'Barbell'}).status,'unavailable');
});
test('Training focus changes only sets and rep targets not recorded weights',()=>{
 const strength=Builder.build(catalog,[],{days:3,goal:'strength'});
 const muscle=Builder.build(catalog,[],{days:3,goal:'muscle'});
 assert.ok(strength.days.flatMap(d=>d.exercises).every(e=>e.reps==='5–8'&&e.weight===null));
 assert.ok(muscle.days.flatMap(d=>d.exercises).every(e=>e.reps==='8–12'&&e.weight===null));
});
test('History influences preference only from valid logged sets',()=>{
 const sessions=[{sets:[{exerciseId:'chest-b',weight:22.5,reps:10},{exerciseId:'chest-b',weight:22.5,reps:10},{exerciseId:'chest-b',weight:'',reps:10}]}];
 const counts=Builder.historyCounts(sessions);
 assert.equal(counts.get('chest-b'),2);
 assert.equal(Builder.build(catalog,sessions,{days:3}).days[0].exercises[0].id,'chest-b');
});
test('Program builder never changes existing workout selections or persistent data',()=>{
 const js=fs.readFileSync('coach-program-builder.js','utf8');
 const html=fs.readFileSync('index.html','utf8'),app=fs.readFileSync('app.js','utf8');
 assert.doesNotMatch(js,/\b(localStorage|sessionStorage|indexedDB|fetch|supabase|setItem|removeItem)\b/i);
 assert.ok(html.includes('coachProgramBuilder')&&html.includes('coach-program-builder.js'));
 assert.ok(app.includes("window.MLC2ProgramBuilder?.render($('coachProgramBuilder'),catalog,history,{"));
 assert.ok(app.includes("onSaveDay:day=>"));
 assert.ok(app.includes("['coachSuggestions','coachSubstitutions','coachProgramBuilder','coachPlanPreview']"));
 assert.ok(app.includes('function nextPlan()'));
});

test('Coach program Save Day requires confirmation and stays in the existing custom manager',()=>{
 const builder=fs.readFileSync('coach-program-builder.js','utf8');
 const custom=fs.readFileSync('custom-workouts.js','utf8');
 const app=fs.readFileSync('app.js','utf8');
 assert.ok(builder.includes("window.confirm('Save Coach Day '"));
 assert.ok(builder.includes("options.onSaveDay({day:d.day,exercises:d.exercises.map(e=>({...e}))})"));
 assert.ok(custom.includes('function saveCoachDay(day)'));
 assert.ok(custom.includes('persistPlans([plan,...existing])'));
 assert.ok(!custom.slice(custom.indexOf('function saveCoachDay(day)'),custom.indexOf('function allPlans(')).includes('scoped(TODAY)'));
 assert.ok(app.includes("if(betaView().mode!=='pro')throw Error"));
});
