// All browser HTTP(S) traffic uses this private, per-capture proxy. DNS is
// validated and the exact validated IP is used for the connection (no rebinding).
import http from 'node:http';
import net from 'node:net';
import { normalizeSiteUrl, resolvePublicHost } from './site-url.js';
export async function createPublicProxy(){
 const sockets=new Set();let bytes=0,connections=0,closed=false;
 const track=socket=>{sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));socket.setTimeout(20000,()=>socket.destroy());return socket;};
 const meter=chunk=>{bytes+=chunk.length;if(bytes>45_000_000)for(const socket of sockets)socket.destroy();};
 const server=http.createServer(async(req,res)=>{
  try{
   if(closed||++connections>140||!['GET','HEAD'].includes(req.method))throw Error('blocked');
   const url=normalizeSiteUrl(req.url);if(url.protocol!=='http:')throw Error('scheme');
   const ip=await resolvePublicHost(url.hostname);
   const upstream=http.request({hostname:ip.address,family:ip.family,port:Number(url.port)||80,path:url.pathname+url.search,method:req.method,headers:{host:url.host,'user-agent':'UXCheck/1.0 (read-only UI review)','accept':req.headers.accept||'*/*'},timeout:15000},remote=>{res.writeHead(remote.statusCode,remote.headers);remote.on('data',meter);remote.pipe(res);});
   upstream.on('socket',track);upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});upstream.on('timeout',()=>upstream.destroy());upstream.end();
  }catch{res.writeHead(403);res.end('Public pages only');}
 });
 server.on('connection',track);
 server.on('connect',async(req,client,head)=>{
  try{
   if(closed||++connections>140)throw Error('limit');
   const url=normalizeSiteUrl('https://'+req.url);if(url.pathname!=='/'||url.search||(url.port&&url.port!=='443'))throw Error('port');
   const ip=await resolvePublicHost(url.hostname);if(closed||client.destroyed)return;
   const upstream=track(net.connect({host:ip.address,family:ip.family,port:443}));
   upstream.once('connect',()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);upstream.on('data',meter);client.pipe(upstream);upstream.pipe(client);});
   upstream.once('error',()=>client.destroy());client.once('close',()=>upstream.destroy());
  }catch{client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {url:`http://127.0.0.1:${server.address().port}`,close:()=>{closed=true;for(const socket of sockets)socket.destroy();server.close();},stats:()=>({bytes,connections})};
}
