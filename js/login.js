/* ==========================================================================
   NEXTFLOW ENTERPRISE - LOGICA DE AUTENTICAÇÃO (js/login.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Função para Gerar a Saudação Dinâmica conforme a hora do dia
function obterSaudacao() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) {
    return "☀️ Bom dia";
  } else if (hora >= 12 && hora < 18) {
    return "🌤️ Boa tarde";
  } else {
    return "🌙 Boa noite";
  }
}

// Manipulador do Evento de Envio do Formulário de Login
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

    // Logins padrão de acesso rápido por perfil
    const padroes = {
      "admin": { usuario: "Administrador", perfil: "admin", senha: "123" },
      "tecnico": { usuario: "Técnico de Campo", perfil: "tecnico", senha: "123" },
      "noc": { usuario: "Operador NOC", perfil: "noc", senha: "123" },
      "sac": { usuario: "Atendente SAC", perfil: "sac", senha: "123" },
      "gerente": { usuario: "Gerente / Diretor", perfil: "gerente", senha: "123" }
    };

    if (padroes[userInput] && padroes[userInput].senha === passInput) {
      loginSucesso = true;
      usuarioDados = padroes[userInput];
    } else {
      // Consulta na coleção 'usuarios' do Firebase Firestore
      const querySnapshot = await getDocs(collection(db, "usuarios"));
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.usuario === userInput && data.senha === passInput) {
          loginSucesso = true;
          usuarioDados = data;
        }
      });
    }

    if (loginSucesso) {
      // Exibe mensagem de boas-vindas e redireciona para a Dashboard
      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('welcomeSection').style.display = 'block';

      const textoSaudacao = obterSaudacao();
      document.getElementById('saudacaoTexto').textContent = `${textoSaudacao}, ${usuarioDados.usuario}!`;
      document.getElementById('usuarioNomeDisplay').textContent = "Redirecionando para o painel operacional...";
      document.getElementById('perfilBadge').textContent = `Perfil: ${usuarioDados.perfil.toUpperCase()}`;

      // Armazena credenciais ativas e redireciona após 1.2 segundos
      localStorage.setItem('user_nome', usuarioDados.usuario);
      localStorage.setItem('user_perfil', usuarioDados.perfil);

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1200);

    } else {
      errorMsg.style.display = 'block';
      btnLogin.textContent = "Entrar no Sistema";
      btnLogin.disabled = false;
    }

  } catch (erro) {
    errorMsg.textContent = "Erro de conexão: " + erro.message;
    errorMsg.style.display = 'block';
    btnLogin.textContent = "Entrar no Sistema";
    btnLogin.disabled = false;
  }
});
