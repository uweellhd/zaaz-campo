import test from 'node:test';
import assert from 'node:assert/strict';
import { PHOTO_RETENTION_MS, parseBrazilDate, pruneLegacyPhotos } from '../lib/retention-core.mjs';

const now = new Date('2026-09-29T12:00:00-03:00').getTime();

test('parses valid Brazilian date and rejects impossible dates', () => {
  assert.equal(parseBrazilDate('14/09/2026, 12:00:00').getTime(), new Date('2026-09-14T12:00:00-03:00').getTime());
  assert.equal(parseBrazilDate('31/02/2026, 12:00:00'), null);
});

test('removes only expired image bytes and keeps timeline description', () => {
  const timeline = [
    { etapa: 'antiga', dataHora: '13/09/2026, 12:00:00', observacao: 'Reparo', fotos: ['data1', 'data2'] },
    { etapa: 'nova', dataHora: '28/09/2026, 12:00:00', observacao: 'Retorno', fotos: ['data3'] }
  ];
  const result = pruneLegacyPhotos(timeline, now);
  assert.equal(result.removed, 2);
  assert.equal(result.timeline[0].observacao, 'Reparo');
  assert.equal(result.timeline[0].fotos, undefined);
  assert.equal(result.timeline[0].fotosRemovidas, 2);
  assert.deepEqual(result.timeline[1].fotos, ['data3']);
  assert.equal(timeline[0].fotos.length, 2);
});

test('photo expires exactly 15 days after capture, unknown dates are removed', () => {
  const atLimit = '14/09/2026, 12:00:00';
  const result = pruneLegacyPhotos([
    { dataHora: atLimit, fotos: ['one'] },
    { dataHora: 'sem data', fotos: ['two'] }
  ], now);
  assert.equal(result.removed, 2);
});
