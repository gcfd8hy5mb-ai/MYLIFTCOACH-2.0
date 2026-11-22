'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const aux=require('../sync/aux-data.js');
const store=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
const expectations=[
 ['coach-training-preferences',{goal:'strength',days:4,equipment:'Machine'}],
 ['calorie-estimate',{age:35,heightCm:175,weightKg:80,sex:'male',activity:'moderate',goal:'strength'}],
 ['goal-program',{goal:'strength',weeks:8,startDate:'2026-11-22'}],
 ['goal-program-source',{mode:'custom',customId:'custom-c1',signature:'2026-11-22:strength:8'}]
];
test('Program profile, duration, source and Coach preferences have separate verified auxiliary keys',()=>{
 const ids=new Set();
 for(const [kind,value] of expectations){
  const config=aux.CONFIG.find(x=>x.kind===kind);
  assert.ok(config,'missing cloud category '+kind);
  assert.equal(config.type,'goal');
  assert.ok(!ids.has(aux.recordId(config)));ids.add(aux.recordId(config));
  assert.equal(aux.valid(config,value),true);
 }
});
test('Cloud recovery fills only missing goal settings for verified owner, never another account',()=>{
 const db=store(),owner='verified-a',other='verified-b';
 const records=expectations.map(([kind,value])=>{
  const config=aux.CONFIG.find(x=>x.kind===kind);
  return {type:config.type,id:aux.recordId(config),payload:{format:'mlc2-aux-v1',entries:value}};
 });
 const restored=aux.restoreMissing(db,owner,records);
 assert.equal(restored.length,4);
 for(const [kind,value] of expectations){
  const config=aux.CONFIG.find(x=>x.kind===kind);
  assert.deepEqual(aux.loadLocal(db,owner,config).value,value);
  assert.equal(aux.loadLocal(db,other,config).exists,false);
 }
 // Subsequent cloud recovery is fill-only and cannot override a local change.
 const calendar=aux.CONFIG.find(x=>x.kind==='goal-program');
 const current={goal:'cut',weeks:12,startDate:'2026-11-25'};
 db.setItem(calendar.key+':user:'+owner,JSON.stringify(current));
 assert.equal(aux.restoreMissing(db,owner,records).length,0);
 assert.deepEqual(aux.loadLocal(db,owner,calendar).value,current);
});
test('Invalid injected program preferences are rejected before cloud backups or restore',()=>{
 for(const [kind,bad] of [
  ['coach-training-preferences',{goal:'unsafe',days:4,equipment:'Any'}],
  ['calorie-estimate',{age:15,heightCm:175,weightKg:80,sex:'male',activity:'moderate',goal:'cut'}],
  ['goal-program',{goal:'cut',weeks:25,startDate:'2026-11-22'}],
  ['goal-program-source',{mode:'mixed',customId:'../escape',signature:'2026-11-22:cut:8'}]]){
  const cfg=aux.CONFIG.find(x=>x.kind===kind);
  assert.equal(aux.valid(cfg,bad),false);
 }
});
test('Changing program preferences queues the existing account cloud backup without cloud login in tests',()=>{
 const app=fs.readFileSync('app.js','utf8');
 assert.match(app,/window\.MLC2CoachPreferences\.save\(localStorage,verifiedOwnerId,options\);\s*try\{window\.MLC2ScheduleAuxSync/);
 assert.match(app,/window\.MLC2CalorieGoal\.save\(localStorage,verifiedOwnerId,profile\);\s*try\{window\.MLC2ScheduleAuxSync/);
});
