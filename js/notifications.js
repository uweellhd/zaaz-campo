import { notificationChannels, notificationEvents, createNotificationState } from '../lib/notifications.mjs';
const node=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n};
const action=(text,fn,cls='')=>{const b=node('button',text,cls);b.type='button';b.onclick=fn;return b};
export function iniciarNotificacoes(ctx){
  const host=document.getElementById('notificationHost');if(!host)return {fechar(){}};
  const channels=notificationChannels(ctx);host.hidden=!channels.length;
  if(!channels.length)return {fechar(){}};
  const dateFormat=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
  const storageKey=`nextflow-alertas-v1:${ctx.uid}:${ctx.perfil}`,stops=[],errors=new Set();let closed=false,popupTimer,batchTimer,pending=new Map();
  function stored(){try{return JSON.parse(localStorage.getItem(storageKey)||'[]')}catch{return []}}
  const state=createNotificationState(Array.isArray(stored())?stored():[]);
  const bell=action('',()=>toggle(),'notification-bell');bell.setAttribute('aria-controls','notificationPanel');bell.setAttribute('aria-expanded','false');
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.innerHTML='<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>';
  const count=node('span','','notification-count');count.hidden=true;count.setAttribute('aria-hidden','true');bell.append(icon,count);
  const panel=node('section','','notification-panel');panel.id='notificationPanel';panel.hidden=true;panel.setAttribute('aria-labelledby','notificationTitle');
  const header=node('div','','notification-header'),title=node('h3','Notificações');title.id='notificationTitle';
  const closePanel=action('Fechar',()=>toggle(false),'notification-text-button');header.append(title,closePanel);
  const help=node('p','Avisos recentes para sua responsabilidade.','notification-help'),status=node('p','','notification-status');status.setAttribute('role','status');
  const list=node('div','','notification-list'),clear=action('Limpar avisos',()=>{state.dismiss(state.list().map(e=>e.key));pending.clear();hidePopup();persist();render()},'notification-clear');
  panel.append(header,help,status,list,clear);host.replaceChildren(bell,panel);
  const popup=node('div','','notification-toast');popup.hidden=true;const announcement=node('p');announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');
  const popupAction=action('Ver notificações',()=>{hidePopup();toggle(true)},'notification-text-button'),dismissPopup=action('×',()=>hidePopup(),'notification-toast-close');dismissPopup.setAttribute('aria-label','Fechar aviso');popup.append(announcement,popupAction,dismissPopup);document.body.append(popup);
  function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state.dismissed()))}catch{/* Sem armazenamento, os avisos ainda funcionam nesta sessão. */}}
  function position(){if(panel.hidden)return;const rect=bell.getBoundingClientRect();panel.style.top=`${Math.max(12,Math.min(rect.bottom+10,innerHeight-220))}px`;}
  function toggle(value=panel.hidden,returnFocus=true){panel.hidden=!value;bell.setAttribute('aria-expanded',String(value));if(value){document.getElementById('accountMenu')?.removeAttribute('open');position();closePanel.focus()}else if(returnFocus)bell.focus()}
  function hidePopup(){clearTimeout(popupTimer);popup.hidden=true;announcement.textContent='';}
  function open(item){state.dismiss([item.key]);persist();panel.hidden=true;bell.setAttribute('aria-expanded','false');hidePopup();render();ctx.navegar(item.view,item.service);}
  function render(){if(closed)return;const items=state.list();count.textContent=String(items.length);count.hidden=!items.length;bell.setAttribute('aria-label',`Notificações: ${items.length} aviso${items.length===1?'':'s'}`);clear.disabled=!items.length;list.replaceChildren();
    status.textContent=errors.size?'Não foi possível atualizar todos os avisos. Confira a conexão e atualize a página.':'';status.hidden=!errors.size;
    help.textContent='Até 100 avisos recentes. Limpar não altera as OS.';
    if(!items.length)list.append(node('p','Nenhum aviso novo para sua responsabilidade.','notification-empty'));
    for(const item of items){const row=node('div','','notification-item'),go=action('',()=>open(item),'notification-open');go.append(node('strong',item.title),node('span',item.detail));if(item.stamp){const time=node('time',dateFormat.format(new Date(item.stamp)));go.append(time)}const remove=action('×',()=>{state.dismiss([item.key]);pending.delete(item.key);persist();render()},'notification-remove');remove.setAttribute('aria-label',`Dispensar aviso: ${item.detail}`);row.append(go,remove);list.append(row)}
  }
  function enqueue(events){for(const event of events)pending.set(event.key,event);if(!events.length||batchTimer)return;batchTimer=setTimeout(()=>{batchTimer=null;if(closed)return;const current=new Set(state.list().map(e=>e.key)),fresh=[...pending.values()].filter(e=>current.has(e.key));pending.clear();if(!fresh.length)return;announcement.textContent=fresh.length===1?`${fresh[0].title}. ${fresh[0].detail}`:`${fresh.length} novas notificações para sua responsabilidade.`;popup.hidden=false;clearTimeout(popupTimer);popupTimer=setTimeout(hidePopup,10000);},250)}
  const outside=event=>{if(!panel.hidden&&!host.contains(event.target)&&!popup.contains(event.target))toggle(false,false)};
  const keyboard=event=>{if(event.key==='Escape'&&!panel.hidden){toggle(false);event.preventDefault()}};
  const storage=event=>{if(event.key===storageKey){state.restore(stored());pending.clear();hidePopup();render()}};
  document.addEventListener('click',outside);document.addEventListener('keydown',keyboard);window.addEventListener('resize',position);window.addEventListener('storage',storage);
  render();
  const {collection,query,where}=ctx.servicos;
  for(const source of channels){let ref=collection(ctx.db,source.collection);if(source.filters.length)ref=query(ref,...source.filters.map(f=>where(...f)));
    stops.push(ctx.ouvir(ref,snapshot=>{if(closed)return;const hadError=errors.delete(source.key),version=state.version();const events=notificationEvents(source.key,snapshot.docs.map(d=>({...d.data(),id:d.id})),ctx);const fresh=state.update(source.key,events,{silent:!!(snapshot.metadata?.fromCache||snapshot.metadata?.hasPendingWrites)});if(hadError||version!==state.version())render();enqueue(fresh)},()=>{if(closed)return;errors.add(source.key);state.update(source.key,[],{silent:true});render()}));
  }
  return {fechar(){closed=true;for(const stop of stops)stop?.();clearTimeout(batchTimer);clearTimeout(popupTimer);document.removeEventListener('click',outside);document.removeEventListener('keydown',keyboard);window.removeEventListener('resize',position);window.removeEventListener('storage',storage);state.clear();pending.clear();popup.remove();host.replaceChildren();host.hidden=true;}};
}
