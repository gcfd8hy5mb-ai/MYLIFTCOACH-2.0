'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const CoachPlan=require('../coach-plan-preview.js');
const catalog=[
 {id:'press',name:'Press',group:'Chest',equipment:'Machine'},
 {id:'row',name:'Row',group:'Back',equipment:'Cable'}
];
const custom={id:'custom-abc',title:'My Own Routine',ids:['row','press']};
test('Coach preview uses exact custom workout and retains exercise order',()=>{
 const v=CoachPlan.prepare(custom,catalog,[],{mode:'pro',readiness:'Normal',coach:{suggestion:()=>({status:'insufficient',reason:'Not enough sessions'})}});
 assert.equal(v.status,'ready');assert.equal(v.isCustom,true);
 assert.deepEqual(v.items.map(x=>x.id),['row','press']);
 assert.equal(v.items[0].status,'manual');
});
test('Free tier cannot access generated Pro Coach plan',()=>{
 assert.deepEqual(CoachPlan.prepare(custom,catalog,[],{mode:'free'}).items,[]);
 assert.equal(CoachPlan.prepare(custom,catalog,[],{mode:'free'}).status,'restricted');
});
test('Logged-set advice appears only when existing Coach rules are ready',()=>{
 const history=[{id:'s1',sets:[{exerciseId:'row',weight:55,reps:10}]}];
 const v=CoachPlan.prepare(custom,catalog,history,{mode:'pro',readiness:'Tired',coach:{suggestion:id=>id==='row'?{status:'ready',weight:55,action:'hold',reason:'Log-based hold'}:{status:'insufficient'}}});
 assert.equal(v.readiness,'Tired');assert.equal(v.items[0].weight,55);
 assert.equal(v.items[1].status,'manual');
});
test('No invented recommendations, auto edits, cloud calls or storage mutations',()=>{
 const js=fs.readFileSync('coach-plan-preview.js','utf8');
 assert.doesNotMatch(js,/\b(localStorage|sessionStorage|indexedDB|fetch|setItem|removeItem|supabase)\b/);
 const html=fs.readFileSync('index.html','utf8'),app=fs.readFileSync('app.js','utf8');
 assert.ok(html.includes('id="coachPlanPreview"')&&html.includes('coach-plan-preview.js'));
 assert.ok(app.includes('window.MLC2CoachPlan?.render('));
 assert.ok(app.includes('selected=nextPlan()'));
 assert.ok(app.includes("mode:mode.mode"));
 assert.ok(app.includes("else{$('coachSuggestions').replaceChildren();$('coachSubstitutions').replaceChildren();$('coachPlanPreview').replaceChildren()}"));
});
