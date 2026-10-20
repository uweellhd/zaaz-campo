import test from 'node:test';
import assert from 'node:assert/strict';
import { criarConsultasCompartilhadas } from '../lib/live-queries.mjs';
import { allowedTestPath, validateCleanupRows, TEST_CUTOFF } from '../lib/initial-cleanup.mjs';
test('consultas equivalentes compartilham rede, repetem snapshot e liberam somente após último cliente',()=>{
 let receive,fail,opens=0,closes=0;
 const hub=criarConsultasCompartilhadas((ref,ok,error)=>{opens++;receive=ok;fail=error;return()=>closes++},(a,b)=>a===b);
 const a=[],b=[];const stopA=hub.ouvir('equipeA',s=>a.push(s));receive(1);const stopB=hub.ouvir('equipeA',s=>b.push(s));assert.equal(opens,1);assert.deepEqual(b,[1]);receive(2);stopA();receive(3);assert.deepEqual(a,[1,2]);assert.deepEqual(b,[1,2,3]);assert.equal(closes,0);stopB();stopB();assert.equal(closes,1);
 const failures=[];hub.ouvir('equipeB',()=>{},e=>failures.push(e));fail('revogado');assert.deepEqual(failures,['revogado']);hub.ouvir('equipeB',()=>{});assert.equal(opens,3);hub.fechar();
});
test('escopos diferentes nunca compartilham consulta nem snapshot',()=>{
 const calls=[];const hub=criarConsultasCompartilhadas((ref,ok)=>{calls.push(ref);ok(ref);return()=>{}},(a,b)=>a===b);let own,other;hub.ouvir('supervisorA',r=>own=r);hub.ouvir('supervisorB',r=>other=r);assert.deepEqual(calls,['supervisorA','supervisorB']);assert.notEqual(own,other);hub.fechar();
});
test('limpeza permite só as cinco coleções operacionais e anexos conhecidos',()=>{
 for(const p of ['incidentes/a','fotos/f','projetosEvidencias/a','medicoes/m','medicoes/m/arquivos/tx-0','medicoes/m/arquivos/tx-0/partes/0','medicoes/m/comprovantes/txFotos','medicoesFotos/m'])assert(allowedTestPath(p),p);
 for(const p of ['usuarios/a','solicitacoesAcesso/a','equipesTecnicas/a','identidadesIxc/a','_sistema/a','medicoes/m/usuarios/a','incidentes/a/dados/b'])assert(!allowedTestPath(p),p);
});
test('limpeza interrompe antes de excluir se houver dados recentes, corte alterado ou volume inesperado',()=>{
 const old={path:'incidentes/a',created:Date.parse(TEST_CUTOFF)-100,updated:Date.parse(TEST_CUTOFF)-10};assert.equal(validateCleanupRows([old]).incidentes,1);
 assert.throws(()=>validateCleanupRows([{...old,updated:Date.parse(TEST_CUTOFF)+1}]),/dados novos/);
 assert.throws(()=>validateCleanupRows([{...old,created:NaN}]),/dados novos/);
 assert.throws(()=>validateCleanupRows([{...old,path:'usuarios/a'}]),/fora da lista/);
 assert.throws(()=>validateCleanupRows([old,old]),/repetido/);
 assert.throws(()=>validateCleanupRows([],'2030-01-01'),/Corte/);
 assert.throws(()=>validateCleanupRows(Array(3001).fill(old)),/limite/);
});
import { mapearComLimite, validarVolumePDF } from '../lib/async-work.mjs';
import { filtrarMedicoes, analisarMedicoes } from '../lib/measurements.mjs';
test('enriquecimento respeita quatro leituras simultâneas, ordem e falhas',async()=>{
 let active=0,max=0;
 const rows=await mapearComLimite(Array.from({length:15},(_,i)=>i),async n=>{max=Math.max(max,++active);await new Promise(r=>setTimeout(r,n%3));active--;return n*2});
 assert(max<=4);assert.deepEqual(rows,Array.from({length:15},(_,i)=>i*2));
 await assert.rejects(mapearComLimite([1,2,3],async()=>{throw Error('sem conexão')}),/sem conexão/);
 assert.throws(()=>validarVolumePDF(Array(501)),/Nenhum registro foi omitido/);validarVolumePDF(Array(500));
});
test('9 mil metadados mantêm contagem completa, busca e recorte de Brasília',()=>{
 const rows=Array.from({length:9000},(_,n)=>({referencia:'OS-'+n,estado:n%2?'SP':'MG',status:n%2?'EM_CAMPO':'CONFERIDA',criadoEm:new Date('2026-10-20T01:00Z')}));
 const filtered=filtrarMedicoes(rows,{inicio:'2026-10-19',fim:'2026-10-19'}),m=analisarMedicoes(filtered);
 assert.equal(m.total,9000);assert.equal(m.conferidas,4500);assert.equal(m.emCampo,4500);assert.equal(m.estados.length,2);
 assert.equal(filtrarMedicoes(rows,{busca:'OS-8999',estado:'SP'}).length,1);assert.equal(filtrarMedicoes(rows,{inicio:'2026-10-20'}).length,0);
});
