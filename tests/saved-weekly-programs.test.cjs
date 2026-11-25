'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const lib=require('../schedule-library.js'),aux=require('../sync/aux-data.js');
const file=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const makeStore=()=>{const m=new Map();return {
 getItem:k=>m.has(k)?m.get(k):null,
 setItem:(k,v)=>m.set(k,String(v)),
 removeItem:k=>m.delete(k),
 snapshot:()=>Object.fromEntries(m)
}};
const week={'0':'rest-day','1':'custom-one','2':'rest-day','3':'custom-two','4':'custom-one','5':'rest-day','6':'rest-day'};
test('multiple weekly programs can be saved and switched with complete rest days preserved',()=>{
 const s=makeStore();s.setItem(lib.WEEK,JSON.stringify(week));
 const first=lib.saveCopy(s,'Strength A');assert.equal(first.profiles.length,1);
 const secondWeek={...week,'1':'custom-two','3':'custom-one'};
 s.setItem(lib.WEEK,JSON.stringify(secondWeek));const second=lib.saveCopy(s,'Strength B');
 assert.equal(second.profiles.length,2);
 const activated=lib.activate(s,first.profiles[0].id,[{id:'custom-one'},{id:'custom-two'}]);
 assert.equal(activated.name,'Strength A');
 assert.deepEqual(lib.current(s),week);
 assert.equal(lib.read(s).profiles.length,2);
});
test('Coach activation preserves saved program and original weekday map without deletion',()=>{
 const s=makeStore();s.setItem(lib.WEEK,JSON.stringify(week));s.setItem(lib.SELECTED,'custom-one');
 const prev=lib.useCoach(s);
 assert.equal(prev.name,'Previous weekly schedule');
 assert.equal(lib.read(s).mode,'coach');
 assert.equal(lib.read(s).profiles.length,1);
 assert.deepEqual(lib.current(s),week);
 assert.equal(s.getItem(lib.SELECTED),'');
 const p=lib.read(s).profiles[0];
 lib.activate(s,p.id,[{id:'custom-one'},{id:'custom-two'}]);
 assert.equal(lib.read(s).mode,'weekly');
 assert.deepEqual(lib.current(s),week);
});
test('activating saved program rejects missing routines and leaves current state intact',()=>{
 const s=makeStore();s.setItem(lib.WEEK,JSON.stringify(week));
 const first=lib.saveCopy(s,'Do not lose me'),before=s.snapshot();
 assert.throws(()=>lib.activate(s,first.activeId,[{id:'custom-one'}]),/unavailable/);
 assert.deepEqual(s.snapshot(),before);
});
test('new full week saves previous schedule as an archived option',()=>{
 const s=makeStore();s.setItem(lib.WEEK,JSON.stringify(week));
 const next={...week,'1':'custom-three'};
 const state=lib.newFullWeek(s,'New weekly program',next);
 assert.equal(state.profiles.length,2);
 assert.equal(state.profiles[0].name,'Previous weekly schedule');
 assert.deepEqual(state.profiles[0].days,week);
 assert.deepEqual(state.profiles[1].days,next);
});
test('deleted named schedule never removes workout history or active weekday schedule',()=>{
 const s=makeStore();s.setItem(lib.WEEK,JSON.stringify(week));
 const saved=lib.saveCopy(s,'Strength A');s.setItem('completed-history','important');
 lib.remove(s,saved.activeId);
 assert.deepEqual(lib.current(s),week);
 assert.equal(lib.read(s).profiles.length,0);
 assert.equal(s.getItem('completed-history'),'important');
});
test('corrupted schedule library is rejected, not replaced',()=>{
 const s=makeStore();s.setItem(lib.KEY,'{bad');
 assert.throws(()=>lib.useCoach(s),/recovery/);
 assert.equal(s.getItem(lib.KEY),'{bad');
});
test('cloud validation and restore reject saved programs referencing missing custom workouts',()=>{
 const cfg=aux.CONFIG.find(x=>x.kind==='schedule-library');
 assert.ok(cfg,'schedule library cloud category required');
 const s=makeStore(),data=lib.newFullWeek(s,'Cloud program',week);
 assert.equal(aux.valid(cfg,data),true);
 assert.equal(aux.valid(cfg,{...data,profiles:[{...data.profiles[0],days:{'1':'bad id'}}]}),false);
 const remote=[{type:cfg.type,id:cfg.id,owner:'owner',payload:{format:'mlc2-aux-v1',entries:data},revision:1}];
 assert.deepEqual(aux.recoveryCandidates(s,'owner',remote),[]);
});
test('app wires mode and schedule selector without clearing weekly keys',()=>{
 const app=file('app.js'),html=file('index.html'),custom=file('custom-workouts.js'),worker=file('offline-worker.js');
 for(const id of ['activateCoachMode','activateSavedSchedule','saveScheduleCopy','removeSavedSchedule','savedScheduleChoice'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/scheduleLib\.useCoach\(store\)/);
 assert.match(app,/scheduleLib\.activate\(store,id/);
 assert.match(app,/scheduleLib\.saveCopy\(store,name/);
 assert.match(custom,/transactScheduleLibrary/);
 assert.match(custom,/updatedLibrary=library\?library\.newFullWeek/);
 assert.match(worker,/src="\.\/app\.js\?v=53"/);
});
