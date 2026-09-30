import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarFinalizacao } from '../lib/field-flow.mjs';
const foto = 'data:image/jpeg;base64,QUJD';
const duas = [{ gps: '-23.081375, -48.377929', foto }, { gps: '-23.081728, -48.377680', foto }];
test('duas caixas completas e descrição permitem finalizar', () => {
  assert.equal(avaliarFinalizacao(duas, 'Fusão realizada').valido, true);
});
test('identifica a caixa adicional sem foto e permite concluir após sua remoção', () => {
  assert.match(avaliarFinalizacao([...duas, { gps: '-23.081711, -48.377658' }], 'Reparo').mensagem, /Caixa 3/);
  assert.equal(avaliarFinalizacao(duas, 'Reparo').valido, true);
});
test('localização ou descrição ausente bloqueia conclusão', () => {
  assert.match(avaliarFinalizacao([{ ...duas[0], gps: '' }, duas[1]], 'Reparo').mensagem, /Caixa 1/);
  assert.match(avaliarFinalizacao(duas, '').mensagem, /Descreva/);
});
