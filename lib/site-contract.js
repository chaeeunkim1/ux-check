export const siteImageLabels={before:'데스크톱 · 상단',after:'모바일 · 상단','desktop-middle':'데스크톱 · 중간 구간','desktop-bottom':'데스크톱 · 마지막 확인 구간','mobile-middle':'모바일 · 중간 구간','mobile-bottom':'모바일 · 마지막 확인 구간'};
export const siteImageIds=Object.keys(siteImageLabels);
export function captureOffsets(documentHeight,viewportHeight,maxHeight=12000){
 const end=Math.max(0,Math.min(documentHeight,maxHeight)-viewportHeight);
 if(end<=100)return [0];
 if(end<=viewportHeight)return [0,end];
 return [0,Math.round(end/2),end];
}
export function describeSiteScope(screens=[]){return `공개 페이지 1개 · 데스크톱/모바일 ${screens.length||2}개 캡처 구간 · 각 화면의 최대 문서 높이 12,000px 안에서 최대 3개 구간 · 클릭 및 입력 미실행`;} 
export function siteAnalysisFacts(capture){
 const overview=side=>{const f=capture.facts?.[side];if(!f)return null;return {viewport:f.viewport,documentWidth:f.documentWidth,documentHeight:f.documentHeight,hasViewportMeta:f.hasViewportMeta,language:f.language,headings:f.headings?.slice(0,16),counts:f.counts,unlabelledInputs:f.unlabelledInputs,emptyButtons:f.emptyButtons};};
 const facts={url:capture.finalUrl,scope:capture.scope,desktop:overview('desktop'),mobile:overview('mobile'),screens:capture.screens?.map(s=>({key:s.key,label:s.label,scrollY:s.scrollY,viewport:s.viewport,observations:s.observations?.slice(0,18)}))};
 // Preserve valid JSON and share the space across captured views instead of cutting off later mobile facts.
 let encoded=JSON.stringify(facts);
 while(encoded.length>18000){
  const largest=facts.screens?.filter(s=>s.observations?.length).sort((a,b)=>b.observations.length-a.observations.length)[0];
  if(largest){largest.observations.pop();}else{for(const side of ['desktop','mobile'])if(facts[side]){facts[side].headings=[];facts[side].unlabelledInputs=[];}encoded=JSON.stringify(facts);if(encoded.length>18000)return JSON.stringify({url:capture.finalUrl,scope:capture.scope,note:'문서 관찰값의 용량을 줄였습니다. 제공된 캡처를 기준으로 확인하세요.'});break;}
  encoded=JSON.stringify(facts);
 }
 return encoded;
}
