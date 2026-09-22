// Each viewport may reload the document. Keep its resource allowance separate,
// while retaining one hard ceiling for the whole capture.
export function createCaptureRequestBudget({perViewport=180,total=360}={}){
 let viewCount=0,totalCount=0;
 return {startViewport(){viewCount=0;},take(){viewCount++;totalCount++;return viewCount<=perViewport&&totalCount<=total;}};
}

export function createCaptureByteBudget({perViewport=45_000_000,total=90_000_000}={}){
 let viewBytes=0,totalBytes=0,exceeded=false;
 return {
  startViewport(){viewBytes=0;},
  take(size){viewBytes+=size;totalBytes+=size;exceeded ||= viewBytes>perViewport||totalBytes>total;return !exceeded;},
  stats(){return {bytes:totalBytes,viewportBytes:viewBytes,byteLimitExceeded:exceeded};}
 };
}
