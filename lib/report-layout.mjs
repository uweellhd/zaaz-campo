// Composição A4 compartilhada: cabeçalho, paginação, tabelas e hierarquia editorial.
export function reportLayout(pdf,{title,subtitle,emitidoPor,escopo,agora=new Date(),simulacao=false}){
 const W=178,L=16,B=270,ink='#20344F',muted='#61738A',blue='#164F96';let y=50;
 const clean=v=>String(v??'').replace(/[–—]/g,'-').replace(/[^\u0020-\u00ff\n]/g,'');
 const font=(size=10,bold=false,color=ink)=>{pdf.setFont('NextflowReport',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(color)};
 const text=(value,x,yy,size=10,bold=false,color=ink)=>{font(size,bold,color);pdf.text(clean(value),x,yy)};
 function header(){pdf.setFillColor(blue);pdf.rect(0,0,210,38,'F');text('NEXTFLOW',L,13,17,true,'#FFFFFF');text('ZAAZ TELECOM',L,20,8,false,'#DAE7F8');text(title,L,31,14,true,'#FFFFFF');y=48}
 function page(){pdf.addPage();header()}
 function need(h){if(y+h>B)page()}
 function paragraph(value,{size=9,color=ink,bold=false}={}){font(size,bold,color);const lines=pdf.splitTextToSize(clean(value),W);for(const line of lines){need(size*.46+2);text(line,L,y,size,bold,color);y+=size*.46}y+=4}
 function section(n,title){need(20);y+=3;text(`${String(n).padStart(2,'0')} / ${title}`,L,y,11,true,blue);y+=8}
 function cards(items){for(let i=0;i<items.length;i+=3){need(34);const row=items.slice(i,i+3),w=(W-10)/3;row.forEach(([label,value,note],n)=>{const x=L+n*(w+5);pdf.setFillColor('#F2F6FB');pdf.roundedRect(x,y,w,29,2,2,'F');text(label,x+4,y+7,7,true,muted);font(19,true,blue);const size=Math.min(19,19*(w-8)/Math.max(1,pdf.getTextWidth(clean(value))));text(value,x+4,y+18,size,true,blue);if(note)text(note,x+4,y+25,6.7,false,muted)});y+=35}}
 function table(heads,rows,widths){
  function tableHead(){need(17);pdf.setFillColor(blue);pdf.rect(L,y,W,9,'F');let x=L+2;heads.forEach((v,n)=>{text(v,x,y+6,7.2,true,'#FFFFFF');x+=widths[n]});y+=9}
  tableHead();if(!rows.length){paragraph('Nenhum registro neste recorte.');return}
  rows.forEach((row,index)=>{font(8);const lines=row.map((v,n)=>pdf.splitTextToSize(clean(v),widths[n]-4));let offset=0,count=Math.max(1,...lines.map(l=>l.length));while(offset<count){if(y+10>B){page();tableHead()}const amount=Math.min(count-offset,Math.max(1,Math.floor((B-y-5)/3.9))),h=amount*3.9+5;pdf.setFillColor(index%2?'#FFFFFF':'#F2F6FB');pdf.rect(L,y,W,h,'F');let x=L+2;lines.forEach((l,n)=>{font(8);const slice=l.slice(offset,offset+amount);if(slice.length)pdf.text(slice,x,y+5);x+=widths[n]});y+=h;offset+=amount;if(offset<count){page();tableHead()}}});y+=6;
 }
 function bars(rows){const max=Math.max(1,...rows.map(r=>r.total));if(!rows.length){paragraph('Nenhum registro para distribuição.');return}for(const r of rows){font(8);const lines=pdf.splitTextToSize(clean(r.nome),65),h=Math.max(9,lines.length*3.8+3);need(h);pdf.text(lines,L,y+3);pdf.setFillColor('#E4ECF6');pdf.roundedRect(85,y,92,4,1,1,'F');if(r.total){pdf.setFillColor(blue);pdf.roundedRect(85,y,92*r.total/max,4,1,1,'F')}text(r.total,183,y+4,8,true);y+=h}y+=4}
 function photos(record){if(!record.fotosRelatorio)return;paragraph('Anexo fotográfico disponível na emissão. As imagens seguem a retenção de 15 dias.',{size:8});const pics=record.fotosRelatorio;for(let i=0;i<pics.length;i+=2){need(86);pics.slice(i,i+2).forEach((p,n)=>{const x=L+n*91,props=pdf.getImageProperties(p.src),scale=Math.min(86/props.width,70/props.height),w=props.width*scale,h=props.height*scale;pdf.addImage(p.src,'JPEG',x+(86-w)/2,y,w,h);text(p.label,x,y+76,8,false,muted)});y+=85}if(record.fotosIndisponiveis)paragraph(`${record.fotosIndisponiveis} foto(s) indisponível(is) na emissão. Não foram substituídas por imagens de exemplo.`,{size:8})}
 header();paragraph(subtitle||'',{color:muted});paragraph(`Emitido em ${agora.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} (Brasília) | Por: ${emitidoPor||'Não informado'}`,{size:8,color:muted});paragraph(`Escopo: ${escopo||'Recorte autorizado do usuário'}`,{size:8,color:muted});if(simulacao)paragraph('SIMULAÇÃO / DADOS FICTÍCIOS - sem validade operacional.',{bold:true});
 pdf.setProperties({title:`NEXTFLOW - ${title}`,author:'NEXTFLOW',subject:subtitle||title});
 return {pdf,page,paragraph,section,cards,table,bars,photos,finish(){const pages=pdf.getNumberOfPages();for(let n=1;n<=pages;n++){pdf.setPage(n);pdf.setDrawColor('#DCE5F1');pdf.line(L,281,194,281);text(simulacao?'SIMULAÇÃO / DADOS FICTÍCIOS':'NEXTFLOW / ZAAZ Telecom - Uso interno',L,287,7,false,muted);text(`${n} / ${pages}`,182,287,8,false,muted)}return pdf}};
}
