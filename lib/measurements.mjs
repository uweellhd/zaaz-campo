// Contrato compartilhado de Medições. PDFs e arquivos nativos são preservados, sem interpretar curvas.
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const CHUNK_BYTES = 512 * 1024;
export const MAX_FILES_DIRECTION = 3;
export const MAX_PHOTOS_DIRECTION = 6;
export const ESTADOS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const STATUS = { AGUARDANDO_TECNICO:'Aguardando técnico', EM_CAMPO:'Em campo', ENTREGUE:'Aguardando Projetos', CONFERIDA:'Conferida por Projetos' };
export function validarArquivo(file) {
  if (!/\.(pdf|sor|msor|trc|iolm)$/i.test(file.name || '')) return 'Use PDF ou arquivo .sor, .msor, .trc ou .iolm do equipamento.';
  if (!file.size || file.size > MAX_FILE_BYTES) return 'Cada arquivo deve ter conteúdo e no máximo 2 MiB neste piloto.';
  if (file.name.length > 180) return 'Renomeie o arquivo para até 180 caracteres.';
  return '';
}
export function gpsValido(gps) { return gps && Number.isFinite(gps.latitude) && Math.abs(gps.latitude)<=90 && Number.isFinite(gps.longitude) && Math.abs(gps.longitude)<=180; }
export function validarEntrega(data) {
  if (!data.observacao?.trim() || data.observacao.trim().length>3000) return 'Descreva a medição realizada (até 3.000 caracteres).';
  for (const d of ['tx','rx']) {
    if (!gpsValido(data[d]?.gps)) return `Capture a localização de ${d==='tx'?'POP 1':'POP 2'}.`;
    if (!data[d].fotos?.length || data[d].fotos.length>6) return `Anexe de 1 a 6 fotos de ${d==='tx'?'POP 1':'POP 2'}.`;
    if (!data[d].arquivos?.length || data[d].arquivos.length>3) return `Anexe de 1 a 3 arquivos de ${d==='tx'?'POP 1':'POP 2'}.`;
    for(const file of data[d].arquivos) { const erro=validarArquivo(file); if(erro)return erro; }
  }
  return '';
}
// As chaves históricas tx/rx são mantidas apenas no armazenamento para compatibilidade.
export const nomePOP = side => side === 'tx' ? 'POP 1' : 'POP 2';
export function etapaMedicao(record) { return ['ENTREGUE','CONFERIDA'].includes(record.status) ? 2 : record.etapaConcluida === 1 ? 1 : 0; }
export function situacaoMedicao(record) { return record.status === 'EM_CAMPO' ? (etapaMedicao(record) === 1 ? 'POP 1 enviado · aguardando POP 2' : 'POP 1 · em andamento') : STATUS[record.status]; }
export function fibrasMedicao(record) { return record.fibrasPop1||record.fibrasPop2 ? `POP 1: ${record.fibrasPop1||'Não informadas'} / POP 2: ${record.fibrasPop2||'Não informadas'}` : record.fibras||'Ainda não identificadas'; }
export function validarEtapaMedicao(data,etapa) {
  if(![1,2].includes(etapa))return 'Etapa inválida. Reabra a medição.';
  const side=etapa===1?'tx':'rx',pop=nomePOP(side),d=data[side];
  if(!gpsValido(d?.gps))return `Capture a localização do ${pop}.`;
  if(!d.fotos?.length||d.fotos.length>6)return `Anexe de 1 a 6 fotos do ${pop}.`;
  if(!d.arquivos?.length||d.arquivos.length>3)return `Anexe de 1 a 3 arquivos do ${pop}.`;
  for(const file of d.arquivos){const erro=validarArquivo(file);if(erro)return erro}
  if(!data.observacao?.trim()||data.observacao.trim().length>3000)return `Descreva a medição do ${pop} (até 3.000 caracteres).`;
  if((data.fibras||'').length>300)return 'Identifique as fibras em até 300 caracteres.';
  return '';
}
export async function sha256(buffer) { const hash=await globalThis.crypto.subtle.digest('SHA-256',buffer);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
export function codificar(bytes) { let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s); }
export function decodificar(base64) { return Uint8Array.from(atob(base64),c=>c.charCodeAt(0)); }
export function dataMedicao(v) { return v?.toDate?.() || (v instanceof Date?v:null); }
export function filtrarMedicoes(rows,f={}) {
  return rows.filter(r=>{const date=dataMedicao(r.criadoEm);const dia=date?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(date):'';return (!f.estado||r.estado===f.estado)&&(!f.status||r.status===f.status)&&(!f.inicio||(dia&&dia>=f.inicio))&&(!f.fim||(dia&&dia<=f.fim))&&(!f.busca||[r.referencia,r.cidade,r.pontoA,r.pontoB,r.tecnicoNome,r.fibras,r.fibrasPop1,r.fibrasPop2].join(' ').toLocaleLowerCase('pt-BR').includes(f.busca.toLocaleLowerCase('pt-BR')))}).sort((a,b)=>(dataMedicao(b.criadoEm)?.getTime()||0)-(dataMedicao(a.criadoEm)?.getTime()||0));
}
export function analisarMedicoes(rows) {
  const aguardando=rows.filter(r=>r.status==='AGUARDANDO_TECNICO').length,emCampo=rows.filter(r=>r.status==='EM_CAMPO').length;
  const total=rows.length,conferidas=rows.filter(r=>r.status==='CONFERIDA').length,entregues=rows.filter(r=>r.status==='ENTREGUE').length;
  const estados=ESTADOS.map(estado=>({estado,total:rows.filter(r=>r.estado===estado).length,conferidas:rows.filter(r=>r.estado===estado&&r.status==='CONFERIDA').length})).filter(r=>r.total);
  return {total,conferidas,entregues,aguardando,emCampo,conclusao:total?Math.round(conferidas/total*100):0,estados,arquivos:rows.reduce((n,r)=>n+(r.txArquivos||0)+(r.rxArquivos||0),0)};
}
