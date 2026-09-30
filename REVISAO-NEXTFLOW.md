# NEXTFLOW · revisão operacional

Este documento guarda as decisões desta revisão do sistema interno da ZAAZ. O site continua identificado como NEXTFLOW.

## Navegação e consulta

- O menu da conta contém o nome completo, Minha conta, Gerenciar acessos (admin), aparência e Sair. O menu principal contém só áreas operacionais.
- O painel gera regiões a partir dos dados, mantém a opção Todos e oferece as 27 UFs na atribuição de perfis. NOC reconhece siglas de UF no texto; quando não houver estado explícito, ainda aplica SP como padrão legado. Confira a UF antes de publicar um comunicado fora de SP.
- SAC continua somente leitura, com busca exata por ID/OS e páginas de 24; o modal fecha pelo X, Escape ou clique no fundo.
- O painel executivo ainda lê a coleção inteira para montar gráficos e CSV. Para a operação crescer a milhares de IDs, consolidar contadores no servidor e criar exportação paginada antes de importar em massa.

## Campo, supervisão e Projetos

- O técnico só vê os IDs atribuídos ao seu UID. Pode selecionar colegas cadastrados e ativos, registrar área urbana/rural e condição de risco, ou transferir a outro técnico cadastrado do mesmo estado.
- Etapas 1–3 permitem envio sem foto. O evento grava a quantidade de fotos faltantes e o painel do supervisor totaliza essas pendências nos seus IDs. A etapa 2 exige previsão. O botão Voltar permite consultar campos anteriores; se reenviar uma etapa, gera novo evento, e o indicador considera o evento mais recente daquela etapa.
- A etapa 4 exige descrição, no mínimo duas caixas, foto e GPS capturado de cada uma. Cada caixa adicional também é obrigatória. O registro encaminhado a Projetos contém só ID, OS, estado, fotos das caixas, coordenadas, descrição e status de lançamento no OZmaps. O perfil Projetos não recebe leitura dos incidentes completos.
- Fotos continuam sujeitas à exclusão após 15 dias. O texto, as coordenadas e o registro da entrega continuam; a tela de Projetos informa quando a foto expirou. Projetos marca o lançamento no OZmaps manualmente, sem integração com o serviço.
- O formulário técnico guarda um rascunho no IndexedDB **do mesmo navegador e aparelho**, incluindo fotos comprimidas. Ao recuperar a conexão, o técnico deve abrir o atendimento, conferir o rascunho e tocar no botão de envio da etapa. O aviso de rascunho não significa que o Firestore recebeu o registro. A navegação anônima, limpeza de dados do navegador e troca de aparelho podem remover o rascunho. Se o armazenamento local estiver cheio, o sistema avisa.

## Entrada automática de comunicados do NOC

A origem das mensagens ainda não foi informada. Não há captura automática ativa. Para construir essa função com segurança:

1. Escolher o sistema emissor e obter acesso autorizado a uma API, webhook ou caixa corporativa, com exemplos reais e formatos de incidente, atualização e encerramento.
2. Executar um receptor autenticado no servidor, sem credenciais no navegador; validar a assinatura/origem, limitar frequência e registrar falhas.
3. Extrair ID, OS, UF, cidade, status, horário e previsão; manter campos ausentes como pendentes para revisão NOC, sem inventar valores.
4. Usar o identificador da mensagem e o ID do incidente para evitar duplicação. Mostrar prévia e trilha de auditoria de cada criação/atualização.
5. Testar com mensagens reais anonimizadas antes de permitir publicação automática. O formulário atual continua como caminho manual.

## Publicação e conferência

Publicar uma vez o código no Netlify via merge no ramo principal. Validar as regras pelo GitHub Actions, depois publicá-las. Antes de criar um perfil Projetos, publicar as regras correspondentes. Conferir admin, NOC, SAC, técnico, supervisor e Projetos com contas distintas. Testar offline no mesmo aparelho e depois enviar ao Firestore. Não considerar um rascunho local como conclusão do atendimento.
