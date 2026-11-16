'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CONFIG,id,loadLocal,valid,validateRemote,restoreMissing,equal}=require('../sync/aux-data.js');
function store(){
 const data=new Map();
 return {data,getItem:k=>data.has(k)?data.get(k):null,
  setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
}
const owner='user-a';
const record=(type,entries)=>({owner,type,id,revision:1,deleted:false,payload:{format:'mlc2-aux-v1',entries}});
test('backup categories remain isolated to 2.0 owner keys',()=>{
 const s=store();s.setItem('mlc2-measurements-v1',JSON.stringify([{id:'legacy',day:'2026-10-01'}]));
 assert.equal(loadLocal(s,owner,CONFIG[1]).exists,false);
 s.setItem('mlc2-measurements-v1:user:user-a',JSON.stringify([{id:'m1',day:'2026-11-15',values:{waist:33}}]));
 assert.equal(loadLocal(s,owner,CONFIG[1]).value.length,1);
});
test('reject malformed or oversized local measurements and nutrition',()=>{
 const s=store();s.setItem('mlc2-measurements-v1:user:user-a','{bad');
 assert.throws(()=>loadLocal(s,owner,CONFIG[1]),/unreadable/);
 assert.equal(valid(CONFIG[2],Array(401).fill({id:'t'})),false);
 assert.equal(valid(CONFIG[4],{calories:-5,protein:50}),false);
});
test('never overwrite local nonempty category on recovery',()=>{
 const s=store();
 s.setItem('mlc2-measurements-v1:user:user-a',JSON.stringify([{id:'local'}]));
 const before=s.getItem('mlc2-measurements-v1:user:user-a');
 const changes=restoreMissing(s,owner,[record('measurement',[{id:'cloud'}])]);
 assert.deepEqual(changes,[]);
 assert.equal(s.getItem('mlc2-measurements-v1:user:user-a'),before);
});
test('restore only missing or empty categories',()=>{
 const s=store();
 s.setItem('mlc2-custom-plans-v1:user:user-a','[]');
 s.setItem('mlc2-food-goals-v1:user:user-a',JSON.stringify({calories:2200,protein:130}));
 const changes=restoreMissing(s,owner,[
  record('custom-plan',[{id:'p1',title:'Routine',ids:['chest-press']}]),
  record('tracking',[{id:'t1',day:'2026-11-15',type:'water',value:250}]),
  record('goal',{calories:1800,protein:100})
 ]);
 assert.deepEqual(changes,['Custom workouts','Water and weight tracking']);
 assert.equal(JSON.parse(s.getItem('mlc2-custom-plans-v1:user:user-a'))[0].id,'p1');
 assert.equal(JSON.parse(s.getItem('mlc2-food-goals-v1:user:user-a')).calories,2200);
});
test('missing cloud records and tombstones do not delete local data',()=>{
 const s=store();s.setItem('mlc2-local-daily-v1:user:user-a',JSON.stringify([{id:'t1'}]));
 const before=s.getItem('mlc2-local-daily-v1:user:user-a');
 assert.deepEqual(restoreMissing(s,owner,[{...record('tracking',[]),deleted:true}]),[]);
 assert.equal(s.getItem('mlc2-local-daily-v1:user:user-a'),before);
});
test('corrupt remote record aborts without touching local history',()=>{
 const s=store();
 assert.throws(()=>restoreMissing(s,owner,[{...record('measurement',[{id:'m1'}]),payload:{format:'unexpected',entries:[]}}]),/invalid/);
 assert.equal(s.data.size,0);
});
test('local storage denial rolls back earlier restorations',()=>{
 const s=store(),original=s.setItem,old=JSON.stringify([{id:'old'}]);
 s.setItem('mlc2-custom-plans-v1:user:user-a','[]');
 s.setItem=(key,value)=>{
  if(key==='mlc2-measurements-v1:user:user-a')throw Error('disk full');
  return original(key,value);
 };
 assert.throws(()=>restoreMissing(s,owner,[
  record('custom-plan',[{id:'new'}]),record('measurement',[{id:'m1'}])
 ]),/write failed/);
 assert.equal(s.getItem('mlc2-custom-plans-v1:user:user-a'),'[]');
});
test('compare JSONB records without key ordering false conflicts',()=>{
 assert.equal(equal({id:'p',title:'Workout',ids:['a']},{ids:['a'],title:'Workout',id:'p'}),true);
});
