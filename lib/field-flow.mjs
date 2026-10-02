// Regras comuns ao campo, laboratório e testes. Registros antigos continuam legíveis.
export const LIMITE_FOTOS = 6;
export function listaFotos(valor) { return Array.isArray(valor) ? valor : typeof valor === 'string' && valor ? [valor] : []; }
const fotoValida = foto => typeof foto === 'string' && foto.startsWith('data:image/jpeg;base64,') && foto.length <= 650000;
export function etapaConcluida(item = {}) {
  if (Number.isInteger(item.etapaConcluida)) return Math.max(0, Math.min(4, item.etapaConcluida));
  const ultimo = (item.timelineEtapas || []).at(-1);
  return Number(String(ultimo?.etapa || '').match(/^ETAPA ([1-4])(?:\D|$)/)?.[1] || 0);
}
export function exigirProximaEtapa(item, numero) {
  if (etapaConcluida(item) + 1 !== numero) throw new Error('Esta etapa já foi enviada ou está fora de sequência. Reabra o ID para continuar na etapa correta.');
}
export const categoriasEtapa = { 1: ['fotoDeslocamento'], 2: ['fotoChegada', 'fotoRompimento'], 3: ['fotoPanoramica', 'fotoEquipe'] };
const nomes = { fotoDeslocamento:'deslocamento', fotoChegada:'local de chegada', fotoRompimento:'rompimento localizado', fotoPanoramica:'técnico atuando', fotoEquipe:'fusão' };
export function avaliarEtapa(numero, dados) {
  for (const chave of categoriasEtapa[numero] || []) {
    const fotos = listaFotos(dados.fotos?.[chave]);
    if (!fotos.length || fotos.length > LIMITE_FOTOS || !fotos.every(fotoValida)) return { valido:false, mensagem:`Adicione de 1 a ${LIMITE_FOTOS} fotos de ${nomes[chave]}.` };
  }
  if (numero === 1 && (!['URBANA','RURAL'].includes(dados.tipoArea) || !['NAO_INFORMADO','COMUNIDADE','OUTRO'].includes(dados.condicaoRisco))) return { valido:false, mensagem:'Informe o tipo de área e a condição de risco.' };
  if (numero === 2 && (!dados.causa?.trim() || !previsaoValida(dados.previsao))) return { valido:false, mensagem:'Informe a causa e selecione a data e o horário previstos para restauração.' };
  if (numero === 3 && !dados.observacao?.trim()) return { valido:false, mensagem:'Preencha a observação da atuação. Se não houver outra informação, escreva “Sem observações adicionais”.' };
  if (numero === 3 && dados.novaPrevisao && !previsaoValida(dados.novaPrevisao)) return { valido:false, mensagem:'Selecione uma data e um horário válidos para a nova previsão.' };
  return { valido:true, mensagem:'' };
}
export function modeloDescricao(causa = '') { return `CAUSA: ${causa}\n\nSOLUÇÃO: \n\nOBSERVAÇÃO: `; }
export function separarDescricao(texto) {
  const match = String(texto || '').match(/^\s*CAUSA\s*:\s*([\s\S]*?)\n\s*SOLU[ÇC][ÃA]O\s*:\s*([\s\S]*?)\n\s*OBSERVA[ÇC][ÃA]O\s*:\s*([\s\S]*)$/i);
  return match ? { causa:match[1].trim(), solucao:match[2].trim(), observacao:match[3].trim() } : null;
}
export function avaliarFinalizacao(caixas, descricao) {
  if (caixas.length < 2) return { valido:false, indice:-1, mensagem:'Adicione pelo menos duas caixas.' };
  if (caixas.length > 12) return { valido:false, indice:-1, mensagem:'O limite é de 12 caixas.' };
  for (const [indice, caixa] of caixas.entries()) {
    const coordenadas = String(caixa.gps || '').match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    if (!coordenadas || Math.abs(Number(coordenadas[1])) > 90 || Math.abs(Number(coordenadas[2])) > 180) return { valido:false, indice, mensagem:`Capture a localização da Caixa ${indice + 1}.` };
    const fotos = listaFotos(caixa.fotos || caixa.foto);
    if (!fotos.length || fotos.length > LIMITE_FOTOS || !fotos.every(fotoValida)) return { valido:false, indice, mensagem:`Anexe de 1 a ${LIMITE_FOTOS} fotos da Caixa ${indice + 1}, ou remova a caixa extra não utilizada.` };
  }
  const campos = separarDescricao(descricao);
  if (String(descricao || '').length > 5000 || !campos || !campos.causa || !campos.solucao || !campos.observacao) return { valido:false, indice:-1, mensagem:'Preencha CAUSA, SOLUÇÃO e OBSERVAÇÃO no roteiro. Se não houver observação adicional, informe “Sem observações adicionais”.' };
  return { valido:true, indice:-1, mensagem:'' };
}

export function previsaoValida(valor) {
  const m = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m || Number(m[1]) < 2020 || Number(m[1]) > 2100 || Number(m[4]) > 23 || Number(m[5]) > 59) return false;
  const data = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]), Number(m[4]), Number(m[5]));
  return data.getFullYear() === Number(m[1]) && data.getMonth() === Number(m[2])-1 && data.getDate() === Number(m[3]);
}
export function formatarPrevisao(valor) {
  if (!previsaoValida(valor)) return valor || 'A definir';
  return new Date(valor).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
export function resolvido(item) { return etapaConcluida(item) === 4 || /FINALIZAD|CONCLU[IÍ]D|RESOLVID/i.test(item.statusAtual || ''); }
