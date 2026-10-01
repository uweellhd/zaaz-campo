import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
let iniciado = false;
onAuthStateChanged(getAuth(app), async usuario => {
  const aviso = document.getElementById('simAcesso');
  if (!usuario) { location.replace('index.html'); return; }
  try {
    const perfil = await getDoc(doc(getFirestore(app), 'usuarios', usuario.uid));
    if (!perfil.exists() || perfil.data().ativo !== true || perfil.data().perfil !== 'admin') throw new Error('Acesso restrito');
    if (iniciado) return;
    iniciado = true;
    const tema = localStorage.getItem('user_theme');
    if (['theme-light','theme-dark','theme-zaaz'].includes(tema)) document.body.className = `dashboard-body ${tema}`;
    aviso.hidden = true;
    document.getElementById('simLaboratorio').hidden = false;
    const laboratorio = await import('./simulacao.js');
    laboratorio.iniciarLaboratorio();
  } catch {
    aviso.textContent = 'O laboratório é exclusivo do administrador. Volte ao sistema e confira seu acesso.';
  }
});
