import test from 'node:test';
import assert from 'node:assert/strict';
import { pack,unpack,encryptBackup,decryptBackup,validateBackup,verifyBackupFiles } from '../lib/backup.mjs';
import { identificarSupervisor } from '../lib/incident-identity.mjs';
import { criarLeitorPaginado, consultaMedicoesPaginada } from '../lib/paged-reader.mjs';
const person={nome:'Ana Souza',ativo:true,perfil:'supervisor'};
test('IXC explícito não recorre ao nome quando o número não é reconhecido, inválido ou inativo',async()=>{
 let fallback=0;const services={buscarVinculo:async()=>null,buscarPessoa:async()=>person,listarPessoas:async()=>{fallback++;return [{uid:'a',...person}]}};
 for(const id of ['x123','123']){const r=await identificarSupervisor({ixcId:id,nome:'Ana Souza'},services);assert.equal(r.identidade,null);assert.equal(r.origem,'PENDENTE');}assert.equal(fallback,0);
 const ok=await identificarSupervisor({ixcId:'123'},{...services,buscarVinculo:async()=>({supervisorUid:'a'})});assert.equal(ok.identidade.uid,'a');assert.equal(ok.origem,'IXC_ID');
 const inactive=await identificarSupervisor({ixcId:'123'},{...services,buscarVinculo:async()=>({supervisorUid:'a'}),buscarPessoa:async()=>({...person,ativo:false})});assert.equal(inactive.identidade,null);
 const exact=await identificarSupervisor({nome:'ANA SOUZA'},services);assert.equal(exact.origem,'NOME_EXATO_UNICO');
});
const payload=()=>({format:'nextflow-operacao-v1',project:'nextflow-telecom',documents:[{path:'incidentes/a',data:pack({os:'OS-1',data:new Date('2026-10-20T14:00Z'),timelineEtapas:[{fotos:['data:image/jpeg;base64,abc'],fotoIds:['f1'],descricao:'Serviço registrado'}]})}]});
test('cópia criptografada abre com senha, preserva data e rejeita alteração/senha errada',async()=>{
 const p=payload(),encrypted=await encryptBackup(p,'Senha da cópia fictícia 123');assert(!encrypted.includes('OS-1'));
 const opened=await decryptBackup(encrypted,'Senha da cópia fictícia 123');assert.deepEqual(opened,p);const data=unpack(opened.documents[0].data,(s,n)=>new Date(s*1000+n/1e6));assert.equal(data.data.toISOString(),'2026-10-20T14:00:00.000Z');assert.equal(data.timelineEtapas[0].fotos,undefined);assert.deepEqual(data.timelineEtapas[0].fotoIds,['f1']);
 await assert.rejects(decryptBackup(encrypted,'Senha incorreta 456'),/Não foi possível abrir/);const tampered=JSON.parse(encrypted);tampered.data=tampered.data.slice(0,10)+(tampered.data[10]==='A'?'B':'A')+tampered.data.slice(11);await assert.rejects(decryptBackup(JSON.stringify(tampered),'Senha da cópia fictícia 123'),/integridade/);
});
test('cópia não restaura contas, fotos, outro projeto, caminhos repetidos ou anexos órfãos',()=>{
 for(const path of ['usuarios/a','equipesTecnicas/a','fotos/a','medicoesFotos/a','identidadesIxc/a','_sistema/x'])assert.throws(()=>validateBackup({...payload(),documents:[{path,data:pack({})}]}),/caminho/);
 assert.throws(()=>validateBackup({...payload(),project:'outro'}),/projeto/);assert.throws(()=>validateBackup({...payload(),documents:[...payload().documents,...payload().documents]}),/repetido/);
 assert.throws(()=>validateBackup({...payload(),documents:[{path:'medicoes/m/arquivos/tx-0',data:pack({})}]}),/pai/);
});
test('cópia verifica presença, tamanho e SHA256 dos originais OTDR',async()=>{
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('ABC')))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const p={...payload(),documents:[{path:'medicoes/m',data:pack({txArquivos:1})},{path:'medicoes/m/arquivos/tx-0',data:pack({tamanho:3,partes:1,lado:'tx',indice:0,completo:true,sha256:hash})},{path:'medicoes/m/arquivos/tx-0/partes/0',data:pack({dados:'QUJD'})}]};await verifyBackupFiles(p);p.documents[2].data=pack({dados:'QUJE'});await assert.rejects(verifyBackupFiles(p),/integridade/);p.documents.pop();await assert.rejects(verifyBackupFiles(p),/ausente/);
});
test('paginação mantém 24 registros, navega por cursor, cancela ouvintes e ignora resposta antiga',async()=>{
 const all=Array.from({length:55},(_,n)=>({id:String(n),data:()=>({referencia:'OS-'+n})}));let stopCount=0,reads=0,states=[];
 const api={collection:()=>({}),where:()=>({}),documentId:()=>'',limit:n=>({n}),startAfter:d=>({after:d.id}),query:(base,...parts)=>({base,parts}),getDocs:async q=>{reads++;const after=q.parts.find(p=>p.after)?.after,start=after===undefined?0:+after+1;return {docs:all.slice(start,start+q.parts.find(p=>p.n).n)}},onSnapshot:()=>()=>stopCount++};
 const reader=criarLeitorPaginado({services:api,db:{},base:()=>({}),receive:s=>states.push(s)});await reader.recarregar();assert.equal(states.at(-1).rows.length,24);assert.equal(states.at(-1).hasMore,true);await reader.proxima();assert.equal(states.at(-1).page,1);assert.equal(states.at(-1).rows[0].id,'24');await reader.proxima();assert.equal(states.at(-1).rows.length,7);assert.equal(states.at(-1).hasMore,false);await reader.anterior();assert.equal(states.at(-1).rows[0].id,'24');reader.fechar();assert.equal(stopCount,8);assert.equal(reads,4);
});
test('consulta de acompanhamento aplica referência exata, período em Brasília e ordenação no servidor',()=>{
 const s={collection:()=>({}),where:(...v)=>v,orderBy:(...v)=>v,query:(b,...v)=>v};const q=consultaMedicoesPaginada(s,{}, {busca:'OS-1',estado:'SP',status:'EM_CAMPO',inicio:'2026-10-19',fim:'2026-10-20'});assert.deepEqual(q[2],['referencia','==','OS-1']);assert.equal(q[3][2].toISOString(),'2026-10-19T03:00:00.000Z');assert.equal(q[4][2].toISOString(),'2026-10-21T03:00:00.000Z');assert.deepEqual(q[5],['criadoEm','desc']);
});
import { periodoRecente,limitarAberturaIncidentes } from '../lib/query-period.mjs';
test('período inicial tem 30 dias de Brasília e recorte executivo mantém consulta de conclusão legada',()=>{
 assert.deepEqual(periodoRecente(new Date('2026-10-20T01:00Z')),{inicio:'2026-09-20',fim:'2026-10-19'});
 const base={},s={where:(...v)=>v,query:(b,...v)=>v};const filters={inicio:'2026-10-19',fim:'2026-10-20'};const q=limitarAberturaIncidentes(base,filters,s);assert.equal(q[0][2],Date.parse('2026-10-19T03:00Z'));assert.equal(q[1][2],Date.parse('2026-10-21T03:00Z'));assert.equal(limitarAberturaIncidentes(base,{...filters,baseData:'conclusao'},s),base);
});
test('resposta de página antiga não reaparece após mudar o filtro',async()=>{
 const pending=[],received=[],api={query:(q,...parts)=>({q,parts}),limit:n=>n,getDocs:()=>new Promise(resolve=>pending.push(resolve)),onSnapshot:()=>()=>{},collection:()=>({}),where:()=>({}),documentId:()=>''};
 const reader=criarLeitorPaginado({services:api,db:{},base:()=>({}),receive:s=>received.push(s)});const first=reader.recarregar(),second=reader.recarregar();pending[0]({docs:[{id:'antigo',data:()=>({})}]});await first;assert(!received.some(s=>s.rows.some(r=>r.id==='antigo')));pending[1]({docs:[{id:'novo',data:()=>({})}]});await second;assert.equal(received.at(-1).rows[0].id,'novo');reader.fechar();
});
