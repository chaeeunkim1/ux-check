import { validateReport, reportMarkdown, reportHtml } from '../../../lib/review-contract.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const MAX_BYTES=600_000;
const reply=(message,status)=>Response.json({message},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request){
 try{
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return reply('현재 사이트에서 보고서를 저장해 주세요.',403);
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return reply('지원하지 않는 요청입니다.',415);
  if(Number(request.headers.get('content-length'))>MAX_BYTES)return reply('보고서가 너무 큽니다.',413);
  const reader=request.body?.getReader();if(!reader)return reply('보고서가 없습니다.',400);
  const chunks=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES){await reader.cancel();return reply('보고서가 너무 큽니다.',413);}chunks.push(Buffer.from(value));}
  const form=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  const format=form.get('format');if(!['markdown','html','json'].includes(format))return reply('지원하지 않는 보고서 형식입니다.',400);
  const raw=JSON.parse(form.get('report')||'null');
  if(!raw||!['review','compare'].includes(raw.mode)||typeof raw.purpose!=='string'||raw.purpose.length>1500||!raw.purpose.trim()||typeof raw.createdAt!=='string'||!Number.isFinite(Date.parse(raw.createdAt))||typeof raw.model!=='string'||!/^[a-zA-Z0-9._-]{1,80}$/.test(raw.model)||typeof raw.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(raw.id))return reply('보고서 내용을 확인할 수 없습니다.',400);
  const normalized=validateReport(raw,raw.mode);
  const reviewDecisions={};for(const issue of normalized.issues){const decision=raw.reviewDecisions?.[issue.id];if(['include','hold','exclude'].includes(decision))reviewDecisions[issue.id]=decision;}
  const report={...normalized,id:raw.id,mode:raw.mode,purpose:raw.purpose,createdAt:raw.createdAt,model:raw.model,reviewDecisions,...(raw.source==='saved-example'?{source:'saved-example'}:{})};
  if(raw.qualityCheck?.performed===true&&['initialCount','removedCount','uncertainCount'].every(k=>Number.isInteger(raw.qualityCheck[k])&&raw.qualityCheck[k]>=0&&raw.qualityCheck[k]<=8))report.qualityCheck={performed:true,initialCount:raw.qualityCheck.initialCount,removedCount:raw.qualityCheck.removedCount,uncertainCount:raw.qualityCheck.uncertainCount};
  if(raw.usage&&Number.isSafeInteger(raw.usage.inputTokens)&&Number.isSafeInteger(raw.usage.outputTokens)&&raw.usage.inputTokens>=0&&raw.usage.outputTokens>=0)report.usage={inputTokens:raw.usage.inputTokens,outputTokens:raw.usage.outputTokens};
  if(Number.isFinite(raw.durationMs)&&raw.durationMs>=0)report.durationMs=raw.durationMs;
  const content=format==='html'?reportHtml(report):format==='markdown'?reportMarkdown(report):JSON.stringify(report,null,2);
  const type={html:'text/html',markdown:'text/markdown',json:'application/json'}[format];
  const extension={html:'html',markdown:'md',json:'json'}[format];
  return new Response(content,{headers:{'Content-Type':type+'; charset=utf-8','Content-Disposition':`attachment; filename="ux-check-report.${extension}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"}});
 }catch{return reply('보고서 내용을 확인할 수 없습니다. 다시 분석한 뒤 저장해 주세요.',400);}
}
