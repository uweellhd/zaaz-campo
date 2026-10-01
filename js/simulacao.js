import { avaliarFinalizacao, avaliarEtapa, listaFotos, LIMITE_FOTOS, categoriasEtapa, modeloDescricao, separarDescricao } from '../lib/field-flow.mjs';
import { renderizarGaleria } from '../lib/photo-gallery.mjs';

// Laboratório isolado: nenhuma importação ou escrita no Firebase.
let chamados = [], conquistas = new Set(), perfil = 'noc', ativo, passo = 1, fotos = {}, numeroCaixa = 0;
const nomes = { tecnicoA:'Técnico A (fictício)', tecnicoB:'Técnico B (fictício)' };
const roteiro = [
 ['noc','NOC: criar um ID fictício e atribuir ao Técnico A.'],
 ['etapa1','Técnico A: anexar o deslocamento e enviar a etapa 1.'],
 ['etapa2','Técnico A: anexar local e rompimento, informar causa e previsão e enviar a etapa 2.'],
 ['etapa3','Técnico A: anexar atuação e fusão, informar observação e enviar a etapa 3.'],
 ['etapa4','Técnico A: completar duas caixas, fotos e roteiro CAUSA / SOLUÇÃO / OBSERVAÇÃO; finalizar.'],
 ['sac','SAC: abrir o ID e conferir o histórico sem edição.'],
 ['supervisor','Supervisor A: abrir seu ID e conferir as evidências.'],
 ['projetos','Projetos: abrir a entrega final e marcar lançamento no OZmaps.'],
 ['diretor','Diretor: conferir os indicadores e exportar o relatório fictício.'],
 ['transferencia','Opcional: transferir um atendimento e conferir na conta do Técnico B.']
];
const $ = id => document.getElementById(id);
function avisar(texto) { $('simAviso').textContent = texto; }
function conquistar(chave) { conquistas.add(chave); atualizarRoteiro(); }
function atualizarRoteiro() {
 $('simRoteiro').replaceChildren();
 for(const [chave,texto] of roteiro){ const li=document.createElement('li'); li.textContent=(conquistas.has(chave)?'✓ ':'')+texto; if(conquistas.has(chave))li.className='done'; $('simRoteiro').append(li); }
}
function iniciarDados(){
 chamados=[
  {id:'TESTE-1001',os:'OS-FICTICIA-01',cidade:'Cidade de teste / SP',tecnico:'tecnicoA',supervisor:'supervisorA',eventos:[],status:'ABERTO'},
  {id:'TESTE-1002',os:'OS-FICTICIA-02',cidade:'Outra cidade de teste / SP',tecnico:'tecnicoB',supervisor:'supervisorB',eventos:[],status:'ABERTO'},
  {id:'TESTE-1003',os:'OS-FICTICIA-03',cidade:'Cidade de teste / SP',tecnico:'',supervisor:'',eventos:[],status:'ABERTO'}
 ]; conquistas.clear(); ativo=null; atualizarRoteiro(); renderizar();
}
function card(chamado,onclick){
 const el=document.createElement('button');el.type='button';el.className='incidente-card supervisor-card';
 const titulo=document.createElement('strong');titulo.textContent=`ID ${chamado.id}`;
 const info=document.createElement('small');info.textContent=`${chamado.os} · ${chamado.cidade}`;
 const status=document.createElement('span');status.textContent=chamado.status;
 el.append(titulo,info,status);el.onclick=onclick;return el;
}
function renderizar(){
 for(const id of ['simNoc','simConsulta','simDiretor'])$(id).hidden=true;
 $('viewTech').style.display='none';
 const orientacoes={noc:'Crie ou atribua um ID ao Técnico A. Depois troque o perfil para acompanhar as etapas.',tecnicoA:'Somente IDs atribuídos ao Técnico A. GPS e fotos de exemplo são fictícios; nada é enviado ao sistema real.',tecnicoB:'Somente IDs atribuídos ao Técnico B. O ID TESTE-1001 não aparece enquanto continuar com o Técnico A.',sac:'Consulta geral: abra o chamado para ler as etapas. Este perfil não oferece edição.',supervisorA:'Somente IDs ligados ao Supervisor A; os IDs do Supervisor B não aparecem.',projetos:'Somente entregas da etapa 4. Finalize um chamado como técnico para ele aparecer aqui.',diretor:'Indicadores e relatório dos dados fictícios deste laboratório.'};
 $('simOrientacao').textContent=orientacoes[perfil];
 if(perfil==='noc'){
  $('simNoc').hidden=false;const lista=$('simNocLista');lista.replaceChildren();
  for(const item of chamados){
   const bloco=document.createElement('article');bloco.className='field-card';
   const titulo=document.createElement('strong');titulo.textContent=`${item.id} · ${item.status}`;
   const seletor=document.createElement('select');seletor.setAttribute('aria-label',`Técnico de ${item.id}`);
   seletor.add(new Option('Sem técnico',''));for(const [uid,nome]of Object.entries(nomes))seletor.add(new Option(nome,uid));seletor.value=item.tecnico;
   const atribuir=document.createElement('button');atribuir.type='button';atribuir.className='btn-sec-sm';atribuir.textContent='Atribuir técnico e Supervisor A';
   atribuir.onclick=()=>{item.tecnico=seletor.value;item.supervisor='supervisorA';conquistar('noc');avisar(`Atribuição fictícia salva para ${item.id}.`);renderizar()};
   const abrir=document.createElement('button');abrir.className='btn-sec-sm';abrir.textContent='Ver devolutivas';abrir.onclick=()=>abrirDetalhes(item);
   bloco.append(titulo,seletor,atribuir,abrir);lista.append(bloco);
  }
 } else if(perfil.startsWith('tecnico')){
  $('viewTech').style.display='block';$('techSelectArea').style.display='block';$('techFormArea').style.display='none';
  const lista=$('techIncidentsList');lista.replaceChildren();
  for(const item of chamados.filter(i=>i.tecnico===perfil&&i.status!=='FINALIZADO')) lista.append(card(item,()=>abrirTecnico(item)));
  if(!lista.children.length)lista.textContent='Nenhum atendimento aberto atribuído a este técnico fictício.';
 } else if(perfil==='diretor'){
  $('simDiretor').hidden=false;
  const valores=[['Incidentes ativos',chamados.filter(i=>i.status!=='FINALIZADO').length],['IDs finalizados',chamados.filter(i=>i.final).length],['Entregas pendentes no OZmaps',chamados.filter(i=>i.final&&!i.ozmaps).length]];
  const kpis=$('simKpis');kpis.replaceChildren();for(const [rotulo,valor]of valores){const el=document.createElement('div');el.className='kpi-card';const nome=document.createElement('span');nome.className='kpi-title';nome.textContent=rotulo;const n=document.createElement('h2');n.className='kpi-value';n.textContent=valor;el.append(nome,n);kpis.append(el)}
  $('simDiretorLista').replaceChildren(...chamados.map(item=>card(item,()=>abrirDetalhes(item))));
 } else {
  $('simConsulta').hidden=false;
  $('simConsultaTitulo').textContent=perfil==='projetos'?'📐 Projetos · entregas finais':perfil==='supervisorA'?'👥 Supervisor A · seus IDs':'📞 SAC / Suporte · consulta';
  const lista=$('simConsultaLista');lista.replaceChildren();
  const filtrados=chamados.filter(i=>perfil==='projetos'?Boolean(i.final):perfil==='supervisorA'?i.supervisor==='supervisorA':true);
  for(const item of filtrados)lista.append(card(item,()=>abrirDetalhes(item)));
  if(!filtrados.length)lista.textContent='Nenhum registro disponível neste perfil fictício.';
 }
}
function texto(tag,conteudo){const el=document.createElement(tag);el.textContent=conteudo;return el}
function abrirDetalhes(item){
 const corpo=$('modalSimCorpo');corpo.replaceChildren();$('modalSimTitulo').textContent=`${item.id} · ${perfil==='projetos'?'Projetos':'Histórico fictício'}`;
 corpo.append(texto('p',`${item.os} · ${item.cidade}`));
 if(perfil==='projetos'){
  corpo.append(texto('p',`Serviço: ${item.final.descricao}`));
  for(const [indice,caixa]of item.final.caixas.entries()){const linha=document.createElement('div');linha.className='sim-event';linha.append(texto('strong',`Caixa ${indice+1} · GPS ${caixa.gps}`));const img=document.createElement('img');img.className='sim-photo';img.alt='Foto local do laboratório';img.src=caixa.foto;linha.append(img);for(const foto of listaFotos(caixa.fotos).slice(1)){const extra=document.createElement('img');extra.src=foto;extra.className='sim-photo';extra.alt='Foto adicional local do laboratório';linha.append(extra)}corpo.append(linha)}
  const status=texto('p',item.ozmaps?'Registrado no OZmaps (simulação)':'Aguardando OZmaps (simulação)');corpo.append(status);
  const form=document.createElement('form');form.className='project-treatment field-card';const label=texto('label','Observação / referência no OZmaps');label.htmlFor='simObsProjeto';const obs=document.createElement('textarea');obs.id='simObsProjeto';obs.maxLength=2000;obs.value=item.obsProjeto||'';obs.placeholder='Informe o que foi registrado no OZmaps.';const confirmacao=texto('label','');confirmacao.className='project-check';const check=document.createElement('input');check.type='checkbox';check.required=true;check.checked=Boolean(item.ozmaps);confirmacao.append(check,document.createTextNode('Confirmo que as caixas foram registradas no OZmaps e a entrega foi tratada.'));const b=texto('button','✓ Confirmar tratamento');b.type='submit';b.className='btn-primary';const audit=texto('p',item.ozmaps?'Responsável: Projetista de teste · '+item.horaProjeto:'Será registrado por: Projetista de teste');audit.className='project-audit';form.append(label,obs,confirmacao,audit,b);form.onsubmit=e=>{e.preventDefault();if(!check.checked)return;item.ozmaps=true;item.obsProjeto=obs.value.trim();item.horaProjeto=new Date().toLocaleString('pt-BR');conquistar('projetos');status.textContent='Registrado no OZmaps (simulação)';audit.textContent='Responsável: Projetista de teste · '+item.horaProjeto;renderizar()};corpo.append(form)
 } else {
  if(!item.eventos.length)corpo.append(texto('p','Ainda não há etapas enviadas neste ID fictício.'));
  for(const evento of item.eventos){const linha=document.createElement('div');linha.className='sim-event';linha.append(texto('strong',`Etapa ${evento.numero} · ${evento.hora}`),texto('p',evento.descricao),texto('p',`${evento.fotos.length} foto(s) no laboratório`));for(const foto of evento.fotos){const img=document.createElement('img');img.src=foto;img.className='sim-photo';img.alt='Foto local de teste';linha.append(img)}corpo.append(linha)}
  if(perfil==='sac')conquistar('sac');if(perfil==='supervisorA')conquistar('supervisor');
 }
 $('modalSim').style.display='flex';$('simFechar').focus();
}
function mudarPasso(n){n=Math.max((ativo?.eventos.length||0)+1,n);n=Math.min(4,n);for(let i=1;i<=4;i++){ $(`step-${i}`).classList.toggle('active',i===n);$(`ind-${i}`).classList.toggle('active',i===n) }passo=n}
function abrirTecnico(item){
 ativo=item;fotos={};numeroCaixa=0;$('techFormFlow').reset();$('caixasTecnico').replaceChildren();
 $('techFormFlow').querySelectorAll('.photo-gallery').forEach(i=>i.replaceChildren());
 $('techEtapa4Erro').hidden=true;$('techSelectArea').style.display='none';$('techFormArea').style.display='block';
 $('techNomeDisplayStage1').textContent=nomes[perfil];$('techActiveIdDisplay').textContent=`TESTE · ${item.id}`;
 $('techAjudantes').replaceChildren(new Option(nomes[perfil==='tecnicoA'?'tecnicoB':'tecnicoA'],perfil==='tecnicoA'?'tecnicoB':'tecnicoA'));
 $('techTransferir').replaceChildren(new Option('Manter comigo',''),new Option(nomes[perfil==='tecnicoA'?'tecnicoB':'tecnicoA'],perfil==='tecnicoA'?'tecnicoB':'tecnicoA'));
 adicionarCaixaTecnico();adicionarCaixaTecnico();
 $('techLocalStatus').textContent='SIMULAÇÃO: envios fictícios disponíveis imediatamente aos outros perfis deste laboratório.';
 $('tobs').value=modeloDescricao(item.causa||'');$('techPrevisaoAtual').textContent=`Previsão atual: ${item.previsao||'A definir'}.`;
 mudarPasso(Math.min(4,Math.max(0,...item.eventos.map(e=>e.numero))+1));
}
function samplePhoto(rotulo){const canvas=document.createElement('canvas');canvas.width=480;canvas.height=320;const c=canvas.getContext('2d');c.fillStyle='#eaf1ff';c.fillRect(0,0,480,320);c.fillStyle='#0052cc';c.font='bold 28px sans-serif';c.fillText('NEXTFLOW · TESTE',35,120);c.font='22px sans-serif';c.fillText(rotulo,35,175);c.fillText('Foto fictícia',35,220);return canvas.toDataURL('image/jpeg',.7)}
function publicar(numero,descricao,chaves){
 if(numero !== ativo.eventos.length+1){avisar('Etapa já enviada ou fora da sequência.');return false}
 const anexos=chaves.flatMap(chave=>listaFotos(fotos[chave]));
 ativo.eventos.push({numero,descricao,fotos:anexos,hora:new Date().toLocaleTimeString('pt-BR')});ativo.status=`ETAPA ${numero}`;conquistar(`etapa${numero}`);
 $('techLocalStatus').textContent=`Etapa ${numero} enviada no laboratório. Troque para SAC ou Supervisor para conferir.`;
 if(numero<4)mudarPasso(numero+1);return true;
}
export function iniciarLaboratorio(){
 $('simPerfil').onchange=()=>{perfil=$('simPerfil').value;ativo=null;fecharModal();avisar('');renderizar()};
 $('simReiniciar').onclick=()=>{if(confirm('Reiniciar somente os dados fictícios deste laboratório?')){iniciarDados();avisar('Laboratório reiniciado.')}};
 $('techFormFlow').addEventListener('input',()=>{$('techEtapa4Erro').hidden=true});
 $('simNocForm').onsubmit=e=>{e.preventDefault();const id=$('simNovoId').value.trim();if(chamados.some(i=>i.id===id)){avisar('Esse ID fictício já existe.');return}chamados.push({id,os:'OS-FICTICIA',cidade:$('simCidade').value.trim(),tecnico:'',supervisor:'',eventos:[],status:'ABERTO'});avisar('ID fictício criado. Agora atribua um técnico.');renderizar()};
 $('simFechar').onclick=fecharModal;$('modalSim').onclick=e=>{if(e.target===$('modalSim'))fecharModal()};document.addEventListener('keydown',e=>{if(e.key==='Escape')fecharModal()});
 $('simExportar').onclick=()=>{const escape=v=>'"'+String(v).replace(/^[=+@-]/,"'").replaceAll('"','""')+'"';const csv=['ID;OS;Status',...chamados.map(i=>[i.id,i.os,i.status].map(escape).join(';'))].join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='SIMULACAO_NEXTFLOW.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);conquistar('diretor')};
 const exemplo=texto('button','Usar fotos fictícias nesta etapa');exemplo.type='button';exemplo.className='btn-sec-sm sim-example-photos';exemplo.onclick=()=>{
  const chaves=passo===1?['fotoDeslocamento']:passo===2?['fotoChegada','fotoRompimento']:passo===3?['fotoPanoramica','fotoEquipe']:[...$('caixasTecnico').querySelectorAll('input[type=file]')].map(i=>i.id);
  for(const chave of chaves){const atuais=listaFotos(fotos[chave]);if(atuais.length<LIMITE_FOTOS){fotos[chave]=[...atuais,samplePhoto(`Etapa ${passo} · foto ${atuais.length+1}`)];galeria(chave)}}$('techEtapa4Erro').hidden=true;$('techLocalStatus').textContent='Fotos fictícias adicionadas. Preencha as informações obrigatórias antes de enviar.';

 };$('techFormFlow').before(exemplo);iniciarDados();
}
function fecharModal(){$('modalSim').style.display='none'}
window.liberarAtendimentoTecnico=()=>{ativo=null;renderizar()};
window.voltarEtapaTecnica=()=>avisar('Etapas enviadas estão bloqueadas. Consulte o histórico fictício.');
window.salvarRascunhoTecnico=()=>{};
window.transferirAtendimentoTecnico=()=>{const uid=$('techTransferir').value;if(!uid||!nomes[uid]){avisar('Selecione o técnico fictício.');return}ativo.tecnico=uid;conquistar('transferencia');avisar(`Transferido no laboratório para ${nomes[uid]}.`);ativo=null;renderizar()};
window.capturarGPSTecnico=id=>{$('techEtapa4Erro').hidden=true;$(id).value='-23.100000, -48.200000';$('techLocalStatus').textContent='Coordenada fictícia preenchida para o teste.'};
function galeria(chave){const preview=({fotoDeslocamento:'tp1',fotoChegada:'tp2',fotoRompimento:'tp3',fotoPanoramica:'tp4',fotoEquipe:'tp5'})[chave]||chave.replace('simFoto','simPreview');renderizarGaleria($(preview),fotos[chave],i=>{fotos[chave]=listaFotos(fotos[chave]).filter((_,indice)=>indice!==i);galeria(chave)})}
window.processarFotoComMarcaDagua=async(input,preview,chave)=>{
 const files=[...(input.files||[])],anteriores=listaFotos(fotos[chave]);if(!files.length)return;
 if(files.length+anteriores.length>LIMITE_FOTOS){alert(`Limite de ${LIMITE_FOTOS} fotos por categoria.`);input.value='';return}
 try{const novas=[];for(const file of files){const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const ratio=Math.min(1,800/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);const c=canvas.getContext('2d');c.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();novas.push(canvas.toDataURL('image/jpeg',.65))}fotos[chave]=[...anteriores,...novas];galeria(chave);$('techEtapa4Erro').hidden=true}catch{alert('Não foi possível ler essa imagem. Você pode usar as fotos fictícias do laboratório.')}finally{input.value=''}
};
function atualizarCaixas(){const caixas=[...$('caixasTecnico').children];caixas.forEach((el,i)=>{el.querySelector('h5').textContent=`Caixa ${i+1}`;el.querySelector('.remove-box').hidden=caixas.length<=2})}
window.adicionarCaixaTecnico=()=>{
 if($('caixasTecnico').children.length>=12)return;const n=++numeroCaixa;const el=document.createElement('div');el.className='field-card box-evidence';
 el.innerHTML=`<div class="box-heading"><h5>Caixa de teste</h5><button type="button" class="remove-box">Remover extra</button></div><label for="simGps${n}">Localização GPS fictícia</label><input id="simGps${n}" type="text" class="box-gps" readonly placeholder="Ainda não preenchida"><button type="button" class="btn-sec-sm btn-capture" onclick="capturarGPSTecnico('simGps${n}')">📍 Usar GPS fictício</button><label for="simFoto${n}">Foto</label><input id="simFoto${n}" type="file" accept="image/*" multiple onchange="processarFotoComMarcaDagua(this,'simPreview${n}','simFoto${n}')"><div id="simPreview${n}" class="photo-gallery"></div>`;
 el.querySelector('.remove-box').onclick=()=>{if($('caixasTecnico').children.length<=2)return;delete fotos[`simFoto${n}`];el.remove();atualizarCaixas()};$('caixasTecnico').append(el);atualizarCaixas();
};
function enviarSim(numero,dados,descricao){const validacao=avaliarEtapa(numero,{...dados,fotos});if(!validacao.valido){alert(validacao.mensagem);return false}return publicar(numero,descricao,categoriasEtapa[numero])}
window.salvarEtapa1=()=>enviarSim(1,{tipoArea:$('techArea').value,condicaoRisco:$('techRisco').value},`Deslocamento em área ${$('techArea').value}. Risco: ${$('techRisco').value}.`);
window.salvarEtapa2=()=>{const causa=$('techCausaRompimento').value.trim(),previsao=$('techPrevisaoInput').value.trim();if(enviarSim(2,{causa,previsao},`Causa: ${causa}. Previsão: ${previsao}.`)){ativo.causa=causa;ativo.previsao=previsao;$('tobs').value=modeloDescricao(causa);$('techPrevisaoAtual').textContent=`Previsão atual: ${previsao}`}};
window.salvarEtapa3=()=>{const observacao=$('techObservacaoEtapa3').value.trim(),novaPrevisao=$('techNovaPrevisao').value,motivoPrevisao=$('techMotivoPrevisao').value.trim();const descricao=observacao+(novaPrevisao?`\nPrevisão alterada de ${ativo.previsao} para ${novaPrevisao}. Motivo: ${motivoPrevisao}`:'');if(enviarSim(3,{observacao,novaPrevisao,motivoPrevisao},descricao)&&novaPrevisao)ativo.previsao=novaPrevisao};
window.salvarEtapa4Final=()=>{
 if(ativo.eventos.length!==3){avisar('Envie todas as etapas anteriores antes de finalizar.');return}
 const caixas=[...$('caixasTecnico').children].map(el=>{const anexos=listaFotos(fotos[el.querySelector('input[type=file]').id]);return {gps:el.querySelector('.box-gps').value,fotos:anexos,foto:anexos[0]}});const descricao=$('tobs').value.trim();const validacao=avaliarFinalizacao(caixas,descricao);
 $('techEtapa4Erro').hidden=validacao.valido;if(!validacao.valido){$('techEtapa4Erro').textContent=validacao.mensagem;return}
 publicar(4,descricao,[]);ativo.eventos.at(-1).fotos=caixas.flatMap(caixa=>caixa.fotos);ativo.final={caixas,descricao,registroFinal:separarDescricao(descricao)};ativo.status='FINALIZADO';avisar('Atendimento fictício finalizado. Troque para Projetos para ver apenas a etapa 4.');ativo=null;renderizar();
};
