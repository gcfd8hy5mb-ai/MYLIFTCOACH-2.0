'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const transfer=require('../sync/program-transfer.js');
const aux=require('../sync/aux-data.js');
const makeStore=()=>{
 const data=new Map();
 return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),
  removeItem:k=>data.delete(k),snapshot:()=>JSON.stringify([...data])};
};
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const scoped=key=>key+':user:'+owner;
const routines=[{id:'custom-push',title:'Monday Push',ids:['bench-press']}];
const library={version:1,mode:'coach',activeId:'schedule-monday',profiles:[{id:'schedule-monday',name:'My week',days:{0:'rest-day',1:'custom-push'}}]};
const week={'0':'rest-day','1':'custom-push'};
function seeded(){
 const s=makeStore();
 for(const [key,v] of Object.entries({'mlc2-custom-plans-v1':routines,'mlc2-schedule-library-v1':library,
  'mlc2-weekly-schedule-v1':week,'mlc2-auto-coach-preferences-v1':{goal:'strength',days:5,equipment:'Machine'}}))
  s.setItem(scoped(key),JSON.stringify(v));
 s.setItem(scoped('mlc2-selected-workout-v1'),'');
 s.setItem('unrelated-original-data','must not touch');
 return s;
}
test('export includes signed-in schedule, Coach and account routines, never auth, original or photos',()=>{
 const source=seeded(),before=source.snapshot();
 const record=transfer.capture(source,owner,aux,'2026-11-23T10:00:00.000Z');
 assert.equal(source.snapshot(),before);
 assert.equal(record.entries['mlc2-schedule-library-v1'].mode,'coach');
 assert.equal(record.entries['mlc2-auto-coach-preferences-v1'].days,5);
 assert.equal(record.entries['mlc2-custom-plans-v1'].length,1);
 assert.equal(record.containsPhotos,false);assert.equal(record.containsAuthentication,false);
 assert.equal(JSON.stringify(record).includes('must not touch'),false);
 assert.equal(JSON.stringify(record).includes('access_token'),false);
});
test('valid same-account import preview is read-only and detects all differing keys',()=>{
 const record=transfer.capture(seeded(),owner,aux),target=seeded();
 const before=target.snapshot();
 const match=transfer.compare(transfer.parse(JSON.stringify(record),owner,aux),target,owner,aux);
 assert.equal(match.matching.length,5);
 assert.deepEqual(match.missing,[]);assert.deepEqual(match.different,[]);
 assert.equal(target.snapshot(),before);
 target.setItem(scoped('mlc2-schedule-library-v1'),JSON.stringify({...library,mode:'weekly'}));
 const conflicting=transfer.compare(record,target,owner,aux);
 assert.deepEqual(conflicting.different,['mlc2-schedule-library-v1']);
 assert.equal(target.snapshot(),JSON.stringify(JSON.parse(target.snapshot())));
});
test('same-account comparison identifies missing categories without restoring them',()=>{
 const record=transfer.capture(seeded(),owner,aux),target=makeStore(),before=target.snapshot();
 const result=transfer.compare(record,target,owner,aux);
 assert.equal(result.missing.length,5);
 assert.equal(result.readOnly,true);
 assert.equal(target.snapshot(),before);
});
test('wrong-account files and invalid values are rejected without storage writes',()=>{
 const record=transfer.capture(seeded(),owner,aux),raw=JSON.stringify(record);
 assert.throws(()=>transfer.parse(raw,other,aux),/another account/);
 const bad=JSON.parse(raw);bad.entries['mlc2-auto-coach-preferences-v1']={goal:'strength',days:40,equipment:'Machine'};
 assert.throws(()=>transfer.parse(JSON.stringify(bad),owner,aux),/requires review/);
 const extra=JSON.parse(raw);extra.entries['legacy-workout-history']='secret';
 assert.throws(()=>transfer.parse(JSON.stringify(extra),owner,aux),/invalid or belongs/);
 assert.throws(()=>transfer.parse(raw.replace('"created"','"__proto__"'),owner,aux),/Unsafe transfer/);
});
test('signed-in UI uses isolated backup path, never guest exporter or automatic restoration',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 for(const id of ['exportAccountPrograms','inspectAccountProgramsFile','exportAccountProgramsStatus','inspectAccountProgramsStatus'])
  assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('./sync/program-transfer.js?v=1'));
 assert.match(app,/MLC2ProgramTransfer\.capture\(localStorage,owner/);
 assert.match(app,/MLC2ProgramTransfer\.compare\(record,localStorage,owner/);
 assert.doesNotMatch(app,/MLC2ProgramTransfer\.restore/);
});

test('source programs union with receiver programs while retaining both histories and source Coach mode',()=>{
 const source=seeded(),receiver=makeStore();
 const otherPlan={id:'custom-receiver',title:'Receiver Day',ids:['squat']};
 const existingLibrary={version:1,mode:'weekly',activeId:'schedule-receiver',profiles:[{id:'schedule-receiver',name:'Receiver weekly',days:{2:'custom-receiver'}}]};
 receiver.setItem(scoped('mlc2-custom-plans-v1'),JSON.stringify([otherPlan]));
 receiver.setItem(scoped('mlc2-schedule-library-v1'),JSON.stringify(existingLibrary));
 receiver.setItem(scoped('mlc2-weekly-schedule-v1'),JSON.stringify({2:'custom-receiver'}));
 receiver.setItem(scoped('mlc2-auto-coach-preferences-v1'),JSON.stringify({goal:'balanced',days:4,equipment:'Any'}));
 receiver.setItem('mlc2-account-history','KEEP');
 receiver.setItem('photos','DEVICE_ONLY');
 const before=receiver.snapshot();
 const record=transfer.parse(JSON.stringify(transfer.capture(source,owner,aux)),owner,aux);
 const plan=transfer.planMerge(record,receiver,owner,aux,{activateSource:true});
 assert.equal(plan.canApply,true);
 assert.equal(receiver.snapshot(),before);
 const changes=new Map(plan.changes.map(v=>[v.category,v]));
 assert.equal(JSON.parse(changes.get('mlc2-custom-plans-v1').value).length,2);
 const joined=JSON.parse(changes.get('mlc2-schedule-library-v1').value);
 assert.equal(joined.profiles.length,2);
 assert.equal(joined.mode,'coach');
 assert.equal(joined.activeId,'schedule-monday');
 assert.equal(JSON.parse(changes.get('mlc2-auto-coach-preferences-v1').value).days,5);
 assert.ok(plan.changes.every(x=>x.key.endsWith(':user:'+owner)));
 assert.equal(receiver.getItem('mlc2-account-history'),'KEEP');
 assert.equal(receiver.getItem('photos'),'DEVICE_ONLY');
});
test('leaving source activation off preserves receiver active program and preferences',()=>{
 const record=transfer.capture(seeded(),owner,aux),receiver=makeStore();
 receiver.setItem(scoped('mlc2-custom-plans-v1'),JSON.stringify([]));
 receiver.setItem(scoped('mlc2-schedule-library-v1'),JSON.stringify({version:1,mode:'weekly',activeId:'schedule-r',profiles:[{id:'schedule-r',name:'Receiver',days:{0:'rest-day'}}]}));
 receiver.setItem(scoped('mlc2-auto-coach-preferences-v1'),JSON.stringify({goal:'balanced',days:4,equipment:'Any'}));
 const p=transfer.planMerge(record,receiver,owner,aux);
 assert.equal(p.canApply,true);
 const lib=JSON.parse(p.changes.find(x=>x.category==='mlc2-schedule-library-v1').value);
 assert.equal(lib.mode,'weekly');assert.equal(lib.activeId,'schedule-r');
 assert.equal(p.changes.some(x=>x.category==='mlc2-auto-coach-preferences-v1'),false);
});
test('same workout ID with different exercises blocks entire transfer before writes',()=>{
 const record=transfer.capture(seeded(),owner,aux),receiver=makeStore();
 receiver.setItem(scoped('mlc2-custom-plans-v1'),JSON.stringify([{id:'custom-push',title:'Different',ids:['squat']}]));
 const before=receiver.snapshot(),p=transfer.planMerge(record,receiver,owner,aux,{activateSource:true});
 assert.equal(p.canApply,false);assert.equal(p.changes.length,0);
 assert.match(p.conflicts.join(),/same ID/);
 assert.equal(before,receiver.snapshot());
});
test('unsafe destination reference to nonexistent plan blocks transfer',()=>{
 const record=transfer.capture(seeded(),owner,aux),receiver=makeStore();
 receiver.setItem(scoped('mlc2-weekly-schedule-v1'),JSON.stringify({'1':'custom-missing'}));
 const p=transfer.planMerge(record,receiver,owner,aux,{activateSource:false});
 assert.equal(p.canApply,false);
 assert.match(p.conflicts.join(),/missing custom workout/);
});
test('restoring a program requires receiver backup and atomic journal',()=>{
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const custom=fs.readFileSync(path.join(__dirname,'..','custom-workouts.js'),'utf8');
 assert.match(app,/receivingBackup\.state!==currentProgramState\(owner\)/);
 assert.match(app,/MLC2Custom\.commitRecoveredPlans\(fresh\.changes\)/);
 assert.match(custom,/\.\.\.TRANSFER_KEYS/);
 assert.match(app,/window\.MLC2Custom\.runPlanWrite\(/);
});
