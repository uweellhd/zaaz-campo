// Contrato compartilhado de Medições. Os arquivos nativos são preservados, sem interpretar curvas.
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const CHUNK_BYTES = 512 * 1024;
export const MAX_FILES_DIRECTION = 3;
export const MAX_PHOTOS_DIRECTION = 6;
export const ESTADOS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const STATUS = { EM_CAMPO:'Em campo', ENTREGUE:'Aguardando Projetos', CONFERIDA:'Conferida por Projetos' };
export function validarArquivo(file) {
  if (!/\.(sor|msor|trc|iolm)$/i.test(file.name || '')) return 'Use o arquivo original .sor, .msor, .trc ou .iolm do equipamento.';
  if (!file.size || file.size > MAX_FILE_BYTES) return 'Cada arquivo deve ter conteúdo e no máximo 2 MiB neste piloto.';
  if (file.name.length > 180) return 'Renomeie o arquivo para até 180 caracteres.';
  return '';
}
export function gpsValido(gps) { return gps && Number.isFinite(gps.latitude) && Math.abs(gps.latitude)<=90 && Number.isFinite(gps.longitude) && Math.abs(gps.longitude)<=180; }
export function validarEntrega(data) {
  if (!data.observacao?.trim() || data.observacao.trim().length>3000) return 'Descreva a medição realizada (até 3.000 caracteres).';
  for (const d of ['tx','rx']) {
    if (!gpsValido(data[d]?.gps)) return `Capture a localização de ${d.toUpperCase()}.`;
    if (!data[d].fotos?.length || data[d].fotos.length>6) return `Anexe de 1 a 6 fotos de ${d.toUpperCase()}.`;
    if (!data[d].arquivos?.length || data[d].arquivos.length>3) return `Anexe de 1 a 3 arquivos nativos de ${d.toUpperCase()}.`;
    for(const file of data[d].arquivos) { const erro=validarArquivo(file); if(erro)return erro; }
  }
  return '';
}
export async function sha256(buffer) { const hash=await globalThis.crypto.subtle.digest('SHA-256',buffer);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
export function codificar(bytes) { let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s); }
export function decodificar(base64) { return Uint8Array.from(atob(base64),c=>c.charCodeAt(0)); }
export function dataMedicao(v) { return v?.toDate?.() || (v instanceof Date?v:null); }
export function filtrarMedicoes(rows,f={}) {
  return rows.filter(r=>{const date=dataMedicao(r.criadoEm);const dia=date?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(date):'';return (!f.estado||r.estado===f.estado)&&(!f.status||r.status===f.status)&&(!f.inicio||(dia&&dia>=f.inicio))&&(!f.fim||(dia&&dia<=f.fim))&&(!f.busca||[r.referencia,r.cidade,r.pontoA,r.pontoB,r.tecnicoNome,r.fibras].join(' ').toLocaleLowerCase('pt-BR').includes(f.busca.toLocaleLowerCase('pt-BR')))}).sort((a,b)=>(dataMedicao(b.criadoEm)?.getTime()||0)-(dataMedicao(a.criadoEm)?.getTime()||0));
}
export function analisarMedicoes(rows) {
  const total=rows.length,conferidas=rows.filter(r=>r.status==='CONFERIDA').length,entregues=rows.filter(r=>r.status==='ENTREGUE').length;
  const estados=ESTADOS.map(estado=>({estado,total:rows.filter(r=>r.estado===estado).length,conferidas:rows.filter(r=>r.estado===estado&&r.status==='CONFERIDA').length})).filter(r=>r.total);
  return {total,conferidas,entregues,emCampo:total-conferidas-entregues,conclusao:total?Math.round(conferidas/total*100):0,estados,arquivos:rows.reduce((n,r)=>n+(r.txArquivos||0)+(r.rxArquivos||0),0)};
}
