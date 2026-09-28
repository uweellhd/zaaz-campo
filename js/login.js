/* ==========================================================================
   NEXTFLOW ENTERPRISE - LOGICA DE LOGIN (js/login.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

function iniciarEfeitoFibra() {
  const canvas = document.getElementById('fiberCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const linhas = [];
  for (let i = 0; i < 40; i++) {
    linhas.push({
      x: Math.random() * width,
      y: Math.random() * height,
      length: Math.random() * 80 + 40,
      speed: Math.random() * 2 + 1,
      alpha: Math.random() * 0.8 + 0.2
    });
  }

  function desenhar() {
    ctx.clearRect(0, 0, width, height);
    linhas.forEach(l => {
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x, l.y + l.length);
      ctx.strokeStyle = `rgba(0, 102, 255, ${l.alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      l.y -= l.speed;
      if (l.y + l.length < 0) {
        l.y = height;
        l.x = Math.random() * width;
      }
    });
    requestAnimationFrame(desenhar);
  }
  desenhar();
}

iniciarEfeitoFibra();

function obterSaudacao() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return "☀️ Bom dia";
  if (hora >= 12 && hora < 18) return "🌤️ Boa tarde";
  return "🌙 Boa noite";
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const btnLogin = document.getElementById('btnLogin');
  const errorMsg = document.getElementById('errorMsg');
  const userInput = document.getElementById('usuario').value.trim();
  const passInput = document.getElementById('senha').value.trim();

  btnLogin.textContent = "⏳ Validando...";
  btnLogin.disabled = true;
  errorMsg.style.display = 'none';

  try {
    let loginSucesso = false;
    let usuarioDados = null;

    const padroes = {
      "admin": { usuario: "Administrador", perfil: "admin", estado: "SP", senha: "123" },
      "tecnico": { usuario: "Lucas Augusto", perfil: "tecnico", estado: "SP", senha: "123" },
      "noc": { usuario: "Operador NOC", perfil: "noc", estado: "SP", senha: "123" },
      "sac": { usuario: "Atendente SAC", perfil: "sac", estado: "SP", senha: "123" },
      "suporte": { usuario: "Analista Suporte", perfil: "suporte", estado: "SP", senha: "123" },
      "gerente": { usuario: "Gerente / Diretor", perfil: "gerente", estado: "SP", senha: "123" }
    };

    if (padroes[userInput] && padroes[userInput].senha === passInput) {
      loginSucesso = true;
      usuarioDados = padroes[userInput];
    } else {
      const querySnapshot = await getDocs(collection(db, "usuarios"));
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.usuario === userInput && data.senha === passInput) {
          loginSucesso = true;
          usuarioDados = data;
        }
      });
    }

    if (loginSucesso) {
      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('welcomeSection').style.display = 'block';

      document.getElementById('saudacaoTexto').textContent = `${obterSaudacao()}, ${usuarioDados.usuario}!`;
      document.getElementById('usuarioNomeDisplay').textContent = "Redirecionando...";
      document.getElementById('perfilBadge').textContent = `Perfil: ${usuarioDados.perfil.toUpperCase()}`;

      localStorage.setItem('user_nome', usuarioDados.usuario);
      localStorage.setItem('user_perfil', usuarioDados.perfil);
      localStorage.setItem('user_estado', usuarioDados.estado || 'SP');

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1200);

    } else {
      errorMsg.style.display = 'block';
      btnLogin.textContent = "Entrar no Sistema";
      btnLogin.disabled = false;
    }

  } catch (erro) {
    errorMsg.textContent = "Erro: " + erro.message;
    errorMsg.style.display = 'block';
    btnLogin.textContent = "Entrar no Sistema";
    btnLogin.disabled = false;
  }
});
