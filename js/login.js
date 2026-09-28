/* ==========================================================================
   NEXTFLOW ENTERPRISE - LÓGICA DE AUTENTICAÇÃO E SAUDAÇÃO (js/login.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Credenciais Oficiais do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCai2zdr3XvyohUL4Z3qllUU__xAtLeaoA",
  authDomain: "nextflow-telecom.firebaseapp.com",
  projectId: "nextflow-telecom",
  storageBucket: "nextflow-telecom.firebasestorage.app",
  messagingSenderId: "1004556368169",
  appId: "1:1004556368169:web:de0de1ca5ade29e13f9f38",
  measurementId: "G-W2Z8ZEHGZS"
};

// Inicialização da App e do Firestore Database
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

    // Teste de logins de contingência padrão
    const padroes = {
      "admin": { usuario: "Administrador", perfil: "admin", senha: "123" },
      "tecnico": { usuario: "Técnico de Campo", perfil: "tecnico", senha: "123" },
      "sac": { usuario: "Atendente SAC", perfil: "sac_noc", senha: "123" },
      "gerente": { usuario: "Gerente Operacional", perfil: "gerente", senha: "123" }
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
      // Exibe a tela de boas-vindas personalizada
      document.getElementById('loginSection').style.display = 'none';
      document.getElementById('welcomeSection').style.display = 'block';

      const textoSaudacao = obterSaudacao();
      document.getElementById('saudacaoTexto').textContent = `${textoSaudacao}, ${usuarioDados.usuario}!`;
      document.getElementById('usuarioNomeDisplay').textContent = "Acesso autenticado com sucesso na plataforma.";
      document.getElementById('perfilBadge').textContent = `Perfil: ${usuarioDados.perfil.toUpperCase()}`;
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
