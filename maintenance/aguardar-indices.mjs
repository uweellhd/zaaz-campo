import { readFile } from 'node:fs/promises';
import firestore from '@google-cloud/firestore';
const {v1}=firestore;
const client=new v1.FirestoreAdminClient(),config=JSON.parse(await readFile(new URL('../firestore.indexes.json',import.meta.url),'utf8'));
const expected=config.indexes.map(i=>({...i,key:JSON.stringify(i.fields)}));
try{
 for(let attempt=0;attempt<90;attempt++){
  let ready=0;
  for(const group of new Set(expected.map(i=>i.collectionGroup))){
   const [indexes]=await client.listIndexes({parent:`projects/nextflow-telecom/databases/(default)/collectionGroups/${group}`});
   for(const needed of expected.filter(i=>i.collectionGroup===group)){
    const found=indexes.find(i=>JSON.stringify(i.fields.filter(f=>f.fieldPath!=='__name__').map(f=>({fieldPath:f.fieldPath,order:f.order})))===needed.key);
    if(found?.state==='NEEDS_REPAIR'||found?.state===3)throw Error('Um índice requer reparo. A publicação do aplicativo deve aguardar.');
    if(found?.state==='READY'||found?.state===2)ready++;
   }
  }
  if(ready===expected.length){console.log(`Índices prontos: ${ready}/${expected.length}.`);process.exitCode=0;break}
  if(attempt===89)throw Error('Índices ainda em construção. Aguarde antes de integrar a alteração.');
  if(attempt%6===0)console.log(`Aguardando índices: ${ready}/${expected.length}.`);
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
}finally{await client.close()}
