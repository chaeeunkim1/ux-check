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
 await assert.rejects(analyzeReview(input,{apiKey:'TEST_VALUE',fetcher:async()=>Response.json({stop_reason:'max_tokens',content:[{type:'tool_use',name:'submit_review',input:report}]})}),e=>e.code==='invalid_response');
});
test('structured response and exported evidence stay consistent',async()=>{
 const result=await analyzeReview(input,{apiKey:'TEST_VALUE',fetcher:async()=>Response.json({model:'test-model',content:[{type:'tool_use',name:'submit_review',input:report}],usage:{input_tokens:123,output_tokens:456}})});
 const final={...result,mode:'review',purpose:input.purpose,createdAt:'2026-09-21T00:00:00Z'};
 const markdown=reportMarkdown(final);assert.ok(markdown.includes(finding.observation));assert.ok(markdown.includes(finding.recommendation));assert.ok(markdown.includes(finding.verification));assert.ok(markdown.includes(input.purpose));assert.equal(result.usage.outputTokens,456);
});
