// Nome só é aceito quando completo, exato e único entre supervisores ativos.
const normalizar = valor => String(valor||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
export function reconhecerSupervisor(nome,pessoas){
  const procurado=normalizar(nome);if(!procurado)return null;
  const matches=pessoas.filter(p=>p.ativo&&p.perfil==='supervisor'&&normalizar(p.nome)===procurado);
  return matches.length===1?{uid:matches[0].uid,nome:matches[0].nome}:null;
}
export function coordenadasValidas(valor){const m=String(valor||'').match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);return !!m&&Math.abs(+m[1])<=90&&Math.abs(+m[2])<=180;}
export function lerLocalizacao(valor){if(!coordenadasValidas(valor))return null;const [latitude,longitude]=valor.split(',').map(Number);return {latitude,longitude};}

// Um identificador explícito tem prioridade. Se não for reconhecido, não adivinhe pelo nome.
export async function identificarSupervisor({ixcId,nome},{buscarVinculo,buscarPessoa,listarPessoas}){
 const id=String(ixcId||'').trim();
 if(id){
  if(!/^[0-9]{1,20}$/.test(id))return {identidade:null,origem:'PENDENTE',motivo:'O ID do supervisor no IXC está em formato inválido.'};
  const mapping=await buscarVinculo(id);if(!mapping)return {identidade:null,origem:'PENDENTE',motivo:'O ID IXC informado ainda não tem vínculo cadastrado.'};
  const person=await buscarPessoa(mapping.supervisorUid);
  if(!person?.ativo||person.perfil!=='supervisor')return {identidade:null,origem:'PENDENTE',motivo:'O vínculo IXC aponta para um supervisor inativo ou com outro cargo.'};
  return {identidade:{uid:mapping.supervisorUid,nome:person.nome},origem:'IXC_ID',motivo:''};
 }
 const person=reconhecerSupervisor(nome,await listarPessoas());
 return {identidade:person,origem:person?'NOME_EXATO_UNICO':'PENDENTE',motivo:person?'':'Não foi possível identificar um único supervisor ativo pelo nome completo.'};
}
