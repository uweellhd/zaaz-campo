import { resolvido } from './field-flow.mjs';

const text = value => String(value || '').slice(0,180);
export function notificationStamp(value) {
  let result=0;
  if (typeof value?.toMillis === 'function') result=value.toMillis();
  else if (value instanceof Date) result=value.getTime();
  else if (typeof value?.seconds === 'number') result=value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  else if (typeof value === 'number') result=value;
  return Number.isFinite(result)&&Math.abs(result)<=8640000000000000?result:0;
}
// Consultas para destinatários de trabalho; observadores não recebem filas globais extras.
export function notificationChannels({perfil,uid,supervisoresUids=[]}) {
  const channels=[];
  const add=(key,collection,filters=[])=>channels.push({key,collection,filters});
  if(perfil==='admin')add('acessos','solicitacoesAcesso',[['status','==','pendente']]);
  if(['admin','tecnico'].includes(perfil)){
    add('tecnico-rompimentos','incidentes',[['tecnicoUid','==',uid]]);
    add('tecnico-medicoes','medicoes',[['tecnicoUid','==',uid],['status','==','EM_CAMPO']]);
  }
  if(perfil==='supervisor'){
    add('supervisao-rompimentos','incidentes',[['supervisorUid','==',uid]]);
    add('supervisao-medicoes','medicoes',[['supervisorUid','==',uid]]);
  }
  if(perfil==='coordenador'){
    const scope=[...new Set(supervisoresUids.filter(v=>typeof v==='string'&&v))].slice(0,30);
    if(scope.length){
      add('coordenacao-rompimentos','incidentes',[['supervisorUid','in',scope]]);
      add('coordenacao-medicoes','medicoes',[['supervisorUid','in',scope]]);
    }
  }
  if(['projetos','coordenador_projetos'].includes(perfil)){
    add('projetos-rompimentos','projetosEvidencias',[['statusOzmaps','==','PENDENTE']]);
    add('projetos-medicoes','medicoes',[['status','==','ENTREGUE']]);
  }
  return channels;
}
export function notificationEvents(channel,rows,{perfil,uid,supervisoresUids=[]}) {
  const events=[];
  for(const row of rows){
    const id=String(row.id||''),med=channel.endsWith('medicoes'),service=med?'medicoes':'rompimentos';
    if(!id)continue;
    const reference=med?text(row.referencia):`ID ${text(row.idIncidente||row.os||id)}`;
    let title,detail,view,stamp,revision;
    if(channel==='acessos'){
      if(perfil!=='admin'||row.status!=='pendente')continue;
      title='Novo pedido de acesso';detail=text(row.nome)||'Colaborador aguardando aprovação';view='viewAcessos';stamp=notificationStamp(row.criadoEm);revision=stamp;
    }else if(channel.startsWith('tecnico-')){
      if(!['admin','tecnico'].includes(perfil)||row.tecnicoUid!==uid||(med?row.status!=='EM_CAMPO':resolvido(row)))continue;
      title=med?'Medição atribuída a você':'Rompimento atribuído a você';detail=reference;view='viewTech';stamp=notificationStamp(row.atribuidoEm||row.criadoEm||row.dataTimestamp);revision=stamp;
    }else if(channel.startsWith('supervisao-')||channel.startsWith('coordenacao-')){
      const coord=channel.startsWith('coordenacao-');
      if(coord?(perfil!=='coordenador'||!supervisoresUids.includes(row.supervisorUid)):(perfil!=='supervisor'||row.supervisorUid!==uid))continue;
      if(med?!['AGUARDANDO_TECNICO','EM_CAMPO'].includes(row.status):resolvido(row))continue;
      title=med?'Medição recebida na supervisão':'Rompimento recebido na supervisão';detail=reference;view=coord?(med?'viewMedicoes':'viewGerente'):'viewSupervisor';stamp=notificationStamp(row.criadoEm||row.dataTimestamp);revision=stamp;
    }else if(channel.startsWith('projetos-')){
      if(!['projetos','coordenador_projetos'].includes(perfil)||(med?row.status!=='ENTREGUE':row.statusOzmaps!=='PENDENTE'))continue;
      if(perfil==='projetos'&&row.projetoResponsavelUid&&row.projetoResponsavelUid!==uid)continue;
      title=row.projetoResponsavelUid===uid?'Tratamento atribuído a você':med?'Medição entregue a Projetos':'Rompimento entregue a Projetos';detail=reference;view='viewProjetos';stamp=notificationStamp(row.projetoAtribuidoEm||row.entregueEm||row.criadoEm);revision=`${stamp}:${text(row.projetoResponsavelUid)}`;
    }else continue;
    events.push({key:`${channel}:${id}:${revision}`,channel,id,title,detail,view,service,stamp});
  }
  return events;
}
// Somente chaves de avisos dispensados são persistidas; nomes e conteúdo ficam em memória.
export function createNotificationState(dismissed=[]) {
  const channels=new Map(),initialized=new Set();let version=0,hidden=new Set(dismissed.filter(v=>typeof v==='string').slice(-2000));
  const list=()=>[...channels.values()].flatMap(m=>[...m.values()]).filter(e=>!hidden.has(e.key)).sort((a,b)=>b.stamp-a.stamp||a.key.localeCompare(b.key)).slice(0,100);
  return {
    update(channel,events,{silent=false}={}){
      const before=channels.get(channel)||new Map(),next=new Map(events.map(e=>[e.key,e]));
      const fresh=initialized.has(channel)&&!silent?events.filter(e=>!before.has(e.key)&&!hidden.has(e.key)):[];
      const changed=before.size!==next.size||events.some(e=>{const old=before.get(e.key);return !old||old.title!==e.title||old.detail!==e.detail||old.stamp!==e.stamp});
      channels.set(channel,next);if(changed)version++;initialized.add(channel);return fresh;
    },
    list,
    version:()=>version,
    dismiss(keys){for(const key of keys)hidden.add(key);hidden=new Set([...hidden].slice(-2000));},
    dismissed:()=>[...hidden],
    restore(keys){hidden=new Set((Array.isArray(keys)?keys:[]).filter(v=>typeof v==='string').slice(-2000));},
    clear(){channels.clear();initialized.clear();hidden.clear();}
  };
}
