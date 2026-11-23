'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('function withAccountLock('),end=app.indexOf('function loadCurrentWorkouts',start);
const code=app.slice(start,end);
test('independent account contexts serialize history; switching a waiting owner cancels its write',async()=>{
 const tailByName=new Map(),writes=[];
 const navigator={locks:{request:(name,work)=>{
  const result=(tailByName.get(name)||Promise.resolve()).then(work);
  tailByName.set(name,result.catch(()=>{}));
  return result;
 }}};
 const first={navigator,verifiedOwnerId:'user-1',authEpoch:1,writes},second={...first};
 let finish;
 first.awaitWrite=new Promise(resolve=>{finish=resolve});
 vm.runInNewContext(code,first);vm.runInNewContext(code,second);
 const a=first.withAccountLock('history','user-1',1,async()=>{await first.awaitWrite;writes.push('first')});
 const b=second.withAccountLock('history','user-1',1,()=>writes.push('second'));
 await Promise.resolve();
 assert.deepEqual(writes,[]);
 finish();await Promise.all([a,b]);
 assert.deepEqual(writes,['first','second']);
 const stale=second.withAccountLock('history','user-1',1,()=>writes.push('stale'));
 second.authEpoch=2;
 await assert.rejects(stale,/account changed/);
 assert.deepEqual(writes,['first','second']);
});
