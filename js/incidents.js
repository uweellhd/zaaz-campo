/* ==========================================================================
   NEXTFLOW ENTERPRISE - LOGICA DE INCIDENTES (js/incidents.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

const perfilSalvo = localStorage.getItem('user_perfil') || 'sac';
const usuarioSalvo = localStorage.getItem('user_nome') || 'Colaborador';

const badgeElem = document.getElementById('userBadge');
if (badgeElem) {
  badgeElem.textContent = `${usuarioSalvo} (${perfilSalvo.toUpperCase()})`;
}

if (perfilSalvo === 'admin') {
  const adminNav = document.getElementById('adminNavMenu');
  if (adminNav) adminNav.style.display = 'flex';
}

// RELÓGIO CORPORATIVO EM TEMPO REAL
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

// GERENCIADOR DE TEMAS
window.mudarTemaSistema = (tema) => {
  const body = document.getElementById('appBody');
  body.className = `dashboard-body ${tema}`;
  localStorage.setItem('user_theme', tema);
};

const temaSalvo = localStorage.getItem('user_theme') || 'theme-light';
mudarTemaSistema(temaSalvo);
const selectTema = document.getElementById('themeSelector');
if (selectTema) selectTema.value = temaSalvo;

function configurarTelasPorPerfil() {
  document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');

  if (perfilSalvo === 'gerente' || perfilSalvo === 'diretor' || perfilSalvo === 'admin') {
    const vG = document.getElementById('viewGerente');
    if (vG) vG.style.display = 'block';
    carregarDashboardGerente();
  } else if (perfilSalvo === 'noc') {
    const vN = document.getElementById('viewNoc');
    if (vN) vN.style.display = 'block';
  } else if (perfilSalvo === 'tecnico') {
    const vT = document.getElementById('viewTech');
    if (vT) vT.style.display = 'block';
    carregarListaTecnico();
  } else {
    const vS = document.getElementById('viewSac');
    if (vS) vS.style.display = 'block';
    carregarIncidentesSac();
  }
}

window.alternarAba = (idAba) => {
  document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const abaAlvo = document.getElementById(idAba);
  if (abaAlvo) abaAlvo.style.display = 'block';

  if (idAba === 'viewGerente') carregarDashboardGerente();
  if (idAba === 'viewSac') carregarIncidentesSac();
  if (idAba === 'viewTech') carregarListaTecnico();
};

// COMPRESSOR DE IMAGEM AUTOMÁTICO
function comprimirImagem(file, maxWidth = 1200, quality = 0.7) {
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

// EXPIRADOR AUTOMÁTICO DE INCIDENTES (MAIORES QUE 15 DIAS)
function verificarEExcluirExpirados(docSnap) {
  const item = docSnap.data();
  if (item.dataTimestamp) {
    const agora = new Date().getTime();
    const diferencaDias = (agora - item.dataTimestamp) / (1000 * 60 * 60 * 24);
    if (diferencaDias >= 15) {
      deleteDoc(doc(db, "incidentes", docSnap.id));
      return true;
    }
  }
  return false;
}

// 1. REGISTRO AUTOMÁTICO DO NOC
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

// 2. DASHBOARD GERENCIAL
let todosIncidentesCache = [];
let chartTipoInstance = null;
let chartEstadosInstance = null;

function carregarDashboardGerente() {
  onSnapshot(collection(db, "incidentes"), (snapshot) => {
    let totalIncidentes = 0;
    let totalGpon = 0;
    let totalBackbone = 0;
    let spCount = 0, mgCount = 0, prCount = 0;

    todosIncidentesCache = [];
    const container = document.getElementById('gerenteIncidentesList');
    if (!container) return;
    container.innerHTML = "";

    snapshot.forEach((docSnap) => {
      if (verificarEExcluirExpirados(docSnap)) return;

      const item = docSnap.data();
      item.docId = docSnap.id;
      todosIncidentesCache.push(item);
      totalIncidentes++;

      if (item.tipoRede === "BACKBONE") totalBackbone++;
      else totalGpon += Number(item.clientesCount || 0);

      const est = item.estado || detectarEstado(item.cidades || "");
      if (est === "SP") spCount++;
      else if (est === "MG") mgCount++;
      else if (est === "PR") prCount++;

      const card = document.createElement('div');
      card.className = 'incidente-card';
      card.onclick = () => abrirModalDetalhes(item);
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:var(--zaaz-blue);">ID: ${item.idIncidente} | OS: ${item.os}</strong>
          <span style="background:#FEF3C7; color:#92400E; padding:3px 8px; border-radius:6px; font-weight:700; font-size:11px;">${item.statusAtual}</span>
        </div>
        <p style="margin: 8px 0; font-size: 13px;"><strong>Cidades:</strong> ${item.cidades} (${est}) | <strong>Rede:</strong> ${item.tipoRede || 'GPON'}</p>
        <p style="font-size: 13px; color: var(--text-muted);">${item.descricao}</p>
        <div style="margin-top: 8px; font-size: 12px; color: var(--danger); font-weight:700;">
          👥 Clientes GPON: ${item.clientesCount} | Previsão: ${item.previsao}
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

    renderizarGraficosGerenciais(totalGpon, totalBackbone, spCount, mgCount, prCount);
  });
}

function renderizarGraficosGerenciais(gpon, backbone, sp, mg, pr) {
  const ctxTipo = document.getElementById('chartTipoIncidente');
  const ctxEst = document.getElementById('chartEstados');

  if (ctxTipo) {
    if (chartTipoInstance) chartTipoInstance.destroy();
    chartTipoInstance = new Chart(ctxTipo, {
      type: 'doughnut',
      data: {
        labels: ['Rede GPON (Clientes)', 'Rotas Backbone'],
        datasets: [{
          data: [gpon, backbone],
          backgroundColor: ['#EF4444', '#FF9900']
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  if (ctxEst) {
    if (chartEstadosInstance) chartEstadosInstance.destroy();
    chartEstadosInstance = new Chart(ctxEst, {
      type: 'bar',
      data: {
        labels: ['São Paulo (SP)', 'Minas Gerais (MG)', 'Paraná (PR)'],
        datasets: [{
          label: 'Incidentes Ativos',
          data: [sp, mg, pr],
          backgroundColor: '#0052CC'
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }
}

// 3. MÓDULO TÉCNICO DE CAMPO
let chamadoAtivoTecnico = null;
let mapaFotosBase64 = {};

function carregarListaTecnico() {
  onSnapshot(collection(db, "incidentes"), (snapshot) => {
    const container = document.getElementById('techIncidentsList');
    if (!container) return;
    container.innerHTML = "";

    snapshot.forEach(docSnap => {
      if (verificarEExcluirExpirados(docSnap)) return;

      const item = docSnap.data();
      item.docId = docSnap.id;

      const card = document.createElement('div');
      card.className = 'incidente-card';
      card.onclick = () => iniciarAtendimentoTecnico(item);
      card.innerHTML = `
        <h4 style="color:var(--zaaz-blue); margin-bottom:6px;">🚨 ID: ${item.idIncidente}</h4>
        <p style="font-size:13px;"><strong>OS:</strong> ${item.os} | <strong>Cidades:</strong> ${item.cidades}</p>
        <p style="font-size:12px; color:var(--zaaz-blue); font-weight:700; margin-top:8px;">Status Atual: ${item.statusAtual}</p>
        <p style="font-size:12px; color:var(--success); font-weight:700;">▶️ Clicar para Iniciar / Continuar Trato</p>
      `;
      container.appendChild(card);
    });
  });
}

function iniciarAtendimentoTecnico(item) {
  chamadoAtivoTecnico = item;
  mapaFotosBase64 = {};
  document.getElementById('techSelectArea').style.display = 'none';
  document.getElementById('techFormArea').style.display = 'block';
  document.getElementById('techActiveIdDisplay').textContent = `Atendendo ID: ${item.idIncidente}`;
}

window.cancelarAtendimentoTecnico = () => {
  chamadoAtivoTecnico = null;
  document.getElementById('techSelectArea').style.display = 'block';
  document.getElementById('techFormArea').style.display = 'none';
};

window.processarEPreviewFoto = async (input, idPreview, chaveFoto) => {
  const file = input.files[0];
  if (file) {
    const base64Comprimida = await comprimirImagem(file, 1200, 0.7);
    const img = document.getElementById(idPreview);
    img.src = base64Comprimida;
    img.style.display = 'block';
    mapaFotosBase64[chaveFoto] = base64Comprimida;
  }
};

window.capturarGPSTecnico = (idInput) => {
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById(idInput).value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
    alert("📍 Coordenadas de GPS capturadas!");
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

window.voltarEtapaVisual = (dir) => {
  avancarEtapaVisual(currentStepTech + dir);
};

// SALVAMENTO PARCIAL NA TIMELINE
async function registrarEventoTimeline(tituloEtapa, fotosArr, descObs) {
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

  await updateDoc(docRef, {
    statusAtual: tituloEtapa,
    timelineEtapas: timelineAtual
  });
}

window.salvarEtapa1 = async () => {
  const fotos = [];
  if (mapaFotosBase64['fotoDeslocamento']) fotos.push(mapaFotosBase64['fotoDeslocamento']);

  await registrarEventoTimeline("ETAPA 1: EM DESLOCAMENTO", fotos, "Técnico iniciou deslocamento para a ocorrência.");
  alert("✅ Etapa 1 registrada!");
  avancarEtapaVisual(2);
};

window.salvarEtapa2 = async () => {
  const fotos = [];
  if (mapaFotosBase64['fotoChegada']) fotos.push(mapaFotosBase64['fotoChegada']);
  if (mapaFotosBase64['fotoRompimento']) fotos.push(mapaFotosBase64['fotoRompimento']);

  await registrarEventoTimeline("ETAPA 2: NO LOCAL / ROMPIMENTO", fotos, "Técnico no local identificando rompimento.");
  alert("✅ Etapa 2 registrada!");
  avancarEtapaVisual(3);
};

window.salvarEtapa3 = async () => {
  const fotos = [];
  if (mapaFotosBase64['fotoPanoramica']) fotos.push(mapaFotosBase64['fotoPanoramica']);
  if (mapaFotosBase64['fotoEquipe']) fotos.push(mapaFotosBase64['fotoEquipe']);

  await registrarEventoTimeline("ETAPA 3: EXECUTANDO / FUSIONANDO", fotos, "Equipe em execução dos trabalhos de fusão.");
  alert("✅ Etapa 3 registrada!");
  avancarEtapaVisual(4);
};

window.salvarEtapa4Final = async () => {
  const obsTexto = document.getElementById('tobs').value.trim();
  const gps1 = document.getElementById('tgps1').value;
  const gps2 = document.getElementById('tgps2').value;

  if (!obsTexto || !gps1 || !gps2 || !mapaFotosBase64['fotoAcomodacao'] || !mapaFotosBase64['fotoLocalLimpo']) {
    alert("⚠️ Por favor, preencha todos os campos obrigatórios da Etapa 4!");
    return;
  }

  const btn = document.getElementById('btnSalvarTecnicoFinal');
  btn.textContent = "⏳ Finalizando...";
  btn.disabled = true;

  const fotos = [mapaFotosBase64['fotoAcomodacao'], mapaFotosBase64['fotoLocalLimpo']];
  const descFinal = `Reparo Concluído: ${obsTexto} | GPS C1: ${gps1} | GPS C2: ${gps2}`;

  await registrarEventoTimeline("ETAPA 4: REPARO CONCLUÍDO / FINALIZADO", fotos, descFinal);

  alert("🎉 Atendimento de campo finalizado com sucesso!");
  location.reload();
};

// 4. CONSULTA SAC COM TIMELINE COMPLETA
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
      <h4 style="color:var(--zaaz-blue); margin-bottom:6px;">🚨 ID: ${item.idIncidente} - ${item.cidades}</h4>
      <p style="font-size:13px; margin-bottom:4px;"><strong>OS:</strong> ${item.os} | <strong>OLT:</strong> ${item.olt}</p>
      <p style="font-size:13px; margin-bottom:4px;"><strong>Status:</strong> <span style="color:var(--zaaz-blue); font-weight:700;">${item.statusAtual}</span></p>
      <p style="font-size:12px; color:var(--zaaz-blue); font-weight:700; margin-top:8px;">🔍 Clique para ver a Timeline de Progresso e Fotos</p>
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

// EXIBIÇÃO DA TIMELINE COMPLETA NO MODAL
window.abrirModalDetalhes = (item) => {
  document.getElementById('modalIdTitle').textContent = `🚨 Incidente ID: ${item.idIncidente}`;
  
  const infoBox = document.getElementById('modalInfoBox');
  infoBox.innerHTML = `
    <strong>Ordem de Serviço (OS):</strong> ${item.os}<br>
    <strong>Cidades Afetadas:</strong> ${item.cidades} (${item.estado || 'SP'})<br>
    <strong>Rede:</strong> ${item.tipoRede || 'GPON'} | <strong>OLT:</strong> ${item.olt}<br>
    <strong>Status em Tempo Real:</strong> <span style="color:var(--zaaz-blue); font-weight:700;">${item.statusAtual}</span><br>
    <strong>Clientes Afetados:</strong> ${item.clientesCount}<br>
    <strong>Previsão de Solução:</strong> ${item.previsao}<br>
    <strong>Responsável Oficial:</strong> ${item.responsavel}<br>
    <hr style="margin:8px 0; border:none; border-top:1px solid var(--border-color);">
    <strong>Descrição Inicial:</strong> ${item.descricao}
  `;

  const timelineContainer = document.getElementById('modalTimelineList');
  timelineContainer.innerHTML = "";

  if (item.timelineEtapas && item.timelineEtapas.length > 0) {
    item.timelineEtapas.forEach(t => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'timeline-item';

      let photosHtml = "";
      if (t.fotos && t.fotos.length > 0) {
        photosHtml = `<div class="timeline-photos">` + t.fotos.map(url => `<img src="${url}">`).join('') + `</div>`;
      }

      itemDiv.innerHTML = `
        <div class="timeline-header">
          <span>${t.etapa}</span>
          <span>${t.dataHora} (${t.tecnico})</span>
        </div>
        <p style="font-size:13px;">${t.observacao}</p>
        ${photosHtml}
      `;
      timelineContainer.appendChild(itemDiv);
    });
  } else {
    timelineContainer.innerHTML = "<p class='text-muted' style='font-size:12px;'>Aguardando primeira ação do técnico de rua.</p>";
  }

  document.getElementById('modalDetalhesIncidente').style.display = 'flex';
};

window.fecharModal = () => {
  document.getElementById('modalDetalhesIncidente').style.display = 'none';
};

window.exportarRelatorioCSV = () => {
  if (todosIncidentesCache.length === 0) {
    alert("Nenhum dado disponível para exportação.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,ID,OS,Cidades,Estado,Rede,Clientes,Status,DataCriacao\n";

  todosIncidentesCache.forEach(i => {
    csvContent += `"${i.idIncidente}","${i.os}","${i.cidades}","${i.estado}","${i.tipoRede}","${i.clientesCount}","${i.statusAtual}","${i.dataCriacao}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Relatorio_ZAAZ_${new Date().toLocaleDateString('pt-BR')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.sair = () => {
  localStorage.clear();
  window.location.href = 'index.html';
};

configurarTelasPorPerfil();
