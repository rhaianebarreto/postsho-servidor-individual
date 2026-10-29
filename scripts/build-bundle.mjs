import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const release=JSON.parse(readFileSync('server-release.json','utf8'));
const paths=['server-release.json','package.json','scripts/deploy.mjs',...readdirSync('src').filter(p=>p.endsWith('.mjs')).map(p=>'src/'+p),...readdirSync('migrations').filter(p=>p.endsWith('.sql')).map(p=>'migrations/'+p)];
try{readFileSync('package-lock.json');paths.push('package-lock.json');}catch{}
const files=paths.sort().map(path=>{const bytes=readFileSync(path);return {path,sha256:createHash('sha256').update(bytes).digest('hex'),content:bytes.toString('base64')};});
writeFileSync('server-bundle.json',JSON.stringify({repository:release.repository,versionCode:release.versionCode,files},null,2)+'\n');
console.log('Pacote público de atualização gerado, sem configuração de conta ou segredos.');
