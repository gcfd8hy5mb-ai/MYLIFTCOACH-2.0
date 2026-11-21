'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const storeAPI=require('../sync/account-workout-store.js');
const makeStore=()=>{const m=new Map();return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
const session=(id,ownerId)=>({id,created:'2026-11-20T20:00:00Z',ownerId,sets:[{exerciseId:'press',weight:60,reps:10}]});
test('guest history is not automatically imported into a signed-in account',()=>{
 const s=makeStore();
 s.setItem(storeAPI.LEGACY_KEY,JSON.stringify([{id:'old-demo',sets:[{exerciseId:'press'}]}]));
 assert.equal(storeAPI.read(s,'user-a').length,0);
 assert.equal(storeAPI.read(s,null).length,1);
});
test('account A and account B cannot see or delete each others workouts',()=>{
 const s=makeStore();storeAPI.save(s,'user-a',[session('a1','user-a')]);
 storeAPI.save(s,'user-b',[session('b1','user-b')]);
 assert.deepEqual(storeAPI.read(s,'user-a').map(x=>x.id),['a1']);
 assert.deepEqual(storeAPI.read(s,'user-b').map(x=>x.id),['b1']);
 storeAPI.clear(s,'user-a');
 assert.equal(storeAPI.read(s,'user-a').length,0);
 assert.equal(storeAPI.read(s,'user-b').length,1);
});
test('reject account crossover and duplicate IDs without modifying previous data',()=>{
 const s=makeStore();storeAPI.save(s,'user-a',[session('a1','user-a')]);
 const before=s.getItem(storeAPI.key('user-a'));
 assert.throws(()=>storeAPI.save(s,'user-a',[session('b1','user-b')]),/another account/);
 assert.throws(()=>storeAPI.save(s,'user-a',[session('a1','user-a'),session('a1','user-a')]),/Invalid completed workout/);
 assert.equal(s.getItem(storeAPI.key('user-a')),before);
});
test('invalid/corrupt history fails closed without automatic overwrite',()=>{
 const s=makeStore();s.setItem(storeAPI.key('user-a'),'{invalid');
 assert.throws(()=>storeAPI.read(s,'user-a'),/cannot be parsed/);
 assert.equal(s.getItem(storeAPI.key('user-a')),'{invalid');
});
test('failed storage writes retain previously saved records',()=>{
 const s=makeStore();storeAPI.save(s,'user-a',[session('one','user-a')]);
 const prior=s.getItem(storeAPI.key('user-a'));
 const failing={getItem:s.getItem,setItem(){throw Error('Quota exceeded')}};
 assert.throws(()=>storeAPI.save(failing,'user-a',[session('two','user-a')]),/Quota exceeded/);
 assert.equal(s.getItem(storeAPI.key('user-a')),prior);
});
test('do not accept an unverified owner identifier',()=>{
 const s=makeStore();
 assert.throws(()=>storeAPI.key('../../guest'),/Verified account ID/);
 assert.throws(()=>storeAPI.save(s,'',[]),/Verified account ID/);
 assert.equal(s.m.size,0);
});
test('correctly verify read-back of a committed session',()=>{
 const s=makeStore();storeAPI.save(s,'user-a',[session('ok','user-a')]);
 assert.equal(storeAPI.read(s,'user-a')[0].ownerId,'user-a');
});

test('previous account-tagged demo rows remain private and survive guest saves and clears',()=>{
 const s=makeStore();const owned=session('older-signed-in','user-a');
 s.setItem(storeAPI.LEGACY_KEY,JSON.stringify([owned,{id:'guest-before',sets:[{exerciseId:'press'}]}]));
 assert.deepEqual(storeAPI.read(s,null).map(x=>x.id),['guest-before']);
 storeAPI.save(s,null,[{id:'guest-after',sets:[{exerciseId:'press'}]}]);
 assert.deepEqual(storeAPI.read(s,null).map(x=>x.id),['guest-after']);
 assert.equal(JSON.parse(s.getItem(storeAPI.LEGACY_KEY)).some(x=>x.id==='older-signed-in'),true);
 storeAPI.clear(s,null);
 assert.deepEqual(storeAPI.read(s,null),[]);
 assert.equal(JSON.parse(s.getItem(storeAPI.LEGACY_KEY))[0].id,'older-signed-in');
});
