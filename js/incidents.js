/* ==========================================================================
   NEXTFLOW ENTERPRISE - LOGICA DE INCIDENTES EXPANDIDA (js/incidents.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Se for Admin, exibe o menu de navegação entre todas as abas
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
  } else {
    const vS = document.getElementById('viewSac');
    if (vS) vS.style.display = 'block';
    carregarIncidentesSac();
  }
}

// Troca de abas para o perfil Admin
window.alternarAba = (idAba) => {
  document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const abaAlvo = document.getElementById(idAba);
  if (abaAlvo) abaAlvo.style.display = 'block';

  if (idAba === 'viewGerente') carregarDashboardGerente();
  if (idAba === 'viewSac') carregarIncidentesSac();
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

// Detecta o Estado (SP, MG, PR) a partir da string de Cidades Afetadas
function detectarEstado(cidadesStr) {
  const c = cidadesStr.toUpperCase();
  if (c.includes("MG") || c.includes("MINAS")) return "MG";
  if (c.includes("PR") || c.includes("PARANÁ") || c.includes("PARANA")) return "PR";
  return "SP"; // Padrão
}

// 1. REGISTRO AUTOMÁTICO DO NOC
const formNoc = document.getElementById('formNocIncidente');
if (formNoc) {
  formNoc.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarNoc');
    const textoBruto = document.getElementById('nocTextoComunicado').value.trim();

    btn.textContent = "⏳ Lendo e gravando comunicado...";
    btn.disabled = true;

    try {
      let idIncidenteExt = extrairCampo(textoBruto, "ID");
      if (!idIncidenteExt) idIncidenteExt = gerarIdAutomatico();

      const cidadesExt = extrairCampo(textoBruto, "CIDADES AFETADAS") || "Geral / SP";
      const estadoExt = detectarEstado(cidadesExt);

      await addDoc(collection(db, "incidentes"), {
        idIncidente: idIncidenteExt,
        os: extrairCampo(textoBruto, "ORDEM DE SERVIÇO") || "Não informada",
        cidades: cidadesExt,
        estado: estadoExt,
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

      alert(`⚡ Comunicado lido com sucesso!\nID do Incidente: ${idIncidenteExt}\nEstado: ${estadoExt}`);
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

// 2. DASHBOARD GERENCIAL COM CONTAGEM POR ESTADO (SP, MG, PR)
let todosIncidentesCache = [];

function carregarDashboardGerente() {
  onSnapshot(collection(db, "incidentes"), (snapshot) => {
    let totalIncidentes = snapshot.size;
    let totalClientes = 0;
    let spCount = 0, mgCount = 0, prCount = 0;

    todosIncidentesCache = [];
    const container = document.getElementById('gerenteIncidentesList');
    if (!container) return;
    container.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const item = docSnap.data();
      item.docId = docSnap.id;
      todosIncidentesCache.push(item);

      totalClientes += Number(item.clientesCount || 0);

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
        <p style="margin: 8px 0; font-size: 13px;"><strong>Cidades:</strong> ${item.cidades} (${est}) | <strong>OLT:</strong> ${item.olt}</p>
        <p style="font-size: 13px; color: var(--text-muted);">${item.descricao}</p>
        <div style="margin-top: 8px; font-size: 12px; color: var(--danger); font-weight:700;">
          👥 Clientes: ${item.clientesCount} | Previsão: ${item.previsao}
        </div>
      `;
      container.appendChild(card);
    });

    document.getElementById('kpiTotalIncidentes').textContent = totalIncidentes;
    document.getElementById('kpiTotalClientes').textContent = totalClientes;
    document.getElementById('kpiSpCount').textContent = spCount;
    document.getElementById('kpiMgCount').textContent = mgCount;
    document.getElementById('kpiPrCount').textContent = prCount;
  });
}

// 3. CONSULTA DO SAC COM MODAL DE FOTOS E DETALHES
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
      <p style="font-size:13px; margin-bottom:4px;"><strong>Previsão:</strong> ${item.previsao}</p>
      <p style="font-size:12px; color:var(--primary); font-weight:700; margin-top:8px;">🔍 Clique para abrir fotos e detalhes do técnico</p>
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

// EXIBIÇÃO DO MODAL COM FOTOS E COMENTÁRIOS DO TÉCNICO
window.abrirModalDetalhes = (item) => {
  document.getElementById('modalIdTitle').textContent = `🚨 Incidente ID: ${item.idIncidente}`;
  
  const infoBox = document.getElementById('modalInfoBox');
  infoBox.innerHTML = `
    <strong>Ordem de Serviço (OS):</strong> ${item.os}<br>
    <strong>Cidades Afetadas:</strong> ${item.cidades} (${item.estado || 'SP'})<br>
    <strong>OLT / Portas:</strong> ${item.olt} (Portas: ${item.portas})<br>
    <strong>Status Atual:</strong> ${item.statusAtual}<br>
    <strong>Clientes Afetados:</strong> ${item.clientesCount}<br>
    <strong>Previsão de Solução:</strong> ${item.previsao}<br>
    <strong>Responsável:</strong> ${item.responsavel}<br>
    <hr style="margin:8px 0; border:none; border-top:1px solid #E2E8F0;">
    <strong>Descrição Oficial:</strong> ${item.descricao}
  `;

  // Fotos do Técnico
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

  document.getElementById('modalDetalhesIncidente').style.display = 'flex';
};

window.fecharModal = () => {
  document.getElementById('modalDetalhesIncidente').style.display = 'none';
};

// EXPORTAÇÃO DE RELATÓRIO EM EXCEL / CSV
window.exportarRelatorioCSV = () => {
  if (todosIncidentesCache.length === 0) {
    alert("Nenhum dado disponível para exportação.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,ID,OS,Cidades,Estado,OLT,Clientes,Status,Previsao,DataCriacao\n";

  todosIncidentesCache.forEach(i => {
    csvContent += `"${i.idIncidente}","${i.os}","${i.cidades}","${i.estado}","${i.olt}","${i.clientesCount}","${i.statusAtual}","${i.previsao}","${i.dataCriacao}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Relatorio_Incidentes_ZAAZ_${new Date().toLocaleDateString('pt-BR')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.sair = () => {
  localStorage.clear();
  window.location.href = 'index.html';
};

configurarTelasPorPerfil();
