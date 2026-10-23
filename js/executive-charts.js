// Os cinco gráficos usam somente o recorte já recebido pelo painel.
const number = value => Number(value || 0).toLocaleString('pt-BR');
const node = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
function palette() {
  const css = getComputedStyle(document.body);
  const read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const dark = document.body.classList.contains('theme-dark');
  return {
    text: read('--text-main', '#1e293b'), muted: read('--text-muted', '#64748b'),
    grid: read('--border-color', '#e2e8f0'), card: read('--card-bg', '#fff'),
    blue: read('--zaaz-blue', '#0755bf'), green: dark ? '#4cc5ad' : '#138575',
    gold: dark ? '#f5c76a' : '#b57a19', soft: dark ? '#7895c0' : '#90a5c1'
  };
}
// O atualizador de aparência já chama update('none') ao mudar o tema.
const themePlugin = {
  id: 'nextflow-executive-theme',
  beforeUpdate(chart) {
    const p = palette(), options = chart.options;
    options.color = p.muted;
    options.plugins.legend.labels.color = p.text;
    Object.assign(options.plugins.tooltip, {backgroundColor:p.card, titleColor:p.text, bodyColor:p.text, borderColor:p.grid, borderWidth:1});
    for (const scale of Object.values(options.scales || {})) {
      scale.ticks.color = p.muted; scale.grid.color = p.grid; scale.border.color = p.grid;
    }
    for (const dataset of chart.data.datasets) {
      const color = dataset.nextflowTone === 'network' ? [p.blue,p.gold] : dataset.nextflowTone === 'stages' ? [p.soft,p.gold,p.blue,p.green] : p[dataset.nextflowTone] || p.blue;
      dataset.backgroundColor = dataset.fill ? `${p.green}1a` : color;
      dataset.borderColor = chart.config.type === 'doughnut' ? p.card : color;
      dataset.pointBackgroundColor = p.green;
    }
  },
  afterDatasetsDraw(chart) {
    const {ctx} = chart, p = palette();
    ctx.save(); ctx.fillStyle = p.text; ctx.font = '600 11px "Segoe UI", sans-serif';
    if (chart.config.type === 'doughnut') {
      const arc = chart.getDatasetMeta(0).data[0];
      if (arc) {
        const total = chart.data.datasets[0].data.reduce((sum,n)=>sum+n,0);
        ctx.textAlign = 'center'; ctx.font = '600 30px "Segoe UI", sans-serif';
        ctx.fillText(number(total), arc.x, arc.y + 1);
        ctx.font = '12px "Segoe UI", sans-serif';ctx.fillStyle = p.muted;
        ctx.fillText('ativos', arc.x, arc.y + 23);
      }
    } else if (chart.options.indexAxis === 'y') {
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      chart.data.datasets.forEach((dataset,index) => {
        if (!chart.isDatasetVisible(index)) return;
        chart.getDatasetMeta(index).data.forEach((bar,i) => {
          if (dataset.data[i] > 0) ctx.fillText(number(dataset.data[i]),bar.x+6,bar.y);
        });
      });
    }
    ctx.restore();
  }
};
function axes(horizontal = true) {
  return {
    x:{beginAtZero:true, grace:horizontal?'18%':0, ticks:{precision:0, maxTicksLimit:5}, grid:{display:true}, border:{display:false}},
    y:{beginAtZero:!horizontal, ticks:{precision:0, autoSkip:false, callback:horizontal?function(value){const label=String(this.getLabelForValue(value));const max=this.chart.width<420?20:34;return label.length>max?label.slice(0,max-1)+'…':label}:undefined}, grid:{display:!horizontal}, border:{display:false}}
  };
}
export function criarGraficosDiretoria() {
  const instances = new Map(), signatures = new Map();
  function draw(id, config, rows, headers, note, empty) {
    const canvas = document.getElementById(id), card = canvas.closest('.chart-card');
    const frame = card.querySelector('.executive-chart-frame');
    const message = card.querySelector('.chart-empty');
    frame.hidden = empty; message.hidden = !empty;
    card.querySelector('.chart-note').textContent = note;
    canvas.setAttribute('aria-label',card.querySelector('h5').textContent+'. '+note+'. Os valores completos estão na tabela abaixo.');
    const body = card.querySelector('tbody');
    body.replaceChildren(...rows.map(row => {const tr=node('tr');row.forEach((text,i)=>{const cell=node(i?'td':'th',text);if(!i)cell.scope='row';tr.append(cell)});return tr}));
    const head = card.querySelector('thead tr');head.replaceChildren(...headers.map(text=>{const th=node('th',text);th.scope='col';return th}));
    if (typeof window.Chart === 'undefined' || empty) return;
    const signature = JSON.stringify(config.data), previous = instances.get(id);
    if (previous) {
      if(signatures.get(id)!==signature){previous.data=config.data;previous.update('none')}
      previous.resize();
    } else {
      const {plugins,...specific} = config.options || {};
      const options = {responsive:true, maintainAspectRatio:false, resizeDelay:80, locale:'pt-BR', animation:matchMedia('(prefers-reduced-motion: reduce)').matches?false:{duration:220}, layout:{padding:{right:30}}, plugins:{legend:{display:false,position:'bottom',labels:{boxWidth:12,padding:16}},tooltip:{padding:12,displayColors:true}}, ...specific};
      // A configuração de plugins permanece explícita para o tema e os tooltips.
      options.plugins = {...options.plugins,...plugins};
      instances.set(id,new Chart(canvas,{...config,options,plugins:[themePlugin]}));
    }
    signatures.set(id,signature);
  }
  return {
    render(m) {
      const net = [m.ativos-m.backbone,m.backbone], labels = ['GPON','Backbone'];
      const networkRows = net.map((n,i)=>[labels[i],number(n),`${m.ativos?(100*n/m.ativos).toLocaleString('pt-BR',{maximumFractionDigits:1}):'0'}%`]);
      draw('chartTipoIncidente',{type:'doughnut',data:{labels,datasets:[{data:net,nextflowTone:'network',borderWidth:3,hoverOffset:3}]},options:{cutout:'73%',layout:{padding:8}}},networkRows,['Rede','Ativos','Participação'],`${number(m.ativos)} ${m.ativos===1?'chamado ativo':'chamados ativos'} · distribuição por rede`,!m.ativos);
      const legend = document.querySelector('#chartTipoIncidente').closest('.chart-card').querySelector('.chart-network-legend');
      legend.replaceChildren(...networkRows.map((row,i)=>{const li=node('li');li.dataset.network=String(i);li.append(node('span',row[0]),node('strong',row[1]+' · '+row[2]));return li}));

      const states = m.estados.filter(e=>e.ativos>0);
      document.getElementById('chartEstados').parentElement.style.height=`${Math.max(240,states.length*33+25)}px`;
      draw('chartEstados',{type:'bar',data:{labels:states.map(s=>s.nome),datasets:[{label:'Ativos',data:states.map(s=>s.ativos),nextflowTone:'blue',borderRadius:4,maxBarThickness:23}]},options:{indexAxis:'y',scales:axes()}},states.map(s=>[s.nome,number(s.ativos)]),['Estado','Ativos'],`${states.length} ${states.length===1?'estado com chamados ativos':'estados com chamados ativos'} no recorte`,!states.length);

      const supervisors = m.supervisores.filter(s=>s.ativos>0).slice(0,6);
      draw('chartSupervisores',{type:'bar',data:{labels:supervisors.map(s=>s.nome),datasets:[{label:'Ativos',data:supervisors.map(s=>s.ativos),nextflowTone:'blue',borderRadius:4,maxBarThickness:16},{label:'Resolvidos',data:supervisors.map(s=>s.resolvidos),nextflowTone:'green',borderRadius:4,maxBarThickness:16}]},options:{indexAxis:'y',scales:axes(),plugins:{legend:{display:true,position:'bottom',labels:{boxWidth:12,padding:16}}}}},supervisors.map(s=>[s.nome,number(s.ativos),number(s.resolvidos)]),['Supervisor','Ativos','Resolvidos'],`Até 6 supervisores com maior volume ativo. Resolvidos pertencem ao mesmo recorte.`,!supervisors.length);

      const stages = ['Aguardando / distribuição','Deslocamento enviado','No local','Atuação'];
      draw('chartEtapas',{type:'bar',data:{labels:stages,datasets:[{label:'Ativos',data:m.etapas,nextflowTone:'stages',borderRadius:4,maxBarThickness:24}]},options:{indexAxis:'y',scales:axes()}},stages.map((s,i)=>[s,number(m.etapas[i])]),['Última etapa enviada','Ativos'],'Considera a última etapa confirmada de cada chamado ativo.',!m.ativos);

      const completed = m.dias.reduce((sum,d)=>sum+d.total,0);
      draw('chartConclusoes',{type:'line',data:{labels:m.dias.map(d=>d.nome),datasets:[{label:'Conclusões',data:m.dias.map(d=>d.total),nextflowTone:'green',fill:true,tension:.25,pointRadius:4,pointHoverRadius:6,borderWidth:2}]},options:{scales:{x:{ticks:{maxTicksLimit:5},grid:{display:false},border:{display:false}},y:{beginAtZero:true,ticks:{precision:0,maxTicksLimit:5},grid:{display:true},border:{display:false}}}}},m.dias.map(d=>[d.nome,number(d.total)]),['Dia · Brasília','Conclusões'],`${number(completed)} conclusões nos últimos 7 dias, entre os chamados do recorte.`,!completed);
    },
    fechar(){for(const chart of instances.values())chart.destroy();instances.clear();signatures.clear()}
  };
}
