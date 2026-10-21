# Notificações e publicação em lote

Atualização: 21/10/2026.

## Uso das notificações

O sino fica ao lado da conta, para perfis que recebem trabalho. O contador indica avisos ainda não dispensados neste navegador, limitado aos 100 avisos mais recentes da fila.

| Perfil | Recebe |
| --- | --- |
| Administrador | Pedidos de acesso pendentes e atendimentos atribuídos à própria conta para teste real |
| Supervisor | Rompimentos e medições ativos vinculados à sua supervisão |
| Coordenação de Operações | Registros ativos dos supervisores vinculados à sua coordenação |
| Projetos | Etapas finais de rompimentos e medições entregues, livres ou atribuídas ao próprio analista |
| Coordenação de Projetos | Entregas pendentes de toda a equipe de Projetos |
| Técnico | Rompimentos e medições em andamento atribuídos ao próprio usuário |

Diretoria, NOC, SAC e Suporte mantêm as telas existentes de observação e operação. Esta versão não acrescenta consultas globais para disparar avisos para esses observadores. O encaminhamento ao NOC por integração externa continua no planejamento anterior.

Ao entrar no site, pendências já existentes aparecem silenciosamente no sino. Novas entradas, com a página aberta, mostram um aviso por até dez segundos no canto inferior. Um lote de chegadas é agrupado. A confirmação de uma etapa pelo técnico não é uma nova atribuição e não repete o aviso para ele.

Clicar em um aviso abre a área e o serviço correspondentes (a fila; não abre automaticamente o registro). Não é preciso marcar como lido. O botão × dispensa um aviso; Limpar avisos limpa os até 100 apresentados. Nenhuma dessas ações conclui, exclui ou modifica a OS ou o pedido de acesso.

As chaves de dispensa ficam separadas por UID e perfil no armazenamento do navegador, com limite de 2.000. Não guardam nomes, e-mails, fotos ou senhas. A dispensa é compartilhada entre abas do mesmo navegador, mas não sincronizada entre dispositivos. Se o armazenamento for apagado, avisos pendentes podem reaparecer. Ao atingir o limite, chaves antigas podem sair do histórico local.

São avisos internos enquanto o site está aberto. Não são notificações push com o navegador fechado, WhatsApp ou e-mail. Com internet interrompida, não é possível garantir a chegada de novos avisos; a fila é atualizada ao reconectar. O carregamento inicial é silencioso. Se havia dados em cache, uma chegada nova confirmada pelo servidor pode gerar aviso; os registros já presentes não são repetidos.

## Segurança e custo de execução

- Consultas respeitam o mesmo UID, equipe e função usados no sistema. Coordenação sem supervisores não faz consulta global.
- Os listeners usam o compartilhador existente: consultas idênticas não abrem uma conexão extra por componente. Não há polling nem gravação periódica de notificações no Firestore.
- A fila usa metadados; não baixa imagens nem arquivos OTDR.
- Snapshots sem mudança nos avisos não reconstroem o painel. A renderização fica limitada a 100 itens e o formatador de data é reaproveitado.
- Os listeners e temporizadores são encerrados na saída, na troca de usuário e na invalidação do perfil. Um erro na fila de avisos é mostrado no sino, sem interromper o preenchimento técnico.
- Não foi alterada regra de acesso, retenção de fotos, validação de etapas ou distribuição de OS.

Consultas adicionais para filas ainda não abertas têm custo de leitura do Firestore. Compartilhar consultas reduz duplicação; não torna a leitura gratuita. Acompanhamento real de consumo depende dos painéis do Firebase e do Netlify.

## Publicar uma vez por lote

O trabalho deve seguir esta ordem:

1. Reunir as alterações solicitadas em uma única branch.
2. Implementar, revisar visualmente e testar localmente com dados fictícios.
3. Abrir um único pull request para o lote e aguardar as verificações do GitHub.
4. Corrigir eventuais falhas na mesma branch; não integrar ajustes parciais na main.
5. Integrar uma única vez para gerar a publicação em produção.
6. Conferir qual commit ficou publicado, sem forçar republicações repetidas.

O `netlify.toml` usa `maintenance/netlify-build-ignore.mjs` para ignorar Deploy Previews e branch deploys. Testes continuam no GitHub. Mudanças somente em documentação, testes, manutenção, regras e índices do Firebase não republicam os arquivos do site. A publicação das regras do Firebase continua pelo workflow próprio.

Se HTML, CSS, JavaScript, imagens, bibliotecas ou configuração do Netlify mudarem, produção continua normalmente. Sem referência Git válida para comparação, o script permite a publicação por segurança. Comando de build, diretório público e integração atual não são substituídos.

Essa regra funciona quando o Netlify lê a configuração no repositório vinculado. Envios manuais de pasta/ZIP ou deploys via API/CLI podem não executar a verificação. A documentação também informa que build hooks não são cancelados pelo comando ignore.

Nos planos por créditos, a documentação consultada informa 15 créditos por publicação bem-sucedida em produção; Deploy Previews e branch deploys não têm essa cobrança de publicação. Portanto, a economia principal é reduzir o número de versões efetivamente publicadas em produção. Tráfego e requisições continuam sujeitos ao plano contratado.

Fontes oficiais consultadas em 21/10/2026:

- https://docs.netlify.com/build/configure-builds/ignore-builds/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/

## Conferência desta atualização

Testar chegada de pedido de acesso com a lista fechada, atribuição a técnico, entrega a Projetos, reatribuição para outro analista, limpeza sem alterar registro, celular a 320 px, temas, teclado e encerramento de sessão. Conferir o histórico do deploy antes de anunciar que a versão está disponível.

Para reverter apenas as notificações, reverter o commit do lote. Para permitir novamente as prévias do Netlify, remover o atributo `build.ignore` do `netlify.toml` em uma alteração revisada.
