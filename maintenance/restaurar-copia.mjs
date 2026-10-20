// Sem --aplicar: apenas confere. Nunca sobrescreve documentos e nunca altera Auth.
import { readFile } from 'node:fs/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { decryptBackup, unpack, BACKUP_PROJECT } from '../lib/backup.mjs';
const args=process.argv.slice(2),file=args.find(x=>!x.startsWith('--'));
if(!file)throw Error('Informe o arquivo da cópia. A senha deve estar em NEXTFLOW_BACKUP_PASSWORD, não na linha de comando.');
const emulator=args.includes('--emulador'),apply=args.includes('--aplicar');
const payload=await decryptBackup(await readFile(file,'utf8'),process.env.NEXTFLOW_BACKUP_PASSWORD);
if(emulator){if(!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Emulador local não configurado.');initializeApp({projectId:'demo-nextflow-security'});}
else{if(!args.includes('--projeto=nextflow-telecom'))throw Error('Confirme o projeto com --projeto=nextflow-telecom.');const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'null');if(account?.project_id!==BACKUP_PROJECT)throw Error('Credencial administrativa ausente ou de outro projeto.');initializeApp({credential:cert(account),projectId:BACKUP_PROJECT});}
const db=getFirestore(),rows=payload.documents.map(d=>({...d,decoded:unpack(d.data,(s,n)=>new Timestamp(s,n))}));
// Todas as validações acontecem antes do primeiro write. Configurações/contas não são caminhos válidos.
for(let i=0;i<rows.length;i+=100){const existing=await db.getAll(...rows.slice(i,i+100).map(d=>db.doc(d.path)));if(existing.some(d=>d.exists))throw Error('Há documentos com os mesmos IDs no destino. Nenhum dado foi sobrescrito ou excluído.');}
console.log(JSON.stringify({simulacao:!apply,projeto:emulator?'demo-nextflow-security':BACKUP_PROJECT,documentos:rows.length,fotos:false,contas:false}));
if(apply){
 rows.sort((a,b)=>a.path.split('/').length-b.path.split('/').length);
 let batch=db.batch(),size=0,count=0;
 for(const row of rows){const cost=Buffer.byteLength(JSON.stringify(row.data));if(count&&(size+cost>4*1024*1024||count>=200)){await batch.commit();batch=db.batch();size=0;count=0}batch.create(db.doc(row.path),row.decoded);size+=cost;count++;}
 if(count)await batch.commit();
 for(let i=0;i<rows.length;i+=100){const snapshots=await db.getAll(...rows.slice(i,i+100).map(d=>db.doc(d.path)));if(snapshots.some(d=>!d.exists))throw Error('A conferência após restauração falhou.');}
 console.log(JSON.stringify({restaurados:rows.length,semSobrescrita:true,fotos:false,contas:false}));
}
