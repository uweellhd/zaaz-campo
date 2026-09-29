# NEXTFLOW interno ZAAZ — permissões e retenção de fotos

Este é o guia técnico da proposta de alteração. Vamos executar cada tela juntos. **O Netlify receberá somente uma publicação final**, feita automaticamente quando a proposta for mesclada no GitHub. A limpeza diária roda no GitHub Actions, sem função agendada no Netlify.

## O que a mudança faz

- `admin`, `noc`, `gerente`, `diretor`, `sac` e `suporte` podem consultar incidentes de todos os estados. Só `admin` e `noc` criam incidentes; `sac` e `suporte` apenas consultam.
- Técnico precisa ter `estado` igual a `SP`, `MG` ou `PR`, vê somente a fila desse estado, assume um chamado e atualiza o próprio atendimento.
- Cada foto nova fica separada na coleção `fotos`. Após 15 dias, o Firestore nega a leitura; o GitHub Actions apaga fisicamente as fotos na rotina diária. As etapas, observações e indicadores permanecem no incidente.
- Fotos antigas embutidas no histórico são removidas gradualmente pela rotina. Os textos do histórico são preservados.

## Ordem segura para publicar uma única vez

1. **Faça uma cópia dos dados importantes.** Não compartilhe a chave privada do Firebase em mensagens ou no repositório.
2. No GitHub do repositório `uweellhd/zaaz-campo`: **Settings → Secrets and variables → Actions → New repository secret**. Nome: `FIREBASE_SERVICE_ACCOUNT_JSON`; valor: todo o conteúdo do arquivo JSON baixado em **Firebase → Configurações do projeto → Contas de serviço → Gerar nova chave privada**. O segredo fica armazenado no GitHub, não no código. A chave concede acesso administrativo: guarde o arquivo local em segurança e revogue-o se for exposto.
3. No Firebase, abra **Firestore → Regras**. Substitua pelo conteúdo integral de `firestore.rules` desta proposta e clique **Publicar**. Isso pode interromper temporariamente a lista dos técnicos na versão antiga, pois ela ainda consulta todos os estados; faça os passos 3 e 4 em sequência.
4. Mescle a proposta de permissões/fotos no GitHub **uma vez**, iniciando o deploy automático no Netlify. Espere a publicação terminar. Não é necessário criar função, variável ou novo site no Netlify.
5. No GitHub, abra **Actions → Limpar fotos antigas → Run workflow** e execute uma vez. Confira o resultado da execução; o agendamento diário passa a rodar às **00:17 em Brasília** (03:17 UTC). A limpeza pode atrasar; as regras bloqueiam as fotos novas no limite de 15 dias mesmo antes da exclusão física.
6. Teste uma conta de administrador e uma de técnico em estado específico. O técnico deve ver apenas seu estado, assumir um chamado, enviar foto e salvar uma etapa. No Firestore, confira `fotos/{id}` e `incidentes/{id}.timelineEtapas[].fotoIds`. SAC consulta sem editar.

## Criar usuários

Firebase → **Authentication → Usuários → Adicionar usuário**: crie o e-mail e a senha do funcionário; copie o UID. Depois **Firestore → Dados → usuarios → Adicionar documento**: ID do documento = UID; campos `nome` (texto), `perfil` (texto), `estado` (texto), `ativo` (booleano verdadeiro). Perfis aceitos: `admin`, `gerente`, `diretor`, `noc`, `sac`, `suporte`, `tecnico`. Para técnico, `estado` é `SP`, `MG` ou `PR`. Para os demais, pode ser `TODOS`. A conta sem perfil ativo não entra.

## Limites conhecidos

- Firestore no plano Spark não é um serviço de arquivos: as imagens são comprimidas e guardadas em documentos temporários. Uma operação com muitas fotos precisará de armazenamento próprio, como Cloud Storage no plano Blaze.
- O GitHub desativa trabalhos agendados em repositórios públicos após **60 dias sem atividade**. Se isso ocorrer, reative o fluxo em **Actions**. As regras continuam bloqueando leitura após 15 dias, mas a exclusão física fica suspensa até reativar.
- A rotina não consegue apagar cópias que alguém tenha baixado para o próprio dispositivo. Fotos antigas sem data confiável são removidas na primeira passagem.
