'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {stage}=require('../pages/stage.cjs');

const productionUrl='https://gcfd8hy5mb-ai.github.io/workout-tracker/';
const rollbackCommit='24b3e3a40076f8d6aeb6fe6c603068652b268351';
const legacyWorkerHash='f7f41d0fea1448a4628654651cc624adf993ee41bf02e2de89d83dd68acdaf74';
const sha256=value=>createHash('sha256').update(value).digest('hex');
const git=(repository,...args)=>execFileSync('git',['-C',repository,...args],{maxBuffer:100*1024*1024});
const replace=(input,before,after)=>{
 if(typeof before==='string'?!input.includes(before):!before.test(input))
  throw Error('Unexpected production packaging input: '+before);
 return input.replace(before,after);
};

function keepOriginalLaunch(candidate,legacy){
 if(legacy.id!=='./?app=myliftcoach'||legacy.start_url!==legacy.id||legacy.scope!=='./')
  throw Error('Review the currently deployed Home Screen launch identity');
 return {...candidate,id:legacy.id,start_url:legacy.start_url,scope:legacy.scope};
}

function safeRollbackWorker(worker){
 if(sha256(worker)!==legacyWorkerHash)throw Error('Original worker changed; review rollback safety');
 // Keep the original offline shell and presentation routing. Activation must
 // not erase unrelated origin caches or force a navigation of an open workout.
 let safe=replace(worker,/const CACHE_NAME = "[^"]+";/,
  'const CACHE_NAME = "myliftcoach-home-v23-goal-program:scoped-rollback";');
 safe=replace(safe,'    await self.skipWaiting();\n','');
 safe=replace(safe,/self\.addEventListener\("activate",event=>\{[\s\S]*?\}\);\n\n(?=self\.addEventListener\("message")/,'');
 safe=replace(safe,"  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();\n",'');
 safe=replace(safe,'  if(url.origin!==self.location.origin)return;',
  '  if(!url.href.startsWith(self.registration.scope))return;');
 safe=safe.replaceAll('caches.match(event.request)','lookupRollbackCache(event.request)');
 return safe+`
async function lookupRollbackCache(request){
 const cache=await caches.open(CACHE_NAME);
 const direct=await cache.match(request);
 if(direct||request.mode!=='navigate')return direct;
 const scope=new URL(self.registration.scope),url=new URL(request.url);
 if(url.pathname===scope.pathname||url.pathname===new URL('index.html',scope).pathname)
  return cache.match(new URL('index.html',scope).href);
}
`;
}

function build({candidate,original,output}){
 const originalFile=file=>git(original,'show',rollbackCommit+':'+file);
 const candidateFile=file=>fs.readFileSync(path.join(candidate,file),'utf8');
 const head=git(original,'rev-parse','HEAD').toString().trim();
 if(head!==rollbackCommit)throw Error('Original checkout differs from the verified deployment');
 const legacy=JSON.parse(originalFile('manifest.json'));
 const manifest=keepOriginalLaunch(JSON.parse(candidateFile('app.webmanifest')),legacy);
 const rollbackWorker=safeRollbackWorker(originalFile('sw.js').toString());
 for(const checkout of [candidate,original]){
  if(!path.relative(path.resolve(checkout),path.resolve(output)).startsWith('..'+path.sep))
   throw Error('Choose a new output directory outside both checkouts');
 }
 if(fs.existsSync(output))throw Error('Production output directory must not already exist');
 const release=path.join(output,'replacement');
 stage(candidate,release); // Start from the existing tested static-file allowlist.
 const read=file=>fs.readFileSync(path.join(release,file),'utf8');
 const write=(file,data)=>fs.writeFileSync(path.join(release,file),data);

 const config=originalFile('supabase-config.js').toString();
 const runtime=candidateFile('app.js');
 const url=runtime.match(/^const BACKEND='([^']+)';$/m)?.[1];
 const key=runtime.match(/^const PUBLIC_KEY='(sb_publishable_[a-zA-Z0-9_-]+)';$/m)?.[1];
 if(!url||!key||!config.includes('"'+url+'"')||!config.includes('"'+key+'"'))
  throw Error('Replacement authentication differs from the deployed project');

 const manifestPath='./manifest.json?v=3';
 const html=replace(replace(read('index.html'),'connect-src \'none\'','connect-src '+url),
  './app.webmanifest?v=1',manifestPath);
 write('index.html',html);
 write('app.js',runtime);
 write('manifest.json',JSON.stringify(manifest,null,2)+'\n');
 write('offline-shell.js',replace(read('offline-shell.js'),"'./offline-worker.js'","'./sw.js'"));
 let worker=replace(read('offline-worker.js'),/acceptance-([a-f0-9]+)/,'replacement-$1');
 worker=replace(worker,"const shell = new URL('./index.html', scope).href;",
  `if (new URL(scope).pathname !== '${new URL(productionUrl).pathname}') throw Error('Unexpected production worker scope');\nconst shell = new URL('./index.html', scope).href;`);
 worker=replace(worker," './assets/image-coming-approved.webp'"," './assets/image-coming-approved.webp',\n '"+manifestPath+"'");
 write('sw.js',worker);
 fs.rmSync(path.join(release,'offline-worker.js'));
 fs.rmSync(path.join(release,'app.webmanifest'));

 const exact=git(original,'archive','--format=zip',rollbackCommit);
 const archiveName='workout-tracker-'+rollbackCommit.slice(0,12)+'-exact.zip';
 fs.writeFileSync(path.join(output,archiveName),exact);
 fs.writeFileSync(path.join(output,'scoped-rollback-sw.js'),rollbackWorker);
 const rollback=path.join(output,'rollback');
 fs.mkdirSync(rollback);
 execFileSync('unzip',['-q',path.join(path.resolve(output),archiveName),'-d',rollback]);
 fs.writeFileSync(path.join(rollback,'sw.js'),rollbackWorker);
 const details={productionUrl,originalCommit:rollbackCommit,
  originalIndexSha256:sha256(originalFile('index.html')),originalArchive:archiveName,
  originalArchiveSha256:sha256(exact),replacementWorkerSha256:sha256(worker),
  scopedRollbackWorkerSha256:sha256(rollbackWorker)};
 fs.writeFileSync(path.join(output,'CHECKSUMS.json'),JSON.stringify(details,null,2)+'\n');
 return details;
}

if(require.main===module){
 const [original,output]=process.argv.slice(2);
 if(!original||!output)throw Error('Usage: node review/production/package.cjs <read-only-original-checkout> <new-output-directory>');
 console.log(JSON.stringify(build({candidate:path.resolve(__dirname,'../..'),original,output}),null,2));
}
module.exports={build,keepOriginalLaunch,safeRollbackWorker,productionUrl,rollbackCommit};
