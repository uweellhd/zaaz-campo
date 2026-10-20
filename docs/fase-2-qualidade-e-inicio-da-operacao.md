# Fase 2 — qualidade e início da operação

Implementação de 20/10/2026, mantendo os fluxos aprovados na etapa 1. Guia de cargos, histórico e relatórios: [etapa 1](etapa-1-acompanhamento-e-relatorios.md).

## O que muda para quem usa

- O login oferece **Manter conectado neste aparelho pessoal**, desmarcado por padrão. Marcado: login persistente; desmarcado: sessão da aba. A escolha aplica-se ao próximo login, sem derrubar as sessões já abertas. Em aparelho compartilhado, use **Sair**. Fechar o navegador não apaga os rascunhos técnicos.
- O aviso de falta de conexão diferencia rascunho local de etapa enviada. Estar com internet não significa que o envio terminou: aguarde a confirmação da etapa.
- Fotografias continuam sob retenção de 15 dias. Rascunhos não enviados ficam no aparelho e os arquivos OTDR/histórico no sistema, conforme etapa 1. Cada rascunho usa o UID e o ID da demanda; sair não apaga trabalho ainda não enviado.
- Temas e identidade preservados. Ajustes de foco, quebra de textos, telas de 320 a 768 px, movimento reduzido e liberação de imagens ampliadas ao fechar.
- Relatórios detalhados permitem até **500 registros por PDF**, sem cortar linhas silenciosamente. Acima disso, o sistema pede período/equipe menores antes de buscar anexos e compor páginas. O CSV de Rompimentos permanece disponível para o inventário maior. Fotos no PDF continuam opcionais, no máximo 120 referências.

## Sessão, cookies e armazenamento

Não foi inserido rastreamento publicitário nem banner de cookies sem função. O Firebase Auth administra a autenticação no armazenamento do navegador; senha não é gravada pelo código da aplicação. Há três usos distintos: autenticação, preferência de tema e rascunhos técnicos em IndexedDB. São dados locais, não um backup. O modo sessão não criptografa/apaga os rascunhos e não protege um aparelho já desbloqueado. O botão Sair encerra ouvintes e remove o conteúdo protegido da tela; voltar a uma página mantida em memória obriga recarregar e validar o acesso.

HTML recebe `no-store`; JS/CSS revalidam antes de reutilizar; bibliotecas locais versionadas usam cache de um dia. Nenhum service worker armazena respostas do banco, fotografias ou arquivos OTDR. Sem cache persistente global do Firestore que copie o histórico de outras áreas para o aparelho.

## Desempenho aplicado

- Consultas exatamente equivalentes na mesma página compartilham um ouvinte e seu último resultado em memória. Consultas de equipes diferentes nunca se misturam; regras do Firestore continuam sendo a autoridade. O último consumidor ou o logout encerra a conexão. Erros liberam a inscrição para uma nova tentativa.
- A fila técnica de Medições consulta somente o UID atual com situação EM_CAMPO. A fila técnica de Rompimentos consulta o UID atual também para o Admin, evitando baixar todos os incidentes apenas para testar o próprio serviço.
- Código dos relatórios é importado no primeiro uso. Chart.js 4.5.1 fica local, com licença e integridade conferida contra a versão antes utilizada; só carrega ao abrir a visão executiva. O campo deixa de depender do CDN de gráficos.
- Formatação de dias reutiliza os formatadores de Brasília, evitando construir milhares de objetos Intl a cada filtro. No ensaio local com 9.000 metadados fictícios, filtro e análise de Medições passaram de 542 ms para 18 ms; no navegador, 23 ms. Medida específica em máquina de teste, não promessa para todo celular ou tempo de rede.
- Enriquecimento de PDFs limita a quatro consultas simultâneas e preserva ordem e falhas. Fotos não são carregadas nas listas. Cartões continuam limitados a 24 por exibição; isso limita DOM, não todas as leituras do banco.
- Rascunhos de Rompimentos só indicam sucesso após conclusão da transação IndexedDB. A chave do atendimento é capturada antes de aguardar o banco, evitando que trocar de ID cruze gravações.

## Segurança aplicada e limites

Cabeçalhos em `_headers`: bloqueio de incorporação em outros sites, tipos de conteúdo, política de referências, permissões de câmera/GPS restritas ao próprio site e CSP com origens explícitas. A câmera e o GPS de campo permanecem habilitados. CSP ainda admite código e estilos inline porque a interface existente usa eventos inline; não foi anunciada uma política estrita por nonce/hash. Continua sendo desejável retirar esses eventos gradualmente.

Rotas de manutenção, testes, documentação e configurações não são servidas pelo site de produção (`_redirects` com 404 forçado). O repositório GitHub continua público; isso não torna o código confidencial nem substitui autorização no Firebase. A configuração pública Web do Firebase não é credencial administrativa. Credenciais administrativas continuam exclusivamente nos segredos do GitHub.

Nenhuma mudança nas permissões da etapa 1, promoção de conta, cobrança, Analytics, App Check ou backup externo foi ativada nesta fase.

## Limpeza única dos testes reais

Autorização do administrador: todos os registros operacionais existentes até **20/10/2026 10:40:23 de Brasília** eram testes, inclusive fora do laboratório. A rotina está em `maintenance/limpar-testes-iniciais.mjs`, configurada por `maintenance/limpeza-inicial.json`.

A lista fechada é: `incidentes`, `fotos`, `projetosEvidencias`, `medicoes` e `medicoesFotos`; em Medições inclui apenas subcoleções conhecidas de comprovantes, arquivos e partes. Auth, usuários, solicitações, equipes e identidades IXC não são tocados.

O PR faz inventário sem exclusão. A publicação em main executa a rotina autorizada, com a credencial existente, projeto fixo, corte fixo, limite de 3.000 documentos e conferência de createTime/updateTime do servidor. Dados novos ou alterados depois do corte interrompem a limpeza. Subcoleções desconhecidas também interrompem. Deletes exigem a versão inventariada; uma mudança concorrente faz o lote falhar. São lotes de até 200, portanto falhas depois de um lote podem deixar limpeza parcial, registrada no resultado da execução. Uma nova execução reavalia o restante antes de agir.

A conclusão é registrada em `_sistema/limpezaInicialFase2`, com contagens, corte e data, sem fotos nem dados pessoais em logs. Depois de concluída, reexecutar não apaga novos registros. A rotina não é agendada. Retenção diária e limpeza inicial compartilham exclusão mútua no GitHub Actions.

## Laboratório

Menu da conta → Laboratório. Serviços: **Rompimentos · quatro etapas** e **Medições OTDR · POP 1 e POP 2**. Cargos: Administração, NOC, técnicos A/B, Acompanhamento, supervisores A/B, Coordenação de Operações, Projetos, Coordenação de Projetos e Diretor. Equipe A tem Técnico A; equipe B tem Técnico B. Coordenação de Operações vê só a equipe A. Projetos pode alternar **Entregas finais / Acompanhamento ao vivo**; a coordenação acompanha a área e atribui tratamento, o analista confirma.

Rompimentos usa os mesmos validadores, galerias, editor de responsabilidade e composição de PDF da aplicação. A tela didática de abertura/histórico continua sendo uma simulação própria. Medições usa o próprio controlador da aplicação, com banco em memória. Não é uma reprodução das regras do Firestore: a segurança real é verificada no emulador, inclusive consultas proibidas e mudança de escopo. Nenhuma ação do laboratório escreve nas coleções operacionais, conta ou rascunho real. Reiniciar/atualizar perde os dados fictícios do laboratório.

Roteiro: abrir → supervisor distribuir → técnico enviar cada etapa/POP → trocar cargo e conferir evidência enviada → entregar final → Projetos assumir/coordenação atribuir → analista confirmar → diretor consultar histórico/exportar. Testar também foto faltando, cancelamento da confirmação, arquivo não permitido, falha de envio em Medições, retomada, fotos ampliadas e cargo de outra equipe. SOR fictício não contém curva óptica; a leitura de arquivo real precisa ser conferida com um arquivo real no software do fabricante.

## Validação e próximas decisões

Testes unitários, regras no emulador e navegador reproduzível em `tests/browser/stage-one.cjs`. A CI executa ambos os tipos e os testes de navegador. Navegador cobre POPs, quatro etapas, históricos, coordenações, responsabilidades, onze PDFs, CSP, temas, 320/360/390/768 px, aviso offline, 9.000 metadados com 24 cartões e limite explícito de PDF. Dados fictícios apenas; sem envio a Firebase real nesses testes.

**Ainda não é um ensaio de 9.000 OS simultâneas no Firebase.** As visões executivas e filas históricas ainda calculam seus totais a partir de todos os metadados autorizados. A paginação de cartões não reduz essas leituras. Fotos/arquivos no Firestore também consomem documentos e cota: não há armazenamento gratuito ilimitado. O consumo real deve ser medido no piloto, sem gerar milhares de documentos só para testar.

Candidatos para a fase 3, a definir com o administrador:

1. Paginação e busca no servidor com índices, sumários executivos calculados no backend e relatórios assíncronos para acervos grandes. Projetar antes para não confundir total da página com total da operação.
2. Avaliar destino de arquivos OTDR e fotos, custo por volume, retenção de originais, região, backup e teste de restauração. Hoje não há backup automático externo configurado.
3. Monitorar falhas reais, tempo de envio, consumo/leitura e tamanho dos rascunhos; controlar notificações e depurar sem armazenar fotos/senhas em logs.
4. App Check com implantação gradual e avaliação de compatibilidade; remoção de handlers inline para CSP estrita; revisão independente antes de ampliar a operação.
5. Integrações NOC Viewer/IXC/WhatsApp por backend autenticado, origem validada, idempotência, auditoria e fila de falhas. Nada disso foi ligado nesta fase.
