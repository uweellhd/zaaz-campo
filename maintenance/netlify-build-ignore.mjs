import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export function canSkipBuild({context,files,hasBase=true}) {
  if(['deploy-preview','branch-deploy'].includes(context))return true;
  // Se não conseguimos comparar com o último deploy, publicamos por segurança.
  if(!hasBase||!Array.isArray(files))return false;
  return files.every(f=>/^(docs\/|tests\/|\.github\/|maintenance\/|firestore\.(rules|indexes\.json)$|firebase(?:\.test)?\.json$)/.test(f)||/^[^/]+\.md$/i.test(f));
}
export function decide(env=process.env,readDiff=(base,head)=>execFileSync('git',['diff','--name-only','-z',base,head],{encoding:'utf8'}).split('\0').filter(Boolean)) {
  if(['deploy-preview','branch-deploy'].includes(env.CONTEXT))return 0;
  const valid=v=>/^[0-9a-f]{7,40}$/i.test(v||'');
  if(!valid(env.CACHED_COMMIT_REF)||!valid(env.COMMIT_REF))return 1;
  try{return canSkipBuild({context:env.CONTEXT,files:readDiff(env.CACHED_COMMIT_REF,env.COMMIT_REF)})?0:1}catch{return 1}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=decide();console.log(result===0?'Sem publicação necessária: prévia ou alteração interna.':'Publicar lote: há alterações no site ou comparação indisponível.');process.exitCode=result;
}
