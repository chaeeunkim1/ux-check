import sharp from 'sharp';
import {captureOffsets,siteImageLabels} from './site-contract.js';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { existsSync } from 'node:fs';
import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeSiteUrl, resolvePublicHost } from './site-url.js';
import { createPublicProxy } from './site-proxy.js';
import { ReviewError } from './review-input.js';

function observeDocument(){
 const visible=element=>{const r=element.getBoundingClientRect(),s=getComputedStyle(element);return r.width>=2&&r.height>=4&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0;};
 const label=element=>(element.getAttribute('aria-label')||element.innerText||element.getAttribute('title')||'').trim().slice(0,120);
 const inputs=[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(visible);
 const buttons=[...document.querySelectorAll('button,[role=button]')].filter(visible);
 const images=[...document.images].filter(visible);
 return {title:document.title.slice(0,200),viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,hasViewportMeta:!!document.querySelector('meta[name=viewport]'),language:document.documentElement.lang,headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0,24).map(e=>{const r=e.getBoundingClientRect();return {level:e.tagName,text:label(e),color:getComputedStyle(e).color,documentY:Math.round(r.y+scrollY),inViewport:r.bottom>0&&r.top<innerHeight};}),visibleText:document.body.innerText.slice(0,6000),counts:{inputs:inputs.length,buttons:buttons.length,images:images.length,imagesWithoutAlt:images.filter(e=>!e.hasAttribute('alt')).length},unlabelledInputs:inputs.filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!['submit','button','reset'].includes(e.type)).slice(0,8).map(e=>({tag:e.tagName,type:e.type||'',placeholder:e.getAttribute('placeholder')||'',id:e.id.slice(0,80)})),emptyButtons:buttons.filter(e=>!label(e)&&!e.getAttribute('aria-labelledby')).length};
}
export async function captureSite(value){
 const url=normalizeSiteUrl(value);await resolvePublicHost(url.hostname);
 const proxy=await createPublicProxy();let browser;const started=Date.now();let blocked=0,requestCount=0,stage='browser_start';
 try{
  const isLocal=process.platform==='win32';
  const executablePath=isLocal?['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(existsSync):await chromium.executablePath();
  if(!isLocal){const fontDir=join(tmpdir(),'fonts');await mkdir(fontDir,{recursive:true});await copyFile(join(process.cwd(),'assets/fonts/NotoSansKR.ttf'),join(fontDir,'NotoSansKR.ttf'));}
  if(!executablePath)throw new ReviewError('capture_unavailable',503,'페이지 확인 환경을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.');
  browser=await puppeteer.launch({executablePath,headless:true,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(key))),acceptInsecureCerts:false,args:[...(isLocal?[]:chromium.args.filter(arg=>!['--disable-web-security','--allow-running-insecure-content'].includes(arg))),`--proxy-server=${proxy.url}`,'--proxy-bypass-list=<-loopback>','--disable-quic','--disable-background-networking','--disable-component-update','--disable-extensions','--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],timeout:20000});
  const page=await browser.newPage();await page.setBypassServiceWorker(true);await page.setRequestInterception(true);
  page.on('request',request=>{
   try{
    const resource=request.resourceType();
    if(++requestCount>120||!['GET','HEAD'].includes(request.method())||['websocket','eventsource','media','manifest'].includes(resource)||(request.isNavigationRequest()&&request.frame()!==page.mainFrame())){blocked++;return void request.abort().catch(()=>{});}
    if(request.url().startsWith('data:')||request.url().startsWith('blob:'))return void request.continue().catch(()=>{});
    normalizeSiteUrl(request.url());
    void request.continue({headers:Object.fromEntries(Object.entries(request.headers()).filter(([name])=>!['cookie','authorization','proxy-authorization'].includes(name.toLowerCase())))}).catch(()=>{});
   }catch{blocked++;void request.abort().catch(()=>{});}
  });
  page.on('dialog',dialog=>void dialog.dismiss().catch(()=>{}));
  page.on('popup',popup=>void popup.close().catch(()=>{}));
  await page.setViewport({width:1280,height:900,deviceScaleFactor:1});
  stage='navigation';
  const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:25000});
  if(!response||response.status()>=400)throw new ReviewError('page_unavailable',422,'사이트가 접근을 거부하거나 오류를 반환했습니다. 공개 페이지 주소인지 확인해 주세요.');
  const contentType=response.headers()['content-type']||'';
  if(!contentType.includes('text/html'))throw new ReviewError('not_web_page',422,'HTML 웹 페이지 주소를 입력해 주세요. 파일 주소는 지원하지 않습니다.');
  normalizeSiteUrl(page.url());
  await page.waitForNetworkIdle({idleTime:500,timeout:5000}).catch(()=>{});
  await page.evaluate(()=>Promise.race([document.fonts.ready.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),3000))]));
  const screens=[];
  async function collectScreens(device){
   const viewport=device==='desktop'?{width:1280,height:900}:{width:390,height:844};
   const overview=await page.evaluate(observeDocument);
   const offsets=captureOffsets(overview.documentHeight,viewport.height);
   for(let index=0;index<offsets.length;index++){
    await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),offsets[index]);
    // Give lazy images and scroll-triggered layout a bounded opportunity to settle.
    await page.waitForNetworkIdle({idleTime:400,timeout:1800}).catch(()=>{});
    const observed=await page.evaluate(()=>({scrollY:Math.round(scrollY),viewportText:[...document.querySelectorAll('h1,h2,h3,p,a,button,label,input')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>2&&r.height>4&&r.bottom>0&&r.top<innerHeight&&s.visibility!=='hidden'&&Number(s.opacity)>0;}).slice(0,60).map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').trim().slice(0,160),color:getComputedStyle(e).color,fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};})}));
    let buffer=Buffer.from(await page.screenshot({type:'jpeg',quality:80,fullPage:false}));
    if(buffer.length>280000)buffer=await sharp(buffer).jpeg({quality:60}).toBuffer();
    if(buffer.length>280000)buffer=await sharp(buffer).resize({width:Math.round(viewport.width*.8)}).jpeg({quality:50}).toBuffer();
    if(buffer.length>280000)throw new ReviewError('page_too_complex',422,'화면의 이미지 용량이 너무 큽니다. 더 단순한 하위 페이지로 검사해 주세요.');
    const metadata=await sharp(buffer).metadata();
    const key=index===0?(device==='desktop'?'before':'after'):`${device}-${index===offsets.length-1?'bottom':'middle'}`;
    screens.push({key,label:siteImageLabels[key],data:'data:image/jpeg;base64,'+buffer.toString('base64'),width:metadata.width,height:metadata.height,scrollY:observed.scrollY,viewport,observations:observed.viewportText});
   }
   return overview;
  }
  stage='desktop_capture';
  const desktopFacts=await collectScreens('desktop');
  stage='mobile_capture';
  await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.waitForNetworkIdle({idleTime:500,timeout:4000}).catch(()=>{});
  const mobileFacts=await collectScreens('mobile');
  const finalUrl=normalizeSiteUrl(page.url()).href;
  return {url:url.href,finalUrl,title:desktopFacts.title,capturedAt:new Date().toISOString(),durationMs:Date.now()-started,desktop:screens.find(s=>s.key==='before'),mobile:screens.find(s=>s.key==='after'),screens,facts:{desktop:desktopFacts,mobile:mobileFacts},scope:{pages:1,sampled:true,maxDocumentHeight:12000,screens:screens.length,interactions:false,blockedRequests:blocked,notice:`입력한 공개 페이지를 데스크톱·모바일에서 최대 3개씩, 총 ${screens.length}개 구간으로 확인했습니다. 긴 페이지는 구간 사이가 생략될 수 있습니다. 로그인, 클릭, 입력, 링크 이동과 전체 사이트 순회는 수행하지 않았습니다. 일부 리소스가 차단되면 원래 화면과 다를 수 있습니다.`}};
 }catch(error){if(error instanceof ReviewError)throw error;console.warn('site_capture_failed',JSON.stringify({stage,name:error?.name,networkCode:String(error?.message||'').match(/ERR_[A-Z_]+/)?.[0],requests:requestCount,blocked}));throw new ReviewError('capture_failed',422,'페이지를 열지 못했습니다. 사이트의 접속 제한·인증 또는 로딩 지연이 있을 수 있습니다. 다른 공개 주소로 다시 시도해 주세요.');}
 finally{await browser?.close().catch(()=>{});proxy.close();}
}
