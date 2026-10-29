import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {applyBundle} from '../scripts/update-server.mjs';
const repository='rhaianebarreto/postsho-servidor-individual';
function item(path,content){const bytes=Buffer.from(content);return {path,content:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')};}
function bundle(code=2){return {repository,versionCode:code,files:[item('src/worker.mjs','export default {};'),item('src/release.mjs','export const release = {};'),item('server-release.json',JSON.stringify({repository,versionCode:code,protocol:'postsho-inbox/1'}))]};}
test('atualização preserva banco, segredos, configuração da aluna e não permite downgrade',async()=>{
 const root=await mkdtemp(join(tmpdir(),'postsho-update-'));
 try{
  await writeFile(join(root,'server-release.json'),JSON.stringify({repository,versionCode:1}));
  await writeFile(join(root,'wrangler.jsonc'),'database_id=aluna');await writeFile(join(root,'.dev.vars'),'SEGREDO_LOCAL');
  await mkdir(join(root,'migrations'));await writeFile(join(root,'migrations/0001_inbox.sql'),'CREATE TABLE inbox(id);');
  const value=bundle();value.files.push(item('migrations/0001_inbox.sql','CREATE TABLE inbox(id);'));value.files.push(item('migrations/0002_additive.sql','CREATE INDEX example ON inbox(id);'));
  await applyBundle(root,value);
  assert.equal(await readFile(join(root,'wrangler.jsonc'),'utf8'),'database_id=aluna');assert.equal(await readFile(join(root,'.dev.vars'),'utf8'),'SEGREDO_LOCAL');
  assert.equal(JSON.parse(await readFile(join(root,'server-release.json'),'utf8')).versionCode,2);
  assert.deepEqual(await applyBundle(root,value),[]);
  await assert.rejects(applyBundle(root,bundle(1)),/inválido/);
  const destructive=bundle(3);destructive.files.push(item('migrations/0001_inbox.sql','DROP TABLE inbox;'));
  await assert.rejects(applyBundle(root,destructive),/migração/);
  assert.equal(JSON.parse(await readFile(join(root,'server-release.json'),'utf8')).versionCode,2);
  for(const path of ['wrangler.jsonc','.dev.vars','../outside','src/../wrangler.jsonc','.github/workflows/anything.yml']){
   const invalid=bundle(3);invalid.files.push(item(path,'corrupt'));
   await assert.rejects(applyBundle(root,invalid),/não permitido/);
  }
  const damaged=bundle(3);damaged.files[0].content=Buffer.from('adulterado').toString('base64');await assert.rejects(applyBundle(root,damaged),/Integridade/);
 }finally{await rm(root,{recursive:true,force:true});}
});
