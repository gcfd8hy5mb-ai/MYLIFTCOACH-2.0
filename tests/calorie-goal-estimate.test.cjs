'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const calorie=require('../calorie-goal-estimate.js');
function store(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)}}
const base={age:30,weightKg:80,heightCm:175,sex:'male',activity:'moderate',goal:'maintain'};
test('Goal targets use Mifflin-St Jeor and no meal logs',()=>{
 const maintenance=calorie.estimate(base);
 assert.equal(maintenance.target,maintenance.maintenance);
 const bulk=calorie.estimate({...base,goal:'bulk'});
 const strength=calorie.estimate({...base,goal:'strength'});
 const cut=calorie.estimate({...base,goal:'cut'});
 assert.equal(bulk.adjustment,250);
 assert.equal(strength.adjustment,0);
 assert.equal(cut.adjustment,-300);
 assert.ok(bulk.target>maintenance.target&&cut.target<maintenance.target);
 assert.equal(calorie.estimate({...base,sex:'female'}).target<maintenance.target,true);
 assert.deepEqual(Object.keys(maintenance).sort(),['adjustment','goal','maintenance','method','needsReview','target'].sort());
});
test('Account profiles remain separate and missing or malformed profiles are not claimed',()=>{
 const db=store();calorie.save(db,'account-a',{...base,goal:'bulk'});
 calorie.save(db,'account-b',{...base,goal:'cut'});
 calorie.save(db,null,base);
 assert.equal(calorie.read(db,'account-a').goal,'bulk');
 assert.equal(calorie.read(db,'account-b').goal,'cut');
 assert.equal(calorie.read(db,null).goal,'maintain');
 assert.equal(calorie.read(db,'unknown'),null);
});
test('Reject minors and invalid weight, height, activity without changing saved data',()=>{
 const db=store();calorie.save(db,'account-a',base);
 for(const bad of [{...base,age:17},{...base,weightKg:5},{...base,heightCm:0},{...base,activity:'extreme'}])
  assert.throws(()=>calorie.save(db,'account-a',bad));
 assert.equal(calorie.read(db,'account-a').goal,'maintain');
});
test('App calorie goal is optional and not a macro or meal counter',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const app=fs.readFileSync('app.js','utf8');
 assert.match(html,/id="calorieGoalForm"/);
 assert.match(html,/calorie-goal-estimate\.js\?v=1/);
 assert.match(app,/MLC2CalorieGoal\.estimate\(profile\)/);
 assert.match(app,/MLC2CalorieGoal\.save\(localStorage,verifiedOwnerId,profile\)/);
 assert.doesNotMatch(html.slice(html.indexOf('<section id="nutrition"'),html.indexOf('<section id="settings"')),/foodLog|scanBarcode|macroInput/i);
});
