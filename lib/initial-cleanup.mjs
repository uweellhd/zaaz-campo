// Autorização de 20/10/2026: somente os testes operacionais anteriores à fase 2.
// Configuração e autenticação nunca fazem parte desta lista.
export const TEST_COLLECTIONS = Object.freeze(['incidentes','fotos','projetosEvidencias','medicoes','medicoesFotos']);
export const TEST_CUTOFF = '2026-10-20T13:40:23.000Z';
export function allowedTestPath(path) {
  const p=path.split('/');
  if(p.length===2)return TEST_COLLECTIONS.includes(p[0])&&!!p[1];
  return p[0]==='medicoes' && !!p[1] && (p.length===4 && ['arquivos','comprovantes'].includes(p[2]) && !!p[3]
    || p.length===6 && p[2]==='arquivos' && !!p[3] && p[4]==='partes' && !!p[5]);
}
export function validateCleanupRows(rows, cutoff=TEST_CUTOFF) {
  if(cutoff!==TEST_CUTOFF)throw Error('Corte de autorização diferente do aprovado.');
  if(rows.length>3000)throw Error('Inventário excede o limite de 3.000 documentos. Nenhum dado foi excluído.');
  const bound=Date.parse(cutoff),seen=new Set();
  for(const row of rows){
    if(!allowedTestPath(row.path)||seen.has(row.path))throw Error('Caminho fora da lista operacional ou repetido.');
    seen.add(row.path);
    if(!Number.isFinite(row.created)||!Number.isFinite(row.updated)||row.created>bound||row.updated>bound)
      throw Error('Há dados novos ou modificados após o corte autorizado. A limpeza foi interrompida.');
  }
  return Object.fromEntries(TEST_COLLECTIONS.map(c=>[c,rows.filter(r=>r.path.split('/')[0]===c).length]));
}
