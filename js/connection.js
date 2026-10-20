const status=document.createElement('p');
status.className='connection-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;
(document.querySelector('main')||document.body).prepend(status);
function update(){status.hidden=navigator.onLine;status.textContent='Sem conexão. O rascunho técnico fica neste aparelho. Para os demais setores, os dados podem estar desatualizados. Envie a etapa ao reconectar e aguarde a confirmação.';}
window.addEventListener('online',update);window.addEventListener('offline',update);update();

window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});
