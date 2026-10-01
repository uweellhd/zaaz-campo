# Fluxo técnico obrigatório — decisões de 01/10/2026

Esta atualização substitui a decisão anterior de fotos opcionais nas etapas 1, 2 e 3. O técnico deve enviar as etapas em sequência. Somente a confirmação do banco libera a próxima. Não existe retorno para editar uma etapa já enviada. Voltar à lista continua disponível, sem apagar o atendimento.

## O que preencher

| Etapa | Informações e evidências necessárias |
|---|---|
| 1 — Deslocamento | Pelo menos uma foto/print do deslocamento, tipo de área e condição de risco. Ajudantes são opcionais e escolhidos entre cadastrados. Transferência continua disponível antes do envio. |
| 2 — Chegada | Pelo menos uma foto do local, uma do rompimento, causa do rompimento e previsão de restauração. Causa ainda desconhecida pode ser registrada como “Em apuração”. |
| 3 — Atuação | Pelo menos uma foto do técnico atuando, uma da fusão e observação da atuação. Se não houver informação adicional, preencher “Sem observações adicionais”. Nova previsão é opcional; quando preenchida, exige motivo e preserva a anterior. |
| 4 — Finalização | Pelo menos duas caixas, cada uma com GPS e uma foto; até 12 caixas. Preencher CAUSA, SOLUÇÃO e OBSERVAÇÃO no roteiro que aparece dentro do campo final. Nenhum dos três títulos pode ficar vazio. |

Roteiro do campo final:

```text
CAUSA: 

SOLUÇÃO: 

OBSERVAÇÃO: 
```

A causa preenchida na etapa 2 entra no roteiro. O técnico completa e confere o registro final. O texto é normalizado antes do envio; os três campos também ficam separados em `registroFinal`. Projetos recebe somente a entrega final, incluindo todas as fotos das caixas.

## Várias fotos e uso no celular

Cada categoria e cada caixa aceita de 1 a 6 fotos. O técnico pode selecionar várias juntas ou usar o campo novamente para acrescentar outras, inclusive uma por vez com a câmera. As prévias oferecem remoção antes de enviar. Remover uma foto não apaga outras já selecionadas.

As imagens são comprimidas em JPEG e recebem a marca de identificação. Cada foto continua em seu próprio documento do Firestore; o incidente guarda referências. A retenção de 15 dias permanece. Mais fotos consomem mais gravações, espaço e conexão: não é armazenamento ilimitado.

O rascunho continua no IndexedDB do aparelho, inclusive fotos múltiplas. Sem conexão, não é possível avançar para uma etapa ainda não confirmada no banco. Ao recuperar a conexão, tocar em enviar. A sincronização automática permanece futura. O rascunho de outro aparelho não é recuperado automaticamente.

## Sequência, histórico e compatibilidade

- Novos envios usam `fluxoVersao: 2`, `numeroEtapa`, `tecnicoUid`, `gruposFotos` e o contador `etapaConcluida`.
- O banco permite somente a próxima etapa, adicionando um evento ao fim. O técnico não pode remover ou editar eventos enviados, repetir etapa ou saltar etapas.
- As fotos novas têm `numeroEtapa`, para vincular a evidência ao envio correto.
- Cada caixa final guarda `indiceFoto` e `quantidadeFotos`, para identificar sua faixa na lista de fotos. Entregas antigas sem quantidade continuam mostrando uma foto por caixa.
- Revisão de prazo registra previsão anterior, previsão revisada e motivo na etapa 3. Não substitui o fato histórico da previsão inicial.
- Finalização e entrega para Projetos são confirmadas na mesma transação. As fotos são carregadas antes, em documentos próprios; uma tentativa não concluída pode deixar fotos sem entrega, removidas pela retenção. Durante a sessão, a repetição da mesma tentativa reutiliza os uploads já concluídos.
- Histórico antigo é preservado. Um ID que já tem etapa registrada continua na próxima etapa; não é reiniciado nem obrigado a refazer fotos antigas. Casos antigos incoerentes ou fora de ordem precisam de revisão administrativa.
- Regras administrativas existentes continuam; a interface normal exige a sequência mesmo no acesso administrativo. Correções excepcionais de registros devem ser tratadas com critério, sem apagar o histórico.

## Testes necessários

Validação de campo: fotos por categoria, limite de seis, todas as caixas com GPS/foto, roteiro completo e avanço sequencial. Segurança: bloqueio de salto, recuo, repetição, edição de histórico, usuário indevido, revisão sem motivo e entrega final incompleta. Fluxo de acompanhamento: SAC recebendo etapas ao vivo, Projetos recebendo todas as fotos finais e rascunho recuperado no mesmo aparelho. Conferir em celular real câmera, GPS, conexão intermitente e retomada após transferência.

## Integração futura 1 — IDs vindos do grupo do WhatsApp

A origem foi confirmada: um grupo recebe automaticamente os comunicados que o NOC usa. A integração ainda não está implementada. O planejamento anterior do número direto é uma alternativa de contingência, e não captura automática do grupo.

Primeiro investigar o sistema que produz a mensagem automática. Se ele puder enviar a mesma informação para uma API/webhook do NEXTFLOW, obteremos o comunicado na origem, sem depender da leitura do grupo. Se não houver essa possibilidade, verificar com o provedor oficial a elegibilidade e o acesso a esse grupo específico. Não prometer acesso aos grupos atuais apenas por conectar um número.

A entrada deve validar origem/remetente, deduplicar a mensagem e localizar o incidente por chave confirmada com o NOC. Mensagem completa e inequívoca pode ser aprovada automaticamente após piloto; casos incompletos ou ambíguos passam por revisão. A devolutiva do NOC não sobrescreve a etapa técnica. Nome de pessoa digitado na mensagem não concede acesso nem atribuição.

## Integração futura 2 — etapas enviadas ao sistema da empresa usado pelo NOC

Nome, fornecedor, documentação da API e autorização de acesso ao sistema ainda não foram informados. Não existem envios nem credenciais configuradas. Precisamos conhecer o campo do ID/OS, os estados aceitos, o endpoint de atualização e se haverá suporte a anexos e retorno de confirmação.

Proposta: após confirmar cada etapa no NEXTFLOW, registrar um evento numa fila persistente de integração (outbox). Um serviço no servidor envia ao sistema da empresa, respeitando ordem, idempotência e tentativas. A fila não deve depender de o técnico continuar com o navegador aberto.

Contrato inicial proposto:

```json
{
  "versao": 1,
  "eventoId": "identificador-unico",
  "incidenteIdInterno": "referencia-do-nextflow",
  "idExterno": "id-do-sistema-da-empresa",
  "os": "ordem-de-servico",
  "uf": "SP",
  "etapa": 3,
  "tecnicoUid": "usuario-aprovado",
  "enviadoEm": "horario-confirmado-no-servidor",
  "observacao": "devolutiva-do-tecnico",
  "previsaoAnterior": "previsao-inicial",
  "previsaoRevisada": "nova-previsao-se-houver",
  "motivoRevisao": "justificativa-se-houver",
  "evidencias": ["referencias-restritas-das-fotos"]
}
```

É uma especificação futura, não um endpoint ou arquivo de código pronto. Os dados serão adaptados à API real. As referências de fotos não devem ser links públicos. Antes de enviar anexos para outro sistema, combinar a retenção e a responsabilidade pelas cópias: excluir no NEXTFLOW após 15 dias não exclui automaticamente no sistema da empresa.

Estados previstos da fila: PENDENTE, ENVIANDO, CONFIRMADO e ERRO. Exibir horário e confirmação do sistema externo. Falha externa não apaga a etapa salva no NEXTFLOW; ficará como pendência de sincronização. Repetição não pode gerar duas atualizações iguais. Atualização recebida de volta da empresa não deve entrar em ciclo de reenvio.

## Como retomar

1. Concluir o piloto do fluxo obrigatório com técnico e SAC.
2. Identificar quem/sistema gera a mensagem automática no grupo e fornecer exemplos sem dados sensíveis.
3. Informar o nome do sistema do NOC e obter documentação da integração com o responsável da empresa.
4. Mapear IDs, etapas, previsões e permissões; iniciar com dados fictícios e somente texto.
5. Implementar a fila, os receptores e a confirmação; testar falha, repetição e ordem antes da ativação.
6. Ativar gradualmente e acompanhar pendências, custos e retenção.

Não contratar serviços nem inserir chaves no navegador. As duas integrações permanecem FUTURAS e serão ativadas somente após configuração e teste.
