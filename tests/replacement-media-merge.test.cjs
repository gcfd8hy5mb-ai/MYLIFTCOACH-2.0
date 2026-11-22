'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=require('node:path').resolve(__dirname,'..');
const load=p=>fs.readFileSync(require('node:path').join(root,p),'utf8');
test('344 exercise catalog and 263-approved manifest have no duplicate or missing image files',()=>{
 const env={window:{}};vm.runInNewContext(load('exercise-catalog-344.js'),env);
 vm.runInNewContext(load('approved-visuals-manifest.js'),env);
 const items=env.window.MLC2_EXERCISE_CATALOG,manifest=env.window.MLC2_APPROVED_VISUALS;
 assert.equal(items.length,344);
 assert.equal(manifest.length,263);
 const ids=new Set(items.map(x=>x.id)),approved=new Set();
 for(const entry of manifest){
  assert.ok(ids.has(entry.id),'unrecognized approved exercise '+entry.id);
  assert.ok(!approved.has(entry.id),'duplicate approved exercise '+entry.id);
  approved.add(entry.id);
  for(const p of [entry.image,entry.thumbnail]){
   assert.match(p,/^assets\/exercise-demonstrations\/[A-Za-z0-9._-]+\.webp$/);
   assert.ok(fs.existsSync(require('node:path').join(root,p)),'missing approved artwork '+p);
  }
 }
 assert.ok(fs.existsSync(require('node:path').join(root,'assets/image-coming-approved.webp')));
 assert.equal(items.length-approved.size,81);
});
test('Integrated UI displays approved pictures on Home, custom routine cards, library and active workout',()=>{
 const html=load('index.html'),app=load('app.js');
 for(const script of ['exercise-catalog-344.js','approved-visuals-manifest.js','exercise-visuals-344.js','app.js','active-exercise-guide.js'])
  assert.ok(html.includes('src="./'+script+'?'),'missing combined script '+script);
 const sequence=['exercise-catalog-344.js','approved-visuals-manifest.js','exercise-visuals-344.js','app.js','active-exercise-guide.js'].map(x=>html.indexOf('src="./'+x+'?'));
 assert.ok(sequence.every((n,i)=>n>=0&&(i===0||n>sequence[i-1])),'approved images load after catalog, and workout guide after app');
 assert.match(app,/function approvedFullImage\(e\)/);
 assert.match(app,/function wireWorkoutPreviewImages\(root\)/);
 assert.match(app,/preview-exercise-picture/);
 assert.match(app,/workout-compact-illustration/);
 assert.match(app,/approvedMediaStatus/);
 assert.match(app,/data-library-full/);
 assert.match(load('active-exercise-guide.js'),/thumbnail\.src=imgFor\(e\)/);
 assert.match(load('active-exercise-guide.js'),/context\.insertAdjacentElement\('afterend',wrap\)/);
});
test('Combined Coach and goal features remain in approved deep teal release without paid API',()=>{
 const html=load('index.html'),app=load('app.js');
 for(const p of ['goal-program-calendar.js','goal-program-source.js','coach-periodization.js','coach-preferences.js','calorie-goal-estimate.js','live-coach-workout.css']){
  assert.ok(html.includes(p),'missing Coach integration '+p);
 }
 assert.match(app,/function coachProgramAdvice\(plan\)/);
 assert.match(app,/function coachAutonomousPlan\(\)/);
 assert.match(app,/function renderCalorieGoal\(\)/);
 assert.match(html,/name="programWeeks"/);
 assert.match(html,/name="programSource"/);
 assert.match(html,/id="workoutTabRoutines"/);
 assert.match(load('compact-workouts.css'),/#workouts \.workout-compact-illustration/);
 assert.match(load('live-coach-workout.css'),/background:#06373b/);
});
