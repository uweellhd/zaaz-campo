import { readFile } from 'node:fs/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { TEST_COLLECTIONS, TEST_CUTOFF, allowedTestPath, validateCleanupRows } from '../lib/initial-cleanup.mjs';

const config=JSON.parse(await readFile(new URL('./limpeza-inicial.json',import.meta.url),'utf8'));
const apply=process.argv.includes('--aplicar');
if(config.id!=='fase2-2026-10-20'||config.projectId!=='nextflow-telecom'||config.cutoff!==TEST_CUTOFF||config.enabled!==true)throw Error('Configuração da limpeza não autorizada.');
const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'null');
if(account?.project_id!==config.projectId)throw Error('Credencial ausente ou de outro projeto.');
initializeApp({credential:cert(account),projectId:config.projectId});
const db=getFirestore(),audit=db.doc('_sistema/limpezaInicialFase2');
if((await audit.get()).data()?.concluida===true){console.log('Limpeza inicial já concluída; nenhuma nova exclusão.');process.exit(0)}
const rows=[];
let scanned=0;
async function inventory(col){
  // listDocuments também inclui pais ausentes com subcoleções órfãs.
  const refs=await col.listDocuments();
  if(refs.length>3000||scanned+refs.length>3000)throw Error('Limite do inventário excedido.');
  scanned+=refs.length;
  for(let i=0;i<refs.length;i+=100){
    const snaps=await db.getAll(...refs.slice(i,i+100));
    for(const s of snaps){
      if(!allowedTestPath(s.ref.path))throw Error('Subcoleção não prevista. Limpeza interrompida.');
      if(s.exists)rows.push({path:s.ref.path,created:s.createTime.toMillis(),updated:s.updateTime.toMillis(),version:s.updateTime});
      for(const child of await s.ref.listCollections())await inventory(child);
    }
  }
}
for(const c of TEST_COLLECTIONS)await inventory(db.collection(c));
const counts=validateCleanupRows(rows,config.cutoff);
console.log(JSON.stringify({modo:apply?'aplicar':'inventario',corte:config.cutoff,documentos:rows.length,porColecao:counts}));
if(apply){
  // Primeiro revalida todo o inventário; cada delete ainda exige a mesma updateTime.
  for(let i=0;i<rows.length;i+=100){
    const current=await db.getAll(...rows.slice(i,i+100).map(r=>db.doc(r.path)));
    for(let n=0;n<current.length;n++)if(!current[n].exists||!current[n].updateTime.isEqual(rows[i+n].version))throw Error('Um registro mudou durante o inventário. Nenhuma exclusão iniciada.');
  }
  // Filhos antes dos pais; uma falha permite retomar apenas o que ainda existir.
  rows.sort((a,b)=>b.path.split('/').length-a.path.split('/').length);
  for(let i=0;i<rows.length;i+=200){
    const batch=db.batch();for(const r of rows.slice(i,i+200))batch.delete(db.doc(r.path),{lastUpdateTime:r.version});await batch.commit();
  }
  const deleted=rows.length;rows.length=0;scanned=0;
  for(const c of TEST_COLLECTIONS)await inventory(db.collection(c));
  if(rows.length)throw Error('Existem novos registros. Exclusões anteriores concluídas, mas requer conferência; não será feita limpeza adicional.');
  await audit.set({id:config.id,concluida:true,corte:config.cutoff,finalizadaEm:Timestamp.now(),quantidades:counts,total:deleted});
  console.log(JSON.stringify({concluida:true,excluidos:deleted,colecoesOperacionaisVazias:true,contasEquipesPermissoesPreservadas:true}));
}
