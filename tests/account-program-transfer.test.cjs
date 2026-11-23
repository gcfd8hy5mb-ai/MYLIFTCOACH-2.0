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
