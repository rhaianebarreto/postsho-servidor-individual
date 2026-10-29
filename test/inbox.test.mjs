import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const {Miniflare}=await import(process.env.POSTSHO_MINIFLARE_MODULE||'miniflare');
test('isolamento, persistência, reentrega sem duplicidade e confirmação seletiva', async()=>{
 const config={protocol:'postsho-inbox/1',key:'a'.repeat(64),botId:'1234',chatId:'5678'};
 const runtime=new Miniflare({modules:true,scriptPath:resolve('src/worker.mjs'),compatibilityDate:'2026-10-29',d1Databases:['DB'],bindings:{POSTSHO_SETUP:JSON.stringify(config),UPDATE_REPOSITORY:'aluna/meu-postsho'}});
 try {
  const db=await runtime.getD1Database('DB');await db.exec(readFileSync('migrations/0001_inbox.sql','utf8').replace(/--[^\n]*/g,'').replace(/\s+/g,' '));
  const fetch=(path,method='GET',data,auth=true)=>runtime.dispatchFetch('https://student.workers.dev'+path,{method,headers:{...(auth?{Authorization:'Bearer '+config.key,'X-Telegram-Bot-Api-Secret-Token':config.key}:{}),'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
  assert.equal((await fetch('/v1/inbox','GET',undefined,false)).status,401);
  assert.equal((await (await fetch('/v1/identity')).json()).botId,'1234');
  const identity=await (await fetch('/v1/identity')).json();assert.equal(identity.versionCode,1);assert.equal(identity.updateRepository,'aluna/meu-postsho');assert.equal(identity.protocol,'postsho-inbox/1');
  const message=(id,chat=5678)=>({update_id:id,message:{message_id:id,from:{id:chat},chat:{id:chat,type:'private'},video:{file_id:'video-'+id,file_size:40370634}}});
  assert.equal((await (await fetch('/telegram','POST',message(10,999))).json()).ok,true);
  assert.equal((await (await fetch('/v1/inbox')).json()).items.length,0);
  const receipt=await (await fetch('/telegram','POST',message(10))).json();assert.equal(receipt.method,'sendMessage');
  assert.equal((await (await fetch('/telegram','POST',message(10))).json()).method,undefined);
  await fetch('/telegram','POST',message(11));
  assert.equal((await (await fetch('/v1/identity')).json()).versionCode,1); // Version checks never acknowledge or alter pending videos.
  let items=(await (await fetch('/v1/inbox')).json()).items;assert.equal(items.length,2);
  assert.deepEqual((await (await fetch('/v1/inbox')).json()).items,items); // Lost response is safely replayed.
  await fetch('/v1/ack','POST',{ids:[items[0].seq]});
  await fetch('/v1/ack','POST',{ids:[items[0].seq]}); // Lost acknowledgement response is idempotent.
  await fetch('/telegram','POST',message(10)); // Telegram retries after Android has already persisted it.
  items=(await (await fetch('/v1/inbox')).json()).items;assert.equal(items.length,1);assert.equal(items[0].update.update_id,11);
  assert.equal((await fetch('/v1/ack','POST',{ids:['1); DELETE FROM inbox;--']})).status,400);
  assert.equal((await (await db.prepare('SELECT COUNT(*) AS n FROM inbox').first())).n,2);
  assert.equal((await fetch('/telegram','POST',{update_id:12,message:{chat:{id:5678,type:'group'},from:{id:5678},video:{}}})).status,200);
  assert.equal((await (await fetch('/v1/inbox')).json()).items.length,1);
  assert.equal((await fetch('/telegram','POST',{update_id:-1})).status,400);
  assert.equal((await fetch('/v1/ack','POST',{ids:[]})).status,400);
  assert.equal((await fetch('/v1/identity','POST',{})).status,405);
  // A new Worker isolate/version uses the same database and the same setup secret.
  const nextCode=readFileSync('src/worker.mjs','utf8').replace("import {release} from './release.mjs';",`const release=${JSON.stringify({...identity,version:'1.0.1',versionCode:2})};`);
  await runtime.setOptions({modules:true,script:nextCode,compatibilityDate:'2026-10-29',d1Databases:['DB'],bindings:{POSTSHO_SETUP:JSON.stringify(config),UPDATE_REPOSITORY:'aluna/meu-postsho'}});
  assert.equal((await (await fetch('/v1/identity')).json()).versionCode,2);
  const preserved=(await (await fetch('/v1/inbox')).json()).items;assert.equal(preserved.length,1);assert.equal(preserved[0].update.update_id,11);
  assert.equal((await (await fetch('/telegram','POST',message(10))).json()).method,undefined);
  assert.equal((await (await fetch('/v1/inbox')).json()).items.length,1);
 } finally {await runtime.dispose();}
});
