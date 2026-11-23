'use strict';
const productionRepository='gcfd8hy5mb-ai/workout-tracker';
const competingWorkflows=['pages.yml','myliftcoach2-pages-preview.yml'];
const nonterminal=['queued','in_progress','waiting','pending','requested'];

async function verifyPagesGate({repository,approvedSha,candidateSha,read}){
 if(repository!==productionRepository)throw Error('Wrong repository for MYLIFTCOACH Pages release');
 if(!/^[0-9a-f]{40}$/.test(candidateSha)||candidateSha!==approvedSha)
  throw Error('Candidate does not match the approved release SHA');
 for(const file of competingWorkflows){
  const endpoint='/repos/'+repository+'/actions/workflows/'+file;
  const workflow=await read(endpoint);
  // A deleted or inaccessible workflow is a change to the reviewed baseline.
  if(workflow?.path!=='.github/workflows/'+file||workflow.state!=='disabled_manually')
   throw Error('Competing Pages workflow is not confirmed disabled: '+file);
  const results=await Promise.all(nonterminal.map(status=>read(endpoint+'/runs?per_page=1&status='+status)));
  if(results.some(result=>result?.total_count!==0||!Array.isArray(result.workflow_runs)||result.workflow_runs.length))
   throw Error('Competing Pages workflow still has an active or unverified run: '+file);
 }
}
if(require.main===module){
 const token=process.env.MLC2_ACTIONS_READ_TOKEN;
 if(!token)throw Error('Repository Actions read access is required');
 verifyPagesGate({repository:process.env.GITHUB_REPOSITORY,approvedSha:process.env.APPROVED_CANDIDATE,
  candidateSha:process.env.CANDIDATE,read:async endpoint=>{
   const response=await fetch('https://api.github.com'+endpoint,{
    headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},
    redirect:'error',signal:AbortSignal.timeout(10000)
   });
   if(!response.ok)throw Error('Cannot verify the competing Pages workflow ('+response.status+')');
   return response.json();
  }}).then(()=>console.log('Approved commit and paused competing Pages workflows verified.')).catch(error=>{
   console.error(error.message);process.exitCode=1;
  });
}
module.exports={verifyPagesGate};
