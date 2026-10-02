import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarFinalizacao, avaliarEtapa, etapaConcluida, exigirProximaEtapa, modeloDescricao, previsaoValida, formatarPrevisao } from '../lib/field-flow.mjs';
const foto = 'data:image/jpeg;base64,QUJD';
const descricao = 'CAUSA: Obra\n\nSOLUÇÃO: Fusão realizada\n\nOBSERVAÇÃO: Sem observações adicionais';
const duas = [{ gps:'-23.081375, -48.377929', fotos:[foto,foto] }, { gps:'-23.081728, -48.377680', fotos:[foto] }];
test('duas caixas com várias fotos e roteiro completo permitem finalizar',()=>assert.equal(avaliarFinalizacao(duas,descricao).valido,true));
test('caixa extra sem foto ou GPS impede finalizar; limite por caixa é seis',()=>{
 assert.match(avaliarFinalizacao([...duas,{gps:'-23.081711, -48.377658'}],descricao).mensagem,/Caixa 3/);
 assert.match(avaliarFinalizacao([{...duas[0],gps:''},duas[1]],descricao).mensagem,/Caixa 1/);
 assert.equal(avaliarFinalizacao([{...duas[0],fotos:Array(7).fill(foto)},duas[1]],descricao).valido,false);
});
test('roteiro com títulos vazios ou solução ausente impede finalizar',()=>{
 for(const texto of ['',modeloDescricao('Obra'),'CAUSA: Obra\nSOLUÇÃO:\nOBSERVAÇÃO: Nada','Reparo']) assert.equal(avaliarFinalizacao(duas,texto).valido,false);
});
test('uma foto de chegada não substitui a obrigatória de rompimento',()=>{
 const dados={fotos:{fotoChegada:[foto,foto]},causa:'Obra',previsao:'2026-10-02T18:00'};
 assert.match(avaliarEtapa(2,dados).mensagem,/rompimento/);
 assert.equal(avaliarEtapa(2,{...dados,fotos:{...dados.fotos,fotoRompimento:[foto]}}).valido,true);
});
test('etapa 3 usa uma observação e valida data e hora da revisão',()=>{
 const fotos={fotoPanoramica:[foto],fotoEquipe:[foto]};
 assert.equal(avaliarEtapa(3,{fotos,observacao:''}).valido,false);
 assert.equal(avaliarEtapa(3,{fotos,observacao:'Fusionando'}).valido,true);
 assert.equal(avaliarEtapa(3,{fotos,observacao:'Fusionando',novaPrevisao:'2026-10-01T19:00'}).valido,true);
 assert.equal(avaliarEtapa(3,{fotos,observacao:'Fusionando',novaPrevisao:'2026-10-01T19:00',motivoPrevisao:'Chuva'}).valido,true);
});
test('a próxima etapa é única, inclusive ao reabrir um ID antigo ou transferido',()=>{
 const item={etapaConcluida:2}; assert.doesNotThrow(()=>exigirProximaEtapa(item,3));
 for(const etapa of [1,2,4])assert.throws(()=>exigirProximaEtapa(item,etapa));
 assert.equal(etapaConcluida({timelineEtapas:[{etapa:'ETAPA 2: ANTIGA'}]}),2);
 assert.throws(()=>exigirProximaEtapa({etapaConcluida:4},4));
});

test('previsão só aceita data e hora completas, sem números soltos ou datas impossíveis',()=>{
 for(const valor of ['1','2 horas','18:00','2026-02-30T18:00','2026-10-01T25:00','2026-10-01T18:90'])assert.equal(previsaoValida(valor),false);
 assert.equal(previsaoValida('2026-10-02T18:00'),true);
 assert.match(formatarPrevisao('2026-10-02T18:00'),/02\/10\/2026.*18:00/);
});
