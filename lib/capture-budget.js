// Each viewport may reload the document. Keep its resource allowance separate,
// while retaining one hard ceiling for the whole capture.
export function createCaptureRequestBudget({perViewport=180,total=360}={}){
 let viewCount=0,totalCount=0;
 return {startViewport(){viewCount=0;},take(){viewCount++;totalCount++;return viewCount<=perViewport&&totalCount<=total;}};
}
