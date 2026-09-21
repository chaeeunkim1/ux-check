import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublicAddress,normalizeSiteUrl,resolvePublicHost} from '../lib/site-url.js';
test('URL capture rejects internal, metadata, alternate IP encodings and credentials',()=>{
 for(const url of ['http://localhost','http://127.1','http://2130706433','http://0x7f000001','http://169.254.169.254/latest','http://10.1.2.3','http://[::1]','http://[::ffff:127.0.0.1]','http://user:pass@example.com','file:///tmp/a','https://example.com:8443','https://example.com\\@127.0.0.1'])assert.throws(()=>normalizeSiteUrl(url));
 assert.equal(normalizeSiteUrl('https://example.com/path#anchor').href,'https://example.com/path');
});
test('DNS checks every returned address and pins a validated public address',async()=>{
 assert.equal(isPublicAddress('8.8.8.8'),true);assert.equal(isPublicAddress('100.64.0.1'),false);assert.equal(isPublicAddress('192.168.1.1'),false);assert.equal(isPublicAddress('fe80::1'),false);
 await assert.rejects(resolvePublicHost('example.com',async()=>[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}]));
 assert.deepEqual(await resolvePublicHost('example.com',async()=>[{address:'8.8.8.8',family:4}]),{address:'8.8.8.8',family:4});
});
