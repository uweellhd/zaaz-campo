# Etapa 1 — Acompanhamento, coordenação e relatórios

Implementação de 20/10/2026. Este documento descreve a regra atual e substitui as descrições anteriores de acesso de Projetos e Coordenação em Medições.

## O que permanece depois de concluir

Concluir o reparo ou a coleta não exclui o atendimento. Admin e Diretoria consultam ativos, concluídos e todos na visão da operação. Medições mantém as situações de coleta e conferência no histórico. O técnico continua recebendo apenas o trabalho que precisa executar; uma coleta concluída sai da rota dele.

Em Projetos, etapa 4 de Rompimentos e os dois POPs completos de Medições continuam disponíveis depois do tratamento. Há filtros de recebimento/tratamento, situação e busca por referência/responsável. Confirmações finais são preservadas: a tela deixa de oferecer edição da confirmação já registrada. Correções posteriores devem ser tratadas por um fluxo de adendo, a definir, sem reescrever a auditoria silenciosamente.

Fotos permanecem por 15 dias após cada envio. A rotina de retenção remove somente imagens, preservando etapas, coordenadas, descrições, responsáveis e datas. Os arquivos OTDR/PDF seguem a guarda já existente. Esta etapa não configura backup externo nem habilita cobrança; a expansão continua exigindo orçamento, capacidade e uma política de backup aprovada.

## Como configurar os coordenadores — Admin

1. Entrar no menu do próprio nome → **Gerenciar acessos**.
2. Localizar a conta já aprovada e selecionar **Coordenador de Operações** ou **Coordenador de Projetos** em Função.
3. Para Operações, marcar os supervisores da equipe no quadro **Supervisores desta coordenação** e clicar **Salvar acesso**. Até 30 supervisores por cadastro nesta versão, correspondendo ao limite da consulta agrupada. Para equipes maiores, ampliar a estratégia de consulta antes de cadastrar mais vínculos.
4. Para Projetos, salvar o cargo. Este coordenador acompanha todos os profissionais de Projetos, sem vínculo regional ou lista de supervisores.
5. Pedir que a pessoa entre novamente. Mudanças de função ou equipe encerram a sessão para renovar as consultas. Nenhum usuário foi promovido automaticamente nesta atualização.

O perfil técnico `coordenador` é preservado para representar Coordenador de Operações; ganha escopo obrigatório por `supervisoresUids`. Cadastros antigos sem vínculos deixam de consultar globalmente até o Admin configurar a equipe. `coordenador_projetos` é o novo perfil de supervisão da área. Outros cargos não podem possuir vínculos de coordenação. Somente o Admin modifica os vínculos.

## Permissões

| Perfil | Acompanhamento | Execução / tratamento | Relatórios |
|---|---|---|---|
| Admin | Toda a operação, histórico e Projetos | Funções administrativas existentes, coleta e tratamento | Operação e Projetos |
| Diretor / Gerente | Toda a operação e histórico | Somente leitura | Rompimentos e Medições; ficha de rompimento inclui a situação de Projetos disponível |
| Coordenador de Operações | Somente incidentes e medições dos supervisores vinculados | Abre Medições para esses supervisores; não executa coleta, distribui técnicos nem confere Projetos | Sua coordenação, com detalhe por supervisor |
| Projetos | Acompanhamento operacional ao vivo, Rompimentos e Medições | Recebe e trata apenas etapa 4 ou POPs 1+2 completos | Entregas da área |
| Coordenador de Projetos | Toda a área de Projetos e acompanhamento ao vivo | Atribui responsáveis pelo tratamento; não confirma como analista | Toda a equipe de Projetos |
| NOC / SAC / Suporte | Acompanhamento operacional de Rompimentos e Medições | Permissões anteriores do NOC preservadas; sem coleta/conferência de Medições | Sem exportação nesta área de consulta |
| Supervisor | Sua equipe e seus registros | Distribuição existente | Sem novo acesso global |
| Técnico | Suas demandas atribuídas | Fluxos de campo existentes | Sem acesso administrativo |

A antiga aba **SAC / Suporte** se chama **Acompanhamento**, com título Acompanhamento operacional. Projetos encontra ali a evolução em tempo real. A aba **Projetos** continua sendo a fila de entregas completas. Esses acessos são distintos: ver POP 1 não coloca uma medição na fila de conferência.

O escopo de Operações é aplicado em consultas e regras do Firestore, incluindo fotos e arquivos; não é apenas uma ocultação na tela. Coordenador sem vínculo não dispara uma consulta global. Os registros usam UID para autorização; nomes servem à apresentação.

## Responsabilidade em Projetos

Nas entregas pendentes, o analista pode **Assumir tratamento**. Admin e Coordenador de Projetos podem atribuir a um analista ativo. A atribuição registra responsável, data, usuário e nome de quem atribuiu. Não é possível tomar para si um trabalho já atribuído a outro analista; a coordenação/admin deve redistribuir antes da confirmação.

Assumir não cria uma segunda etapa obrigatória: a confirmação direta de entrega ainda não atribuída continua registrando quem efetivamente tratou, preservando a leveza do fluxo anterior. Depois de tratada/conferida, não se reatribui nem se reescreve o tratamento. O técnico e os demais leitores não podem alterar esses campos.

O painel e o PDF distinguem **responsável atribuído** de **quem confirmou**. Pendentes são agrupados pelo primeiro; tratadas pelo segundo. Tempos são corridos entre recebimento e confirmação; não representam SLA, carga ponderada ou ranking de produtividade. Atribuições mostram o último responsável; não foi criado um histórico de redistribuições nesta etapa.

## Fotos de Medições

Somente a marca visual de novas fotos de Medições perde a hora. Permanecem data de registro (Brasília), técnico, NEXTFLOW/ZAAZ, POP e coordenadas. Abertura, envio de POP 1, envio de POP 2, atribuições e conferência continuam com data/hora no sistema. Rompimentos mantém a marcação anterior. Imagens já gravadas não foram reprocessadas ou alteradas; rascunhos com fotos anteriormente marcadas preservam essas imagens.

## Relatórios

Todos usam composição A4 compartilhada, fonte DejaVu Sans incorporada em subconjunto latino, cabeçalho NEXTFLOW/ZAAZ, escopo, responsável pela emissão, critérios, tabelas paginadas e rodapé numerado. As fontes locais são carregadas somente ao exportar; nenhum dado é enviado a outro serviço para gerar PDF.

- **Rompimentos:** resumo executivo, andamento, causas informadas, distribuição por estado, carteira por supervisor, etapas ativas, conclusões recentes, inventário e ficha com linha do tempo, previsão/revisões, localização, caixas e situação de Projetos quando disponível. Pode recortar por abertura ou conclusão técnica.
- **Medições:** separa aguardando técnico, POP 1 pendente, POP 2 pendente, coleta completa e conferência; mostra distribuição, supervisor, fichas de ambos os POPs, fibras informadas, coordenadas, envios, observações e metadados dos arquivos recebidos. Recorte por abertura ou entrega técnica do POP 2.
- **Projetos:** relatórios próprios de Rompimentos e Medições, com recebidas, pendentes, tratadas, não atribuídas, mediana de tratamento, maior espera conhecida, acompanhamento por analista, inventário e ficha. Recorte por recebimento ou tratamento na área.

Não há inferência de aprovação óptica, distância, perdas, qualidade ou disponibilidade de fibra a partir dos arquivos. Conferência registrada é distinta de aprovação técnica da fibra. A integridade dos originais continua verificada no download; o PDF apresenta seus metadados e não interpreta curvas.

As datas ausentes ou intervalos negativos são excluídos dos cálculos de tempo; não viram zero. Percentuais informam o denominador, e recortes vazios não recebem taxa estimada. A pesquisa e os filtros da tela alimentam o PDF. O filtro de situação da lista de Rompimentos não altera os indicadores nem o relatório consolidado; o cabeçalho explica que inclui ativos e concluídos no recorte.

**Incluir fotos disponíveis** é opcional e desmarcado por padrão. O limite é 120 referências fotográficas por relatório; acima dele, reduzir o recorte ou exportar sem fotos. O gerador usa cópias reduzidas para o documento, preservando a imagem no banco. Fotos indisponíveis não são substituídas por exemplos; a indisponibilidade é informada. O envio de fotos e a retenção de 15 dias não foram alterados.

## Validação e publicação

Testes unitários verificam escopo vazio, data sem hora na foto, períodos por abertura/conclusão, ausência de datas e métricas de tratamento. Regras reais no emulador verificam consultas da própria equipe, negação de outras equipes, revogação de vínculos, leitores, arquivos, fotos vencidas, atribuição e imutabilidade das confirmações, além das etapas técnicas existentes.

O navegador usa Firebase simulado e perfis fictícios: Admin, Diretoria, Operações, Projetos, Coordenação de Projetos e Técnico. Inclui acesso ao histórico, acompanhamento, distribuição de responsabilidade, conferência, fotos ampliadas, relatórios, marca da foto, temas e celular. PDFs são renderizados e conferidos, inclusive anexos opcionais, textos longos, quebras de tabela e recortes vazios. Nenhum dado fictício é inserido no banco real.

Publicar uma atualização consolidada pela integração GitHub/Netlify. Confirmar sucesso da etapa **Publicar** do workflow de regras do Firebase e do deploy de produção antes de anunciar disponibilidade.

Os testes de navegador ficam em `tests/browser/stage-one.cjs`. Para reproduzir: `npm ci --prefix tests/browser`, `npx --prefix tests/browser playwright install chromium` e `npm test --prefix tests/browser`. Em ambiente com Chromium próprio, informar `CHROMIUM_PATH`. O teste intercepta o SDK do Firebase e usa exclusivamente um banco fictício em memória; artefatos de conferência são gerados em `tests/browser/artifacts/`, fora do versionamento.
