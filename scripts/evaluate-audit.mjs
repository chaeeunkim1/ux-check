import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {validateReviewInput} from '../lib/review-input.js';
import {siteAnalysisFacts} from '../lib/site-contract.js';
import {analyzeReview} from '../lib/review-engine.js';
import {auditReview} from '../lib/review-audit.js';
const [directory,purpose,...models]=process.argv.slice(2);
if(!directory||!purpose||!models.length)throw Error('Usage: node --env-file=.env.local scripts/evaluate-audit.mjs <saved-capture-directory> <purpose> <audit-model>...');
const capture=JSON.parse(await readFile(join(directory,'capture.json'),'utf8'));
const image=async key=>'data:image/jpeg;base64,'+(await readFile(join(directory,key+'.jpg'))).toString('base64');
const input=await validateReviewInput({mode:'site',consent:true,purpose,before:await image('before'),after:await image('after'),siteContext:{url:capture.finalUrl,title:capture.title},extraScreens:await Promise.all(capture.screens.filter(s=>!['before','after'].includes(s.key)).map(async s=>({key:s.key,data:await image(s.key),scrollY:s.scrollY}))),siteFacts:siteAnalysisFacts(capture)});
let draft;try{draft=JSON.parse(await readFile(join(directory,'audit-draft.json'),'utf8'));}catch{const start=Date.now();draft=await analyzeReview(input,{verify:false});await writeFile(join(directory,'audit-draft.json'),JSON.stringify(draft,null,2));console.log(JSON.stringify({stage:'draft',durationMs:Date.now()-start,model:draft.model,issues:draft.issues.map(i=>({number:i.number,title:i.title,observation:i.observation})),usage:draft.usage}));}
for(const model of models){const start=Date.now();try{const result=await auditReview(input,draft,{model});await writeFile(join(directory,'audit-'+model+'-'+start+'.json'),JSON.stringify({...result,durationMs:Date.now()-start},null,2));console.log(JSON.stringify({stage:'audit',model,durationMs:Date.now()-start,qualityCheck:result.qualityCheck,issues:result.issues.map(i=>({title:i.title,verdict:i.auditVerdict,note:i.auditNote})),usage:result.usage}));}catch(error){console.log(JSON.stringify({stage:'audit',model,error:error.code||error.name}));process.exitCode=1;}}
