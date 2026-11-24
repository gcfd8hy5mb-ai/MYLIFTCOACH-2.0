'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=require('../goal-program-adherence.js');
const calendar=require('../goal-program-calendar.js');
const program={goal:'bulk',weeks:8,startDate:'2026-11-01'};
const progress=calendar.progress(program,'2026-11-18T14:00:00Z');
const plans=[{id:'custom-a'},{id:'custom-b'}];
const mk=(id,planId,created,sets=[{exerciseId:'press',reps:10,weight:50}])=>({id,planId,created,sets});
const sessions=[
 mk('a','custom-a','2026-11-02T12:00:00Z'),
 mk('b','custom-b','2026-11-09T12:00:00Z'),
 mk('c','coach-auto-day-1','2026-11-16T12:00:00Z'),
 mk('d','custom-a','2026-11-17T12:00:00Z'),
 mk('x','custom-a','2026-10-25T12:00:00Z'),
 mk('y','custom-a','2027-01-20T12:00:00Z'),
 mk('d','custom-a','2026-11-17T12:00:00Z'),
 mk('empty','custom-a','2026-11-18T12:00:00Z',[])
];
const calc=(source,rows=sessions)=>api.summary({program,progress,source,customPlans:plans,sessions:rows,days:4,now:'2026-11-18T14:00:00Z'});
test('Program calendar remains bounded to its actual eight-week duration',()=>{
 assert.equal(progress.week,3);
 assert.equal(calc({mode:'mixed',customId:''}).completed,4);
 assert.equal(calc({mode:'mixed',customId:''}).weekCompleted,2);
 assert.equal(calc({mode:'mixed',customId:''}).planned,32);
 assert.equal(calc({mode:'mixed',customId:''}).missedPriorSessions,6);
});
test('Pinned custom program ignores other routines and Coach sessions',()=>{
 const x=calc({mode:'custom',customId:'custom-a'});
 assert.equal(x.completed,2);
 assert.equal(x.weekCompleted,1);
 assert.equal(x.missedPriorSessions,7);
});
test('Generated mode counts only Coach days, not manual custom sessions',()=>{
 const x=calc({mode:'generated',customId:''});
 assert.equal(x.completed,1);
 assert.equal(x.weekCompleted,1);
 assert.equal(x.missedPriorSessions,8);
});
test('Duplicate and empty sessions never inflate actual workout counts',()=>{
 const rows=[mk('same','custom-a','2026-11-17T12:00:00Z'),
             mk('same','custom-a','2026-11-17T15:00:00Z'),
             mk('empty','custom-a','2026-11-17T16:00:00Z',[]),
             mk('invalid','custom-a','2026-11-18T12:00:00Z',[{exerciseId:'press',reps:0,weight:50}])];
 assert.equal(calc({mode:'custom',customId:'custom-a'},rows).completed,1);
});
test('Future dated records cannot count as completed even if they fall inside program',()=>{
 const future=mk('future','custom-a','2026-11-25T12:00:00Z');
 const normal=mk('normal','custom-a','2026-11-16T12:00:00Z');
 assert.equal(calc({mode:'custom',customId:'custom-a'},[future,normal]).completed,1);
});
test('Missed days never advance session rotation or produce synthetic history',()=>{
 const rows=[mk('one','custom-a','2026-11-02T12:00:00Z')];
 const a=calc({mode:'custom',customId:'custom-a'},rows);
 assert.equal(a.completed,1);
 assert.equal(a.weekCompleted,0);
 assert.equal(a.missedPriorSessions,7);
 assert.match(a.nextSession,/missed days never count/);
 assert.equal(rows.length,1);
});
test('Week and cycle targets adjust to three or five days without changing logs',()=>{
 const base={program,progress,source:{mode:'generated'},customPlans:plans,sessions};
 const a=api.summary({...base,days:3}),b=api.summary({...base,days:5});
 assert.equal(a.planned,24);assert.equal(b.planned,40);
 assert.equal(a.weekTarget,3);assert.equal(b.weekTarget,5);
});
test('Integrated goal screen shows only account-filtered completed sessions',()=>{
 const app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8');
 assert.match(app,/MLC2ProgramAdherence\?\.summary/);
 assert.match(app,/sessions:coachEvidence\(\)/);
 assert.match(app,/missed session\(s\) in previous weeks/);
 assert.match(html,/goal-program-adherence\.js\?v=1/);
 assert.match(html,/app\.js\?v=52/);
});
