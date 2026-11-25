'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const drafts=require('../session-draft.js');
const accounts=require('../sync/account-draft-store.js');
function fixture(){
 const data=new Map();
 const store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const api=vm.runInNewContext(fs.readFileSync('session-editor.js','utf8')+';SessionEditor',{localStorage:store,structuredClone,Date});
 return {store,api};
}
for(const source of ['program','weekly']){
 test(source+' edits belong to one calendar date and one verified account',()=>{
  const {api,store}=fixture();
  const original={id:'upper',title:'Upper',ids:['press','row'],scheduleSource:source};
  const copy={...api.configuration(original),planId:original.id,ids:['row'],targets:{row:{sets:4,reps:8}}};
  store.setItem(api.dayKey('owner-a',api.dateFor(original)),JSON.stringify(copy));
  assert.deepEqual([...api.effective(original,'owner-a').ids],['row']);
  assert.equal(api.effective(original,'owner-b'),original);
  assert.equal(api.effective(original,null),original);
  const tomorrow={...original,daysAhead:1};
  assert.equal(api.effective(tomorrow,'owner-a'),tomorrow);
  assert.deepEqual(original.ids,['press','row']);
 });
}
test('edited draft keeps its order, ID, targets, logged work, and owner on reopen',()=>{
 const {api,store}=fixture();
 const original={id:'upper',title:'Upper',ids:['press','row']};
 const edit={...original,ids:['row','curl'],targets:{curl:{sets:4,reps:9}},sessionDate:api.dateFor(original),workoutId:'demo-edit'};
 const sets=[{exerciseId:'row',weight:42.5,reps:8}];
 drafts.save(accounts.scope(store,'owner-a',{guarded:true}),edit,sets);
 assert.equal(drafts.read(accounts.scope(store,'owner-b')),null);
 const reopened=accounts.scope(store,'owner-a');
 const record=drafts.read(reopened);
 assert.equal(record.workoutId,edit.workoutId);
 const effective=api.effective(original,'owner-a',record);
 assert.deepEqual([...effective.ids],edit.ids);
 assert.deepEqual(effective.targets,edit.targets);
 assert.deepEqual(drafts.resume(reopened,effective),sets);
});
