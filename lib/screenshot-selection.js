// Uploads on different sides must not cancel one another. A newer file on the
// same side supersedes only that side's pending decode.
export function createUploadTracker() {
 const revisions={before:0,after:0};
 const pending=new Set();
 return {
  begin(side){const revision=++revisions[side];pending.add(side);return revision;},
  current(side,revision){return revisions[side]===revision;},
  finish(side,revision){if(revisions[side]===revision)pending.delete(side);},
  busy(){return pending.size>0;}
 };
}

export function selectUploadedScreenshot(previous,side,image) {
 const other=side==='before'?'after':'before';
 return {...previous,[side]:image,[other]:previous[other]?.isSample?null:previous[other]};
}
