import { dataMedicao, etapaMedicao } from './measurements.mjs';
import { dataConclusao, diaBrasil, horarioBrasil } from './executive-metrics.mjs';
export function asDate(v){if(!v)return null;if(v.toDate)return v.toDate();if(v instanceof Date)return Number.isFinite(+v)?v:null;if(typeof v==='number')return Number.isFinite(v)?new Date(v):null;
 const m=String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);if(m){const d=new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${(m[4]||'00').padStart(2,'0')}:${m[5]||'00'}:${m[6]||'00'}-03:00`);return !Number.isNaN(+d)&&diaBrasil(d)===`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`?d:null}return null;
}
export const dateText=v=>asDate(v)?horarioBrasil(asDate(v)):'Não registrado';
export const hours=(a,b)=>{const x=asDate(a),y=asDate(b);return x&&y&&y>=x?(y-x)/36e5:null};
export const duration=h=>h===null||!Number.isFinite(h)?'Não calculável':h<1?`${Math.round(h*60)} min`:`${Math.floor(Math.round(h*60)/60)} h ${Math.round(h*60)%60} min`;
export function median(values){const a=values.filter(v=>v!==null&&Number.isFinite(v)).sort((a,b)=>a-b);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2:null}
export const countBy=(rows,key)=>{const map=new Map();for(const r of rows){const name=key(r)||'Não informado';map.set(name,(map.get(name)||0)+1)}return [...map].map(([nome,total])=>({nome,total})).sort((a,b)=>b.total-a.total||a.nome.localeCompare(b.nome))};
export function measurementStage(r){return r.status==='AGUARDANDO_TECNICO'?'Aguardando técnico':r.status==='CONFERIDA'?'Conferida por Projetos':r.status==='ENTREGUE'?'Coleta completa / Projetos':etapaMedicao(r)===1?'POP 1 enviado / POP 2 pendente':'POP 1 pendente'}
export const ruptureEnd=r=>asDate(dataConclusao(r));
export function projectSummary(rows,type,now=new Date()){
 const done=r=>type==='medicoes'?r.status==='CONFERIDA':r.statusOzmaps==='REGISTRADO';
 const received=r=>type==='medicoes'?r.entregueEm:r.criadoEm,finished=r=>type==='medicoes'?r.conferidoEm:r.tratadoEm;
 const people=new Map();for(const r of rows){const name=done(r)?(type==='medicoes'?r.conferidoPorNome:r.tratadoPorNome):r.projetoResponsavelNome;const personUid=done(r)?(type==='medicoes'?r.conferidoPorUid:r.tratadoPorUid):r.projetoResponsavelUid;const k=personUid||name||'Sem responsável identificado';if(!people.has(k))people.set(k,{uid:personUid,nome:name||'Sem responsável identificado',pendentes:0,tratadas:0,tempos:[]});const p=people.get(k);if(done(r)){p.tratadas++;p.tempos.push(hours(received(r),finished(r)))}else p.pendentes++}
 const complete=rows.filter(done),pending=rows.filter(r=>!done(r));return {total:rows.length,complete,pending,unassigned:pending.filter(r=>!r.projetoResponsavelUid).length,people:[...people.values()],median:median(complete.map(r=>hours(received(r),finished(r)))),oldest:pending.map(r=>hours(received(r),now)).filter(v=>v!==null).length?Math.max(...pending.map(r=>hours(received(r),now)).filter(v=>v!==null)):null,done,received,finished};
}
export function projectFilter(rows,filters={},type='rompimentos'){
 const summary=projectSummary(rows,type);
 return rows.filter(r=>{
 const d=asDate(filters.baseData==='conclusao'?summary.finished(r):summary.received(r)),day=d?diaBrasil(d):'';
 return (filters.baseData!=='conclusao'||!!day)&&(!filters.estado||r.estado===filters.estado)&&(!filters.inicio||(day&&day>=filters.inicio))&&(!filters.fim||(day&&day<=filters.fim))&&(!filters.busca||[r.idIncidente,r.os,r.referencia,r.projetoResponsavelNome,r.tratadoPorNome,r.conferidoPorNome].join(' ').toLocaleLowerCase('pt-BR').includes(filters.busca.toLocaleLowerCase('pt-BR')))&&(!filters.status||(filters.status==='tratadas')===summary.done(r));
 }).sort((a,b)=>(asDate(summary.received(b))||0)-(asDate(summary.received(a))||0));
}
