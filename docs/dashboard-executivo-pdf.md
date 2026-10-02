# Diretoria - visão executiva e relatório PDF

## Decisão

As fotos são obrigatórias em todas as etapas do fluxo atual. Um ID ainda em andamento não deve ser contado como uma falha de evidência final. Removemos esse indicador da diretoria e do CSV. Não alteramos a obrigação das fotos, as permissões ou a retenção de 15 dias.

## O que a direção vê

- Incidentes ativos e chamados resolvidos.
- Impacto GPON: soma declarada nos chamados ativos, com possível repetição de clientes; não são clientes únicos.
- Ocorrências ativas de backbone.
- Chamados ativos sem técnico atribuído.
- Previsões vencidas: somente chamados ativos com data e hora válidas anteriores à posição exibida. Não é uma medida de SLA. Registros antigos com valores como “2h” não são tratados como prazos válidos.
- Leitura executiva, regiões, composição da rede, carteira de supervisores, etapas dos ativos e conclusões nos últimos sete dias.

## Uso para reunião

1. Entre como administrador, gerente ou diretor e abra Diretoria.
2. Selecione o período de **abertura** dos chamados, estado e/ou nome do supervisor. Todos os indicadores usam esse recorte.
3. Clique em **Relatório PDF**. O arquivo é baixado pelo navegador, com cabeçalho NEXTFLOW/ZAAZ, posição em Brasília, resumo, gráficos vetoriais, supervisão, critérios e inventário paginado.
4. Os botões Em andamento/Resolvidos alteram apenas a lista na tela. PDF e CSV incluem as duas situações do recorte. Para outra região, use os cartões ou o seletor Estado.
5. CSV continua disponível para análise em planilhas, respeitando os mesmos filtros e protegendo células contra fórmulas.

## Critérios e limites

- Sem período: todos os registros disponíveis. Com período: registros sem data de abertura confiável ficam fora do recorte.
- Conclusões por dia usam a data da etapa 4. Resolvidos antigos sem essa data entram no total, mas não na série diária. O PDF informa quantos são.
- Horário dos indicadores/PDF: America/Sao_Paulo. Previsões novas são interpretadas como data e hora de Brasília. Não calcular duração do reparo a partir da abertura quando a finalização não possui data estruturada confiável.
- PDF representa a posição na emissão. Não inventa disponibilidade, metas, SLA ou clientes únicos.
- A biblioteca jsPDF 4.2.1 está fixada localmente em vendor/, com licença MIT preservada. SHA-256: e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54. Só carrega ao solicitar PDF; não usa um serviço externo para processar os dados.
- O relatório não inclui imagens; a documentação dos atendimentos permanece nas telas de consulta.
- Sem alteração de Firestore ou da limpeza. Agrupar em uma integração na main para a publicação automática habitual.

## Validação

Testes de cálculo com ativos/resolvidos, fronteira de data em Brasília, supervisores homônimos com UIDs diferentes e previsões legadas. Teste no navegador com filtros, cinco gráficos, seis indicadores, PDF completo/filtrado, CSV, datas inválidas e celular de 390px. PDFs renderizados e conferidos, incluindo paginação de registros extensos.
