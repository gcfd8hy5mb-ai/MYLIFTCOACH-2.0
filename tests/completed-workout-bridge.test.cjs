'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {stage,RECEIPT_PREFIX}=require('../sync/completed-workout-bridge.js');
function store(){
 const m=new Map();
 return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};
}
function journal(owner){
 const state={owner,items:[]};let count=0;
 return {state,enqueue(type,id,payload,revision){
   assert.equal(revision,0);
   const op={type,id,payload,opId:'op-'+(++count)};
   state.items.push(op);return op;
  },list(){return {owner,items:[...state.items]}}};
}
const session={id:'demo-123-aa',ownerId:'account-a',created:'2026-11-20T20:00:00.000Z',
 title:'Upper Body',planId:'custom-1',sets:[{exerciseId:'chest-press',reps:10,weight:80}]};
test('disabled adapter does not mutate even when passed valid account and journal',()=>{
 const storage=store(),j=journal('account-a');
 assert.deepEqual(stage({session,verifiedOwner:'account-a',storage,journal:j}),{status:'disabled'});
 assert.equal(j.state.items.length,0);assert.equal(storage.m.size,0);
});
test('guest and cross-account history cannot be enqueued',()=>{
 const storage=store(),j=journal('account-b');
 assert.equal(stage({session,verifiedOwner:'account-b',storage,journal:j,enabled:true}).status,'owner-unverified');
 assert.equal(stage({session:{...session,ownerId:undefined},verifiedOwner:'account-b',storage,journal:j,enabled:true}).status,'owner-unverified');
 assert.equal(j.state.items.length,0);
});
test('successful local journal enqueue records only account-scoped receipt and deduplicates',()=>{
 const storage=store(),j=journal('account-a');
 const cfg={session,verifiedOwner:'account-a',storage,journal:j,enabled:true};
 assert.equal(stage(cfg).status,'queued');
 assert.equal(stage(cfg).status,'already-queued');
 assert.equal(j.state.items.length,1);
 assert.equal(storage.getItem(RECEIPT_PREFIX+'account-a:'+session.id),'op-1');
});
test('pending journal operation blocks a duplicate when receipt is absent',()=>{
 const storage=store(),j=journal('account-a');
 j.state.items.push({type:'session',id:session.id,opId:'prior'});
 assert.equal(stage({session,verifiedOwner:'account-a',storage,journal:j,enabled:true}).status,'already-pending');
 assert.equal(j.state.items.length,1);
});
test('invalid completed workout is not queued',()=>{
 const storage=store(),j=journal('account-a');
 assert.equal(stage({session:{...session,sets:[]},verifiedOwner:'account-a',storage,journal:j,enabled:true}).status,'invalid-session');
 assert.equal(j.state.items.length,0);
});
test('journal identity mismatch rejects without saving a receipt',()=>{
 const storage=store(),j=journal('account-b');
 assert.throws(()=>stage({session,verifiedOwner:'account-a',storage,journal:j,enabled:true}),/Journal owner mismatch/);
 assert.equal(storage.m.size,0);
});
test('receipt write failure retains the durable queued operation',()=>{
 const storage={getItem(){return null},setItem(){throw Error('Quota exceeded')}},j=journal('account-a');
 assert.equal(stage({session,verifiedOwner:'account-a',storage,journal:j,enabled:true}).status,'queued-receipt-unavailable');
 assert.equal(j.state.items.length,1,'journal already received operation and must retain pending work');
});
