// Validação compartilhada entre o formulário de campo e os testes locais.
export function avaliarFinalizacao(caixas, descricao) {
  if (caixas.length < 2) return { valido: false, indice: -1, mensagem: 'Adicione pelo menos duas caixas.' };
  if (caixas.length > 12) return { valido: false, indice: -1, mensagem: 'O limite é de 12 caixas.' };
  for (const [indice, caixa] of caixas.entries()) {
    const coordenadas = String(caixa.gps || '').match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    if (!coordenadas || Math.abs(Number(coordenadas[1])) > 90 || Math.abs(Number(coordenadas[2])) > 180) {
      return { valido: false, indice, mensagem: `Capture a localização da Caixa ${indice + 1}.` };
    }
    if (typeof caixa.foto !== 'string' || !caixa.foto.startsWith('data:image/jpeg;base64,')) {
      return { valido: false, indice, mensagem: `Anexe a foto da Caixa ${indice + 1}, ou remova a caixa extra não utilizada.` };
    }
  }
  if (!String(descricao || '').trim()) return { valido: false, indice: -1, mensagem: 'Descreva o serviço realizado.' };
  return { valido: true, indice: -1, mensagem: '' };
}
