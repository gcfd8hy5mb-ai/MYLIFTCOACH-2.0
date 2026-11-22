/* Preserve original exercise IDs and approved image mappings, but restore
   complete canonical instructions for three legacy workout-plan aliases. */
(()=>{
'use strict';
const catalog=window.MLC2_EXERCISE_CATALOG;
if(!Array.isArray(catalog)||catalog.length!==344)return;
const byId=new Map(catalog.map(exercise=>[exercise.id,exercise]));
const aliases={
 'chest-press':'machine-chest-press',
 'triceps-push':'triceps-pushdown',
 'leg-curl':'seated-leg-curl'
};
for(const [legacyId,canonicalId] of Object.entries(aliases)){
 const legacy=byId.get(legacyId),canonical=byId.get(canonicalId);
 if(!legacy||!canonical||legacy.name!==canonical.name||
   !canonical.how||!canonical.tips?.length||!canonical.mistakes?.length||!canonical.equipment)continue;
 // Leave the exercise ID, demonstration artwork, sets, reps and plan mapping intact.
 legacy.how=canonical.how;
 legacy.cue=canonical.cue||canonical.how;
 legacy.tips=[...canonical.tips];
 legacy.mistakes=[...canonical.mistakes];
 legacy.equipment=canonical.equipment;
}
})();
