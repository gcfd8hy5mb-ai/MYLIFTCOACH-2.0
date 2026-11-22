'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const pref=require('../coach-preferences.js');
const builder=require('../coach-program-builder.js');
const store=()=>{const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};
test('Coach training preferences are separate for guest and authenticated accounts',()=>{
 const db=store();
 pref.save(db,null,{goal:'balanced',days:3,equipment:'Machine'});
 pref.save(db,'account-a',{goal:'strength',days:5,equipment:'Dumbbell'});
 pref.save(db,'account-b',{goal:'muscle',days:4,equipment:'Cable'});
 assert.deepEqual(pref.read(db,null),{goal:'balanced',days:3,equipment:'Machine'});
 assert.deepEqual(pref.read(db,'account-a'),{goal:'strength',days:5,equipment:'Dumbbell'});
 assert.deepEqual(pref.read(db,'account-b'),{goal:'muscle',days:4,equipment:'Cable'});
 assert.notEqual(pref.key('account-a'),pref.key('account-b'));
});
test('Invalid preference input fails without overwriting existing account settings',()=>{
 const db=store(),initial={goal:'balanced',days:4,equipment:'Machine'};
 pref.save(db,'account-a',initial);
 for(const bad of [{goal:'muscle',days:7,equipment:'Any'},{goal:'strength',days:4,equipment:'Laser'},{}])
  assert.throws(()=>pref.save(db,'account-a',bad));
 assert.deepEqual(pref.read(db,'account-a'),initial);
 assert.deepEqual(pref.read(db,'missing'),{goal:'balanced',days:4,equipment:'Any'});
 db.setItem(pref.key('account-a'),'{broken');
 assert.deepEqual(pref.read(db,'account-a'),{goal:'balanced',days:4,equipment:'Any'});
});
test('Automatic plan respects user goals, equipment and training days without invented weight',()=>{
 const catalog=['Chest','Back','Shoulders','Arms','Legs','Core'].map((group,i)=>({id:'exercise-'+i,group,name:group,equipment:'Machine'}));
 const options={goal:'strength',days:3,equipment:'Machine'};
 const result=builder.build(catalog,[],options);
 assert.equal(result.days.length,3);
 assert.ok(result.days.flatMap(x=>x.exercises).every(x=>x.reps==='5–8'&&x.weight===null&&x.equipment==='Machine'));
 const empty=builder.build(catalog,[],{goal:'strength',days:3,equipment:'Dumbbell'});
 assert.equal(empty.status,'unavailable');
});
test('Active Today UI includes account-scoped Coach preferences and no silent workout selection',()=>{
 const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
 assert.match(app,/MLC2CoachPreferences\?\.read\(localStorage,verifiedOwnerId\)/);
 assert.match(app,/MLC2CoachPreferences\.save\(localStorage,verifiedOwnerId,options\)/);
 assert.match(app,/panel\.hidden=!enabled/);
 assert.match(app,/start\.disabled=true;return/);
 for(const id of ['coachAutoGoal','coachAutoDays','coachAutoEquipment','coachAutoPreferences'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('coach-preferences.js?v=1'));
 assert.match(app,/const freshCoach=!selected&&betaView\(\)\.mode==='pro'\?coachAutonomousPlan\(\):null/);
});
