'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const programs=require('../goal-program-calendar.js');
const source=require('../goal-program-source.js');
const storage=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)}};
const customA={id:'custom-a',title:'Upper Body',ids:['chest-press']};
const customB={id:'custom-b',title:'Leg Day',ids:['leg-press']};
const generated={id:'coach-auto-day-1',title:'Coach Day',ids:['lat-pulldown']};
test('Custom source keeps exact saved routine and sees later edits',()=>{
 const db=storage(),p=programs.start(db,'person-a',{goal:'bulk',weeks:8},'2026-11-22T12:00:00Z');
 const cfg=source.save(db,'person-a',p,{mode:'custom',customId:'custom-a'});
 assert.equal(source.choose({source:cfg,customPlans:[customA,customB],generated}).id,'custom-a');
 const edited={...customA,ids:['chest-press','incline-press']};
 assert.deepEqual(source.choose({source:cfg,customPlans:[edited,customB],generated}).ids,edited.ids);
 assert.equal(source.choose({source:cfg,customPlans:[customB],generated}),null,'missing pinned custom is never silently replaced');
});
test('Unpinned custom rotates eligible routines and mixed alternates',()=>{
 const cfg={mode:'custom',customId:''};
 assert.equal(source.choose({source:cfg,customPlans:[customA,customB],generated,completed:0}).id,'custom-a');
 assert.equal(source.choose({source:cfg,customPlans:[customA,customB],generated,completed:1}).id,'custom-b');
 assert.equal(source.choose({source:{mode:'mixed',customId:''},customPlans:[customA,customB],generated,completed:0}).programSource,'custom');
 assert.equal(source.choose({source:{mode:'mixed',customId:''},customPlans:[customA,customB],generated,completed:1}).programSource,'generated');
 assert.equal(source.choose({source:{mode:'generated',customId:''},customPlans:[customA,customB],generated}).id,generated.id);
});
test('Owner and program period boundaries prevent stale source leakage',()=>{
 const db=storage(),p=programs.start(db,'person-a',{goal:'cut',weeks:6},'2026-11-22T12:00:00Z');
 source.save(db,'person-a',p,{mode:'mixed',customId:''});
 assert.equal(source.read(db,'person-b',p),null);
 const other=programs.start(db,'person-a',{goal:'maintain',weeks:12},'2026-11-30T12:00:00Z');
 assert.equal(source.read(db,'person-a',other),null);
 assert.equal(source.read(db,'person-a',p).mode,'mixed');
});
test('Invalid source and custom ID rejected with current settings kept',()=>{
 const db=storage(),p=programs.start(db,'person-a',{goal:'strength',weeks:8},'2026-11-22T12:00:00Z');
 const existing=source.save(db,'person-a',p,{mode:'custom',customId:'custom-a'});
 for(const changes of [{mode:'unsafe',customId:''},{mode:'mixed',customId:'../../wrong'}])
  assert.throws(()=>source.save(db,'person-a',p,changes));
 assert.deepEqual(source.read(db,'person-a',p),existing);
});
test('Missing custom workouts do not fabricate custom sessions',()=>{
 assert.equal(source.choose({source:{mode:'custom',customId:''},customPlans:[],generated}),null);
 assert.equal(source.choose({source:{mode:'mixed',customId:''},customPlans:[],generated}).id,generated.id);
 assert.equal(source.choose({source:{mode:'mixed',customId:''},customPlans:[],generated:null}),null);
});
test('App links custom program mode to actual selected workout without overwriting custom plans',()=>{
 const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
 assert.match(app,/MLC2ProgramSource\?\.choose/);
 assert.match(app,/MLC2ProgramSource\.save\(store,owner,next/);
 assert.match(app,/MLC2ProgramSource\.save\(store,owner,renewed,previousSource\)/);
 assert.match(app,/let plan=selected\|\|\(freshCoach\?\.id===id\?freshCoach:null\)/);
 assert.match(html,/name="programSource"/);
 assert.match(html,/name="programCustom"/);
 assert.match(html,/goal-program-source\.js\?v=2/);
});
