import { createHmac } from 'node:crypto';
// In-memory safeguards are per server instance, NOT a durable global billing cap.
export function createLimiter({perClient=10,globalLimit=40,concurrent=3,windowMs=3600000}={}) {
  let windowStart=Date.now(),total=0,active=0;const clients=new Map();
  return { take(key,now=Date.now()) {
    if(now-windowStart>=windowMs){windowStart=now;total=0;clients.clear();}
    const retryAfter=Math.max(1,Math.ceil((windowStart+windowMs-now)/1000));
    if(active>=concurrent)return {ok:false,retryAfter:20};
    if(total>=globalLimit||(clients.get(key)??0)>=perClient)return {ok:false,retryAfter};
    if(clients.size>=5000&&!clients.has(key))return {ok:false,retryAfter};
    total++;active++;clients.set(key,(clients.get(key)??0)+1);
    let released=false;
    return {ok:true,release(){if(!released){active--;released=true;}}};
  } };
}
const store=globalThis.__uxCheckLimiter??=createLimiter();
export function reserveReview(request) {
  const ip=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'local';
  const key=createHmac('sha256',process.env.SETUP_CHECK_TOKEN||'local-development').update(ip.split(',')[0].trim()).digest('hex');
  return store.take(key);
}
