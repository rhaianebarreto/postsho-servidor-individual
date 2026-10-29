import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const remote=execFileSync('git',['remote','get-url','origin'],{encoding:'utf8'}).trim();
let repository='';
if(remote.startsWith('git@github.com:'))repository=remote.slice('git@github.com:'.length).replace(/\.git$/,'');
else {const uri=new URL(remote);if(uri.hostname==='github.com')repository=uri.pathname.slice(1).replace(/\.git$/,'');}
if(!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/.test(repository))throw new Error('A instalação deve estar conectada ao repositório GitHub da própria aluna.');
const cli=resolve('node_modules/wrangler/bin/wrangler.js');
execFileSync(process.execPath,[cli,'d1','migrations','apply','DB','--remote'],{stdio:'inherit'});
execFileSync(process.execPath,[cli,'deploy','--var','UPDATE_REPOSITORY:'+repository],{stdio:'inherit'});
