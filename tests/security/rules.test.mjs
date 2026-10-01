import { before, beforeEach, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp, Timestamp, runTransaction } from 'firebase/firestore';

let env;
const users = {
  admin: ['admin','TODOS'], noc: ['noc','TODOS'], sac: ['sac','TODOS'], suporte: ['suporte','TODOS'],
  diretor: ['diretor','TODOS'], gerente: ['gerente','TODOS'], tecnicoA: ['tecnico','SP'], tecnicoB: ['tecnico','SP'],
  tecnicoMG: ['tecnico','MG'], supervisorA: ['supervisor','SP'], supervisorB: ['supervisor','SP'], projetos: ['projetos','TODOS']
};
const ctx = (uid, options = {}) => env.authenticatedContext(uid, { email: `${uid}@zaaztelecom.com.br`, email_verified: true, ...options }).firestore();
const incident = (uid, supervisor = 'supervisorA', estado = 'SP') => ({ idIncidente: 'TESTE-1001', os: 'OS-TESTE', estado, tecnicoUid: uid, tecnicoAtribuido: uid, supervisorUid: supervisor, statusAtual: 'ABERTO', timelineEtapas: [] });
const entrega = (uid = 'tecnicoA') => ({ incidenteId:'a', idIncidente:'TESTE-1001', os:'OS-TESTE', estado:'SP', criadoPorUid:uid, criadoEm:serverTimestamp(), caixas:[{numero:1,gps:'-23.100000, -48.200000',indiceFoto:0},{numero:2,gps:'-23.100001, -48.200001',indiceFoto:1}], descricaoServico:'Reparo fictício', fotoIds:['final1','final2'], statusOzmaps:'PENDENTE' });
before(async () => {
  env = await initializeTestEnvironment({ projectId:'demo-nextflow-security', firestore:{ host:'127.0.0.1', port:8080, rules:readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [uid,[perfil,estado]] of Object.entries(users)) await setDoc(doc(db,'usuarios',uid),{perfil,estado,nome:uid,ativo:true});
    await setDoc(doc(db,'usuarios','inativo'),{perfil:'sac',estado:'TODOS',nome:'Inativo',ativo:false});
    await setDoc(doc(db,'incidentes','a'),incident('tecnicoA'));
    await setDoc(doc(db,'incidentes','b'),incident('tecnicoB','supervisorB'));
    await setDoc(doc(db,'incidentes','mg'),incident('tecnicoMG','supervisorB','MG'));
    for (const id of ['final1','final2','partida']) await setDoc(doc(db,'fotos',id),{incidenteId:'a',estado:'SP',criadoPorUid:'tecnicoA',criadoEm:Timestamp.now(),dadosBase64:'data:image/jpeg;base64,QUJD'});
    await setDoc(doc(db,'fotos','antiga'),{incidenteId:'a',estado:'SP',criadoPorUid:'tecnicoA',criadoEm:Timestamp.fromMillis(Date.now()-16*86400000),dadosBase64:'data:image/jpeg;base64,QUJD'});
  });
});
after(async()=>env?.cleanup());

test('sem sessão, domínio externo, perfil pendente e inativo não acessam incidentes',async()=>{
  for(const db of [env.unauthenticatedContext().firestore(),ctx('sac',{email:'sac@example.com'}),ctx('pendente'),ctx('inativo')]) await assertFails(getDoc(doc(db,'incidentes','a')));
});
test('admin e NOC operam; SAC, Suporte, Diretor e Gerente somente consultam',async()=>{
  for(const uid of ['admin','noc','sac','suporte','diretor','gerente']) {
    const db=ctx(uid); await assertSucceeds(getDocs(collection(db,'incidentes')));
    const write=updateDoc(doc(db,'incidentes','a'),{previsao:'18:00'});
    await (['admin','noc'].includes(uid)?assertSucceeds(write):assertFails(write));
  }
  await assertFails(deleteDoc(doc(ctx('noc'),'incidentes','a')));
});
test('técnico vê somente seus IDs e envia etapas, sem alterar campos administrativos ou seu perfil',async()=>{
  const db=ctx('tecnicoA');
  await assertSucceeds(getDoc(doc(db,'incidentes','a')));
  await assertSucceeds(getDocs(query(collection(db,'incidentes'),where('tecnicoUid','==','tecnicoA'))));
  await assertFails(getDoc(doc(db,'incidentes','b')));
  await assertFails(getDocs(collection(db,'incidentes')));
  await assertSucceeds(updateDoc(doc(db,'incidentes','a'),{statusAtual:'ETAPA 1: EM DESLOCAMENTO',timelineEtapas:[{etapa:'ETAPA 1',fotoIds:[]}]}));
  await assertFails(updateDoc(doc(db,'incidentes','a'),{clientesCount:9000}));
  await assertFails(updateDoc(doc(db,'usuarios','tecnicoA'),{perfil:'admin'}));
});
test('técnico envia fotos somente do seu ID e transfere somente a colega ativo da mesma região',async()=>{
  const db=ctx('tecnicoA');
  const photo={incidenteId:'a',estado:'SP',criadoPorUid:'tecnicoA',criadoEm:serverTimestamp(),dadosBase64:'data:image/jpeg;base64,QUJD'};
  await assertSucceeds(setDoc(doc(db,'fotos','nova'),photo));
  await assertFails(setDoc(doc(db,'fotos','indevida'),{...photo,incidenteId:'b'}));
  await assertFails(updateDoc(doc(db,'incidentes','a'),{tecnicoUid:'tecnicoMG',tecnicoAtribuido:'tecnicoMG'}));
  await assertSucceeds(updateDoc(doc(db,'incidentes','a'),{tecnicoUid:'tecnicoB',tecnicoAtribuido:'tecnicoB'}));
  await assertFails(getDoc(doc(db,'incidentes','a')));
});
test('supervisor lê somente os IDs vinculados e não edita',async()=>{
  const db=ctx('supervisorA');
  await assertSucceeds(getDocs(query(collection(db,'incidentes'),where('supervisorUid','==','supervisorA'))));
  await assertFails(getDoc(doc(db,'incidentes','b')));
  await assertFails(updateDoc(doc(db,'incidentes','a'),{previsao:'19:00'}));
});
test('Projetos acessa somente a entrega e as fotos finais, sem incidente completo',async()=>{
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'projetosEvidencias','a'),entrega()));
  const db=ctx('projetos');
  await assertSucceeds(getDocs(collection(db,'projetosEvidencias')));
  await assertSucceeds(getDoc(doc(db,'fotos','final1')));
  await assertFails(getDoc(doc(db,'fotos','partida')));
  await assertFails(getDoc(doc(db,'incidentes','a')));
  await assertSucceeds(updateDoc(doc(db,'projetosEvidencias','a'),{statusOzmaps:'REGISTRADO'}));
  await assertFails(updateDoc(doc(db,'projetosEvidencias','a'),{descricaoServico:'Alteração indevida'}));
});
test('etapa 4 exige repasse com caixas e pode concluir atomicamente no perfil técnico',async()=>{
  const db=ctx('tecnicoA');
  await assertFails(updateDoc(doc(db,'incidentes','a'),{statusAtual:'ETAPA 4: FINALIZADO'}));
  await assertSucceeds(runTransaction(db,async tx=>{
    const ref=doc(db,'incidentes','a'); await tx.get(ref);
    tx.update(ref,{statusAtual:'ETAPA 4: FINALIZADO',timelineEtapas:[{etapa:'ETAPA 4',fotoIds:['final1','final2']}]});
    tx.set(doc(db,'projetosEvidencias','a'),entrega());
  }));
});
test('fotos antigas ficam inacessíveis mesmo para admin e não são listadas',async()=>{
  for(const uid of ['admin','tecnicoA','supervisorA']) await assertFails(getDoc(doc(ctx(uid),'fotos','antiga')));
  await assertFails(getDocs(collection(ctx('admin'),'fotos')));
});
test('cadastro exige domínio e e-mail confirmado; candidato não aprova seu acesso',async()=>{
  const db=ctx('candidato');
  const request={nome:'Pessoa Teste',email:'candidato@zaaztelecom.com.br',status:'pendente',criadoEm:serverTimestamp()};
  await assertFails(setDoc(doc(ctx('candidato',{email_verified:false}),'solicitacoesAcesso','candidato'),request));
  await assertSucceeds(setDoc(doc(db,'solicitacoesAcesso','candidato'),request));
  await assertFails(setDoc(doc(db,'usuarios','candidato'),{ativo:true,perfil:'admin',estado:'TODOS',nome:'Pessoa Teste'}));
  await assertSucceeds(setDoc(doc(ctx('admin'),'usuarios','candidato'),{ativo:true,perfil:'sac',estado:'TODOS',nome:'Pessoa Teste'}));
});
test('listas de equipe respeitam o perfil: NOC e técnico não recebem todos os usuários',async()=>{
  await assertSucceeds(getDocs(query(collection(ctx('noc'),'usuarios'),where('perfil','==','tecnico'))));
  await assertSucceeds(getDocs(query(collection(ctx('tecnicoA'),'usuarios'),where('perfil','==','tecnico'))));
  await assertFails(getDocs(collection(ctx('noc'),'usuarios')));
  await assertFails(getDocs(collection(ctx('projetos'),'usuarios')));
});
