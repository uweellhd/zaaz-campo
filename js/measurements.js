import { ESTADOS, STATUS, CHUNK_BYTES, validarArquivo, codificar, decodificar, sha256, filtrarMedicoes, analisarMedicoes, dataMedicao, nomePOP, etapaMedicao, situacaoMedicao, validarEtapaMedicao, fibrasMedicao } from '../lib/measurements.mjs';
import { criarCartaoTecnico } from '../lib/field-task-card.mjs';
import { renderizarGaleria } from '../lib/photo-gallery.mjs';
import { montarGaleria, fotoAberta, fecharFotos } from '../lib/photo-viewer.mjs';
import { criarRelatorioMedicoes } from '../lib/measurement-report.mjs';
const e=(tag,text='',cls='')=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node};
const button=(text,fn,cls='btn-sec-sm')=>{const b=e('button',text,cls);b.type='button';b.onclick=fn;return b};
const field=(label,kind='text',value='')=>{const l=e('label',label),input=e(kind==='textarea'?'textarea':'input');if(kind!=='textarea')input.type=kind;input.value=value;l.append(input);return {label:l,input}};
const stamp=v=>dataMedicao(v)?.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})||'Aguardando confirmação';
const fresh=()=>({tx:{fotos:[],arquivos:[],gps:null},rx:{fotos:[],arquivos:[],gps:null},observacao:''});
// IndexedDB mantém fotos e arquivos no dispositivo; o envio é confirmado manualmente após reconexão.
async function draft(key,value,remove=false){
  const db=await new Promise((ok,no)=>{const r=indexedDB.open('nextflow-medicoes',1);r.onupgradeneeded=()=>r.result.createObjectStore('rascunhos');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
  try{return await new Promise((ok,no)=>{const tx=db.transaction('rascunhos',value!==undefined||remove?'readwrite':'readonly'),s=tx.objectStore('rascunhos');const r=remove?s.delete(key):value!==undefined?s.put(value,key):s.get(key);let result;r.onsuccess=()=>{result=r.result};tx.oncomplete=()=>ok(result);tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error)})}finally{db.close()}
}
export function iniciarMedicoes(ctx){
  const {collection,doc,getDoc,getDocs,setDoc,updateDoc,query,where,serverTimestamp,runTransaction}=ctx.servicos;
  const navegar=ctx.navegar || window.alternarAba;
  const {db,uid,nome,perfil,ouvir,marcarFoto,obterGPS}=ctx,root=ctx.root||document.getElementById('viewMedicoes');
  root.classList.remove('measure-editing');root.classList.toggle('measure-workspace',perfil==='tecnico');
  let rows=[],filtered=[],pageSize=24,busy=false,active=null,editor=null,feedback=null,editorForm=null,filters={},opened=false,opening=false,pendingDraft=Promise.resolve(),cacheError=false;
  const privileged=['admin','supervisor'].includes(perfil),canCreate=['admin','supervisor','coordenador'].includes(perfil),canReview=['admin','projetos'].includes(perfil),queueOnly=perfil==='tecnico'||ctx.filaProjetos;
  let somenteLeitura=['diretor','gerente'].includes(perfil);
  const executiveNav=e('nav','','executive-switcher');executiveNav.setAttribute('aria-label','Visões da diretoria');executiveNav.hidden=true;
  for(const [label,view,selected] of [['Rompimentos','viewGerente',false],['Medições OTDR','viewMedicoes',true]]){const b=button(label,()=>navegar(view,'diretoria'),'executive-switch');b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));executiveNav.append(b)}root.append(executiveNav);
  const heading=e('div','','measure-heading'),identity=e('div');identity.append(e('p','Validação de rede','section-eyebrow'),e('h3',perfil==='tecnico'?'Medições':'Medições OTDR','panel-title'),e('p',perfil==='tecnico'?'Toque na medição para iniciar ou continuar a coleta.':'Coleta em POP 1 e POP 2, entrega técnica e conferência de Projetos.','panel-desc'));heading.append(identity);
  const actions=e('div','','measure-actions'),createButton=button('Nova medição',()=>newMeasurement(),'btn-primary');if(canCreate)actions.append(createButton);
  const back=button('Voltar',()=>navegar(perfil==='projetos'?'viewProjetos':['gerente','diretor','admin'].includes(perfil)?'viewGerente':perfil==='supervisor'?'viewSupervisor':'viewTech'));actions.append(back);if(!queueOnly)heading.append(actions);
  const feedbackTop=e('p','','measure-feedback measure-feedback-top');feedbackTop.setAttribute('role','status');feedbackTop.setAttribute('aria-live','polite');
  const filtersNode=e('div','','measure-toolbar');
  const search=field('Buscar demanda, rota ou técnico','search');search.label.className='measure-search';search.input.placeholder='Referência, cidade, fibra…';
  const select=(label,options)=>{const l=e('label',label),s=e('select');s.setAttribute('aria-label',label);for(const [v,t] of options)s.add(new Option(t,v));l.append(s);return {label:l,input:s}};
  const state=select('Estado',[['','Todos os estados'],...ESTADOS.map(v=>[v,v])]),status=select('Situação',[['','Todas'],...Object.entries(STATUS)]),start=field('Abertura a partir de','date'),end=field('Até','date');
  for(const f of [search,state,status,start,end]){filtersNode.append(f.label);f.input.oninput=()=>{filters={busca:search.input.value.trim(),estado:state.input.value,status:status.input.value,inicio:start.input.value,fim:end.input.value};pageSize=24;render()}};
  const exportPDF=button('↓ Relatório PDF',async()=>{exportPDF.disabled=true;feedbackTop.textContent='Preparando relatório do recorte selecionado…';try{const {pdf,nome:filename}=await criarRelatorioMedicoes(filtered,{...filters,simulacao:ctx.rascunhos===false});pdf.save(filename);feedbackTop.textContent='Relatório gerado.'}catch(err){feedbackTop.textContent=err.message||'Não foi possível gerar o PDF.'}finally{exportPDF.disabled=false}},'btn-export');
  if(['admin','diretor','gerente'].includes(perfil))filtersNode.append(exportPDF);
  const kpis=e('div','','measure-kpis'),states=e('div','','measure-states'),list=e('div','','incidents-grid-list measure-queue'),editArea=e('div');
  const more=button('Carregar mais medições',()=>{pageSize+=24;render()});more.classList.add('measure-more');
  const queueDescription=e('p',perfil==='tecnico'?'Medições que seu supervisor atribuiu à sua conta:':'Entregas de medição para conferência de Projetos:','panel-desc measure-queue-description');
  root.append(queueOnly?queueDescription:heading,feedbackTop,editArea);if(!queueOnly)root.append(filtersNode,kpis,states);root.append(list,more);
  const dialog=e('dialog','','modal-content measure-modal');dialog.setAttribute('aria-label','Detalhes da medição');document.body.append(dialog);
  dialog.addEventListener('click',ev=>{if(ev.target===dialog){const r=dialog.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)dialog.close()}});
  dialog.addEventListener('cancel',ev=>{if(fotoAberta()){ev.preventDefault();fecharFotos()}});
  const beforeUnload=ev=>{if(busy){ev.preventDefault();ev.returnValue=''}};window.addEventListener('beforeunload',beforeUnload);
  function message(text,error=false){if(feedback){feedback.textContent=text;feedback.classList.toggle('measure-error',error)}else feedbackTop.textContent=text}
  function persist(){if(!active||!editor||ctx.rascunhos===false)return Promise.resolve();const key=`${uid}:${active.id}`,snapshot=structuredClone(editor);pendingDraft=pendingDraft.catch(()=>{}).then(()=>draft(key,snapshot)).then(()=>{cacheError=false}).catch(()=>{cacheError=true;message('O navegador não conseguiu salvar o rascunho local. Mantenha esta tela aberta e envie com internet.',true)});return pendingDraft}
  function lock(value){busy=value;editorForm?.querySelectorAll('input,select,textarea,button').forEach(n=>n.disabled=value)}
  function render(){
    if(start.input.value&&end.input.value&&start.input.value>end.input.value){feedbackTop.textContent='A data inicial deve ser anterior à final.';exportPDF.disabled=true;return}exportPDF.disabled=false;
    const accessible=perfil==='tecnico'?rows.filter(r=>r.tecnicoUid===uid&&r.status==='EM_CAMPO'):rows;
    filtered=filtrarMedicoes(accessible,filters);const m=analisarMedicoes(filtrarMedicoes(accessible,{...filters,status:''}));kpis.replaceChildren();
    for(const [label,n,value] of [['Demandas',m.total,''],['A distribuir',m.aguardando,'AGUARDANDO_TECNICO'],['Em campo',m.emCampo,'EM_CAMPO'],['Em Projetos',m.entregues,'ENTREGUE'],['Conferidas',m.conferidas,'CONFERIDA']]){
      const card=button('',()=>{status.input.value=value;filters={...filters,status:value};pageSize=24;render();list.tabIndex=-1;list.focus({preventScroll:true});list.scrollIntoView({block:'start',behavior:'auto'})},'measure-kpi');card.dataset.status=value;card.setAttribute('aria-label',`${label}: ${n} · ver demandas`);card.setAttribute('aria-pressed',String((filters.status||'')===value));card.append(e('span',label),e('strong',String(n)));kpis.append(card);
    }
    states.replaceChildren();if(['admin','diretor','gerente'].includes(perfil))for(const r of analisarMedicoes(filtered).estados){const card=e('div','','measure-state'),bar=e('progress');bar.max=r.total;bar.value=r.conferidas;bar.setAttribute('aria-label',`${r.estado}: ${r.conferidas} de ${r.total} conferidas`);card.append(e('strong',r.estado),e('small',`${r.total} demandas · ${r.conferidas} conferidas`),bar);states.append(card)}
    list.replaceChildren();if(!filtered.length)list.append(e('p',perfil==='tecnico'?'Nenhuma medição em andamento atribuída ao seu acesso.':'Nenhuma medição neste recorte.','measure-empty'));
    for(const r of filtered.slice(0,pageSize)){if(perfil==='tecnico'){list.append(criarCartaoTecnico({titulo:`Medição: ${r.referencia}`,campos:[['Rota',`${r.pontoA} → ${r.pontoB}`],['Cidades',r.cidade]],status:situacaoMedicao(r),abrir:()=>openCollection(r)}));continue}const card=button('',()=>perfil==='tecnico'?openCollection(r):openDetails(r),'incidente-card supervisor-card project-list-card');card.append(e('strong',r.referencia),e('small',`${r.estado} · ${r.cidade} · ${r.pontoA} → ${r.pontoB}`),e('span',situacaoMedicao(r),'measure-status'),e('small',`${r.tecnicoNome||'Técnico a definir'} · ${stamp(r.criadoEm)}`),e('small',perfil==='tecnico'?'Abrir coleta →':r.status==='EM_CAMPO'&&r.tecnicoUid===uid?'Continuar coleta →':'Ver fotos, arquivos e conferência →'));list.append(card)}more.hidden=filtered.length<=pageSize;
  }
  async function technicians(supervisorUid=''){
    const q=await getDocs(query(collection(db,'usuarios'),where('perfil','==','tecnico')));
    let all=q.docs.map(s=>({uid:s.id,...s.data()})).filter(p=>p.ativo);
    const target=supervisorUid||(perfil==='supervisor'?uid:'');
    if(target){const teams=await getDocs(query(collection(db,'equipesTecnicas'),where('supervisorUid','==',target)));const ids=teams.docs.filter(d=>d.data().ativo).map(d=>d.id);all=all.filter(p=>ids.includes(p.uid))}
    // O próprio admin pode executar testes reais sem alterar cargo ou equipe.
    if(perfil==='admin')all.push({uid,nome:`${nome} · meu acesso admin`});
    return all;
  }
  async function newMeasurement(){
    if(busy||!canCreate||somenteLeitura)return;feedbackTop.textContent='';editArea.replaceChildren();editor=null;active=null;
    const form=e('form','','measure-form field-card'),title=e('h4','Nova demanda de medição');form.append(title);
    const grid=e('div','','measure-fields'),refs={};for(const [key,label,max] of [['referencia','Referência / OS da demanda',100],['cidade','Cidade',120],['pontoA','POP 1',200],['pontoB','POP 2',200],['fibras','Fibras a medir / identificação',300]]){refs[key]=field(label);refs[key].input.required=key!=='fibras';if(key==='fibras')refs[key].input.placeholder='Opcional · informar quando identificadas';refs[key].input.maxLength=max;grid.append(refs[key].label)}
    const uf=select('Estado',ESTADOS.map(v=>[v,v]));uf.input.value=ESTADOS.includes(ctx.estado)?ctx.estado:'SP';grid.append(uf.label);
    let supervisorSelect;
    if(['admin','coordenador'].includes(perfil)){
      supervisorSelect=select('Supervisor responsável',[['','Selecione um supervisor']]);supervisorSelect.input.required=true;if(perfil==='admin')supervisorSelect.input.add(new Option(`${nome} · meu acesso admin`,uid));grid.append(supervisorSelect.label);
      try{const people=await getDocs(query(collection(db,'usuarios'),where('perfil','==','supervisor')));for(const p of people.docs.filter(p=>p.data().ativo))supervisorSelect.input.add(new Option(p.data().nome,p.id))}catch{feedbackTop.textContent='Não foi possível carregar os supervisores. Confira a conexão.'}
    }
    form.append(grid);const note=e('p','A demanda será aberta sem técnico. O supervisor distribuirá o serviço para sua equipe. As fibras podem ser identificadas durante a coleta.','search-hint'),save=e('button','Registrar demanda','btn-primary');save.type='submit';const cancel=button('Cancelar',()=>editArea.replaceChildren());const bar=e('div','','measure-actions');bar.append(cancel,save);form.append(note,bar);editArea.append(form);form.scrollIntoView({block:'start',behavior:'smooth'});
    form.onsubmit=async ev=>{ev.preventDefault();if(busy||!canCreate||somenteLeitura)return;save.disabled=true;
      try{if(!navigator.onLine)throw new Error('Conecte-se à internet para registrar a demanda. Depois o rascunho da coleta poderá ficar neste aparelho.');const supervisorUid=supervisorSelect?supervisorSelect.input.value:uid;const supervisor=await getDoc(doc(db,'usuarios',supervisorUid));if(!supervisor.exists()||!supervisor.data().ativo||!(supervisor.data().perfil==='supervisor'||(supervisorUid===uid&&perfil==='admin'&&supervisor.data().perfil==='admin')))throw new Error('Selecione um supervisor ativo.');
        const record={...Object.fromEntries(Object.entries(refs).map(([k,v])=>[k,v.input.value.trim()])),estado:uf.input.value,tecnicoUid:'',tecnicoNome:'',supervisorUid,supervisorNome:supervisor.data().nome,status:'AGUARDANDO_TECNICO',criadoPorUid:uid,criadoEm:serverTimestamp(),versao:2};const ref=doc(collection(db,'medicoes'));await setDoc(ref,record);editArea.replaceChildren();feedbackTop.textContent='Demanda aberta. O supervisor já pode alocar o técnico na guia Supervisão.';
      }catch(err){feedbackTop.textContent=err.message||'Não foi possível registrar a demanda.'}finally{save.disabled=false}
    };
  }
  function closeEditor(){editArea.replaceChildren();active=null;editor=null;feedback=null;editorForm=null;root.classList.remove('measure-editing');render()}
  async function openCollection(record){
    if(busy||opening)return;opening=true;
    try{await editMeasurement(record);if(active?.id===record.id)editorForm?.scrollIntoView({block:'start',behavior:'auto'})}catch{closeEditor();feedbackTop.textContent='Não foi possível abrir a coleta. Confira a conexão e tente novamente.'}finally{opening=false}
  }
  async function editMeasurement(record,initial=null){
    if(busy||somenteLeitura||(perfil==='tecnico'&&(record.tecnicoUid!==uid||record.status!=='EM_CAMPO')))return;
    const etapa=etapaMedicao(record)+1,side=etapa===1?'tx':'rx';active=record;editor=initial||fresh();
    if(!initial&&ctx.rascunhos!==false)try{editor=(await draft(`${uid}:${record.id}`))||editor}catch{cacheError=true}
    if(editor.etapa && editor.etapa!==etapa){const pending=editor.rx;editor={...fresh(),rx:pending||fresh().rx}}
    else if(!editor.etapa&&etapa===2){editor={...fresh(),rx:editor.rx||fresh().rx,observacao:editor.rx?.arquivos?.length?editor.observacao:''}}
    editor.etapa=etapa;
    const proofs=await getDocs(collection(db,'medicoes',record.id,'comprovantes'));if(proofs.docs.some(d=>d.id.startsWith(side))){editor.locked=true}
    editArea.replaceChildren();root.classList.add('measure-editing');const form=e('form','','measure-form field-card');editorForm=form;const title=e('h4',`POP ${etapa} · ${record.referencia}`),info=e('p',`${record.pontoA} → ${record.pontoB} · ${fibrasMedicao(record)}`,'panel-desc');const flowHeader=e('div','','tech-flow-header');const returnButton=button('← Voltar à lista',async()=>{if(busy)return;await persist();closeEditor()});returnButton.dataset.close='true';flowHeader.append(returnButton,title);form.append(flowHeader,info);const steps=e('div','','step-indicator');for(const n of [1,2])steps.append(e('span',`${n}. POP ${n}`,'step-number'+(n===etapa?' active':n<etapa?' step-sent':'')));form.append(steps);
    if(etapa===2)form.append(e('p',`POP 1 enviado em ${stamp(record.pop1EnviadoEm)}. Esta etapa está salva e já pode ser acompanhada. Continue o POP 2 quando chegar ao local.`,'search-hint'));
    const fibers=field('Fibras identificadas (opcional)','text',editor.fibras??record[etapa===1?'fibrasPop1':'fibrasPop2']??record.fibras??'');fibers.input.maxLength=300;fibers.input.placeholder='Ex.: FO 04 ou FO 04 e FO 05, conforme identificado';fibers.input.oninput=()=>{editor.fibras=fibers.input.value;persist()};editor.fibras=fibers.input.value;form.append(fibers.label);
    {
      const data=editor[side],block=e('section','','measure-direction');block.append(e('h4',`${nomePOP(side)} · ${side==='tx'?record.pontoA:record.pontoB}`));
      const gpsInfo=e('p',data.gps?`GPS: ${data.gps.latitude.toFixed(6)}, ${data.gps.longitude.toFixed(6)} (±${Math.round(data.gps.precisao)} m)`:'O GPS será registrado com as fotos.','search-hint');
      const gpsButton=button(data.gps?'Atualizar GPS':'Capturar GPS',async()=>{lock(true);message('Obtendo localização…');try{const g=await obterGPS();if(!g.disponivel)throw new Error('Ative a localização do celular e permita o acesso no navegador.');data.gps={latitude:g.latitude,longitude:g.longitude,precisao:g.precisao};gpsInfo.textContent=`GPS: ${g.latitude.toFixed(6)}, ${g.longitude.toFixed(6)} (±${Math.round(g.precisao)} m)`;gpsButton.textContent='Atualizar GPS';await persist();message('Localização registrada.')}catch(err){message(err.message,true)}finally{lock(false);if(editor.locked)freezeInputs()}});
      const gpsRow=e('div','','measure-gps');gpsRow.append(gpsInfo,gpsButton);block.append(gpsRow);
      const photos=field(`Fotos ${nomePOP(side)} · 1 a 6 fotos`,'file');photos.input.accept='image/*';photos.input.multiple=true;photos.input.setAttribute('capture','environment');const gallery=e('div','','photo-gallery');
      const renderGallery=()=>renderizarGaleria(gallery,data.fotos,index=>{if(busy||editor.locked)return;data.fotos.splice(index,1);renderGallery();persist()});renderGallery();
      photos.input.onchange=async()=>{const files=[...photos.input.files];photos.input.value='';if(data.fotos.length+files.length>6){message('O limite é de seis fotos por lado.',true);return}lock(true);message('Preparando fotos com identificação e localização…');try{const g=await obterGPS();if(!g.disponivel)throw new Error('Autorize o GPS para registrar a localização nas fotos.');const result=[];for(const file of files){if(file.size>20*1024*1024)throw new Error('Cada foto original deve ter até 20 MiB.');result.push(await marcarFoto(file,`NEXTFLOW / ZAAZ | Registro: ${new Date().toLocaleString('pt-BR')} | ${nome} | ${nomePOP(side)}`,g))}data.fotos.push(...result);if(!data.gps)data.gps={latitude:g.latitude,longitude:g.longitude,precisao:g.precisao};gpsInfo.textContent=`GPS: ${data.gps.latitude.toFixed(6)}, ${data.gps.longitude.toFixed(6)}`;gpsButton.textContent='Atualizar GPS';renderGallery();await persist();message(cacheError?'Rascunho somente nesta tela; envie antes de fechar.':'Fotos preparadas. Rascunho salvo neste aparelho.')}catch(err){message(err.message,true)}finally{lock(false)}};
      const files=field(`Arquivos ${nomePOP(side)} · 1 a 3 arquivos`,'file');files.input.accept='.pdf,application/pdf,.sor,.msor,.trc,.iolm';files.input.multiple=true;const fileList=e('div');
      const renderFiles=()=>{fileList.replaceChildren();data.arquivos.forEach((file,i)=>{const line=e('div','','measure-file');line.append(e('span',`${file.name} · ${(file.size/1024).toFixed(1)} KiB`),button('Remover',()=>{if(busy||editor.locked)return;data.arquivos.splice(i,1);renderFiles();persist()}));fileList.append(line)})};renderFiles();
      files.input.onchange=async()=>{const picked=[...files.input.files];files.input.value='';if(data.arquivos.length+picked.length>3){message('Adicione no máximo três arquivos por lado.',true);return}const error=picked.map(validarArquivo).find(Boolean);if(error){message(error,true);return}data.arquivos.push(...picked);renderFiles();await persist();message('Arquivos originais guardados no rascunho local.');};
      block.append(photos.label,gallery,files.label,e('small','PDF, SOR, MSOR, TRC ou IOLM · até 2 MiB por arquivo.'),fileList);form.append(block);
    }
    const observation=field('Descrição da medição / observações','textarea',editor.observacao);observation.input.maxLength=3000;observation.input.required=true;observation.input.rows=4;observation.input.oninput=()=>{editor.observacao=observation.input.value;persist()};form.append(observation.label);
    const submit=e('button',editor.locked?`Retomar envio do POP ${etapa}`:etapa===1?'Avançar e enviar POP 1':'Finalizar e enviar POP 2','btn-primary measure-deliver');submit.type='submit';
    feedback=e('p','','measure-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');form.append(e('p','As fotos ficam disponíveis por 15 dias após o envio. Os arquivos OTDR e o histórico permanecem. A conferência de Projetos será registrada separadamente.','search-hint'),submit,feedback);editArea.append(form);
    function freezeInputs(){form.querySelectorAll('input,textarea,button').forEach(n=>n.disabled=true);submit.disabled=false;returnButton.disabled=false}if(editor.locked){freezeInputs();message('Um envio foi iniciado. Retome com o mesmo rascunho para evitar alterações de evidências já recebidas.');}
    form.onsubmit=async ev=>{ev.preventDefault();if(busy)return;const error=validarEtapaMedicao(editor,etapa);if(error){message(error,true);return}if(!navigator.onLine){await persist();message('Sem internet. O rascunho permanece neste aparelho; conecte-se e envie novamente.',true);return}if(!confirm(`Confira fotos, arquivos, localização e descrição do POP ${etapa}. Está tudo correto? Esta etapa ficará bloqueada para edição. ${etapa===1?'O POP 1 ficará visível para acompanhamento; a OS continuará com você para fazer o POP 2.':'A medição completa será enviada para Projetos.'}`))return;
      lock(true);editor.locked=true;await persist();
      try{
        await deliver(record,editor,etapa);
        if(etapa===1){
          const next={...fresh(),etapa:2,rx:editor.rx||fresh().rx};if(ctx.rascunhos!==false)await draft(`${uid}:${record.id}`,next);closeEditor();lock(false);
          try{const snap=await getDoc(doc(db,'medicoes',record.id));await editMeasurement({id:record.id,...snap.data()},next);message('POP 1 enviado. Supervisor e Diretoria já podem acompanhar. O POP 2 continua na sua rota.')}
          catch{closeEditor();feedbackTop.textContent='POP 1 enviado. Abra a medição novamente para continuar o POP 2.'}return;
        }
        if(ctx.rascunhos!==false)await draft(`${uid}:${record.id}`,undefined,true);closeEditor();feedbackTop.textContent='POP 2 enviado. Medição completa entregue para Projetos.';
      }catch(err){message(`O envio não foi confirmado. ${err.message||'Confira a conexão.'} Mantenha o rascunho e use Retomar envio para tentar novamente.`,true);submit.textContent=`Retomar envio do POP ${etapa}`}finally{lock(false);if(editor?.locked&&active?.id===record.id&&editor.etapa===etapa)freezeInputs()}
    };
  }
  async function immutable(ref,value){const old=await getDoc(ref);if(!old.exists()){await setDoc(ref,value);return}for(const key of Object.keys(value)){if(['criadoEm','completo'].includes(key))continue;if(JSON.stringify(old.data()[key])!==JSON.stringify(value[key]))throw new Error('As evidências divergem da tentativa anterior. Retome com o rascunho original ou acione o administrador.')}}
  async function deliver(record,data,etapa){
    const side=etapa===1?'tx':'rx';
    {
      const d=data[side];for(let i=0;i<d.fotos.length;i++){message(`Enviando ${nomePOP(side)} · foto ${i+1}/${d.fotos.length}…`);await immutable(doc(db,'medicoesFotos',`${record.id}-${side}-${i}`),{medicaoId:record.id,lado:side,indice:i,criadoPorUid:uid,criadoEm:serverTimestamp(),dadosBase64:d.fotos[i]})}
      await immutable(doc(db,'medicoes',record.id,'comprovantes',`${side}Fotos`),{tipo:'fotos',lado:side,quantidade:d.fotos.length,criadoPorUid:uid,criadoEm:serverTimestamp()});
      for(let i=0;i<d.arquivos.length;i++){
        const file=d.arquivos[i],buffer=await file.arrayBuffer(),bytes=new Uint8Array(buffer),hash=await sha256(buffer),id=`${side}-${i}`,ref=doc(db,'medicoes',record.id,'arquivos',id),meta={nome:file.name,tamanho:file.size,sha256:hash,lado:side,indice:i,partes:Math.ceil(file.size/CHUNK_BYTES),completo:false,criadoPorUid:uid,criadoEm:serverTimestamp()};
        const previous=await getDoc(ref);if(previous.exists()&&previous.data().sha256!==hash)throw new Error('O arquivo diverge da tentativa anterior. Mantenha o rascunho original e acione o administrador.');await immutable(ref,meta);
        for(let n=0;n<meta.partes;n++){message(`Enviando ${nomePOP(side)} · arquivo ${i+1}/${d.arquivos.length} · parte ${n+1}/${meta.partes}…`);await immutable(doc(db,'medicoes',record.id,'arquivos',id,'partes',String(n)),{dados:codificar(bytes.subarray(n*CHUNK_BYTES,(n+1)*CHUNK_BYTES))})}
        if(!previous.exists()||!previous.data().completo)await updateDoc(ref,{completo:true});
      }
      await immutable(doc(db,'medicoes',record.id,'comprovantes',`${side}Arquivos`),{tipo:'arquivos',lado:side,quantidade:d.arquivos.length,criadoPorUid:uid,criadoEm:serverTimestamp()});
    }
    message(`Confirmando envio do POP ${etapa}…`);await runTransaction(db,async tx=>{
      const ref=doc(db,'medicoes',record.id),snap=await tx.get(ref);if(!snap.exists())throw new Error('Demanda não encontrada.');
      if(etapaMedicao(snap.data())>=etapa)return;
      if(snap.data().status!=='EM_CAMPO'||etapaMedicao(snap.data())!==etapa-1)throw new Error('A etapa mudou. Reabra a medição antes de continuar.');
      const evidence={[side+'Gps']:data[side].gps,[side+'Fotos']:data[side].fotos.length,[side+'Arquivos']:data[side].arquivos.length};
      tx.update(ref,etapa===1?{...evidence,etapaConcluida:1,fluxoVersao:2,pop1EnviadoEm:serverTimestamp(),pop1PorUid:uid,pop1PorNome:nome,pop1Observacao:data.observacao.trim(),fibrasPop1:(data.fibras||'').trim()}:{...evidence,etapaConcluida:2,status:'ENTREGUE',entregueEm:serverTimestamp(),entreguePorUid:uid,entreguePorNome:nome,observacao:data.observacao.trim(),fibrasPop2:(data.fibras||'').trim()});
    });
  }

  async function download(record,fileId,b){b.disabled=true;try{const meta=(await getDoc(doc(db,'medicoes',record.id,'arquivos',fileId))).data();if(!meta?.completo)throw new Error('Arquivo ainda não foi entregue.');const bytes=new Uint8Array(meta.tamanho);let offset=0;for(let i=0;i<meta.partes;i++){const part=await getDoc(doc(db,'medicoes',record.id,'arquivos',fileId,'partes',String(i)));if(!part.exists())throw new Error('Parte do arquivo não está disponível.');const data=decodificar(part.data().dados);bytes.set(data,offset);offset+=data.length}if(offset!==meta.tamanho||await sha256(bytes)!==meta.sha256)throw new Error('A verificação de integridade falhou. Nenhum arquivo foi baixado.');const url=URL.createObjectURL(new Blob([bytes],{type:/[.]pdf$/i.test(meta.nome)?'application/pdf':'application/octet-stream'})),a=e('a');a.href=url;a.download=meta.nome;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(err){alert(err.message||'Não foi possível baixar o arquivo.')}finally{b.disabled=false}}
  async function openDetails(record){
    if(busy)return;if(perfil==='tecnico'&&(record.tecnicoUid!==uid||record.status!=='EM_CAMPO')){dialog.close();return}if(fotoAberta())fecharFotos();dialog.replaceChildren();dialog.dataset.id=record.id;dialog.dataset.status=record.status;dialog.dataset.etapa=String(etapaMedicao(record));dialog.dataset.marcos=[record.pop1EnviadoEm,record.entregueEm,record.conferidoEm].map(stamp).join('|');const h=e('div','','modal-header');h.append(e('h3',record.referencia),button('Fechar',()=>dialog.close()));dialog.append(h,e('p',`${situacaoMedicao(record)} · ${record.estado} / ${record.cidade}`,'measure-status'),e('p',`${record.pontoA} → ${record.pontoB}\nFibras: ${fibrasMedicao(record)}\nTécnico: ${record.tecnicoNome||'A definir pelo supervisor'}\nSupervisor: ${record.supervisorNome||'não informado'}\nAbertura: ${stamp(record.criadoEm)}`));if(!dialog.open)dialog.showModal();
    if(record.status==='AGUARDANDO_TECNICO'){if(!somenteLeitura&&(perfil==='admin'||(perfil==='supervisor'&&record.supervisorUid===uid)))await assignmentForm(record);else dialog.append(e('p','Aguardando distribuição pela supervisão.'));return}
    if(record.status==='EM_CAMPO'){if(etapaMedicao(record)===1)renderPOPs(record,['tx']);if(!somenteLeitura&&(record.tecnicoUid===uid||perfil==='admin')){const actions=e('div','','btn-step-group');actions.append(button('Continuar coleta',async()=>{dialog.close();if(ctx.abrirColetaPropria&&record.tecnicoUid===uid){await ctx.abrirColetaPropria(record.id);return}navegar('viewMedicoes');await openCollection(record)},'btn-primary'));dialog.append(actions)}else dialog.append(e('p','Aguardando a coleta e a entrega técnica.'));return}
    dialog.append(e('p',`Entrega: ${stamp(record.entregueEm)}`));renderPOPs(record,['tx','rx']);
    const review=e('section','','measure-direction');review.append(e('h4','Conferência de Projetos'));dialog.append(review);
    if(record.status==='CONFERIDA')review.append(e('p',`${record.conferidoPorNome} · ${stamp(record.conferidoEm)}\n${record.observacaoProjetos}`));
    else if(canReview&&!somenteLeitura){const form=e('form','','measure-form project-treatment'),obs=field('Observação / referência do relatório de análise','textarea');obs.input.maxLength=2000;obs.input.required=true;obs.input.rows=3;const label=e('label','','project-check'),check=e('input');check.type='checkbox';check.required=true;label.append(check,document.createTextNode('Confirmo que conferi os arquivos dos POPs 1 e 2 e registrei o tratamento desta demanda.'));const b=e('button','Confirmar conferência','btn-primary');b.type='submit';const result=e('p','','measure-feedback');result.setAttribute('role','status');form.append(obs.label,label,b,result);review.append(form);form.onsubmit=async ev=>{ev.preventDefault();if(!check.checked||!obs.input.value.trim())return;b.disabled=true;try{await updateDoc(doc(db,'medicoes',record.id),{status:'CONFERIDA',observacaoProjetos:obs.input.value.trim(),conferidoPorUid:uid,conferidoPorNome:nome,conferidoEm:serverTimestamp()});form.replaceChildren(e('p',`Conferência registrada por ${nome}.`))}catch{result.textContent='Não foi possível confirmar. Confira a conexão e tente novamente.';b.disabled=false}}}else review.append(e('p','Aguardando a conferência de Projetos.'));
  }

  function renderPOPs(record,sides){const generation=record.id;
    const details=e('div','','measure-detail-grid');dialog.append(details);
    for(const side of sides){
      const section=e('section','','measure-direction'),g=record[side+'Gps'];section.append(e('h4',`${nomePOP(side)} · ${side==='tx'?record.pontoA:record.pontoB}`),e('p',`GPS do registro: ${g.latitude.toFixed(6)}, ${g.longitude.toFixed(6)} · precisão ±${Math.round(g.precisao)} m`));
      const gallery=e('div','','evidence-gallery'),files=e('div');section.append(e('p',`Enviado: ${stamp(side==='tx'?(record.pop1EnviadoEm||record.entregueEm):record.entregueEm)}\nFibras: ${record[side==='tx'?'fibrasPop1':'fibrasPop2']||record.fibras||'Não informadas'}\n${side==='tx'?(record.pop1Observacao||''):(record.observacao||'')}`),gallery,files);details.append(section);
      Promise.all(Array.from({length:record[side+'Fotos']},async(_,i)=>{try{const snap=await getDoc(doc(db,'medicoesFotos',`${record.id}-${side}-${i}`));return snap.exists()?{src:snap.data().dadosBase64,label:`${nomePOP(side)} · Foto ${i+1}`}:null}catch{return null}})).then(photos=>{if(dialog.dataset.id!==generation)return;const available=photos.filter(Boolean);if(available.length)montarGaleria(gallery,available);else gallery.textContent='Fotos indisponíveis ou removidas após 15 dias.';if(available.length&&available.length<photos.length)gallery.append(e('small','Algumas fotos já não estão disponíveis.'))});
      for(let i=0;i<record[side+'Arquivos'];i++){const id=`${side}-${i}`,line=e('div','','measure-file');line.append(e('span',`Arquivo ${nomePOP(side)} ${i+1}`));const b=button('Baixar original',()=>download(record,id,b));line.append(b);files.append(line);getDoc(doc(db,'medicoes',record.id,'arquivos',id)).then(s=>{if(s.exists())line.firstChild.textContent=`${s.data().nome} · ${(s.data().tamanho/1024).toFixed(1)} KiB`}).catch(()=>{})}
    }
  }
  async function assignmentForm(record){
    const form=e('form','','measure-form'),choice=select('Técnico da equipe',[['','Selecione um técnico']]);choice.input.required=true;
    const save=e('button','Alocar técnico','btn-primary');save.type='submit';const info=e('p','','measure-feedback');info.setAttribute('role','status');form.append(e('h4','Distribuir medição'),choice.label,save,info);dialog.append(form);save.disabled=true;
    try{const team=await technicians(record.supervisorUid);if(!team.length)info.textContent='Cadastre os técnicos desta equipe na guia Supervisão antes de distribuir.';for(const t of team)choice.input.add(new Option(t.nome,t.uid));save.disabled=!team.length}catch{info.textContent='Não foi possível carregar a equipe. Feche e tente novamente.'}
    form.onsubmit=async ev=>{ev.preventDefault();if(somenteLeitura)return;save.disabled=true;try{
      const technician=await getDoc(doc(db,'usuarios',choice.input.value));if(!technician.exists())throw new Error('Técnico não encontrado.');
      await runTransaction(db,async tx=>{const ref=doc(db,'medicoes',record.id),current=await tx.get(ref);if(!current.exists()||current.data().status!=='AGUARDANDO_TECNICO')throw new Error('A demanda já foi distribuída. Reabra os detalhes.');tx.update(ref,{status:'EM_CAMPO',tecnicoUid:choice.input.value,tecnicoNome:technician.data().nome,atribuidoEm:serverTimestamp(),atribuidoPorUid:uid,atribuidoPorNome:nome})});info.textContent='Técnico alocado. A demanda já está disponível no acesso dele.';
    }catch(err){info.textContent=err.message||'Não foi possível distribuir. Confira a conexão e tente novamente.';save.disabled=false}};
  }
  function renderSupervisor(){
    const area=document.getElementById('supervisorMedicoesLista');if(!area||!privileged)return;area.replaceChildren();
    const mine=filtrarMedicoes(rows).filter(r=>r.status==='AGUARDANDO_TECNICO'||r.status==='EM_CAMPO');
    const count=document.getElementById('supervisorMedicoesContagem');if(count)count.textContent=`${mine.filter(r=>r.status==='AGUARDANDO_TECNICO').length} aguardando técnico · ${mine.filter(r=>r.status==='EM_CAMPO').length} em campo`;
    for(const r of mine.slice(0,24)){const card=button('',()=>openDetails(r),'incidente-card supervisor-card project-list-card');card.append(e('strong',r.referencia),e('small',`${r.estado} · ${r.cidade} · ${r.supervisorNome}`),e('span',situacaoMedicao(r),'measure-status'),e('small',r.tecnicoNome||'Clique para escolher o técnico da equipe'));area.append(card)}
    if(!mine.length)area.append(e('p','Nenhuma medição aguardando distribuição ou em campo.','measure-empty'));
  }
  function listen(){if(opened)return;opened=true;let q=collection(db,'medicoes');if(perfil==='tecnico')q=query(q,where('tecnicoUid','==',uid));else if(perfil==='supervisor')q=query(q,where('supervisorUid','==',uid));else if(perfil==='projetos')q=query(q,where('status','in',['ENTREGUE','CONFERIDA']));ouvir('medicoes',q,snapshot=>{rows=snapshot.docs.map(s=>({id:s.id,...s.data()}));if(active&&!busy){const next=rows.find(r=>r.id===active.id);if(!next||next.status!=='EM_CAMPO'){closeEditor()}else if(etapaMedicao(next)!==etapaMedicao(active)){openCollection(next)}}if(dialog.open){const next=rows.find(r=>r.id===dialog.dataset.id);if(next&&(next.status!==dialog.dataset.status||String(etapaMedicao(next))!==dialog.dataset.etapa||[next.pop1EnviadoEm,next.entregueEm,next.conferidoEm].map(stamp).join('|')!==dialog.dataset.marcos))openDetails(next)}if(!queueOnly)feedbackTop.textContent=`Atualizado às ${new Date().toLocaleTimeString('pt-BR')} · ${perfil==='tecnico'?rows.filter(r=>r.tecnicoUid===uid&&r.status==='EM_CAMPO').length+' em andamento':rows.length+' demandas acessíveis'}`;render();renderSupervisor()})}
  return {
    abrir({diretoria=false}={}){const next=['diretor','gerente'].includes(perfil)||diretoria;if(next!==somenteLeitura)dialog.close();somenteLeitura=next;actions.hidden=next||queueOnly;createButton.hidden=next;editArea.hidden=next;executiveNav.hidden=!diretoria;back.hidden=diretoria||perfil==='coordenador';listen();render()},
    abrirSupervisao(){somenteLeitura=false;listen();renderSupervisor()},
    async abrirColeta(id){listen();const snap=await getDoc(doc(db,'medicoes',id));if(snap.exists())await openCollection({id,...snap.data()})},
    exemplo(){if(busy)return;if(editor?.locked){feedbackTop.textContent='Retome o envio com as evidências já conferidas.';return}if(!active||!ctx.exemploRascunho){feedbackTop.textContent='Abra uma medição atribuída antes de preencher o exemplo.';return}editMeasurement(active,{...ctx.exemploRascunho(active),etapa:etapaMedicao(active)+1,[etapaMedicao(active)===0?'rx':'tx']:fresh().tx})},
    fechar(){dialog.close()},
    destruir(){if(fotoAberta())fecharFotos();dialog.close();dialog.remove();window.removeEventListener('beforeunload',beforeUnload);root.replaceChildren();root.classList.remove('measure-workspace','measure-editing')}
  };
}
