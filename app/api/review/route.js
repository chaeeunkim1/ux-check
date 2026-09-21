import { randomUUID } from 'node:crypto';
import { readBoundedJson, validateReviewInput, ReviewError } from '../../../lib/review-input.js';
import { reserveReview } from '../../../lib/review-limits.js';
import { analyzeReview } from '../../../lib/review-engine.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
const reply=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
export async function POST(request) {
  let reservation;
  try{
    const origin=request.headers.get('origin');
    if(origin&&origin!==new URL(request.url).origin)throw new ReviewError('origin_mismatch',403,'현재 사이트에서 다시 시도해 주세요.');
    const body=await readBoundedJson(request);
    const input=await validateReviewInput(body);
    reservation=reserveReview(request);
    if(!reservation.ok)return reply({error:'rate_limited',message:'데모 이용 한도에 도달했거나 다른 분석이 진행 중입니다. 잠시 후 다시 시도해 주세요.',retryAfter:reservation.retryAfter},429,{'Retry-After':String(reservation.retryAfter)});
    const started=Date.now();
    const report=await analyzeReview(input);
    return reply({report:{...report,id:randomUUID(),mode:input.mode,purpose:input.purpose,createdAt:new Date().toISOString(),durationMs:Date.now()-started}});
  }catch(error){if(error instanceof ReviewError)return reply({error:error.code,message:error.message},error.status);return reply({error:'unexpected_error',message:'분석을 완료하지 못했습니다. 화면을 다시 선택하고 시도해 주세요.'},500);}
  finally{reservation?.release?.();}
}
