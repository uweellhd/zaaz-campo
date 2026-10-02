# Equipes, fotos e resolvidos — 02/10/2026

Esta atualização responde aos testes de Wellington no laboratório e no celular. O fluxo obrigatório de quatro etapas, a transmissão ao vivo de cada envio e a retenção das fotos por 15 dias continuam vigentes. A autenticação permanece corporativa e depende de aprovação.

## Como operar, sem alterar códigos

1. O administrador aprova as contas em sua seta de usuário → Gerenciar acessos. Use os perfis Supervisor e Técnico conforme o cargo. O estado agora é referência geográfica; não bloqueia um técnico de atender um chamado atribuído em outra UF.
2. Em Supervisão → Gerenciar equipe de técnicos, o supervisor seleciona técnicos já aprovados. O admin pode escolher qualquer supervisor e montar/transferir sua equipe. Cada técnico tem uma equipe principal. Um supervisor não pode tomar o técnico de outro supervisor; essa transferência é administrativa.
3. O NOC publica o comunicado. O nome recebido é preservado. Se o comunicado não trouxer um identificador IXC reconhecido, NOC → Conferir responsável permite confirmar a conta do supervisor. Não criar vínculos por aproximação de nomes.
4. O supervisor recebe os IDs vinculados ao seu UID. Em cada ID aberto, escolhe um técnico de sua equipe e toca em Acionar técnico. Só então o ID passa a aparecer na conta do técnico.
5. O técnico envia cada etapa e aguarda a confirmação antes de avançar. A etapa 2 usa data e horário de restauração, sem valores vagos como `1` ou `2 horas`. Na etapa 3, mantém uma observação da atuação e, opcionalmente, revisa data/hora. O motivo vai na mesma observação e é preservado no registro da revisão.
6. Supervisor e diretoria usam Em andamento / Resolvidos. A diretoria tem comparação de ativos/resolvidos por supervisor, progresso por etapa e conclusões diárias dos últimos sete dias. O gráfico diário inclui casos com data da etapa 4, não atribui uma data fictícia a registros antigos.
7. Em qualquer consulta ou no laboratório, toque na miniatura para ampliar. O visualizador oferece foto anterior/próxima, Ampliar/Ajustar e Fechar. Escape fecha primeiro a foto, mantendo o ID aberto. Imagens aparecem na ordem do envio e identificadas por categoria/caixa.

## Cadastro do identificador IXC

Em Gerenciar acessos → Identificadores únicos do IXC, o administrador registra o número exato do usuário supervisor no IXC e a conta correspondente no NEXTFLOW. A coleção `identidadesIxc/{idIXC}` evita dois vínculos diferentes sob a mesma chave. O nome legível não concede acesso.

O leitor atual de comunicados reconhece os campos explícitos `ID USUÁRIO IXC`, `ID USUARIO IXC` e `ID SUPERVISOR IXC`. Exemplo fictício:

```text
ID INCIDENTE: 12345
RESPONSÁVEL: Nome recebido no comunicado
ID USUÁRIO IXC: 789
```

Não confundir usuário IXC com incidente ou OS. A leitura automática do grupo do WhatsApp e a API do IXC não foram ativadas. Para adaptar o formato real, obter um comunicado de exemplo e confirmar qual campo contém esse usuário. Sem esse campo, confirmar o responsável manualmente. Cadastrar o identificador não migra silenciosamente todos os IDs antigos.

## Dados e acesso

- `equipesTecnicas/{tecnicoUid}`: equipe principal, ativo, supervisorUid, data/ator da alteração. Supervisores podem ativar/desativar integrantes da própria equipe. Admin pode transferir. Desativar a associação não apaga o técnico nem redistribui chamados já atribuídos.
- `incidentes.supervisorUid`: dono da fila do supervisor. `supervisorNome` ajuda a leitura; `responsavel` preserva o comunicado. `ixcUsuarioId` e origem do vínculo identificam a integração futura.
- `tecnicoUid`: controla a leitura e o envio do técnico, independentemente de estado. Supervisor só atribui o próprio ID, aberto, a técnico ativo de sua equipe. O servidor valida isso; esconder menus não é a proteção única.
- A atribuição guarda `atribuidoPorUid`, `atribuidoPorNome` e `atribuidoEm`. É o último vínculo, não uma trilha imutável de todas as transferências; essa auditoria permanece futura.
- Transferência realizada pelo técnico é restrita a colegas ativos da equipe vinculada ao ID. Um técnico que muda de equipe continua vendo IDs ainda atribuídos a ele até redistribuição, mas pode precisar do supervisor para nova transferência.
- NOC confirma supervisor e edita o comunicado; não usa o caminho normal para distribuir técnicos ou forjar etapas. Admin mantém capacidade de correção excepcional.
- SAC e Suporte veem consulta; supervisor vê Supervisão; técnico vê Técnico; Projetos vê Projetos; gerente/diretor veem Diretoria. NOC mantém operação e consulta. Admin vê todos. Minha conta fica no menu pessoal de cada perfil.
- Fotos novas mantêm nome da conta, data e hora na marca d'água, organizada em linhas para preservar a leitura em imagens estreitas. Fotos enviadas antes não são reescritas.

## Galerias e desempenho

O módulo compartilhado `lib/photo-viewer.mjs` atende prévias, histórico, Projetos e laboratório. Carregamento paralelo preserva ordem por posição dos IDs; respostas lentas não misturam caixas. Fotos expiradas/indisponíveis recebem aviso. A retenção permanece em 15 dias, e o registro textual não é apagado.

Listas da supervisão e diretoria renderizam 24 cartões por vez com Carregar mais. Isso reduz o peso visual/DOM, mas os listeners dessas áreas ainda consultam o conjunto pertinente de registros. Não confundir paginação visual com paginação de consultas. Agregados de banco, paginação do servidor e teste de escala para 9 mil IDs continuam futuros.

Os gráficos usam Chart.js 4.5.1 fixado, com integridade conferida. Nenhuma integração externa adicional foi ativada. A animação existente de fibra foi mantida; movimento reduzido é respeitado.

## Validação

Dez testes de campo/retenção e 21 testes no emulador Firestore passaram. Incluem equipes, isolamento de setores, atribuição entre estados, bloqueio de técnico externo/inativo, proteção da identidade IXC, sequência obrigatória e finalização com 12 caixas/72 referências de fotos.

Navegador: formulário de produção com Firebase substituído por dados fictícios locais, quatro etapas, fotos reais de teste, supervisor → técnico de outra UF, revisão com observação única, foto ampliada nos quatro setores, navegação da galeria e resolvidos. Laboratório também percorreu NOC, Supervisor, Técnico, SAC, Projetos e Diretor. A largura móvel foi conferida em 390 pixels. Isso não substitui uso de contas/câmera/GPS e conexão reais no piloto.

## Próximo piloto

Testar uma conta real de supervisor e técnico, cadastrar a equipe, confirmar o responsável de um ID de teste e distribuir. SAC observa o ID aberto enquanto o técnico envia cada etapa. Finalizar e conferir Resolvidos, gráficos e entrega em Projetos. Testar ainda troca de conexão e retomada do rascunho. Preservar chamados reais e evitar repetir a publicação para ajustes individuais.

## Futuro próximo

Recepção de IDs preferencialmente na origem do comunicado/IXC, com webhook autenticado, deduplicação e identificadores únicos. Envio das etapas ao sistema da empresa por fila persistente no servidor, com ordem, confirmação e tentativas. Requer documentação/API/permissões e exemplos reais; não há credenciais, receptor de grupo ou sincronização externa configurados nesta versão. Ver [plano anterior](fluxo-tecnico-v2.md).
