import {release} from './release.mjs';
const protocol = release.protocol;
const reply = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});

function setup(raw) {
  const value = JSON.parse(raw || '{}');
  if (value.protocol !== protocol || !/^[a-f0-9]{64}$/.test(value.key) || !/^[1-9][0-9]{0,15}$/.test(value.botId) || !/^[1-9][0-9]{0,15}$/.test(value.chatId)) throw new Error('setup');
  return value;
}
async function equal(a, b) {
  const encode = new TextEncoder();
  const [x,y] = await Promise.all([crypto.subtle.digest('SHA-256',encode.encode(a)), crypto.subtle.digest('SHA-256',encode.encode(b))]);
  return crypto.subtle.timingSafeEqual(x,y);
}
async function body(request) {
  if (!request.body) throw new Error('body');
  const reader = request.body.getReader();
  let size = 0; const parts = [];
  try { for (;;) { const {value,done} = await reader.read(); if(done) break; size += value.byteLength; if(size > 200000) {await reader.cancel(); throw new Error('size');} parts.push(value); } }
  finally {reader.releaseLock();}
  const bytes = new Uint8Array(size); let offset = 0; for(const part of parts) {bytes.set(part,offset); offset += part.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function owned(update, config) {
  const item = update.callback_query || update.message;
  const chat = update.callback_query ? item?.message?.chat : item?.chat;
  return item && String(item.from?.id) === config.chatId && String(chat?.id) === config.chatId && chat.type === 'private';
}
async function pending(db) {
  const result = await db.prepare('SELECT seq,payload FROM inbox WHERE payload IS NOT NULL ORDER BY seq LIMIT 20').all();
  return result.results.map(row => ({seq:row.seq,update:JSON.parse(row.payload)}));
}
export default {
  async fetch(request, env) {
    try {
      const path = new URL(request.url).pathname;
      if (path === '/' && request.method === 'GET') return reply({service:'PostShô · servidor individual',...release});
      if (!['/telegram','/v1/identity','/v1/inbox','/v1/ack'].includes(path)) return reply({error:'not_found'},404);
      let config; try {config=setup(env.POSTSHO_SETUP);} catch {return reply({error:'setup_required'},503);}
      const supplied = path === '/telegram' ? request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '' : (request.headers.get('Authorization') || '').replace(/^Bearer /,'');
      if (!await equal(supplied,config.key)) return reply({error:'unauthorized'},401);
      if (path === '/v1/identity' && request.method === 'GET') {
        // Also verifies that the initial migration really exists before changing the webhook.
        await env.DB.prepare('SELECT seq FROM inbox WHERE payload IS NOT NULL LIMIT 1').all();
        const updateRepository = /^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/.test(env.UPDATE_REPOSITORY || '') ? env.UPDATE_REPOSITORY : '';
        return reply({...release,updateRepository,botId:config.botId,chatId:config.chatId});
      }
      if (path === '/telegram' && request.method === 'POST') {
        const update = await body(request);
        if (!Number.isSafeInteger(update.update_id) || update.update_id < 0) return reply({error:'invalid_update'},400);
        if (!owned(update,config)) return reply({ok:true}); // Never store another student's messages.
        const inserted = await env.DB.prepare('INSERT OR IGNORE INTO inbox(update_id,payload,received_at) VALUES(?,?,?)').bind(update.update_id,JSON.stringify(update),Date.now()).run();
        const message = update.message;
        if (inserted.meta.changes && (message?.video || message?.document?.mime_type?.startsWith('video/'))) {
          // Telegram executes this response itself: no bot token is stored in this server.
          return reply({method:'sendMessage',chat_id:config.chatId,text:'📥 Vídeo registrado no seu servidor. As opções chegam quando seu aparelho estiver conectado ao PostShô.',reply_parameters:{message_id:message.message_id,allow_sending_without_reply:true}});
        }
        return reply({ok:true});
      }
      if (path === '/v1/inbox' && request.method === 'GET') {
        let items = await pending(env.DB);
        // Two indexed reads per idle request, instead of polling the database in a loop.
        if (!items.length && new URL(request.url).searchParams.get('wait') === '1') {
          await new Promise(resolve => setTimeout(resolve,25000));
          items = await pending(env.DB);
        }
        return reply({...release,items});
      }
      if (path === '/v1/ack' && request.method === 'POST') {
        const value = await body(request), ids = value.ids;
        if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20 || !ids.every(id => Number.isSafeInteger(id) && id > 0)) return reply({error:'invalid_ack'},400);
        await env.DB.prepare(`UPDATE inbox SET payload=NULL,acknowledged_at=? WHERE payload IS NOT NULL AND seq IN (${ids.map(()=>'?').join(',')})`).bind(Date.now(),...ids).run();
        return reply({ok:true});
      }
      return reply({error:'method_not_allowed'},405);
    } catch {
      // Never expose incoming media metadata, private setup codes or database errors.
      return reply({error:'temporarily_unavailable'},503);
    }
  }
};
