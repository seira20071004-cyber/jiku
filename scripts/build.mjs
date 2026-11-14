import {build} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
await build({entryPoints:['src/tree3d.js'],outfile:'dist/tree3d.js',bundle:true,format:'esm',minify:true,target:'es2022',legalComments:'eof'});
await build({entryPoints:['src/universe.js'],outfile:'dist/universe.js',bundle:true,format:'esm',minify:true,target:'es2022',legalComments:'eof'});
await build({entryPoints:['src/origin-preview.js'],outfile:'dist/origin-preview.js',bundle:true,format:'esm',minify:true,target:'es2022',legalComments:'eof'});
await writeFile('dist/three-LICENSE.txt',await readFile('node_modules/three/LICENSE','utf8'));
const types={
  txt:'text/plain; charset=utf-8',html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',
  webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png'
};
const assets={};
for(const name of [
  'index.html','style.css','app.js','onboarding.js','onboarding-sky.js','birth-music.js','origin-framing.js','origin-preview.js','onboarding.css',
  'model.js','quantity-view.js','tree3d.js','universe.js','universe-model.js','demo.js','example-map.js','mind-map.js','mind-map.css','map-import.js','three-LICENSE.txt',
  'manifest.webmanifest','icons/jiku.svg','icons/jiku-180.png','icons/jiku-192.png','icons/jiku-512.png'
]){
  const extension=name.split('.').pop();
  assets['/'+name]={body:await readFile('dist/'+name,extension==='png'?'base64':'utf8'),type:types[extension]};
}
const auth=await readFile('worker/auth.js','utf8'),entry=(await readFile('worker/index.js','utf8')).replace(/^import .*;\n/,'');
await mkdir('dist/server',{recursive:true});await writeFile('dist/server/index.js','const ASSET_MAP='+JSON.stringify(assets)+';\n'+auth+'\n'+entry);
