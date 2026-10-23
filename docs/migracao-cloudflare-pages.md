# Migração do Campo para Cloudflare Pages

Preparação em 23/10/2026. Repositório: `uweellhd/zaaz-campo`.

## O que está preparado

O comando `node maintenance/preparar-pages.mjs` gera a pasta `maintenance/pages-public`. Ela contém a aplicação, os gráficos, as fontes dos relatórios, ícones e laboratório. Não contém testes, manutenção, documentos internos, regras/índices do Firestore, credenciais de servidor ou configurações do Netlify.

A lista de arquivos públicos é validada antes de gerar o pacote. Recursos locais ausentes, links simbólicos e arquivos acima de 25 MiB interrompem o preparo. O script não modifica os arquivos originais da aplicação.

Os cabeçalhos CSP, proteção contra iframe, câmera e geolocalização são preservados. As regras de cache dos HTML cobrem tanto `/dashboard.html` quanto a rota canônica `/dashboard`, além de acesso, laboratório e página de erro. O arquivo público `/version.json` informa o commit de origem para conferência da publicação, sem dados de usuários.

As regras `404!` específicas do Netlify não são copiadas. Os caminhos internos não existem no pacote e o `404.html` da raiz mantém a resposta de página não encontrada do Pages, sem transformar tudo no login. O CSS da página de erro usa caminho absoluto para funcionar em URLs aninhadas.

## Entrar na Cloudflare e criar o projeto

Use a própria conta da Cloudflare. Se precisar criar uma conta, o titular deve concluir o cadastro e aceitar os termos. Não compartilhar senha, códigos ou tokens em conversa.

No painel da Cloudflare, abra a criação de uma aplicação **Pages**, conectada ao GitHub. Escolha somente o repositório `uweellhd/zaaz-campo` ao autorizar a integração. Não é necessário conceder acesso a todos os repositórios.

Preencha a configuração:

| Campo no painel | Valor |
| --- | --- |
| Nome do projeto | `zaaz-campo` se estiver disponível; a Cloudflare informará o endereço final |
| Production branch / Branch de produção | `main` |
| Framework preset / Predefinição | `None` / Nenhum |
| Build command / Comando de compilação | `node maintenance/preparar-pages.mjs` |
| Build output directory / Diretório de saída | `maintenance/pages-public` |
| Root directory / Diretório raiz | Manter a raiz do repositório, sem subpasta |
| Variável `NODE_VERSION` | `22` |
| Variável `SKIP_DEPENDENCY_INSTALL` | `1` |

As duas variáveis de compilação acima não são segredos. O pacote não precisa instalar bibliotecas npm. Os SDKs, Firebase e dados já estão configurados como antes. Não é preciso contratar banco da Cloudflare, habilitar Functions, informar cartão ou copiar credenciais de servidor para o Pages.

## Economia nas próximas alterações

Depois de criar o projeto, em **Settings → Builds & deployments → Branch control**, configurar:

- Produção na branch `main`.
- **Preview branch: None**, para não gerar builds automáticos em cada commit das branches de trabalho.
- Continuar juntando ajustes em um PR, verificando os testes do GitHub e integrando uma vez por lote.

Os testes de navegador do GitHub passam a abrir a pasta pública gerada, com navegação equivalente às rotas sem `.html`. Eles verificam caminhos internos ausentes, cabeçalhos, relatórios, rascunhos e os fluxos já existentes com usuários fictícios. A emulação local não substitui a conferência do domínio real.

## Depois da primeira publicação

1. Copiar o endereço exato `https://…pages.dev` informado pela Cloudflare. Não presumir que o nome desejado foi reservado.
2. Abrir `/version.json` nesse endereço e comparar seu commit com o da publicação esperada.
3. No Firebase do projeto **nextflow-telecom**, abrir **Authentication → Configurações → Domínios autorizados → Adicionar domínio** e cadastrar somente o hostname exato do novo projeto, se necessário. Não autorizar `pages.dev` genericamente e não apagar o domínio antigo durante a validação.
4. Entrar com a conta existente. Conferir a troca de senha/e-mail e o primeiro acesso verificado no novo endereço, sem criar cópias dos usuários já cadastrados.
5. Conferir Diretoria, fotos ampliadas, PDFs, atribuição por supervisão, um rompimento, POP 1/POP 2 e entrega a Projetos. Usar registros de teste identificados, sem alterar demandas reais por engano.
6. Em celular, conferir câmera, localização e rascunho local. Confirmar os envios no setor que acompanha o atendimento.

O login e os dados reais precisam de validação autenticada; receber HTTP 200 do login ou ver o deploy verde não basta.

## Troca de endereço e encerramento do Netlify

Contas, permissões, registros e anexos permanecem no mesmo Firebase. A limpeza de fotos de 15 dias continua no workflow já existente do GitHub.

Sessão, temas e rascunhos locais pertencem ao domínio do navegador. Antes de mudar o uso para o Pages, enviar as etapas pendentes no endereço antigo e aguardar confirmação. Rascunhos não enviados não aparecem automaticamente no domínio novo. Será necessário entrar novamente na nova hospedagem.

Somente após validar o Pages, divulgar o novo endereço e interromper os builds automáticos no projeto antigo do Netlify, para não consumir créditos das duas hospedagens nas próximas versões. Não excluir o projeto antigo antes da validação e do tratamento de rascunhos pendentes.

## Estado da migração

- Código e procedimento de preparo: implementados neste lote.
- Contas, dados e retenção do Firebase: preservados.
- Criar/conectar o projeto Pages: depende da autenticação do titular na Cloudflare.
- Conferência do domínio publicado, autorização exata no Firebase e corte do Netlify: executar após a primeira publicação; não considerar concluídos apenas porque o código foi integrado.

## Fontes oficiais

- https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/configuration/build-image/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/redirects/
- https://developers.cloudflare.com/pages/configuration/serving-pages/
- https://developers.cloudflare.com/pages/configuration/branch-build-controls/
