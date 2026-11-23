'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {capture}=require('../legacy-device-archive.js');
const owner='10000000-0000-4000-8000-000000000001';
const other='10000000-0000-4000-8000-000000000002';

test('original device checkpoint captures only scoped account records and pending deletions',()=>{
 const prefix='prismAccountLocalV1:'+owner+':';
 const rows=new Map([
  [prefix+'workoutHistoryV52','[{"id":"ours"}]'],
  [prefix+'prismActiveWorkoutV1','{"active":true}'],
  [prefix+'myliftcoachWeeklyDayOverridesV1','{"1":"routine"}'],
  [prefix+'prismSupabaseSessionV1','never export this token'],
  ['prismAccountLocalV1:'+other+':workoutHistoryV52','[{"id":"other"}]'],
  ['workoutHistoryV52','[{"id":"guest"}]'],
  ['mlc2-auth-session-v1','never export this token'],
  ['prismAccountDeletionsV1:'+owner,'{"dailyTrackingV1":"pending"}'],
  ['prismAccountPhotoDeletesV1:'+owner,'[{"id":"photo-1"}]']
 ]);
 const before=[...rows];
 const file=capture({getItem:key=>rows.get(key)??null},owner);
 assert.equal(file.categories,3);
 const doc=JSON.parse(file.contents);
 assert.equal(doc.accountId,owner);
 assert.equal(doc.data.workoutHistoryV52,'[{"id":"ours"}]');
 assert.equal(doc.containsAuthentication,false);
 assert.equal(doc.containsPhotoFiles,false);
 assert.equal(doc.deletions,'{"dailyTrackingV1":"pending"}');
 assert.equal(doc.photoDeletions,'[{"id":"photo-1"}]');
 assert.doesNotMatch(file.contents,/guest|other|never export/);
 assert.deepEqual([...rows],before);
});

test('device checkpoint cannot be captured as a guest or without a verified account ID',()=>{
 const blocked={getItem(){throw Error('storage must not be read')}};
 for(const id of [null,undefined,'guest','']){
  assert.throws(()=>capture(blocked,id),/Verified original account required/);
 }
});

test('original photo reader opens both verified owner stores read-only and filters deleted or unsafe images',async()=>{
 const {read}=require('../legacy-device-photos.js');
 const log=[];
 const day='2026-11-22',blob=new Blob(['photo'],{type:'image/jpeg'});
 const indexed={
  open(name){
   log.push(name);
   const request={};
   queueMicrotask(()=>{
    if(name.endsWith('prismProgressPhotosDB')){
     request.transaction={abort(){log.push('creation cancelled');queueMicrotask(()=>request.onerror())}};
     request.onupgradeneeded();return;
    }
    request.result={
     objectStoreNames:{contains:()=>true},close(){log.push('closed')},
     transaction(store,mode){
      log.push([store,mode]);
      const transaction={objectStore:()=>({getAll:()=>{
       queueMicrotask(()=>transaction.oncomplete());
       return {result:[{id:'keep',day,data:blob},{id:'deleted',day,data:blob},
        {id:'unsafe',day,data:new Blob(['unsafe'],{type:'image/svg+xml'})}]};
      }})};
      return transaction;
     }
    };
    request.onsuccess();
   });
   return request;
  }
 };
 const storage={getItem:key=>{
  assert.equal(key,'prismAccountPhotoDeletesV1:'+owner);
  return JSON.stringify([{database:'workoutTrackerPhotosV1',id:'deleted'}]);
 }};
 const result=await read(indexed,storage,owner,id=>id===owner);
 assert.deepEqual(result,[{day,data:blob}]);
 assert.deepEqual(log,[
  'prismAccountPhotosV1:'+owner+':workoutTrackerPhotosV1',['photos','readonly'],'closed',
  'prismAccountPhotosV1:'+owner+':prismProgressPhotosDB','creation cancelled'
 ]);
 await assert.rejects(read(indexed,storage,other,id=>id===owner),/Verified original account required/);
});

test('an original photo read interrupted by an account switch returns no images',async()=>{
 const {read}=require('../legacy-device-photos.js');
 let active=owner;
 const indexed={open:()=>{
  const request={};
  queueMicrotask(()=>{
   active=other;
   request.result={objectStoreNames:{contains:()=>false},close(){}};
   request.onsuccess();
  });
  return request;
 }};
 await assert.rejects(read(indexed,{getItem:()=>null},owner,id=>id===active),/Account changed/);
});
