# NEXTFLOW interno ZAAZ — publicação da versão 2

Este pacote contém **arquivos completos**, com os mesmos nomes e pastas do repositório. Faça uma cópia dos arquivos atuais antes de substituí-los. O endereço do site no Netlify precisa apontar para este repositório; confira o nome do site em **Visão geral do site** no Netlify.

## O que muda

- Login estático e legível, sem linhas animadas, com opção de mostrar a senha.
- NEXTFLOW como produto; ZAAZ como ambiente interno. O antigo tema Neon vira tema ZAAZ (roxo e amarelo).
- Abas por função e controle dos dados no Firestore. `admin`, `noc`, `gerente`, `diretor`, `sac` e `suporte` podem consultar incidentes de todos os estados. Técnico consulta somente o estado do perfil, assume um chamado livre e atualiza o próprio chamado.
- Fotos novas ficam em documentos separados na coleção `fotos`. Após 15 dias, a regra bloqueia sua leitura; uma função agendada apaga os documentos diariamente. O texto, as etapas e as métricas do incidente permanecem. Fotos antigas ainda embutidas em incidentes são removidas gradualmente pela mesma função.

## Ordem de publicação

1. **Faça cópia** do repositório e exporte os dados do Firestore que precisa preservar. Nunca publique uma chave de conta de serviço no GitHub nem envie a chave por mensagem.
2. **Configure a chave privada no Netlify:** no Firebase, abra **Configurações do projeto** (engrenagem) → **Contas de serviço** → **Gerar nova chave privada**. Baixe o JSON no seu computador. No Netlify, abra o site certo → **Site configuration** → **Environment variables** → **Add a variable**. Nome: `FIREBASE_SERVICE_ACCOUNT_JSON`. Valor: o conteúdo inteiro do JSON, sem alterações. Marque o escopo **Functions** (e o contexto de produção). Guarde o arquivo JSON fora do repositório. Se a interface tiver nomes ligeiramente diferentes, procure a seção de variáveis de ambiente do site.
3. **Publique `firestore.rules`:** Firebase → **Firestore Database** (ou **Firestore**) → **Regras**. Substitua todo o conteúdo pelo arquivo deste pacote e clique **Publicar**. Não use a regra geral com data de expiração. Essas regras devem estar ativas antes de publicar o novo site.
4. **Substitua no GitHub os arquivos do pacote**, preservando as pastas `js`, `lib` e `netlify/functions`. Arquivos da raiz: `index.html`, `dashboard.html`, `style.css`, `package.json`, `package-lock.json`, `netlify.toml`. Arquivos `js`: `incidents.js`, `login.js`. Arquivo `lib`: `retention-core.mjs`. Arquivo `netlify/functions`: `limpar-fotos.mjs`. Os testes em `tests` são opcionais para a hospedagem.
5. Netlify → **Deploys**: espere a publicação finalizar. Em **Functions**, procure `limpar-fotos`, identificada como agendada. A agenda está em UTC e roda diariamente às 03:17 UTC. Use **Run now** uma vez para começar a limpeza das fotos antigas e veja os logs. Uma foto pode ficar armazenada por algumas horas além dos 15 dias até a execução seguinte, mas a regra bloqueia a leitura após o prazo.
6. Teste com a conta de administrador: login, NOC, SAC, painel, exportação e seleção de tema. Depois teste com uma conta técnica de um estado: ela deve enxergar apenas os incidentes daquele estado, assumir um chamado, enviar foto e avançar uma etapa. Confira no Firestore uma coleção `fotos` com um documento separado e um `fotoIds` na etapa do incidente. Teste uma conta de SAC: ela consulta, mas não deve conseguir criar nem alterar um incidente.

## Criar um novo login (Firebase em português)

1. Firebase → **Authentication** → **Usuários** → **Adicionar usuário**. Digite o e-mail e uma senha temporária forte. Copie o **UID** exibido; não anote nem compartilhe a senha com terceiros.
2. Firebase → **Firestore** → **Dados** → coleção `usuarios` → **Adicionar documento**. O **ID do documento deve ser exatamente o UID**. Crie campos: `nome` (texto), `perfil` (texto), `estado` (texto), `ativo` (booleano `true`). Exemplo: `nome = Maria`, `perfil = tecnico`, `estado = SP`, `ativo = true`.
3. Perfis aceitos: `admin`, `gerente`, `diretor`, `noc`, `sac`, `suporte`, `tecnico` (minúsculas e sem acentos). Para técnico, `estado` precisa ser `SP`, `MG` ou `PR`. Para os outros, pode ser `TODOS`.
4. Passe ao funcionário o endereço do site e as credenciais por um canal privado. Para desligar o acesso, mude `ativo` para `false` e desative a conta em Authentication. Uma conta criada só em Authentication, sem documento ativo em `usuarios`, não entra.

## Limites e manutenção

O projeto está no plano Spark. Neste plano, Cloud Storage não é a opção para estes arquivos. Por isso, cada imagem é comprimida no navegador e armazenada temporariamente no Firestore; o limite configurado no código é cerca de 650 mil caracteres por foto. Isso é adequado como solução inicial de baixo volume, mas Firestore cobra/leva em conta leituras e armazenamento; muitos técnicos e fotos pedem outra arquitetura. A rotina agendada também depende da variável privada e dos limites do plano Netlify. Verifique periodicamente os logs de `limpar-fotos` e o tamanho da coleção `fotos`. Não apague incidentes para limpar imagens.

As permissões valem para novas leituras e gravações. Um usuário que já baixou uma foto ou exportou informações pode conservar uma cópia fora do sistema. O horário das fotos antigas é aproximado quando o registro histórico não tem um timestamp confiável; fotos antigas sem data reconhecível são removidas na primeira passagem da limpeza.
