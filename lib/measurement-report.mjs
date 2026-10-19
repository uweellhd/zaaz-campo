import { carregarPDF } from './executive-report.mjs';
import { analisarMedicoes, STATUS, dataMedicao, nomePOP, situacaoMedicao, fibrasMedicao } from './measurements.mjs';
import { horarioBrasil } from './executive-metrics.mjs';
const clean=v=>String(v??'').replace(/[–—]/g,'-').replace(/[^\u0020-\u00ff\n]/g,'');
export async function criarRelatorioMedicoes(rows,filtros={},agora=new Date()) {
  const PDF=await carregarPDF(),pdf=new PDF({unit:'mm',format:'a4',compress:true}),m=analisarMedicoes(rows);
  const azul='#124FA0',tinta='#20344F',cinza='#61738A';let y;
  const txt=(s,x,yy,size=10,color=tinta,bold=false)=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(color);pdf.text(clean(s),x,yy)};
  const head=title=>{pdf.setFillColor(azul);pdf.rect(0,0,210,38,'F');txt('NEXTFLOW',16,14,18,'#FFFFFF',true);txt('ZAAZ TELECOM',16,22,8,'#dbe8fc');txt(title,16,32,14,'#FFFFFF',true);y=48};
  const page=title=>{pdf.addPage();head(title)};
  const para=(s,size=10)=>{pdf.setFont('helvetica','normal');pdf.setFontSize(size);const lines=pdf.splitTextToSize(clean(s),178);for(const line of lines){if(y>270)page('Medições OTDR / continuação');txt(line,16,y,size);y+=size*.45}y+=4};
  const title=s=>{if(y>256)page('Medições OTDR');txt(s,16,y,12,azul,true);y+=8};
  const table=(heads,values,widths)=>{
    const header=()=>{pdf.setFillColor(azul);pdf.rect(16,y,178,9,'F');let x=18;heads.forEach((h,i)=>{txt(h,x,y+6,8,'#FFFFFF',true);x+=widths[i]});y+=9};
    if(y>250)page('Medições OTDR / inventário');header();
    for(const [index,row] of values.entries()) {
      pdf.setFont('helvetica','normal');pdf.setFontSize(8);const lines=row.map((s,i)=>pdf.splitTextToSize(clean(s),widths[i]-4));let offset=0;const count=Math.max(...lines.map(l=>l.length));
      while(offset<count){if(y>259){page('Medições OTDR / inventário');header()}
        const n=Math.min(count-offset,Math.max(1,Math.floor((272-y-5)/3.8))),height=n*3.8+5;
        pdf.setFillColor(index%2?'#FFFFFF':'#F2F6FC');pdf.rect(16,y,178,height,'F');let x=18;
        lines.forEach((l,i)=>{if(l.slice(offset,offset+n).length){pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(tinta);pdf.text(l.slice(offset,offset+n),x,y+5)}x+=widths[i]});y+=height;offset+=n;
      }
    }y+=7;
  };
  pdf.setProperties({title:`${filtros.simulacao?'SIMULAÇÃO - ':''}NEXTFLOW - Acompanhamento de medições OTDR`,author:'NEXTFLOW',subject:'Entrega técnica e conferência de Projetos - ZAAZ Telecom'});
  head('Medições OTDR / relatório de acompanhamento');
  if(filtros.simulacao)para('SIMULAÇÃO / DADOS FICTÍCIOS - não utilizar como relatório de operação real.',9);
  para(`Emitido em ${horarioBrasil(agora)} (Brasília).`,9);
  para(`Abertura: ${filtros.inicio||'sem limite inicial'} a ${filtros.fim||'sem limite final'}. Estado: ${filtros.estado||'todos'}. Situação: ${STATUS[filtros.status]||'todas'}. Busca: ${filtros.busca||'sem restrição'}.`,9);
  const cards=[['DEMANDAS',m.total],['A DISTRIBUIR',m.aguardando],['EM CAMPO',m.emCampo],['EM PROJETOS',m.entregues],['CONFERIDAS',m.conferidas]];
  const top=y;cards.forEach(([label,value],i)=>{const x=16+i*36;pdf.setFillColor('#F2F6FC');pdf.roundedRect(x,top,34,28,2,2,'F');txt(label,x+4,top+8,6.6,cinza,true);txt(value,x+4,top+22,24,azul,true)});y+=39;
  title('01 / Leitura executiva');
  para(m.total?`${m.conclusao}% das demandas deste recorte foram conferidas por Projetos. Há ${m.aguardando} aguardando técnico, ${m.emCampo} em execução e ${m.entregues} aguardando conferência. O recorte reúne ${m.estados.length} estado(s) e ${m.arquivos} arquivo(s) de medição enviado(s).`:'Não há demandas no recorte selecionado. Nenhuma taxa foi estimada.');
  para('Entrega técnica e conferência são marcos distintos. Uma demanda entregue ainda não representa aprovação óptica da fibra. Este relatório acompanha o serviço; a análise de distância, eventos e perdas deve usar os arquivos originais no software apropriado.',9);
  title('02 / Distribuição por estado');
  if(m.estados.length)table(['UF','TOTAL','CONFERIDAS','PENDENTES'],m.estados.map(r=>[r.estado,r.total,r.conferidas,r.total-r.conferidas]),[40,46,46,46]);else para('Nenhum estado com demanda no recorte.',9);
  if(m.total){
    if(y>205)page('Medições OTDR / inventário executivo');
    title('03 / Inventário executivo');
    para('Mesmo recorte da visão executiva. A situação reflete o instante de emissão.',9);
    table(['DEMANDA / ROTA','TÉCNICO','UF / ABERTURA','SITUAÇÃO'],rows.map(r=>[`${r.referencia}\n${r.pontoA} > ${r.pontoB}\n${r.cidade}\nFibras: ${fibrasMedicao(r)}`,r.tecnicoNome||'A definir',`${r.estado}\n${dataMedicao(r.criadoEm)?horarioBrasil(dataMedicao(r.criadoEm)):'Aguardando registro'}`,`${situacaoMedicao(r)}\nFotos POP 1/2: ${r.txFotos||0}/${r.rxFotos||0}\nArquivos POP 1/2: ${r.txArquivos||0}/${r.rxArquivos||0}`]),[65,38,35,40]);
    for(const r of rows){
      page('Medições OTDR / ficha da demanda');
      title(r.referencia);para(`${r.estado} / ${r.cidade} | ${situacaoMedicao(r)}`);para(`Técnico: ${r.tecnicoNome||'A definir'}. Supervisor: ${r.supervisorNome||'não informado'}.`);para(`Rota: ${r.pontoA} > ${r.pontoB}. Fibras: ${fibrasMedicao(r)}.`);
      for(const d of ['tx','rx']) {const g=r[d+'Gps'];para(`${nomePOP(d)}: ${r[d+'Fotos']||0} foto(s), ${r[d+'Arquivos']||0} arquivo(s). GPS do registro: ${g?`${g.latitude.toFixed(6)}, ${g.longitude.toFixed(6)}`:'não enviado'}.`,9);para(`Fibras: ${r[d==='tx'?'fibrasPop1':'fibrasPop2']||r.fibras||'Não informadas'}. Envio: ${dataMedicao(d==='tx'?(r.pop1EnviadoEm||r.entregueEm):r.entregueEm)?horarioBrasil(dataMedicao(d==='tx'?(r.pop1EnviadoEm||r.entregueEm):r.entregueEm)):'Pendente'}.`,9)}
      if(!r.pop1EnviadoEm&&['ENTREGUE','CONFERIDA'].includes(r.status))para('Registro anterior: coleta concluída em envio único.',9);title('Registro técnico');if(r.pop1Observacao)para(`POP 1: ${r.pop1Observacao}`);para(`POP 2: ${r.observacao||'Ainda não enviado.'}`);
      title('Conferência de Projetos');para(r.status==='CONFERIDA'?`${r.conferidoPorNome} / ${dataMedicao(r.conferidoEm)?horarioBrasil(dataMedicao(r.conferidoEm)):'data não disponível'}\n${r.observacaoProjetos}`:'Aguardando conferência.');
      para('Fotos temporárias: disponíveis por 15 dias após o envio. Os arquivos OTDR originais permanecem na demanda para download autorizado. O PDF não contém as curvas interpretadas nem substitui os arquivos do equipamento.',9);
    }
  }
  const pages=pdf.getNumberOfPages();for(let p=1;p<=pages;p++){pdf.setPage(p);pdf.setDrawColor('#DCE5F1');pdf.line(16,282,194,282);txt(filtros.simulacao?'SIMULAÇÃO / DADOS FICTÍCIOS - NEXTFLOW':'NEXTFLOW / ZAAZ Telecom - Uso interno',16,288,8,cinza);txt(`${p} / ${pages}`,181,288,8,cinza)}
  return {pdf,nome:`${filtros.simulacao?'SIMULACAO-':''}NEXTFLOW-Medicoes-${agora.toISOString().slice(0,10)}.pdf`,metricas:m};
}
