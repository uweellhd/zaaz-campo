// Tipografia e contraste dos gráficos acompanham o tema, sem alterar seus dados.
(() => {
  function aplicar() {
    const grafico = window.Chart;
    if (!grafico?.defaults || !document.body) return;
    const estilo = getComputedStyle(document.body);
    const texto = estilo.getPropertyValue('--text-muted').trim() || '#64748b';
    const linha = estilo.getPropertyValue('--border-color').trim() || '#e2e8f0';
    grafico.defaults.font.family = estilo.fontFamily;
    grafico.defaults.color = texto;
    grafico.defaults.borderColor = linha;
    for (const instancia of Object.values(grafico.instances || {})) {
      instancia.options.color = texto;
      if (instancia.options.plugins?.legend?.labels) instancia.options.plugins.legend.labels.color = texto;
      for (const escala of Object.values(instancia.scales || {})) {
        if (escala.options.ticks) escala.options.ticks.color = texto;
        if (escala.options.grid) escala.options.grid.color = linha;
      }
      instancia.update('none');
    }
  }
  aplicar();
  document.addEventListener('nextflow-chart-ready',aplicar);
  new MutationObserver(aplicar).observe(document.body, { attributes:true, attributeFilter:['class'] });
})();
