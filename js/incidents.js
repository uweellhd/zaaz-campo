/* ==========================================================================
   NEXTFLOW ENTERPRISE - LOGICA DE PERMISSÕES & INCIDENTES (js/incidents.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, getDocs, updateDoc, runTransaction, query, where, documentId, startAfter, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, verifyBeforeUpdateEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { avaliarFinalizacao, avaliarEtapa, categoriasEtapa, listaFotos, LIMITE_FOTOS, etapaConcluida, exigirProximaEtapa, modeloDescricao, separarDescricao, formatarPrevisao, resolvido } from '../lib/field-flow.mjs';
import { renderizarGaleria } from '../lib/photo-gallery.mjs';
import { montarGaleria, abrirFotos, fecharFotos, fotoAberta } from '../lib/photo-viewer.mjs';
import { selecionarIncidentes, analisarOperacao, leituraExecutiva, dataConclusao, horarioBrasil, diaBrasil } from '../lib/executive-metrics.mjs';
import { criarRelatorioPDF } from '../lib/executive-report.mjs';

const firebaseConfig = {
  apiKey: "AIzaSyCai2zdr3XvyohUL4Z3qllUU__xAtLeaoA",
  authDomain: "nextflow-telecom.firebaseapp.com",
  projectId: "nextflow-telecom",
  storageBucket: "nextflow-telecom.firebasestorage.app",
  messagingSenderId: "1004556368169",
  appId: "1:1004556368169:web:de0de1ca5ade29e13f9f38",
  measurementId: "G-W2Z8ZEHGZS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let perfilSalvo = '';
let usuarioSalvo = '';
let estadoSalvo = '';
let usuarioUid = '';
const ouvintes = new Map();
let saindo = false;
const abasPermitidas = {
  admin: ['viewGerente', 'viewNoc', 'viewSac', 'viewTech', 'viewSupervisor', 'viewProjetos', 'viewConta', 'viewAcessos'],
  gerente: ['viewGerente'],
  diretor: ['viewGerente'],
  noc: ['viewNoc', 'viewSac'],
  sac: ['viewSac'],
  suporte: ['viewSac'],
  tecnico: ['viewTech'],
  supervisor: ['viewSupervisor'],
  projetos: ['viewProjetos']
};

function ouvirUmaVez(chave, consulta, aoReceber) {
  if (ouvintes.has(chave)) return;
  const cancelar = onSnapshot(consulta, aoReceber, erro => {
    console.error(`Falha ao consultar ${chave}:`, erro);
    if (saindo || !auth.currentUser) return;
    alert('Não foi possível consultar os registros. Confira seu perfil e as regras do Firestore.');
  });
  ouvintes.set(chave, cancelar);
}

const badgeElem = document.getElementById('userBadge');
document.addEventListener('click', event => {
  const menu = document.getElementById('accountMenu');
  if (menu?.open && !menu.contains(event.target)) menu.open = false;
});
let tecnicosDisponiveis = [];
let supervisoresDisponiveis = [];
const estadosBrasil = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const el = id => document.getElementById(id);
let cadastrosEquipe = [], vinculosEquipe = [], chamadosSupervisor = [], filtroSupervisor = 'ativos';
let paginaSupervisor = 1, paginaDiretoria = 1, filtroDiretoria = 'ativos';
const TAMANHO_PAGINA = 24;
function elemento(tag, texto, classe) { const e = document.createElement(tag); if (texto) e.textContent=texto; if (classe) e.className=classe; return e; }
function supervisorSelecionado() { return perfilSalvo === 'admin' ? el('equipeSupervisor').value : usuarioUid; }
function membrosAtivos(uid) { return vinculosEquipe.filter(v => v.supervisorUid===uid && v.ativo).map(v=>cadastrosEquipe.find(p=>p.uid===v.tecnicoUid && p.ativo && p.perfil==='tecnico')).filter(Boolean); }
function criarControlesSupervisao() {
  if (el('equipeSupervisor')) return;
  const bloco=elemento('details','', 'team-panel'); bloco.open=false;
  bloco.append(elemento('summary','👥 Gerenciar equipe de técnicos'));
  const corpo=elemento('div','', 'team-panel-body');
  const seletor=elemento('select'); seletor.id='equipeSupervisor'; seletor.setAttribute('aria-label','Supervisor da equipe'); seletor.hidden=perfilSalvo!=='admin';
  seletor.onchange=renderizarEquipe;
  const lista=elemento('div','', 'team-roster'); lista.id='equipeTecnicos';
  const form=elemento('form','', 'assignment-search');
  const pessoas=elemento('select'); pessoas.id='equipeAdicionar'; pessoas.setAttribute('aria-label','Técnico cadastrado para adicionar');
  const botao=elemento('button','＋ Adicionar à equipe','btn-primary'); botao.type='submit';
  form.append(pessoas,botao); form.onsubmit=async e=>{
    e.preventDefault(); const uid=supervisorSelecionado(), pessoa=cadastrosEquipe.find(p=>p.uid===pessoas.value);
    if(!uid || !pessoa || pessoa.perfil!=='tecnico' || !pessoa.ativo){alert('Escolha um supervisor e um técnico ativo.');return}
    botao.disabled=true;
    try { await runTransaction(db,async tx=>{
      const ref=doc(db,'equipesTecnicas',pessoa.uid); const atual=await tx.get(ref);
      if(atual.exists() && atual.data().supervisorUid!==uid && perfilSalvo!=='admin')throw new Error('Este técnico já pertence a outra equipe. Solicite a transferência ao administrador.');
      tx.set(ref,{tecnicoUid:pessoa.uid,supervisorUid:uid,ativo:true,atualizadoEm:serverTimestamp(),atualizadoPorUid:usuarioUid});
    }); } catch(erro){alert(erro.message || 'Não foi possível adicionar o técnico.')} finally{botao.disabled=false}
  };
  corpo.append(elemento('p','Selecione profissionais já aprovados. Cada técnico tem uma equipe principal; o administrador pode transferi-lo.','search-hint'),seletor,lista,form); bloco.append(corpo);
  el('supervisorResultados').before(bloco);
  const filtros=elemento('div','', 'status-tabs'); filtros.setAttribute('aria-label','Situação dos IDs da supervisão');
  for(const [valor,nome] of [['ativos','Em andamento'],['resolvidos','Resolvidos']]) {const b=elemento('button',nome,'btn-sec-sm');b.type='button';b.dataset.status=valor;b.onclick=()=>{filtroSupervisor=valor;paginaSupervisor=1;renderizarSupervisor()};filtros.append(b)}
  filtros.id='supervisorFiltros';el('supervisorResultados').before(filtros);
  const mais=elemento('button','Carregar mais IDs','btn-sec-sm');mais.id='supervisorMais';mais.onclick=()=>{paginaSupervisor++;renderizarSupervisor()};el('supervisorResultados').after(mais);
  ouvirUmaVez('cadastros-tecnicos',query(collection(db,'usuarios'),where('perfil','==','tecnico')),snapshot=>{cadastrosEquipe=snapshot.docs.map(d=>({...d.data(),uid:d.id}));renderizarEquipe();renderizarSupervisor()});
  ouvirUmaVez('vinculos-equipes',collection(db,'equipesTecnicas'),snapshot=>{vinculosEquipe=snapshot.docs.map(d=>({...d.data(),tecnicoUid:d.id}));renderizarEquipe();renderizarSupervisor()});
  if(perfilSalvo==='admin')ouvirUmaVez('supervisores-equipe',query(collection(db,'usuarios'),where('perfil','==','supervisor')),snapshot=>{
    supervisoresDisponiveis=snapshot.docs.map(d=>({...d.data(),uid:d.id})).filter(p=>p.ativo);const anterior=seletor.value;
    seletor.replaceChildren(new Option('Selecione um supervisor',''),...supervisoresDisponiveis.map(p=>new Option(p.nome,p.uid)));seletor.value=anterior;renderizarEquipe();
  });
}
function renderizarEquipe(){
  if(!el('equipeTecnicos'))return; const uid=supervisorSelecionado(),lista=el('equipeTecnicos');lista.replaceChildren();
  for(const pessoa of membrosAtivos(uid)){
    const linha=elemento('div','', 'team-member');linha.append(elemento('strong',pessoa.nome));const b=elemento('button','Remover da equipe','btn-sec-sm');b.type='button';
    b.onclick=async()=>{if(!confirm('Remover da equipe? Os IDs já atribuídos permanecem com o técnico até você redistribuí-los.'))return;b.disabled=true;try{await updateDoc(doc(db,'equipesTecnicas',pessoa.uid),{ativo:false,atualizadoEm:serverTimestamp(),atualizadoPorUid:usuarioUid})}catch{alert('Não foi possível remover.')}finally{b.disabled=false}};linha.append(b);lista.append(linha);
  }
  if(!lista.children.length)lista.append(elemento('p',uid?'Nenhum técnico ativo nesta equipe.':'Selecione um supervisor para montar a equipe.','empty-state'));
  const disponiveis=cadastrosEquipe.filter(p=>p.ativo && !vinculosEquipe.some(v=>v.tecnicoUid===p.uid && (v.ativo || v.supervisorUid!==uid) && !(perfilSalvo==='admin' && v.supervisorUid!==uid)));
  el('equipeAdicionar').replaceChildren(new Option('Selecione um técnico cadastrado',''),...disponiveis.map(p=>new Option(p.nome+(vinculosEquipe.some(v=>v.tecnicoUid===p.uid&&v.supervisorUid!==uid)?' · transferir equipe':''),p.uid)));
}
function renderizarSupervisor(){
  const lista=el('supervisorResultados');if(!lista)return;lista.replaceChildren();
  const vinculados=chamadosSupervisor.filter(i=>i.supervisorUid), encerrados=vinculados.filter(resolvido), abertos=vinculados.filter(i=>!resolvido(i));
  el('supervisorTotal').textContent=String(vinculados.length);el('supervisorPendente').textContent=String(abertos.length);el('supervisorCompleto').textContent=String(encerrados.length);
  el('supervisorFotosFaltantes').textContent=String(abertos.filter(i=>!i.tecnicoUid).length);
  const sem=chamadosSupervisor.filter(i=>!i.supervisorUid).length;el('supervisorAviso').hidden=perfilSalvo!=='admin'||!sem;
  el('supervisorAviso').textContent=`${sem} ID(s) antigos aguardam identificação do supervisor. Use NOC → Conferir responsável para vinculá-los sem modificar o comunicado.`;
  el('supervisorFiltros')?.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.status===filtroSupervisor);b.setAttribute('aria-pressed',String(b.dataset.status===filtroSupervisor))});
  const filtrados=chamadosSupervisor.filter(i=>resolvido(i)===(filtroSupervisor==='resolvidos')).sort((a,b)=>(b.dataTimestamp||0)-(a.dataTimestamp||0));
  for(const item of filtrados.slice(0,paginaSupervisor*TAMANHO_PAGINA)){
    const card=elemento('article','', 'incidente-card supervisor-card'); const abrir=elemento('button','', 'incident-open');abrir.type='button';
    abrir.append(elemento('strong',`ID ${item.idIncidente} · OS ${item.os||'—'}`),elemento('small',`${item.cidades||''} · ${item.statusAtual||'Aguardando atendimento'}`),elemento('span',`Técnico: ${item.tecnicoAtribuido||'A distribuir'}`,item.tecnicoUid?'evidence-complete':'evidence-pending'));abrir.onclick=()=>abrirModalDetalhes(item);card.append(abrir);
    if(!resolvido(item) && item.supervisorUid){
      const form=elemento('form','', 'assignment-search');const seletor=elemento('select');seletor.setAttribute('aria-label',`Técnico da equipe para ID ${item.idIncidente}`);
      seletor.add(new Option('Selecione o técnico da equipe',''));for(const p of membrosAtivos(item.supervisorUid))seletor.add(new Option(p.nome,p.uid));seletor.value=item.tecnicoUid||'';
      const b=elemento('button',item.tecnicoUid?'Redistribuir':'Acionar técnico','btn-primary');b.type='submit';
      form.append(seletor,b);form.onsubmit=async e=>{e.preventDefault();const destino=membrosAtivos(item.supervisorUid).find(p=>p.uid===seletor.value);if(!destino){alert('Escolha um técnico ativo desta equipe.');return}b.disabled=true;
        try{await runTransaction(db,async tx=>{const ref=doc(db,'incidentes',item.docId);const atual=await tx.get(ref);const vinculo=await tx.get(doc(db,'equipesTecnicas',destino.uid));const pessoa=await tx.get(doc(db,'usuarios',destino.uid));if(!atual.exists()||resolvido(atual.data())||atual.data().supervisorUid!==item.supervisorUid||!vinculo.exists()||!vinculo.data().ativo||vinculo.data().supervisorUid!==item.supervisorUid||!pessoa.exists()||!pessoa.data().ativo||pessoa.data().perfil!=='tecnico')throw new Error('O ID ou a equipe mudou. Confira novamente.');tx.update(ref,{tecnicoUid:destino.uid,tecnicoAtribuido:pessoa.data().nome,atribuidoEm:serverTimestamp(),atribuidoPorUid:usuarioUid,atribuidoPorNome:usuarioSalvo})});}catch(erro){alert(erro.message||'Não foi possível distribuir o ID.')}finally{b.disabled=false}
      };card.append(form);
    }lista.append(card);
  }
  if(!filtrados.length)lista.append(elemento('p',filtroSupervisor==='resolvidos'?'Nenhum ID resolvido neste acompanhamento.':'Nenhum ID em andamento. Confira o vínculo do supervisor e a equipe.','empty-state'));
  if(el('supervisorMais'))el('supervisorMais').hidden=filtrados.length<=paginaSupervisor*TAMANHO_PAGINA;
}
async function carregarTecnicosDisponiveis(){
  if(!['admin','noc'].includes(perfilSalvo))return;
  const resultado=await getDocs(query(collection(db,'usuarios'),where('perfil','==','supervisor')));
  supervisoresDisponiveis=resultado.docs.map(d=>({...d.data(),uid:d.id})).filter(p=>p.ativo);
}
el('formBuscarAtribuicao')?.addEventListener('submit',async evento=>{
  evento.preventDefault();if(!['admin','noc'].includes(perfilSalvo))return;const resultados=el('resultadosAtribuicao');resultados.textContent='Buscando...';
  try{await carregarTecnicosDisponiveis();const consulta=await getDocs(query(collection(db,'incidentes'),where('idIncidente','==',el('buscaAtribuicao').value.trim()),limit(10)));resultados.replaceChildren();
    for(const documento of consulta.docs){const item=documento.data(),card=elemento('div','', 'approval-card');card.append(elemento('strong',`ID ${item.idIncidente} · Responsável no comunicado: ${item.responsavel||'Não informado'}`));
      const seletor=elemento('select');seletor.setAttribute('aria-label','Conta do supervisor responsável');seletor.replaceChildren(new Option('Selecione o supervisor identificado',''),...supervisoresDisponiveis.map(p=>new Option(p.nome,p.uid)));seletor.value=item.supervisorUid||'';
      const b=elemento('button','Confirmar responsável','btn-sec-sm');b.type='button';b.onclick=async()=>{const escolhido=supervisoresDisponiveis.find(p=>p.uid===seletor.value);if(!escolhido)return;
        if(item.supervisorUid!==escolhido.uid && item.tecnicoUid && !resolvido(item) && !confirm('A mudança de supervisor retirará a atribuição atual para o novo supervisor redistribuir. Continuar?'))return;
        b.disabled=true;try{await runTransaction(db,async tx=>{const ref=doc(db,'incidentes',documento.id),atual=await tx.get(ref);if(!atual.exists())throw new Error('ID não encontrado.');const data=atual.data();const patch={supervisorUid:escolhido.uid,supervisorNome:escolhido.nome,supervisorVinculoOrigem:'CONFIRMACAO_MANUAL'};if(data.supervisorUid!==escolhido.uid&&!resolvido(data)){patch.tecnicoUid='';patch.tecnicoAtribuido=''}tx.update(ref,patch)});alert('Responsável confirmado. O supervisor já pode distribuir o atendimento.')}catch{alert('Não foi possível confirmar o responsável.')}finally{b.disabled=false}
      };card.append(seletor,b);resultados.append(card);
    }if(consulta.empty)resultados.textContent='Nenhum ID encontrado.';
  }catch{resultados.textContent='Não foi possível buscar. Confira a conexão e tente novamente.'}
});
function prepararIdentidadesIxc(){
  if(perfilSalvo!=='admin'||el('formIdentidadeIxc'))return;
  const secao=elemento('details','', 'team-panel');secao.append(elemento('summary','🔗 Identificadores únicos do IXC'));
  const corpo=elemento('div','', 'team-panel-body');corpo.append(elemento('p','Cadastre o ID exato do usuário supervisor no IXC. Novos comunicados com o campo ID USUÁRIO IXC ou ID SUPERVISOR IXC serão vinculados à conta correspondente. Não usamos semelhança de nomes.','search-hint'));
  const form=elemento('form','', 'assignment-search');form.id='formIdentidadeIxc';const id=elemento('input');id.required=true;id.pattern='[0-9]{1,20}';id.inputMode='numeric';id.placeholder='ID do usuário no IXC';id.setAttribute('aria-label','ID do usuário supervisor no IXC');const supervisor=elemento('select');supervisor.required=true;supervisor.setAttribute('aria-label','Supervisor correspondente no NEXTFLOW');
  carregarTecnicosDisponiveis().then(()=>supervisor.replaceChildren(new Option('Selecione o supervisor',''),...supervisoresDisponiveis.map(p=>new Option(p.nome,p.uid)))).catch(()=>{});
  const salvar=elemento('button','Salvar identificação','btn-primary');salvar.type='submit';form.append(id,supervisor,salvar);const lista=elemento('div','', 'team-roster');
  form.onsubmit=async e=>{e.preventDefault();if(!/^[0-9]{1,20}$/.test(id.value))return;const pessoa=supervisoresDisponiveis.find(p=>p.uid===supervisor.value);if(!pessoa)return;salvar.disabled=true;
    try{await runTransaction(db,async tx=>{const ref=doc(db,'identidadesIxc',id.value),atual=await tx.get(ref);if(atual.exists()&&atual.data().supervisorUid!==pessoa.uid)throw new Error('Este ID IXC já está vinculado a outra conta. Revise o cadastro antes de alterar.');tx.set(ref,{supervisorUid:pessoa.uid,supervisorNome:pessoa.nome,atualizadoEm:serverTimestamp(),atualizadoPorUid:usuarioUid})});id.value='';}catch(erro){alert(erro.message||'Não foi possível salvar.')}finally{salvar.disabled=false}
  };corpo.append(form,lista);secao.append(corpo);el('listaEquipe').before(secao);
  ouvirUmaVez('identidades-ixc',collection(db,'identidadesIxc'),snapshot=>{lista.replaceChildren();for(const d of snapshot.docs)lista.append(elemento('p',`IXC ${d.id} → ${d.data().supervisorNome}`));if(snapshot.empty)lista.append(elemento('p','Nenhuma identificação cadastrada.','empty-state'))});
}

// LÓGICA DE VISIBILIDADE DAS ABAS BASEADA EM PERMISSÕES DINÂMICAS (RBAC)
function configurarTelasPorPerfil() {
  const btnGerente = document.getElementById('btnTabGerente');
  const btnNoc = document.getElementById('btnTabNoc');
  const btnSac = document.getElementById('btnTabSac');
  const btnTech = document.getElementById('btnTabTech');
  const btnConta = document.getElementById('btnTabConta');
  const btnAcessos = document.getElementById('btnTabAcessos');
  const btnSimular = document.getElementById('btnSimularSetores');
  if (btnSimular) btnSimular.style.display = perfilSalvo === 'admin' ? 'block' : 'none';
  const btnSupervisor = document.getElementById('btnTabSupervisor');
  const btnProjetos = document.getElementById('btnTabProjetos');
  // Oculta todas as abas inicialmente
  [btnGerente, btnNoc, btnSac, btnTech, btnConta, btnAcessos, btnSupervisor, btnProjetos].forEach(btn => { if (btn) btn.style.display = 'none'; });
  if (btnConta) btnConta.style.display = 'block';
  document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');

  if (perfilSalvo === 'admin') {
    // Administrador da operação vê as quatro áreas.
    [btnGerente, btnNoc, btnSac, btnTech, btnSupervisor, btnProjetos].forEach(btn => { if (btn) btn.style.display = 'inline-block'; });
    if (btnAcessos) btnAcessos.style.display = 'block';
    carregarSolicitacoes();
    alternarAba('viewGerente');
  } else if (perfilSalvo === 'gerente' || perfilSalvo === 'diretor') {
    [btnGerente].forEach(btn => { if (btn) btn.style.display = 'inline-block'; });
    alternarAba('viewGerente');
  } else if (perfilSalvo === 'noc') {
    [btnNoc, btnSac].forEach(btn => { if (btn) btn.style.display = 'inline-block'; });
    alternarAba('viewNoc');
  } else if (perfilSalvo === 'tecnico') {
    if (btnTech) btnTech.style.display = 'inline-block';
    const displayNome1 = document.getElementById('techNomeDisplayStage1');
    if (displayNome1) displayNome1.textContent = usuarioSalvo;
    alternarAba('viewTech');
  } else if (perfilSalvo === 'supervisor') {
    if (btnSupervisor) btnSupervisor.style.display = 'inline-block';
    alternarAba('viewSupervisor');
  } else if (perfilSalvo === 'projetos') {
    if (btnProjetos) btnProjetos.style.display = 'inline-block';
    alternarAba('viewProjetos');
  } else {
    // SAC e Suporte
    if (btnSac) btnSac.style.display = 'inline-block';
    alternarAba('viewSac');
  }
}

window.alternarAba = (idAba) => {
  if (idAba !== 'viewConta' && !(abasPermitidas[perfilSalvo] || []).includes(idAba)) return;
  const conta = document.getElementById('accountMenu');
  if (conta) conta.open = false;
  document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const abaAlvo = document.getElementById(idAba);
  if (abaAlvo) abaAlvo.style.display = 'block';

  if (idAba === 'viewGerente') {
    const b = document.getElementById('btnTabGerente');
    if (b) b.classList.add('active');
    carregarDashboardGerente();
  } else if (idAba === 'viewNoc') {
    const b = document.getElementById('btnTabNoc');
    if (b) b.classList.add('active');
  } else if (idAba === 'viewSac') {
    const b = document.getElementById('btnTabSac');
    if (b) b.classList.add('active');
    carregarIncidentesSac();
  } else if (idAba === 'viewTech') {
    const b = document.getElementById('btnTabTech');
    if (b) b.classList.add('active');
    carregarListaTecnico();
  } else if (idAba === 'viewConta') {
    document.getElementById('btnTabConta')?.classList.add('active');
  } else if (idAba === 'viewAcessos') {
    document.getElementById('btnTabAcessos')?.classList.add('active');
  } else if (idAba === 'viewSupervisor') {
    document.getElementById('btnTabSupervisor')?.classList.add('active');
    carregarSupervisor();
  } else if (idAba === 'viewProjetos') {
    document.getElementById('btnTabProjetos')?.classList.add('active');
    carregarProjetos();
  }
};

function nomeCurto(nome) {
  return String(nome || '').trim().split(/\s+/).slice(0, 2).join(' ');
}

function fotosPendentesEtapas(incidente) {
  const etapas = new Map();
  for (const evento of incidente.timelineEtapas || []) {
    const numero = String(evento.etapa || '').match(/^ETAPA ([123])/);
    if (numero) etapas.set(numero[1], evento);
  }
  return [...etapas.values()].reduce((total, evento) => total + Number(evento.fotosPendentes ?? Math.max(0, (evento.etapa.startsWith('ETAPA 1') ? 1 : 2) - (evento.fotoIds || []).length)), 0);
}

function carregarProjetos() {
  ouvirUmaVez('projetos', collection(db, 'projetosEvidencias'), snapshot => {
    const lista = document.getElementById('projetosResultados');
    lista.replaceChildren();
    if (snapshot.empty) { lista.textContent = 'Ainda não há entregas da etapa 4.'; return; }
    snapshot.forEach(documento => {
      const registro = documento.data();
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'incidente-card supervisor-card project-list-card';
      const titulo = document.createElement('strong'); titulo.textContent = `ID ${registro.idIncidente}`;
      const identificacao = document.createElement('small'); identificacao.textContent = `OS ${registro.os || '—'} · ${registro.estado} · ${(registro.caixas || []).length} caixas`;
      const status = document.createElement('span');
      status.className = registro.statusOzmaps === 'REGISTRADO' ? 'evidence-complete' : 'evidence-pending';
      status.textContent = registro.statusOzmaps === 'REGISTRADO' ? 'Registrado no OZmaps' : 'Aguardando lançamento no OZmaps';
      const ajuda = document.createElement('small'); ajuda.textContent = 'Ver serviço, coordenadas e fotos →';
      card.append(titulo, identificacao, status, ajuda);
      card.onclick = () => abrirModalProjeto(documento.id, registro);
      lista.append(card);
    });
  });
}
let geracaoModalProjeto = 0;
let focoProjetoAnterior;
function abrirModalProjeto(id, registro) {
  const geracao = ++geracaoModalProjeto;
  const modal = document.getElementById('modalProjetos');
  const conteudo = document.getElementById('modalProjetoConteudo');
  focoProjetoAnterior = document.activeElement;
  document.getElementById('modalProjetoTitulo').textContent = `ID ${registro.idIncidente} · Projetos`;
  conteudo.replaceChildren();
  const identificacao = document.createElement('p'); identificacao.textContent = `OS ${registro.os || '—'} · Estado ${registro.estado}`;
  const descricao = document.createElement('p'); descricao.textContent = `Serviço realizado: ${registro.descricaoServico}`;
  const status = document.createElement('p'); status.textContent = `OZmaps: ${registro.statusOzmaps === 'REGISTRADO' ? 'Registrado' : 'Pendente'}`;
  conteudo.append(identificacao, descricao, status);
  for (const caixa of registro.caixas || []) {
    const linha = document.createElement('div'); linha.className = 'project-box';
    const info = document.createElement('strong'); info.textContent = `Caixa ${caixa.numero} · GPS ${caixa.gps}`;
    linha.append(info);
    const galeria=elemento('div','', 'evidence-gallery');linha.append(galeria);
    const fotosCaixa=(registro.fotoIds||[]).slice(caixa.indiceFoto,caixa.indiceFoto+(caixa.quantidadeFotos||1));
    carregarGaleriaRegistrada(galeria,fotosCaixa,fotosCaixa.map((_,n)=>`Caixa ${caixa.numero} · Foto ${n+1}`),()=>geracao===geracaoModalProjeto);
    conteudo.append(linha);
  }
  const tratamento = document.createElement('form'); tratamento.className = 'project-treatment field-card';
  const titulo = document.createElement('h4'); titulo.textContent = 'Tratamento em Projetos';
  const observacaoLabel = document.createElement('label'); observacaoLabel.textContent = 'Observação / referência no OZmaps'; observacaoLabel.htmlFor = 'projetoObservacao';
  const observacao = document.createElement('textarea'); observacao.id = 'projetoObservacao'; observacao.maxLength = 2000; observacao.rows = 3; observacao.placeholder = 'Informe o que foi registrado, referências das caixas ou observações.'; observacao.value = registro.observacaoOzmaps || '';
  const confirmacao = document.createElement('label'); confirmacao.className = 'project-check';
  const check = document.createElement('input'); check.type = 'checkbox'; check.required = true; check.checked = registro.statusOzmaps === 'REGISTRADO';
  confirmacao.append(check, document.createTextNode('Confirmo que as caixas foram registradas no OZmaps e a entrega foi tratada.'));
  const responsavel = document.createElement('p'); responsavel.className = 'project-audit';
  const data = registro.tratadoEm?.toDate?.();
  responsavel.textContent = registro.tratadoPorNome ? `Responsável: ${registro.tratadoPorNome}${data ? ' · ' + data.toLocaleString('pt-BR') : ''}` : (check.checked ? 'Registro anterior sem identificação do responsável.' : `Será registrado por: ${usuarioSalvo}`);
  const botao = document.createElement('button'); botao.type = 'submit'; botao.className = 'btn-primary'; botao.textContent = '✓ Confirmar tratamento';
  const feedback = document.createElement('p'); feedback.className = 'account-feedback'; feedback.setAttribute('role','status');
  tratamento.append(titulo, observacaoLabel, observacao, confirmacao, responsavel, botao, feedback);
  tratamento.onsubmit = async event => {
    event.preventDefault(); if (!check.checked) return; botao.disabled = true;
    try {
      await updateDoc(doc(db, 'projetosEvidencias', id), { statusOzmaps: 'REGISTRADO', observacaoOzmaps: observacao.value.trim(), tratadoPorUid: usuarioUid, tratadoPorNome: usuarioSalvo, tratadoEm: serverTimestamp() });
      status.textContent = 'OZmaps: Registrado'; responsavel.textContent = `Responsável: ${usuarioSalvo} · ${new Date().toLocaleString('pt-BR')}`; feedback.textContent = 'Tratamento salvo com responsável, data e observação.';
    } catch { feedback.textContent = 'Não foi possível salvar. Confira a conexão e tente novamente.'; }
    finally { botao.disabled = false; }
  };
  conteudo.append(tratamento);
  modal.style.display = 'flex';
  modal.querySelector('.modal-close').focus();
}
window.fecharModalProjeto = () => {
  geracaoModalProjeto++;
  document.getElementById('modalProjetos').style.display = 'none';
  focoProjetoAnterior?.focus();
};
document.getElementById('modalProjetos')?.addEventListener('click', event => {
  if (event.target === event.currentTarget) fecharModalProjeto();
});

function carregarSupervisor() {
  criarControlesSupervisao();
  const consulta=perfilSalvo==='admin'?collection(db,'incidentes'):query(collection(db,'incidentes'),where('supervisorUid','==',usuarioUid));
  ouvirUmaVez('supervisor',consulta,snapshot=>{chamadosSupervisor=snapshot.docs.map(d=>({...d.data(),docId:d.id}));renderizarSupervisor()});
}

function carregarSolicitacoes() {
  if (perfilSalvo !== 'admin') return;
  prepararIdentidadesIxc();
  ouvirUmaVez('equipe', collection(db, 'usuarios'), snapshot => {
    const lista = document.getElementById('listaEquipe');
    lista.replaceChildren();
    snapshot.forEach(documento => {
      const pessoa = documento.data();
      if (documento.id === usuarioUid) return;
      const card = document.createElement('div');
      card.className = 'approval-card';
      const nome = document.createElement('strong');
      nome.textContent = pessoa.nome || documento.id;
      const perfil = document.createElement('select');
      perfil.setAttribute('aria-label', `Função de ${pessoa.nome}`);
      for (const [valor, texto] of Object.entries({ sac: 'SAC', suporte: 'Suporte', noc: 'NOC', tecnico: 'Técnico', supervisor: 'Supervisor', projetos: 'Projetos', gerente: 'Gerente', diretor: 'Diretor' })) {
        perfil.add(new Option(texto, valor));
      }
      perfil.value = pessoa.perfil;
      const estado = document.createElement('select');
      estado.setAttribute('aria-label', `Estado de ${pessoa.nome}`);
      for (const valor of ['TODOS', ...estadosBrasil]) estado.add(new Option(valor, valor));
      estado.value = pessoa.estado;
      const ativo = document.createElement('input');
      ativo.type = 'checkbox';
      ativo.checked = pessoa.ativo === true;
      ativo.setAttribute('aria-label', `Conta ativa de ${pessoa.nome}`);
      const salvar = document.createElement('button');
      salvar.type = 'button';
      salvar.className = 'btn-sec-sm';
      salvar.textContent = 'Salvar acesso';
      salvar.addEventListener('click', async () => {
        if (!perfil.value || !estado.value) { alert('Escolha função e estado válidos.'); return; }

        salvar.disabled = true;
        try {
          await updateDoc(doc(db, 'usuarios', documento.id), { perfil: perfil.value, estado: estado.value, ativo: ativo.checked });
        } catch (erro) { alert('Não foi possível atualizar o acesso.'); }
        finally { salvar.disabled = false; }
      });
      card.append(nome, perfil, estado, ativo, salvar);
      lista.append(card);
    });
    if (!lista.children.length) lista.textContent = 'Só sua conta está cadastrada.';
  });
  ouvirUmaVez('solicitacoes', query(collection(db, 'solicitacoesAcesso'), where('status', '==', 'pendente')), snapshot => {
    const lista = document.getElementById('listaSolicitacoes');
    const badge = document.getElementById('badgePendentes');
    badge.textContent = String(snapshot.size);
    badge.hidden = snapshot.empty;
    lista.replaceChildren();
    if (snapshot.empty) {
      const vazio = document.createElement('p');
      vazio.className = 'empty-state';
      vazio.textContent = 'Nenhuma solicitação pendente.';
      lista.append(vazio);
      return;
    }
    snapshot.forEach(documento => {
      const pedido = documento.data();
      const card = document.createElement('div');
      card.className = 'approval-card';
      const titulo = document.createElement('strong');
      titulo.textContent = pedido.nome;
      const email = document.createElement('small');
      email.textContent = pedido.email;
      const perfil = document.createElement('select');
      perfil.setAttribute('aria-label', `Função de ${pedido.nome}`);
      for (const [valor, texto] of Object.entries({ sac: 'SAC', suporte: 'Suporte', noc: 'NOC', tecnico: 'Técnico', supervisor: 'Supervisor', projetos: 'Projetos', gerente: 'Gerente', diretor: 'Diretor' })) {
        perfil.add(new Option(texto, valor));
      }
      const estado = document.createElement('select');
      estado.setAttribute('aria-label', `Estado de ${pedido.nome}`);
      for (const valor of ['TODOS', ...estadosBrasil]) estado.add(new Option(valor, valor));
      const aprovar = document.createElement('button');
      aprovar.type = 'button';
      aprovar.className = 'btn-primary';
      aprovar.textContent = 'Aprovar';
      aprovar.addEventListener('click', async () => {

        aprovar.disabled = true;
        try {
          await runTransaction(db, async transacao => {
            const pedidoRef = doc(db, 'solicitacoesAcesso', documento.id);
            const perfilRef = doc(db, 'usuarios', documento.id);
            const pedidoAtual = await transacao.get(pedidoRef);
            const perfilAtual = await transacao.get(perfilRef);
            if (!pedidoAtual.exists() || pedidoAtual.data().status !== 'pendente' || perfilAtual.exists()) {
              throw new Error('O pedido já foi tratado. Atualize a página.');
            }
            transacao.set(perfilRef, { nome: pedidoAtual.data().nome, perfil: perfil.value, estado: estado.value, ativo: true });
            transacao.update(pedidoRef, { status: 'aprovado', revisadoEm: serverTimestamp(), revisadoPor: usuarioUid });
          });
        } catch (erro) {
          alert(erro.message || 'Não foi possível aprovar.');
          aprovar.disabled = false;
        }
      });
      card.append(titulo, email, perfil, estado, aprovar);
      lista.append(card);
    });
  });
}

document.getElementById('formAlterarEmail')?.addEventListener('submit', async event => {
  event.preventDefault();
  if (perfilSalvo !== 'admin' || !auth.currentUser) return;
  const novoEmail = document.getElementById('novoEmail').value.trim().toLowerCase();
  const aviso = document.getElementById('avisoAlterarEmail');
  const botao = document.getElementById('btnAlterarEmail');
  if (!/^[^\s@]+@zaaztelecom\.com\.br$/.test(novoEmail)) {
    aviso.textContent = 'Use um e-mail terminado em @zaaztelecom.com.br.';
    return;
  }
  botao.disabled = true;
  aviso.textContent = 'Enviando confirmação...';
  try {
    await verifyBeforeUpdateEmail(auth.currentUser, novoEmail);
    aviso.textContent = 'Enviamos um link ao novo e-mail. Abra a mensagem, confirme a troca e depois entre novamente.';
    document.getElementById('novoEmail').value = '';
  } catch (erro) {
    console.error('Falha ao solicitar troca do e-mail:', erro);
    aviso.textContent = erro.code === 'auth/requires-recent-login'
      ? 'Saia, entre novamente com seu e-mail atual e tente de novo.'
      : erro.code === 'auth/email-already-in-use'
        ? 'Esse e-mail já pertence a outra conta. Não crie uma nova conta; procure o administrador.'
        : 'Não foi possível enviar a confirmação. Confira o endereço e tente novamente.';
  } finally {
    botao.disabled = false;
  }
});

function iniciarRelocioTempoReal() {
  const elemClock = document.getElementById('realtimeClock');
  const elemDate = document.getElementById('realtimeDate');

  function atualizar() {
    const agora = new Date();
    if (elemClock) elemClock.textContent = agora.toLocaleTimeString('pt-BR');
    if (elemDate) elemDate.textContent = agora.toLocaleDateString('pt-BR');
  }
  atualizar();
  setInterval(atualizar, 1000);
}
iniciarRelocioTempoReal();

window.mudarTemaSistema = (tema) => {
  const body = document.getElementById('appBody');
  if (!['theme-light', 'theme-dark', 'theme-zaaz'].includes(tema)) tema = 'theme-light';
  body.className = `dashboard-body ${tema}`;
  localStorage.setItem('user_theme', tema);
};

const temaSalvo = localStorage.getItem('user_theme') === 'theme-neon'
  ? 'theme-zaaz' : (localStorage.getItem('user_theme') || 'theme-light');
mudarTemaSistema(temaSalvo);
const selectTema = document.getElementById('themeSelector');
if (selectTema) selectTema.value = temaSalvo;

function comprimirEMarcarDagua(file, textoMarca) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const escala = Math.min(1, 900 / Math.max(img.width,img.height));
        const width=Math.max(1,Math.round(img.width*escala)),height=Math.max(1,Math.round(img.height*escala));
        canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,width,height);
        const fonte=Math.max(10,Math.min(16,Math.round(width/36))), margem=Math.min(12,width/10), linhas=[];
        ctx.font=`bold ${fonte}px Inter, sans-serif`;
        for(const parte of textoMarca.split('|')){
          let linha='';for(const palavra of parte.trim().split(/\s+/)){const tentativa=linha?linha+' '+palavra:palavra;if(linha&&ctx.measureText(tentativa).width>width-2*margem){linhas.push(linha);linha=palavra}else linha=tentativa}if(linha)linhas.push(linha);
        }
        const altura=linhas.length*(fonte+5)+12;
        ctx.fillStyle='rgba(0,0,0,.68)';ctx.fillRect(0,height-altura,width,altura);
        ctx.fillStyle='#FFFFFF';linhas.forEach((linha,n)=>ctx.fillText(linha,margem,height-altura+fonte+6+n*(fonte+5),width-2*margem));

        let qualidade = 0.7;
        let foto = canvas.toDataURL('image/jpeg', qualidade);
        while (foto.length > 650000 && qualidade > 0.35) {
          qualidade -= 0.1;
          foto = canvas.toDataURL('image/jpeg', qualidade);
        }
        if (foto.length > 650000) reject(new Error('Foto muito grande. Tente outra imagem.'));
        else resolve(foto);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function extrairCampo(texto, rotulo) {
  const regex = new RegExp(rotulo + "\\s*:\\s*(.*)", "i");
  const match = texto.match(regex);
  return match ? match[1].trim() : "";
}

function gerarIdAutomatico() {
  const numero = Math.floor(1000 + Math.random() * 9000);
  return `INC-${numero}`;
}

function detectarEstado(cidadesStr) {
  const c = cidadesStr.toUpperCase();
  const sigla = c.match(/(?:^|[^A-Z])(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)(?:$|[^A-Z])/);
  if (sigla) return sigla[1];
  if (c.includes('MINAS')) return 'MG';
  if (c.includes('PARANÁ') || c.includes('PARANA')) return 'PR';
  return 'SP';
}

function detectarTipoRede(texto) {
  const t = texto.toUpperCase();
  if (t.includes("BACKBONE") || t.includes("TRONCAL") || t.includes("FIBRA DEDICADA")) return "BACKBONE";
  return "GPON";
}

function verificarEExcluirExpirados(docSnap) {
  // O histórico é necessário para prestação de contas; não apagar durante a leitura.
  return false;
}

function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[caractere]);
}

// 2. REGISTRO NOC
const formNoc = document.getElementById('formNocIncidente');
if (formNoc) {
  formNoc.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarNoc');
    const textoBruto = document.getElementById('nocTextoComunicado').value.trim();

    btn.textContent = "⏳ Lendo e registrando...";
    btn.disabled = true;

    try {
      let idIncidenteExt = extrairCampo(textoBruto, "ID INCIDENTE") || extrairCampo(textoBruto, "ID");
      if (!idIncidenteExt) idIncidenteExt = gerarIdAutomatico();

      const cidadesExt = extrairCampo(textoBruto, "CIDADES AFETADAS") || "Geral / SP";
      const estadoExt = detectarEstado(cidadesExt);
      const tipoRedeExt = detectarTipoRede(textoBruto);

      const ixcUsuarioId=extrairCampo(textoBruto,'ID USUÁRIO IXC')||extrairCampo(textoBruto,'ID USUARIO IXC')||extrairCampo(textoBruto,'ID SUPERVISOR IXC')||'';
      let identidade=null;
      if(/^[0-9]{1,20}$/.test(ixcUsuarioId)){
        const registro=await getDoc(doc(db,'identidadesIxc',ixcUsuarioId));
        if(registro.exists()) { const pessoa=await getDoc(doc(db,'usuarios',registro.data().supervisorUid)); if(pessoa.exists()&&pessoa.data().ativo&&pessoa.data().perfil==='supervisor')identidade={uid:pessoa.id,nome:pessoa.data().nome}; }
      }
      await addDoc(collection(db, "incidentes"), {
        idIncidente: idIncidenteExt,
        os: extrairCampo(textoBruto, "ORDEM DE SERVIÇO") || "Não informada",
        cidades: cidadesExt,
        estado: estadoExt,
        tipoRede: tipoRedeExt,
        olt: extrairCampo(textoBruto, "OLT") || "N/A",
        portas: extrairCampo(textoBruto, "PORTAS AFETADAS") || "N/A",
        incidenteTipo: extrairCampo(textoBruto, "INCIDENTE") || "REDE",
        clientesCount: parseInt(extrairCampo(textoBruto, "CLIENTES AFETADOS") || "0", 10) || 0,
        responsavel: extrairCampo(textoBruto, "RESPONSÁVEL") || usuarioSalvo,
        ixcUsuarioId, supervisorUid:identidade?.uid||'', supervisorNome:identidade?.nome||'', supervisorVinculoOrigem:identidade?'IXC_ID':'PENDENTE',
        previsao: extrairCampo(textoBruto, "PREVISÃO") || "A definir",
        statusAtual: extrairCampo(textoBruto, "STATUS ATUAL") || "AGUARDANDO TÉCNICO",
        descricao: extrairCampo(textoBruto, "DESCRIÇÃO") || textoBruto,
        textoCompleto: textoBruto,
        tecnicoAtribuido: "",
        tecnicoUid: "",
        timelineEtapas: [],
        dataTimestamp: new Date().getTime(),
        dataCriacao: new Date().toLocaleString("pt-BR")
      });

      alert(`⚡ Comunicado publicado com sucesso!\nID: ${idIncidenteExt}${identidade?"\nSupervisor identificado pelo ID IXC.":"\nResponsável ainda precisa de confirmação em Conferir responsável."}`);
      formNoc.reset();
      btn.textContent = "⚡ Processar e Publicar Comunicado";
      btn.disabled = false;
    } catch (err) {
      alert("Erro ao registrar: " + err.message);
      btn.textContent = "⚡ Processar e Publicar Comunicado";
      btn.disabled = false;
    }
  });
}

// 3. DASHBOARD GERENCIAL
let todosIncidentesCache = [];
let estadoFiltroAtivo = "TODOS";
let chartTipoInstance = null;
let chartEstadosInstance = null;
let chartSupervisoresInstance = null, chartEtapasInstance=null, chartConclusoesInstance=null;
window.filtrarSituacaoDiretoria = valor => { filtroDiretoria=valor==='resolvidos'?'resolvidos':'ativos';paginaDiretoria=1;renderizarPainelGerenteFiltrado(); };
window.maisDiretoria = () => {paginaDiretoria++;renderizarPainelGerenteFiltrado()};

function carregarDashboardGerente() {
  ouvirUmaVez('gerente', collection(db, "incidentes"), (snapshot) => {
    todosIncidentesCache = [];

    snapshot.forEach((docSnap) => {
      if (verificarEExcluirExpirados(docSnap)) return;
      const item = docSnap.data();
      item.docId = docSnap.id;
      todosIncidentesCache.push(item);
    });

    renderizarPainelGerenteFiltrado();
  });
}

function filtrosDiretoria(){return {inicio:document.getElementById('relatorioInicio').value,fim:document.getElementById('relatorioFim').value,estado:estadoFiltroAtivo,supervisor:document.getElementById('relatorioSupervisor').value.trim()};}
window.atualizarRecorteDiretoria = () => {paginaDiretoria=1;renderizarPainelGerenteFiltrado()};
window.limparRecorteDiretoria = () => {for(const id of ['relatorioInicio','relatorioFim','relatorioSupervisor'])document.getElementById(id).value='';filtrarPainelPorEstado('TODOS')};
window.filtrarPainelPorEstado = estado => {estadoFiltroAtivo=estado;document.getElementById('relatorioEstado').value=estado;atualizarRecorteDiretoria()};
function recorteValido(){const f=filtrosDiretoria();const valido=!f.inicio||!f.fim||f.inicio<=f.fim;document.getElementById('avisoRelatorio').textContent=valido?'':'A data inicial deve ser anterior ou igual à data final.';document.getElementById('btnRelatorioPDF').disabled=!valido;return valido;}

function renderizarPainelGerenteFiltrado() {
  if(!recorteValido())return;
  const filtros=filtrosDiretoria(),filtrados=selecionarIncidentes(todosIncidentesCache,filtros,detectarEstado);
  const metricas=analisarOperacao(filtrados,detectarEstado);
  const global=analisarOperacao(selecionarIncidentes(todosIncidentesCache,filtros,detectarEstado,true),detectarEstado);
  const estadosContagem=new Map(metricas.estados.map(e=>[e.nome,e.ativos]));
  const contagemRegioes=new Map(global.estados.map(e=>[e.nome,e.ativos]));
  const supervisoresMap=Object.fromEntries(metricas.supervisores.map((e,n)=>[n,{nome:e.nome,total:e.ativos,compliance:e.resolvidos}]));
  const container=document.getElementById('gerenteIncidentesList');if(!container)return;container.innerHTML='';
  document.getElementById('tituloListaConsolidada').textContent=estadoFiltroAtivo==='TODOS'?'Chamados da operação':`Chamados em ${estadoFiltroAtivo}`;
  document.getElementById('painelEscopo').textContent=estadoFiltroAtivo==='TODOS'?'Todos os estados':`Estado: ${estadoFiltroAtivo}`;
  document.getElementById('recorteDiretoria').textContent=`Abertos: ${filtros.inicio||'sem limite inicial'} a ${filtros.fim||'sem limite final'} · ${filtros.supervisor?'Supervisor: '+filtros.supervisor:'Todos os supervisores'} · ${filtrados.length} registros. Indicadores, PDF e CSV incluem as duas situações.`;

    filtrados.forEach(item => {
    const encerrado = resolvido(item);
    if(encerrado!==(filtroDiretoria==='resolvidos'))return;
    if(container.children.length>=paginaDiretoria*TAMANHO_PAGINA)return;
    const est = item.estado || 'Não informado';
    const card = document.createElement('div');
    card.className = 'incidente-card';
    card.onclick = () => abrirModalDetalhes(item);
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="color:var(--zaaz-blue);">ID: ${escaparHtml(item.idIncidente)} | OS: ${escaparHtml(item.os)}</strong>
        <span style="background:#FEF3C7; color:#92400E; padding:3px 8px; border-radius:6px; font-weight:700; font-size:11px;">${escaparHtml(item.statusAtual)}</span>
      </div>
      <p style="margin: 8px 0; font-size: 13px;"><strong>Cidades:</strong> ${escaparHtml(item.cidades)} (${escaparHtml(est)}) | <strong>Rede:</strong> ${escaparHtml(item.tipoRede || 'GPON')}</p>
      <p style="font-size: 13px; color: var(--text-muted);">${escaparHtml(item.descricao)}</p>
      <div style="margin-top: 8px; font-size: 12px; color: var(--danger); font-weight:700;">
        👥 Clientes GPON: ${escaparHtml(item.clientesCount)} | Previsão: ${escaparHtml(formatarPrevisao(item.previsao))}
      </div>
    `;
    container.appendChild(card);
  });

  for(const [id,valor] of Object.entries({kpiTotalIncidentes:metricas.ativos,kpiTotalGpon:metricas.gpon,kpiTotalBackbone:metricas.backbone,kpiResolvidos:metricas.resolvidos,kpiSemTecnico:metricas.semTecnico,kpiPrevisoesVencidas:metricas.vencidos}))document.getElementById(id).textContent=valor.toLocaleString('pt-BR');
  const leitura=leituraExecutiva(metricas);document.getElementById('resumoExecutivo').textContent=leitura[0];
  const prioridades=document.getElementById('prioridadesExecutivas');prioridades.replaceChildren(...leitura.slice(1).map(frase=>elemento('li',frase)));
  document.getElementById('painelAtualizado').textContent=`Posição em ${horarioBrasil(new Date())} · Brasília`;
  const siglas = [...new Set(['SP', 'MG', 'PR', ...contagemRegioes.keys(), ...todosIncidentesCache.map(item => item.estado).filter(Boolean)])].sort();
  const grid = document.getElementById('stateGrid');
  grid.replaceChildren();
  for (const estado of ['TODOS', ...siglas]) {
    const cartao = document.createElement('button');
    cartao.type = 'button';
    cartao.className = 'kpi-card state-card' + (estadoFiltroAtivo === estado ? ' active-filter' : '');
    cartao.dataset.estado = estado;
    const nome = document.createElement('span'); nome.className = 'kpi-title'; nome.textContent = estado === 'TODOS' ? 'Todos os estados' : estado;
    const total = document.createElement('strong'); total.className = 'kpi-value'; total.textContent = estado === 'TODOS' ? [...contagemRegioes.values()].reduce((soma, valor) => soma + valor, 0) : contagemRegioes.get(estado) || 0;
    cartao.append(nome, total);
    cartao.onclick = () => filtrarPainelPorEstado(estado);
    grid.append(cartao);
  }
  const relatorioEstado = document.getElementById('relatorioEstado');
  const selecionado = estadoFiltroAtivo;
  relatorioEstado.replaceChildren(new Option('Todos', 'TODOS'), ...siglas.map(sigla => new Option(sigla, sigla)));
  relatorioEstado.value = siglas.includes(selecionado) ? selecionado : 'TODOS';

  if (!container.children.length) {
    container.innerHTML = '<p class="empty-state">Nenhum chamado nesta situação e região.</p>';
  }

  document.getElementById('diretoriaMais').hidden=filtrados.filter(i=>resolvido(i)===(filtroDiretoria==='resolvidos')).length<=paginaDiretoria*TAMANHO_PAGINA;
  document.getElementById('diretoriaFiltros').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.status===filtroDiretoria);b.setAttribute('aria-pressed',String(b.dataset.status===filtroDiretoria))});
  renderizarEvolucao(filtrados);
  renderizarGraficosGerenciais(metricas.ativos - metricas.backbone, metricas.backbone, estadosContagem, supervisoresMap);
}

function renderizarGraficosGerenciais(gpon, backbone, estadosContagem, supervisoresMap) {
  if(typeof Chart === 'undefined')return;
  const ctxTipo = document.getElementById('chartTipoIncidente');
  const ctxEst = document.getElementById('chartEstados');
  const ctxSup = document.getElementById('chartSupervisores');

  if (ctxTipo) {
    if (chartTipoInstance) chartTipoInstance.destroy();
    chartTipoInstance = new Chart(ctxTipo, {
      type: 'doughnut',
      data: { labels: ['GPON', 'Backbone'], datasets: [{ data: [gpon, backbone], backgroundColor: ['#315DB9', '#D89434'] }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  if (ctxEst) {
    if (chartEstadosInstance) chartEstadosInstance.destroy();
    chartEstadosInstance = new Chart(ctxEst, {
      type: 'bar',
      data: { labels: ['SP', 'MG', 'PR', ...[...estadosContagem.keys()].filter(sigla => !['SP','MG','PR'].includes(sigla))], datasets: [{ label: 'Incidentes ativos', data: ['SP', 'MG', 'PR', ...[...estadosContagem.keys()].filter(sigla => !['SP','MG','PR'].includes(sigla))].map(sigla => estadosContagem.get(sigla) || 0), backgroundColor: '#315DB9' }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }

  if (ctxSup) {
    if (chartSupervisoresInstance) chartSupervisoresInstance.destroy();
    const principais = Object.entries(supervisoresMap).sort((a, b) => b[1].total-a[1].total||b[1].compliance-a[1].compliance).slice(0, 6);
    const supNomes = principais.map(([,dados]) => dados.nome);
    const supTotals = principais.map(([, dados]) => dados.total);
    const supCompls = principais.map(([, dados]) => dados.compliance);

    chartSupervisoresInstance = new Chart(ctxSup, {
      type: 'bar',
      data: {
        labels: supNomes,
        datasets: [
          { label: 'Ativos', data: supTotals, backgroundColor: '#AAB9D6' },
          { label: 'Resolvidos', data: supCompls, backgroundColor: '#4D86B7' }
        ]
      },
      options: { responsive: true, indexAxis: 'y', plugins: { legend: { position: 'bottom' } } }
    });
  }
}

function renderizarEvolucao(itens){
  if(typeof Chart === 'undefined')return;
  const etapas=[0,0,0,0];for(const i of itens.filter(i=>!resolvido(i)))etapas[Math.min(3,etapaConcluida(i))]++;
  if(chartEtapasInstance)chartEtapasInstance.destroy();
  chartEtapasInstance=new Chart(document.getElementById('chartEtapas'),{type:'bar',data:{labels:['Aguardando / distribuição','Deslocamento enviado','No local','Atuação'],datasets:[{label:'Atendimentos ativos',data:etapas,backgroundColor:['#aab9d6','#6a91df','#315db9','#11a892']}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});
  const serie=analisarOperacao(itens,detectarEstado).dias;
  if(chartConclusoesInstance)chartConclusoesInstance.destroy();
  chartConclusoesInstance=new Chart(document.getElementById('chartConclusoes'),{type:'line',data:{labels:serie.map(d=>d.nome),datasets:[{label:'IDs finalizados com etapa 4',data:serie.map(d=>d.total),borderColor:'#11a892',backgroundColor:'rgba(17,168,146,.1)',fill:true,tension:.25}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});
}

// 4. MÓDULO TÉCNICO DE CAMPO
let chamadoAtivoTecnico = null;
let mapaFotosBase64 = {};
let enviandoEtapa = false, processandoFotos = false;
let uploadPendente = null;
let bancoRascunhos;
function abrirBancoRascunhos() {
  if (!bancoRascunhos) bancoRascunhos = new Promise((resolve, reject) => {
    const pedido = indexedDB.open('nextflow-campo-rascunhos', 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('atendimentos');
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
  return bancoRascunhos;
}
async function operarRascunho(modo, operacao, valor) {
  const banco = await abrirBancoRascunhos();
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction('atendimentos', modo);
    const loja = transacao.objectStore('atendimentos');
    const chave = `${usuarioUid}_${chamadoAtivoTecnico.docId}`;
    const pedido = operacao === 'get' ? loja.get(chave) : operacao === 'delete' ? loja.delete(chave) : loja.put(valor, chave);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}
function atualizarEstadoLocal(mensagem) {
  const status = document.getElementById('techLocalStatus');
  if (status) status.textContent = mensagem;
}
async function salvarRascunhoTecnico() {
  if (!chamadoAtivoTecnico) return;
  const form = document.getElementById('techFormFlow');
  const valores = {};
  form.querySelectorAll('input:not([type=file]),textarea,select').forEach(elemento => {
    valores[elemento.id] = elemento.multiple ? [...elemento.selectedOptions].map(opcao => opcao.value) : elemento.value;
  });
  try {
    await operarRascunho('readwrite', 'put', { valores, fotos: mapaFotosBase64, caixas: [...document.querySelectorAll('.box-evidence')].map(elemento => Number(elemento.dataset.caixaId)), salvoEm: Date.now() });
    atualizarEstadoLocal(navigator.onLine ? 'Rascunho salvo neste aparelho. Envie a etapa para atualizar o sistema.' : 'Sem internet: rascunho salvo neste aparelho. Envie a etapa ao voltar a conexão.');
  } catch (erro) { atualizarEstadoLocal('Não foi possível guardar o rascunho. Libere espaço no aparelho antes de continuar.'); }
}
window.salvarRascunhoTecnico = salvarRascunhoTecnico;
let temporizadorRascunho;
document.getElementById('techFormFlow')?.addEventListener('input', () => {
  clearTimeout(temporizadorRascunho);
  temporizadorRascunho = setTimeout(salvarRascunhoTecnico, 350);
});
window.addEventListener('online', () => atualizarEstadoLocal('Conexão restaurada. Toque em enviar na etapa atual para sincronizar.'));
async function restaurarRascunhoTecnico() {
  try {
    const rascunho = await operarRascunho('readonly', 'get');
    if (!rascunho) return;
    if (Array.isArray(rascunho.caixas)) {
      document.getElementById('caixasTecnico').replaceChildren();
      numeroCaixa = 0;
      for (const id of rascunho.caixas.slice(0, 12)) adicionarCaixaTecnico(id);
    } else {
      while (document.querySelectorAll('.box-evidence').length < rascunho.caixas) adicionarCaixaTecnico();
    }
    mapaFotosBase64 = rascunho.fotos || {};
    for (const [id, valor] of Object.entries(rascunho.valores || {})) {
      const elemento = document.getElementById(id);
      if (!elemento) continue;
      if (elemento.multiple) [...elemento.options].forEach(opcao => { opcao.selected = valor.includes(opcao.value); });
      else elemento.value = valor;
    }
    for (const chave of Object.keys(mapaFotosBase64)) atualizarGaleriaTecnica(chave);
    atualizarEstadoLocal('Rascunho recuperado deste aparelho. Confira os dados e envie a etapa.');
  } catch { atualizarEstadoLocal('Não foi possível recuperar o rascunho local.'); }
}

function carregarListaTecnico() {
  const idAtivoSalvo = localStorage.getItem(`tech_active_doc_${usuarioUid}`);

  const consulta = perfilSalvo === 'admin'
    ? collection(db, 'incidentes')
    : query(collection(db, 'incidentes'), where('tecnicoUid', '==', usuarioUid));
  ouvirUmaVez('tecnico', consulta, (snapshot) => {
    const container = document.getElementById('techIncidentsList');
    if (!container) return;
    container.innerHTML = "";

    snapshot.forEach(docSnap => {
      if (verificarEExcluirExpirados(docSnap)) return;

      const item = docSnap.data();
      item.docId = docSnap.id;

      // Trava rigorosa por estado do técnico
      const estItem = item.estado || detectarEstado(item.cidades || "");
      if (perfilSalvo !== 'admin' && item.tecnicoUid !== usuarioUid) return;

      if (item.statusAtual && item.statusAtual.includes("FINALIZADO")) return;
      if (item.tecnicoUid && item.tecnicoUid !== usuarioUid) return;
      if (!item.tecnicoUid && item.tecnicoAtribuido && item.tecnicoAtribuido !== usuarioSalvo) return;

      if (idAtivoSalvo === item.docId && chamadoAtivoTecnico?.docId !== item.docId) {
        iniciarAtendimentoTecnico(item, false);
      }

      const card = document.createElement('div');
      card.className = 'incidente-card';
      card.onclick = () => iniciarAtendimentoTecnico(item, true);
      card.innerHTML = `
        <h4 style="color:var(--zaaz-blue); margin-bottom:6px;">🚨 ID: ${escaparHtml(item.idIncidente)}</h4>
        <p style="font-size:13px;"><strong>OS:</strong> ${escaparHtml(item.os)} | <strong>Cidades:</strong> ${escaparHtml(item.cidades)}</p>
        <p style="font-size:12px; color:var(--zaaz-blue); font-weight:700; margin-top:8px;">Status: ${escaparHtml(item.statusAtual)}</p>
        <p style="font-size:12px; color:var(--success); font-weight:700;">▶️ Abrir atendimento atribuído</p>
      `;
      container.appendChild(card);
    });
  });
}

async function iniciarAtendimentoTecnico(item, novoAtendimento = true) {
  const trocouChamado = chamadoAtivoTecnico?.docId !== item.docId;
  if (novoAtendimento) {
    const docRef = doc(db, "incidentes", item.docId);
    try {
      const atual = await getDoc(docRef);
      if (!atual.exists() || (perfilSalvo === 'tecnico' && atual.data().tecnicoUid !== usuarioUid)) {
        throw new Error('Este chamado não está atribuído à sua conta.');
      }
      item = { ...atual.data(), docId:item.docId };
    } catch (erro) {
      alert(erro.message);
      return;
    }
    localStorage.setItem(`tech_active_doc_${usuarioUid}`, item.docId);
  }
  chamadoAtivoTecnico = item;
  const areaEstado = document.getElementById('techEstadoLegadoArea');
  areaEstado.hidden = /^[A-Z]{2}$/.test(item.estado || '');
  const seletorLegado = document.getElementById('techEstadoLegado');
  seletorLegado.replaceChildren(new Option('Selecione o estado real do atendimento', ''), ...estadosBrasil.map(uf => new Option(uf, uf)));
  seletorLegado.disabled = perfilSalvo !== 'admin';
  if (trocouChamado) {
    document.getElementById('techFormFlow').reset();
    document.getElementById('caixasTecnico').replaceChildren();
    numeroCaixa = 0;
    mapaFotosBase64 = {};
    uploadPendente = null;
    document.querySelectorAll('.photo-gallery').forEach(elemento => elemento.replaceChildren());
  }
  document.getElementById('techNomeDisplayStage1').textContent = usuarioSalvo;
  if (!document.getElementById('caixasTecnico').children.length) {
    adicionarCaixaTecnico(); adicionarCaixaTecnico();
  }
  await carregarColegasTecnicos(item.supervisorUid).catch(() => atualizarEstadoLocal('Lista de técnicos indisponível sem conexão. Tente novamente online.'));
  await restaurarRascunhoTecnico();

  document.getElementById('techSelectArea').style.display = 'none';
  document.getElementById('techFormArea').style.display = 'block';
  document.getElementById('techActiveIdDisplay').textContent = `Atendendo ID: ${item.idIncidente}`;

  const concluida = etapaConcluida(item);
  document.querySelectorAll('.step-number').forEach((elemento, indice) => elemento.classList.toggle('step-sent', indice < concluida));
  avancarEtapaVisual(Math.min(4, concluida + 1));
  document.getElementById('techPrevisaoAtual').textContent = `Previsão atual: ${formatarPrevisao(item.previsao)}. Deixe os campos abaixo vazios para manter.`;
  const campoFinal = document.getElementById('tobs');
  const causaAnterior = document.getElementById('techCausaRompimento').value || (item.timelineEtapas || []).find(e => e.causaRompimento)?.causaRompimento || '';
  if (!campoFinal.value.trim()) campoFinal.value = modeloDescricao(causaAnterior);
  else if (!separarDescricao(campoFinal.value)) campoFinal.value = `CAUSA: ${causaAnterior}\n\nSOLUÇÃO: ${campoFinal.value.trim()}\n\nOBSERVAÇÃO: `;
  if (concluida === 4) { liberarAtendimentoTecnico(); alert('Este atendimento já foi finalizado. Consulte o histórico nas áreas de acompanhamento.'); }

}

window.liberarAtendimentoTecnico = async () => {
  if (enviandoEtapa || processandoFotos) { alert('Aguarde o processamento ou envio terminar.'); return; }
  localStorage.removeItem(`tech_active_doc_${usuarioUid}`);
  chamadoAtivoTecnico = null;
  document.getElementById('techSelectArea').style.display = 'block';
  document.getElementById('techFormArea').style.display = 'none';
};

const previasTecnicas = { fotoDeslocamento:'tp1', fotoChegada:'tp2', fotoRompimento:'tp3', fotoPanoramica:'tp4', fotoEquipe:'tp5' };
function bloquearFormulario(bloqueado) {
  document.querySelectorAll('#techFormFlow input, #techFormFlow textarea, #techFormFlow select, #techFormFlow button').forEach(elemento => { elemento.disabled = bloqueado; });
}
function atualizarGaleriaTecnica(chave) {
  const container = document.getElementById(previasTecnicas[chave] || chave.replace('caixaFoto','caixaPreview'));
  renderizarGaleria(container, mapaFotosBase64[chave], indice => {
    if (enviandoEtapa || processandoFotos) return;
    mapaFotosBase64[chave] = listaFotos(mapaFotosBase64[chave]).filter((_, i) => i !== indice);
    atualizarGaleriaTecnica(chave); salvarRascunhoTecnico();
  });
}
window.processarFotoComMarcaDagua = async (input, idPreview, chaveFoto) => {
  const files = [...(input.files || [])];
  if (!files.length || enviandoEtapa || processandoFotos) return;
  const anteriores = listaFotos(mapaFotosBase64[chaveFoto]);
  if (anteriores.length + files.length > LIMITE_FOTOS) { input.value = ''; alert(`Limite de ${LIMITE_FOTOS} fotos por categoria. Remova uma foto antes de adicionar outras.`); return; }
  processandoFotos = true; bloquearFormulario(true);
  try {
    const novas = [];
    for (const file of files) {
      if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) throw new Error('Selecione imagens de até 20 MB cada.');
      novas.push(await comprimirEMarcarDagua(file, `ZAAZ TELECOM | ${new Date().toLocaleString('pt-BR')} | ${usuarioSalvo}`));
    }
    mapaFotosBase64[chaveFoto] = [...anteriores, ...novas];
    atualizarGaleriaTecnica(chaveFoto);
    await salvarRascunhoTecnico();
  } catch (erro) { alert(erro.message); }
  finally { input.value = ''; processandoFotos = false; bloquearFormulario(false); }
};

window.capturarGPSTecnico = (idInput) => {
  if (!navigator.geolocation) { alert('Seu navegador não oferece localização.'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById(idInput).value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
    salvarRascunhoTecnico();
  }, () => alert('Autorize o acesso à localização e tente novamente.'), { enableHighAccuracy: true, timeout: 15000 });
};

let numeroCaixa = 0;
function atualizarControlesCaixas() {
  const caixas = [...document.querySelectorAll('.box-evidence')];
  caixas.forEach((caixa, indice) => {
    caixa.querySelector('h5').textContent = `Caixa ${indice + 1}`;
    caixa.querySelector('.remove-box').hidden = caixas.length <= 2;
  });
  const adicionar = document.getElementById('btnAdicionarCaixa');
  if (adicionar) adicionar.hidden = caixas.length >= 12;
}
window.adicionarCaixaTecnico = (idExistente) => {
  if (document.querySelectorAll('.box-evidence').length >= 12) { alert('Limite de 12 caixas por atendimento.'); return; }
  const numero = Number.isInteger(idExistente) && idExistente > 0 ? idExistente : numeroCaixa + 1;
  numeroCaixa = Math.max(numeroCaixa, numero);
  const caixa = document.createElement('div');
  caixa.className = 'field-card box-evidence';
  caixa.dataset.caixaId = String(numero);
  caixa.innerHTML = `<div class="box-heading"><h5>Caixa</h5><button type="button" class="remove-box" aria-label="Remover esta caixa">Remover</button></div><label for="caixaGps${numero}">Localização GPS</label><input id="caixaGps${numero}" type="text" class="box-gps" readonly placeholder="Ainda não capturada"><button type="button" class="btn-sec-sm btn-capture" onclick="capturarGPSTecnico('caixaGps${numero}')">📍 Capturar localização</button><label for="caixaFoto${numero}">Fotos da caixa acomodada (pelo menos uma)</label><input id="caixaFoto${numero}" type="file" accept="image/*" multiple capture="environment" onchange="processarFotoComMarcaDagua(this, 'caixaPreview${numero}', 'caixaFoto${numero}')"><div id="caixaPreview${numero}" class="photo-gallery" aria-live="polite"></div>`;
  caixa.querySelector('.remove-box').addEventListener('click', () => {
    if (document.querySelectorAll('.box-evidence').length <= 2) return;
    delete mapaFotosBase64[`caixaFoto${numero}`];
    caixa.remove();
    atualizarControlesCaixas();
    salvarRascunhoTecnico();
  });
  document.getElementById('caixasTecnico').append(caixa);
  atualizarControlesCaixas();
};

window.voltarEtapaTecnica = () => {
  atualizarEstadoLocal('As etapas enviadas estão bloqueadas para edição. Consulte o histórico na área de acompanhamento.');
};

async function carregarColegasTecnicos(supervisorUid) {
  const pessoas=[];
  if(supervisorUid){
    const vinculos=await getDocs(query(collection(db,'equipesTecnicas'),where('supervisorUid','==',supervisorUid)));
    const cadastros=await Promise.all(vinculos.docs.filter(d=>d.data().ativo && d.id!==usuarioUid).map(d=>getDoc(doc(db,'usuarios',d.id))));
    for(const d of cadastros)if(d.exists()&&d.data().ativo&&d.data().perfil==='tecnico')pessoas.push({...d.data(),uid:d.id});
  }
  document.getElementById('techAjudantes').replaceChildren(...pessoas.map(p=>new Option(p.nome,p.uid)));
  document.getElementById('techTransferir').replaceChildren(new Option('Manter comigo',''),...pessoas.map(p=>new Option(p.nome,p.uid)));
  tecnicosDisponiveis=pessoas;
}

window.transferirAtendimentoTecnico = async () => {
  const uid = document.getElementById('techTransferir').value;
  const destino = tecnicosDisponiveis.find(item => item.uid === uid);
  if (!destino) { alert('Selecione outro técnico ativo da equipe deste supervisor.'); return; }
  if (!confirm(`Transferir o ID ${chamadoAtivoTecnico.idIncidente} para ${destino.nome}?`)) return;
  try {
    await updateDoc(doc(db, 'incidentes', chamadoAtivoTecnico.docId), { tecnicoUid: destino.uid, tecnicoAtribuido: destino.nome });
    liberarAtendimentoTecnico();
    alert('Atendimento transferido. O ID aparecerá na conta do técnico selecionado.');
  } catch (erro) { alert('Transferência não concluída. Confira a conexão e tente novamente.'); }
};

let currentStepTech = 1;

function avancarEtapaVisual(novaEtapa) {
  document.getElementById(`step-${currentStepTech}`).classList.remove('active');
  document.getElementById(`ind-${currentStepTech}`).classList.remove('active');
  const minima = Math.min(4, etapaConcluida(chamadoAtivoTecnico) + 1);
  currentStepTech = Math.max(minima, Math.min(4, novaEtapa));
  document.getElementById(`step-${currentStepTech}`).classList.add('active');
  document.getElementById(`ind-${currentStepTech}`).classList.add('active');
}
function confirmarEnvioEtapa(numero) {
  document.getElementById(`ind-${numero}`)?.classList.add('step-sent');
  atualizarEstadoLocal(`Etapa ${numero} enviada ao vivo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Os setores de acompanhamento já podem ver a atualização.`);
}

async function registrarEventoTimeline(tituloEtapa, fotosArr, descObs, novaPrevisao = null, campos = {}) {
  if (!chamadoAtivoTecnico?.docId) throw new Error('Abra novamente o ID antes de enviar.');
  const docRef = doc(db, "incidentes", chamadoAtivoTecnico.docId);
  const registro = await getDoc(docRef);
  if (!registro.exists()) throw new Error('Este ID não existe mais.');
  let estadoEnvio = registro.data().estado;
  if (!estadosBrasil.includes(estadoEnvio)) {
    const confirmado = document.getElementById('techEstadoLegado').value;
    if (perfilSalvo !== 'admin' || !estadosBrasil.includes(confirmado)) {
      document.getElementById('techEstadoLegadoArea').hidden = false;
      throw new Error('Este ID antigo não tem estado válido. O administrador deve confirmar o estado no campo acima do formulário.');
    }
    await updateDoc(docRef, { estado: confirmado });
    estadoEnvio = confirmado;
    chamadoAtivoTecnico.estado = confirmado;
    document.getElementById('techEstadoLegadoArea').hidden = true;
  }

  const numero = Number(tituloEtapa.match(/^ETAPA ([1-4])/)[1]);
  exigirProximaEtapa(registro.data(), numero);
  // Reutiliza uploads da mesma tentativa para não reenviar fotos em uma falha de transação.
  if (!uploadPendente || uploadPendente.docId !== chamadoAtivoTecnico.docId || uploadPendente.numero !== numero || uploadPendente.fotos.length !== fotosArr.length || !uploadPendente.fotos.every((foto, i) => foto === fotosArr[i])) {
    uploadPendente = { docId:chamadoAtivoTecnico.docId, numero, fotos:[...fotosArr], ids:[] };
  }
  for (let indice = uploadPendente.ids.length; indice < fotosArr.length; indice++) {
    const fotoRef = await addDoc(collection(db, 'fotos'), {
      incidenteId: chamadoAtivoTecnico.docId, estado: estadoEnvio, criadoPorUid: usuarioUid,
      criadoEm: serverTimestamp(), dadosBase64: fotosArr[indice], numeroEtapa: numero
    });
    uploadPendente.ids.push(fotoRef.id);
  }
  const fotoIds = [...uploadPendente.ids];

  const evento = {
    etapa: tituloEtapa,
    dataHora: new Date().toLocaleString("pt-BR"),
    tecnico: usuarioSalvo,
    fotoIds,
    observacao: descObs,
    ...campos, numeroEtapa: numero, fluxoVersao: 2, tecnicoUid: usuarioUid
  };
  const timelineAtualizada = await runTransaction(db, async transacao => {
    const atual = await transacao.get(docRef);
    if (!atual.exists()) throw new Error('Este incidente não existe mais.');
    if (perfilSalvo === 'tecnico' && atual.data().tecnicoUid !== usuarioUid) {
      throw new Error('Este incidente não está atribuído à sua conta.');
    }
    exigirProximaEtapa(atual.data(), numero);
    const timelineAtual = [...(atual.data().timelineEtapas || []), evento];
    const payload = { statusAtual: tituloEtapa, timelineEtapas: timelineAtual, etapaConcluida: numero, fluxoVersao: 2 };
    if (novaPrevisao) payload.previsao = novaPrevisao;
    transacao.update(docRef, payload);
    if (campos.caixas) {
      transacao.set(doc(db, 'projetosEvidencias', chamadoAtivoTecnico.docId), {
        incidenteId: chamadoAtivoTecnico.docId,
        idIncidente: atual.data().idIncidente || '',
        os: atual.data().os || '',
        estado: estadoEnvio,
        criadoPorUid: usuarioUid,
        criadoEm: serverTimestamp(),
        caixas: campos.caixas,
        descricaoServico: campos.descricaoServico,
        fotoIds,
        statusOzmaps: 'PENDENTE', fluxoVersao: 2, registroFinal: campos.registroFinal
      });
    }
    return timelineAtual;
  });
  chamadoAtivoTecnico.timelineEtapas = timelineAtualizada;
  chamadoAtivoTecnico.etapaConcluida = numero;
  if (novaPrevisao) chamadoAtivoTecnico.previsao = novaPrevisao;
  uploadPendente = null;
  await salvarRascunhoTecnico();
}

async function enviarEtapaTecnica(numero, dados, executar) {
  if (enviandoEtapa || processandoFotos) { atualizarEstadoLocal('Aguarde as fotos ou o envio terminarem.'); return; }
  try { exigirProximaEtapa(chamadoAtivoTecnico, numero); } catch (erro) { alert(erro.message); return; }
  const validacao = avaliarEtapa(numero, { ...dados, fotos:mapaFotosBase64 });
  if (!validacao.valido) { alert(validacao.mensagem); return; }
  if (!navigator.onLine) { await salvarRascunhoTecnico(); return; }
  enviandoEtapa = true; bloquearFormulario(true);
  atualizarEstadoLocal(`Enviando etapa ${numero} e suas fotos. Aguarde a confirmação para avançar.`);
  try { await executar(); avancarEtapaVisual(numero + 1); confirmarEnvioEtapa(numero); }
  catch (erro) { atualizarEstadoLocal(`Etapa ${numero} não enviada. O rascunho foi preservado.`); alert(`Etapa ${numero} não enviada: ${erro.message}`); }
  finally { enviandoEtapa = false; bloquearFormulario(false); }
}
function evidenciasEtapa(numero) {
  let indice = 0;
  const gruposFotos = {}, fotos = [];
  for (const chave of categoriasEtapa[numero]) {
    const grupo = listaFotos(mapaFotosBase64[chave]);
    gruposFotos[chave] = { indiceFoto:indice, quantidadeFotos:grupo.length };
    fotos.push(...grupo); indice += grupo.length;
  }
  return { gruposFotos, fotos, fotosEsperadas:categoriasEtapa[numero].length, fotosPendentes:0 };
}
window.salvarEtapa1 = async () => {
  const tipoArea = document.getElementById('techArea').value, condicaoRisco = document.getElementById('techRisco').value;
  await enviarEtapaTecnica(1, { tipoArea, condicaoRisco }, async () => {
    const { fotos, ...evidencias } = evidenciasEtapa(1);
    const ajudantes = [...document.getElementById('techAjudantes').selectedOptions].map(option => ({ uid:option.value, nome:option.textContent }));
    await registrarEventoTimeline('ETAPA 1: EM DESLOCAMENTO', fotos, `Técnico ${usuarioSalvo} iniciou deslocamento.`, null, { ajudantes, tipoArea, condicaoRisco, ...evidencias });
  });
};
window.salvarEtapa2 = async () => {
  const previsao = document.getElementById('techPrevisaoInput').value.trim(), causa = document.getElementById('techCausaRompimento').value.trim();
  await enviarEtapaTecnica(2, { causa, previsao }, async () => {
    const { fotos, ...evidencias } = evidenciasEtapa(2);
    await registrarEventoTimeline('ETAPA 2: NO LOCAL / ROMPIMENTO', fotos, `Causa: ${causa}. Previsão: ${formatarPrevisao(previsao)}`, previsao, { causaRompimento:causa, previsaoInformada:previsao, ...evidencias });
    document.getElementById('techPrevisaoAtual').textContent = `Previsão atual: ${formatarPrevisao(previsao)}. Deixe os campos abaixo vazios para manter.`;
    const campoFinal = document.getElementById('tobs');
    const final = separarDescricao(campoFinal.value);
    if (!final) campoFinal.value = modeloDescricao(causa);
    else if (!final.causa) campoFinal.value = `CAUSA: ${causa}\n\nSOLUÇÃO: ${final.solucao}\n\nOBSERVAÇÃO: ${final.observacao}`;
  });
};
window.salvarEtapa3 = async () => {
  const observacao = document.getElementById('techObservacaoEtapa3').value.trim(), novaPrevisao = document.getElementById('techNovaPrevisao').value, motivoPrevisao = observacao.slice(0,1000);
  await enviarEtapaTecnica(3, { observacao, novaPrevisao, motivoPrevisao }, async () => {
    const { fotos, ...evidencias } = evidenciasEtapa(3);
    const revisada = novaPrevisao || '';
    const anterior = chamadoAtivoTecnico.previsao || 'A definir';
    await registrarEventoTimeline('ETAPA 3: EXECUTANDO / FUSIONANDO', fotos, `${observacao}${revisada ? `\nPrevisão alterada de ${formatarPrevisao(anterior)} para ${formatarPrevisao(revisada)}. Motivo: ${motivoPrevisao}` : ''}`, revisada || null, { observacaoAtuacao:observacao, previsaoAnterior:anterior, previsaoRevisada:revisada, motivoRevisao:revisada ? motivoPrevisao : '', ...evidencias });
  });
};
window.salvarEtapa4Final = async () => {
  if (enviandoEtapa || processandoFotos) return;
  const mensagem = document.getElementById('techEtapa4Erro'); mensagem.hidden = true;
  try { exigirProximaEtapa(chamadoAtivoTecnico, 4); } catch (erro) { mensagem.textContent = erro.message; mensagem.hidden = false; return; }
  document.querySelectorAll('.box-evidence').forEach(caixa => caixa.classList.remove('invalid-box'));
  const obsTexto = document.getElementById('tobs').value.trim();
  const caixas = [...document.querySelectorAll('.box-evidence')].map((elemento, indice) => {
    const chave = elemento.querySelector('input[type=file]').id;
    return { numero:indice + 1, gps:elemento.querySelector('.box-gps').value.trim(), fotos:listaFotos(mapaFotosBase64[chave]), chave };
  });
  const avaliacao = avaliarFinalizacao(caixas, obsTexto);
  if (!avaliacao.valido) {
    const elemento = avaliacao.indice >= 0 ? document.getElementById(caixas[avaliacao.indice].chave).closest('.box-evidence') : document.getElementById('tobs');
    if (avaliacao.indice >= 0) elemento.classList.add('invalid-box');
    mensagem.textContent = avaliacao.mensagem; mensagem.hidden = false; elemento.scrollIntoView({ behavior:'smooth', block:'center' }); return;
  }
  if (!navigator.onLine) { await salvarRascunhoTecnico(); return; }
  const btn = document.getElementById('btnSalvarTecnicoFinal');
  enviandoEtapa = true; bloquearFormulario(true); btn.textContent = 'Enviando fotos e finalizando…';
  try {
    let indiceFoto = 0;
    const metadados = caixas.map(caixa => { const resultado = { numero:caixa.numero, gps:caixa.gps, indiceFoto, quantidadeFotos:caixa.fotos.length }; indiceFoto += caixa.fotos.length; return resultado; });
    const registroFinal = separarDescricao(obsTexto);
    const descricaoCanonica = `CAUSA: ${registroFinal.causa}\n\nSOLUÇÃO: ${registroFinal.solucao}\n\nOBSERVAÇÃO: ${registroFinal.observacao}`;
    await registrarEventoTimeline('ETAPA 4: REPARO CONCLUÍDO / FINALIZADO', caixas.flatMap(caixa => caixa.fotos), descricaoCanonica, null, { caixas:metadados, descricaoServico:descricaoCanonica, registroFinal, fotosEsperadas:caixas.length, fotosPendentes:0 });
    localStorage.removeItem(`tech_active_doc_${usuarioUid}`);
    clearTimeout(temporizadorRascunho);
    await operarRascunho('readwrite', 'delete').catch(() => {});
    alert('Atendimento concluído e entregue a Projetos.'); location.reload();
  } catch (erro) {
    mensagem.textContent = `Etapa 4 não enviada: ${erro.message || erro.code || 'falha de envio'}. Seu rascunho foi preservado.`;
    mensagem.hidden = false; mensagem.scrollIntoView({ behavior:'smooth', block:'center' });
  } finally { enviandoEtapa = false; bloquearFormulario(false); btn.textContent = 'Finalizar Atendimento de Campo'; }
};

// 5. CONSULTA SAC / SUPORTE / NOC
// Nunca baixe a coleção inteira para montar a lista: cada página consulta até 24 documentos.
let listaIncidentesSac = [];
function limparOuvintesSac() {
  for (const [chave, cancelar] of ouvintes) if (chave.startsWith('sac-live-')) { cancelar(); ouvintes.delete(chave); }
}
function acompanharPaginaSac(ids, geracao) {
  if (!ids.length) return;
  ouvirUmaVez(`sac-live-${ids.join('|')}`, query(collection(db, 'incidentes'), where(documentId(), 'in', ids)), snapshot => {
    if (geracao !== geracaoSac || saindo) return;
    const atuais = new Map(snapshot.docs.map(d => [d.id, { ...d.data(), docId: d.id }]));
    listaIncidentesSac = listaIncidentesSac.filter(item => !ids.includes(item.docId) || atuais.has(item.docId)).map(item => atuais.get(item.docId) || item);
    renderizarListaSac(listaIncidentesSac);
  });
}
let ultimoSac = null;
let modoBuscaSac = false;
let carregandoSac = false;
let geracaoSac = 0;
const TAMANHO_PAGINA_SAC = 24;

function atualizarBotaoSac(visivel) {
  const botao = document.getElementById('btnMaisSac');
  if (botao) {
    botao.style.display = visivel ? 'inline-block' : 'none';
    botao.disabled = carregandoSac;
  }
}

function carregarIncidentesSac() {
  // A área pode ser reaberta sem repetir a primeira consulta.
  if (listaIncidentesSac.length || ultimoSac || carregandoSac || modoBuscaSac) return;
  window.carregarMaisSac();
}

window.carregarMaisSac = async () => {
  if (carregandoSac || modoBuscaSac || !auth.currentUser) return;
  carregandoSac = true;
  atualizarBotaoSac(true);
  const geracao = geracaoSac;
  try {
    const partes = [collection(db, 'incidentes')];
    if (ultimoSac) partes.push(startAfter(ultimoSac));
    partes.push(limit(TAMANHO_PAGINA_SAC));
    const pagina = await getDocs(query(...partes));
    if (geracao !== geracaoSac || saindo) return;
    ultimoSac = pagina.docs.at(-1) || ultimoSac;
    for (const documento of pagina.docs) {
      const item = documento.data();
      item.docId = documento.id;
      listaIncidentesSac.push(item);
    }
    renderizarListaSac(listaIncidentesSac);
    acompanharPaginaSac(pagina.docs.map(d => d.id), geracao);
    atualizarBotaoSac(pagina.size === TAMANHO_PAGINA_SAC);
  } catch (erro) {
    console.error('Falha na consulta paginada do SAC:', erro);
    const lista = document.getElementById('sacResultsList');
    if (!saindo && lista) lista.innerHTML = `<p class="empty-state" role="alert">Não foi possível carregar a lista (${escaparHtml(erro.code || 'erro desconhecido')}). Tente buscar um ID ou OS exata. Se persistir, informe esse código ao administrador.</p>`;
    atualizarBotaoSac(false);
  } finally {
    carregandoSac = false;
    const botao = document.getElementById('btnMaisSac');
    if (botao) botao.disabled = false;
    if (geracao !== geracaoSac && !modoBuscaSac && !listaIncidentesSac.length && !saindo) {
      window.carregarMaisSac();
    }
  }
};

function renderizarListaSac(lista) {
  const container = document.getElementById('sacResultsList');
  if (!container) return;
  container.innerHTML = "";

  if (lista.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:var(--text-muted); padding:20px; grid-column:span 2;'>Nenhum incidente localizado no momento.</p>";
    return;
  }

  lista.forEach(item => {
    const card = document.createElement('div');
    card.className = 'incidente-card';
    card.onclick = () => abrirModalDetalhes(item);
    card.innerHTML = `
      <h4 style="color:var(--zaaz-blue); margin-bottom:6px;">🚨 ID: ${escaparHtml(item.idIncidente)} - ${escaparHtml(item.cidades)}</h4>
      <p style="font-size:13px; margin-bottom:4px;"><strong>OS:</strong> ${escaparHtml(item.os)} | <strong>OLT:</strong> ${escaparHtml(item.olt)}</p>
      <p style="font-size:13px; margin-bottom:4px;"><strong>Status:</strong> <span style="color:var(--zaaz-blue); font-weight:700;">${escaparHtml(item.statusAtual)}</span></p>
      <p style="font-size:12px; color:var(--zaaz-blue); font-weight:700; margin-top:8px;">🔍 Ver Linha do Tempo e Fotos Ampliadas</p>
    `;
    container.appendChild(card);
  });
}

window.filtrarSac = async () => {
  const inputElem = document.getElementById('inputBuscaSac');
  if (!inputElem) return;
  const termo = inputElem.value.trim();
  geracaoSac++;
  limparOuvintesSac();
  if (!termo) {
    modoBuscaSac = false;
    listaIncidentesSac = [];
    ultimoSac = null;
    carregarIncidentesSac();
    return;
  }
  modoBuscaSac = true;
  atualizarBotaoSac(false);
  const geracao = geracaoSac;
  try {
    const [porId, porOs] = await Promise.all([
      getDocs(query(collection(db, 'incidentes'), where('idIncidente', '==', termo), limit(24))),
      getDocs(query(collection(db, 'incidentes'), where('os', '==', termo), limit(24)))
    ]);
    if (geracao !== geracaoSac || saindo) return;
    const encontrados = new Map();
    for (const documento of [...porId.docs, ...porOs.docs]) {
      encontrados.set(documento.id, { ...documento.data(), docId: documento.id });
    }
    listaIncidentesSac = [...encontrados.values()];
    renderizarListaSac(listaIncidentesSac);
    for (let inicio = 0; inicio < listaIncidentesSac.length; inicio += 24) acompanharPaginaSac(listaIncidentesSac.slice(inicio, inicio + 24).map(i => i.docId), geracao);
  } catch (erro) {
    if (!saindo) alert('Não foi possível pesquisar agora. Tente novamente.');
  }
};

document.getElementById('inputBuscaSac')?.addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); window.filtrarSac(); }
});

function dataLegadaDentroDoPrazo(dataHora) {
  const partes = String(dataHora || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})/);
  if (!partes) return false;
  const data = new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]), Number(partes[4]), Number(partes[5]));
  const idade = Date.now() - data.getTime();
  return idade >= 0 && idade < 15 * 24 * 60 * 60 * 1000;
}

const nomesCategorias = {fotoDeslocamento:'Deslocamento',fotoChegada:'Local do atendimento',fotoRompimento:'Rompimento localizado',fotoPanoramica:'Técnico atuando',fotoEquipe:'Fusão'};
function rotulosFotos(evento) {
  const rotulos=(evento.fotoIds||evento.fotos||[]).map((_,i)=>`Foto ${i+1}`);
  for(const [chave,grupo]of Object.entries(evento.gruposFotos||{}))for(let i=0;i<grupo.quantidadeFotos;i++)rotulos[grupo.indiceFoto+i]=`${nomesCategorias[chave]||chave} · ${i+1}`;
  for(const caixa of evento.caixas||[])for(let i=0;i<(caixa.quantidadeFotos||1);i++)rotulos[caixa.indiceFoto+i]=`Caixa ${caixa.numero} · ${i+1}`;
  return rotulos;
}
async function carregarGaleriaRegistrada(container, ids, rotulos, aindaAberta=()=>true, legadas=[]) {
  container.classList.add('evidence-gallery'); container.textContent='Carregando fotos...';
  const resultados=await Promise.all(ids.map(async(id,n)=>{try{const foto=await getDoc(doc(db,'fotos',id));return foto.exists()?{src:foto.data().dadosBase64,label:rotulos[n]||`Foto ${n+1}`}:null}catch{return null}}));
  if(!aindaAberta())return;
  montarGaleria(container,[...legadas.map((src,n)=>({src,label:rotulos[n]||`Foto ${n+1}`})),...resultados.filter(Boolean)]);
  const faltantes=resultados.filter(r=>!r).length;
  if(faltantes)container.append(elemento('p',`${faltantes} foto(s) indisponíveis ou removidas após 15 dias.`,'photo-retention-note'));
}

let geracaoDetalhes=0;
window.abrirModalDetalhes = (item, atualizacaoAoVivo = false) => {
  const geracao=++geracaoDetalhes;
  if (!atualizacaoAoVivo) {
    ouvintes.get('modal-incidente')?.(); ouvintes.delete('modal-incidente');
    if (item.docId) ouvirUmaVez('modal-incidente', doc(db, 'incidentes', item.docId), snapshot => {
      if (snapshot.exists()) abrirModalDetalhes({ ...snapshot.data(), docId: snapshot.id }, true);
      else fecharModal();
    });
  }
  document.getElementById('modalIdTitle').textContent = `🚨 Incidente ID: ${item.idIncidente}`;
  const formularioAdmin = document.getElementById('formAdminEdicao');
  formularioAdmin.hidden = perfilSalvo !== 'admin';
  if (perfilSalvo === 'admin' && !atualizacaoAoVivo) {
    formularioAdmin.dataset.docId = item.docId;
    formularioAdmin.dataset.responsavelOriginal = item.responsavel || '';
    document.getElementById('editarId').value = item.idIncidente || '';
    document.getElementById('editarOs').value = item.os || '';
    document.getElementById('editarCidades').value = item.cidades || '';
    const seletorEstado = document.getElementById('editarEstado');
    seletorEstado.replaceChildren(...estadosBrasil.map(uf => new Option(uf, uf)));
    seletorEstado.value = item.estado || detectarEstado(item.cidades || '');
    document.getElementById('editarRede').value = item.tipoRede || 'GPON';
    document.getElementById('editarClientes').value = Number(item.clientesCount || 0);
    document.getElementById('editarOlt').value = item.olt || '';
    document.getElementById('editarStatus').value = item.statusAtual || '';
    document.getElementById('editarPrevisao').value = item.previsao || '';
    document.getElementById('editarResponsavel').value = item.responsavel || '';
    document.getElementById('editarDescricao').value = item.descricao || '';
  }

  const infoBox = document.getElementById('modalInfoBox');
  infoBox.innerHTML = `
    <span class="live-status">● Acompanhamento ao vivo · etapas recebidas automaticamente</span>
    <strong>OS:</strong> ${escaparHtml(item.os)}<br>
    <strong>Cidades:</strong> ${escaparHtml(item.cidades)} (${escaparHtml(item.estado || 'SP')})<br>
    <strong>Rede:</strong> ${escaparHtml(item.tipoRede || 'GPON')} | <strong>OLT:</strong> ${escaparHtml(item.olt)}<br>
    <strong>Status:</strong> <span style="color:var(--zaaz-blue); font-weight:700;">${escaparHtml(item.statusAtual)}</span><br>
    <strong>Clientes:</strong> ${escaparHtml(item.clientesCount)}<br>
    <strong>Previsão:</strong> ${escaparHtml(formatarPrevisao(item.previsao))}<br>
    <strong>Supervisor:</strong> ${escaparHtml(item.responsavel)}<br>
    <hr style="margin:6px 0; border:none; border-top:1px solid var(--border-color);">
    <strong>Descrição:</strong> ${escaparHtml(item.descricao)}
  `;

  const sidebarSteps = document.getElementById('modalSidebarSteps');
  const timelineContainer = document.getElementById('modalTimelineList');
  sidebarSteps.innerHTML = "";
  timelineContainer.innerHTML = "";

  if (item.timelineEtapas && item.timelineEtapas.length > 0) {
    item.timelineEtapas.forEach((t, idx) => {
      const sideItem = document.createElement('div');
      sideItem.className = 'sidebar-step-item';
      sideItem.textContent = `${idx + 1}. ${t.etapa}`;
      sidebarSteps.appendChild(sideItem);

      const itemDiv = document.createElement('div');
      itemDiv.className = 'timeline-item';

      itemDiv.innerHTML = `
        <div class="timeline-header">
          <span>${escaparHtml(t.etapa)}</span>
          <span>${escaparHtml(t.dataHora)} (${escaparHtml(t.tecnico)})</span>
        </div>
        <p style="font-size:13px;">${escaparHtml(t.observacao)}</p>
      `;
      if ((Array.isArray(t.fotos) && t.fotos.length) || (Array.isArray(t.fotoIds) && t.fotoIds.length)) {
        const galeria = document.createElement('div');
        galeria.className = 'timeline-photos';
        carregarGaleriaRegistrada(galeria,t.fotoIds||[],rotulosFotos(t),()=>geracao===geracaoDetalhes,dataLegadaDentroDoPrazo(t.dataHora)?t.fotos||[]:[]);
        itemDiv.appendChild(galeria);
        const nota = document.createElement('p');
        nota.className = 'photo-retention-note';
        nota.textContent = 'Fotos disponíveis por até 15 dias após o envio.';
        itemDiv.appendChild(nota);
      } else if (t.fotosRemovidas) {
        const nota = document.createElement('p');
        nota.className = 'photo-retention-note';
        nota.textContent = `${t.fotosRemovidas} foto(s) removida(s) após 15 dias. O registro permanece.`;
        itemDiv.appendChild(nota);
      }
      timelineContainer.appendChild(itemDiv);
    });
  } else {
    timelineContainer.innerHTML = "<p class='text-muted' style='font-size:12px;'>Aguardando primeira ação do técnico de rua.</p>";
  }

  document.getElementById('modalDetalhesIncidente').style.display = 'flex';
};

document.getElementById('formAdminEdicao')?.addEventListener('submit', async evento => {
  evento.preventDefault();
  if (perfilSalvo !== 'admin') return;
  const formulario = evento.currentTarget;
  const id = formulario.dataset.docId;
  if (!id) return;
  const botao = formulario.querySelector('button[type="submit"]');
  botao.disabled = true;
  try {
    const estadoNovo = document.getElementById('editarEstado').value;
    const responsavelNovo = document.getElementById('editarResponsavel').value.trim();
    const dadosAtuais = await getDoc(doc(db, 'incidentes', id));
    if (!dadosAtuais.exists()) throw new Error('ID não encontrado.');
    if (dadosAtuais.data().tecnicoUid && dadosAtuais.data().estado !== estadoNovo) {
      throw new Error('Troque a atribuição do técnico antes de alterar o estado.');
    }
    const alteracoes = {
      idIncidente: document.getElementById('editarId').value.trim(),
      os: document.getElementById('editarOs').value.trim(),
      cidades: document.getElementById('editarCidades').value.trim(),
      estado: estadoNovo,
      tipoRede: document.getElementById('editarRede').value,
      clientesCount: Number(document.getElementById('editarClientes').value || 0),
      olt: document.getElementById('editarOlt').value.trim(),
      statusAtual: document.getElementById('editarStatus').value.trim(),
      previsao: document.getElementById('editarPrevisao').value.trim(),
      responsavel: responsavelNovo,
      descricao: document.getElementById('editarDescricao').value.trim()
    };
    // O nome do comunicado não altera a identidade única do supervisor.
    await updateDoc(doc(db, 'incidentes', id), alteracoes);
    alert('Correção salva. Reabra o ID para conferir os dados atualizados.');
    window.fecharModal();
  } catch (erro) { alert(erro.message || 'Não foi possível salvar a correção.'); }
  finally { botao.disabled = false; }
});

window.ampliarFoto = url => abrirFotos([{src:url,label:'Foto do atendimento'}]);
window.fecharZoomFoto = fecharFotos;

window.fecharModal = () => {
  geracaoDetalhes++;
  ouvintes.get('modal-incidente')?.(); ouvintes.delete('modal-incidente');
  document.getElementById('modalDetalhesIncidente').style.display = 'none';
};
document.getElementById('modalDetalhesIncidente')?.addEventListener('click', event => {
  if (event.target === event.currentTarget) fecharModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    if (document.getElementById('lightboxOverlay')?.style.display === 'flex') fecharZoomFoto();
    else if (document.getElementById('modalProjetos')?.style.display === 'flex') fecharModalProjeto();
    else fecharModal();
  }
});

window.exportarRelatorioPDF = async () => {
  if(!['admin','gerente','diretor'].includes(perfilSalvo)||!recorteValido())return;
  const filtros=filtrosDiretoria(),itens=selecionarIncidentes(todosIncidentesCache,filtros,detectarEstado);
  if(!itens.length){document.getElementById('avisoRelatorio').textContent='Nenhum chamado no recorte selecionado.';return}
  const botao=document.getElementById('btnRelatorioPDF'),aviso=document.getElementById('avisoRelatorio');botao.disabled=true;aviso.textContent='Preparando o relatório executivo...';
  try{const {pdf,nome}=await criarRelatorioPDF(itens,filtros,detectarEstado);pdf.save(nome);aviso.textContent='PDF gerado. Verifique os downloads do navegador.'}
  catch(erro){aviso.textContent=erro.message||'Não foi possível gerar o PDF. Tente novamente.'}
  finally{botao.disabled=false}
};
window.exportarRelatorioCSV = () => {
  if(!['admin','gerente','diretor'].includes(perfilSalvo)||!recorteValido())return;
  const {inicio,fim,estado,supervisor}=filtrosDiretoria();
  const filtrados=selecionarIncidentes(todosIncidentesCache,filtrosDiretoria(),detectarEstado);
  if(!filtrados.length){alert('Nenhum dado para exportar.');return}
  const celula = valor => {
    let texto = String(valor ?? '');
    if (/^[\s\r\n]*[=+\-@]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replace(/"/g, '""')}"`;
  };
  const linhas = [
    ['NEXTFLOW | ZAAZ TELECOM · Relatório de incidentes'],
    [`Gerado em ${horarioBrasil(new Date())} (Brasília)`, `Abertura: ${inicio || 'sem limite inicial'} a ${fim || 'sem limite final'}`, `Estado: ${estado}`, `Supervisor: ${supervisor || 'todos'}`],
    [`Total de IDs: ${filtrados.length}`, `Ativos: ${filtrados.filter(i=>!resolvido(i)).length}`, `Resolvidos: ${filtrados.filter(resolvido).length}`],
    [],
    ['ID', 'OS', 'Cidades', 'Estado', 'Rede', 'Clientes', 'Status', 'Supervisor', 'Técnico', 'Data de criação', 'Previsão', 'Conclusão', 'ID usuário IXC']
  ];
  filtrados.forEach(i => linhas.push([
    i.idIncidente, i.os, i.cidades, i.estado, i.tipoRede,
    i.clientesCount, i.statusAtual, i.supervisorNome||i.responsavel, i.tecnicoAtribuido,
    i.dataCriacao, formatarPrevisao(i.previsao), dataConclusao(i), i.ixcUsuarioId||''
  ]));
  const arquivo = new Blob(['\uFEFF', linhas.map(linha => linha.map(celula).join(';')).join('\r\n')],
    { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Relatorio_ZAAZ_${diaBrasil(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

window.sair = async () => {
  saindo = true;
  for (const cancelar of ouvintes.values()) cancelar();
  ouvintes.clear();
  try {
    await signOut(auth);
    window.location.replace('index.html');
  } catch (erro) {
    saindo = false;
    alert('Não foi possível sair. Tente novamente.');
  }
};

onAuthStateChanged(auth, async (usuario) => {
  if (!usuario) {
    window.location.replace('index.html');
    return;
  }
  try {
    const perfilDoc = await getDoc(doc(db, 'usuarios', usuario.uid));
    if (!perfilDoc.exists() || perfilDoc.data().ativo !== true) throw new Error('Perfil inativo');
    const perfil = perfilDoc.data();
    if (!abasPermitidas[perfil.perfil]) throw new Error('Perfil não reconhecido');
    usuarioUid = usuario.uid;
    usuarioSalvo = perfil.nome || usuario.email;
    perfilSalvo = perfil.perfil;
    estadoSalvo = perfil.estado;
    if (badgeElem) badgeElem.textContent = usuarioSalvo;
    configurarTelasPorPerfil();
    ouvirUmaVez('meuPerfil', doc(db, 'usuarios', usuarioUid), snapshot => {
      if (!snapshot.exists() || snapshot.data().ativo !== true
        || snapshot.data().perfil !== perfilSalvo || snapshot.data().estado !== estadoSalvo) {
        window.sair();
      }
    });
  } catch (erro) {
    await signOut(auth);
    window.location.replace('index.html');
  }
});
