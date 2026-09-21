import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { ReviewError } from './review-input.js';
const fail=()=>new ReviewError('url_not_public',400,'로그인 없이 열리는 공개 HTTP(S) 주소를 입력해 주세요. 내부망·로컬 주소는 검사할 수 없습니다.');
export function isPublicAddress(address){try{let ip=ipaddr.parse(address);if(ip.kind()==='ipv6'&&ip.isIPv4MappedAddress())ip=ip.toIPv4Address();return ip.range()==='unicast';}catch{return false;}}
export function normalizeSiteUrl(value){
 if(typeof value!=='string'||value.length>2048||!value.trim()||/[\u0000-\u0020\\]/.test(value.trim()))throw fail();
 let url;try{url=new URL(value.trim());}catch{throw fail();}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||(url.port&&!['80','443'].includes(url.port)))throw fail();
 const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
 if(!host||host==='localhost'||/\.(localhost|local|internal|test|invalid)$/.test(host)||(!host.includes('.')&&!host.includes(':'))||(ipaddr.isValid(host)&&!isPublicAddress(host)))throw fail();
 url.hash='';return url;
}
export async function resolvePublicHost(host,lookup=dns.lookup){
 const hostname=host.replace(/^\[|\]$/g,'');
 if(ipaddr.isValid(hostname)){if(!isPublicAddress(hostname))throw fail();return {address:hostname,family:ipaddr.parse(hostname).kind()==='ipv4'?4:6};}
 let addresses;try{addresses=await lookup(hostname,{all:true,verbatim:true});}catch{throw new ReviewError('dns_failed',422,'사이트 주소를 찾지 못했습니다. 주소의 철자를 확인해 주세요.');}
 if(!addresses.length||addresses.some(item=>!isPublicAddress(item.address)))throw fail();
 return addresses.find(item=>item.family===4)||addresses[0];
}
