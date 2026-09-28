/* ==========================================================================
   NEXTFLOW ENTERPRISE - LOGICA DE INCIDENTES (js/incidents.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Credenciais do Firebase ZAAZ Telecom
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

// Recupera informações da sessão ativa
const perfilSalvo = localStorage.getItem('user_perfil') || 'sac';
const usuarioSalvo = localStorage.getItem('user_nome') || 'Colaborador';

const badgeElem = document.getElementById('userBadge');
if (badgeElem) {
  badgeElem.textContent = `${usuarioSalvo} (${perfilSalvo.toUpperCase()})`;
}

// Alterna os painéis conforme o perfil autenticado
function configurarTelasPorPerfil() {
  document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');

  if (perfilSalvo === 'gerente' || perfilSalvo === 'diretor') {
    const vG = document.getElementById('viewGerente');
    if (vG) vG.style.display = 'block';
    carregarDashboardGerente();
  } else if (perfilSalvo === 'noc' || perfilSalvo === 'admin') {
    const vN = document.getElementById('viewNoc');
    if (vN) vN.style.display = 'block';
  } else {
    const vS = document.getElementById('viewSac');
    if (vS) vS.style.display = 'block';
    carregarIncidentesSac();
  }
}

// FUNÇÃO AUXILIAR: EXTRAI UM CAMPO DO TEXTO COLADO VIA EXPRESSÃO REGULAR
function extrairCampo(texto, rotulo) {
  const regex = new RegExp(rotulo + "\\s*:\\s*(.*)", "i");
  const match = texto.match(regex);
  return match ? match[1].trim() : "";
}

// FUNÇÃO AUXILIAR: GERA UM ID AUTOMÁTICO CASO O TEXTO NÃO TENHA
function gerarIdAutomatico() {
  const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
  return `INC-${numeroAleatorio}`;
}

// 1. REGISTRO AUTOMÁTICO DO COMUNICADO PELO NOC (LEITURA DO TEXTO)
const formNoc = document.getElementById('formNocIncidente');
if (formNoc) {
  formNoc.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarNoc');
    const textoBruto = document.getElementById('nocTextoComunicado').value.trim();

    btn.textContent = "⏳ Lendo comunicado e salvando...";
    btn.disabled = true;

    try {
      // Extração automática de cada campo do texto colado
      let idIncidenteExt = extrairCampo(textoBruto, "ID");
      if (!idIncidenteExt) {
        idIncidenteExt = gerarIdAutomatico();
      }

      const osExt = extrairCampo(textoBruto, "ORDEM DE SERVIÇO") || "Não informada";
      const cidadesExt = extrairCampo(textoBruto, "CIDADES AFETADAS") || "Geral";
      const oltExt = extrairCampo(textoBruto, "OLT") || "N/A";
      const portasExt = extrairCampo(textoBruto, "PORTAS AFETADAS") || "N/A";
      const tipoExt = extrairCampo(textoBruto, "INCIDENTE") || "REDE";
      const clientesExtStr = extrairCampo(textoBruto, "CLIENTES AFETADOS") || "0";
      const clientesCountExt = parseInt(clientesExtStr, 10) || 0;
      const responsavelExt = extrairCampo(textoBruto, "RESPONSÁVEL") || usuarioSalvo;
      const previsaoExt = extrairCampo(textoBruto, "PREVISÃO") || "A definir";
      const statusExt = extrairCampo(textoBruto, "STATUS ATUAL") || "EM ATENDIMENTO";
      const descricaoExt = extrairCampo(textoBruto, "DESCRIÇÃO") || textoBruto;

      // Gravação dos dados extraídos no Firebase Firestore
      await addDoc(collection(db, "incidentes"), {
        idIncidente: idIncidenteExt,
        os: osExt,
        cidades: cidadesExt,
        olt: oltExt,
        portas: portasExt,
        incidenteTipo: tipoExt,
        clientesCount: clientesCountExt,
        responsavel: responsavelExt,
        previsao: previsaoExt,
        statusAtual: statusExt,
        descricao: descricaoExt,
        textoCompleto: textoBruto,
        dataCriacao: new Date().toLocaleString("pt-BR")
      });

      alert(`⚡ Comunicado lido com sucesso!\nID do Incidente: ${idIncidenteExt}`);
      formNoc.reset();
      btn.textContent = "⚡ Processar e Publicar Comunicado";
      btn.disabled = false;
    } catch (err) {
      alert("Erro ao processar comunicado: " + err.message);
      btn.textContent = "⚡ Processar e Publicar Comunicado";
      btn.disabled = false;
    }
  });
}

// 2. DASHBOARD DE MENSURAÇÃO PARA DIREÇÃO / GERÊNCIA
function carregarDashboardGerente() {
  const q = collection(db, "incidentes");
  
  onSnapshot(q, (snapshot) => {
    let totalIncidentes = snapshot.size;
    let totalClientes = 0;
    const container = document.getElementById('gerenteIncidentesList');
    if (!container) return;

    container.innerHTML = "";

    snapshot.forEach((doc) => {
      const item = doc.data();
      totalClientes += Number(item.clientesCount || 0);

      const card = document.createElement('div');
      card.className = 'incidente-card';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:var(--primary);">ID: ${item.idIncidente} | OS: ${item.os}</strong>
          <span style="background:#FEF3C7; color:#92400E; padding:3px 8px; border-radius:6px; font-weight:700; font-size:11px;">${item.statusAtual}</span>
        </div>
        <p style="margin: 8px 0; font-size: 13px;"><strong>Cidades:</strong> ${item.cidades} | <strong>OLT:</strong> ${item.olt}</p>
        <p style="font-size: 13px; color: var(--text-muted);">${item.descricao}</p>
        <div style="margin-top: 8px; font-size: 12px; color: var(--danger); font-weight:700;">
          👥 Clientes Afetados: ${item.clientesCount} | Previsão: ${item.previsao}
        </div>
      `;
      container.appendChild(card);
    });

    const elemInc = document.getElementById('kpiTotalIncidentes');
    const elemCli = document.getElementById('kpiTotalClientes');
    if (elemInc) elemInc.textContent = totalIncidentes;
    if (elemCli) elemCli.textContent = totalClientes;
  });
}

// 3. CONSULTA RÁPIDA DE INCIDENTES PELO SAC
let listaIncidentesSac = [];

function carregarIncidentesSac() {
  onSnapshot(collection(db, "incidentes"), (snapshot) => {
    listaIncidentesSac = [];
    snapshot.forEach(doc => listaIncidentesSac.push(doc.data()));
    renderizarListaSac(listaIncidentesSac);
  });
}

function renderizarListaSac(lista) {
  const container = document.getElementById('sacResultsList');
  if (!container) return;

  container.innerHTML = "";

  if (lista.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:var(--text-muted); padding:20px;'>Nenhum incidente localizado no momento.</p>";
    return;
  }

  lista.forEach(item => {
    const card = document.createElement('div');
    card.className = 'incidente-card';
    card.innerHTML = `
      <h4 style="color:var(--primary); margin-bottom:6px;">🚨 ID: ${item.idIncidente} - ${item.cidades}</h4>
      <p style="font-size:13px; margin-bottom:4px;"><strong>OS:</strong> ${item.os} | <strong>OLT:</strong> ${item.olt} | <strong>Portas:</strong> ${item.portas}</p>
      <p style="font-size:13px; margin-bottom:4px;"><strong>Status Atual:</strong> <span style="color:var(--primary); font-weight:700;">${item.statusAtual}</span></p>
      <p style="font-size:13px; margin-bottom:4px;"><strong>Previsão de Solução:</strong> ${item.previsao}</p>
      <p style="font-size:13px; background:#F1F5F9; padding:10px; border-radius:8px; margin-top:6px; border:1px solid #E2E8F0;">${item.descricao}</p>
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

window.sair = () => {
  localStorage.clear();
  window.location.href = 'index.html';
};

configurarTelasPorPerfil();
