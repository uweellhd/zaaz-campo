import { resolvido, etapaConcluida, previsaoValida } from './field-flow.mjs';
export const ZONA = 'America/Sao_Paulo';
export const numero = v => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
export const diaBrasil = data => new Intl.DateTimeFormat('sv-SE',{timeZone:ZONA,year:'numeric',month:'2-digit',day:'2-digit'}).format(data);
export const horarioBrasil = data => new Date(data).toLocaleString('pt-BR',{timeZone:ZONA});
export function dataConclusao(i){
  const evento=[...(i.timelineEtapas||[])].reverse().find(e=>e.numeroEtapa===4||/^ETAPA 4/.test(e.etapa||''));
  return evento?.dataHora||'';
}
export function diaConclusao(i){
  const m=String(dataConclusao(i)).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(!m)return '';
  const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));
  return d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[1] ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : '';
}
export function selecionarIncidentes(itens,filtros={},detectar=()=>'',ignorarEstado=false){
  const busca=String(filtros.supervisor||'').trim().toLocaleLowerCase('pt-BR');
  return itens.filter(i=>{
    const estado=i.estado||detectar(i.cidades||'')||'Não informado';
    if(!ignorarEstado&&filtros.estado&&filtros.estado!=='TODOS'&&estado!==filtros.estado)return false;
    if(busca&&!String(i.supervisorNome||i.responsavel||'').toLocaleLowerCase('pt-BR').includes(busca))return false;
    const ms=numero(i.dataTimestamp); const dia=ms?diaBrasil(new Date(ms)):'';
    if((filtros.inicio||filtros.fim)&&!dia)return false;
    return (!filtros.inicio||dia>=filtros.inicio)&&(!filtros.fim||dia<=filtros.fim);
  }).sort((a,b)=>numero(b.dataTimestamp)-numero(a.dataTimestamp));
}
export function analisarOperacao(itens,detectar=()=>'',agora=new Date()){
  const ativos=itens.filter(i=>!resolvido(i)), encerrados=itens.filter(resolvido);
  const estados=new Map(), supervisores=new Map(),etapas=[0,0,0,0];
  let gpon=0,backbone=0,semTecnico=0,vencidos=0,semPrevisao=0;
  for(const i of itens){
    const fechado=resolvido(i),uf=i.estado||detectar(i.cidades||'')||'Não informado';
    if(!estados.has(uf))estados.set(uf,{nome:uf,ativos:0,resolvidos:0,clientes:0});
    const e=estados.get(uf); e[fechado?'resolvidos':'ativos']++;
    const nome=i.supervisorNome||i.responsavel||'Sem supervisor'; const uid=i.supervisorUid||nome;
    if(!supervisores.has(uid))supervisores.set(uid,{nome,ativos:0,resolvidos:0,semTecnico:0,vencidos:0});
    const s=supervisores.get(uid);s[fechado?'resolvidos':'ativos']++;
    if(fechado)continue;
    if(i.tipoRede==='BACKBONE')backbone++;else{gpon+=numero(i.clientesCount);e.clientes+=numero(i.clientesCount)}
    if(!i.tecnicoUid){semTecnico++;s.semTecnico++}
    if(!previsaoValida(i.previsao))semPrevisao++;
    else if(new Date(`${i.previsao}:00-03:00`).getTime()<agora.getTime()){vencidos++;s.vencidos++}
    etapas[Math.min(3,etapaConcluida(i))]++;
  }
  const hoje=diaBrasil(agora),dias=Array.from({length:7},(_,n)=>{
    const d=new Date(`${hoje}T12:00:00-03:00`);d.setUTCDate(d.getUTCDate()-6+n);const dia=diaBrasil(d);return {dia,nome:dia.slice(8)+'/'+dia.slice(5,7),total:0};
  });let semDataConclusao=0;
  for(const i of encerrados){const dia=diaConclusao(i);if(!dia){semDataConclusao++;continue}const ponto=dias.find(d=>d.dia===dia);if(ponto)ponto.total++}
  return {total:itens.length,ativos:ativos.length,resolvidos:encerrados.length,gpon,backbone,semTecnico,vencidos,semPrevisao,semDataConclusao,etapas,dias,estados:[...estados.values()].sort((a,b)=>b.ativos-a.ativos||a.nome.localeCompare(b.nome)),supervisores:[...supervisores.values()].sort((a,b)=>b.ativos-a.ativos||b.resolvidos-a.resolvidos||a.nome.localeCompare(b.nome))};
}
export function leituraExecutiva(m){
  return [
    m.ativos?`${m.ativos} chamados estão em andamento; ${m.resolvidos} estão resolvidos no recorte selecionado.`:`Nenhum chamado ativo. O recorte contém ${m.resolvidos} registros resolvidos.`,
    m.semTecnico?`${m.semTecnico} chamados ativos aguardam a definição de um técnico responsável.`:'Todos os chamados ativos têm um técnico definido.',
    m.vencidos?`${m.vencidos} chamados ativos ultrapassaram a previsão informada; confirme a devolutiva com a supervisão.`:'Nenhuma previsão válida dos chamados ativos está vencida.',
    m.semPrevisao?`${m.semPrevisao} chamados ativos ainda não têm previsão em formato de data e hora. Isso pode ocorrer antes da chegada ao local ou em registros antigos.`:'Todos os chamados ativos possuem previsão em formato de data e hora.'
  ];
}
