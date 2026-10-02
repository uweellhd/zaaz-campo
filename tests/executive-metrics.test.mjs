import test from 'node:test';import assert from 'node:assert/strict';
import {analisarOperacao,selecionarIncidentes,diaBrasil,diaConclusao} from '../lib/executive-metrics.mjs';
const agora=new Date('2026-10-02T15:00:00Z');
const dados=[
 {estado:'SP',dataTimestamp:Date.parse('2026-10-02T02:30:00Z'),supervisorUid:'a',supervisorNome:'Ana',clientesCount:50,previsao:'2026-10-02T11:00',etapaConcluida:2},
 {estado:'SP',dataTimestamp:Date.parse('2026-10-02T13:00:00Z'),supervisorUid:'a',supervisorNome:'Ana',clientesCount:25,previsao:'2026-10-02T17:00',tecnicoUid:'t',etapaConcluida:3},
 {estado:'MG',dataTimestamp:Date.parse('2026-10-02T13:00:00Z'),supervisorUid:'b',supervisorNome:'Ana',tipoRede:'BACKBONE',clientesCount:300,previsao:'2h',tecnicoUid:'t',etapaConcluida:1},
 {estado:'SP',dataTimestamp:Date.parse('2026-10-01T13:00:00Z'),supervisorUid:'a',supervisorNome:'Ana',clientesCount:100,etapaConcluida:4,timelineEtapas:[{numeroEtapa:4,dataHora:'02/10/2026, 10:00:00'}]},
 {estado:'PR',statusAtual:'RESOLVIDO',timelineEtapas:[]}
];
test('indicadores consideram somente ativos para impacto, fila e previsões, mantendo todos os resolvidos',()=>{const m=analisarOperacao(dados,()=>'',agora);assert.equal(m.ativos,3);assert.equal(m.resolvidos,2);assert.equal(m.gpon,75);assert.equal(m.backbone,1);assert.equal(m.semTecnico,1);assert.equal(m.vencidos,1);assert.equal(m.semPrevisao,1);assert.deepEqual(m.etapas,[0,1,1,1]);assert.equal(m.dias.at(-1).total,1);assert.equal(m.semDataConclusao,1);assert.equal(m.supervisores.length,3)});
test('recorte de abertura usa dia em Brasília e preserva ativos e resolvidos',()=>{assert.equal(diaBrasil(new Date('2026-10-02T02:30:00Z')),'2026-10-01');const ids=selecionarIncidentes(dados,{inicio:'2026-10-01',fim:'2026-10-01',estado:'SP',supervisor:'ANA'});assert.equal(ids.length,2);assert(ids.some(i=>i.etapaConcluida===4));assert.equal(selecionarIncidentes(dados,{inicio:'2026-10-02',fim:'2026-10-02'}).length,2)});
test('data antiga sem horário válido não entra na série nem é previsão vencida',()=>{assert.equal(diaConclusao({timelineEtapas:[{numeroEtapa:4,dataHora:'31/02/2026'}]}),'');const m=analisarOperacao([{clientesCount:-10,previsao:'qualquer',statusAtual:'ABERTO'}],()=>'',agora);assert.equal(m.gpon,0);assert.equal(m.vencidos,0);assert.equal(m.semPrevisao,1)});
