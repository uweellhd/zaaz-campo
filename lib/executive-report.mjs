import { analisarOperacao, leituraExecutiva, horarioBrasil, dataConclusao, diaBrasil } from './executive-metrics.mjs';
import { resolvido, formatarPrevisao } from './field-flow.mjs';
// Dependência local, carregada apenas ao exportar. Sem envio de dados para terceiros.
let carregamento;
async function carregarPDF(){
  if(globalThis.jspdf?.jsPDF)return globalThis.jspdf.jsPDF;
  carregamento ||= new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL('../vendor/jspdf-4.2.1.umd.min.js',import.meta.url).href;
    script.onload=()=>resolve(globalThis.jspdf.jsPDF);script.onerror=()=>{script.remove();carregamento=null;reject(new Error('Não foi possível carregar o gerador de PDF. Verifique a conexão e tente novamente.'))};document.head.append(script);
  });return carregamento;
}
const texto = v => String(v??'').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').replace(/[–—]/g,'-').replace(/[^\u0020-\u00ff\n]/g,'');
const num=n=>Number(n).toLocaleString('pt-BR');
export async function criarRelatorioPDF(itens,filtros={},detectar=()=>'',agora=new Date()){
  const jsPDF=await carregarPDF(),pdf=new jsPDF({unit:'mm',format:'a4',compress:true});
  const m=analisarOperacao(itens,detectar,agora),azul='#124FA0',tinta='#20344F',cinza='#61738A',verde='#13877A';let y=0;
  pdf.setProperties({title:'NEXTFLOW - Relatório executivo da operação',subject:'Incidentes e acompanhamento operacional ZAAZ Telecom',author:'NEXTFLOW',creator:'NEXTFLOW'});
  const t=(v,x,yy,size=10,color=tinta,bold=false)=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(color);pdf.text(texto(v),x,yy)};
  const par=(v,x,yy,width,size=10,color=tinta)=>{pdf.setFont('helvetica','normal');pdf.setFontSize(size);pdf.setTextColor(color);const linhas=pdf.splitTextToSize(texto(v),width);pdf.text(linhas,x,yy);return yy+linhas.length*size*.43};
  const cabecalho=(titulo,sub)=>{
    pdf.setFillColor(azul);pdf.rect(0,0,210,39,'F');t('NEXTFLOW',16,14,17,'#ffffff',true);t('ZAAZ TELECOM / OPERAÇÃO INTERNA',16,22,8,'#dbe8fc');t(titulo,16,32,15,'#ffffff',true);
    y=47;y=par(sub,16,y,178,9,cinza)+5;
  };
  const sec=(n,nome)=>{t(n+' / '+nome,16,y,11,azul,true);y+=7};
  const nova=(titulo,sub)=>{pdf.addPage();cabecalho(titulo,sub)};
  const caixa=(rotulo,valor,nota,x,yy,color=azul)=>{
    pdf.setFillColor('#F2F6FC');pdf.roundedRect(x,yy,56,31,2,2,'F');pdf.setFillColor(color);pdf.rect(x,yy+4,1,23,'F');t(rotulo,x+5,yy+8,8,cinza,true);t(num(valor),x+5,yy+20,24,color,true);par(nota,x+5,yy+26,48,6.8,cinza);
  };
  const tabela=(heads,rows,widths)=>{
    const start=()=>{pdf.setFillColor(azul);pdf.rect(16,y,178,9,'F');let x=18;heads.forEach((h,n)=>{t(h,x,y+6,8,'#ffffff',true);x+=widths[n]});y+=9};start();
    rows.forEach((row,n)=>{
      pdf.setFont('helvetica','normal');pdf.setFontSize(8);
      const lines=row.map((v,i)=>pdf.splitTextToSize(texto(v),widths[i]-4));
      let offset=0;const quantidade=Math.max(1,...lines.map(l=>l.length));
      while(offset<quantidade){
        const altura=(quantidade-offset)*3.8+5;
        if(y+altura>273&&y>80){nova('Detalhamento da operação','Continuação do mesmo recorte. Os cabeçalhos são repetidos em cada página.');start()}
        const cabe=Math.max(1,Math.floor((273-y-5)/3.8)),parte=Math.min(cabe,quantidade-offset),h=parte*3.8+5;
        pdf.setFillColor(n%2?'#FFFFFF':'#F2F6FC');pdf.rect(16,y,178,h,'F');let x=18;
        lines.forEach((ls,i)=>{const trecho=ls.slice(offset,offset+parte);pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(tinta);if(trecho.length)pdf.text(trecho,x,y+5);x+=widths[i]});y+=h;offset+=parte;
        if(offset<quantidade){nova('Detalhamento da operação','Continuação de um registro extenso. Nenhuma informação foi cortada.');start()}
      }
    });y+=6;
  };
  const barras=(titulo,rows,{maxRows=8}={})=>{
    t(titulo,16,y,11,azul,true);y+=8;
    if(!rows.length){y=par('Nenhum registro no recorte.',16,y,178,9,cinza)+5;return}
    const maior=Math.max(1,...rows.map(r=>r.total));
    for(const r of rows.slice(0,maxRows)){
      // Rótulos longos são quebrados, nunca cortados.
      pdf.setFontSize(8);const ls=pdf.splitTextToSize(texto(r.nome),61);pdf.setTextColor(tinta);pdf.text(ls,16,y);const h=Math.max(8,ls.length*3.6+2);
      pdf.setFillColor('#E8EEF7');pdf.roundedRect(82,y-3,97,4,1,1,'F');if(r.total){pdf.setFillColor(azul);pdf.roundedRect(82,y-3,97*r.total/maior,4,1,1,'F')}t(num(r.total),183,y+.5,8,tinta,true);y+=h;
    }
    if(rows.length>maxRows){y=par(`Exibidos os ${maxRows} maiores volumes. A tabela detalhada contém todos.`,16,y,178,8,cinza)+4}y+=5;
  };
  const periodo=`Abertura: ${filtros.inicio||'sem limite inicial'} a ${filtros.fim||'sem limite final'}. Estado: ${filtros.estado==='TODOS'||!filtros.estado?'todos':filtros.estado}. Supervisor: ${filtros.supervisor||'todos'}.`;
  cabecalho('Relatório executivo da operação',periodo);
  t('POSIÇÃO EM '+horarioBrasil(agora)+' (BRASÍLIA)',16,y,8,cinza);y+=8;
  const cards=[['INCIDENTES ATIVOS',m.ativos,'Em andamento',azul],['CHAMADOS RESOLVIDOS',m.resolvidos,'No recorte de abertura',verde],['IMPACTO GPON',m.gpon,'Soma de clientes informados','#C64255'],['BACKBONE ATIVO',m.backbone,'Ocorrências em andamento','#BD7D1D'],['SEM TÉCNICO',m.semTecnico,'Ativos aguardando definição',azul],['PREVISÕES VENCIDAS',m.vencidos,'Prazo informado; não é SLA','#BD7D1D']];
  cards.forEach((c,n)=>caixa(c[0],c[1],c[2],16+(n%3)*61,y+Math.floor(n/3)*36,c[3]));y+=79;
  sec('01','Leitura executiva');
  for(const frase of leituraExecutiva(m)){y=par(frase,16,y,178,10)+4}
  y+=4;sec('02','Composição da operação');
  tabela(['REDE','ATIVOS','PARTICIPAÇÃO'],[['GPON',num(m.ativos-m.backbone),m.ativos?((m.ativos-m.backbone)/m.ativos*100).toFixed(1)+'%':'-'],['Backbone',num(m.backbone),m.ativos?(m.backbone/m.ativos*100).toFixed(1)+'%':'-']],[85,40,53]);
  if(y>257)nova('Leitura da operação',periodo);
  par('Impacto GPON é a soma declarada por chamado ativo e pode repetir clientes. Não representa clientes únicos, disponibilidade da rede ou cumprimento de SLA.',16,y,178,8,cinza);
  nova('Distribuição e evolução',periodo);
  barras('03 / Chamados ativos por estado',m.estados.map(e=>({nome:e.nome,total:e.ativos})),{maxRows:8});
  barras('04 / Etapas dos atendimentos ativos',['Aguardando / distribuição','Deslocamento enviado','No local','Atuação'].map((nome,n)=>({nome,total:m.etapas[n]})));
  t('05 / Conclusões por dia - últimos 7 dias',16,y,11,azul,true);y+=10;
  const base=y+25,top=Math.max(1,...m.dias.map(d=>d.total));
  pdf.setDrawColor('#CBD6E6');pdf.line(16,base,194,base);
  m.dias.forEach((d,n)=>{const x=22+n*25,h=23*d.total/top;pdf.setFillColor(verde);if(h)pdf.roundedRect(x,base-h,13,h,1,1,'F');t(num(d.total),x+2,base-h-2,8);t(d.nome,x,base+6,8,cinza)});y=base+13;
  par(`Conclusões dos chamados deste recorte, pela data registrada na etapa 4. ${m.semDataConclusao} resolvido(s) sem data de conclusão válida não entram nesta série.`,16,y,178,8,cinza);
  nova('Acompanhamento da supervisão',periodo);
  sec('06','Carteira por supervisor');
  tabela(['SUPERVISOR','ATIVOS','RESOLVIDOS','SEM TÉCNICO','VENCIDOS'],m.supervisores.map(s=>[s.nome,num(s.ativos),num(s.resolvidos),num(s.semTecnico),num(s.vencidos)]),[70,24,29,30,25]);
  if(y>231)nova('Critérios do relatório',periodo);
  sec('07','Como interpretar');
  for(const frase of [
    'O período seleciona a data de abertura, não a data de conclusão. Ativos e resolvidos fazem parte do mesmo recorte; os botões da lista alteram apenas sua visualização.',
    'Previsão vencida: chamado ativo com data e hora válidas informadas pelo técnico anteriores à emissão. Ausência de previsão não é atraso nem falha no procedimento.',
    'Fotos são obrigatórias no fluxo atual. Não há indicador de evidência faltante. A retenção de 15 dias das fotos não remove os registros de atendimento.',
    'Os totais são uma fotografia dos dados disponíveis na emissão, sem projeções ou comparação com metas não cadastradas.'
  ]){if(y>257)nova('Critérios do relatório','Continuação');y=par(frase,16,y,178,9)+5}
  nova('Inventário dos chamados',`${periodo} Todos os ${itens.length} registros deste recorte, ativos e resolvidos.`);
  tabela(['ID / OS','LOCAL / REDE','RESPONSÁVEIS','SITUAÇÃO / DATAS'],itens.map(i=>[
    `ID ${i.idIncidente||'-'}\nOS ${i.os||'-'}`,
    `${i.cidades||'Não informado'}\n${i.estado||detectar(i.cidades||'')||'-'} / ${i.tipoRede||'GPON'}\nClientes informados: ${num(i.clientesCount||0)}`,
    `${i.supervisorNome||i.responsavel||'Sem supervisor'}\nTécnico: ${i.tecnicoAtribuido||'A definir'}`,
    `${resolvido(i)?'Resolvido':'Em andamento'}\n${i.statusAtual||'Sem situação informada'}\nAbertura: ${i.dataCriacao|| (i.dataTimestamp?horarioBrasil(i.dataTimestamp):'Não informada')}\nPrevisão: ${formatarPrevisao(i.previsao)}${resolvido(i)?'\nConclusão: '+(dataConclusao(i)||'Não informada'):''}`
  ]),[25,47,49,57]);
  const total=pdf.getNumberOfPages();for(let p=1;p<=total;p++){pdf.setPage(p);pdf.setDrawColor('#D4DEEB');pdf.line(16,282,194,282);t('NEXTFLOW / ZAAZ Telecom - Uso interno',16,288,8,cinza);t(`${p} / ${total}`,181,288,8,cinza)}
  return {pdf,nome:`NEXTFLOW_Relatorio_Executivo_${diaBrasil(agora)}.pdf`,metricas:m};
}
