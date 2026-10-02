// A mesma galeria atende o campo, a consulta, Projetos e o laboratório.
let overlay, imagens = [], indice = 0, focoAnterior;
const seguras = src => typeof src === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(src);
function criarVisualizador() {
  if (overlay) return;
  overlay = document.createElement('div'); overlay.className = 'photo-viewer'; overlay.hidden = true;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Visualizador de fotos');
  overlay.innerHTML = `<div class="photo-viewer-toolbar"><span class="photo-viewer-caption"></span><button type="button" data-zoom aria-label="Alternar ampliação">＋ Ampliar</button><button type="button" data-close aria-label="Fechar foto">✕ Fechar</button></div><div class="photo-viewer-stage"><img alt="Foto do atendimento"></div><div class="photo-viewer-navigation"><button type="button" data-prev aria-label="Foto anterior">←</button><span data-count></span><button type="button" data-next aria-label="Próxima foto">→</button></div>`;
  document.body.append(overlay);
  overlay.querySelector('[data-close]').onclick = fecharFotos;
  overlay.querySelector('[data-prev]').onclick = () => mostrar(indice - 1);
  overlay.querySelector('[data-next]').onclick = () => mostrar(indice + 1);
  const zoom = () => { const ampliado = overlay.classList.toggle('photo-viewer-zoom'); overlay.querySelector('[data-zoom]').textContent = ampliado ? '− Ajustar' : '＋ Ampliar'; };
  overlay.querySelector('[data-zoom]').onclick = zoom; overlay.querySelector('img').ondblclick = zoom;
  overlay.querySelector('.photo-viewer-stage').onclick = e => { if (e.target === e.currentTarget) fecharFotos(); };
  document.addEventListener('keydown', e => {
    if (overlay.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); fecharFotos(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); mostrar(indice - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); mostrar(indice + 1); }
    if (e.key === 'Tab') { const botoes = [...overlay.querySelectorAll('button:not(:disabled)')]; const atual = botoes.indexOf(document.activeElement); e.preventDefault(); botoes[(atual + (e.shiftKey ? -1 : 1) + botoes.length) % botoes.length].focus(); }
  }, true);
}
function mostrar(n) {
  indice = Math.max(0, Math.min(imagens.length - 1, n)); const foto = imagens[indice];
  overlay.classList.remove('photo-viewer-zoom'); overlay.querySelector('[data-zoom]').textContent = '＋ Ampliar';
  overlay.querySelector('img').src = foto.src; overlay.querySelector('img').alt = foto.label || 'Foto do atendimento';
  overlay.querySelector('.photo-viewer-caption').textContent = foto.label || 'Foto do atendimento';
  overlay.querySelector('[data-count]').textContent = `${indice + 1} / ${imagens.length}`;
  overlay.querySelector('[data-prev]').disabled = indice === 0; overlay.querySelector('[data-next]').disabled = indice === imagens.length - 1;
  overlay.querySelector('.photo-viewer-stage').scrollTo(0, 0);
}
export function abrirFotos(fotos, inicio = 0) {
  imagens = fotos.filter(f => seguras(f.src)); if (!imagens.length) return;
  criarVisualizador(); focoAnterior = document.activeElement; overlay.hidden = false; document.body.classList.add('photo-viewer-open');
  mostrar(inicio); overlay.querySelector('[data-close]').focus();
}
export function fecharFotos() {
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true; overlay.querySelector('img').removeAttribute('src'); document.body.classList.remove('photo-viewer-open'); focoAnterior?.focus();
}
export function fotoAberta() { return Boolean(overlay && !overlay.hidden); }
export function montarGaleria(container, fotos) {
  container.replaceChildren(); container.classList.add('evidence-gallery');
  const validas = fotos.filter(f => seguras(f.src));
  validas.forEach((foto, n) => {
    const figura = document.createElement('figure'); const botao = document.createElement('button'); botao.type = 'button'; botao.className = 'evidence-thumbnail';
    botao.setAttribute('aria-label', `Ampliar ${foto.label || 'foto ' + (n + 1)}`);
    const img = document.createElement('img'); img.src = foto.src; img.alt = foto.label || `Foto ${n + 1}`; img.loading = 'lazy';
    const legenda = document.createElement('figcaption'); legenda.textContent = foto.label || `Foto ${n + 1}`;
    botao.append(img); botao.onclick = () => abrirFotos(validas, n); figura.append(botao, legenda); container.append(figura);
  });
  if (!validas.length) { const nota = document.createElement('p'); nota.className = 'photo-retention-note'; nota.textContent = 'Fotos indisponíveis ou removidas após 15 dias. O histórico permanece.'; container.append(nota); }
}
