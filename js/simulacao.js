import { criarBancoMedicoesLaboratorio } from '../lib/measurement-lab.mjs';
import { montarResponsabilidade } from './project-work.js';
import { iniciarLaboratorioMedicoes } from './simulacao-medicoes.js';
import { avaliarFinalizacao, avaliarEtapa, listaFotos, LIMITE_FOTOS, categoriasEtapa, modeloDescricao, separarDescricao, formatarPrevisao } from '../lib/field-flow.mjs';
import { renderizarGaleria } from '../lib/photo-gallery.mjs';
import { montarGaleria, fotoAberta, fecharFotos } from '../lib/photo-viewer.mjs';

// Laboratório isolado: nenhuma importação ou escrita no Firebase.
const bancoProjetos=criarBancoMedicoesLaboratorio();
let chamados = [], conquistas = new Set(), perfil = 'noc', ativo, passo = 1, fotos = {}, numeroCaixa = 0, filtroConsulta='ativos', equipe=['tecnicoA'];
const nomes = { tecnicoA:'Técnico A (fictício)', tecnicoB:'Técnico B (fictício)' };
const roteiro = [
 ['noc','NOC: criar um ID fictício com o supervisor informado no comunicado.'],
 ['etapa1','Técnico A: anexar o deslocamento e enviar a etapa 1.'],
 ['etapa2','Técnico A: anexar local e rompimento, informar causa e previsão e enviar a etapa 2.'],
 ['etapa3','Técnico A: anexar atuação e fusão, informar observação e enviar a etapa 3.'],
 ['etapa4','Técnico A: completar duas caixas, fotos e roteiro CAUSA / SOLUÇÃO / OBSERVAÇÃO; finalizar.'],
 ['sac','Acompanhamento: abrir o ID e conferir as etapas recebidas, sem edição.'],
 ['supervisor','Supervisor A: distribuir o ID a um técnico da equipe e conferir as evidências.'],
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
 bancoProjetos.reiniciar();
 chamados=[
  {id:'TESTE-1001',os:'OS-FICTICIA-01',cidade:'Cidade de teste / SP',tecnico:'tecnicoA',supervisor:'supervisorA',eventos:[],status:'ABERTO'},
  {id:'TESTE-1002',os:'OS-FICTICIA-02',cidade:'Outra cidade de teste / SP',tecnico:'',supervisor:'supervisorB',eventos:[],status:'ABERTO'},
  {id:'TESTE-1003',os:'OS-FICTICIA-03',cidade:'Cidade de teste / SP',tecnico:'',supervisor:'',eventos:[],status:'ABERTO'}
 ]; equipe=['tecnicoA'];filtroConsulta='ativos';conquistas.clear(); ativo=null; atualizarRoteiro(); renderizar();
}
function card(chamado,onclick){
 const el=document.createElement('button');el.type='button';el.className='incidente-card supervisor-card';
 const titulo=document.createElement('strong');titulo.textContent=`ID ${chamado.id}`;
 const info=document.createElement('small');info.textContent=`${chamado.os} · ${chamado.cidade}`;
 const status=document.createElement('span');status.textContent=chamado.status;
 el.append(titulo,info,status);el.onclick=onclick;return el;
}
function renderizar(){
 document.querySelectorAll('[data-sim-filtro]').forEach(e=>e.remove());
 for(const id of ['simNoc','simConsulta','simDiretor'])$(id).hidden=true;
 $('viewTech').style.display='none';
 const orientacoes={noc:'Crie um ID com o supervisor informado no comunicado. A distribuição para técnicos acontece na Supervisão.',tecnicoA:'Somente IDs atribuídos ao Técnico A. GPS e fotos de exemplo são fictícios; nada é enviado ao sistema real.',tecnicoB:'Somente IDs atribuídos ao Técnico B. O ID TESTE-1001 não aparece enquanto continuar com o Técnico A.',sac:'Consulta geral: abra o chamado para ler as etapas. Este perfil não oferece edição.',supervisorA:'Distribua seus IDs aos técnicos da equipe, acompanhe as etapas e consulte os resolvidos.',projetos:'Somente entregas da etapa 4. Finalize um chamado como técnico para ele aparecer aqui.',diretor:'Indicadores e relatório dos dados fictícios deste laboratório.'};
 $('simVisaoLabel').hidden=!['projetos','coordenador_projetos'].includes(perfil);
 $('simOrientacao').textContent=orientacoes[perfil]||({admin:'Administração: visão geral de teste. Selecione cada cargo acima para reproduzir abertura, distribuição, campo e tratamento.',supervisorB:'Supervisor B consulta somente a própria equipe.',coordenador:'Coordenação de Operações: apenas IDs vinculados ao Supervisor A.',coordenador_projetos:'Coordenação de Projetos: todas as entregas e acompanhamento; o analista confirma o tratamento.'}[perfil]);
 if(perfil==='noc'){
  $('simNoc').hidden=false;const lista=$('simNocLista');lista.replaceChildren();
  for(const item of chamados){
   const bloco=document.createElement('article');bloco.className='field-card';
   const titulo=document.createElement('strong');titulo.textContent=`${item.id} · ${item.status}`;
   const supervisor=texto('p',item.supervisor==='supervisorA'?'Supervisor A':item.supervisor==='supervisorB'?'Supervisor B':'Supervisor não identificado no comunicado');
   const abrir=document.createElement('button');abrir.className='btn-sec-sm';abrir.textContent='Ver devolutivas';abrir.onclick=()=>abrirDetalhes(item);
   bloco.append(titulo,supervisor,abrir);lista.append(bloco);
  }
 } else if(perfil.startsWith('tecnico')){
  $('viewTech').style.display='block';$('techSelectArea').style.display='block';$('techFormArea').style.display='none';
  const lista=$('techIncidentsList');lista.replaceChildren();
  for(const item of chamados.filter(i=>i.tecnico===perfil&&i.status!=='FINALIZADO')) lista.append(card(item,()=>abrirTecnico(item)));
  if(!lista.children.length)lista.textContent='Nenhum atendimento aberto atribuído a este técnico fictício.';
 } else if(['diretor','admin','coordenador'].includes(perfil)){
  $('simDiretor').hidden=false;
  const scope=perfil==='coordenador'?chamados.filter(i=>i.supervisor==='supervisorA'):chamados;
  const valores=[['Incidentes ativos',scope.filter(i=>i.status!=='FINALIZADO').length],['IDs finalizados',scope.filter(i=>i.final).length],['Entregas pendentes no OZmaps',scope.filter(i=>i.final&&!i.ozmaps).length]];
  const kpis=$('simKpis');kpis.replaceChildren();for(const [rotulo,valor]of valores){const el=document.createElement('div');el.className='kpi-card';const nome=document.createElement('span');nome.className='kpi-title';nome.textContent=rotulo;const n=document.createElement('h2');n.className='kpi-value';n.textContent=valor;el.append(nome,n);kpis.append(el)}
  $('simDiretorLista').replaceChildren(...scope.map(item=>card(item,()=>abrirDetalhes(item))));
 } else {
  $('simConsulta').hidden=false;
  $('simConsultaTitulo').textContent=['projetos','coordenador_projetos'].includes(perfil)?($('simVisao').value==='acompanhamento'?'Acompanhamento operacional':'Projetos · entregas finais'):perfil.startsWith('supervisor')?`Supervisão · ${perfil==='supervisorA'?'equipe A':'equipe B'}`:'Acompanhamento operacional';
  const lista=$('simConsultaLista');lista.replaceChildren();
  const filtrados=chamados.filter(i=>['projetos','coordenador_projetos'].includes(perfil)?($('simVisao').value==='acompanhamento'||Boolean(i.final)):perfil.startsWith('supervisor')?i.supervisor===perfil&&((i.status==='FINALIZADO')===(filtroConsulta==='resolvidos')):true);
  if(perfil.startsWith('supervisor')){
    const filtros=document.createElement('div');filtros.className='status-tabs';for(const [v,n]of [['ativos','Em andamento'],['resolvidos','Resolvidos']]){const b=texto('button',n);b.type='button';b.className='btn-sec-sm'+(filtroConsulta===v?' active':'');b.onclick=()=>{filtroConsulta=v;renderizar()};filtros.append(b)}lista.before(filtros);filtros.dataset.simFiltro='true';
    const equipeNota=texto('p',perfil==='supervisorA'?'Equipe fictícia: Técnico A.':'Equipe fictícia: Técnico B.');equipeNota.dataset.simFiltro='true';lista.before(equipeNota);
  }
  for(const item of filtrados){
    if(!perfil.startsWith('supervisor')||item.status==='FINALIZADO'){lista.append(card(item,()=>abrirDetalhes(item)));continue}
    const bloco=document.createElement('article');bloco.className='incidente-card supervisor-card';bloco.append(card(item,()=>abrirDetalhes(item)));const seletor=document.createElement('select');seletor.setAttribute('aria-label',`Técnico da equipe para ${item.id}`);seletor.add(new Option('Selecionar técnico',''));for(const uid of (perfil==='supervisorB'?['tecnicoB']:equipe))seletor.add(new Option(nomes[uid],uid));seletor.value=item.tecnico;
    const b=texto('button','Acionar técnico');b.type='button';b.className='btn-primary';b.onclick=()=>{if(!(perfil==='supervisorB'?['tecnicoB']:equipe).includes(seletor.value))return;item.tecnico=seletor.value;conquistar('supervisor');avisar('ID atribuído ao técnico da equipe.');renderizar()};bloco.append(seletor,b);lista.append(bloco);
  }
  if(!filtrados.length)lista.textContent='Nenhum registro disponível neste perfil fictício.';
 }
}
function texto(tag,conteudo){const el=document.createElement(tag);el.textContent=conteudo;return el}
async function abrirDetalhes(item){
 const corpo=$('modalSimCorpo');corpo.replaceChildren();$('modalSimTitulo').textContent=`${item.id} · ${perfil==='projetos'?'Projetos':'Histórico fictício'}`;
 corpo.append(texto('p',`${item.os} · ${item.cidade}`));
 if(['projetos','coordenador_projetos'].includes(perfil)&&$('simVisao').value!=='acompanhamento'){
  corpo.append(texto('p',`Serviço: ${item.final.descricao}`));
  for(const [indice,caixa]of item.final.caixas.entries()){const linha=document.createElement('div');linha.className='project-box';linha.append(texto('strong',`Caixa ${indice+1} · GPS ${caixa.gps}`));const galeria=document.createElement('div');montarGaleria(galeria,listaFotos(caixa.fotos||caixa.foto).map((src,n)=>({src,label:`Caixa ${indice+1} · Foto ${n+1}`})));linha.append(galeria);corpo.append(linha)}
  if(!item.ozmaps){const record={...item,statusOzmaps:'PENDENTE'},s=bancoProjetos.api;await s.setDoc(s.doc({},'projetosEvidencias',item.id),record);await montarResponsabilidade(corpo,record,{perfil,uid:perfil,nome:bancoProjetos.pessoa(perfil).nome,servicos:s,db:{},collectionName:'projetosEvidencias',id:item.id,atualizar:novo=>{Object.assign(item,novo);abrirDetalhes(item)}})}
  const status=texto('p',item.ozmaps?'Registrado no OZmaps (simulação)':'Aguardando OZmaps (simulação)');corpo.append(status);
  const form=document.createElement('form');form.className='project-treatment field-card';const label=texto('label','Observação / referência no OZmaps');label.htmlFor='simObsProjeto';const obs=document.createElement('textarea');obs.id='simObsProjeto';obs.maxLength=2000;obs.value=item.obsProjeto||'';obs.placeholder='Informe o que foi registrado no OZmaps.';const confirmacao=texto('label','');confirmacao.className='project-check';const check=document.createElement('input');check.type='checkbox';check.required=true;check.checked=Boolean(item.ozmaps);confirmacao.append(check,document.createTextNode('Confirmo que as caixas foram registradas no OZmaps e a entrega foi tratada.'));const b=texto('button','✓ Confirmar tratamento');b.type='submit';b.className='btn-primary';const audit=texto('p',item.ozmaps?'Responsável: Projetista de teste · '+item.horaProjeto:'Será registrado por: Projetista de teste');audit.className='project-audit';form.append(label,obs,confirmacao,audit,b);form.onsubmit=e=>{e.preventDefault();if(item.ozmaps||!check.checked||!obs.value.trim())return;item.ozmaps=true;item.obsProjeto=obs.value.trim();item.horaProjeto=new Date().toLocaleString('pt-BR');form.remove();conquistar('projetos');status.textContent='Registrado no OZmaps (simulação)';audit.textContent='Responsável: Projetista de teste · '+item.horaProjeto;renderizar()};if(perfil==='coordenador_projetos'){corpo.append(texto('p','A confirmação do tratamento pertence ao analista de Projetos.'));}else if(!item.ozmaps)corpo.append(form);else corpo.append(texto('p',`Projetista de teste · ${item.horaProjeto} · ${item.obsProjeto||''}`))
 } else {
  if(!item.eventos.length)corpo.append(texto('p','Ainda não há etapas enviadas neste ID fictício.'));
  for(const evento of item.eventos){const linha=document.createElement('div');linha.className='sim-event';linha.append(texto('strong',`Etapa ${evento.numero} · ${evento.hora} · ${evento.tecnico||'Técnico de teste'}`),texto('p',evento.descricao));const galeria=document.createElement('div');montarGaleria(galeria,evento.fotos.map((src,n)=>({src,label:evento.rotulos?.[n]||`Foto ${n+1}`})));linha.append(galeria);corpo.append(linha)}
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
 $('tobs').value=modeloDescricao(item.causa||'');$('techPrevisaoAtual').textContent=`Previsão atual: ${formatarPrevisao(item.previsao)}.`;
 mudarPasso(Math.min(4,Math.max(0,...item.eventos.map(e=>e.numero))+1));
}
function samplePhoto(rotulo){const canvas=document.createElement('canvas');canvas.width=480;canvas.height=320;const c=canvas.getContext('2d');c.fillStyle='#eaf1ff';c.fillRect(0,0,480,320);c.fillStyle='#0052cc';c.font='bold 28px sans-serif';c.fillText('NEXTFLOW · TESTE',35,120);c.font='22px sans-serif';c.fillText(rotulo,35,175);c.fillText('Foto fictícia',35,220);return canvas.toDataURL('image/jpeg',.7)}
function publicar(numero,descricao,chaves){
 if(numero !== ativo.eventos.length+1){avisar('Etapa já enviada ou fora da sequência.');return false}
 const anexos=chaves.flatMap(chave=>listaFotos(fotos[chave]));
 const labels={fotoDeslocamento:'Deslocamento',fotoChegada:'Local do atendimento',fotoRompimento:'Rompimento localizado',fotoPanoramica:'Técnico atuando',fotoEquipe:'Fusão'};
 ativo.eventos.push({numero,descricao,tecnico:nomes[perfil],rotulos:chaves.flatMap(chave=>listaFotos(fotos[chave]).map((_,n)=>`${labels[chave]||chave} · ${n+1}`)),fotos:anexos,hora:new Date().toLocaleTimeString('pt-BR')});ativo.status=`ETAPA ${numero}`;conquistar(`etapa${numero}`);
 $('techLocalStatus').textContent=`Etapa ${numero} enviada no laboratório. Troque para Acompanhamento ou Supervisão para conferir.`;
 if(numero<4)mudarPasso(numero+1);return true;
}
export function iniciarLaboratorio(){
 $('simPerfil').value=perfil;
 const medidas=iniciarLaboratorioMedicoes();
 const modoMedicoes=()=>$('simServico').value==='medicoes';
 const ocultarRompimentos=()=>{for(const id of ['simNoc','simConsulta','simDiretor'])$(id).hidden=true;$('viewTech').style.display='none';document.querySelectorAll('[data-sim-filtro]').forEach(e=>e.remove());};
 $('simServico').onchange=()=>{ativo=null;fecharModal();avisar('');$('simVisao').value='fila';$('simPerfil').value=perfil;if(modoMedicoes()){ocultarRompimentos();medidas.abrir(perfil)}else{medidas.fechar();atualizarRoteiro();renderizar()}};
 $('simVisao').onchange=()=>{fecharModal();if(modoMedicoes())medidas.abrir(perfil);else renderizar()};
 $('simPerfil').onchange=()=>{perfil=$('simPerfil').value;ativo=null;fecharModal();avisar('');if(modoMedicoes()){ocultarRompimentos();medidas.abrir(perfil)}else renderizar()};
 $('simReiniciar').onclick=()=>{if(confirm('Reiniciar somente os dados fictícios deste laboratório?')){if(modoMedicoes())medidas.reiniciar();else iniciarDados();avisar('Laboratório reiniciado.')}};
 $('techFormFlow').addEventListener('input',()=>{$('techEtapa4Erro').hidden=true});
 $('simNocForm').onsubmit=e=>{e.preventDefault();const id=$('simNovoId').value.trim();if(chamados.some(i=>i.id===id)){avisar('Esse ID fictício já existe.');return}chamados.push({id,os:'OS-FICTICIA',cidade:$('simCidade').value.trim(),tecnico:'',supervisor:$('simSupervisorNovo').value,eventos:[],status:'ABERTO'});conquistar('noc');avisar('ID fictício criado com o supervisor do comunicado. Ele distribui à equipe.');renderizar()};
 $('simFechar').onclick=fecharModal;$('modalSim').onclick=e=>{if(e.target===$('modalSim'))fecharModal()};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.defaultPrevented)fecharModal()});
 $('simExportar').onclick=async()=>{const b=$('simExportar');b.disabled=true;try{const {criarRelatorioPDF}=await import('../lib/executive-report.mjs');const scope=perfil==='coordenador'?chamados.filter(i=>i.supervisor==='supervisorA'):chamados;const rows=scope.map(i=>({idIncidente:i.id,os:i.os,cidades:i.cidade,estado:'SP',tipoRede:'GPON',supervisorUid:i.supervisor,supervisorNome:i.supervisor==='supervisorA'?'Supervisor A':'Supervisor B',tecnicoAtribuido:nomes[i.tecnico]||'',statusAtual:i.status==='FINALIZADO'?'ETAPA 4: REPARO CONCLUÍDO / FINALIZADO':i.status,dataTimestamp:Date.now(),timelineEtapas:i.eventos.map(t=>({numeroEtapa:t.numero,etapa:`ETAPA ${t.numero}`,dataHora:t.hora,tecnico:t.tecnico,observacao:t.descricao})),etapaConcluida:i.eventos.length}));const {pdf,nome}=await criarRelatorioPDF(rows,{simulacao:true,emitidoPor:'Laboratório NEXTFLOW',escopo:perfil==='coordenador'?'Somente equipe A (fictícia)':'Dados fictícios'});pdf.save(nome);conquistar('diretor')}catch{avisar('Não foi possível gerar o PDF de simulação.')}finally{b.disabled=false}};
 const exemplo=texto('button','Usar fotos fictícias nesta etapa');exemplo.type='button';exemplo.className='btn-sec-sm sim-example-photos';exemplo.onclick=()=>{
  const chaves=passo===1?['fotoDeslocamento']:passo===2?['fotoChegada','fotoRompimento']:passo===3?['fotoPanoramica','fotoEquipe']:[...$('caixasTecnico').querySelectorAll('input[type=file]')].map(i=>i.id);
  for(const chave of chaves){const atuais=listaFotos(fotos[chave]);if(atuais.length<LIMITE_FOTOS){fotos[chave]=[...atuais,samplePhoto(`Etapa ${passo} · foto ${atuais.length+1}`)];galeria(chave)}}$('techEtapa4Erro').hidden=true;$('techLocalStatus').textContent='Fotos fictícias adicionadas. Preencha as informações obrigatórias antes de enviar.';

 };$('techFormFlow').before(exemplo);iniciarDados();
}
function fecharModal(){fecharFotos();$('modalSim').style.display='none'}
window.liberarAtendimentoTecnico=()=>{ativo=null;renderizar()};
window.voltarEtapaTecnica=()=>avisar('Etapas enviadas estão bloqueadas. Consulte o histórico fictício.');
window.salvarRascunhoTecnico=()=>{};
window.transferirAtendimentoTecnico=()=>{const uid=$('techTransferir').value;if(!uid||!equipe.includes(uid)){avisar('Selecione o técnico fictício.');return}ativo.tecnico=uid;conquistar('transferencia');avisar(`Transferido no laboratório para ${nomes[uid]}.`);ativo=null;renderizar()};
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
function enviarSim(numero,dados,descricao){const validacao=avaliarEtapa(numero,{...dados,fotos});if(!validacao.valido){alert(validacao.mensagem);return false}if(!confirm(`Etapa ${numero}: fotos e informações estão corretas? Depois do envio não poderá voltar.`))return false;return publicar(numero,descricao,categoriasEtapa[numero])}
window.salvarEtapa1=()=>enviarSim(1,{tipoArea:$('techArea').value,condicaoRisco:$('techRisco').value},`Deslocamento em área ${$('techArea').value}. Risco: ${$('techRisco').value}.`);
window.salvarEtapa2=()=>{const causa=$('techCausaRompimento').value.trim(),previsao=$('techPrevisaoInput').value.trim();if(enviarSim(2,{causa,previsao,gpsRompimento:$('techGpsRompimento').value},`Causa: ${causa}. Local do rompimento: ${$('techGpsRompimento').value}. Previsão: ${formatarPrevisao(previsao)}.`)){ativo.causa=causa;ativo.previsao=previsao;$('tobs').value=modeloDescricao(causa);$('techPrevisaoAtual').textContent=`Previsão atual: ${formatarPrevisao(previsao)}`}};
window.salvarEtapa3=()=>{const observacao=$('techObservacaoEtapa3').value.trim(),novaPrevisao=$('techNovaPrevisao').value,motivoPrevisao=observacao.slice(0,1000);const descricao=observacao+(novaPrevisao?`\nPrevisão alterada de ${formatarPrevisao(ativo.previsao)} para ${formatarPrevisao(novaPrevisao)}. Motivo: ${motivoPrevisao}`:'');if(enviarSim(3,{observacao,novaPrevisao,motivoPrevisao},descricao)&&novaPrevisao)ativo.previsao=novaPrevisao};
window.salvarEtapa4Final=()=>{
 if(ativo.eventos.length!==3){avisar('Envie todas as etapas anteriores antes de finalizar.');return}
 const caixas=[...$('caixasTecnico').children].map(el=>{const anexos=listaFotos(fotos[el.querySelector('input[type=file]').id]);return {gps:el.querySelector('.box-gps').value,fotos:anexos,foto:anexos[0]}});const descricao=$('tobs').value.trim();const validacao=avaliarFinalizacao(caixas,descricao);
 $('techEtapa4Erro').hidden=validacao.valido;if(!validacao.valido){$('techEtapa4Erro').textContent=validacao.mensagem;return}
 if(!confirm('Fotos, localizações e descrição estão corretas para finalizar?'))return;publicar(4,descricao,[]);ativo.eventos.at(-1).fotos=caixas.flatMap(caixa=>caixa.fotos);ativo.eventos.at(-1).rotulos=caixas.flatMap((caixa,i)=>caixa.fotos.map((_,n)=>`Caixa ${i+1} · Foto ${n+1}`));ativo.final={caixas,descricao,registroFinal:separarDescricao(descricao)};ativo.status='FINALIZADO';avisar('Atendimento fictício finalizado. Troque para Projetos para ver apenas a etapa 4.');ativo=null;renderizar();
};
