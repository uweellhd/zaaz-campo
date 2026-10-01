/* ==========================================================================
   NEXTFLOW ENTERPRISE - LOGICA DE PERMISSÕES & INCIDENTES (js/incidents.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, getDocs, updateDoc, runTransaction, query, where, startAfter, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, verifyBeforeUpdateEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { avaliarFinalizacao } from '../lib/field-flow.mjs';

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
  gerente: ['viewGerente', 'viewSac'],
  diretor: ['viewGerente', 'viewSac'],
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

async function carregarTecnicosDisponiveis() {
  if (!['admin', 'noc'].includes(perfilSalvo)) return;
  const resultado = await getDocs(query(collection(db, 'usuarios'), where('perfil', '==', 'tecnico')));
  tecnicosDisponiveis = resultado.docs
    .map(documento => ({ uid: documento.id, ...documento.data() }))
    .filter(tecnico => tecnico.ativo === true);
  const supervisores = await getDocs(query(collection(db, 'usuarios'), where('perfil', '==', 'supervisor')));
  supervisoresDisponiveis = supervisores.docs
    .map(documento => ({ uid: documento.id, ...documento.data() }))
    .filter(supervisor => supervisor.ativo === true);
}

document.getElementById('formBuscarAtribuicao')?.addEventListener('submit', async evento => {
  evento.preventDefault();
  if (!['admin', 'noc'].includes(perfilSalvo)) return;
  const id = document.getElementById('buscaAtribuicao').value.trim();
  const resultados = document.getElementById('resultadosAtribuicao');
  resultados.textContent = 'Buscando...';
  try {
    await carregarTecnicosDisponiveis();
    const consulta = await getDocs(query(collection(db, 'incidentes'), where('idIncidente', '==', id), limit(10)));
    resultados.replaceChildren();
    if (consulta.empty) { resultados.textContent = 'Nenhum ID encontrado.'; return; }
    consulta.forEach(documento => {
      const chamado = documento.data();
      const card = document.createElement('div');
      card.className = 'approval-card';
      const nome = document.createElement('strong');
      nome.textContent = `ID ${chamado.idIncidente} · ${chamado.cidades || ''}`;
      const atual = document.createElement('small');
      atual.textContent = chamado.tecnicoAtribuido ? `Atual: ${chamado.tecnicoAtribuido}` : 'Sem técnico atribuído';
      const seletor = document.createElement('select');
      seletor.setAttribute('aria-label', `Técnico do ID ${chamado.idIncidente}`);
      seletor.add(new Option('Sem técnico atribuído', ''));
      for (const tecnico of tecnicosDisponiveis.filter(pessoa => pessoa.estado === chamado.estado)) {
        seletor.add(new Option(`${tecnico.nome} (${tecnico.estado})`, tecnico.uid));
      }
      if (chamado.tecnicoUid) seletor.value = chamado.tecnicoUid;
      const salvar = document.createElement('button');
      salvar.type = 'button';
      salvar.className = 'btn-sec-sm';
      salvar.textContent = 'Salvar atribuição';
      salvar.addEventListener('click', async () => {
        const escolhido = tecnicosDisponiveis.find(pessoa => pessoa.uid === seletor.value && pessoa.estado === chamado.estado);
        if (seletor.value && !escolhido) { alert('Selecione um técnico ativo do mesmo estado.'); return; }
        if (!escolhido && !confirm('Remover a atribuição? O técnico deixará de ver esse ID.')) return;
        salvar.disabled = true;
        try {
          await updateDoc(doc(db, 'incidentes', documento.id), {
            tecnicoUid: escolhido?.uid || '', tecnicoAtribuido: escolhido?.nome || ''
          });
          atual.textContent = escolhido ? `Atual: ${escolhido.nome}` : 'Sem técnico atribuído';
        } catch (erro) { alert('Não foi possível atribuir esse ID.'); }
        finally { salvar.disabled = false; }
      });
      card.append(nome, atual, seletor, salvar);
      const supervisorSelect = document.createElement('select');
      supervisorSelect.setAttribute('aria-label', `Supervisor do ID ${chamado.idIncidente}`);
      supervisorSelect.add(new Option('Selecione supervisor', ''));
      for (const pessoa of supervisoresDisponiveis) supervisorSelect.add(new Option(pessoa.nome, pessoa.uid));
      if (chamado.supervisorUid) supervisorSelect.value = chamado.supervisorUid;
      const salvarSupervisor = document.createElement('button');
      salvarSupervisor.type = 'button';
      salvarSupervisor.className = 'btn-sec-sm';
      salvarSupervisor.textContent = 'Vincular supervisor';
      salvarSupervisor.addEventListener('click', async () => {
        const escolhido = supervisoresDisponiveis.find(pessoa => pessoa.uid === supervisorSelect.value);
        if (!escolhido) { alert('Selecione um supervisor ativo.'); return; }
        salvarSupervisor.disabled = true;
        try {
          await updateDoc(doc(db, 'incidentes', documento.id), { supervisorUid: escolhido.uid });
          alert('Supervisor vinculado ao ID.');
        } catch (erro) { alert('Não foi possível vincular o supervisor.'); }
        finally { salvarSupervisor.disabled = false; }
      });
      card.append(supervisorSelect, salvarSupervisor);
      resultados.append(card);
    });
  } catch (erro) {
    resultados.textContent = 'Não foi possível buscar. Confira seu perfil e tente novamente.';
  }
});

// LÓGICA DE VISIBILIDADE DAS ABAS BASEADA EM PERMISSÕES DINÂMICAS (RBAC)
function configurarTelasPorPerfil() {
  const btnGerente = document.getElementById('btnTabGerente');
  const btnNoc = document.getElementById('btnTabNoc');
  const btnSac = document.getElementById('btnTabSac');
  const btnTech = document.getElementById('btnTabTech');
  const btnConta = document.getElementById('btnTabConta');
  const btnAcessos = document.getElementById('btnTabAcessos');
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
    [btnGerente, btnSac].forEach(btn => { if (btn) btn.style.display = 'inline-block'; });
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
  if (!(abasPermitidas[perfilSalvo] || []).includes(idAba)) return;
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

function evidenciaFinalRegistrada(incidente) {
  return (incidente.timelineEtapas || []).some(evento =>
    String(evento.etapa || '').startsWith('ETAPA 4')
    && ((evento.fotoIds || []).length >= 2 || (evento.fotos || []).length >= 2 || Number(evento.fotosRemovidas || 0) >= 2)
    && ((evento.caixas || []).length >= 2 || /GPS C1: .+\| GPS C2: .+/.test(evento.observacao || ''))
  );
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
      const card = document.createElement('article');
      card.className = 'field-card';
      const titulo = document.createElement('h4'); titulo.textContent = `ID ${registro.idIncidente} · OS ${registro.os || '—'} · ${registro.estado}`;
      const descricao = document.createElement('p'); descricao.textContent = `Serviço: ${registro.descricaoServico}`;
      const status = document.createElement('p'); status.textContent = `OZmaps: ${registro.statusOzmaps === 'REGISTRADO' ? 'Registrado' : 'Pendente'}`;
      card.append(titulo, descricao, status);
      for (const caixa of registro.caixas || []) {
        const linha = document.createElement('div'); linha.className = 'project-box';
        const info = document.createElement('span'); info.textContent = `Caixa ${caixa.numero} · GPS ${caixa.gps}`;
        linha.append(info);
        const fotoId = registro.fotoIds?.[caixa.indiceFoto];
        if (fotoId) getDoc(doc(db, 'fotos', fotoId)).then(fotoDoc => {
          if (fotoDoc.exists()) adicionarMiniatura(linha, fotoDoc.data().dadosBase64);
          else linha.append(' · Foto expirada (15 dias)');
        }).catch(() => linha.append(' · Foto indisponível'));
        card.append(linha);
      }
      if (registro.statusOzmaps !== 'REGISTRADO') {
        const botao = document.createElement('button'); botao.className = 'btn-sec-sm';
        botao.textContent = 'Marcar registrado no OZmaps';
        botao.onclick = async () => {
          botao.disabled = true;
          try { await updateDoc(doc(db, 'projetosEvidencias', documento.id), { statusOzmaps: 'REGISTRADO' }); }
          catch { botao.disabled = false; alert('Não foi possível atualizar. Tente novamente.'); }
        };
        card.append(botao);
      }
      lista.append(card);
    });
  });
}

function carregarSupervisor() {
  const descricao = document.getElementById('supervisorDescricao');
  if (descricao && perfilSalvo === 'admin') descricao.textContent = 'Visão administrativa dos IDs. Para liberar a visão individual do supervisor, vincule o UID dele ao chamado na aba NOC.';
  const consulta = perfilSalvo === 'admin' ? collection(db, 'incidentes')
    : query(collection(db, 'incidentes'), where('supervisorUid', '==', usuarioUid));
  ouvirUmaVez('supervisor', consulta, snapshot => {
    const container = document.getElementById('supervisorResultados');
    container.replaceChildren();
    let total = 0, completos = 0, semVinculo = 0, fotosFaltantes = 0;
    snapshot.forEach(documento => {
      const item = documento.data();
      if (perfilSalvo !== 'admin' && item.supervisorUid !== usuarioUid) return;
      const vinculado = Boolean(item.supervisorUid);
      if (vinculado) total++;
      else semVinculo++;
      const ok = evidenciaFinalRegistrada(item);
      if (vinculado) fotosFaltantes += fotosPendentesEtapas(item);
      if (ok && vinculado) completos++;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'incidente-card supervisor-card';
      const titulo = document.createElement('strong');
      titulo.textContent = `ID ${item.idIncidente} · OS ${item.os || 'Não informada'}`;
      const detalhes = document.createElement('small');
      detalhes.textContent = `${item.cidades || ''} · ${item.statusAtual || ''} · Técnico: ${nomeCurto(item.tecnicoAtribuido) || 'Não atribuído'}`;
      const situacao = document.createElement('span');
      situacao.className = ok ? 'evidence-complete' : 'evidence-pending';
      situacao.textContent = !vinculado && perfilSalvo === 'admin' ? 'Supervisor ainda não vinculado' : `${ok ? 'Etapa final registrada' : 'Etapa final pendente'} · ${fotosPendentesEtapas(item)} foto(s) aguardando das etapas 1–3`;
      card.append(titulo, detalhes, situacao);
      card.addEventListener('click', () => abrirModalDetalhes({ ...item, docId: documento.id }));
      container.append(card);
    });
    document.getElementById('supervisorTotal').textContent = String(total);
    document.getElementById('supervisorPendente').textContent = String(total - completos);
    document.getElementById('supervisorCompleto').textContent = String(completos);
    document.getElementById('supervisorFotosFaltantes').textContent = String(fotosFaltantes);
    const aviso = document.getElementById('supervisorAviso');
    if (aviso) {
      aviso.hidden = perfilSalvo !== 'admin' || semVinculo === 0;
      aviso.textContent = `${semVinculo} ID${semVinculo === 1 ? '' : 's'} sem supervisor vinculado. Use NOC → Atribuir atendimento para associar os registros antigos ao UID correto.`;
    }
    if (!snapshot.size) container.textContent = perfilSalvo === 'admin'
      ? 'Nenhum ID encontrado. Confira os dados do Firestore.'
      : 'Ainda não há IDs vinculados ao seu usuário. O NOC ou administrador pode vincular os IDs antigos na aba NOC.';
  });
}

function carregarSolicitacoes() {
  if (perfilSalvo !== 'admin') return;
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
        if (perfil.value === 'tecnico' && estado.value === 'TODOS') { alert('Escolha um estado para o técnico.'); return; }
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
        if (perfil.value === 'tecnico' && estado.value === 'TODOS') { alert('Escolha um estado para o técnico.'); return; }
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
        let width = img.width;
        let height = img.height;
        if (width > 900) {
          height = Math.round((height * 900) / width);
          width = 900;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, height - 40, width, 40);

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 16px Inter, sans-serif";
        ctx.fillText(textoMarca, 15, height - 15);

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
      let idIncidenteExt = extrairCampo(textoBruto, "ID");
      if (!idIncidenteExt) idIncidenteExt = gerarIdAutomatico();

      const cidadesExt = extrairCampo(textoBruto, "CIDADES AFETADAS") || "Geral / SP";
      const estadoExt = detectarEstado(cidadesExt);
      const tipoRedeExt = detectarTipoRede(textoBruto);

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

      alert(`⚡ Comunicado publicado com sucesso!\nID: ${idIncidenteExt}`);
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
let chartSupervisoresInstance = null;

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

window.filtrarPainelPorEstado = (estado) => {
  estadoFiltroAtivo = estado;
  document.querySelectorAll('.state-card').forEach(c => c.classList.remove('active-filter'));
  document.querySelectorAll('.state-card').forEach(c => {
    if (c.dataset.estado === estado) c.classList.add('active-filter');
  });

  const tituloList = document.getElementById('tituloListaConsolidada');
  if (tituloList) {
    tituloList.textContent = estado === "TODOS" ? "Chamados da operação" : `Chamados em ${estado}`;
  }
  const escopo = document.getElementById('painelEscopo');
  if (escopo) escopo.textContent = estado === 'TODOS' ? 'Todos os estados' : `Estado: ${estado}`;

  renderizarPainelGerenteFiltrado();
};

function renderizarPainelGerenteFiltrado() {
  let totalIncidentes = 0, totalGpon = 0, totalBackbone = 0, pendentes = 0;
  const estadosContagem = new Map();
  let supervisoresMap = {};

  const container = document.getElementById('gerenteIncidentesList');
  if (!container) return;
  container.innerHTML = "";

  const filtrados = todosIncidentesCache.filter(item => {
    const est = item.estado || detectarEstado(item.cidades || "");
    const encerrado = /FINALIZAD|CONCLU[IÍ]D|RESOLVID/i.test(item.statusAtual || '');
    if (!encerrado) {
      estadosContagem.set(est || 'Não informado', (estadosContagem.get(est || 'Não informado') || 0) + 1);
    }

    if (estadoFiltroAtivo !== 'TODOS' && est !== estadoFiltroAtivo) return false;
    if (!encerrado) {
      const resp = nomeCurto(item.responsavel) || 'Sem supervisor';
      if (!supervisoresMap[resp]) supervisoresMap[resp] = { total: 0, compliance: 0 };
      supervisoresMap[resp].total++;
      if (evidenciaFinalRegistrada(item)) supervisoresMap[resp].compliance++;
    }
    return true;
  });

    filtrados.forEach(item => {
    const encerrado = /FINALIZAD|CONCLU[IÍ]D|RESOLVID/i.test(item.statusAtual || '');
    if (!encerrado) {
      totalIncidentes++;
      if (item.tipoRede === "BACKBONE") totalBackbone++;
      else totalGpon += Number(item.clientesCount || 0);
      if (!evidenciaFinalRegistrada(item)) pendentes++;
    }

    const est = item.estado || "SP";
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
        👥 Clientes GPON: ${escaparHtml(item.clientesCount)} | Previsão: ${escaparHtml(item.previsao)}
      </div>
    `;
    container.appendChild(card);
  });

  document.getElementById('kpiTotalIncidentes').textContent = totalIncidentes;
  document.getElementById('kpiTotalGpon').textContent = totalGpon;
  document.getElementById('kpiTotalBackbone').textContent = totalBackbone;
  document.getElementById('kpiEvidenciasPendentes').textContent = pendentes;
  document.getElementById('resumoExecutivo').textContent = totalIncidentes
    ? `${totalIncidentes} incidente${totalIncidentes === 1 ? '' : 's'} em andamento · ${totalGpon.toLocaleString('pt-BR')} cliente${totalGpon === 1 ? '' : 's'} GPON informado${totalGpon === 1 ? '' : 's'} · ${pendentes} registro${pendentes === 1 ? '' : 's'} sem evidência final completa.`
    : 'Nenhum incidente ativo no recorte selecionado. Consulte os registros abaixo para acompanhar o histórico.';
  document.getElementById('painelAtualizado').textContent = `Dados atualizados às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const siglas = [...new Set(['SP', 'MG', 'PR', ...estadosContagem.keys(), ...todosIncidentesCache.map(item => item.estado).filter(Boolean)])].sort();
  const grid = document.getElementById('stateGrid');
  grid.replaceChildren();
  for (const estado of ['TODOS', ...siglas]) {
    const cartao = document.createElement('button');
    cartao.type = 'button';
    cartao.className = 'kpi-card state-card' + (estadoFiltroAtivo === estado ? ' active-filter' : '');
    cartao.dataset.estado = estado;
    const nome = document.createElement('span'); nome.className = 'kpi-title'; nome.textContent = estado === 'TODOS' ? 'Todos os estados' : estado;
    const total = document.createElement('strong'); total.className = 'kpi-value'; total.textContent = estado === 'TODOS' ? [...estadosContagem.values()].reduce((soma, valor) => soma + valor, 0) : estadosContagem.get(estado) || 0;
    cartao.append(nome, total);
    cartao.onclick = () => filtrarPainelPorEstado(estado);
    grid.append(cartao);
  }
  const relatorioEstado = document.getElementById('relatorioEstado');
  const selecionado = relatorioEstado.value;
  relatorioEstado.replaceChildren(new Option('Todos', 'TODOS'), ...siglas.map(sigla => new Option(sigla, sigla)));
  relatorioEstado.value = siglas.includes(selecionado) ? selecionado : 'TODOS';

  if (!filtrados.length) {
    container.innerHTML = '<p class="empty-state">Nenhum chamado encontrado nesta região.</p>';
  }

  renderizarGraficosGerenciais(totalIncidentes - totalBackbone, totalBackbone, estadosContagem, supervisoresMap);
}

function renderizarGraficosGerenciais(gpon, backbone, estadosContagem, supervisoresMap) {
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
    const principais = Object.entries(supervisoresMap).sort((a, b) => b[1].total - a[1].total).slice(0, 6);
    const supNomes = principais.map(([nome]) => nome);
    const supTotals = principais.map(([, dados]) => dados.total);
    const supCompls = principais.map(([, dados]) => dados.compliance);

    chartSupervisoresInstance = new Chart(ctxSup, {
      type: 'bar',
      data: {
        labels: supNomes,
        datasets: [
          { label: 'Ativos', data: supTotals, backgroundColor: '#AAB9D6' },
          { label: 'Evidência final', data: supCompls, backgroundColor: '#4D86B7' }
        ]
      },
      options: { responsive: true, indexAxis: 'y', plugins: { legend: { position: 'bottom' } } }
    });
  }
}

// 4. MÓDULO TÉCNICO DE CAMPO
let chamadoAtivoTecnico = null;
let mapaFotosBase64 = {};
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
    for (const [chave, foto] of Object.entries(mapaFotosBase64)) {
      const previas = { fotoDeslocamento: 'tp1', fotoChegada: 'tp2', fotoRompimento: 'tp3', fotoPanoramica: 'tp4', fotoEquipe: 'tp5' };
      const previsualizacao = document.getElementById(previas[chave] || chave.replace('caixaFoto', 'caixaPreview'));
      if (previsualizacao && foto) { previsualizacao.src = foto; previsualizacao.style.display = 'block'; }
    }
    atualizarEstadoLocal('Rascunho recuperado deste aparelho. Confira os dados e envie a etapa.');
  } catch { atualizarEstadoLocal('Não foi possível recuperar o rascunho local.'); }
}

function carregarListaTecnico() {
  const idAtivoSalvo = localStorage.getItem(`tech_active_doc_${usuarioUid}`);
  if (perfilSalvo === 'tecnico' && !/^[A-Z]{2}$/.test(estadoSalvo)) {
    alert('Seu perfil precisa de uma sigla de estado válida. Solicite ao administrador.');
    return;
  }
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
      if (perfilSalvo !== 'admin' && (estItem !== estadoSalvo || item.tecnicoUid !== usuarioUid)) return;

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
  }
  document.getElementById('techNomeDisplayStage1').textContent = usuarioSalvo;
  if (!document.getElementById('caixasTecnico').children.length) {
    adicionarCaixaTecnico(); adicionarCaixaTecnico();
  }
  await carregarColegasTecnicos(item.estado).catch(() => atualizarEstadoLocal('Lista de técnicos indisponível sem conexão. Tente novamente online.'));
  await restaurarRascunhoTecnico();

  document.getElementById('techSelectArea').style.display = 'none';
  document.getElementById('techFormArea').style.display = 'block';
  document.getElementById('techActiveIdDisplay').textContent = `Atendendo ID: ${item.idIncidente}`;

  const etapasConcluidas = new Set((item.timelineEtapas || []).map(evento => String(evento.etapa).match(/^ETAPA (\d)/)?.[1])).size;
  if (etapasConcluidas >= 3) avancarEtapaVisual(4);
  else if (etapasConcluidas >= 2) avancarEtapaVisual(3);
  else if (etapasConcluidas >= 1) avancarEtapaVisual(2);
  else avancarEtapaVisual(1);
}

window.liberarAtendimentoTecnico = async () => {
  localStorage.removeItem(`tech_active_doc_${usuarioUid}`);
  chamadoAtivoTecnico = null;
  document.getElementById('techSelectArea').style.display = 'block';
  document.getElementById('techFormArea').style.display = 'none';
};

window.processarFotoComMarcaDagua = async (input, idPreview, chaveFoto) => {
  const file = input.files[0];
  if (file) {
    try {
      const textoMarca = `ZAAZ TELECOM | ${new Date().toLocaleString('pt-BR')} | ${usuarioSalvo}`;
      const foto = await comprimirEMarcarDagua(file, textoMarca);
      const img = document.getElementById(idPreview);
      img.src = foto;
      img.style.display = 'block';
      mapaFotosBase64[chaveFoto] = foto;
      await salvarRascunhoTecnico();
    } catch (erro) {
      input.value = '';
      delete mapaFotosBase64[chaveFoto];
      alert(erro.message);
    }
  }
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
  caixa.innerHTML = `<div class="box-heading"><h5>Caixa</h5><button type="button" class="remove-box" aria-label="Remover esta caixa">Remover</button></div><label for="caixaGps${numero}">Localização GPS</label><input id="caixaGps${numero}" type="text" class="box-gps" readonly placeholder="Ainda não capturada"><button type="button" class="btn-sec-sm btn-capture" onclick="capturarGPSTecnico('caixaGps${numero}')">📍 Capturar localização</button><label for="caixaFoto${numero}">Foto da caixa acomodada</label><input id="caixaFoto${numero}" type="file" accept="image/*" capture="environment" onchange="processarFotoComMarcaDagua(this, 'caixaPreview${numero}', 'caixaFoto${numero}')"><img id="caixaPreview${numero}" class="preview-img" alt="Prévia da caixa">`;
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
  if (currentStepTech > 1) avancarEtapaVisual(currentStepTech - 1);
};

async function carregarColegasTecnicos(estado) {
  const resultado = await getDocs(query(collection(db, 'usuarios'), where('perfil', '==', 'tecnico')));
  const pessoas = resultado.docs.map(item => ({ uid: item.id, ...item.data() })).filter(item => item.ativo === true && item.estado === estado && item.uid !== usuarioUid);
  const ajudantes = document.getElementById('techAjudantes');
  const transferir = document.getElementById('techTransferir');
  ajudantes.replaceChildren(...pessoas.map(item => new Option(item.nome, item.uid)));
  transferir.replaceChildren(new Option('Manter comigo', ''), ...pessoas.map(item => new Option(item.nome, item.uid)));
  tecnicosDisponiveis = pessoas;
}

window.transferirAtendimentoTecnico = async () => {
  const uid = document.getElementById('techTransferir').value;
  const destino = tecnicosDisponiveis.find(item => item.uid === uid && item.estado === chamadoAtivoTecnico?.estado);
  if (!destino) { alert('Selecione outro técnico cadastrado e ativo no mesmo estado.'); return; }
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
  currentStepTech = novaEtapa;
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

  // Cada foto vai para um documento próprio. O incidente guarda apenas referências.
  const fotoIds = [];
  for (const dadosBase64 of fotosArr) {
    const fotoRef = await addDoc(collection(db, 'fotos'), {
      incidenteId: chamadoAtivoTecnico.docId,
      estado: estadoEnvio,
      criadoPorUid: usuarioUid,
      criadoEm: serverTimestamp(),
      dadosBase64
    });
    fotoIds.push(fotoRef.id);
  }

  const evento = {
    etapa: tituloEtapa,
    dataHora: new Date().toLocaleString("pt-BR"),
    tecnico: usuarioSalvo,
    fotoIds,
    observacao: descObs,
    ...campos
  };
  const timelineAtualizada = await runTransaction(db, async transacao => {
    const atual = await transacao.get(docRef);
    if (!atual.exists()) throw new Error('Este incidente não existe mais.');
    if (perfilSalvo === 'tecnico' && atual.data().tecnicoUid !== usuarioUid) {
      throw new Error('Este incidente não está atribuído à sua conta.');
    }
    const timelineAtual = [...(atual.data().timelineEtapas || []), evento];
    const payload = { statusAtual: tituloEtapa, timelineEtapas: timelineAtual };
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
        statusOzmaps: 'PENDENTE'
      });
    }
    return timelineAtual;
  });
  chamadoAtivoTecnico.timelineEtapas = timelineAtualizada;
}

window.salvarEtapa1 = async () => {
  if (!navigator.onLine) { await salvarRascunhoTecnico(); return; }
  const fotos = [];
  if (mapaFotosBase64['fotoDeslocamento']) fotos.push(mapaFotosBase64['fotoDeslocamento']);
  const ajudantes = [...document.getElementById('techAjudantes').selectedOptions].map(option => ({ uid: option.value, nome: option.textContent }));
  try {
    await registrarEventoTimeline('ETAPA 1: EM DESLOCAMENTO', fotos, `Técnico ${usuarioSalvo} iniciou deslocamento.`, null, {
      ajudantes, tipoArea: document.getElementById('techArea').value, condicaoRisco: document.getElementById('techRisco').value,
      fotosEsperadas: 1, fotosPendentes: fotos.length ? 0 : 1
    });
    avancarEtapaVisual(2);
    confirmarEnvioEtapa(1);
  } catch (erro) { alert('Etapa 1 não enviada: ' + erro.message); }
};

window.salvarEtapa2 = async () => {
  if (!navigator.onLine) { await salvarRascunhoTecnico(); return; }
  const previsaoVal = document.getElementById('techPrevisaoInput').value.trim();
  const causa = document.getElementById('techCausaRompimento').value.trim();
  if (!previsaoVal) {
    alert("⚠️ Por favor, informe a Previsão Aproximada de Restauração!");
    return;
  }
  if (!causa) { alert('Descreva a causa do rompimento. Se ainda não souber, escreva “Em apuração”.'); document.getElementById('techCausaRompimento').focus(); return; }

  const fotos = [];
  if (mapaFotosBase64['fotoChegada']) fotos.push(mapaFotosBase64['fotoChegada']);
  if (mapaFotosBase64['fotoRompimento']) fotos.push(mapaFotosBase64['fotoRompimento']);

  try {
    await registrarEventoTimeline('ETAPA 2: NO LOCAL / ROMPIMENTO', fotos, `Causa: ${causa}. Previsão: ${previsaoVal}`, previsaoVal, { causaRompimento: causa, fotosEsperadas: 2, fotosPendentes: 2 - fotos.length });
    avancarEtapaVisual(3);
    confirmarEnvioEtapa(2);
  } catch (erro) { alert('Etapa 2 não enviada: ' + erro.message); }
};

window.salvarEtapa3 = async () => {
  if (!navigator.onLine) { await salvarRascunhoTecnico(); return; }
  const fotos = [];
  if (mapaFotosBase64['fotoPanoramica']) fotos.push(mapaFotosBase64['fotoPanoramica']);
  if (mapaFotosBase64['fotoEquipe']) fotos.push(mapaFotosBase64['fotoEquipe']);

  try {
    await registrarEventoTimeline('ETAPA 3: EXECUTANDO / FUSIONANDO', fotos, 'Técnico atuando e fusionando.', null, { fotosEsperadas: 2, fotosPendentes: 2 - fotos.length });
    avancarEtapaVisual(4);
    confirmarEnvioEtapa(3);
  } catch (erro) { alert('Etapa 3 não enviada: ' + erro.message); }
};

window.salvarEtapa4Final = async () => {
  if (!navigator.onLine) { await salvarRascunhoTecnico(); return; }
  const mensagem = document.getElementById('techEtapa4Erro');
  mensagem.hidden = true;
  document.querySelectorAll('.box-evidence').forEach(caixa => caixa.classList.remove('invalid-box'));
  const obsTexto = document.getElementById('tobs').value.trim();
  const caixas = [...document.querySelectorAll('.box-evidence')].map((elemento, indice) => {
    const gps = elemento.querySelector('.box-gps').value.trim();
    const chave = elemento.querySelector('input[type=file]').id;
    return { numero: indice + 1, gps, foto: mapaFotosBase64[chave], chave };
  });
  const avaliacao = avaliarFinalizacao(caixas, obsTexto);
  if (!avaliacao.valido) {
    const elemento = avaliacao.indice >= 0 ? document.getElementById(caixas[avaliacao.indice].chave).closest('.box-evidence') : document.getElementById('tobs');
    if (avaliacao.indice >= 0) elemento.classList.add('invalid-box');
    mensagem.textContent = avaliacao.mensagem;
    mensagem.hidden = false;
    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const btn = document.getElementById('btnSalvarTecnicoFinal');
  btn.textContent = "⏳ Finalizando...";
  btn.disabled = true;

  try {
    const fotos = caixas.map(caixa => caixa.foto);
    await registrarEventoTimeline('ETAPA 4: REPARO CONCLUÍDO / FINALIZADO', fotos, obsTexto, null, {
      caixas: caixas.map((caixa, indice) => ({ numero: caixa.numero, gps: caixa.gps, indiceFoto: indice })), descricaoServico: obsTexto
    });
    localStorage.removeItem(`tech_active_doc_${usuarioUid}`);
    await operarRascunho('readwrite', 'delete').catch(() => {});
    alert('Atendimento concluído e entregue a Projetos.');
    location.reload();
  } catch (erro) {
    console.error('Falha na etapa 4:', erro);
    mensagem.textContent = `Etapa 4 não enviada: ${erro.message || erro.code || 'falha de envio'}. Seu rascunho foi preservado.`;
    mensagem.hidden = false;
    mensagem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    btn.disabled = false;
    btn.textContent = 'Finalizar Atendimento de Campo';
  }
};

// 5. CONSULTA SAC / SUPORTE / NOC
// Nunca baixe a coleção inteira para montar a lista: cada página consulta até 24 documentos.
let listaIncidentesSac = [];
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
    renderizarListaSac([...encontrados.values()]);
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

function adicionarMiniatura(galeria, dados) {
  if (typeof dados !== 'string' || !dados.startsWith('data:image/jpeg;base64,')) return;
  const imagem = document.createElement('img');
  imagem.src = dados;
  imagem.alt = 'Foto do atendimento';
  imagem.addEventListener('click', () => ampliarFoto(dados));
  galeria.appendChild(imagem);
}

window.abrirModalDetalhes = (item) => {
  document.getElementById('modalIdTitle').textContent = `🚨 Incidente ID: ${item.idIncidente}`;
  const formularioAdmin = document.getElementById('formAdminEdicao');
  formularioAdmin.hidden = perfilSalvo !== 'admin';
  if (perfilSalvo === 'admin') {
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
    <strong>OS:</strong> ${escaparHtml(item.os)}<br>
    <strong>Cidades:</strong> ${escaparHtml(item.cidades)} (${escaparHtml(item.estado || 'SP')})<br>
    <strong>Rede:</strong> ${escaparHtml(item.tipoRede || 'GPON')} | <strong>OLT:</strong> ${escaparHtml(item.olt)}<br>
    <strong>Status:</strong> <span style="color:var(--zaaz-blue); font-weight:700;">${escaparHtml(item.statusAtual)}</span><br>
    <strong>Clientes:</strong> ${escaparHtml(item.clientesCount)}<br>
    <strong>Previsão:</strong> ${escaparHtml(item.previsao)}<br>
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
        if (dataLegadaDentroDoPrazo(t.dataHora)) {
          (t.fotos || []).forEach(url => adicionarMiniatura(galeria, url));
        }
        (t.fotoIds || []).forEach(async fotoId => {
          try {
            const foto = await getDoc(doc(db, 'fotos', fotoId));
            if (foto.exists()) adicionarMiniatura(galeria, foto.data().dadosBase64);
          } catch (erro) {
            // A regra bloqueia leitura depois de 15 dias, mesmo antes da limpeza diária.
          }
        });
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
    if (responsavelNovo !== formulario.dataset.responsavelOriginal) alteracoes.supervisorUid = '';
    await updateDoc(doc(db, 'incidentes', id), alteracoes);
    alert('Correção salva. Reabra o ID para conferir os dados atualizados.');
    window.fecharModal();
  } catch (erro) { alert(erro.message || 'Não foi possível salvar a correção.'); }
  finally { botao.disabled = false; }
});

window.ampliarFoto = (url) => {
  const lb = document.getElementById('lightboxOverlay');
  const img = document.getElementById('lightboxImage');
  img.src = url;
  lb.style.display = 'flex';
};

window.fecharZoomFoto = () => {
  document.getElementById('lightboxOverlay').style.display = 'none';
};

window.fecharModal = () => {
  document.getElementById('modalDetalhesIncidente').style.display = 'none';
};
document.getElementById('modalDetalhesIncidente')?.addEventListener('click', event => {
  if (event.target === event.currentTarget) fecharModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (document.getElementById('lightboxOverlay')?.style.display === 'flex') fecharZoomFoto();
    else fecharModal();
  }
});

window.exportarRelatorioCSV = () => {
  const inicio = document.getElementById('relatorioInicio').value;
  const fim = document.getElementById('relatorioFim').value;
  if (inicio && fim && inicio > fim) {
    alert('A data inicial deve ser anterior à data final.');
    return;
  }
  const estado = document.getElementById('relatorioEstado').value;
  const supervisor = document.getElementById('relatorioSupervisor').value.trim().toLocaleLowerCase('pt-BR');
  const filtrados = todosIncidentesCache.filter(item => {
    if (estado !== 'TODOS' && (item.estado || detectarEstado(item.cidades || '')) !== estado) return false;
    if (supervisor && !String(item.responsavel || '').toLocaleLowerCase('pt-BR').includes(supervisor)) return false;
    const data = Number(item.dataTimestamp || 0);
    if ((inicio || fim) && !data) return false;
    const dataLocal = data ? new Date(data).toLocaleDateString('sv-SE') : '';
    return (!inicio || dataLocal >= inicio) && (!fim || dataLocal <= fim);
  });
  if (filtrados.length === 0) {
    alert("Nenhum dado para exportar.");
    return;
  }

  const celula = valor => {
    let texto = String(valor ?? '');
    if (/^[\s\r\n]*[=+\-@]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replace(/"/g, '""')}"`;
  };
  const linhas = [
    ['NEXTFLOW | ZAAZ TELECOM · Relatório de incidentes'],
    [`Gerado em ${new Date().toLocaleString('pt-BR')}`, `Período: ${inicio || 'início'} a ${fim || 'hoje'}`, `Estado: ${estado}`, `Supervisor: ${supervisor || 'todos'}`],
    [`Total de IDs: ${filtrados.length}`, `Evidência final pendente: ${filtrados.filter(item => !evidenciaFinalRegistrada(item)).length}`],
    [],
    ['ID', 'OS', 'Cidades', 'Estado', 'Rede', 'Clientes', 'Status', 'Supervisor', 'Técnico', 'Evidência final', 'Data de criação']
  ];
  filtrados.forEach(i => linhas.push([
    i.idIncidente, i.os, i.cidades, i.estado, i.tipoRede,
    i.clientesCount, i.statusAtual, i.responsavel, i.tecnicoAtribuido,
    evidenciaFinalRegistrada(i) ? 'Registrada' : 'Pendente', i.dataCriacao
  ]));
  const arquivo = new Blob(['\uFEFF', linhas.map(linha => linha.map(celula).join(';')).join('\r\n')],
    { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Relatorio_ZAAZ_${new Date().toISOString().slice(0, 10)}.csv`;
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
