// Apresentação já usada pelos IDs de rompimento, compartilhada com Medições.
export function criarCartaoTecnico({titulo,campos,status,abrir}) {
  const card=document.createElement('button');card.type='button';card.className='incidente-card field-task-card';card.onclick=abrir;
  const h=document.createElement('h4');h.textContent=titulo;h.style.cssText='color:var(--zaaz-blue);margin-bottom:6px';
  const info=document.createElement('p');info.style.fontSize='13px';
  campos.forEach(([label,value],i)=>{if(i)info.append(document.createTextNode(' | '));const strong=document.createElement('strong');strong.textContent=label+': ';info.append(strong,document.createTextNode(value||'—'))});
  const state=document.createElement('p');state.textContent='Status: '+status;state.style.cssText='font-size:12px;color:var(--zaaz-blue);font-weight:700;margin-top:8px';
  const action=document.createElement('p');action.textContent='▶️ Abrir atendimento atribuído';action.style.cssText='font-size:12px;color:var(--success);font-weight:700';
  card.append(h,info,state,action);return card;
}
