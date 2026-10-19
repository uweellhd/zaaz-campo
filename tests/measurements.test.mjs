import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validarEntrega,validarArquivo,filtrarMedicoes,analisarMedicoes,codificar,decodificar,sha256,MAX_FILE_BYTES,validarEtapaMedicao,etapaMedicao,situacaoMedicao} from '../lib/measurements.mjs';
const file={name:'fibra-01.sor',size:2048};
const data=()=>({observacao:'Medição bidirecional da fibra 01.',tx:{gps:{latitude:-23,longitude:-46},fotos:['tx'],arquivos:[file]},rx:{gps:{latitude:-23.1,longitude:-46.1},fotos:['rx'],arquivos:[{name:'rx.trc',size:4096}]}});
test('TX e RX exigem cada um foto, arquivo original e localização, com limites independentes',()=>{assert.equal(validarEntrega(data()),'');for(const side of ['tx','rx'])for(const key of ['fotos','arquivos','gps']){const d=data();d[side][key]=key==='gps'?null:[];assert.notEqual(validarEntrega(d),'')}const d=data();d.tx.fotos=Array(7).fill('foto');assert.notEqual(validarEntrega(d),'');d.tx.fotos=Array(6).fill('foto');d.tx.arquivos=Array(3).fill(file);assert.equal(validarEntrega(d),'');d.rx.gps.latitude=91;assert.notEqual(validarEntrega(d),'')});
test('aceita PDF e originais dos fabricantes; rejeita executável, vazio e arquivo acima do teto',()=>{for(const ext of ['pdf','sor','MSOR','trc','iolm'])assert.equal(validarArquivo({name:`fibra.${ext}`,size:MAX_FILE_BYTES,validarEtapaMedicao,etapaMedicao,situacaoMedicao}),'');for(const f of [{name:'arquivo.exe',size:100},{name:'fibra.sor',size:0},{name:'fibra.sor',size:MAX_FILE_BYTES+1}])assert.notEqual(validarArquivo(f),'')});
test('binário com todos os bytes é preservado após codificação e hash',async()=>{const original=Uint8Array.from({length:600000},(_,n)=>n%256);const decoded=decodificar(codificar(original));assert.deepEqual(decoded,original);assert.equal(await sha256(decoded),await sha256(original));decoded[5]^=1;assert.notEqual(await sha256(decoded),await sha256(original))});
test('PDF e tela usam mesmo recorte em Brasília; entrega e conferência são distintas',()=>{const rows=[{referencia:'A',status:'EM_CAMPO',estado:'SP',criadoEm:new Date('2026-10-19T02:00:00Z')},{referencia:'B',status:'ENTREGUE',estado:'MG',criadoEm:new Date('2026-10-19T03:00:00Z'),txArquivos:1,rxArquivos:1},{referencia:'C',status:'CONFERIDA',estado:'MG',criadoEm:new Date('2026-10-19T05:00:00Z')}];assert.equal(filtrarMedicoes(rows,{inicio:'2026-10-19'}).length,2);assert.equal(filtrarMedicoes(rows,{estado:'MG',status:'ENTREGUE'})[0].referencia,'B');const m=analisarMedicoes(rows);assert.equal(m.emCampo,1);assert.equal(m.entregues,1);assert.equal(m.conferidas,1);assert.equal(m.conclusao,33);assert.equal(m.arquivos,2)});

test('fila sem técnico não é contada como execução e não exige fibras conhecidas na entrega',()=>{const d=data();d.fibras='';assert.equal(validarEntrega(d),'');const m=analisarMedicoes([{status:'AGUARDANDO_TECNICO',estado:'SP'},{status:'EM_CAMPO',estado:'SP'}]);assert.equal(m.aguardando,1);assert.equal(m.emCampo,1);assert.equal(m.total,2)});

test('PDF exportado do OTDR é aceito com nome duplo e dispensa um arquivo nativo adicional',()=>{
  const pdf={name:'POP-PNM-DIO-03-FO-04.msor.pdf',size:116400};assert.equal(validarArquivo(pdf),'');
  const d=data();d.tx.arquivos=[pdf];d.rx.arquivos=[{...pdf,name:'retorno.MSOR.PDF'}];assert.equal(validarEntrega(d),'');
  assert.notEqual(validarArquivo({...pdf,name:'relatorio.pdf.exe'}),'');
});

test('duas etapas: POP 1 exige somente seus anexos e POP 2 valida seu próprio conjunto',()=>{
 const d=data();d.rx={gps:null,fotos:[],arquivos:[]};assert.equal(validarEtapaMedicao(d,1),'');assert.match(validarEtapaMedicao(d,2),/POP 2/);d.tx.arquivos=[];assert.match(validarEtapaMedicao(d,1),/POP 1/);assert.notEqual(validarEtapaMedicao(data(),3),'');
});
test('progresso distingue POP 1 pendente, POP 2 na rota e entrega completa, inclusive legados',()=>{
 assert.equal(etapaMedicao({status:'EM_CAMPO'}),0);assert.equal(etapaMedicao({status:'EM_CAMPO',etapaConcluida:1}),1);assert.equal(etapaMedicao({status:'CONFERIDA'}),2);assert.match(situacaoMedicao({status:'EM_CAMPO',etapaConcluida:1}),/aguardando POP 2/);assert.equal(validarEtapaMedicao({...data(),fibras:'FO 04'},1),'');assert.equal(validarEtapaMedicao({...data(),fibras:'FO 04 e FO 05'},2),'');
});

test('busca por fibra também encontra as identificações independentes de cada POP',()=>{
 const rows=[{referencia:'OS-1',fibrasPop1:'FO 04 e FO 05',fibrasPop2:'FO 09',status:'EM_CAMPO'},{referencia:'OS-2',fibras:'FO 01',status:'EM_CAMPO'}];assert.equal(filtrarMedicoes(rows,{busca:'FO 09'})[0].referencia,'OS-1');assert.equal(filtrarMedicoes(rows,{busca:'FO 01'})[0].referencia,'OS-2');
});
