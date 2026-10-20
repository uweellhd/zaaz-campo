// Responsabilidade operacional é separada da confirmação final do tratamento.
export async function montarResponsabilidade(host,record,ctx){
 const {perfil,uid,nome,servicos:s,db,collectionName,id,atualizar}=ctx;
 const make=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n};
 const box=make('section','','project-ownership');box.append(make('h4','Responsável pelo tratamento'),make('p',record.projetoResponsavelNome||'Ainda não atribuído','project-audit'));host.append(box);
 if(!['admin','coordenador_projetos','projetos'].includes(perfil))return;
 if(perfil==='projetos'&&record.projetoResponsavelUid&&record.projetoResponsavelUid!==uid)return;
 const label=make('label','Analista de Projetos'),select=make('select');select.setAttribute('aria-label','Analista responsável pelo tratamento');label.append(select);
 if(perfil==='projetos')select.add(new Option(nome,uid));else {
  select.add(new Option('Selecione um analista',''));
  try{const people=await s.getDocs(s.query(s.collection(db,'usuarios'),s.where('perfil','==','projetos')));for(const p of people.docs.filter(d=>d.data().ativo))select.add(new Option(p.data().nome,p.id));if(perfil==='admin')select.add(new Option(`${nome} · meu acesso admin`,uid))}catch{box.append(make('p','Não foi possível carregar os analistas. Reabra a entrega.'));return}
 }
 select.value=record.projetoResponsavelUid|| (perfil==='projetos'?uid:'');
 const button=make('button',perfil==='projetos'?'Assumir tratamento':'Atribuir tratamento','btn-sec-sm');button.type='button';const feedback=make('p','','account-feedback');feedback.setAttribute('role','status');
 button.onclick=async()=>{if(!select.value)return;button.disabled=true;try{
  await s.runTransaction(db,async tx=>{const ref=s.doc(db,collectionName,id),snap=await tx.get(ref);if(!snap.exists())throw Error('Entrega não encontrada.');const r=snap.data();if(collectionName==='medicoes'?r.status!=='ENTREGUE':r.statusOzmaps!=='PENDENTE')throw Error('A entrega já foi tratada.');if(perfil==='projetos'&&r.projetoResponsavelUid&&r.projetoResponsavelUid!==uid)throw Error('A entrega já foi assumida por outro analista.');
   const who=await tx.get(s.doc(db,'usuarios',select.value));if(!who.exists()||!who.data().ativo)throw Error('Analista inativo.');tx.update(ref,{projetoResponsavelUid:select.value,projetoResponsavelNome:who.data().nome,projetoAtribuidoEm:s.serverTimestamp(),projetoAtribuidoPorUid:uid,projetoAtribuidoPorNome:nome});
  });const snap=await s.getDoc(s.doc(db,collectionName,id));atualizar(snap.data());
 }catch(err){feedback.textContent=err.message||'Não foi possível atribuir o tratamento.'}finally{button.disabled=false}};
 box.append(label,button,feedback);
}
