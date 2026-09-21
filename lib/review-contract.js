import {siteImageIds,siteImageLabels} from './site-contract.js';
export const categories = { hierarchy: '정보 구조', clarity: '문구와 안내', action: '행동과 탐색', feedback: '상태와 피드백', form: '입력과 오류', readability: '가독성' };
export const severities = { high: '높음', medium: '보통', low: '낮음' };
export const statuses = { observed: '발견', resolved: '개선 확인', remaining: '남은 문제', new: '새로운 문제', uncertain: '확인 필요' };
const string = { type: 'string' };
export const reviewSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    summary: { ...string, description: '사용자의 업무 목적과 연결한 검수 요약, 한국어 2~3문장.' },
    strengths: { type: 'array', items: string, maxItems: 3 },
    limitations: { type: 'array', items: string, minItems: 1, maxItems: 4 },
    issues: { type: 'array', maxItems: 8, items: {
      type: 'object', additionalProperties: false,
      properties: {
        title: string,
        category: { type: 'string', enum: Object.keys(categories) },
        severity: { type: 'string', enum: Object.keys(severities) },
        status: { type: 'string', enum: Object.keys(statuses) },
        confidence: { type: 'string', enum: ['high','medium','low'] },
        element: { ...string, description: '문제가 보이는 구체적인 화면 요소와 표시 문구.' },
        observation: { ...string, description: '이미지에서 실제로 관찰한 사실. 추측과 분리한다.' },
        impact: { ...string, description: '업무 목적을 수행할 때 예상되는 영향. 확정된 사용자 행동처럼 쓰지 않는다.' },
        recommendation: { ...string, description: '개발자에게 바로 전달할 수 있는 구체적인 수정안.' },
        verification: { ...string, description: '개선 후 사람이 직접 확인할 실행 또는 관찰 기준.' },
        comparison: { ...string, description: '비교 모드에서 전후의 실제 차이. 단일 검수에서는 빈 문자열.' },
        image: { type: 'string', enum: siteImageIds },
        region: { type: 'object', additionalProperties: false, properties: { x: {type:'number'}, y: {type:'number'}, width: {type:'number'}, height: {type:'number'} }, required: ['x','y','width','height'], description: '선택한 이미지의 왼쪽 위를 원점으로 한 0~100 백분율 사각형. 실제 요소를 좁게 둘러싼다. 좌표는 참고용이다.' },
      },
      required: ['title','category','severity','status','confidence','element','observation','impact','recommendation','verification','comparison','image','region'],
    } },
  }, required: ['summary','strengths','limitations','issues'],
};
function text(value,max=1400) { if(typeof value!=='string')throw new Error('text_type');if(value.length>max)throw new Error('text_length');return value.trim(); }
export function validateReport(value,mode) {
  if(!value || !Array.isArray(value.issues) || value.issues.length>8) throw new Error('issues_array');
  const summary=text(value.summary);
  if(!summary)throw new Error('summary_empty');
  const list=(items,max,min=0)=>{if(!Array.isArray(items)||items.length>max||items.length<min)throw new Error('list_length');return items.map(v=>text(v));};
  const issues=value.issues.map((item,index)=>{
    if(!item || !Object.hasOwn(categories,item.category)||!Object.hasOwn(severities,item.severity)||!Object.hasOwn(statuses,item.status)||!['high','medium','low'].includes(item.confidence))throw new Error('issue_enum');
    if(mode==='review'&&(item.status!=='observed'||item.image!=='before'))throw new Error('single_mode_status');
    if(mode==='site'&&(item.status!=='observed'||!siteImageIds.includes(item.image)))throw new Error('site_mode_status');
    if(mode==='compare'&&(item.status==='observed'||!['before','after'].includes(item.image)))throw new Error('compare_mode_status');
    const region=item.region;
    if(!region||!['x','y','width','height'].every(k=>Number.isFinite(region[k]))||region.x<0||region.y<0||region.width<=0||region.height<=0||region.x+region.width>100.1||region.y+region.height>100.1)throw new Error('region_bounds');
    const normalized={ id:`finding-${index+1}`,number:index+1,category:item.category,severity:item.severity,status:item.status,confidence:item.confidence,image:item.image,region };
    for(const field of ['title','element','observation','impact','recommendation','verification','comparison'])normalized[field]=text(item[field],field==='title'?180:1400);
    if(['title','element','observation','recommendation','verification'].some(field=>!normalized[field]))throw new Error('evidence_empty');
    if(typeof item.auditNote==='string'&&item.auditNote.length<=800)normalized.auditNote=item.auditNote.trim();
    if(['supported','uncertain'].includes(item.auditVerdict))normalized.auditVerdict=item.auditVerdict;
    return normalized;
  });
  return {summary,strengths:list(value.strengths,3),limitations:list(value.limitations,4,1),issues};
}

export function reportMarkdown(report) {
  const lines=['# UX Check · UI/UX 검수 보고서','',`- 검수 방식: ${report.mode==='site'?'사이트 URL 검수':report.mode==='compare'?'개선 전후 비교':'화면 검수'}`,`- 생성 시각: ${report.createdAt}`,`- 분석 모델: ${report.model}`,`- 결과 출처: ${report.source==='saved-example'?'저장된 합성 예시 · 현재 실시간 분석 아님':'실제 API 분석'}`,`- 업무 목적: ${report.purpose}`,'','## 검수 요약','',report.summary,'','> AI 제안이며 최종 판단은 담당자가 합니다. 위치 표시는 근사치입니다. 스크린샷만으로 실제 동작이나 접근성 준수를 확정하지 않습니다.',''];
  if(report.siteContext)lines.splice(7,0,`- 검사 URL: ${report.siteContext.url}`,`- 확인 범위: ${report.siteContext.scope}`);
  for(const issue of report.issues)lines.push(`## ${issue.number}. ${issue.title}`,'',`- 우선순위: ${severities[issue.severity]} · ${categories[issue.category]} · ${statuses[issue.status]}`,`- 담당자 판단: ${({include:"개선안 채택",hold:"추가 확인",exclude:"검토에서 제외"})[report.reviewDecisions?.[issue.id]]??"검토 전 · AI 제안"}`,`- 관찰 위치: ${issue.element} (${report.mode==='site'?siteImageLabels[issue.image]:(issue.image==='after'?'개선 후':'원본')} 화면)`,`- 관찰 근거: ${issue.observation}`,`- 업무 영향: ${issue.impact}`,`- 개선안: ${issue.recommendation}`,`- 확인 기준: ${issue.verification}`, ...(issue.comparison?[`- 전후 차이: ${issue.comparison}`]:[]),...(issue.auditNote?[`- AI 근거 재검토${issue.auditVerdict==='uncertain'?' (추가 확인 필요)':''}: ${issue.auditNote}`]:[]),'');
  lines.push('## 잘된 점','',...report.strengths.map(v=>'- '+v),'','## 확인 범위와 한계','',...report.limitations.map(v=>'- '+v),'','이미지 파일은 보고서에 첨부되지 않습니다. 필요한 경우 별도로 보안 검토 후 전달하세요.');
  return lines.join('\n');
}

export function reportHtml(report) {
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const decision=value=>({include:'개선안 채택',hold:'추가 확인',exclude:'검토에서 제외'}[value]??'검토 전 · AI 제안');
  const list=values=>'<ul>'+values.map(value=>'<li>'+escape(value)+'</li>').join('')+'</ul>';
  const issues=report.issues.map(issue=>`<article><div class="meta">${escape(severities[issue.severity])} · ${escape(categories[issue.category])} · ${escape(statuses[issue.status])}</div><h2>${issue.number}. ${escape(issue.title)}</h2><p class="decision">담당자 판단: ${escape(decision(report.reviewDecisions?.[issue.id]))}</p><dl>${[['관찰 위치',issue.element+(report.mode==='site'?' ('+siteImageLabels[issue.image]+')':'')],['관찰 근거',issue.observation],['업무 영향',issue.impact],['개선 제안',issue.recommendation],['확인 기준',issue.verification],...(issue.comparison?[['전후 차이',issue.comparison]]:[]),...(issue.auditNote?[[issue.auditVerdict==='uncertain'?'AI 재검토 · 추가 확인 필요':'AI 근거 재검토',issue.auditNote]]:[])].map(([label,value])=>`<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join('')}</dl></article>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>UX Check 검수 보고서</title><style>body{font:14px/1.8 Arial,'Malgun Gothic',sans-serif;color:#273a31;max-width:850px;margin:40px auto;padding:0 24px}h1{font-size:30px;margin:8px 0 20px;letter-spacing:-1px}h2{font-size:19px;line-height:1.5;margin:7px 0 13px}.brand{font-size:13px;color:#26704f;font-weight:bold;letter-spacing:1px}.notice{background:#f0f5ee;border-left:3px solid #6e9f79;padding:15px}.meta{color:#687b69;font-size:12px}.purpose{border-top:1px solid #dfe7dc;border-bottom:1px solid #dfe7dc;padding:16px 0;margin:20px 0}article{border:1px solid #d9e3d5;border-radius:8px;padding:22px;margin:22px 0;break-inside:avoid}.decision{font-size:12px;color:#517148;background:#eff5ec;padding:7px 10px}dt{font-weight:bold;color:#57734a;margin-top:14px;font-size:12px}dd{margin:3px 0 0;white-space:pre-wrap}footer{border-top:1px solid #ddd;padding-top:20px;margin-top:30px;font-size:11px;color:#70816b}li{margin:8px 0}@media print{body{margin:0;max-width:none;padding:0;font-size:11pt}article{padding:15px}h1{font-size:23pt}h2{font-size:15pt}a{color:inherit}}@page{size:A4;margin:18mm}</style></head><body><p class="brand">UX CHECK / REVIEW REPORT</p><h1>${report.mode==='compare'?'개선 전후 비교':'업무 화면 UI·UX 검수'} 보고서</h1><p class="meta">${escape(report.createdAt)} · ${escape(report.model)}${report.source==='saved-example'?' · 저장된 합성 예시 (현재 실시간 분석 아님)':''}</p><div class="purpose"><strong>업무 목적</strong><br>${escape(report.purpose)}${report.siteContext?'<p>검사 URL: '+escape(report.siteContext.url)+'</p><p>'+escape(report.siteContext.scope)+'</p>':''}</div><p>${escape(report.summary)}</p><p class="notice">AI 제안이며 최종 판단은 담당자가 합니다. 위치 표시는 근사치입니다. 스크린샷만으로 실제 동작이나 접근성 준수를 확정하지 않습니다. 채택·보류·제외는 담당자의 별도 판단이며 AI 근거를 변경하지 않습니다.</p>${issues}<h2>유지하면 좋은 점</h2>${list(report.strengths)}<h2>확인 범위와 한계</h2>${list(report.limitations)}<footer>이미지 파일은 보고서에 첨부되지 않습니다. 필요한 경우 별도로 보안 검토 후 전달하세요.<br>UX Check · ${escape(report.id)}</footer></body></html>`;
}
