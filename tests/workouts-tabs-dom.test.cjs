'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('workouts-tabs-n.js','utf8');
class Element{
 constructor(tag='div'){this.tagName=tag;this.dataset={};this.attributes={};this.children=[];this.listeners={};this.hidden=false;this.textContent='';this.tabIndex=0;}
 setAttribute(key,value){this.attributes[key]=value}
 append(...children){this.children.push(...children)}
 addEventListener(type,callback){this.listeners[type]=callback}
 querySelector(selector){
  if(selector.startsWith('[data-workout-n-tab=')){const id=selector.split('"')[1];return this.children.find(el=>el.dataset.workoutNTab===id)}
  if(selector==='[aria-selected="true"]')return this.children.find(el=>el.attributes['aria-selected']==='true');
  return null;
 }
 closest(){return this.parent}
 focus(){this.focused=true}
 click(){this.clickCount=(this.clickCount||0)+1}
}
function setup(){
 const page=new Element('section'),heading=new Element(),toolbar=new Element(),schedule=new Element(),recovery=new Element(),grid=new Element(),legacy=new Element(),create=new Element();
 const homeTitle=new Element(),homeStart=new Element(),description=new Element(),headerTitle=new Element();
 headerTitle.textContent='Your workouts';homeTitle.textContent='Selected custom workout';homeStart.dataset.homeWorkout='custom-01';
 heading.querySelector=selector=>selector==='h1'?headerTitle:selector==='p'?description:null;
 const scheduleChild=new Element();scheduleChild.parent=schedule;
 const lookup={'.page-heading':heading,'.custom-workout-toolbar':toolbar,'#weeklySchedule':scheduleChild,'#guestWorkoutRecovery':recovery,'#workoutGrid':grid,'.original-plan-panel':legacy};
 page.querySelector=selector=>lookup[selector];
 const ids={workouts:page,createWorkout:create,todayTitle:homeTitle,todayStart:homeStart,todayDescription:Object.assign(new Element(),{textContent:'4 exercises'})};
 const document={readyState:'complete',getElementById:id=>ids[id]||null,createElement:tag=>new Element(tag)};
 const MutationObserver=class{observe(){}};
 const window={};
 new Function('document','MutationObserver','window',source)(document,MutationObserver,window);
 assert.equal(typeof window.MLC2WorkoutsSelectTab,'function');
 const nav=page.children.find(el=>el.className==='workout-tabs-n');
 const tabs=nav.children;
 const panels=page.children.filter(el=>el.className==='workouts-n-panel');
 return {page,nav,tabs,panels,homeStart,homeTitle,toolbar,schedule,grid,recovery,legacy};
}
test('three tabs appear, Today selected, no unrelated page needed',()=>{
 const {page,tabs,panels}=setup();
 assert.equal(page.dataset.compactTabsReady,'true');
 assert.deepEqual(tabs.map(b=>b.textContent),['Today','My Workouts','Schedule']);
 assert.deepEqual(panels.map(p=>p.hidden),[false,true,true]);
});
test('tab navigation retains actual N editor and schedule elements',()=>{
 const {nav,tabs,panels,toolbar,schedule,grid,recovery,legacy}=setup();
 nav.listeners.click({target:{closest:()=>tabs[1]}});
 assert.deepEqual(panels.map(p=>p.hidden),[true,false,true]);
 assert.ok(panels[1].children.includes(toolbar));
 assert.ok(panels[1].children.includes(grid));
 assert.ok(panels[1].children.includes(recovery));
 assert.ok(panels[1].children.find(p=>p.children?.includes(legacy)));
 nav.listeners.click({target:{closest:()=>tabs[2]}});
 assert.deepEqual(panels.map(p=>p.hidden),[true,true,false]);
 assert.ok(panels[2].children.includes(schedule));
});
test('Start delegates to proven N existing Start handler',()=>{
 const {panels,homeStart}=setup();
 const actions=panels[0].children[0].children[3];
 actions.children[0].listeners.click();
 assert.equal(homeStart.clickCount,1);
});
test('Change workout selects My Workouts without modifying account state',()=>{
 const {panels}=setup();
 const actions=panels[0].children[0].children[3];
 actions.children[1].listeners.click();
 assert.deepEqual(panels.map(p=>p.hidden),[true,false,true]);
});
