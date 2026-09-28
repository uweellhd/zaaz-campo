/* ==========================================================================
   NEXTFLOW ENTERPRISE - LOGICA COMPLETA DE INCIDENTES (js/incidents.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Se for Admin, habilita o menu de navegação por abas
if (perfilSalvo === 'admin') {
  const adminNav = document.getElementById('adminNavMenu');
  if (adminNav) adminNav.style.display = 'flex';
}

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
        statusAtual: extrairCampo(textoBruto, "STATUS ATUAL") || "EM ATENDIMENTO",
        descricao: extrairCampo(textoBruto, "DESCRIÇÃO") || textoBruto,
        textoCompleto: textoBruto,
        fotosTecnico: [],
        comentariosTecnico: [],
        dataCriacao: new Date().toLocaleString("pt-BR")
      });

      alert(`⚡ Comunicado lido com sucesso!\nID: ${idIncidenteExt}\nTipo: ${tipoRedeExt} | Estado: ${estadoExt}`);
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

// 2. DASHBOARD GERENCIAL COM GRÁFICOS (CHART.JS) E DIVISÃO GPON / BACKBONE
let todosIncidentesCache = [];
let chartTipoInstance = null;
let chartEstadosInstance = null;

function carregarDashboardGerente() {
  onSnapshot(collection(db, "incidentes"), (snapshot) => {
    let totalIncidentes = snapshot.size;
    let totalGpon = 0;
    let totalBackbone = 0;
    let spCount = 0, mgCount = 0, prCount = 0;

    todosIncidentesCache = [];
    const container = document.getElementById('gerenteIncidentesList');
    if (!container) return;
    container.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const item = docSnap.data();
      item.docId = docSnap.id;
      todosIncidentesCache.push(item);

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
          <strong style="color:var(--primary);">ID: ${item.idIncidente} | OS: ${item.os}</strong>
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
          backgroundColor: ['#EF4444', '#F59E0B']
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
          backgroundColor: '#0284C7'
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }
}

// 3. MÓDULO TÉCNICO DE CAMPO (SELEÇÃO DE CHAMADO E FLUXO DE 4 ETAPAS)
let chamadoAtivoTecnico = null;
let fotosTecnicoBase64 = [];

function carregarListaTecnico() {
  onSnapshot(collection(db, "incidentes"), (snapshot) => {
    const container = document.getElementById('techIncidentsList');
    if (!container) return;
    container.innerHTML = "";

    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      item.docId = docSnap.id;

      const card = document.createElement('div');
      card.className = 'incidente-card';
      card.onclick = () => iniciarAtendimentoTecnico(item);
      card.innerHTML = `
        <h4 style="color:var(--primary); margin-bottom:6px;">🚨 ID: ${item.idIncidente}</h4>
        <p style="font-size:13px;"><strong>OS:</strong> ${item.os} | <strong>Cidades:</strong> ${item.cidades}</p>
        <p style="font-size:12px; color:var(--primary); font-weight:700; margin-top:8px;">▶️ Clicar para Iniciar Trato de Rua</p>
      `;
      container.appendChild(card);
    });
  });
}

function iniciarAtendimentoTecnico(item) {
  chamadoAtivoTecnico = item;
  document.getElementById('techSelectArea').style.display = 'none';
  document.getElementById('techFormArea').style.display = 'block';
  document.getElementById('techActiveIdDisplay').textContent = `Atendendo ID: ${item.idIncidente}`;
}

window.cancelarAtendimentoTecnico = () => {
  chamadoAtivoTecnico = null;
  document.getElementById('techSelectArea').style.display = 'block';
  document.getElementById('techFormArea').style.display = 'none';
};

let currentStepTech = 1;
window.mudarEtapaTecnico = (dir) => {
  document.getElementById(`step-${currentStepTech}`).classList.remove('active');
  document.getElementById(`ind-${currentStepTech}`).classList.remove('active');
  currentStepTech += dir;
  document.getElementById(`step-${currentStepTech}`).classList.add('active');
  document.getElementById(`ind-${currentStepTech}`).classList.add('active');
};

window.previewFoto = (input, idPreview) => {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.getElementById(idPreview);
      img.src = e.target.result;
      img.style.display = 'block';
      fotosTecnicoBase64.push(e.target.result);
    };
    reader.readAsDataURL(file);
  }
};

window.capturarGPSTecnico = (idInput) => {
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById(idInput).value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
    alert("📍 Coordenadas de GPS capturadas!");
  });
};

const formTech = document.getElementById('techFormFlow');
if (formTech) {
  formTech.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!chamadoAtivoTecnico) return;

    const btn = document.getElementById('btnSalvarTecnico');
    btn.textContent = "⏳ Enviando atendimento...";
    btn.disabled = true;

    try {
      const docRef = doc(db, "incidentes", chamadoAtivoTecnico.docId);
      const obsTexto = document.getElementById('tobs').value.trim();
      const gps1 = document.getElementById('tgps1').value;
      const gps2 = document.getElementById('tgps2').value;

      await updateDoc(docRef, {
        statusAtual: "REPARO CONCLUÍDO / EM TESTES",
        fotosTecnico: fotosTecnicoBase64,
        comentariosTecnico: [`Solução do Técnico (${usuarioSalvo}): ${obsTexto} | GPS C1: ${gps1} | GPS C2: ${gps2}`]
      });

      alert("✅ Atendimento de rua finalizado e enviado com sucesso!");
      location.reload();
    } catch (err) {
      alert("Erro ao enviar: " + err.message);
      btn.textContent = "Finalizar e Enviar Atendimento";
      btn.disabled = false;
    }
  });
}

// 4. CONSULTA SAC COM MODAL
let listaIncidentesSac = [];

function carregarIncidentesSac() {
  onSnapshot(collection(db, "incidentes"), (snapshot) => {
    listaIncidentesSac = [];
    snapshot.forEach(docSnap => {
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
      <h4 style="color:var(--primary); margin-bottom:6px;">🚨 ID: ${item.idIncidente} - ${item.cidades}</h4>
      <p style="font-size:13px; margin-bottom:4px;"><strong>OS:</strong> ${item.os} | <strong>OLT:</strong> ${item.olt}</p>
      <p style="font-size:13px; margin-bottom:4px;"><strong>Status:</strong> <span style="color:var(--primary); font-weight:700;">${item.statusAtual}</span></p>
      <p style="font-size:12px; color:var(--primary); font-weight:700; margin-top:8px;">🔍 Clique para ver fotos e observações de rua</p>
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
    <strong>Ordem de Serviço (OS):</strong> ${item.os}<br>
    <strong>Cidades Afetadas:</strong> ${item.cidades} (${item.estado || 'SP'})<br>
    <strong>Rede:</strong> ${item.tipoRede || 'GPON'} | <strong>OLT:</strong> ${item.olt}<br>
    <strong>Status Atual:</strong> ${item.statusAtual}<br>
    <strong>Clientes Afetados:</strong> ${item.clientesCount}<br>
    <strong>Previsão de Solução:</strong> ${item.previsao}<br>
    <strong>Responsável:</strong> ${item.responsavel}<br>
    <hr style="margin:8px 0; border:none; border-top:1px solid #E2E8F0;">
    <strong>Descrição Oficial:</strong> ${item.descricao}
  `;

  const photosGrid = document.getElementById('modalPhotosGrid');
  photosGrid.innerHTML = "";
  if (item.fotosTecnico && item.fotosTecnico.length > 0) {
    item.fotosTecnico.forEach(url => {
      const img = document.createElement('img');
      img.src = url;
      photosGrid.appendChild(img);
    });
  } else {
    photosGrid.innerHTML = "<p class='text-muted' style='font-size:12px;'>Nenhuma foto anexada até o momento.</p>";
  }

  const commList = document.getElementById('modalCommentsList');
  commList.innerHTML = "";
  if (item.comentariosTecnico && item.comentariosTecnico.length > 0) {
    item.comentariosTecnico.forEach(c => {
      const p = document.createElement('p');
      p.style.fontSize = "13px";
      p.style.background = "#F1F5F9";
      p.style.padding = "10px";
      p.style.borderRadius = "8px";
      p.textContent = c;
      commList.appendChild(p);
    });
  } else {
    commList.innerHTML = "<p class='text-muted' style='font-size:12px;'>Aguardando atualização de rua do técnico.</p>";
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
