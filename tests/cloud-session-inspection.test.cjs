'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspect}=require('../sync/cloud-session-inspection.js');
const owner='account-a';
const auth={verify:async o=>({userId:o,accessToken:'test'})};
const row=(id,extra={})=>({owner,type:'session',id,revision:1,deleted:false,...extra});
function args(rows,extra={}){
 let calls=0;
 return {owner,auth,local:[{ownerId:owner,id:'shared'},{ownerId:'account-b',id:'cloud-only'}],
  transport:{listSessions:async()=>{calls++;return rows}},accountStillCurrent:o=>o===owner,
  ...extra};
}
test('inspect is read-only and counts only matching owner workouts',async()=>{
 const data=[row('shared'),row('cloud-only'),row('deleted',{deleted:true})];
 const result=await inspect(args(data));
 assert.deepEqual({...result},{owner,cloudWorkouts:2,localWorkouts:1,idOverlaps:1,cloudOnly:1,
  deleted:1,readOnly:true,canAutoRestore:false});
});
test('reject another account in a returned cloud page',async()=>{
 await assert.rejects(inspect(args([row('foreign',{owner:'account-b'})])),/Unexpected cloud/);
});
test('refuse inspect if ownership changes during network request',async()=>{
 let live=true;
 const options=args([], {transport:{listSessions:async()=>{live=false;return [row('session-1')]}},accountStillCurrent:()=>live});
 await assert.rejects(inspect(options),/Account changed/);
});
test('failed Auth verification prevents cloud list call',async()=>{
 let calls=0;
 const options=args([], {auth:{verify:async()=>{throw Error('Auth failed')}},transport:{listSessions:async()=>{calls++;return []}}});
 await assert.rejects(inspect(options),/Auth failed/);
 assert.equal(calls,0);
});
test('duplicate cloud ids cause fail-closed error',async()=>{
 await assert.rejects(inspect(args([row('same'),row('same')])),/Unexpected cloud/);
});
test('pagination cap refuses incomplete scan without reporting success',async()=>{
 const fifty=Array.from({length:50},(_,i)=>row('s'+String(i).padStart(3,'0')));
 const options=args(fifty,{maxPages:1});
 await assert.rejects(inspect(options),/inspection limit/);
});
test('list sessions cannot invoke commit or import',async()=>{
 let writes=0;
 const options=args([row('a')],{transport:{listSessions:async()=>[row('a')],commit:async()=>writes++}});
 assert.equal((await inspect(options)).cloudOnly,1);
 assert.equal(writes,0);
});
