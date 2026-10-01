# NEXTFLOW · laboratório de setores

## Abrir pelo seu acesso

1. Entre como administrador.
2. Clique na seta ao lado do seu nome e em **🧪 Testar setores**.
3. Use **Testar como** para mudar de setor. O aviso de simulação permanece na tela.

O laboratório lê seu perfil para confirmar que você é administrador. Depois disso, todas as ações operacionais usam dados fictícios em memória. Nenhum chamado, conta, foto ou permissão real é criado, editado ou excluído. Atualizar a página ou tocar em Reiniciar teste limpa os dados fictícios.

## Teste completo sozinho

1. **NOC:** crie um ID com prefixo TESTE e atribua ao Técnico A. Há também três IDs fictícios iniciais.
2. **Técnico A:** abra o ID atribuído. Envie a etapa 1 sem foto para conferir que é opcional. Na etapa 2, informe causa e previsão. Envie a etapa 3.
3. **Etapa 4:** primeiro tente finalizar sem anexos para conferir o bloqueio. Toque em Usar fotos fictícias nesta etapa, preencha o GPS fictício de cada caixa e descreva o serviço. Finalize. Se adicionar uma caixa extra, ela também exige foto e GPS ou deve ser removida.
4. **SAC / Suporte:** abra o mesmo ID. Veja o histórico sem controles de edição.
5. **Supervisor A:** confira somente os IDs ligados ao Supervisor A. O ID inicial TESTE-1002 é do Supervisor B e não aparece.
6. **Projetos:** abra a entrega do ID finalizado. Só as caixas, fotos, coordenadas e descrição da etapa 4 aparecem. Marque o lançamento fictício no OZmaps.
7. **Diretor:** confira os indicadores e exporte o CSV identificado como SIMULAÇÃO.
8. **Transferência:** em outro ID aberto, entre como Técnico A e transfira para B. Troque para Técnico B e confira a fila.

O roteiro marca as ações realizadas. Fotos escolhidas do aparelho ficam apenas na memória desta página; prefira as fotos fictícias. O GPS fictício não solicita localização do aparelho. O laboratório testa o entendimento do fluxo, não a sessão real de cada função nem o funcionamento offline do site real.

## Testes das permissões reais, sem e-mails corporativos

A rotina **Testar permissões por setor**, no GitHub Actions, usa o emulador oficial do Firestore com o projeto fictício `demo-nextflow-security`. Não usa credenciais de produção. Executa dez cenários: acesso sem sessão/domínio externo/pendente/inativo; funções globais; isolamento de técnicos; fotos e transferência; supervisor; Projetos; conclusão atômica da etapa 4; expiração das fotos; cadastro e aprovação; listas de equipe.

Esses testes carregam o arquivo `firestore.rules` do repositório e avaliam as operações permitidas e proibidas. Passar nos cenários não substitui a conferência de deploy das regras nem cobre todas as possibilidades de segurança.

Para executar em uma máquina de desenvolvimento: Node 22 e Java 21 ou superior, `npm ci --prefix tests/security` e `npm test --prefix tests/security`. Não é necessário login Firebase; o projeto demo só usa o emulador.
