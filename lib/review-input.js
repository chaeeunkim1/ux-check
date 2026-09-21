import {siteImageIds,siteImageLabels,describeSiteScope} from './site-contract.js';
import sharp from 'sharp';
export const MAX_BODY_BYTES=3_900_000;
export const MAX_IMAGE_BYTES=1_400_000;
export class ReviewError extends Error { constructor(code,status,message){super(message);this.code=code;this.status=status;} }
export async function readBoundedJson(request) {
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ReviewError('content_type',415,'JSON 형식의 요청만 지원합니다.');
  if(Number(request.headers.get('content-length'))>MAX_BODY_BYTES)throw new ReviewError('request_too_large',413,'이미지 용량이 큽니다. 더 작은 이미지로 다시 시도해 주세요.');
  const reader=request.body?.getReader();if(!reader)throw new ReviewError('invalid_input',400,'분석할 화면을 추가해 주세요.');
  let total=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>MAX_BODY_BYTES){await reader.cancel();throw new ReviewError('request_too_large',413,'이미지 용량이 큽니다. 더 작은 이미지로 다시 시도해 주세요.');}chunks.push(Buffer.from(value));}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ReviewError('invalid_json',400,'요청을 읽을 수 없습니다. 화면을 다시 선택해 주세요.');}
}
async function validateImage(dataUrl) {
  if(typeof dataUrl!=='string')throw new ReviewError('invalid_image',400,'분석할 화면을 추가해 주세요.');
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if(!match)throw new ReviewError('invalid_image',400,'PNG, JPG, WebP 이미지 파일을 사용해 주세요.');
  const buffer=Buffer.from(match[2],'base64');
  if(buffer.length>MAX_IMAGE_BYTES)throw new ReviewError('image_too_large',413,'이미지 한 장은 전송 기준 1.4MB 이하여야 합니다. 크기를 줄여 주세요.');
  try{
    const processor=sharp(buffer,{limitInputPixels:16_000_000,failOn:'warning'});
    const metadata=await processor.metadata();
    if(metadata.format!==match[1]||!metadata.width||!metadata.height||metadata.width<100||metadata.height<100||metadata.width>8000||metadata.height>8000||(metadata.pages??1)>1)throw new Error('format');
    let normalized=await processor.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).png().toBuffer();
    let media_type='image/png';
    if(normalized.length>MAX_IMAGE_BYTES){normalized=await sharp(normalized).flatten({background:'#fff'}).jpeg({quality:90}).toBuffer();media_type='image/jpeg';}
    return {type:'image',source:{type:'base64',media_type,data:normalized.toString('base64')}};
  }catch{throw new ReviewError('invalid_image',400,'이미지를 읽을 수 없습니다. 100px 이상의 정적인 PNG, JPG, WebP 화면을 사용해 주세요.');}
}
export async function validateReviewInput(body) {
  if(!body||!['review','compare','site'].includes(body.mode))throw new ReviewError('invalid_mode',400,'검수 방식을 선택해 주세요.');
  if(body.consent!==true)throw new ReviewError('consent_required',400,'이미지와 업무 목적을 Claude API로 전송하는 데 동의해 주세요.');
  const purpose=typeof body.purpose==='string'?body.purpose.trim():'';
  if(purpose.length<10||purpose.length>1500)throw new ReviewError('invalid_purpose',400,'업무 목적을 10~1,500자로 입력해 주세요.');
  const before=await validateImage(body.before);
  const after=['compare','site'].includes(body.mode)?await validateImage(body.after):null;
  const siteFacts=body.mode==='site'&&typeof body.siteFacts==='string'?body.siteFacts.slice(0,18000):undefined;
  const extraScreens=[];
  if(body.mode==='site'&&body.extraScreens!==undefined){if(!Array.isArray(body.extraScreens)||body.extraScreens.length>4)throw new ReviewError('invalid_screens',400,'확인할 페이지 구간이 너무 많습니다.');const seen=new Set(['before','after']);for(const screen of body.extraScreens){if(!siteImageIds.includes(screen?.key)||seen.has(screen.key))throw new ReviewError('invalid_screens',400,'페이지 구간 정보를 확인할 수 없습니다.');seen.add(screen.key);extraScreens.push({key:screen.key,label:siteImageLabels[screen.key],image:await validateImage(screen.data),scrollY:Number.isFinite(screen.scrollY)?Math.max(0,Math.min(12000,screen.scrollY)):0});}}
  let siteContext;
  if(body.mode==='site'&&body.siteContext){
    let url;try{url=new URL(body.siteContext.url);}catch{throw new ReviewError('invalid_site_context',400,'검사한 사이트 주소를 확인할 수 없습니다.');}
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.href.length>2048)throw new ReviewError('invalid_site_context',400,'사이트 주소를 확인해 주세요.');
    siteContext={url:url.href,title:String(body.siteContext.title||'').slice(0,200),scope:describeSiteScope(['before','after',...extraScreens.map(s=>s.key)])};
  }
  return {mode:body.mode,purpose,before,after,siteFacts,siteContext,extraScreens};
}
