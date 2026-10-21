import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationChannels as channels,notificationEvents as events,createNotificationState as state,notificationStamp} from '../lib/notifications.mjs';
const tech={uid:'t1',perfil:'tecnico'},sup={uid:'s1',perfil:'supervisor'},proj={uid:'p1',perfil:'projetos'};
const rupture={id:'i1',idIncidente:'10607',tecnicoUid:'t1',supervisorUid:'s1',atribuidoEm:100,statusAtual:'ABERTO'};
const measurement={id:'m1',referencia:'OTDR-1',status:'EM_CAMPO',supervisorUid:'s1',tecnicoUid:'t1',atribuidoEm:100,criadoEm:50};
test('consultas técnicas e de supervisão não incluem outras equipes',()=>{
 const tc=channels(tech);assert.equal(tc.length,2);assert(tc.every(c=>c.filters.some(f=>f[0]==='tecnicoUid'&&f[2]==='t1')));
 assert(channels(sup).every(c=>c.filters.some(f=>f[0]==='supervisorUid'&&f[2]==='s1')));
 const cc=channels({uid:'c',perfil:'coordenador',supervisoresUids:['s1','s2']});assert(cc.every(c=>c.filters.some(f=>f[0]==='supervisorUid'&&f[1]==='in'&&f[2].join()==='s1,s2')));
 assert.deepEqual(channels({uid:'c',perfil:'coordenador'}),[]);
 for(const perfil of ['sac','suporte','noc','diretor','gerente'])assert.deepEqual(channels({uid:'x',perfil}),[]);
 assert.equal(channels({uid:'a',perfil:'admin'}).find(c=>c.key==='acessos').collection,'solicitacoesAcesso');
});
test('destinatários são conferidos também ao preparar o aviso',()=>{
 assert.equal(events('tecnico-rompimentos',[rupture],tech).length,1);
 assert.equal(events('tecnico-rompimentos',[{...rupture,tecnicoUid:'outro'}],tech).length,0);
 assert.equal(events('tecnico-rompimentos',[{...rupture,etapaConcluida:4}],tech).length,0);
 assert.equal(events('tecnico-medicoes',[{...measurement,status:'ENTREGUE'}],tech).length,0);
 assert.equal(events('supervisao-rompimentos',[{...rupture,supervisorUid:'outro'}],sup).length,0);
 assert.equal(events('coordenacao-rompimentos',[rupture],{perfil:'coordenador',supervisoresUids:['outra']} ).length,0);
 assert.equal(events('acessos',[{id:'a',status:'pendente'}],proj).length,0);
});
test('entrega de Projetos avisa fila livre ou analista designado; tratadas saem',()=>{
 const row={id:'p',idIncidente:'1',statusOzmaps:'PENDENTE',criadoEm:100};
 assert.equal(events('projetos-rompimentos',[row],proj).length,1);
 assert.equal(events('projetos-rompimentos',[{...row,projetoResponsavelUid:'outro'}],proj).length,0);
 assert.equal(events('projetos-rompimentos',[{...row,projetoResponsavelUid:'outro'}],{perfil:'coordenador_projetos',uid:'c'}).length,1);
 assert.equal(events('projetos-rompimentos',[{...row,statusOzmaps:'REGISTRADO'}],proj).length,0);
 assert.equal(events('projetos-medicoes',[{...measurement,status:'ENTREGUE'}],proj).length,1);
 assert.equal(events('projetos-medicoes',[{...measurement,status:'CONFERIDA'}],proj).length,0);
});
test('primeiro carregamento é silencioso; chegada e reatribuição notificam uma vez',()=>{
 const s=state(),first=events('tecnico-rompimentos',[rupture],tech);
 assert.equal(s.update('i',first).length,0);assert.equal(s.list().length,1);
 const version=s.version();assert.equal(s.update('i',first).length,0);assert.equal(s.version(),version);
 const reassigned=events('tecnico-rompimentos',[{...rupture,atribuidoEm:200}],tech);
 assert.equal(s.update('i',reassigned).length,1);assert.equal(s.list().length,1);assert.equal(s.update('i',reassigned).length,0);
 s.update('i',[]);assert.equal(s.list().length,0);
});
test('cache inicial é silencioso, mas primeira chegada confirmada não é perdida',()=>{
 const s=state(),rows=events('tecnico-medicoes',[measurement],tech);s.update('m',rows,{silent:true});
 assert.equal(s.update('m',[...rows,...events('tecnico-medicoes',[{...measurement,id:'m2'}],tech)]).length,1);
 assert.equal(s.update('m',[...rows,...events('tecnico-medicoes',[{...measurement,id:'m3'}],tech)]).length,1);
 const empty=state();empty.update('m',[],{silent:true});assert.equal(empty.update('m',rows).length,1);
});
test('limpar guarda apenas chaves, persiste no navegador e não ressuscita no mesmo snapshot',()=>{
 const s=state(),rows=events('tecnico-rompimentos',[rupture],tech);s.update('i',rows);s.dismiss(rows.map(e=>e.key));assert.equal(s.list().length,0);assert.deepEqual(s.dismissed(),[rows[0].key]);
 const next=state(s.dismissed());assert.equal(next.update('i',rows).length,0);assert.equal(next.list().length,0);
 assert.equal(next.update('i',events('tecnico-rompimentos',[{...rupture,atribuidoEm:999}],tech)).length,1);
});
test('fila é limitada, datas suportam Firebase e IDs longos não colidem',()=>{
 const s=state(),rows=Array.from({length:9000},(_,i)=>({...rupture,id:'i'+i,atribuidoEm:i}));s.update('i',events('tecnico-rompimentos',rows,tech));assert.equal(s.list().length,100);assert.equal(s.list()[0].stamp,8999);
 assert.equal(notificationStamp(new Date('inválida')),0);assert.equal(notificationStamp(Infinity),0);assert.equal(notificationStamp({seconds:123,nanoseconds:500000000}),123500);assert.equal(notificationStamp({toMillis:()=>123}),123);
 const a='x'.repeat(200);assert.notEqual(events('tecnico-rompimentos',[{...rupture,id:a+'1'}],tech)[0].key,events('tecnico-rompimentos',[{...rupture,id:a+'2'}],tech)[0].key);
 s.clear();assert.equal(s.list().length,0);
});
