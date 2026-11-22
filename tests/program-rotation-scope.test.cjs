'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('function programCompletedCount(program,source){');
const end=app.indexOf('\nfunction renderCalorieGoal(){',start);
assert.ok(start>=0&&end>start,'program rotation function must exist before goal render');
const source=app.slice(start,end);
const program={goal:'bulk',weeks:8,startDate:'2026-11-22'};
const rows=[
 {planId:'custom-a',created:'2026-11-25T12:00:00Z'},
 {planId:'custom-b',created:'2026-11-25T13:00:00Z'},
 {planId:'coach-auto-day-1',created:'2026-11-25T14:00:00Z'},
 {planId:'custom-a',created:'2026-11-15T12:00:00Z'}
];
function count(choice){
 const env={coachEvidence:()=>rows,programCustomOptions:()=>[{id:'custom-a'},{id:'custom-b'}],Date,Set,program,choice};
 vm.createContext(env);
 vm.runInContext(source,env);
 return vm.runInContext('programCompletedCount(program,choice)',env);
}
test('Pinned custom program counts only enrolled routine',()=>{
 assert.equal(count({mode:'custom',customId:'custom-a'}),1);
});
test('Rotating custom program counts both eligible custom routines, not Coach sessions',()=>{
 assert.equal(count({mode:'custom',customId:''}),2);
});
test('Generated program counts only Coach session IDs, not custom workouts',()=>{
 assert.equal(count({mode:'generated',customId:''}),1);
});
test('Mixed program counts enrolled custom and Coach sessions but not unrelated custom routines',()=>{
 assert.equal(count({mode:'mixed',customId:'custom-a'}),2);
});
