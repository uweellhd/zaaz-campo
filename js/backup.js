import { BACKUP_PROJECT, MAX_BACKUP_DOCS, MAX_BACKUP_BYTES, pack, encryptBackup } from '../lib/backup.mjs';
import { dataMedicao } from '../lib/measurements.mjs';
export function configurarBackup({root,db,services:s,uid,nome,isActive}){
 const e=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n};
 const panel=e('details');panel.className='team-panel';panel.append(e('summary','Cópia de segurança dos registros'));
 const body=e('div');body.className='team-panel-body';body.append(e('p','Baixe uma cópia protegida por senha dos registros operacionais e arquivos OTDR entregues. Fotos, logins, contas e equipes não são incluídos. A senha é escolhida só para esta cópia; não use a senha de acesso.'));
 const form=e('form');form.className='account-form';const field=(label,type)=>{const l=e('label',label),n=e('input');n.type=type;l.append(n);form.append(l);return n};
 const start=field('Abertura a partir de (opcional)','date'),end=field('Abertura até (opcional)','date'),password=field('Senha da cópia (mínimo 12 caracteres)','password'),confirm=field('Confirme a senha da cópia','password');password.required=confirm.required=true;password.minLength=confirm.minLength=12;password.maxLength=confirm.maxLength=256;password.autocomplete=confirm.autocomplete='new-password';
 const save=e('button','Baixar cópia protegida');save.type='submit';save.className='btn-sec-sm';const message=e('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');form.append(save,message);body.append(form,e('p','Guarde arquivo e senha separadamente. Sem a senha não há recuperação. A exportação é manual e não substitui backup automático. Uma restauração exige conferência administrativa; não altera nem recria contas de acesso.'));panel.append(body);root.before(panel);
 let busy=false;const before=ev=>{if(busy){ev.preventDefault();ev.returnValue=''}};window.addEventListener('beforeunload',before);
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;if(password.value!==confirm.value){message.textContent='As senhas da cópia são diferentes.';return}if(start.value&&end.value&&start.value>end.value){message.textContent='A data inicial deve ser anterior à final.';return}
  busy=true;save.disabled=true;const documents=[];let totalBytes=0;
  const push=(path,data)=>{const item={path,data:pack(data)};totalBytes+=new TextEncoder().encode(JSON.stringify(item)).length;if(documents.length>=MAX_BACKUP_DOCS||totalBytes>MAX_BACKUP_BYTES-2048)throw Error('A cópia ultrapassou o limite de 30 MiB ou 20 mil documentos. Selecione um período menor. Nenhum arquivo parcial foi baixado.');documents.push(item)};
  const guard=()=>{if(!isActive())throw Error('Sua sessão foi encerrada. A cópia foi interrompida.');if(!navigator.onLine)throw Error('Conecte-se à internet para gerar uma cópia completa.');};
  const pages=async(name,read)=>{let cursor;for(;;){guard();const snap=await s.getDocs(s.query(s.collection(db,...name.split('/')),s.orderBy(s.documentId()),...(cursor?[s.startAfter(cursor)]:[]),s.limit(100)));guard();for(const d of snap.docs)await read(d);if(snap.docs.length<100)return;cursor=snap.docs.at(-1)}};
  const selected=(date)=>{const d=date?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(date):'';return (!start.value||d>=start.value)&&(!end.value||d<=end.value)};
  try{
   message.textContent='Preparando cópia. Os registros continuam disponíveis durante a leitura.';
   const incidentIds=new Set();await pages('incidentes',async d=>{const r=d.data();if(selected(r.dataTimestamp?new Date(r.dataTimestamp):null)){push('incidentes/'+d.id,r);incidentIds.add(d.id)}});
   await pages('projetosEvidencias',async d=>{if(incidentIds.has(d.id))push('projetosEvidencias/'+d.id,d.data())});
   await pages('medicoes',async d=>{const r=d.data();if(!selected(dataMedicao(r.criadoEm)))return;push('medicoes/'+d.id,r);message.textContent=`Preparando cópia: ${documents.length} documentos conferidos…`;
    await pages(`medicoes/${d.id}/arquivos`,async f=>{const meta=f.data();if(!meta.completo||!['tx','rx'].includes(meta.lado)||meta.indice>=(r[meta.lado+'Arquivos']||0))return;push(`medicoes/${d.id}/arquivos/${f.id}`,meta);for(let i=0;i<meta.partes;i++){guard();const part=await s.getDoc(s.doc(db,'medicoes',d.id,'arquivos',f.id,'partes',String(i)));if(!part.exists())throw Error('Uma parte do arquivo não foi encontrada. Nenhuma cópia parcial será baixada.');push(`medicoes/${d.id}/arquivos/${f.id}/partes/${i}`,part.data())}});
    await pages(`medicoes/${d.id}/comprovantes`,async f=>{if(['tx','rx'].some(side=>f.id.startsWith(side)&&r[side+'Arquivos']>0))push(`medicoes/${d.id}/comprovantes/${f.id}`,f.data())});
    const check=await s.getDoc(s.doc(db,'medicoes',d.id));if(!check.exists()||JSON.stringify(pack(check.data()))!==JSON.stringify(pack(r)))throw Error('Uma medição mudou durante a cópia. Aguarde o envio terminar e tente novamente.');
   });
   guard();const payload={format:'nextflow-operacao-v1',project:BACKUP_PROJECT,createdAt:new Date().toISOString(),createdBy:{uid,nome},photosIncluded:false,authIncluded:false,atomicSnapshot:false,period:{inicio:start.value,fim:end.value},documents};
   const encrypted=await encryptBackup(payload,password.value);guard();const url=URL.createObjectURL(new Blob([encrypted],{type:'application/json'})),link=e('a');link.href=url;link.download=`NEXTFLOW-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message.textContent=`Cópia protegida gerada com ${documents.length} documentos. Fotos e contas não foram incluídas.`;password.value=confirm.value='';
  }catch(error){message.textContent=error.message||'Não foi possível gerar a cópia. Nenhum arquivo parcial foi baixado.'}finally{busy=false;save.disabled=false;documents.length=0}
 };
}
