/* ==========================================================================
   NEXTFLOW ENTERPRISE - GESTÃO DE INCIDENTES FIRESTORE (js/incidents.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Credenciais do Firebase
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

// Recupera informações do usuário no carregamento
const perfilSalvo = localStorage.getItem('user_perfil') || 'sac';
const usuarioSalvo = localStorage.getItem('user_nome') || 'Colaborador';

document.getElementById('userBadge').textContent = `${usuarioSalvo} (${perfilSalvo.toUpperCase()})`;

// Controle de exibição por perfil
function configurarTelasPorPerfil() {
  document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');

  if (perfilSalvo === 'gerente' || perfilSalvo === 'diretor') {
    document.getElementById('viewGerente').style.display = 'block';
    carregarDashboardGerente();
  } else if (perfilSalvo === 'noc' || perfilSalvo === 'admin') {
    document.getElementById('viewNoc').style.display = 'block';
  } else {
    document.getElementById('viewSac').style.display = 'block';
    carregarIncidentesSac();
  }
}

// 1. NOC: REGISTRO DE INCIDENTE
const formNoc = document.getElementById('formNocIncidente');
if (formNoc) {
  formNoc.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSalvarNoc');
    btn.textContent = "⏳ Registrando...";
    btn.disabled = true;

    try {
      await addDoc(collection(db, "incidentes"), {
        idIncidente: document.getElementById('nocId').value.trim(),
        os: document.getElementById('nocOs').value.trim(),
        cidades: document.getElementById('nocCidades').value.trim(),
        olt: document.getElementById('nocOlt').value.trim(),
        portas: document.getElementById('nocPortas').value.trim(),
        incidenteTipo: document.getElementById('nocIncidenteTipo').value.trim(),
        clientesCount: Number(document.getElementById('nocClientesCount').value),
        responsavel: document.getElementById('nocResponsavel').value.trim(),
        previsao: document.getElementById('nocPrevisao').value.trim(),
        statusAtual: document.getElementById('nocStatus').value.trim(),
        descricao: document.getElementById('nocDescricao').value.trim(),
        dataCriacao: new Date().toLocaleString("pt-BR")
      });

      alert("🚨 Comunicado de incidente publicado com sucesso!");
      formNoc.reset();
      btn.textContent = "Publicar Comunicado no Sistema";
      btn.disabled = false;
    } catch (err) {
      alert("Erro ao registrar: " + err.message);
      btn.textContent = "Publicar Comunicado no Sistema";
      btn.disabled = false;
    }
  });
}

// 2. GERÊNCIA: DASHBOARD DE MENSURAÇÃO E INDICADORES (REAL-TIME)
function carregarDashboardGerente() {
  const q = query(collection(db, "incidentes"));
  
  onSnapshot(q, (snapshot) => {
    let totalIncidentes = snapshot.size;
    let totalClientes = 0;
    const container = document.getElementById('gerenteIncidentesList');
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

    document.getElementById('kpiTotalIncidentes').textContent = totalIncidentes;
    document.getElementById('kpiTotalClientes').textContent = totalClientes;
  });
}

// 3. SAC: CONSULTA RÁPIDA DE INCIDENTES
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
  container.innerHTML = "";

  if (lista.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:var(--text-muted);'>Nenhum incidente localizado.</p>";
    return;
  }

  lista.forEach(item => {
    const card = document.createElement('div');
    card.className = 'incidente-card';
    card.innerHTML = `
      <h4 style="color:var(--primary); margin-bottom:6px;">🚨 ID: ${item.idIncidente} - ${item.cidades}</h4>
      <p style="font-size:13px; margin-bottom:4px;"><strong>OS:</strong> ${item.os} | <strong>OLT:</strong> ${item.olt}</p>
      <p style="font-size:13px; margin-bottom:4px;"><strong>Status:</strong> <span style="color:var(--primary); font-weight:700;">${item.statusAtual}</span></p>
      <p style="font-size:13px; margin-bottom:4px;"><strong>Previsão de Solução:</strong> ${item.previsao}</p>
      <p style="font-size:13px; background:#F1F5F9; padding:8px; border-radius:6px; margin-top:6px;">${item.descricao}</p>
    `;
    container.appendChild(card);
  });
}

window.filtrarSac = () => {
  const termo = document.getElementById('inputBuscaSac').value.toLowerCase().trim();
  const filtrados = listaIncidentesSac.filter(item => 
    item.idIncidente.toLowerCase().includes(termo) ||
    item.os.toLowerCase().includes(termo) ||
    item.cidades.toLowerCase().includes(termo) ||
    item.descricao.toLowerCase().includes(termo)
  );
  renderizarListaSac(filtrados);
};

window.sair = () => {
  localStorage.clear();
  window.location.href = 'index.html';
};

configurarTelasPorPerfil();
