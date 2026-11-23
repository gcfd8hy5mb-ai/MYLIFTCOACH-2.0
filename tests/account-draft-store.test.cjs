'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const adapter=require('../sync/account-draft-store.js');
const drafts=require('../session-draft.js');
const plan={id:'upper-a',title:'Upper Body A',ids:['chest-press']};
const sets=[{exerciseId:'chest-press',weight:75,reps:10}];
function storage(){
 const map=new Map();return {map,getItem:k=>map.has(k)?map.get(k):null,
 setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
}
test('two accounts and guest have independent unfinished sessions',()=>{
 const s=storage();
 const a=adapter.scope(s,'account-a'),b=adapter.scope(s,'account-b'),guest=adapter.scope(s,null);
 drafts.save(a,plan,sets);
 drafts.save(b,plan,[{...sets[0],weight:90}]);
 drafts.save(guest,plan,[{...sets[0],weight:40}]);
 assert.equal(drafts.resume(a,plan)[0].weight,75);
 assert.equal(drafts.resume(b,plan)[0].weight,90);
 assert.equal(drafts.resume(guest,plan)[0].weight,40);
 drafts.clear(a,plan.id);
 assert.equal(drafts.resume(a,plan),null);
 assert.equal(drafts.resume(b,plan)[0].weight,90);
 assert.equal(drafts.resume(guest,plan)[0].weight,40);
});
test('guest draft remains at original key, and owner drafts use separate storage',()=>{
 const s=storage();drafts.save(adapter.scope(s,null),plan,sets);
 assert.ok(s.getItem('mlc2-active-session-v1'));
 assert.equal(s.getItem(adapter.scopedKey('account-a')),null);
});
test('reject malformed owner or access to unrelated storage key',()=>{
 const s=storage();
 assert.throws(()=>adapter.scope(s,'../account-b'),/Verified owner/);
 const a=adapter.scope(s,'account-a');
 assert.throws(()=>a.getItem('workoutHistoryV52'),/Unsupported draft storage key/);
 assert.equal(s.map.size,0);
});

test('a stale workout window cannot overwrite or clear another window’s saved sets',()=>{
 const rows=new Map(),db={getItem:key=>rows.get(key)??null,setItem:(key,v)=>rows.set(key,v),removeItem:key=>rows.delete(key)};
 const key=adapter.KEY,first=adapter.scope(db,'first-owner',{guarded:true});
 first.setItem(key,'original-draft');
 const stale=adapter.scope(db,'first-owner',{guarded:true});
 const other=adapter.scope(db,'second-owner',{guarded:true});
 first.setItem(key,'newer-draft');
 other.setItem(key,'other-account-draft');
 assert.throws(()=>stale.setItem(key,'stale-draft'),{code:'STALE_DRAFT'});
 assert.throws(()=>stale.removeItem(key),{code:'STALE_DRAFT'});
 assert.equal(first.getItem(key),'newer-draft');
 assert.equal(other.getItem(key),'other-account-draft');
});
