import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createUploadTracker, selectUploadedScreenshot } from '../lib/screenshot-selection.js';
import { validateReviewInput } from '../lib/review-input.js';
import { analyzeReview } from '../lib/review-engine.js';

const sample={isSample:true,src:'/samples/example.png'};
const first={isSample:false,data:'real-before',name:'before.png'};
const second={isSample:false,data:'real-after',name:'after.png'};

test('uploading either real screenshot clears the opposite synthetic sample',()=>{
 for(const side of ['before','after']){
  const next=selectUploadedScreenshot({before:sample,after:sample},side,first);
  assert.equal(next[side],first);
  assert.equal(next[side==='before'?'after':'before'],null);
 }
});

test('real screenshot pair survives either upload completion order and replacement',()=>{
 for(const order of [['before','after'],['after','before']]){
  let pair={before:sample,after:sample};
  for(const side of order)pair=selectUploadedScreenshot(pair,side,side==='before'?first:second);
  assert.deepEqual(pair,{before:first,after:second});
  assert.deepEqual(selectUploadedScreenshot(pair,'before',{...first,name:'updated.png'}).after,second);
 }
});

test('concurrent upload decoding retains both sides and only supersedes the same side',()=>{
 const tracker=createUploadTracker();
 const before=tracker.begin('before');const after=tracker.begin('after');
 assert.equal(tracker.current('before',before),true);
 assert.equal(tracker.current('after',after),true);
 const replacement=tracker.begin('before');
 assert.equal(tracker.current('before',before),false);
 tracker.finish('before',before);tracker.finish('after',after);
 assert.equal(tracker.busy(),true);
 assert.equal(tracker.current('before',replacement),true);
 tracker.finish('before',replacement);assert.equal(tracker.busy(),false);
});

test('comparison sends both uploaded images in order to the model without a sample ID',async()=>{
 const before='data:image/png;base64,'+(await sharp({create:{width:600,height:400,channels:3,background:'#123456'}}).png().toBuffer()).toString('base64');
 const after='data:image/png;base64,'+(await sharp({create:{width:600,height:400,channels:3,background:'#abcdef'}}).png().toBuffer()).toString('base64');
 const input=await validateReviewInput({mode:'compare',before,after,consent:true,purpose:'업무 담당자가 필요한 정보를 확인하고 요청을 제출한다.'});
 assert.notEqual(input.before.source.data,input.after.source.data);
 let sent;
 await analyzeReview(input,{apiKey:'TEST_VALUE',verify:false,fetcher:async(_url,options)=>{
  sent=JSON.parse(options.body);
  return Response.json({content:[{type:'tool_use',name:'submit_review',input:{summary:'비교 완료',strengths:[],limitations:['동작 미확인'],issues:[]}}]});
 }});
 const images=sent.messages[0].content.filter(item=>item.type==='image');
 assert.equal(images.length,2);
 assert.deepEqual(images.map(image=>image.source.data),[input.before.source.data,input.after.source.data]);
});
