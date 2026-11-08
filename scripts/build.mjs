import {build} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
await build({entryPoints:['src/tree3d.js'],outfile:'dist/tree3d.js',bundle:true,format:'esm',minify:true,target:'es2022',legalComments:'eof'});
await writeFile('dist/three-LICENSE.txt',await readFile('node_modules/three/LICENSE','utf8'));
const types={txt:'text/plain; charset=utf-8',html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'},assets={};
for(const name of ['index.html','style.css','app.js','model.js','tree3d.js','three-LICENSE.txt'])assets['/'+name]={body:await readFile('dist/'+name,'utf8'),type:types[name.split('.').pop()]};
const auth=await readFile('worker/auth.js','utf8'),entry=(await readFile('worker/index.js','utf8')).replace(/^import .*;\n/,'');
await mkdir('dist/server',{recursive:true});await writeFile('dist/server/index.js','const ASSET_MAP='+JSON.stringify(assets)+';\n'+auth+'\n'+entry);
