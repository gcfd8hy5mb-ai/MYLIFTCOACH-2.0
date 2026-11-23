'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const more=html.slice(html.indexOf('<section id="settings"'),html.indexOf('</main>'));
test('More groups existing controls and keeps technical controls in the hidden disclosure',()=>{
 const groups=[...more.matchAll(/<details[^>]*>([\s\S]+?)<\/details>/g)].map(match=>match[1]);
 assert.equal(groups.length,7);
 for(const [index,ids] of [
  [0,['authAction','accountIdentity']],
  [2,['betaAccessSelect','betaAccessStatus']],
  [3,['autoWorkoutSyncNow','restoreAccountWorkouts','backupOtherFitnessData','recoveryExportAction','recoveryRestoreAction']],
  [4,['clearDemo']],
  [5,['previewWelcome']],
  [6,['cloudArchiveAction','checkpointCompareAction','dataHealthAction','migrationReadinessFile','reviewLegacyMedia']]
 ]){
  for(const id of ids)assert.ok(groups[index].includes('id="'+id+'"'),id);
 }
 assert.match(more,/<details id="advancedTools"[^>]*hidden>/);
 for(const [,page] of more.matchAll(/data-account-page="([^"]+)"/g)){
  assert.ok(html.includes('<section id="'+page+'"'),page);
 }
 assert.match(app,/setPage\(el\.dataset\.accountPage\)/);
});
test('advanced visibility requires the verified owner and server-managed metadata',()=>{
 const start=app.indexOf('function canViewAdvancedTools');
 const allow=vm.runInNewContext(app.slice(start,app.indexOf('function renderSettings',start))+';canViewAdvancedTools');
 const approved={id:'owner',app_metadata:{myliftcoach_advanced_tools:true}};
 assert.equal(allow('owner',approved),true);
 assert.equal(allow(null,approved),false);
 assert.equal(allow('other',approved),false);
 assert.equal(allow('owner',{id:'owner',user_metadata:approved.app_metadata}),false);
});

test('all More panels close within their intended disclosure',()=>{
 const stack=[];
 for(const [tag,closing,type] of more.matchAll(/<(\/?)(section|article|div|details)(?=[\s>])[^>]*>/g)){
  if(closing)assert.equal(stack.pop(),type,tag);
  else stack.push(type);
 }
 assert.deepEqual(stack,[]);
});

test('mobile routes share the same existing fixed wallpaper without page-specific painters',()=>{
 const read=name=>fs.readFileSync(name,'utf8');
 const wallpaper=read('rich-teal-cards.css');
 assert.equal((wallpaper.match(/body::before/g)||[]).length,1);
 assert.match(wallpaper,/body\s*\{\s*background:none!important/);
 assert.match(wallpaper,/body::before\s*\{[^}]*position:fixed;[^}]*inset:0;[^}]*approved-vertical-marble-sharp\.webp\?v=11[^}]*cover no-repeat/);
 for(const name of ['home-rebuild.css','more-page.css'])assert.doesNotMatch(read(name),/body[^\n{]*::before|approved-vertical-marble-sharp/);
 assert.match(html,/apple-mobile-web-app-status-bar-style" content="black-translucent"/);
 assert.match(read('mobile-header-cleanup.css'),/env\(safe-area-inset-top\)/);
});

test('installed app requests standalone edge-to-edge and a matching dark fallback',()=>{
 const manifest=JSON.parse(fs.readFileSync('app.webmanifest','utf8'));
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.scope,'./');
 assert.equal(manifest.start_url,'./');
 assert.equal(manifest.background_color,manifest.theme_color);
 assert.ok(html.includes('<meta name="theme-color" content="'+manifest.theme_color+'">'));
 assert.match(html,/viewport-fit=cover/);
 assert.match(html,/rel="manifest" href="\.\/app\.webmanifest\?v=1"/);
 assert.match(html,/apple-mobile-web-app-capable" content="yes"/);
});
