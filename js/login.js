/* ==========================================================================
   NEXTFLOW ENTERPRISE - LOGICA DE LOGIN (js/login.js)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, updateProfile, reload, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
auth.languageCode = 'pt';
let processando = false;
const emailZaaz = email => /^[^\s@]+@zaaztelecom\.com\.br$/i.test(String(email || '').trim());

function mostrarCadastro(aberto) {
  document.getElementById('loginSection').style.display = aberto ? 'none' : 'block';
  document.getElementById('cadastroSection').hidden = !aberto;
}
document.getElementById('abrirCadastro').addEventListener('click', () => mostrarCadastro(true));
document.getElementById('voltarLogin').addEventListener('click', () => mostrarCadastro(false));

async function criarSolicitacao(usuario) {
  const referencia = doc(db, 'solicitacoesAcesso', usuario.uid);
  if ((await getDoc(referencia)).exists()) return;
  await setDoc(referencia, {
    nome: usuario.displayName || usuario.email.split('@')[0],
    email: usuario.email.toLowerCase(),
    status: 'pendente',
    criadoEm: serverTimestamp()
  });
}

document.getElementById('cadastroForm').addEventListener('submit', async event => {
  event.preventDefault();
  const nome = document.getElementById('cadastroNome').value.trim();
  const email = document.getElementById('cadastroEmail').value.trim().toLowerCase();
  const senha = document.getElementById('cadastroSenha').value;
  const aviso = document.getElementById('cadastroAviso');
  if (!emailZaaz(email) || nome.length < 3 || senha.length < 12) {
    aviso.textContent = 'Informe nome, e-mail @zaaztelecom.com.br e senha com pelo menos 12 caracteres.';
    return;
  }
  const botao = document.getElementById('btnCadastro');
  botao.disabled = true;
  processando = true;
  try {
    const credencial = await createUserWithEmailAndPassword(auth, email, senha);
    await updateProfile(credencial.user, { displayName: nome });
    await sendEmailVerification(credencial.user);
    aviso.textContent = 'Conta criada. Confirme o link enviado ao seu e-mail e depois entre para solicitar a aprovação.';
    document.getElementById('cadastroSenha').value = '';
  } catch (erro) {
    console.error('Falha ao criar conta:', erro);
    aviso.textContent = erro.code === 'auth/email-already-in-use'
      ? 'Esse e-mail já tem uma conta. Volte ao login.'
      : 'Não foi possível criar a conta. Confira os dados e tente novamente.';
  } finally {
    await signOut(auth);
    processando = false;
    botao.disabled = false;
  }
});

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
  if (!user || processando) return;
  try {
    const perfil = await getDoc(doc(db, 'usuarios', user.uid));
    if (emailZaaz(user.email) && perfil.exists() && perfil.data().ativo === true) {
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
  processando = true;

  try {
    const credencial = await signInWithEmailAndPassword(auth, email, senha);
    await reload(credencial.user);
    await credencial.user.getIdToken(true);
    if (!emailZaaz(credencial.user.email)) {
      throw new Error('Use o endereço corporativo @zaaztelecom.com.br.');
    }
    const perfil = await getDoc(doc(db, 'usuarios', credencial.user.uid));
    if (!perfil.exists() || perfil.data().ativo !== true) {
      if (!credencial.user.emailVerified) {
        await sendEmailVerification(credencial.user);
        throw new Error('Confirme seu e-mail pelo link recebido e tente entrar novamente.');
      }
      await criarSolicitacao(credencial.user);
      throw new Error('Solicitação enviada. Aguarde a aprovação do administrador.');
    }
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('welcomeSection').style.display = 'block';
    document.getElementById('saudacaoTexto').textContent = `${obterSaudacao()}, ${perfil.data().nome}!`;
    document.getElementById('perfilBadge').textContent = `Perfil: ${perfil.data().perfil.toUpperCase()}`;
    window.location.replace('dashboard.html');
  } catch (erro) {
    await signOut(auth);
    aviso.textContent = /^(Use o endereço|Confirme seu e-mail|Solicitação enviada)/.test(erro.message)
      ? erro.message : 'Não foi possível entrar. Confira e-mail e senha.';
    aviso.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Entrar no sistema';
  } finally {
    processando = false;
  }
});
