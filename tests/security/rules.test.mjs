import { before, beforeEach, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp, Timestamp, runTransaction, onSnapshot } from 'firebase/firestore';

let env;
const users = {
  admin: ['admin','TODOS'], noc: ['noc','TODOS'], sac: ['sac','TODOS'], suporte: ['suporte','TODOS'],
  diretor: ['diretor','TODOS'], gerente: ['gerente','TODOS'], tecnicoA: ['tecnico','SP'], tecnicoB: ['tecnico','SP'],
  tecnicoOutro: ['tecnico','PR'], tecnicoMG: ['tecnico','MG'], supervisorA: ['supervisor','SP'], supervisorB: ['supervisor','SP'], projetos: ['projetos','TODOS']
};
const ctx = (uid, options = {}) => env.authenticatedContext(uid, { email: `${uid}@zaaztelecom.com.br`, email_verified: true, ...options }).firestore();
const incident = (uid, supervisor = 'supervisorA', estado = 'SP') => ({ idIncidente: 'TESTE-1001', os: 'OS-TESTE', estado, tecnicoUid: uid, tecnicoAtribuido: uid, supervisorUid: supervisor, statusAtual: 'ABERTO', timelineEtapas: [] });
const registroFinal = {causa:'Obra',solucao:'Fusão executada',observacao:'Sem observações adicionais'};
const descricaoFinal = 'CAUSA: Obra\n\nSOLUÇÃO: Fusão executada\n\nOBSERVAÇÃO: Sem observações adicionais';
const titulos = ['','ETAPA 1: EM DESLOCAMENTO','ETAPA 2: NO LOCAL / ROMPIMENTO','ETAPA 3: EXECUTANDO / FUSIONANDO','ETAPA 4: REPARO CONCLUÍDO / FINALIZADO'];
const entrega = (uid = 'tecnicoA') => ({ incidenteId:'a', idIncidente:'TESTE-1001', os:'OS-TESTE', estado:'SP', criadoPorUid:uid, criadoEm:serverTimestamp(), caixas:[{numero:1,gps:'-23.100000, -48.200000',indiceFoto:0,quantidadeFotos:1},{numero:2,gps:'-23.100001, -48.200001',indiceFoto:1,quantidadeFotos:1}], descricaoServico:descricaoFinal,registroFinal,fluxoVersao:2, fotoIds:['final1','final2'], statusOzmaps:'PENDENTE' });
function evento(numero) {
  const base = {etapa:titulos[numero],numeroEtapa:numero,fluxoVersao:2,tecnicoUid:'tecnicoA',tecnico:'tecnicoA',fotosPendentes:0,observacao:'Envio obrigatório'};
  if(numero===1)return {...base,fotoIds:['partida'],gruposFotos:{fotoDeslocamento:{indiceFoto:0,quantidadeFotos:1}},tipoArea:'URBANA',condicaoRisco:'NAO_INFORMADO'};
  if(numero===2)return {...base,fotoIds:['chegada','rompimento'],gruposFotos:{fotoChegada:{indiceFoto:0,quantidadeFotos:1},fotoRompimento:{indiceFoto:1,quantidadeFotos:1}},causaRompimento:'Obra',previsaoInformada:'2026-10-02T18:00'};
  if(numero===3)return {...base,fotoIds:['atuacao','fusao'],gruposFotos:{fotoPanoramica:{indiceFoto:0,quantidadeFotos:1},fotoEquipe:{indiceFoto:1,quantidadeFotos:1}},observacaoAtuacao:'Atuando',previsaoAnterior:'2026-10-02T18:00',previsaoRevisada:'',motivoRevisao:''};
  return {...base,fotoIds:['final1','final2'],caixas:entrega().caixas,registroFinal,descricaoServico:descricaoFinal};
}
async function payloadEtapa(db, numero, extra = {}) {
  const atual=(await getDoc(doc(db,'incidentes','a'))).data();
  return {statusAtual:titulos[numero],etapaConcluida:numero,fluxoVersao:2,timelineEtapas:[...atual.timelineEtapas,{...evento(numero),...extra}],...(numero===2?{previsao:'2026-10-02T18:00'}:{})};
}
async function enviar(db, numero, extra = {}) { return updateDoc(doc(db,'incidentes','a'),await payloadEtapa(db,numero,extra)); }
before(async () => {
  env = await initializeTestEnvironment({ projectId:'demo-nextflow-security', firestore:{ host:'127.0.0.1', port:8080, rules:readFileSync(new URL('../../firestore.rules', import.meta.url),'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [uid,[perfil,estado]] of Object.entries(users)) await setDoc(doc(db,'usuarios',uid),{perfil,estado,nome:uid,ativo:true});
    await setDoc(doc(db,'usuarios','inativo'),{perfil:'sac',estado:'TODOS',nome:'Inativo',ativo:false});
    for(const uid of ['tecnicoA','tecnicoB','tecnicoMG'])await setDoc(doc(db,'equipesTecnicas',uid),{tecnicoUid:uid,supervisorUid:'supervisorA',ativo:true,atualizadoPorUid:'admin',atualizadoEm:Timestamp.now()});
    await setDoc(doc(db,'equipesTecnicas','tecnicoOutro'),{tecnicoUid:'tecnicoOutro',supervisorUid:'supervisorB',ativo:true,atualizadoPorUid:'admin',atualizadoEm:Timestamp.now()});
    await setDoc(doc(db,'incidentes','a'),incident('tecnicoA'));
    await setDoc(doc(db,'incidentes','b'),incident('tecnicoB','supervisorB'));
    await setDoc(doc(db,'incidentes','mg'),incident('tecnicoMG','supervisorB','MG'));
    for (const id of ['final1','final2','partida','chegada','rompimento','atuacao','fusao']) await setDoc(doc(db,'fotos',id),{incidenteId:'a',estado:'SP',criadoPorUid:'tecnicoA',criadoEm:Timestamp.now(),dadosBase64:'data:image/jpeg;base64,QUJD',numeroEtapa:id==='partida'?1:['chegada','rompimento'].includes(id)?2:['atuacao','fusao'].includes(id)?3:4});
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
    const write=updateDoc(doc(db,'incidentes','a'),{previsao:'2026-10-02T18:00'});
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
  await assertSucceeds(enviar(db,1));
  await assertFails(updateDoc(doc(db,'incidentes','a'),{clientesCount:9000}));
  await assertFails(updateDoc(doc(db,'usuarios','tecnicoA'),{perfil:'admin'}));
});
test('técnico envia fotos somente do seu ID e transfere somente a colega ativo da mesma equipe, independentemente do estado',async()=>{
  const db=ctx('tecnicoA');
  const photo={numeroEtapa:1,incidenteId:'a',estado:'SP',criadoPorUid:'tecnicoA',criadoEm:serverTimestamp(),dadosBase64:'data:image/jpeg;base64,QUJD'};
  await assertSucceeds(setDoc(doc(db,'fotos','nova'),photo));
  await assertFails(setDoc(doc(db,'fotos','indevida'),{...photo,incidenteId:'b'}));
  await assertFails(updateDoc(doc(db,'incidentes','a'),{tecnicoUid:'tecnicoOutro',tecnicoAtribuido:'tecnicoOutro'}));
  await assertSucceeds(updateDoc(doc(db,'incidentes','a'),{tecnicoUid:'tecnicoB',tecnicoAtribuido:'tecnicoB'}));
  await assertFails(getDoc(doc(db,'incidentes','a')));
});
test('supervisor lê somente seus IDs e não altera o conteúdo das etapas',async()=>{
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
  await assertSucceeds(updateDoc(doc(db,'projetosEvidencias','a'),{statusOzmaps:'REGISTRADO',observacaoOzmaps:'Caixas cadastradas no OZmaps',tratadoPorUid:'projetos',tratadoPorNome:'projetos',tratadoEm:serverTimestamp()}));
  await assertFails(updateDoc(doc(db,'projetosEvidencias','a'),{tratadoPorUid:'admin',tratadoPorNome:'admin',tratadoEm:serverTimestamp()}));
  await assertFails(updateDoc(doc(db,'projetosEvidencias','a'),{observacaoOzmaps:'x'.repeat(2001),tratadoEm:serverTimestamp()}));
  await assertFails(updateDoc(doc(db,'projetosEvidencias','a'),{descricaoServico:'Alteração indevida'}));
});
test('etapa 4 exige repasse com caixas e pode concluir atomicamente no perfil técnico',async()=>{
  const db=ctx('tecnicoA');
  await assertFails(updateDoc(doc(db,'incidentes','a'),{statusAtual:'ETAPA 4: FINALIZADO'}));
  for(const numero of [1,2,3])await assertSucceeds(enviar(db,numero));
  const final=await payloadEtapa(db,4);
  await assertSucceeds(runTransaction(db,async tx=>{
    const ref=doc(db,'incidentes','a'); await tx.get(ref);
    tx.update(ref,final);
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

test('SAC recebe cada etapa do técnico ao vivo com o histórico aberto', async()=>{
  let cancelar;
  try {
    let receber;
    let rejeitar;
    const proxima = () => new Promise((resolve,reject)=>{receber=resolve;rejeitar=reject;});
    let espera = proxima();
    cancelar = onSnapshot(doc(ctx('sac'),'incidentes','a'), s=>receber(s.data()), e=>rejeitar(e));
    await espera;
    const tecnico = ctx('tecnicoA');
    for (const numero of [1,2,3]) {
      espera = proxima();
      await enviar(tecnico,numero);
      const recebido = await espera;
      if (recebido.statusAtual !== titulos[numero]) throw new Error('Etapa não recebida ao vivo');
    }
  } finally { cancelar?.(); }
});


test('bloqueia salto, recuo, repetição, alteração de histórico e categoria sem foto',async()=>{
 const db=ctx('tecnicoA');
 await assertFails(enviar(db,3));
 await assertFails(enviar(db,1,{fotoIds:[]}));
 await assertSucceeds(enviar(db,1));
 await assertFails(enviar(db,1));
 await assertFails(enviar(db,2,{gruposFotos:{fotoChegada:{indiceFoto:0,quantidadeFotos:2},fotoRompimento:{indiceFoto:0,quantidadeFotos:0}}}));
 const modificado=await payloadEtapa(db,2);modificado.timelineEtapas[0].observacao='Histórico alterado';
 await assertFails(updateDoc(doc(db,'incidentes','a'),modificado));
 await assertSucceeds(enviar(db,2));
 await assertFails(enviar(db,3,{observacaoAtuacao:''}));
 await assertFails(updateDoc(doc(db,'incidentes','a'),{etapaConcluida:0,timelineEtapas:[],statusAtual:'ABERTO'}));
});
test('revisão da previsão exige motivo e preserva previsão anterior no evento',async()=>{
 const db=ctx('tecnicoA');for(const n of [1,2])await enviar(db,n);
 const semMotivo=await payloadEtapa(db,3,{previsaoRevisada:'2026-10-02T19:30',motivoRevisao:''});semMotivo.previsao='2026-10-02T19:30';
 await assertFails(updateDoc(doc(db,'incidentes','a'),semMotivo));
 const valido=await payloadEtapa(db,3,{previsaoRevisada:'2026-10-02T19:30',motivoRevisao:'Chuva forte'});valido.previsao='2026-10-02T19:30';
 await assertSucceeds(updateDoc(doc(db,'incidentes','a'),valido));
 const item=(await getDoc(doc(db,'incidentes','a'))).data();
 if(item.previsao!=='2026-10-02T19:30'||item.timelineEtapas[2].previsaoAnterior!=='2026-10-02T18:00')throw Error('Revisão não preservada');
});
test('etapa 4 aceita várias fotos por caixa e rejeita roteiro sem solução',async()=>{
 const db=ctx('tecnicoA');for(const n of [1,2,3])await enviar(db,n);
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'fotos','finalExtra'),{incidenteId:'a',estado:'SP',criadoPorUid:'tecnicoA',numeroEtapa:4,criadoEm:Timestamp.now(),dadosBase64:'data:image/jpeg;base64,QUJD'})});
 const bad=await payloadEtapa(db,4,{registroFinal:{...registroFinal,solucao:''}});
 await assertFails(runTransaction(db,async tx=>{tx.update(doc(db,'incidentes','a'),bad);tx.set(doc(db,'projetosEvidencias','a'),entrega())}));
 const caixas=[{numero:1,gps:'-23.1, -48.2',indiceFoto:0,quantidadeFotos:2},{numero:2,gps:'-23.2, -48.3',indiceFoto:2,quantidadeFotos:1}],fotoIds=['final1','finalExtra','final2'];
 const final=await payloadEtapa(db,4,{caixas,fotoIds});
 await assertSucceeds(runTransaction(db,async tx=>{tx.update(doc(db,'incidentes','a'),final);tx.set(doc(db,'projetosEvidencias','a'),{...entrega(),caixas,fotoIds})}));
 await assertFails(enviar(db,3));
});
test('chamado antigo retoma na próxima etapa sem apagar histórico anterior',async()=>{
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'incidentes','a'),{statusAtual:'ETAPA 2: NO LOCAL / ROMPIMENTO',timelineEtapas:[{etapa:'ETAPA 1: ANTIGA',fotoIds:[]},{etapa:'ETAPA 2: ANTIGA',fotoIds:[]}],previsao:'2026-10-02T18:00'}));
 const db=ctx('tecnicoA');await assertSucceeds(enviar(db,3));
 const item=(await getDoc(doc(db,'incidentes','a'))).data();if(item.timelineEtapas.length!==3)throw Error('Histórico perdido');
});

test('limite de doze caixas e seis fotos por caixa mantém finalização válida',async()=>{
 const db=ctx('tecnicoA');for(const n of [1,2,3])await enviar(db,n);
 const fotoIds=Array.from({length:72},(_,i)=>`max${i}`);
 await env.withSecurityRulesDisabled(async c=>{for(const id of fotoIds)await setDoc(doc(c.firestore(),'fotos',id),{incidenteId:'a',estado:'SP',criadoPorUid:'tecnicoA',numeroEtapa:4,criadoEm:Timestamp.now(),dadosBase64:'data:image/jpeg;base64,QUJD'})});
 const caixas=Array.from({length:12},(_,i)=>({numero:i+1,gps:'-23.1, -48.2',indiceFoto:i*6,quantidadeFotos:6}));
 const final=await payloadEtapa(db,4,{caixas,fotoIds});
 const incompletas=caixas.map(c=>({...c}));incompletas[11].gps='';
 await assertFails(runTransaction(db,async tx=>{tx.update(doc(db,'incidentes','a'),{...final,timelineEtapas:[...final.timelineEtapas.slice(0,-1),{...final.timelineEtapas.at(-1),caixas:incompletas}]});tx.set(doc(db,'projetosEvidencias','a'),{...entrega(),caixas:incompletas,fotoIds})}));
 await assertSucceeds(runTransaction(db,async tx=>{tx.update(doc(db,'incidentes','a'),final);tx.set(doc(db,'projetosEvidencias','a'),{...entrega(),caixas,fotoIds})}));
});

test('supervisor distribui somente os próprios IDs a membros ativos da equipe, sem restrição regional',async()=>{
 const db=ctx('supervisorA');
 const atribuicao=uid=>({tecnicoUid:uid,tecnicoAtribuido:uid,atribuidoEm:serverTimestamp(),atribuidoPorUid:'supervisorA',atribuidoPorNome:'supervisorA'});
 await assertSucceeds(updateDoc(doc(db,'incidentes','a'),atribuicao('tecnicoMG')));
 await assertSucceeds(getDoc(doc(ctx('tecnicoMG'),'incidentes','a')));
 await assertSucceeds(setDoc(doc(ctx('tecnicoMG'),'fotos','mgpartida'),{numeroEtapa:1,incidenteId:'a',estado:'SP',criadoPorUid:'tecnicoMG',criadoEm:serverTimestamp(),dadosBase64:'data:image/jpeg;base64,QUJD'}));
 const event={...evento(1),tecnicoUid:'tecnicoMG',tecnico:'tecnicoMG',fotoIds:['mgpartida']};
 await assertSucceeds(updateDoc(doc(ctx('tecnicoMG'),'incidentes','a'),{statusAtual:titulos[1],etapaConcluida:1,fluxoVersao:2,timelineEtapas:[event]}));
 await assertFails(updateDoc(doc(db,'incidentes','a'),atribuicao('tecnicoOutro')));
 await assertFails(updateDoc(doc(db,'incidentes','b'),atribuicao('tecnicoB')));
 await assertFails(updateDoc(doc(db,'incidentes','a'),{...atribuicao('tecnicoB'),supervisorUid:'supervisorB'}));
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'equipesTecnicas','tecnicoB'),{ativo:false}));
 await assertFails(updateDoc(doc(db,'incidentes','a'),atribuicao('tecnicoB')));
});
test('supervisores montam equipe sem tomar técnicos de outra equipe; admin pode transferir',async()=>{
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'usuarios','novoTecnico'),{nome:'novoTecnico',perfil:'tecnico',ativo:true,estado:'TODOS'}));
 const data={tecnicoUid:'novoTecnico',supervisorUid:'supervisorA',ativo:true,atualizadoPorUid:'supervisorA',atualizadoEm:serverTimestamp()};
 await assertSucceeds(setDoc(doc(ctx('supervisorA'),'equipesTecnicas','novoTecnico'),data));
 await assertFails(updateDoc(doc(ctx('supervisorB'),'equipesTecnicas','novoTecnico'),{supervisorUid:'supervisorB',atualizadoPorUid:'supervisorB',atualizadoEm:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(ctx('supervisorA'),'equipesTecnicas','novoTecnico'),{ativo:false,atualizadoPorUid:'supervisorA',atualizadoEm:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(ctx('admin'),'equipesTecnicas','novoTecnico'),{ativo:true,supervisorUid:'supervisorB',atualizadoPorUid:'admin',atualizadoEm:serverTimestamp()}));
 for(const uid of ['sac','diretor','projetos','tecnicoA'])await assertFails(setDoc(doc(ctx(uid),'equipesTecnicas','novoTecnico'),data));
});
test('somente admin cadastra identidade IXC e somente NOC/admin consultam o identificador',async()=>{
 const ref=db=>doc(db,'identidadesIxc','123');const data={supervisorUid:'supervisorA',supervisorNome:'supervisorA',atualizadoPorUid:'admin',atualizadoEm:serverTimestamp()};
 await assertSucceeds(setDoc(ref(ctx('admin')),data));
 await assertSucceeds(getDoc(ref(ctx('noc'))));
 for(const uid of ['supervisorA','tecnicoA','sac','projetos'])await assertFails(getDoc(ref(ctx(uid))));
 await assertFails(setDoc(ref(ctx('noc')),{...data,atualizadoPorUid:'noc'}));
 await assertFails(setDoc(doc(ctx('admin'),'identidadesIxc','outro'),data));
 await assertFails(setDoc(doc(ctx('admin'),'identidadesIxc','321'),{...data,supervisorNome:'Nome divergente'}));
});
test('nova etapa rejeita previsão vaga e supervisor não redistribui ID já finalizado',async()=>{
 const db=ctx('tecnicoA');await assertSucceeds(enviar(db,1));
 const vaga=await payloadEtapa(db,2,{previsaoInformada:'2 horas'});vaga.previsao='2 horas';await assertFails(updateDoc(doc(db,'incidentes','a'),vaga));
 await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'incidentes','a'),{etapaConcluida:4,statusAtual:titulos[4]}));
 await assertFails(updateDoc(doc(ctx('supervisorA'),'incidentes','a'),{tecnicoUid:'tecnicoB',tecnicoAtribuido:'tecnicoB',atribuidoEm:serverTimestamp(),atribuidoPorUid:'supervisorA',atribuidoPorNome:'supervisorA'}));
});

test('NOC identifica supervisor e publica sem distribuir técnico nem forjar etapas',async()=>{
 const db=ctx('noc');
 await assertFails(updateDoc(doc(db,'incidentes','a'),{tecnicoUid:'tecnicoOutro',tecnicoAtribuido:'tecnicoOutro'}));
 await assertFails(updateDoc(doc(db,'incidentes','a'),{timelineEtapas:[evento(1)],etapaConcluida:1}));
 await assertSucceeds(updateDoc(doc(db,'incidentes','a'),{supervisorUid:'supervisorB',supervisorNome:'supervisorB',supervisorVinculoOrigem:'CONFIRMACAO_MANUAL',tecnicoUid:'',tecnicoAtribuido:''}));
 await assertFails(setDoc(doc(db,'incidentes','indevido'),incident('tecnicoB')));
 await assertSucceeds(setDoc(doc(db,'incidentes','novo'),incident('','supervisorA')));
});
