// Reproducible HTTP test of the app's public URL workflow. Browser automation
// lives in the product capture API; this script calls that API as a client.
import {siteAnalysisFacts} from '../lib/site-contract.js';
import {mkdir,writeFile} from 'node:fs/promises';
const [url,base='https://ux-check-zeta.vercel.app',option]=process.argv.slice(2);
if(!url)throw Error('Usage: node scripts/smoke-site.mjs <public-url> [app-base-url] [--capture-only]');
const directory='artifacts/private/sites/'+Date.now();await mkdir(directory,{recursive:true});
const started=Date.now();
async function post(path,body){try{const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:new URL(base).origin},body:JSON.stringify(body),signal:AbortSignal.timeout(250000)});const data=await response.json().catch(()=>({error:'invalid_json'}));return {status:response.status,data};}catch(error){return {status:0,data:{error:'transport_error',code:error.cause?.code||error.name}};}}
const captured=await post('/api/capture',{url,consent:true});
if(captured.status!==200){await writeFile(directory+'/result.json',JSON.stringify(captured,null,2));console.log(JSON.stringify({stage:'capture',status:captured.status,error:captured.data.error,directory}));process.exitCode=1;}else{
 const capture=captured.data.capture;
 for(const name of ['desktop','mobile']){await writeFile(directory+'/'+name+'.jpg',Buffer.from(capture[name].data.split(',')[1],'base64'));}
 const {desktop,mobile,screens,...metadata}=capture;metadata.screens=screens?.map(({data,...screen})=>screen);for(const screen of screens||[])await writeFile(directory+'/'+screen.key+'.jpg',Buffer.from(screen.data.split(',')[1],'base64'));await writeFile(directory+'/capture.json',JSON.stringify(metadata,null,2));
 console.log(JSON.stringify({stage:'capture',status:200,title:capture.title,durationMs:capture.durationMs,blockedRequests:capture.scope.blockedRequests,directory}));
 if(option!=='--capture-only'){
  const analyzed=await post('/api/review',{mode:'site',purpose:'방문자가 사이트의 주요 정보를 이해하고 필요한 메뉴를 찾아 다음 행동을 쉽게 수행한다.',consent:true,before:desktop.data,after:mobile.data,siteContext:{url:capture.finalUrl,title:capture.title},extraScreens:(capture.screens||[]).filter(s=>!['before','after'].includes(s.key)).map(s=>({key:s.key,data:s.data,scrollY:s.scrollY})),siteFacts:siteAnalysisFacts(capture)});
  await writeFile(directory+'/result.json',JSON.stringify(analyzed,null,2));
  console.log(JSON.stringify({stage:'analysis',status:analyzed.status,error:analyzed.data.error,issues:analyzed.data.report?.issues.length,usage:analyzed.data.report?.usage,totalMs:Date.now()-started,directory}));if(analyzed.status!==200)process.exitCode=1;
 }
}
