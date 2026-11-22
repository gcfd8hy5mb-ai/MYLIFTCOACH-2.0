'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const recovery=require('../sync/account-recovery.js');
const owner='account-a',other='account-b';
function storage(){
 const map=new Map();
 return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
}
function row(id,owned=owner,weight=50){
 return {id,ownerId:owned,title:'Upper Body',created:'2026-11-21T14:00:00Z',planId:'upper-a',
  sets:[{exerciseId:'chest-press',weight,reps:10}]};
}
test('owner backup includes only matching account workouts and no credentials',()=>{
 const s=storage();s.setItem('mlc2-account-workouts-v1:'+owner,JSON.stringify([row('a1')]));
 s.setItem('mlc2-account-workouts-v1:'+other,JSON.stringify([row('b1',other)]));
 const file=recovery.make(s,owner);
 assert.equal(file.sessions.length,1);assert.equal(file.sessions[0].id,'a1');
 assert.equal(file.containsAuthentication,false);assert.equal(file.containsPhotos,false);
 assert.doesNotMatch(JSON.stringify(file),/access_token|refresh_token|b1/);
});
test('foreign owner file cannot be opened or restored',()=>{
 const s=storage();const file=recovery.make(s,owner);
 assert.throws(()=>recovery.parse(JSON.stringify(file),other),/different account/);
 assert.throws(()=>recovery.restore(s,file,other),/owner mismatch/);
 assert.equal(s.map.size,0);
});
test('fill-only restores missing sessions and does not duplicate them on retry',()=>{
 const src=storage(),dst=storage();src.setItem('mlc2-account-workouts-v1:'+owner,JSON.stringify([row('one'),row('two')]));
 const file=recovery.parse(JSON.stringify(recovery.make(src,owner)),owner);
 dst.setItem('mlc2-account-workouts-v1:'+owner,JSON.stringify([row('one')]));
 assert.equal(recovery.plan(dst,file,owner).missing.length,1);
 assert.equal(recovery.restore(dst,file,owner).restored,1);
 assert.equal(recovery.restore(dst,file,owner).restored,0);
 assert.equal(JSON.parse(dst.getItem('mlc2-account-workouts-v1:'+owner)).length,2);
});
test('same id but different sets blocks entire restore without overwriting',()=>{
 const src=storage(),dst=storage();
 src.setItem('mlc2-account-workouts-v1:'+owner,JSON.stringify([row('shared'),row('new')]));
 const file=recovery.make(src,owner);
 dst.setItem('mlc2-account-workouts-v1:'+owner,JSON.stringify([row('shared',owner,120)]));
 const before=dst.getItem('mlc2-account-workouts-v1:'+owner);
 assert.equal(recovery.plan(dst,file,owner).canRestore,false);
 assert.throws(()=>recovery.restore(dst,file,owner),/conflicts/);
 assert.equal(dst.getItem('mlc2-account-workouts-v1:'+owner),before);
});
test('invalid backup rejects foreign workout IDs and corrupt JSON',()=>{
 const s=storage(),record=recovery.make(s,owner);
 assert.throws(()=>recovery.parse('not-json',owner),/Invalid account backup JSON/);
 assert.throws(()=>recovery.parse(JSON.stringify({...record,sessions:[row('foreign',other)]}),owner),/foreign-owned/);
 assert.throws(()=>recovery.parse(JSON.stringify({...record,sessions:[row('dup'),row('dup')]}),owner),/duplicate/);
});
test('failure to write cannot create a phantom recovered session',()=>{
 const src=storage(),dst=storage();
 src.setItem('mlc2-account-workouts-v1:'+owner,JSON.stringify([row('one')]));
 const file=recovery.make(src,owner);
 const broken={getItem:dst.getItem,setItem(){throw Error('quota exceeded')}};
 assert.throws(()=>recovery.restore(broken,file,owner),/quota exceeded/);
 assert.equal(dst.getItem('mlc2-account-workouts-v1:'+owner),null);
});
test('local sessions for other owners cannot enter an account backup',()=>{
 const s=storage();s.setItem('mlc2-account-workouts-v1:'+owner,JSON.stringify([row('foreign',other)]));
 assert.throws(()=>recovery.make(s,owner),/foreign-owned/);
});
test('backup never mutates local or remote storage',()=>{
 const s=storage();s.setItem('mlc2-account-workouts-v1:'+owner,JSON.stringify([row('one')]));
 const before=[...s.map.entries()];recovery.make(s,owner);
 assert.deepEqual([...s.map.entries()],before);
});
