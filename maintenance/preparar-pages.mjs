import { readdir, readFile, writeFile, mkdir, rm, lstat, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const rootFiles = ['index.html','dashboard.html','simulacao.html','404.html','style.css','refinement.css','measurements.css','executive.css','simulacao.css','favicon.ico','logo.png'];
const directories = {js:new Set(['.js']),lib:new Set(['.mjs']),assets:new Set(['.svg','.png','.ico']),vendor:new Set(['.js','.ttf','.md','.txt'])};
const maxFileSize = 25 * 1024 * 1024;

export function pagesHeaders(original) {
  const blocks = original.trim().split(/\n\s*\n/).map(block=>block.split('\n'));
  const global = blocks.find(lines=>lines[0].trim()==='/*');
  if(!global?.some(line=>line.trim().startsWith('Content-Security-Policy:')))throw Error('Cabeçalhos de segurança não encontrados.');
  // No Pages, cabeçalhos iguais de regras diferentes são combinados. Evita dois max-age.
  const result = [ ['/*',...global.slice(1).filter(line=>!/^\s*Cache-Control:/i.test(line))].join('\n') ];
  const add = (pattern,value)=>result.push(`${pattern}\n  Cache-Control: ${value}`);
  for(const file of rootFiles.filter(file=>file.endsWith('.html'))){
    const name=file.slice(0,-5);add('/'+file,'no-store');add('/'+name,'no-store');
  }
  add('/','no-store');add('/version.json','no-store');
  for(const pattern of ['/js/*','/lib/*','/assets/*',...rootFiles.filter(file=>!file.endsWith('.html')).map(file=>'/'+file)])add(pattern,'public, max-age=0, must-revalidate');
  add('/vendor/*','public, max-age=86400, must-revalidate');
  return result.join('\n\n')+'\n';
}

async function inventory(sourceRoot) {
  const files = [...rootFiles];
  async function walk(directory,allowed) {
    const directoryStat=await lstat(path.join(sourceRoot,directory));
    if(!directoryStat.isDirectory()||directoryStat.isSymbolicLink())throw Error('Link simbólico ou pasta inválida: '+directory);
    for(const entry of await readdir(path.join(sourceRoot,directory),{withFileTypes:true})){
      const relative=directory+'/'+entry.name;
      if(entry.isSymbolicLink())throw Error('Link simbólico não permitido: '+relative);
      if(entry.isDirectory())await walk(relative,allowed);
      else if(entry.isFile()&&allowed.has(path.extname(entry.name).toLowerCase()))files.push(relative);
      else throw Error('Arquivo não previsto na publicação: '+relative);
    }
  }
  for(const [directory,allowed]of Object.entries(directories))await walk(directory,allowed);
  for(const file of files){
    const stat=await lstat(path.join(sourceRoot,file));
    if(!stat.isFile()||stat.isSymbolicLink())throw Error('Arquivo público inválido: '+file);
    if(stat.size>maxFileSize)throw Error('Arquivo acima do limite do Pages: '+file);
  }
  return files.sort();
}

function checkReferences(file,source,known) {
  const references=[];
  if(file.endsWith('.html'))for(const match of source.matchAll(/(?:src|href)=["']([^"']+)["']/g))references.push(match[1]);
  if(file.endsWith('.css'))for(const match of source.matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)/g))references.push(match[1]);
  if(file.startsWith('js/')||file.startsWith('lib/'))for(const match of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g))references.push(match[1]);
  for(const reference of references){
    if(/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference))continue;
    const clean=reference.split(/[?#]/)[0];if(!clean||clean==='/')continue;
    const target=clean.startsWith('/')?clean.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(file),clean));
    if(!known.has(target))throw Error(`Recurso fora do pacote: ${file} → ${reference}`);
  }
}

export async function buildPages({sourceRoot=repository,commit}={}) {
  sourceRoot=path.resolve(sourceRoot);
  const files=await inventory(sourceRoot),known=new Set(files),contents=new Map();
  for(const file of files){
    if(/\.(?:html|css|js|mjs)$/.test(file)){
      const content=await readFile(path.join(sourceRoot,file),'utf8');checkReferences(file,content,known);contents.set(file,content);
    }
  }
  const headers=pagesHeaders(await readFile(path.join(sourceRoot,'_headers'),'utf8'));
  commit ||= process.env.CF_PAGES_COMMIT_SHA || execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim();
  if(!/^[0-9a-f]{40}$/i.test(commit))throw Error('Commit de origem inválido.');
  const output=path.join(sourceRoot,'maintenance','pages-public');
  const maintenance=await lstat(path.dirname(output));if(!maintenance.isDirectory()||maintenance.isSymbolicLink())throw Error('Pasta de manutenção inválida.');
  const previous=await lstat(output).catch(error=>{if(error.code!=='ENOENT')throw error;return null});
  if(previous?.isSymbolicLink())throw Error('A saída não pode ser um link simbólico.');
  await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
  for(const file of files){
    const target=path.join(output,file);await mkdir(path.dirname(target),{recursive:true});
    if(file==='404.html')await writeFile(target,contents.get(file).replace('href="style.css"','href="/style.css"'));
    else await copyFile(path.join(sourceRoot,file),target);
  }
  await writeFile(path.join(output,'_headers'),headers);
  // O 404 nativo cobre os caminhos ausentes; regras 404! do Netlify não são copiadas.
  await writeFile(path.join(output,'version.json'),JSON.stringify({project:'nextflow-campo',commit},null,2)+'\n');
  return {output,files:[...files,'_headers','version.json'],commit};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await buildPages();console.log(`${result.files.length} arquivos preparados em maintenance/pages-public · commit ${result.commit}`);
}
