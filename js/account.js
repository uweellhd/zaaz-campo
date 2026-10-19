// A senha é enviada apenas ao Firebase Authentication. Não vai para o Firestore ou rascunhos.
export function configurarAlteracaoSenha({auth,EmailAuthProvider,reauthenticateWithCredential,updatePassword},root=document) {
  const form=root.getElementById('formAlterarSenha');
  if(!form)return;
  const atual=root.getElementById('senhaAtual'),nova=root.getElementById('novaSenha'),confirmacao=root.getElementById('confirmarNovaSenha');
  const aviso=root.getElementById('avisoAlterarSenha'),botao=root.getElementById('btnAlterarSenha');
  let enviando=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(enviando)return;
    const user=auth.currentUser;
    if(!user?.email){aviso.textContent='Sua sessão expirou. Entre novamente para alterar a senha.';return;}
    if(!atual.value||nova.value.length<12||nova.value.length>128){aviso.textContent='Informe a senha atual e uma nova senha com 12 a 128 caracteres.';return;}
    if(nova.value!==confirmacao.value){aviso.textContent='A confirmação está diferente da nova senha.';return;}
    if(atual.value===nova.value){aviso.textContent='Escolha uma senha diferente da atual.';return;}
    const novaSenha=nova.value;
    enviando=true;botao.disabled=true;aviso.textContent='Atualizando senha...';
    try {
      const credencial=EmailAuthProvider.credential(user.email,atual.value);
      await reauthenticateWithCredential(user,credencial);
      if(auth.currentUser?.uid!==user.uid)throw new Error('sessao-alterada');
      await updatePassword(user,novaSenha);
      aviso.textContent='Senha alterada. Use a nova senha no próximo acesso.';
    } catch(erro) {
      const mensagens={
        'auth/wrong-password':'A senha atual não confere. Digite novamente.',
        'auth/invalid-credential':'A senha atual não confere. Digite novamente.',
        'auth/too-many-requests':'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
        'auth/weak-password':'A nova senha não atende aos requisitos. Escolha uma senha mais forte.',
        'auth/password-does-not-meet-requirements':'A nova senha não atende aos requisitos. Escolha uma senha mais forte.',
        'auth/network-request-failed':'Sem conexão. Conecte-se à internet e tente novamente.',
        'auth/requires-recent-login':'Entre novamente para confirmar a troca de senha.'
      };
      aviso.textContent=mensagens[erro.code]||'Não foi possível alterar a senha. Entre novamente e tente de novo.';
    } finally {
      form.reset();botao.disabled=false;enviando=false;
    }
  });
}
