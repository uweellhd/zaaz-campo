/* ==========================================================================
   NEXTFLOW ENTERPRISE - LOGICA DE PERMISSÕES & INCIDENTES (js/incidents.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, updateDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

const badgeElem = document.getElementById('userBadge');

// LÓGICA DE VISIBILIDADE DAS ABAS BASEADA EM PERMISSÕES DINÂMICAS (RBAC)
function configurarTelasPorPerfil() {
  const btnGerente = document.getElementById('btnTabGerente');
  const btnNoc = document.getElementById('btnTabNoc');
  const btnSac = document.getElementById('btnTabSac');
  const btnTech = document.getElementById('btnTabTech');
  const btnUsers = document.getElementById('btnTabUsers');

  // Oculta todas as abas inicialmente
  [btnGerente, btnNoc, btnSac, btnTech, btnUsers].forEach(btn => { if (btn) btn.style.display = 'none'; });
  document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');

  if (perfilSalvo === 'admin') {
    // Admin vê todas as abas + Aba de Gestão de Usuários
    [btnGerente, btnNoc, btnSac, btnTech].forEach(btn => { if (btn) btn.style.display = 'inline-block'; });
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
  } else {
    // SAC e Suporte
    if (btnSac) btnSac.style.display = 'inline-block';
    alternarAba('viewSac');
  }
}

window.alternarAba = (idAba) => {
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
  } else if (idAba === 'viewUsers') {
    const b = document.getElementById('btnTabUsers');
    if (b) b.classList.add('active');
  }
};

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
  body.className = `dashboard-body ${tema}`;
  localStorage.setItem('user_theme', tema);
};

const temaSalvo = localStorage.getItem('user_theme') || 'theme-light';
mudarTemaSistema(temaSalvo);
const selectTema = document.getElementById('themeSelector');
if (selectTema) selectTema.value = temaSalvo;

function comprimirEMarcarDagua(file, textoMarca, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
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

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
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
  onSnapshot(collection(db, "incidentes"), (snapshot) => {
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
    if (est === "SP") spCount++;
    if (est === "MG") mgCount++;
    if (est === "PR") prCount++;

    const resp = item.responsavel || "SUPERVISOR GERAL";
    if (!supervisoresMap[resp]) supervisoresMap[resp] = { total: 0, compliance: 0 };
    supervisoresMap[resp].total++;
    if (item.timelineEtapas && item.timelineEtapas.length >= 4) supervisoresMap[resp].compliance++;

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
          { label: 'Com 4 Etapas Ok', data: supCompls, backgroundColor: '#10B981' }
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
  const idAtivoSalvo = localStorage.getItem(`tech_active_doc_${usuarioSalvo}`);

  onSnapshot(collection(db, "incidentes"), (snapshot) => {
    const container = document.getElementById('techIncidentsList');
    if (!container) return;
    container.innerHTML = "";

    snapshot.forEach(docSnap => {
      if (verificarEExcluirExpirados(docSnap)) return;

      const item = docSnap.data();
      item.docId = docSnap.id;

      // Trava rigorosa por estado do técnico
      const estItem = item.estado || detectarEstado(item.cidades || "");
      if (estItem !== estadoSalvo && estadoSalvo !== 'TODOS' && perfilSalvo !== 'admin') return;

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
        <p style="font-size:12px; color:var(--success); font-weight:700;">▶️ Clicar para Assumir / Continuar</p>
      `;
      container.appendChild(card);
    });
  });
}

async function iniciarAtendimentoTecnico(item, novoAtendimento = true) {
  chamadoAtivoTecnico = item;
  mapaFotosBase64 = {};

  if (novoAtendimento) {
    const docRef = doc(db, "incidentes", item.docId);
    try {
      await runTransaction(db, async transacao => {
        const atual = await transacao.get(docRef);
        if (!atual.exists() || atual.data().tecnicoUid) throw new Error('Este chamado já foi assumido.');
        transacao.update(docRef, { tecnicoAtribuido: usuarioSalvo, tecnicoUid: usuarioUid });
      });
    } catch (erro) {
      alert(erro.message);
      return;
    }
    localStorage.setItem(`tech_active_doc_${usuarioSalvo}`, item.docId);
  }

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
  if (chamadoAtivoTecnico) {
    const docRef = doc(db, "incidentes", chamadoAtivoTecnico.docId);
    await updateDoc(docRef, { tecnicoAtribuido: "", tecnicoUid: "" });
  }
  localStorage.removeItem(`tech_active_doc_${usuarioSalvo}`);
  chamadoAtivoTecnico = null;
  document.getElementById('techSelectArea').style.display = 'block';
  document.getElementById('techFormArea').style.display = 'none';
};

window.processarFotoComMarcaDagua = async (input, idPreview, chaveFoto) => {
  const file = input.files[0];
  if (file) {
    const textoMarca = `ZAAZ TELECOM | ${new Date().toLocaleString('pt-BR')} | ${usuarioSalvo}`;
    const base64Comprimida = await comprimirEMarcarDagua(file, textoMarca, 1200, 0.7);
    
    const img = document.getElementById(idPreview);
    img.src = base64Comprimida;
    img.style.display = 'block';
    mapaFotosBase64[chaveFoto] = base64Comprimida;
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

  const timelineAtual = chamadoAtivoTecnico.timelineEtapas || [];
  timelineAtual.push({
    etapa: tituloEtapa,
    dataHora: new Date().toLocaleString("pt-BR"),
    tecnico: usuarioSalvo,
    fotos: fotosArr,
    observacao: descObs
  });

  const payload = {
    statusAtual: tituloEtapa,
    timelineEtapas: timelineAtual
  };

  if (novaPrevisao) payload.previsao = novaPrevisao;

  await updateDoc(docRef, payload);
  chamadoAtivoTecnico.timelineEtapas = timelineAtual;
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

  localStorage.removeItem(`tech_active_doc_${usuarioSalvo}`);
  alert("🎉 Atendimento finalizado com sucesso!");
  location.reload();
};

// 5. CONSULTA SAC / SUPORTE / NOC
let listaIncidentesSac = [];

function carregarIncidentesSac() {
  onSnapshot(collection(db, "incidentes"), (snapshot) => {
    listaIncidentesSac = [];
    snapshot.forEach(docSnap => {
      if (verificarEExcluirExpirados(docSnap)) return;

      const data = docSnap.data();
      data.docId = docSnap.id;
      listaIncidentesSac.push(data);
    });
    renderizarListaSac(listaIncidentesSac);
  });
}

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

window.filtrarSac = () => {
  const inputElem = document.getElementById('inputBuscaSac');
  if (!inputElem) return;

  const termo = inputElem.value.toLowerCase().trim();
  const filtrados = listaIncidentesSac.filter(item => 
    (item.idIncidente && item.idIncidente.toLowerCase().includes(termo)) ||
    (item.os && item.os.toLowerCase().includes(termo)) ||
    (item.cidades && item.cidades.toLowerCase().includes(termo)) ||
    (item.descricao && item.descricao.toLowerCase().includes(termo))
  );
  renderizarListaSac(filtrados);
};

window.abrirModalDetalhes = (item) => {
  document.getElementById('modalIdTitle').textContent = `🚨 Incidente ID: ${item.idIncidente}`;
  
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
      if (Array.isArray(t.fotos) && t.fotos.length) {
        const galeria = document.createElement('div');
        galeria.className = 'timeline-photos';
        t.fotos.forEach(url => {
          if (typeof url !== 'string' || !url.startsWith('data:image/')) return;
          const imagem = document.createElement('img');
          imagem.src = url;
          imagem.alt = 'Foto do atendimento';
          imagem.addEventListener('click', () => ampliarFoto(url));
          galeria.appendChild(imagem);
        });
        itemDiv.appendChild(galeria);
      }
      timelineContainer.appendChild(itemDiv);
    });
  } else {
    timelineContainer.innerHTML = "<p class='text-muted' style='font-size:12px;'>Aguardando primeira ação do técnico de rua.</p>";
  }

  document.getElementById('modalDetalhesIncidente').style.display = 'flex';
};

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
  if (todosIncidentesCache.length === 0) {
    alert("Nenhum dado para exportar.");
    return;
  }

  const celula = valor => {
    let texto = String(valor ?? '');
    if (/^[\s\r\n]*[=+\-@]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replace(/"/g, '""')}"`;
  };
  const linhas = [['ID', 'OS', 'Cidades', 'Estado', 'Rede', 'Clientes', 'Status', 'DataCriacao']];
  todosIncidentesCache.forEach(i => linhas.push([
    i.idIncidente, i.os, i.cidades, i.estado, i.tipoRede,
    i.clientesCount, i.statusAtual, i.dataCriacao
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
  await signOut(auth);
  window.location.replace('index.html');
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
    usuarioUid = usuario.uid;
    usuarioSalvo = perfil.nome || usuario.email;
    perfilSalvo = perfil.perfil;
    estadoSalvo = perfil.estado;
    if (badgeElem) badgeElem.textContent = `${usuarioSalvo} (${perfilSalvo.toUpperCase()} - ${estadoSalvo})`;
    configurarTelasPorPerfil();
  } catch (erro) {
    await signOut(auth);
    window.location.replace('index.html');
  }
});
