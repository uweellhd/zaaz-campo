/* ==========================================================================
   NEXTFLOW ENTERPRISE - LOGICA DE LOGIN (js/login.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

const toggleSenha = document.getElementById('toggleSenha');
toggleSenha.addEventListener('click', () => {
  const campo = document.getElementById('senha');
  const visivel = campo.type === 'password';
  campo.type = visivel ? 'text' : 'password';
  toggleSenha.textContent = visivel ? 'Ocultar' : 'Mostrar';
  toggleSenha.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha');
  toggleSenha.setAttribute('aria-pressed', String(visivel));
});

function obterSaudacao() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return "☀️ Bom dia";
  if (hora >= 12 && hora < 18) return "🌤️ Boa tarde";
  return "🌙 Boa noite";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const perfil = await getDoc(doc(db, 'usuarios', user.uid));
    if (perfil.exists() && perfil.data().ativo === true) {
      window.location.replace('dashboard.html');
    } else {
      await signOut(auth);
    }
  } catch (erro) {
    await signOut(auth);
  }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnLogin');
  const aviso = document.getElementById('errorMsg');
  const email = document.getElementById('usuario').value.trim();
  const senha = document.getElementById('senha').value;
  btn.disabled = true;
  btn.textContent = 'Validando...';
  aviso.style.display = 'none';

  try {
    const credencial = await signInWithEmailAndPassword(auth, email, senha);
    const perfil = await getDoc(doc(db, 'usuarios', credencial.user.uid));
    if (!perfil.exists() || perfil.data().ativo !== true) {
      await signOut(auth);
      throw new Error('Conta sem perfil ativo. Procure o administrador.');
    }
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('welcomeSection').style.display = 'block';
    document.getElementById('saudacaoTexto').textContent = `${obterSaudacao()}, ${perfil.data().nome}!`;
    document.getElementById('perfilBadge').textContent = `Perfil: ${perfil.data().perfil.toUpperCase()}`;
    window.location.replace('dashboard.html');
  } catch (erro) {
    await signOut(auth);
    aviso.textContent = erro.message === 'Conta sem perfil ativo. Procure o administrador.'
      ? erro.message : 'Não foi possível entrar. Confira e-mail e senha.';
    aviso.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Entrar no sistema';
  }
});
