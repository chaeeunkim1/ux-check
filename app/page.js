'use client';
import { useEffect, useRef, useState } from 'react';
import { samples } from '../lib/samples.js';
import { categories, severities, statuses, reportMarkdown } from '../lib/review-contract.js';

function Icon({name,size=20,...props}) {
 const paths={spark:'m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z',upload:'M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5',image:'M3 3h18v18H3zM3 16l5-5 5 5 3-3 5 5M15 7h.01',arrow:'M5 12h14m-6-6 6 6-6 6',check:'m5 12 4 4L19 6',list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',form:'M5 3h14v18H5zM9 8h6M9 12h6M9 16h3',chart:'M4 3v18h17M8 16v-5M13 16V7M18 16V4',download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',info:'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',close:'m6 6 12 12M6 18 18 6',compare:'M9 3v18M5 7l-4 5 4 5M15 3v18m4-14 4 5-4 5',external:'M14 3h7v7m0-7-11 11M10 3H3v18h18v-7',clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z'};
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]||paths.image}/></svg>;
}
async function imageData(source) {
 if(source.data)return source.data;
 const response=await fetch(source.src);
 if(!response.ok)throw new Error('예제 화면을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
 const blob=await response.blob();
 return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('이미지를 읽지 못했습니다.'));reader.readAsDataURL(blob);});
}
async function prepareUpload(file) {
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('PNG, JPG, WebP 이미지 파일을 선택해 주세요.');
 if(file.size>10*1024*1024)throw new Error('업로드 파일은 10MB 이하로 선택해 주세요.');
 const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('이미지를 읽을 수 없습니다. 다른 파일을 선택해 주세요.');});
 if(bitmap.width<100||bitmap.height<100||bitmap.width*bitmap.height>32_000_000){bitmap.close();throw new Error('100px 이상, 3,200만 화소 이하의 화면을 사용해 주세요.');}
 const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);
 const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 let data=canvas.toDataURL('image/png');
 if(data.length>1_850_000)data=canvas.toDataURL('image/jpeg',.88);
 if(data.length>1_850_000)throw new Error('이미지 용량이 큽니다. 필요한 영역만 잘라 다시 올려 주세요.');
 return {src:data,data,name:file.name,isSample:false,width:canvas.width,height:canvas.height};
}
function download(content,type,filename){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export default function Home() {
 const [mode,setMode]=useState('review');const [sampleId,setSampleId]=useState('approval');
 const [before,setBefore]=useState({src:samples[0].image,name:samples[0].title,isSample:true});const [after,setAfter]=useState(null);
 const [purpose,setPurpose]=useState(samples[0].purpose);const [consent,setConsent]=useState(false);
 const [report,setReport]=useState(null);const [busy,setBusy]=useState(false);const [elapsed,setElapsed]=useState(0);const [error,setError]=useState('');
 const [selected,setSelected]=useState(null);const [preview,setPreview]=useState('before');const [filter,setFilter]=useState('all');const [notice,setNotice]=useState('');
 const uploadRef=useRef(null),afterRef=useRef(null),reportRef=useRef(null),controllerRef=useRef(null),runRef=useRef(0);
 useEffect(()=>{if(!busy)return;setElapsed(0);const start=Date.now();const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer);},[busy]);
 useEffect(()=>()=>controllerRef.current?.abort(),[]);
 const clearResult=()=>{setReport(null);setSelected(null);setFilter('all');setError('');setNotice('');};
 function chooseSample(sample){if(busy)return;clearResult();setSampleId(sample.id);setBefore({src:sample.image,name:sample.title,isSample:true});setAfter(mode==='compare'?{src:sample.after,name:sample.title+' · 개선 후',isSample:true}:null);setPurpose(sample.purpose);setConsent(false);setPreview('before');}
 function changeMode(next){if(busy||next===mode)return;clearResult();setMode(next);setPreview('before');if(next==='compare'&&sampleId){const sample=samples.find(s=>s.id===sampleId);setAfter({src:sample.after,name:sample.title+' · 개선 후',isSample:true});}if(next==='review')setAfter(null);}
 async function upload(file,side='before'){if(busy)return;setError('');try{const value=await prepareUpload(file);clearResult();if(side==='before'){setBefore(value);setSampleId(null);setPreview('before');}else{setAfter(value);setPreview('after');}setConsent(false);}catch(e){setError(e.message);}finally{if(uploadRef.current)uploadRef.current.value='';if(afterRef.current)afterRef.current.value='';}}
 async function analyze(event){event.preventDefault();if(busy)return;setError('');if(!before){setError('분석할 화면을 추가해 주세요.');return;}if(mode==='compare'&&!after){setError('개선 후 화면을 추가해 주세요.');return;}if(purpose.trim().length<10){setError('누가 어떤 작업을 하는 화면인지 10자 이상 알려 주세요.');return;}if((!before.isSample||(after&&!after.isSample))&&!consent){setError('외부 AI 전송 안내를 확인하고 동의해 주세요.');return;}
  const id=++runRef.current;const controller=new AbortController();controllerRef.current=controller;setBusy(true);clearResult();
  try{const payload={mode,purpose:purpose.trim(),before:await imageData(before),after:mode==='compare'?await imageData(after):undefined,consent:true};const response=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});const data=await response.json().catch(()=>({message:'서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.'}));if(!response.ok)throw new Error(data.message||'분석을 완료하지 못했습니다.');if(id!==runRef.current)return;setReport(data.report);setSelected(data.report.issues[0]?.id??null);setPreview(data.report.issues[0]?.image??'before');setNotice('검수가 완료됐습니다. 관찰 근거와 개선안을 확인해 주세요.');}
  catch(e){if(id===runRef.current)setError(e.name==='AbortError'?'분석 화면의 대기를 취소했습니다. 서버에 이미 전송된 분석은 진행될 수 있습니다.':e.message);}
  finally{if(id===runRef.current){setBusy(false);controllerRef.current=null;}}
 }
 function focusIssue(issue){setSelected(issue.id);setPreview(issue.image);document.getElementById(issue.id)?.scrollIntoView({behavior:'smooth',block:'nearest'});}
 const current=preview==='after'?after:before;const active=report?.issues.find(i=>i.id===selected);
 const visibleIssues=report?.issues.filter(i=>filter==='all'||i.severity===filter||i.status===filter)??[];
 const needsConsent=before&&!before.isSample||(after&&!after.isSample);
 const high=report?.issues.filter(i=>i.severity==='high'&&i.status!=='resolved').length??0;
 const resolved=report?.issues.filter(i=>i.status==='resolved').length??0;
 return <>
  <a className="skip-link" href="#workspace">검수 작업으로 바로가기</a>
  <header className="topbar"><a className="brand" href="/" aria-label="UX Check 홈"><span className="brand-icon"><Icon name="check" size={23}/></span>UX<span>Check</span></a><nav aria-label="주요 메뉴"><a href="#workspace" className="nav-active">검수 워크스페이스</a><a href="#guide">사용 가이드</a></nav><a className="repo-link" href="https://github.com/chaeeunkim1/ux-check" target="_blank" rel="noreferrer">GitHub <Icon name="external" size={15}/></a><span className="demo-pill">Ralphthon 2026</span></header>
  <main id="workspace" className="shell">
   <section className="intro"><div><p className="eyebrow"><span/> 업무 화면을 위한 AI 검수 도구</p><h1>불편한 화면에서,<br className="mobile-break"/> 명확한 개선으로.</h1><p className="intro-description">화면 한 장과 업무 목적을 입력하세요. 문제의 근거부터 다음 수정안까지 정리합니다.</p></div><div className="intro-note"><Icon name="shield" size={20}/><span>실제 회사 화면 없이<br/><strong>합성 예제로 바로 체험</strong></span></div></section>
   <ol className="workflow" aria-label="검수 순서"><li className="done"><span>01</span> 화면 준비</li><li className={before?'done':''}><span>02</span> 업무 맥락 입력</li><li className={report?'done':''}><span>03</span> 근거와 개선안 확인</li></ol>
   <div className="workspace-grid">
    <aside className="input-panel"><form onSubmit={analyze}>
     <div className="panel-heading"><h2>검수 설정</h2><span className="label-mini">INPUT</span></div>
     <div className="mode-switch" aria-label="검수 방식"><button type="button" disabled={busy} aria-pressed={mode==='review'} className={mode==='review'?'active':''} onClick={()=>changeMode('review')}><Icon name="image" size={16}/>화면 검수</button><button type="button" disabled={busy} aria-pressed={mode==='compare'} className={mode==='compare'?'active':''} onClick={()=>changeMode('compare')}><Icon name="compare" size={16}/>전후 비교</button></div>
     <div className="field-heading"><h3>01. 화면 선택</h3><span>합성 예제 3종</span></div>
     <div className="sample-options">{samples.map(sample=><button type="button" key={sample.id} disabled={busy} aria-pressed={sampleId===sample.id} className={'sample-option '+(sampleId===sample.id?'selected':'')} onClick={()=>chooseSample(sample)}><span className="sample-icon"><Icon name={sample.icon}/></span><span><strong>{sample.title}</strong><small>{sample.subtitle}</small></span><span className="radio-dot">{sampleId===sample.id&&<Icon name="check" size={11}/>}</span></button>)}</div>
     <div className="or-divider"><span>또는 내 화면 업로드</span></div>
     <div className="upload-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();upload(e.dataTransfer.files[0]);}}><button type="button" className="upload-trigger" disabled={busy} onClick={()=>uploadRef.current?.click()}><Icon name="upload" size={20}/><span>{before&&!before.isSample?before.name:'이미지를 선택하거나 끌어 놓으세요'}<small>PNG · JPG · WebP / 최대 10MB</small></span></button><input className="sr-only" ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} aria-label="원본 화면 업로드" onChange={e=>upload(e.target.files[0])}/></div>
     {mode==='compare'&&<div className="after-upload"><div><Icon name="check" size={16}/><span>{after?.name??'개선 후 화면을 추가하세요'}</span></div><button type="button" className="text-button" disabled={busy} onClick={()=>afterRef.current?.click()}>개선 후 화면 {after?'바꾸기':'업로드'}</button><input className="sr-only" ref={afterRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} aria-label="개선 후 화면 업로드" onChange={e=>upload(e.target.files[0],'after')}/></div>}
     <div className="field-heading purpose-heading"><label htmlFor="purpose">02. 업무 목적</label><span>{purpose.length}/1500</span></div><textarea id="purpose" value={purpose} disabled={busy} maxLength={1500} rows={4} onChange={e=>{setPurpose(e.target.value);clearResult();}} placeholder="예: 현장 담당자가 지연된 승인 요청을 찾아 우선 처리합니다." aria-describedby="purpose-hint"/><p id="purpose-hint" className="field-hint">누가, 어떤 작업을 완료해야 하는지 알려 주세요.</p>
     <div className="privacy-note"><Icon name="shield" size={16}/><p>분석 시 이미지와 업무 목적을 Claude API로 전송합니다. 회사 기밀·개인정보를 제거해 주세요. 이 앱은 이미지를 저장하지 않습니다.</p></div>
     {needsConsent&&<label className="consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>공유 가능한 화면이며 외부 AI 전송에 동의합니다.</span></label>}
     {error&&<div className="error-box" role="alert"><Icon name="info" size={18}/><span>{error}</span></div>}
     <button type="submit" className="primary-button analyze-button" disabled={busy||!before}><Icon name="spark" size={18}/>{busy?'화면을 분석하고 있어요':mode==='compare'?'개선 전후 비교하기':'AI 검수 시작'}{!busy&&<Icon name="arrow" size={17}/>}</button>
     {busy?<button type="button" className="cancel-button" onClick={()=>controllerRef.current?.abort()}>대기 취소</button>:<p className="submit-note">{before?.isSample?'예제는 모두 가상 데이터입니다.':'업로드 이미지는 긴 변 1,600px로 조정됩니다.'}</p>}
    </form></aside>
    <div className="review-area">
     <section className="preview-panel" aria-label="검수 화면 미리보기"><div className="preview-heading"><div><span className="live-dot"/><h2>{report?'근거가 보이는 검수 화면':'검수할 화면'}</h2>{before?.isSample&&<span className="tiny-badge">합성 예제</span>}</div><span className="preview-meta">{current?.name??'화면을 선택하세요'}</span></div>
      {mode==='compare'&&<div className="image-tabs" aria-label="미리보기 화면"><button type="button" aria-pressed={preview==='before'} className={preview==='before'?'active':''} onClick={()=>setPreview('before')}>원본 화면</button><button type="button" disabled={!after} aria-pressed={preview==='after'} className={preview==='after'?'active':''} onClick={()=>setPreview('after')}>개선 후 화면</button><span>같은 업무 목적의 두 화면을 비교합니다</span></div>}
      <div className={'canvas-wrap '+(busy?'is-analyzing':'')}>{current?<div className="image-stage" style={{maxWidth:`min(100%, ${620*(current.width??1200)/(current.height??820)}px)`}}><img className="screen-image" src={current.src} alt={current.name+' 검수 대상 화면'} width="1200" height="820"/>{report?.issues.filter(i=>i.image===preview&&i.status!=='resolved').map(issue=><button type="button" key={issue.id} style={{left:Math.min(97,Math.max(3,issue.region.x+issue.region.width/2))+'%',top:Math.min(96,Math.max(4,issue.region.y))+'%'}} className={'issue-marker '+issue.severity+(selected===issue.id?' active':'')} onClick={()=>focusIssue(issue)} aria-label={`${issue.number}번 문제: ${issue.title}`}>{issue.number}</button>)}{active&&active.image===preview&&<div className="issue-region" style={{left:active.region.x+'%',top:active.region.y+'%',width:active.region.width+'%',height:active.region.height+'%'}}/>}{busy&&<div className="scan-line"/>}</div>:<div className="empty-canvas"><Icon name="image" size={48}/><p>검수할 화면을 선택해 주세요</p></div>}</div>
      <div className="preview-footer"><span><Icon name="info" size={14}/>{report?'위치 표시는 AI의 근사치입니다. 실제 요소와 함께 확인하세요.':'스크린샷으로 관찰할 수 있는 UI·UX 문제를 살펴봅니다.'}</span><span>{mode==='compare'?'2개 화면 비교':'1개 화면 검수'}</span></div>
     </section>
     <section className="results-panel" ref={reportRef} aria-label="검수 결과" aria-busy={busy}>
      <div className="results-heading"><div><span className="label-mini">REVIEW</span><h2>{report?'개선으로 이어지는 검수 결과':'좋은 개선안은, 구체적인 근거에서'}</h2></div>{report&&<div className="export-actions"><button type="button" className="secondary-button" onClick={()=>{download(reportMarkdown(report),'text/markdown;charset=utf-8','ux-check-report.md');setNotice('검수 보고서를 다운로드했습니다.');}}><Icon name="download" size={16}/>보고서</button><button type="button" className="icon-button" aria-label="JSON 결과 다운로드" title="JSON 결과 다운로드" onClick={()=>download(JSON.stringify(report,null,2),'application/json','ux-check-report.json')}>{'{ }'}</button></div>}</div>
      <p className="sr-only" role="status" aria-live="polite">{notice}</p>
      {busy?<div className="analysis-state"><div className="analysis-orbit"><Icon name="spark" size={26}/></div><h3>{elapsed<15?'화면과 업무 맥락을 살펴보고 있어요':elapsed<40?'관찰 근거와 개선안을 정리하고 있어요':'조금 더 꼼꼼히 확인하고 있어요'}</h3><p>실제 Claude API에서 분석 중입니다. 완료되면 결과가 표시됩니다.</p><span className="elapsed"><Icon name="clock" size={14}/>{elapsed}초 경과</span></div>:report?<>
       <div className="result-summary"><div className="summary-icon"><Icon name="spark" size={22}/></div><div><span className="summary-label">AI 검수 요약</span><p>{report.summary}</p><div className="summary-meta"><span>{report.issues.length}개 관찰</span><span className={high?'high-text':''}>우선 확인 {high}건</span>{mode==='compare'&&<span>개선 확인 {resolved}건</span>}<span>{(report.durationMs/1000).toFixed(1)}초 · 실제 분석</span></div></div></div>
       <div className="result-filters" aria-label="결과 필터">{[['all','전체'],['high','높은 우선순위'],...(mode==='compare'?[['resolved','개선 확인'],['remaining','남은 문제']]:[['medium','보통'],['low','낮음']])].map(([id,label])=><button key={id} type="button" className={filter===id?'active':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
       <div className="issue-list">{visibleIssues.map(issue=><article key={issue.id} id={issue.id} className={'issue-card '+(selected===issue.id?'selected':'')}><button type="button" className="issue-title-button" aria-expanded={selected===issue.id} onClick={()=>{setSelected(selected===issue.id?null:issue.id);setPreview(issue.image);}}><span className={'issue-number '+issue.severity}>{issue.number}</span><span className="issue-title-content"><span className="issue-labels"><span className={'severity '+issue.severity}>{severities[issue.severity]}</span><span>{categories[issue.category]}</span>{mode==='compare'&&<span className={'status-'+issue.status}>{statuses[issue.status]}</span>}</span><strong>{issue.title}</strong></span><span className="expand-symbol">{selected===issue.id?'−':'+'}</span></button>{selected===issue.id&&<div className="issue-details"><div className="observation"><span>관찰 근거</span><p>{issue.observation}</p><small>위치: {issue.element}</small></div><dl><div><dt>업무 영향</dt><dd>{issue.impact}</dd></div><div className="recommendation"><dt><Icon name="spark" size={14}/>개선 제안</dt><dd>{issue.recommendation}</dd></div>{issue.comparison&&<div><dt>전후 차이</dt><dd>{issue.comparison}</dd></div>}<div><dt>확인 기준</dt><dd>{issue.verification}</dd></div></dl><p className="confidence-note">관찰 확신도 {issue.confidence==='high'?'높음':issue.confidence==='medium'?'보통':'낮음'} · 최종 판단과 실제 동작 확인은 담당자가 진행해 주세요.</p></div>}</article>)}{visibleIssues.length===0&&<p className="empty-filter">이 조건에 해당하는 관찰이 없습니다. 문제가 없다는 보증은 아닙니다.</p>}</div>
       <details className="limitations"><summary><Icon name="info" size={16}/>잘된 점과 확인 범위</summary><div>{report.strengths.length>0&&<><h3>유지하면 좋은 점</h3><ul>{report.strengths.map((v,i)=><li key={i}>{v}</li>)}</ul></>}<h3>확인이 필요한 부분</h3><ul>{report.limitations.map((v,i)=><li key={i}>{v}</li>)}</ul><p>모델: {report.model} · 입력 {report.usage.inputTokens.toLocaleString()} / 출력 {report.usage.outputTokens.toLocaleString()} tokens</p></div></details>
      </>:<div className="result-empty"><div className="empty-steps"><div><span><Icon name="image" size={19}/></span><strong>화면에서 관찰</strong><p>어디가, 어떻게<br/>불편한지 찾고</p></div><span className="step-arrow">→</span><div><span><Icon name="list" size={19}/></span><strong>업무 영향 정리</strong><p>담당자의 작업과<br/>연결해 설명하고</p></div><span className="step-arrow">→</span><div><span><Icon name="check" size={19}/></span><strong>수정안으로 전달</strong><p>확인 기준을 담아<br/>보고서로 남깁니다</p></div></div><p className="empty-note">왼쪽의 <strong>AI 검수 시작</strong>을 누르면 실제 분석 결과가 여기에 나타납니다.</p></div>}
     </section>
    </div>
   </div>
   <section id="guide" className="guide-section"><div><p className="eyebrow">HOW TO USE</p><h2>화면을 넘어,<br/>업무의 맥락까지.</h2><p>UX Check는 개선 논의를 시작하는 검수 보조 도구입니다.<br/>최종 판단은 업무를 아는 담당자가 합니다.</p></div><div className="guide-cards"><article><span>01</span><h3>목적을 구체적으로</h3><p>“화면을 평가해 줘”보다 “지연된 요청을 찾아 우선 처리한다”처럼 실제 작업을 알려 주세요.</p></article><article><span>02</span><h3>근거를 직접 확인</h3><p>AI가 표시한 위치와 문구를 살펴보세요. 실제 클릭·키보드 동작과 접근성 준수는 별도 검증이 필요합니다.</p></article><article><span>03</span><h3>개선 후 한 번 더</h3><p>동일한 업무의 개선 전후 화면을 비교하고, 남은 문제와 달라진 점을 보고서로 전달하세요.</p></article></div></section>
  </main><footer className="site-footer"><span className="footer-brand">UX Check <span>작은 발견이 더 나은 업무 경험으로.</span></span><span>합성 데이터 데모 · Ralphthon 2026</span></footer>
 </>;
}
