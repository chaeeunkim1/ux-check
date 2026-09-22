import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readBoundedJson, validateReviewInput, MAX_BODY_BYTES } from '../lib/review-input.js';
import { validateReport, reportMarkdown } from '../lib/review-contract.js';
import { analyzeReview } from '../lib/review-engine.js';
import { createLimiter } from '../lib/review-limits.js';
import { POST } from '../app/api/review/route.js';
const png='data:image/png;base64,'+(await readFile(new URL('../public/samples/approval-before.png',import.meta.url))).toString('base64');
const input={mode:'review',purpose:'담당자가 지연된 요청을 찾고 우선 처리한다.',consent:true,before:png};
const finding={title:'의미가 없는 상태 색상',category:'feedback',severity:'high',status:'observed',confidence:'high',element:'상태 열의 원',observation:'텍스트 없이 색상만 표시한다.',impact:'상태를 잘못 해석할 수 있다.',recommendation:'색상과 함께 상태 이름을 표시한다.',verification:'각 상태에 서로 다른 텍스트가 표시되는지 확인한다.',comparison:'',image:'before',region:{x:70,y:40,width:10,height:20}};
const report={summary:'업무 상태를 명확하게 표시해야 합니다.',strengths:['행과 열의 구분이 있습니다.'],limitations:['실제 동작은 실행하지 않았습니다.'],issues:[finding]};
test('consent and useful purpose required before AI processing',async()=>{
 await assert.rejects(validateReviewInput({...input,consent:false}),e=>e.code==='consent_required');
 await assert.rejects(validateReviewInput({...input,purpose:'검수'}),e=>e.code==='invalid_purpose');
});
test('reject forged, tiny and unsupported image input',async()=>{
 for(const before of ['data:image/png;base64,aGVsbG8=','data:image/svg+xml;base64,PHN2Zz4=','https://internal.example/image.png'])await assert.rejects(validateReviewInput({...input,before}),e=>e.code==='invalid_image');
 await assert.rejects(validateReviewInput({...input,before:png.replace('image/png','image/jpeg')}),e=>e.code==='invalid_image');
});
test('normalize valid screenshot and require second image for comparison',async()=>{
 const actual=await validateReviewInput(input);assert.equal(actual.before.source.media_type,'image/png');
 await assert.rejects(validateReviewInput({...input,mode:'compare'}),e=>e.code==='invalid_image');
});
test('streaming size cap works without Content-Length',async()=>{
 const request=new Request('http://localhost/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:' '.repeat(MAX_BODY_BYTES+1)});
 await assert.rejects(readBoundedJson(request),e=>e.status===413);
});
test('invalid JSON and cross-origin request are rejected',async()=>{
 const invalid=new Request('http://localhost/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});
 assert.equal((await POST(invalid)).status,400);
 const cross=new Request('http://localhost/api/review',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify(input)});
 assert.equal((await POST(cross)).status,403);
});
test('limiter caps both concurrency and repeated clients',()=>{
 const limiter=createLimiter({perClient:2,globalLimit:3,concurrent:1});
 const a=limiter.take('a');assert.equal(a.ok,true);assert.equal(limiter.take('b').ok,false);a.release();a.release();
 const b=limiter.take('a');assert.equal(b.ok,true);b.release();assert.equal(limiter.take('a').ok,false);
 const c=limiter.take('b');assert.equal(c.ok,true);c.release();assert.equal(limiter.take('c').ok,false);
});
test('reject fabricated comparison statuses, absent evidence and out-of-image coordinates',()=>{
 assert.throws(()=>validateReport({...report,issues:[{...finding,status:'resolved'}]},'review'));
 assert.throws(()=>validateReport({...report,issues:[{...finding,observation:''}]},'review'));
 assert.throws(()=>validateReport({...report,issues:[{...finding,region:{x:95,y:10,width:20,height:20}}]},'review'));
 assert.equal(validateReport(report,'review').issues[0].number,1);
});
test('upstream errors never expose provider messages or keys',async()=>{
 for(const status of [401,429,500])await assert.rejects(analyzeReview(input,{apiKey:'TEST_VALUE',fetcher:async()=>Response.json({error:{message:'SECRET_SHOULD_NEVER_APPEAR'}},{status})}),e=>!e.message.includes('SECRET_SHOULD_NEVER_APPEAR')&&[502,503].includes(e.status));
});
test('timeout and truncated model output have explicit recoverable errors',async()=>{
 await assert.rejects(analyzeReview(input,{apiKey:'TEST_VALUE',fetcher:async()=>{throw new DOMException('timeout','TimeoutError');}}),e=>e.code==='timeout'&&e.status===504);
 await assert.rejects(analyzeReview(input,{apiKey:'TEST_VALUE',fetcher:async()=>Response.json({stop_reason:'max_tokens',content:[{type:'tool_use',name:'submit_review',input:report}]})}),e=>e.code==='response_truncated');
});
test('structured response and exported evidence stay consistent',async()=>{
 const result=await analyzeReview(input,{apiKey:'TEST_VALUE',verify:false,fetcher:async()=>Response.json({model:'test-model',content:[{type:'tool_use',name:'submit_review',input:report}],usage:{input_tokens:123,output_tokens:456}})});
 const final={...result,mode:'review',purpose:input.purpose,createdAt:'2026-09-21T00:00:00Z'};
 const markdown=reportMarkdown(final);assert.ok(markdown.includes(finding.observation));assert.ok(markdown.includes(finding.recommendation));assert.ok(markdown.includes(finding.verification));assert.ok(markdown.includes(input.purpose));assert.equal(result.usage.outputTokens,456);
});
test('report includes human disposition without overwriting AI evidence',()=>{
 const final={...validateReport(report,'review'),mode:'review',purpose:input.purpose,createdAt:'2026-09-21T00:00:00Z',model:'test',reviewDecisions:{'finding-1':'exclude'}};
 const output=reportMarkdown(final);assert.ok(output.includes('담당자 판단: 검토에서 제외'));assert.ok(output.includes(finding.observation));
});

test('HTML report escapes untrusted content and has no executable scripts',async()=>{
 const {reportHtml}=await import('../lib/review-contract.js');
 const final={...validateReport(report,'review'),mode:'review',purpose:'<script>alert(1)</script>',createdAt:'2026-09-21',model:'test',source:'saved-example',reviewDecisions:{'finding-1':'include'}};
 const html=reportHtml(final);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('default-src'));assert.ok(html.includes('현재 실시간 분석 아님'));assert.ok(html.includes('담당자 판단: 개선안 채택'));
});

test('published saved examples preserve real result metadata and validate',async()=>{
 const {samples}=await import('../lib/samples.js');
 for(const sample of samples)for(const mode of ['review','compare']){
  const {report:saved}=JSON.parse(await readFile(new URL(`../public/examples/${sample.id}-${mode}.json`,import.meta.url)));
  assert.equal(saved.source,'saved-example');assert.equal(saved.purpose,sample.purpose);assert.ok(saved.durationMs>0);assert.ok(saved.usage.inputTokens>0);assert.ok(saved.sourceCheckedAt);validateReport(saved,mode);
 }
});

test('export endpoint returns validated attachments with the displayed evidence',async()=>{
 const {POST:exportReport}=await import('../app/api/export/route.js');
 const final={...validateReport(report,'review'),id:'test-report',mode:'review',purpose:input.purpose,createdAt:'2026-09-21T00:00:00Z',model:'test',reviewDecisions:{'finding-1':'include'}};
 for(const format of ['markdown','html','json']){
  const body=new URLSearchParams({format,report:JSON.stringify(final)});
  const response=await exportReport(new Request('http://localhost/api/export',{method:'POST',body}));
  assert.equal(response.status,200);assert.ok(response.headers.get('content-disposition').includes('attachment'));const content=await response.text();assert.ok(content.includes(finding.observation));assert.ok(content.includes(finding.recommendation));assert.ok(content.includes(format==='json'?'include':'개선안 채택'));
 }
 const invalid=await exportReport(new Request('http://localhost/api/export',{method:'POST',body:new URLSearchParams({format:'html',report:'{"purpose":"<script>"}'})}));assert.equal(invalid.status,400);
});

test('independent audit removes unsupported claims and preserves uncertainty',async()=>{
 const {applyAudit}=await import('../lib/review-audit.js');
 const initial=validateReport({...report,issues:[finding,{...finding,title:'두 번째',severity:'medium'}]},'review');
 const output=applyAudit(initial,{summary:'수정된 요약',checks:[{number:1,verdict:'unsupported',title:'제외할 주장',severity:'low',reason:'이미지에 근거가 없음'},{number:2,verdict:'uncertain',title:'추가 확인할 항목',severity:'low',reason:'클릭 결과는 확인할 수 없음'}]},'review');
 assert.equal(output.issues.length,1);assert.equal(output.issues[0].number,1);assert.equal(output.issues[0].confidence,'low');assert.equal(output.qualityCheck.removedCount,1);assert.equal(output.issues[0].auditNote,'클릭 결과는 확인할 수 없음');
 assert.throws(()=>applyAudit(initial,{summary:'중복 번호',checks:[{number:1},{number:1}]},'review'));
});

test('default analysis runs audit and accounts for both API calls',async()=>{
 let calls=0;
 const result=await analyzeReview(input,{apiKey:'TEST_VALUE',fetcher:async(_url,options)=>{calls++;const name=JSON.parse(options.body).tools[0].name;return Response.json({model:'test-model',content:[{type:'tool_use',name,input:name==='submit_review'?report:{summary:'이미지와 대조한 요약',checks:[{number:1,verdict:'supported',title:finding.title,severity:'medium',reason:'상태 텍스트가 없음을 확인'}]}}],usage:{input_tokens:100,output_tokens:50}});}});
 assert.equal(calls,2);assert.equal(result.usage.inputTokens,200);assert.equal(result.usage.outputTokens,100);assert.equal(result.qualityCheck.performed,true);assert.equal(result.issues[0].severity,'medium');
});


test('exports retain audit evidence, uncertainty and separate human decisions',async()=>{
 const {POST:exportReport}=await import('../app/api/export/route.js');
 const final={...validateReport(report,'review'),id:'audit-report',mode:'review',purpose:input.purpose,createdAt:'2026-09-21T00:00:00Z',model:'test',qualityCheck:{performed:true,initialCount:2,removedCount:1,uncertainCount:1},reviewDecisions:{'finding-1':'hold'}};
 final.issues[0].auditNote='이미지만으로 확인 불가 <script>no</script>';final.issues[0].auditVerdict='uncertain';
 for(const format of ['html','markdown','json']){
  const response=await exportReport(new Request('http://localhost/api/export',{method:'POST',body:new URLSearchParams({format,report:JSON.stringify(final)})}));
  assert.equal(response.status,200);const output=await response.text();assert.ok(output.includes('이미지만으로 확인 불가'));
  if(format==='json'){const saved=JSON.parse(output);assert.deepEqual(saved.qualityCheck,final.qualityCheck);assert.equal(saved.issues[0].auditVerdict,'uncertain');assert.equal(saved.reviewDecisions['finding-1'],'hold');}
  if(format==='html')assert.ok(!output.includes('<script>no</script>'));
 }
});

test('export rejects cross-origin forms and streamed oversize bodies',async()=>{
 const {POST:exportReport}=await import('../app/api/export/route.js');
 const cross=await exportReport(new Request('http://localhost/api/export',{method:'POST',headers:{Origin:'https://untrusted.example'},body:new URLSearchParams({format:'html'})}));assert.equal(cross.status,403);
 const large=await exportReport(new Request('http://localhost/api/export',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'x'.repeat(600001)}));assert.equal(large.status,413);
});


test('strict tool schema preserves bounds as descriptions and narrows mode enums',async()=>{
 const {strictToolSchema}=await import('../lib/strict-tool-schema.js');
 const original={type:'array',minItems:1,maxItems:3,items:{type:'string',maxLength:10}};
 const strict=strictToolSchema(original);assert.equal(strict.minItems,1);assert.equal(strict.maxItems,undefined);assert.ok(strict.description.includes('maxItems: 3'));assert.ok(strict.items.description.includes('maxLength: 10'));assert.equal(original.maxItems,3);
 let sent;
 await analyzeReview(input,{apiKey:'TEST_VALUE',verify:false,fetcher:async(_url,options)=>{sent=JSON.parse(options.body);return Response.json({content:[{type:'tool_use',name:'submit_review',input:report}]});}});
 assert.equal(sent.tools[0].strict,true);assert.deepEqual(sent.tools[0].input_schema.properties.issues.items.properties.status.enum,['observed']);
});


test('saved comparison is unavailable when either screenshot was replaced',async()=>{
 const {samples,canLoadSavedExample}=await import('../lib/samples.js');
 const selected={sampleId:'approval',purpose:samples[0].purpose,mode:'compare',before:{isSample:true},after:{isSample:true}};
 assert.equal(canLoadSavedExample(selected),true);
 assert.equal(canLoadSavedExample({...selected,after:{isSample:false}}),false);
 assert.equal(canLoadSavedExample({...selected,before:{isSample:false}}),false);
 assert.equal(canLoadSavedExample({...selected,purpose:'다른 업무에 대한 사용자 목적'}),false);
});
test('site mode accepts desktop/mobile observations without treating them as before/after improvements',async()=>{
 const site=await validateReviewInput({...input,mode:'site',after:png,siteFacts:'{"viewport":390}',siteContext:{url:'https://example.com/',title:'Example'}});
 assert.equal(site.mode,'site');assert.ok(site.after);assert.equal(site.siteContext.url,'https://example.com/');
 const actual=validateReport({...report,issues:[{...finding,image:'after'}]},'site');assert.equal(actual.issues[0].image,'after');
 assert.throws(()=>validateReport({...report,issues:[{...finding,status:'resolved'}]},'site'));
 const text=reportMarkdown({...actual,mode:'site',purpose:input.purpose,createdAt:'2026-09-21T11:00:00Z',model:'test',siteContext:site.siteContext});
 assert.match(text,/사이트 URL 검수/);assert.match(text,/https:\/\/example.com/);assert.match(text,/모바일/);
});
test('site input validates extra scroll images and exports the correct viewport identity',async()=>{
 const site=await validateReviewInput({...input,mode:'site',after:png,extraScreens:[{key:'mobile-bottom',data:png,scrollY:1600}]});assert.equal(site.extraScreens[0].key,'mobile-bottom');
 await assert.rejects(validateReviewInput({...input,mode:'site',after:png,extraScreens:[{key:'after',data:png}]}),e=>e.code==='invalid_screens');
 const value={...report,issues:[{...finding,image:'mobile-bottom'}]};
 assert.equal(validateReport(value,'site').issues[0].image,'mobile-bottom');
 assert.throws(()=>validateReport({...value,issues:[{...finding,image:'mobile-bottom',status:'resolved'}]},'compare'));
 assert.match(reportMarkdown({...value,mode:'site',createdAt:'2026-09-21T11:00:00Z',model:'test',purpose:input.purpose}),/모바일 · 마지막 확인 구간/);
 const {reportHtml}=await import('../lib/review-contract.js');assert.match(reportHtml({...value,mode:'site',createdAt:'2026-09-21T11:00:00Z',model:'test',purpose:input.purpose}),/모바일 · 마지막 확인 구간/);
});

test('site facts keep valid JSON and preserve every screen under the size budget',async()=>{
 const {siteAnalysisFacts}=await import('../lib/site-contract.js');
 const keys=['before','after','desktop-middle','desktop-bottom','mobile-middle','mobile-bottom'];
 const value=siteAnalysisFacts({finalUrl:'https://example.com/',scope:{pages:1},screens:keys.map(key=>({key,viewport:{width:390,height:844},observations:Array.from({length:60},(_,i)=>({text:'긴 관찰 텍스트 '.repeat(20),x:0,y:i*20,width:300,height:20,fontSize:'16px'}))}))});
 assert.ok(value.length<=18000);const parsed=JSON.parse(value);assert.deepEqual(parsed.screens.map(s=>s.key),keys);assert.ok(parsed.screens.every(s=>s.observations.length>0));assert.ok(parsed.screens.every(s=>s.observations[0].height===20));
});

test('one invalid AI region is omitted with disclosure instead of losing all findings',async()=>{
 const {discardInvalidRegions}=await import('../lib/review-engine.js');
 const good={title:'valid',region:{x:10,y:10,width:20,height:20}};
 const bad={title:'invalid',region:{x:95,y:10,width:30,height:20}};
 const result=discardInvalidRegions({issues:[good,bad],limitations:['original']});
 assert.deepEqual(result.issues,[good]);assert.match(result.limitations.at(-1),/1개를 제외/);
 assert.deepEqual(bad.region,{x:95,y:10,width:30,height:20});
});
