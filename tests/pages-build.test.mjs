import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,mkdir,copyFile,cp,writeFile,symlink,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPages,rootFiles,pagesHeaders} from '../maintenance/preparar-pages.mjs';
import {canSkipBuild} from '../maintenance/netlify-build-ignore.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),commit='a'.repeat(40);

test('Pages publica aplicação, fontes e laboratório sem arquivos internos; conserva imports e identifica versão',async()=>{
  const result=await buildPages({commit});
  assert(result.files.includes('vendor/fonts/DejaVuSans-Latin.ttf'));
  assert(result.files.includes('js/executive-charts.js'));
  const top=await readdir(result.output);
  for(const forbidden of ['maintenance','tests','docs','.github','firebase.json','firestore.rules','netlify.toml','_redirects'])assert(!top.includes(forbidden),forbidden);
  assert.equal(JSON.parse(await readFile(path.join(result.output,'version.json'),'utf8')).commit,commit);
  assert.equal(await readFile(path.join(result.output,'js/incidents.js'),'utf8'),await readFile(path.join(root,'js/incidents.js'),'utf8'));
  assert((await readFile(path.join(result.output,'404.html'),'utf8')).includes('href="/style.css"'));
  assert.equal(canSkipBuild({context:'production',files:['maintenance/preparar-pages.mjs','maintenance/.gitignore','tests/pages-build.test.mjs','tests/browser/stage-one.cjs','.github/workflows/testar-permissoes.yml','docs/migracao-cloudflare-pages.md']}),true,'Preparar a migração não deve gerar publicação paga no Netlify');
});
test('cabeçalhos cobrem URLs canônicas sem duplicar Cache-Control e preservam CSP, câmera e GPS',async()=>{
  const text=pagesHeaders(await readFile(path.join(root,'_headers'),'utf8'));
  const blocks=new Map(text.trim().split(/\n\s*\n/).map(block=>{const [key,...lines]=block.split('\n');return [key,lines.join('\n')]}));
  assert(!blocks.get('/*').includes('Cache-Control'));
  for(const entry of ['/','/index','/index.html','/dashboard','/dashboard.html','/simulacao','/simulacao.html','/404','/404.html','/version.json'])assert(blocks.get(entry).includes('Cache-Control: no-store'),entry);
  for(const header of ['Content-Security-Policy:','X-Frame-Options: DENY','camera=(self)','geolocation=(self)'])assert(blocks.get('/*').includes(header),header);
  assert(blocks.get('/vendor/*').includes('max-age=86400'));
});
test('empacotamento interrompe antes de publicar recurso ausente ou link simbólico',async()=>{
  const fixture=await mkdtemp(path.join(os.tmpdir(),'nextflow-pages-test-'));
  try {
    await mkdir(path.join(fixture,'maintenance'));
    for(const file of [...rootFiles,'_headers'])await copyFile(path.join(root,file),path.join(fixture,file));
    for(const dir of ['js','lib','assets','vendor'])await cp(path.join(root,dir),path.join(fixture,dir),{recursive:true});
    await writeFile(path.join(fixture,'js','test.js'),"import './arquivo-ausente.js';");
    await assert.rejects(()=>buildPages({sourceRoot:fixture,commit}),/Recurso fora do pacote/);
    await rm(path.join(fixture,'js','test.js'));
    await symlink(path.join(root,'firebase.json'),path.join(fixture,'assets','segredo.png'));
    await assert.rejects(()=>buildPages({sourceRoot:fixture,commit}),/Link simbólico não permitido/);
  } finally {await rm(fixture,{recursive:true,force:true})}
});
