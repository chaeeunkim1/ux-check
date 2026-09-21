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
 const visible=element=>{const r=element.getBoundingClientRect(),s=getComputedStyle(element);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
 const label=element=>(element.getAttribute('aria-label')||element.innerText||element.getAttribute('title')||'').trim().slice(0,120);
 const inputs=[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(visible);
 const buttons=[...document.querySelectorAll('button,[role=button]')].filter(visible);
 const images=[...document.images].filter(visible);
 return {title:document.title.slice(0,200),viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,hasViewportMeta:!!document.querySelector('meta[name=viewport]'),language:document.documentElement.lang,headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).slice(0,24).map(e=>({level:e.tagName,text:label(e)})),visibleText:document.body.innerText.slice(0,6000),counts:{inputs:inputs.length,buttons:buttons.length,images:images.length,imagesWithoutAlt:images.filter(e=>!e.hasAttribute('alt')).length},unlabelledInputs:inputs.filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!['submit','button','reset'].includes(e.type)).slice(0,8).map(e=>({tag:e.tagName,type:e.type||'',placeholder:e.getAttribute('placeholder')||'',id:e.id.slice(0,80)})),emptyButtons:buttons.filter(e=>!label(e)&&!e.getAttribute('aria-labelledby')).length};
}
export async function captureSite(value){
 const url=normalizeSiteUrl(value);await resolvePublicHost(url.hostname);
 const proxy=await createPublicProxy();let browser;const started=Date.now();let blocked=0,requestCount=0;
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
  const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:25000});
  if(!response||response.status()>=400)throw new ReviewError('page_unavailable',422,'사이트가 접근을 거부하거나 오류를 반환했습니다. 공개 페이지 주소인지 확인해 주세요.');
  const contentType=response.headers()['content-type']||'';
  if(!contentType.includes('text/html'))throw new ReviewError('not_web_page',422,'HTML 웹 페이지 주소를 입력해 주세요. 파일 주소는 지원하지 않습니다.');
  normalizeSiteUrl(page.url());
  await page.waitForNetworkIdle({idleTime:500,timeout:5000}).catch(()=>{});
  await page.evaluate(()=>Promise.race([document.fonts.ready.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),3000))]));
  const desktopFacts=await page.evaluate(observeDocument);
  const desktop=Buffer.from(await page.screenshot({type:'jpeg',quality:85,fullPage:false}));
  await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await page.waitForNetworkIdle({idleTime:500,timeout:4000}).catch(()=>{});
  const mobileFacts=await page.evaluate(observeDocument);
  const mobile=Buffer.from(await page.screenshot({type:'jpeg',quality:85,fullPage:false}));
  const finalUrl=normalizeSiteUrl(page.url()).href;
  return {url:url.href,finalUrl,title:desktopFacts.title,capturedAt:new Date().toISOString(),durationMs:Date.now()-started,desktop:{data:'data:image/jpeg;base64,'+desktop.toString('base64'),width:1280,height:900},mobile:{data:'data:image/jpeg;base64,'+mobile.toString('base64'),width:390,height:844},facts:{desktop:desktopFacts,mobile:mobileFacts},scope:{pages:1,viewportOnly:true,interactions:false,blockedRequests:blocked,notice:'입력한 공개 페이지의 데스크톱·모바일 첫 화면과 렌더링된 문서 구조를 관찰했습니다. 로그인, 클릭, 입력, 링크 이동과 전체 사이트 순회는 수행하지 않았습니다. 일부 리소스가 차단되면 원래 화면과 다를 수 있습니다.'}};
 }catch(error){if(error instanceof ReviewError)throw error;throw new ReviewError('capture_failed',422,'페이지를 열지 못했습니다. 사이트의 접속 제한·인증 또는 로딩 지연이 있을 수 있습니다. 다른 공개 주소로 다시 시도해 주세요.');}
 finally{await browser?.close().catch(()=>{});proxy.close();}
}
