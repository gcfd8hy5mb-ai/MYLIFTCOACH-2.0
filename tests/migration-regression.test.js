/* MYLIFTCOACH 2.0 — pure migration regression tests.
   Run: node tests/migration-regression.test.js
   Uses only Node's built-in assertions, no paid tools, network or accounts. */
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const draft=require(path.join(root,'session-draft.js'));
const exporter=require(path.join(root,'recovery-export.js'));
const importer=require(path.join(root,'recovery-import.js'));
const mapper=require(path.join(root,'legacy-mapping-preview.js'));
const health=require(path.join(root,'data-health.js'));
function storage(initial={}){
 const db=new Map(Object.entries(initial));
 return {getItem:k=>db.has(k)?db.get(k):null,setItem:(k,v)=>db.set(k,v),removeItem:k=>db.delete(k),size:()=>db.size};
}
const catalog=[{id:'machine-chest-press',name:'Machine Chest Press'},{id:'lat-pulldown',name:'Lat Pulldown'}];
const plan={id:'custom-100-abc',title:'Custom A',ids:['machine-chest-press','lat-pulldown']};
const sets=[{exerciseId:'machine-chest-press',weight:75,reps:10}];
const saved=storage();
draft.save(saved,plan,sets);
assert.deepEqual(draft.resume(saved,plan),sets,'same plan must resume exact sets');
assert.equal(draft.resume(saved,{...plan,ids:['lat-pulldown']}),null,'changed exercise list must not resume');
assert.equal(draft.read(saved,Date.now()+8*86400000),null,'draft must expire');
const backup=exporter.createBackup(saved),serialized=JSON.stringify(backup);
assert.ok(!serialized.includes('access_token'),'backup must not contain auth tokens');
assert.ok(backup.data['mlc2-active-session-v1'],'draft is included in local recovery');
const parsed=importer.parse(serialized),destination=storage(),preview=importer.planRestore(parsed,destination);
assert.equal(preview.canRestore,true);
assert.equal(preview.writes.length,1);
assert.equal(importer.restore(parsed,destination).restored,1);
assert.deepEqual(draft.resume(destination,plan),sets);
assert.equal(importer.restore(parsed,destination).restored,0,'restore must be idempotent');
const conflicting=storage({'mlc2-active-session-v1':'{}'});
assert.equal(importer.planRestore(parsed,conflicting).canRestore,false);
assert.throws(()=>importer.restore(parsed,conflicting));
assert.equal(conflicting.getItem('mlc2-active-session-v1'),'{}','conflicting browser records cannot be overwritten');
assert.throws(()=>importer.parse(JSON.stringify({...backup,data:{...backup.data,'mlc2-auth-session-v1':'SECRET'}})));
const completed={id:'demo-100-abc',title:'Custom A',created:'2026-11-18T10:00:00Z',planId:plan.id,sets};
const mapped=mapper.summarize({customPlans:[plan],sessions:[completed],catalog});
assert.equal(mapped.customWorkouts,1);
assert.equal(mapped.sessions,1);
assert.equal(mapped.plannedSets,1);
assert.equal(mapped.uploadAllowed,false,'mapping preview must remain non-writing');
assert.throws(()=>mapper.summarize({customPlans:[plan,plan],catalog}),/duplicate IDs/);
const intact=health.check(saved,catalog,[plan]);
assert.equal(intact.status,'pass');
assert.equal(intact.counts['Unfinished workout sets'],1);
const stale=health.check(saved,catalog,[{...plan,ids:['lat-pulldown']}]);
assert.ok(stale.warnings.some(w=>w.includes('differs from current plan')));
console.log('MYLIFTCOACH migration regression: PASS — draft, backup/restore, conflicts, mapping, data health');
