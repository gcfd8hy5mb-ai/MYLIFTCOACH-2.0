'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const CoachPlan=require('../coach-plan-preview.js');
const source=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
test('Previously approved Coach planning panels remain present in combined redesign',()=>{
 for(const id of ['coachPlanPreview','coachProgramBuilder'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/coach-plan-preview\.js\?v=1/);
 assert.match(source,/MLC2CoachPlan\?\.render/);
 assert.match(source,/MLC2ProgramBuilder\?\.render/);
 assert.match(source,/MLC2Custom\?\.saveCoachDay\(day\)/);
 assert.match(source,/workoutPreviewKey\(nextPlan\(\)\)!==workoutPreviewKey\(selected\)/);
 assert.match(source,/renderHome\(\);renderWorkouts\(\);return saved/);
});
test('Read-only selected-workout Coach plan will not invent loads from no workout history',()=>{
 const plan={id:'custom-a',title:'Custom upper body',ids:['press']};
 const catalog=[{id:'press',name:'Press',group:'Chest',sets:3,reps:'8–12'}];
 const result=CoachPlan.prepare(plan,catalog,[],{mode:'pro',readiness:'Normal',coach:{suggestion:()=>({status:'insufficient'})}});
 assert.equal(result.items.length,1);
 assert.equal(result.items[0].weight,undefined);
});
test('No paid API or cloud write paths are present inside the read-only Coach plan engine',()=>{
 const js=fs.readFileSync('coach-plan-preview.js','utf8');
 assert.doesNotMatch(js,/\b(localStorage|sessionStorage|fetch|indexedDB|supabase|setItem|removeItem)\b/i);
});
