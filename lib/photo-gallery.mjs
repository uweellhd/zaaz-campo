import { listaFotos, LIMITE_FOTOS } from './field-flow.mjs';
export function renderizarGaleria(container, valor, remover) {
  if (!container) return;
  container.replaceChildren();
  const fotos = listaFotos(valor);
  fotos.forEach((foto, indice) => {
    const figura = document.createElement('figure');
    const imagem = document.createElement('img'); imagem.src = foto; imagem.alt = `Foto ${indice + 1} anexada`;
    const botao = document.createElement('button'); botao.type = 'button'; botao.className = 'btn-sec-sm'; botao.textContent = `Remover foto ${indice + 1}`;
    botao.onclick = () => remover(indice);
    figura.append(imagem, botao); container.append(figura);
  });
  const resumo = document.createElement('p'); resumo.className = 'search-hint'; resumo.textContent = `${fotos.length}/${LIMITE_FOTOS} fotos. Toque no campo para adicionar outras.`; container.append(resumo);
}
