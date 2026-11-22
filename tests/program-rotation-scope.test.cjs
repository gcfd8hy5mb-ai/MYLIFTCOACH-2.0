'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const adherence=require('../goal-program-adherence.js');
const calendar=require('../goal-program-calendar.js');
const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('function programCompletedCount(program,source){');
const end=app.indexOf('\nfunction goalProgramAdherence(',start);
assert.ok(start>=0&&end>start,'Program rotation must share verified adherence records');
const sourceCode=app.slice(start,end);
const program={goal:'bulk',weeks:8,startDate:'2026-11-01'};
const mk=(id,planId,created,sets=[{exerciseId:'press',reps:10,weight:60}])=>({id,planId,created,sets});
const rows=[
 mk('a','custom-a','2026-11-05T12:00:00Z'),
 mk('b','custom-b','2026-11-10T13:00:00Z'),
 mk('c','coach-auto-day-1','2026-11-18T14:00:00Z'),
 mk('a','custom-a','2026-11-06T12:00:00Z'), // duplicate imported record
 mk('bad','custom-a','2026-11-19T11:00:00Z',[]),
 mk('future','custom-a','2026-11-29T12:00:00Z'),
 mk('old','custom-a','2026-10-15T12:00:00Z')
];
function count(choice,history=rows){
 const env={
  coachEvidence:()=>history,programCustomOptions:()=>[{id:'custom-a'},{id:'custom-b'}],
  verifiedOwnerId:'owner-1',localStorage:{},
  window:{
   MLC2GoalProgram:{progress:p=>calendar.progress(p,new Date('2026-11-22T12:00:00Z'))},
   MLC2CoachPreferences:{read:()=>({days:4})},
   MLC2ProgramAdherence:{summary:args=>adherence.summary({...args,now:new Date('2026-11-22T12:00:00Z')})}
  }
 };
 vm.createContext(env);
 vm.runInContext(sourceCode,env);
 env.program=program;env.choice=choice;
 return vm.runInContext('programCompletedCount(program,choice)',env);
}
test('Pinned custom program advances only for verified workouts from its chosen routine',()=>{
 assert.equal(count({mode:'custom',customId:'custom-a'}),1);
});
test('Rotating custom program counts each distinct completed eligible routine only',()=>{
 assert.equal(count({mode:'custom',customId:''}),2);
});
test('Generated program excludes all manual or unrelated custom sessions',()=>{
 assert.equal(count({mode:'generated',customId:''}),1);
});
test('Mixed program counts the pinned custom and eligible Coach session, never other customs',()=>{
 assert.equal(count({mode:'mixed',customId:'custom-a'}),2);
});
test('Duplicate, empty, old and future logs cannot skip the next training day',()=>{
 const onlyInvalid=[
  mk('bad','custom-a','2026-11-17T12:00:00Z',[]),
  mk('future','custom-a','2026-11-27T12:00:00Z'),
  mk('old','custom-a','2026-10-17T12:00:00Z'),
  mk('zero','custom-a','2026-11-17T12:00:00Z',[{exerciseId:'press',reps:0}])
 ];
 assert.equal(count({mode:'custom',customId:'custom-a'},onlyInvalid),0);
 assert.equal(count({mode:'custom',customId:'custom-a'}),1);
 assert.match(sourceCode,/MLC2ProgramAdherence\?\.summary/);
});
