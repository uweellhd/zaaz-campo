import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configurarAlteracaoSenha} from '../js/account.js';

function fixture(error,delay=false){
  const nodes=Object.fromEntries(['formAlterarSenha','senhaAtual','novaSenha','confirmarNovaSenha','avisoAlterarSenha','btnAlterarSenha'].map(id=>[id,{value:'',textContent:'',disabled:false}]));
  const calls=[];let submit,release;
  nodes.formAlterarSenha.addEventListener=(_,fn)=>submit=fn;
  nodes.formAlterarSenha.reset=()=>{for(const id of ['senhaAtual','novaSenha','confirmarNovaSenha'])nodes[id].value=''};
  const auth={currentUser:{uid:'pessoa',email:'pessoa@zaaztelecom.com.br'}};
  configurarAlteracaoSenha({auth,EmailAuthProvider:{credential:(email,password)=>({email,password})},
    reauthenticateWithCredential:async(user,credential)=>{calls.push(['reauth',user.uid,credential.email]);if(delay)await new Promise(r=>release=r);if(error)throw {code:error}},
    updatePassword:async(user,password)=>calls.push(['update',user.uid,password])}, {getElementById:id=>nodes[id]});
  nodes.senhaAtual.value='Atual fictícia de teste';nodes.novaSenha.value=nodes.confirmarNovaSenha.value='Nova fictícia de teste';
  return {nodes,auth,calls,submit:()=>submit({preventDefault(){}}),release:()=>release()};
}
test('senha: reautentica o próprio usuário antes de atualizar e limpa campos',async()=>{
  const f=fixture();await f.submit();assert.deepEqual(f.calls.map(c=>c[0]),['reauth','update']);assert.equal(f.calls[1][1],'pessoa');
  assert.match(f.nodes.avisoAlterarSenha.textContent,/Senha alterada/);assert.equal(f.nodes.senhaAtual.value,'');assert.equal(f.nodes.novaSenha.value,'');assert.equal(f.nodes.confirmarNovaSenha.value,'');assert.equal(f.nodes.btnAlterarSenha.disabled,false);
});
test('senha: confirmação divergente, curta ou igual não chegam ao Firebase',async()=>{
  for(const mode of ['diferente','curta','igual']){const f=fixture();if(mode==='diferente')f.nodes.confirmarNovaSenha.value='Diferente';if(mode==='curta')f.nodes.novaSenha.value='curta';if(mode==='igual')f.nodes.novaSenha.value=f.nodes.confirmarNovaSenha.value=f.nodes.senhaAtual.value;await f.submit();assert.equal(f.calls.length,0)}
});
test('senha: erro de autenticação impede atualização e limpa dados sensíveis',async()=>{
  for(const code of ['auth/invalid-credential','auth/network-request-failed','auth/too-many-requests']){const f=fixture(code);await f.submit();assert.equal(f.calls.length,1);assert.equal(f.nodes.novaSenha.value,'');assert.equal(f.nodes.senhaAtual.value,'');assert.equal(f.nodes.btnAlterarSenha.disabled,false);assert.doesNotMatch(f.nodes.avisoAlterarSenha.textContent,/Senha alterada/)}
});
test('senha: bloqueia reenvio e troca de sessão durante confirmação',async()=>{
  const f=fixture(null,true);const envio=f.submit();assert.equal(f.nodes.btnAlterarSenha.disabled,true);await f.submit();assert.equal(f.calls.length,1);f.auth.currentUser={uid:'outra',email:'outra@zaaztelecom.com.br'};f.release();await envio;assert.equal(f.calls.length,1);assert.doesNotMatch(f.nodes.avisoAlterarSenha.textContent,/Senha alterada/);
});
test('senha: sessão expirada não inicia atualização',async()=>{
  const f=fixture();f.auth.currentUser=null;await f.submit();assert.equal(f.calls.length,0);assert.match(f.nodes.avisoAlterarSenha.textContent,/sessão expirou/);
});
