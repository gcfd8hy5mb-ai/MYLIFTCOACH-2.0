'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {keepOriginalLaunch,productionUrl,safeRollbackWorker}=require('../review/production/package.cjs');
const old={id:'./?app=myliftcoach',start_url:'./?app=myliftcoach',scope:'./'};

test('production replacement keeps the same project path and installed Home Screen identity',()=>{
 const next=keepOriginalLaunch({id:'./',scope:'./',start_url:'./',display:'standalone',theme_color:'#04252d'},old);
 for(const key of ['id','scope','start_url'])assert.equal(new URL(next[key],productionUrl).href,new URL(old[key],productionUrl).href);
 assert.equal(new URL(next.start_url,productionUrl).href,productionUrl+'?app=myliftcoach');
 assert.equal(next.theme_color,'#04252d');
});

test('production packaging stops for changed original launch metadata or a different rollback worker',()=>{
 assert.throws(()=>keepOriginalLaunch({}, {...old,start_url:'/'}),/Review the currently deployed/);
 assert.throws(()=>safeRollbackWorker('different working tree'),/review rollback safety/);
});
