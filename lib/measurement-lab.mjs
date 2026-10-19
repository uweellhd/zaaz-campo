// Banco exclusivamente em memória para o laboratório. Não importa Firebase nem usa rede.
export function criarBancoMedicoesLaboratorio(){
  let records=new Map(),listeners=[],sequence=2,failNext=false;
  const person=(nome,perfil,estado='SP')=>({nome,perfil,estado,ativo:true});
  const snapshot=ref=>({id:ref.id,exists:()=>records.has(ref.path),data:()=>records.get(ref.path)});
  const docs=ref=>{const prefix=ref.path+'/';const rows=[...records.keys()].filter(k=>k.startsWith(prefix)&&!k.slice(prefix.length).includes('/')).map(path=>snapshot({path,id:path.split('/').at(-1)})).filter(s=>(ref.filters||[]).every(f=>f.op==='in'?f.value.includes(s.data()[f.key]):s.data()[f.key]===f.value));return {docs:rows,size:rows.length,empty:!rows.length,forEach:fn=>rows.forEach(fn)}};
  const notify=()=>{for(const l of [...listeners])l.fn(l.ref.kind==='doc'?snapshot(l.ref):docs(l.ref))};
  const write=(ref,data,merge=false)=>{if(failNext){failNext=false;throw new Error('Falha de envio simulada pelo laboratório.')}records.set(ref.path,merge?{...records.get(ref.path),...data}:data);notify()};
  const api={
    collection:(db,...parts)=>({path:[db?.path,...parts].filter(Boolean).join('/'),kind:'collection'}),
    doc:(db,...parts)=>{const path=[db?.path,...parts].filter(Boolean).join('/')+(parts.length?'':`/sim-med-${++sequence}`);return {path,id:path.split('/').at(-1),kind:'doc'}},
    where:(key,op,value)=>({key,op,value}),query:(ref,...filters)=>({...ref,filters}),
    serverTimestamp:()=>new Date(),getDoc:async ref=>snapshot(ref),getDocs:async ref=>docs(ref),
    setDoc:async(ref,data)=>write(ref,data),updateDoc:async(ref,data)=>write(ref,data,true),
    runTransaction:async(db,fn)=>{const writes=[];await fn({get:api.getDoc,update:(ref,data)=>writes.push([ref,data,true]),set:(ref,data)=>writes.push([ref,data,false])});for(const [r,d,m] of writes)write(r,d,m)}
  };
  function reset(){records=new Map([
    ['usuarios/admin',person('Administração de teste','admin','TODOS')],['usuarios/supervisorA',person('Supervisor A (fictício)','supervisor')],['usuarios/supervisorB',person('Supervisor B (fictício)','supervisor','MG')],
    ['usuarios/tecnicoA',person('Técnico A (fictício)','tecnico')],['usuarios/tecnicoB',person('Técnico B (fictício)','tecnico','MG')],['usuarios/projetos',person('Projetista de teste','projetos','TODOS')],['usuarios/diretor',person('Diretor de teste','diretor','TODOS')],
    ['equipesTecnicas/tecnicoA',{tecnicoUid:'tecnicoA',supervisorUid:'supervisorA',ativo:true}],['equipesTecnicas/tecnicoB',{tecnicoUid:'tecnicoB',supervisorUid:'supervisorB',ativo:true}]
  ]);for(const [index,sup,estado] of [[1,'supervisorA','SP'],[2,'supervisorB','MG']])records.set(`medicoes/sim-med-${index}`,{referencia:`SIM-MED-00${index}`,cidade:'Cidade fictícia',estado,pontoA:'POP de teste A',pontoB:'POP de teste B',fibras:'',tecnicoUid:'',tecnicoNome:'',supervisorUid:sup,supervisorNome:records.get('usuarios/'+sup).nome,status:'AGUARDANDO_TECNICO',criadoPorUid:'admin',criadoEm:new Date(),versao:1});sequence=2;failNext=false;notify()}
  reset();
  return {api,ouvir:(key,ref,fn)=>{listeners.push({ref,fn});fn(ref.kind==='doc'?snapshot(ref):docs(ref))},limparOuvintes:()=>{listeners=[]},reiniciar:reset,falharProximoEnvio:()=>{failNext=true},registros:()=>[...records].filter(([p])=>/^medicoes\/[^/]+$/.test(p)).map(([id,data])=>({id,...data})),pessoa:uid=>records.get('usuarios/'+uid)};
}
