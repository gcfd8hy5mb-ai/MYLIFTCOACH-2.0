'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {build}=require('./package.cjs');

const liveCommit='79c7a3d413aae0ed90a16c36693e3027b7519dbd';

function prepareUpdate({candidate,previous,original,output}){
 const head=execFileSync('git',['-C',previous,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(head!==liveCommit)throw Error('Previous deployment source does not match the pinned live release');
 if(execFileSync('git',['-C',previous,'status','--porcelain'],{encoding:'utf8'}).trim())
  throw Error('Previous deployment source must be a clean checkout');
 build({candidate,original,output});
 const priorOutput=path.join(output,'previous-package');
 const priorBuild=require(path.resolve(previous,'review/production/package.cjs')).build;
 priorBuild({candidate:previous,original,output:priorOutput});
 fs.renameSync(path.join(priorOutput,'replacement'),path.join(output,'update-rollback'));
 fs.rmSync(priorOutput,{recursive:true});
}

if(require.main===module){
 const [original,previous,output]=process.argv.slice(2);
 if(!original||!previous||!output)throw Error('Usage: node review/production/package-update.cjs <original-checkout> <live-2.0-checkout> <new-output-directory>');
 prepareUpdate({candidate:path.resolve(__dirname,'../..'),original:path.resolve(original),
  previous:path.resolve(previous),output:path.resolve(output)});
}

module.exports={prepareUpdate,liveCommit};
