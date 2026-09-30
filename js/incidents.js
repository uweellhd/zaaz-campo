/* ==========================================================================
   NEXTFLOW ENTERPRISE - LOGICA DE PERMISSÕES & INCIDENTES (js/incidents.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, getDocs, updateDoc, runTransaction, query, where, orderBy, documentId, startAfter, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, verifyBeforeUpdateEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
  admin: ['viewGerente', 'viewNoc', 'viewSac', 'viewTech', 'viewConta', 'viewAcessos'],
  gerente: ['viewGerente', 'viewSac'],
  diretor: ['viewGerente', 'viewSac'],
  noc: ['viewNoc', 'viewSac'],
  sac: ['viewSac'],
  suporte: ['viewSac'],
  tecnico: ['viewTech'],
  supervisor: ['viewSupervisor']
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
let tecnicosDisponiveis = [];
let supervisoresDisponiveis = [];

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
  // Oculta todas as abas inicialmente
  [btnGerente, btnNoc, btnSac, btnTech, btnConta, btnAcessos, btnSupervisor].forEach(btn => { if (btn) btn.style.display = 'none'; });
  document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');

  if (perfilSalvo === 'admin') {
    // Administrador da operação vê as quatro áreas.
    [btnGerente, btnNoc, btnSac, btnTech, btnConta, btnAcessos, btnSupervisor].forEach(btn => { if (btn) btn.style.display = 'inline-block'; });
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
  } else {
    // SAC e Suporte
    if (btnSac) btnSac.style.display = 'inline-block';
    alternarAba('viewSac');
  }
}

window.alternarAba = (idAba) => {
  if (!(abasPermitidas[perfilSalvo] || []).includes(idAba)) return;
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
  }
};

function nomeCurto(nome) {
  return String(nome || '').trim().split(/\s+/).slice(0, 2).join(' ');
}

function evidenciaFinalRegistrada(incidente) {
  return (incidente.timelineEtapas || []).some(evento =>
    String(evento.etapa || '').startsWith('ETAPA 4')
    && ((evento.fotoIds || []).length >= 2 || (evento.fotos || []).length >= 2 || Number(evento.fotosRemovidas || 0) >= 2)
    && /GPS C1: .+\| GPS C2: .+/.test(evento.observacao || '')
  );
}

function carregarSupervisor() {
  const consulta = perfilSalvo === 'admin' ? collection(db, 'incidentes')
    : query(collection(db, 'incidentes'), where('supervisorUid', '==', usuarioUid));
  ouvirUmaVez('supervisor', consulta, snapshot => {
    const container = document.getElementById('supervisorResultados');
    container.replaceChildren();
    let total = 0, completos = 0;
    snapshot.forEach(documento => {
      const item = documento.data();
      if (perfilSalvo !== 'admin' && item.supervisorUid !== usuarioUid) return;
      total++;
      const ok = evidenciaFinalRegistrada(item);
      if (ok) completos++;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'incidente-card supervisor-card';
      const titulo = document.createElement('strong');
      titulo.textContent = `ID ${item.idIncidente} · OS ${item.os || 'Não informada'}`;
      const detalhes = document.createElement('small');
      detalhes.textContent = `${item.cidades || ''} · ${item.statusAtual || ''} · Técnico: ${nomeCurto(item.tecnicoAtribuido) || 'Não atribuído'}`;
      const situacao = document.createElement('span');
      situacao.className = ok ? 'evidence-complete' : 'evidence-pending';
      situacao.textContent = ok ? 'Evidência final registrada' : 'Evidência final pendente';
      card.append(titulo, detalhes, situacao);
      card.addEventListener('click', () => abrirModalDetalhes({ ...item, docId: documento.id }));
      container.append(card);
    });
    document.getElementById('supervisorTotal').textContent = String(total);
    document.getElementById('supervisorPendente').textContent = String(total - completos);
    document.getElementById('supervisorCompleto').textContent = String(completos);
    if (!total) container.textContent = 'Nenhum ID vinculado. Peça ao NOC ou admin para vincular seus IDs antigos.';
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
      for (const [valor, texto] of Object.entries({ sac: 'SAC', suporte: 'Suporte', noc: 'NOC', tecnico: 'Técnico', supervisor: 'Supervisor', gerente: 'Gerente', diretor: 'Diretor' })) {
        perfil.add(new Option(texto, valor));
      }
      perfil.value = pessoa.perfil;
      const estado = document.createElement('select');
      estado.setAttribute('aria-label', `Estado de ${pessoa.nome}`);
      for (const valor of ['SP', 'MG', 'PR', 'TODOS']) estado.add(new Option(valor, valor));
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
        if (perfil.value === 'tecnico' && estado.value === 'TODOS') { alert('Escolha SP, MG ou PR para o técnico.'); return; }
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
      for (const [valor, texto] of Object.entries({ sac: 'SAC', suporte: 'Suporte', noc: 'NOC', tecnico: 'Técnico', supervisor: 'Supervisor', gerente: 'Gerente', diretor: 'Diretor' })) {
        perfil.add(new Option(texto, valor));
      }
      const estado = document.createElement('select');
      estado.setAttribute('aria-label', `Estado de ${pedido.nome}`);
      for (const valor of ['SP', 'MG', 'PR', 'TODOS']) estado.add(new Option(valor, valor));
      const aprovar = document.createElement('button');
      aprovar.type = 'button';
      aprovar.className = 'btn-primary';
      aprovar.textContent = 'Aprovar';
      aprovar.addEventListener('click', async () => {
        if (perfil.value === 'tecnico' && estado.value === 'TODOS') { alert('Escolha SP, MG ou PR para o técnico.'); return; }
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
  if (c.includes("MG") || c.includes("MINAS")) return "MG";
  if (c.includes("PR") || c.includes("PARANÁ") || c.includes("PARANA")) return "PR";
  return "SP";
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
  if (estado === 'SP') document.getElementById('cardSp').classList.add('active-filter');
  if (estado === 'MG') document.getElementById('cardMg').classList.add('active-filter');
  if (estado === 'PR') document.getElementById('cardPr').classList.add('active-filter');

  const tituloList = document.getElementById('tituloListaConsolidada');
  if (tituloList) {
    tituloList.textContent = estado === "TODOS" ? "📋 Visão Geral Consolidada (Todos os Estados)" : `📋 Visão Geral Consolidada (Estado: ${estado})`;
  }

  renderizarPainelGerenteFiltrado();
};

function renderizarPainelGerenteFiltrado() {
  let totalIncidentes = 0, totalGpon = 0, totalBackbone = 0;
  let spCount = 0, mgCount = 0, prCount = 0;
  let supervisoresMap = {};

  const container = document.getElementById('gerenteIncidentesList');
  if (!container) return;
  container.innerHTML = "";

  const filtrados = todosIncidentesCache.filter(item => {
    const est = item.estado || detectarEstado(item.cidades || "");
    const encerrado = /FINALIZAD|CONCLU[IÍ]D|RESOLVID/i.test(item.statusAtual || '');
    if (!encerrado) {
      if (est === "SP") spCount++;
      if (est === "MG") mgCount++;
      if (est === "PR") prCount++;
    }

    const resp = item.responsavel || "SUPERVISOR GERAL";
    if (!supervisoresMap[resp]) supervisoresMap[resp] = { total: 0, compliance: 0 };
    supervisoresMap[resp].total++;
    if (evidenciaFinalRegistrada(item)) supervisoresMap[resp].compliance++;

    if (estadoFiltroAtivo === "TODOS") return true;
    return est === estadoFiltroAtivo;
  });

    filtrados.forEach(item => {
    const encerrado = /FINALIZAD|CONCLU[IÍ]D|RESOLVID/i.test(item.statusAtual || '');
    if (!encerrado) {
      totalIncidentes++;
      if (item.tipoRede === "BACKBONE") totalBackbone++;
      else totalGpon += Number(item.clientesCount || 0);
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
  document.getElementById('kpiSpCount').textContent = spCount;
  document.getElementById('kpiMgCount').textContent = mgCount;
  document.getElementById('kpiPrCount').textContent = prCount;

  if (!filtrados.length) {
    container.innerHTML = '<p class="empty-state">Nenhum chamado encontrado nesta região.</p>';
  }

  renderizarGraficosGerenciais(totalIncidentes - totalBackbone, totalBackbone, spCount, mgCount, prCount, supervisoresMap);
}

function renderizarGraficosGerenciais(gpon, backbone, sp, mg, pr, supervisoresMap) {
  const ctxTipo = document.getElementById('chartTipoIncidente');
  const ctxEst = document.getElementById('chartEstados');
  const ctxSup = document.getElementById('chartSupervisores');

  if (ctxTipo) {
    if (chartTipoInstance) chartTipoInstance.destroy();
    chartTipoInstance = new Chart(ctxTipo, {
      type: 'doughnut',
      data: { labels: ['Incidentes GPON', 'Incidentes Backbone'], datasets: [{ data: [gpon, backbone], backgroundColor: ['#EF4444', '#FF9900'] }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  if (ctxEst) {
    if (chartEstadosInstance) chartEstadosInstance.destroy();
    chartEstadosInstance = new Chart(ctxEst, {
      type: 'bar',
      data: { labels: ['SP', 'MG', 'PR'], datasets: [{ label: 'Incidentes', data: [sp, mg, pr], backgroundColor: '#0052CC' }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }

  if (ctxSup) {
    if (chartSupervisoresInstance) chartSupervisoresInstance.destroy();
    const supNomes = Object.keys(supervisoresMap);
    const supTotals = supNomes.map(k => supervisoresMap[k].total);
    const supCompls = supNomes.map(k => supervisoresMap[k].compliance);

    chartSupervisoresInstance = new Chart(ctxSup, {
      type: 'bar',
      data: {
        labels: supNomes,
        datasets: [
          { label: 'Total Incidentes', data: supTotals, backgroundColor: '#94A3B8' },
          { label: 'Com evidência final', data: supCompls, backgroundColor: '#10B981' }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
}

// 4. MÓDULO TÉCNICO DE CAMPO
let chamadoAtivoTecnico = null;
let mapaFotosBase64 = {};

function carregarListaTecnico() {
  const idAtivoSalvo = localStorage.getItem(`tech_active_doc_${usuarioUid}`);
  if (perfilSalvo === 'tecnico' && !['SP', 'MG', 'PR'].includes(estadoSalvo)) {
    alert('Seu perfil precisa de um estado válido (SP, MG ou PR). Solicite ao administrador.');
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

      if (idAtivoSalvo === item.docId) {
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
  mapaFotosBase64 = {};

  document.getElementById('techSelectArea').style.display = 'none';
  document.getElementById('techFormArea').style.display = 'block';
  document.getElementById('techActiveIdDisplay').textContent = `Atendendo ID: ${item.idIncidente}`;

  const etapasConcluidas = item.timelineEtapas ? item.timelineEtapas.length : 0;
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
    } catch (erro) {
      input.value = '';
      delete mapaFotosBase64[chaveFoto];
      alert(erro.message);
    }
  }
};

window.capturarGPSTecnico = (idInput) => {
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById(idInput).value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
    alert("📍 GPS Capturado com sucesso!");
  });
};

let currentStepTech = 1;

function avancarEtapaVisual(novaEtapa) {
  document.getElementById(`step-${currentStepTech}`).classList.remove('active');
  document.getElementById(`ind-${currentStepTech}`).classList.remove('active');
  currentStepTech = novaEtapa;
  document.getElementById(`step-${currentStepTech}`).classList.add('active');
  document.getElementById(`ind-${currentStepTech}`).classList.add('active');
}

async function registrarEventoTimeline(tituloEtapa, fotosArr, descObs, novaPrevisao = null) {
  if (!chamadoAtivoTecnico) return;
  const docRef = doc(db, "incidentes", chamadoAtivoTecnico.docId);

  // Cada foto vai para um documento próprio. O incidente guarda apenas referências.
  const fotoIds = [];
  for (const dadosBase64 of fotosArr) {
    const fotoRef = await addDoc(collection(db, 'fotos'), {
      incidenteId: chamadoAtivoTecnico.docId,
      estado: chamadoAtivoTecnico.estado,
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
    observacao: descObs
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
    return timelineAtual;
  });
  chamadoAtivoTecnico.timelineEtapas = timelineAtualizada;
}

window.salvarEtapa1 = async () => {
  const fotos = [];
  if (mapaFotosBase64['fotoDeslocamento']) fotos.push(mapaFotosBase64['fotoDeslocamento']);

  await registrarEventoTimeline("ETAPA 1: EM DESLOCAMENTO", fotos, `Técnico ${usuarioSalvo} iniciou deslocamento.`);
  alert("✅ Etapa 1 salva!");
  avancarEtapaVisual(2);
};

window.salvarEtapa2 = async () => {
  const previsaoVal = document.getElementById('techPrevisaoInput').value.trim();
  if (!previsaoVal) {
    alert("⚠️ Por favor, informe a Previsão Aproximada de Restauração!");
    return;
  }

  const fotos = [];
  if (mapaFotosBase64['fotoChegada']) fotos.push(mapaFotosBase64['fotoChegada']);
  if (mapaFotosBase64['fotoRompimento']) fotos.push(mapaFotosBase64['fotoRompimento']);

  await registrarEventoTimeline("ETAPA 2: NO LOCAL / ROMPIMENTO", fotos, `Técnico no local. Previsão: ${previsaoVal}`, previsaoVal);
  alert("✅ Etapa 2 salva!");
  avancarEtapaVisual(3);
};

window.salvarEtapa3 = async () => {
  const fotos = [];
  if (mapaFotosBase64['fotoPanoramica']) fotos.push(mapaFotosBase64['fotoPanoramica']);
  if (mapaFotosBase64['fotoEquipe']) fotos.push(mapaFotosBase64['fotoEquipe']);

  await registrarEventoTimeline("ETAPA 3: EXECUTANDO / FUSIONANDO", fotos, "Equipe executando fusões no local.");
  alert("✅ Etapa 3 salva!");
  avancarEtapaVisual(4);
};

window.salvarEtapa4Final = async () => {
  const obsTexto = document.getElementById('tobs').value.trim();
  const gps1 = document.getElementById('tgps1').value;
  const gps2 = document.getElementById('tgps2').value;

  if (!obsTexto || !gps1 || !gps2 || !mapaFotosBase64['fotoAcomodacao'] || !mapaFotosBase64['fotoLocalLimpo']) {
    alert("⚠️ Por favor, preencha todos os campos e anexos obrigatórios da Etapa 4!");
    return;
  }

  const btn = document.getElementById('btnSalvarTecnicoFinal');
  btn.textContent = "⏳ Finalizando...";
  btn.disabled = true;

  const fotos = [mapaFotosBase64['fotoAcomodacao'], mapaFotosBase64['fotoLocalLimpo']];
  const descFinal = `Reparo Concluído: ${obsTexto} | GPS C1: ${gps1} | GPS C2: ${gps2}`;

  await registrarEventoTimeline("ETAPA 4: REPARO CONCLUÍDO / FINALIZADO", fotos, descFinal);

  localStorage.removeItem(`tech_active_doc_${usuarioUid}`);
  alert("🎉 Atendimento finalizado com sucesso!");
  location.reload();
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
    const partes = [collection(db, 'incidentes'), orderBy(documentId(), 'desc')];
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
    if (!saindo) alert('Não foi possível carregar os chamados. Tente novamente.');
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
    document.getElementById('editarEstado').value = item.estado || detectarEstado(item.cidades || '');
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
    if (badgeElem) badgeElem.textContent = `${perfilSalvo === 'supervisor' ? nomeCurto(usuarioSalvo) : usuarioSalvo} (${perfilSalvo.toUpperCase()} - ${estadoSalvo})`;
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
