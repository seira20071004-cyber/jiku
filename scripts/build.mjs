import {readFile,mkdir,writeFile} from 'node:fs/promises';
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'},assets={};
for(const name of ['index.html','style.css','app.js','model.js'])assets['/'+name]={body:await readFile('dist/'+name,'utf8'),type:types[name.split('.').pop()]};
const auth=await readFile('worker/auth.js','utf8'),entry=(await readFile('worker/index.js','utf8')).replace(/^import .*;\n/,'');
await mkdir('dist/server',{recursive:true});await writeFile('dist/server/index.js','const ASSET_MAP='+JSON.stringify(assets)+';\n'+auth+'\n'+entry);
