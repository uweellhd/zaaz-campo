# Diretoria e economia de hospedagem

Revisão de 23/10/2026. Repositório: `uweellhd/zaaz-campo`.

## Lote do painel

- Aproveita os cinco gráficos e as métricas existentes. Não modifica permissões, atribuição, validação de etapas, retenção de fotos ou o formato dos relatórios.
- Gráficos passam a ter contêiner próprio com altura definida; no celular ficam em uma coluna. Estados e supervisores usam barras horizontais com quantidades. Nomes completos continuam disponíveis nas tabelas e nos tooltips.
- Rede mostra total, quantidades e percentuais. Progresso considera a última etapa enviada. A série de conclusões continua sendo a janela dos últimos sete dias, somente entre os chamados do recorte; a nota explica essa relação.
- Cada gráfico oferece tabela de dados. Fila vazia, falha no carregamento da biblioteca e ausência de registros têm mensagens próprias.
- Atalhos de 7, 30 e 90 dias preservam região, supervisor e base de data selecionada. Filtros aplicados podem ser removidos individualmente. PDF e CSV continuam usando o mesmo recorte dos indicadores.
- A indicação de atualização muda quando chega um snapshot, não a cada alteração local de filtro. Uma consulta pendente ou com erro é identificada no painel.
- Instâncias dos gráficos são reaproveitadas; os dados são atualizados sem recriar cinco gráficos a cada digitação. A troca de tema usa o atualizador de aparência existente, sem novas consultas ou gravações no Firestore.
- Os estilos ficam em `executive.css`, limitados à Diretoria. A renderização fica em `js/executive-charts.js`. Isso evita espalhar mais regras genéricas pelos estilos das telas operacionais.

## Correção de rascunho encontrada durante a revisão

Em `abrirBancoRascunhos`, a abertura do IndexedDB tentava registrar eventos em `transacao`, que só é criada na função de operações seguinte. Isso rejeitava a abertura e exibia a mensagem de falta de espaço mesmo em um navegador com armazenamento disponível.

A abertura agora resolve pelo sucesso do `IDBOpenDBRequest` e trata seu erro. As operações de escrita continuam aguardando a conclusão da transação, como antes. Nenhum rascunho existente é apagado e não há mudança de versão ou estrutura do banco local.

O teste de navegador preenche a etapa 3 de um rompimento atribuído, salva, recarrega e recupera o conteúdo. Em seguida altera o rascunho sem internet e consulta o IndexedDB após a transação. O mesmo reprodutor falha com a função anterior e passa com a correção. Ele usa somente contas e registros fictícios.

## Publicação em um único lote

O fluxo continua sendo: alterações na branch → revisão visual local → testes de lógica e navegador → permissões no emulador e navegador no GitHub → uma integração na `main` → conferência do commit efetivamente publicado.

O script do Netlify continua ignorando prévias e alterações internas. Não foram criados build hooks, publicações por arquivo ou novas consultas periódicas. Testes locais não consomem créditos de publicação do Netlify. Eles não comprovam por si só o acesso no endereço final.

## Alternativas para uma próxima etapa

Hospedagem entrega HTML, JavaScript, CSS e fontes. O Firebase continua responsável pelas contas, dados, fotos e arquivos OTDR. Trocar a hospedagem não aumenta a franquia do Firestore.

| Opção | Limites verificados nesta data | Aplicação ao Campo |
| --- | --- | --- |
| Netlify Free por créditos | 15 créditos por publicação bem-sucedida em produção; outros usos também consomem créditos | Manter publicações agrupadas enquanto estiver em uso |
| Cloudflare Pages Free | 500 builds/mês; requisições de arquivos estáticos gratuitas e ilimitadas; limites próprios para Functions | Primeira candidata, pois o Campo é estático e utiliza Firebase diretamente |
| Firebase Hosting Spark | 10 GB de armazenamento de versões e 10 GB/mês de transferência; no Spark, exceder limites pode bloquear novas publicações ou o acesso | Alternativa para concentrar gestão no Firebase; controlar versões retidas e tráfego |
| Vercel Hobby | Restrito a uso pessoal e não comercial | Não recomendado como solução gratuita para uma aplicação interna da empresa |

### Caminho proposto para Cloudflare Pages — futuro, não executado

1. Criar o projeto a partir do mesmo repositório, mantendo a versão atual disponível durante o teste.
2. Preparar uma pasta pública contendo somente arquivos necessários ao aplicativo. Não publicar testes, manutenção, configurações de regras ou dependências de desenvolvimento.
3. Traduzir e testar os cabeçalhos e bloqueios de caminhos. Não copiar cegamente `_redirects`: as regras de erro forçado do Netlify precisam ser verificadas na outra plataforma.
4. Autorizar o novo domínio no Firebase Authentication, quando necessário, e testar entrada, confirmação de e-mail e alteração de conta nesse domínio.
5. Conferir fotos, geolocalização, rascunhos e PDFs em computador e celular. Fazer o teste com o mesmo banco e permissões existentes, sem duplicar os registros.
6. Só depois de aprovado adotar o novo endereço. Rascunhos e preferências locais pertencem ao domínio do navegador; enviar rascunhos pendentes no endereço antigo antes da troca. A sessão pode precisar de um novo login no endereço novo.

Nenhuma conta foi criada, plano contratado ou migração realizada por este lote. A recomendação pode mudar se forem adicionadas funções no servidor ou integrações; elas têm franquias diferentes dos arquivos estáticos.

## Fontes oficiais

Consultadas em 23/10/2026:

- Netlify: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
- Cloudflare Pages, franquia de builds: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Pages, requisições estáticas: https://developers.cloudflare.com/pages/functions/pricing/
- Firebase Hosting, armazenamento e transferência: https://firebase.google.com/docs/hosting/usage-quotas-pricing
- Vercel Hobby: https://vercel.com/docs/plans/hobby
- Chart.js, contêiner responsivo: https://www.chartjs.org/docs/latest/configuration/responsive.html
- Chart.js, atualização de instâncias: https://www.chartjs.org/docs/latest/developers/api.html
