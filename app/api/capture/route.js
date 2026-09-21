import {readBoundedJson,ReviewError} from '../../../lib/review-input.js';
import {reserveReview} from '../../../lib/review-limits.js';
import {captureSite} from '../../../lib/site-capture.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=90;
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request){let slot;try{
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new ReviewError('origin_mismatch',403,'현재 사이트에서 다시 시도해 주세요.');
 const body=await readBoundedJson(request);if(body.consent!==true)throw new ReviewError('consent_required',400,'공개 페이지 확인 및 AI 전송 안내에 동의해 주세요.');
 slot=reserveReview(request);if(!slot.ok)throw new ReviewError('rate_limited',429,'다른 검사가 진행 중이거나 데모 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.');
 return reply({capture:await captureSite(body.url)});
 }catch(error){return reply({error:error.code||'capture_failed',message:error instanceof ReviewError?error.message:'사이트를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'},error instanceof ReviewError?error.status:500);}finally{slot?.release?.();}}
