'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const store=require('../sync/account-workout-store.js');
function fakeStorage(existing={}){
 const values=new Map(Object.entries(existing));
 return {getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
}
const workout=(id,weight,reps)=>({id,created:'2026-11-22T12:00:00.000Z',title:'Test Workout',sets:[{exerciseId:'chest-press',weight,reps}]});
test('completed guest workouts survive browser reopen using the same origin store',()=>{
 const browser=fakeStorage();
 store.save(browser,null,[workout('session-1',40,10)]);
 const afterReopen=store.read(browser,null);
 assert.equal(afterReopen.length,1);
 assert.equal(afterReopen[0].sets[0].weight,40);
 assert.equal(afterReopen[0].sets[0].reps,10);
});
test('guest history is isolated from verified account workout history',()=>{
 const browser=fakeStorage();
 store.save(browser,null,[workout('guest-a',25,8)]);
 const owned={...workout('account-b',70,5),ownerId:'owner-1'};
 store.save(browser,'owner-1',[owned]);
 assert.deepEqual(store.read(browser,null).map(s=>s.id),['guest-a']);
 assert.deepEqual(store.read(browser,'owner-1').map(s=>s.id),['account-b']);
});
test('save verifies persistence and never silently overwrites unreadable history',()=>{
 const storage=fakeStorage({[store.LEGACY_KEY]:'malformed'});
 assert.throws(()=>store.save(storage,null,[workout('test',25,8)]));
 assert.equal(storage.getItem(store.LEGACY_KEY),'malformed');
});
test('guest backup restoration can merge distinct IDs without duplicates',()=>{
 const browser=fakeStorage();
 const existing=[workout('one',30,10)],backup=[workout('one',30,10),workout('two',40,10)];
 store.save(browser,null,existing);
 const known=new Set(store.read(browser,null).map(s=>s.id));
 store.save(browser,null,[...existing,...backup.filter(s=>!known.has(s.id))]);
 assert.deepEqual(store.read(browser,null).map(s=>s.id),['one','two']);
});
