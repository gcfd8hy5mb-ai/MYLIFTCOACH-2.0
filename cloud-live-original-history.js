/* Read-only direct original-account workout history, no archive download needed.
   GET only; never merges, restores, caches or writes original or 2.0 records. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MLC2LiveOriginalHistory=api;
})(globalThis,function(){
'use strict';
async function load({url,publishableKey,token,userId,tables,fetcher,makeUrl,
 archiveService,historyViewer,inspector,storageModel,stillAuthenticated}){
 if(!archiveService||typeof archiveService.collect!=='function'||typeof archiveService.serialize!=='function'
  ||!historyViewer||typeof historyViewer.open!=='function'||typeof inspector!=='function'
  ||typeof stillAuthenticated!=='function')throw Error('Original history read-only dependencies are missing');
 if(!stillAuthenticated(userId,token))throw Error('Account changed; no original history loaded');
 const archive=await archiveService.collect({url,publishableKey,token,userId,tables,fetcher,makeUrl});
 if(!stillAuthenticated(userId,token))throw Error('Account changed during cloud history read');
 // Full archive validation occurs before any history is shown, and no archive is downloaded.
 const text=archiveService.serialize(archive);
 const view=historyViewer.open({archiveText:text,ownerId:userId,tables,inspector,storageModel});
 if(!stillAuthenticated(userId,token))throw Error('Account changed while decoding cloud history');
 return view;
}
return Object.freeze({load});
});