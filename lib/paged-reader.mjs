// Uma página de metadados por vez. Fotos e arquivos só são lidos nos detalhes.
export function criarLeitorPaginado({services:s,db,base,receive,size=24}) {
  let generation=0,page=0,cursors=[],stops=[],loading=false,hasMore=false,rows=[],headId='',newRecords=false,closed=false;
  const stop=()=>{for(const fn of stops)fn?.();stops=[]};
  const emit=error=>receive({rows,page,loading,hasMore,newRecords,error});
  async function load(target=0,reset=false){
    const epoch=++generation;stop();closed=false;loading=true;rows=[];newRecords=false;if(reset)cursors=[];page=target;emit();
    try{
      const q=base(),after=target?cursors[target-1]:null;
      if(target&&!after)throw Error('Página indisponível. Atualize a lista.');
      const snap=await s.getDocs(s.query(q,...(after?[s.startAfter(after)]:[]),s.limit(size+1)));
      if(epoch!==generation||closed)return;
      const docs=snap.docs.slice(0,size);rows=docs.map(d=>({id:d.id,...d.data()}));hasMore=snap.docs.length>size;cursors[target]=docs.at(-1)||null;
      loading=false;emit();
      if(docs.length){const ids=docs.map(d=>d.id);stops.push(s.onSnapshot(s.query(s.collection(db,'medicoes'),s.where(s.documentId(),'in',ids)),latest=>{
        if(epoch!==generation||closed)return;const found=new Map(latest.docs.map(d=>[d.id,{id:d.id,...d.data()}]));rows=ids.map(id=>found.get(id)).filter(Boolean);emit();
      },error=>{if(epoch===generation)emit(error)}));}
      let first=true;stops.push(s.onSnapshot(s.query(q,s.limit(1)),latest=>{
        if(epoch!==generation||closed)return;const id=latest.docs[0]?.id||'';
        if(first){headId=id;first=false;return}if(id!==headId){newRecords=true;emit()}
      },error=>{if(epoch===generation)emit(error)}));
    }catch(error){if(epoch===generation&&!closed){loading=false;hasMore=false;emit(error)}}
  }
  return {recarregar:()=>load(0,true),proxima:()=>!loading&&hasMore?load(page+1):Promise.resolve(),anterior:()=>!loading&&page?load(page-1):Promise.resolve(),fechar(){closed=true;generation++;stop();rows=[]}};
}
export function consultaMedicoesPaginada(s,db,f={}) {
  const field=f.baseData==='conclusao'?'entregueEm':'criadoEm',parts=[];
  for(const [key,value]of [['estado',f.estado],['status',f.status],['referencia',f.busca?.trim()]])if(value)parts.push(s.where(key,'==',value));
  if(f.inicio)parts.push(s.where(field,'>=',new Date(f.inicio+'T00:00:00-03:00')));
  if(f.fim){const end=new Date(f.fim+'T00:00:00-03:00');end.setUTCDate(end.getUTCDate()+1);parts.push(s.where(field,'<',end));}
  return s.query(s.collection(db,'medicoes'),...parts,s.orderBy(field,'desc'));
}
