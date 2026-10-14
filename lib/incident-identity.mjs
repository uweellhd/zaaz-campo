// Nome só é aceito quando completo, exato e único entre supervisores ativos.
const normalizar = valor => String(valor||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
export function reconhecerSupervisor(nome,pessoas){
  const procurado=normalizar(nome);if(!procurado)return null;
  const matches=pessoas.filter(p=>p.ativo&&p.perfil==='supervisor'&&normalizar(p.nome)===procurado);
  return matches.length===1?{uid:matches[0].uid,nome:matches[0].nome}:null;
}
export function coordenadasValidas(valor){const m=String(valor||'').match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);return !!m&&Math.abs(+m[1])<=90&&Math.abs(+m[2])<=180;}
export function lerLocalizacao(valor){if(!coordenadasValidas(valor))return null;const [latitude,longitude]=valor.split(',').map(Number);return {latitude,longitude};}
