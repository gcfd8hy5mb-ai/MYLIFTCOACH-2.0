/* MYLIFTCOACH 2.0 static integration contract checks.
   Run: node tests/static-contract.test.js
   No server, browser, credentials, installs or network needed. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=file('index.html'),app=file('app.js');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'duplicate static HTML ids');
for(const id of ['todayStart','todayTitle','workoutGrid','coachNextWorkout','coachTechnique',
  'recoveryExportAction','recoveryRestoreAction','cloudPreviewAction','cloudArchiveAction','migrationReadinessFile','checkpointCompareAction','checkpointBaselineFile','checkpointCurrentFile','cloudOriginalHistoryFile','clearCloudOriginalHistory','loadCloudOriginalHistory','cloudOriginalHistoryResults','postWorkoutRecap','dataHealthAction']){
 assert.ok(ids.includes(id),'missing interface control: '+id);
}
const scriptNames=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1].replace(/^\.\//,'').split('?')[0]);
const before=(a,b)=>{
 assert.ok(scriptNames.indexOf(a)>=0,'missing script '+a);
 assert.ok(scriptNames.indexOf(b)>=0,'missing script '+b);
 assert.ok(scriptNames.indexOf(a)<scriptNames.indexOf(b),a+' must load before '+b);
};
for(const script of ['custom-workouts.js','session-draft.js','exercise-catalog-344.js',
  'progress-migration.js','coach-attributes.js','coach-migration.js',
  'recovery-import.js','cloud-sync-preview.js'])before(script,'app.js');
before('progress-migration.js','coach-migration.js');
before('coach-trends.js','app.js');
assert.ok(ids.includes('coachTrends'),'missing Coach training consistency control');
before('coach-attributes.js','coach-migration.js');
before('legacy-storage-model.js','legacy-reconcile.js');
before('cloud-account-archive.js','app.js');
before('cloud-migration-readiness.js','app.js');
before('cloud-checkpoint-review.js','app.js');
before('cloud-original-history.js','app.js');
before('cloud-live-original-history.js','app.js');
before('coach-post-workout.js','app.js');
before('legacy-reconcile.js','cloud-sync-preview.js');
assert.match(app,/function nextPlan\(\)\{return window\.MLC2Custom\?\.currentPlan/);
assert.match(app,/\$\('todayStart'\)\.addEventListener\('click',\(\)=>openWorkout\(nextPlan\(\)\.id\)\)/);
assert.match(app,/renderNextWorkout\(\$\('coachNextWorkout'\),selected,demoSessions,catalog\)/);
assert.match(app,/renderTechnique\(\$\('coachTechnique'\),selected,catalog\)/);
const cloud=file('cloud-sync-preview.js');
const archive=file('cloud-account-archive.js');
assert.doesNotMatch(archive,/\bmethod\s*:\s*['\"](?:POST|PUT|PATCH|DELETE)['\"]/i,'cloud archive may not write');
assert.doesNotMatch(cloud,/\bmethod\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i,'cloud preview may not write');
assert.doesNotMatch(cloud,/\b(?:localStorage|sessionStorage)\.setItem\b/,'cloud preview may not write browser data');
const registry=JSON.parse(file('exercise-catalog-344.js').match(/window\.MLC2_EXERCISE_CATALOG=(\[[\s\S]*\]);\s*$/)[1]);
assert.equal(registry.length,344);
assert.equal(new Set(registry.map(e=>e.id)).size,344,'duplicate exercise IDs');
for(const id of ['chest-press','lat-pulldown','shoulder-press','triceps-push','leg-press',
  'leg-curl','calf-raise','cable-crunch','pec-deck','seated-row','biceps-curl','leg-extension'])
 assert.ok(registry.some(e=>e.id===id),'preset exercise missing '+id);
console.log('MYLIFTCOACH static integration contracts: PASS');
