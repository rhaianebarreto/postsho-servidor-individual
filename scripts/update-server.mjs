import {readFile,writeFile,mkdir,rename,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const official = 'rhaianebarreto/postsho-servidor-individual';
const allowed = /^(src\/[a-zA-Z0-9_-]+\.mjs|scripts\/deploy\.mjs|migrations\/[0-9]{4}_[a-zA-Z0-9_-]+\.sql|package\.json|package-lock\.json|server-release\.json)$/;
const hash = value => createHash('sha256').update(value).digest('hex');
export async function applyBundle(root, bundle) {
  const installed = JSON.parse(await readFile(resolve(root,'server-release.json'),'utf8'));
  if (bundle.repository !== official || !Number.isSafeInteger(bundle.versionCode) || bundle.versionCode < installed.versionCode || !Array.isArray(bundle.files) || bundle.files.length < 3 || bundle.files.length > 100) throw new Error('Pacote de atualização inválido.');
  const staged=[]; const seen=new Set(); let total=0;
  for(const item of bundle.files) {
    if(!allowed.test(item.path)||seen.has(item.path)||! /^[a-f0-9]{64}$/.test(item.sha256)||typeof item.content!=='string')throw new Error('Arquivo não permitido na atualização.');
    seen.add(item.path);const bytes=Buffer.from(item.content,'base64');total+=bytes.length;
    if(total>2000000||hash(bytes)!==item.sha256)throw new Error('Integridade da atualização inválida.');
    const target=resolve(root,item.path);
    // Never follow links into configuration or files outside this checkout.
    for(let path=target;path!==resolve(root);path=dirname(path)) {try {if((await lstat(path)).isSymbolicLink())throw new Error('Link simbólico não permitido.');}catch(e){if(e.code!=='ENOENT')throw e;}}
    if(item.path.startsWith('migrations/')) {
      try {if(hash(await readFile(target))!==item.sha256)throw new Error('Uma migração já existente foi alterada. Atualização cancelada.');}catch(e){if(e.code!=='ENOENT')throw e;}
    }
    staged.push({target,bytes,path:item.path});
  }
  for(const required of ['src/worker.mjs','src/release.mjs','server-release.json'])if(!seen.has(required))throw new Error('Pacote incompleto.');
  const manifest=JSON.parse(staged.find(item=>item.path==='server-release.json').bytes.toString('utf8'));
  if(manifest.versionCode!==bundle.versionCode||manifest.repository!==official||manifest.protocol!=='postsho-inbox/1')throw new Error('Versão incompatível com este instalador.');
  // Validate everything before touching files. Nothing is deployed until the workflow commits successfully.
  if(bundle.versionCode===installed.versionCode)return [];
  for(const item of staged){await mkdir(dirname(item.target),{recursive:true});await writeFile(item.target+'.postsho-new',item.bytes);await rename(item.target+'.postsho-new',item.target);}
  return staged.map(item=>item.path);
}

async function boundedJSON(url) {
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000),headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error('Não foi possível consultar a versão oficial.');
 let bytes=0;const chunks=[];for await(const chunk of response.body){bytes+=chunk.length;if(bytes>3000000)throw new Error('Pacote excede o limite.');chunks.push(Buffer.from(chunk));}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function main() {
 const root=resolve('.');
 // Pin the package to a single Git commit; never mix files from changing branches.
 const metadata=await boundedJSON(`https://api.github.com/repos/${official}/commits/main`);
 if(!/^[a-f0-9]{40}$/.test(metadata.sha))throw new Error('Referência oficial inválida.');
 const bundle=await boundedJSON(`https://raw.githubusercontent.com/${official}/${metadata.sha}/server-bundle.json`);
 const changed=await applyBundle(root,bundle);
 if(!changed.length){console.log('Servidor já usa a versão disponível.');return;}
 execFileSync('git',['add','--',...changed],{stdio:'inherit'});
 console.log('Atualização preparada. O banco, o endereço e os segredos foram preservados.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Atualização cancelada. Nenhuma implantação foi iniciada. Confira o pacote oficial ou procure o suporte.');process.exitCode=1;});
