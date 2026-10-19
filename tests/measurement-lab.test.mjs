import {test} from 'node:test';
import assert from 'node:assert/strict';
import {criarBancoMedicoesLaboratorio} from '../lib/measurement-lab.mjs';
test('laboratório preserva equipes e fila na memória; reiniciar remove somente dados fictícios',async()=>{
  const b=criarBancoMedicoesLaboratorio(),a=b.api;
  assert.equal(b.registros().length,2);
  assert.equal((await a.getDocs(a.query(a.collection({},'medicoes'),a.where('tecnicoUid','==','tecnicoA')))).size,0);
  const mine=await a.getDocs(a.query(a.collection({},'medicoes'),a.where('supervisorUid','==','supervisorA')));assert.equal(mine.size,1);
  const ref=a.doc({},'medicoes','nova');await a.setDoc(ref,{supervisorUid:'supervisorA',status:'AGUARDANDO_TECNICO'});assert.equal(b.registros().length,3);
  b.reiniciar();assert.equal(b.registros().length,2);assert.equal((await a.getDoc(ref)).exists(),false);
});
test('falha fictícia impede a gravação e libera tentativa seguinte, sem backend externo',async()=>{
  const b=criarBancoMedicoesLaboratorio(),a=b.api,ref=a.doc({},'medicoes','sim-med-1');b.falharProximoEnvio();
  await assert.rejects(a.updateDoc(ref,{status:'EM_CAMPO',tecnicoUid:'tecnicoA'}),/Falha de envio simulada/);
  assert.equal((await a.getDoc(ref)).data().status,'AGUARDANDO_TECNICO');
  await a.updateDoc(ref,{status:'EM_CAMPO',tecnicoUid:'tecnicoA'});
  assert.equal((await a.getDocs(a.query(a.collection({},'medicoes'),a.where('tecnicoUid','==','tecnicoA')))).size,1);
});
