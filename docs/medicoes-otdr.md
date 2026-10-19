# Medições OTDR — NEXTFLOW Campo

Atualização de 19/10/2026, revisada após teste de abertura e distribuição. Serviço separado dos rompimentos; não altera as quatro etapas existentes.

## Como usar

1. Administração: abrir **Medições → Nova medição**, informar referência/OS, cidade, estado, pontos A/TX e B/RX e escolher o **supervisor responsável**. Não existe seleção de técnico na abertura. **Fibras são opcionais** e podem ficar em branco enquanto a rede é levantada. Supervisor também pode abrir uma demanda diretamente para sua própria fila.
2. A demanda entra como **Aguardando técnico** e já aparece na Diretoria. Na guia **Supervisão**, o responsável encontra o bloco **Medições OTDR**, abre o cartão e usa **Alocar técnico**. Só aparecem técnicos ativos da própria equipe. O serviço passa a **Em campo** e surge no acesso do técnico escolhido, que usa **Continuar coleta**. Não é preciso finalizar o serviço para ele aparecer no acompanhamento. Demandas já existentes continuam válidas, sem migração.
3. Coletar **TX e RX**, em uma única etapa: pelo menos uma foto e um arquivo original em cada lado, GPS e descrição da medição. O técnico pode preencher **Fibras identificadas (opcional)** durante a coleta, sem inventar números para conseguir concluir. Limites: seis fotos por lado, três arquivos por lado, **2 MiB por arquivo original**. Fotos originais de até 20 MiB são reduzidas com a mesma rotina de imagem do Campo. Formatos de arquivo: `.sor`, `.msor`, `.trc`, `.iolm`.
4. A foto recebe NEXTFLOW/ZAAZ, nome do usuário que está registrando, data/hora do aparelho, lado TX/RX e GPS com precisão informada. Permitir câmera/fotos e localização no celular. O GPS é do registro, não comprova o local de captura de um arquivo antigo; os metadados EXIF não são certificados.
5. Conferir as miniaturas (toque para ampliar), remover anexos incorretos e preencher a descrição. **Conferir e entregar para Projetos** pede confirmação antes de transmitir. O cancelamento mantém tudo editável. Após iniciar a transmissão, anexos ficam congelados: uma falha deve ser retomada com o mesmo rascunho, evitando trocar evidências já recebidas.
6. Projetos: na sua aba, abrir **Medições OTDR · conferir entregas**. Clicar na demanda para ver GPS, ampliar fotos e baixar os originais. Conferir os arquivos no software apropriado, preencher a observação/referência, marcar a confirmação e salvar. Ficam registrados usuário, nome e data/hora de conferência. A confirmação é imutável no cliente.
7. Diretoria/Gerência: na aba Diretoria, escolher **Medições OTDR**. Filtrar estado, situação, abertura e busca. A tela e o **Relatório PDF** usam o mesmo recorte. O PDF contém resumo, distribuição por estado, inventário e ficha por demanda. Datas de recorte e apresentação são de Brasília. Voltar retorna aos rompimentos.

## O que fica salvo e quando aparece

- `AGUARDANDO_TECNICO`: aberta para um supervisor, sem técnico. Não conta como serviço em execução.
- `EM_CAMPO`: supervisor alocou um técnico ativo da equipe. Coleta em elaboração no aparelho do técnico.
- `ENTREGUE`: fotos TX/RX, arquivos TX/RX, GPS e descrição confirmados no servidor. Projetos passa a receber a demanda.
- `CONFERIDA`: Projetos registrou o tratamento e o responsável. Entrega e conferência são indicadores distintos; nenhuma aprovação óptica é inferida automaticamente.
- `onSnapshot` atualiza os setores com conexão. A lista e o modal aberto acompanham mudanças de situação. Não há envio por e-mail ou WhatsApp nesta atualização.
- Coleta em IndexedDB com chave de UID e demanda, incluindo arquivos originais. Depois de uma falha/reabertura, continuar a mesma demanda no mesmo aparelho e usar **Retomar envio**. **A reconexão não envia sozinha**. O cadastro inicial da demanda exige internet. Limpeza do navegador, modo anônimo, falta de espaço ou perda do aparelho podem remover o rascunho.
- Uma entrega longa só é confirmada depois que todos os comprovantes foram validados. O envio parcial não aparece como entregue. Os comprovantes de foto precisam ser recentes; não retomar uma transmissão que ficou abandonada por mais de 14 dias. Em caso de perda do rascunho depois de iniciar a transmissão, acionar a administração para recuperação assistida; não substituir silenciosamente arquivos de uma tentativa anterior.

## Acesso

| Perfil | Acesso a Medições |
|---|---|
| Técnico | Visualizar e entregar somente as demandas que foram alocadas ao seu UID; fibras opcionais durante a coleta |
| Supervisor | Abrir para sua fila, alocar técnico ativo da própria equipe e acompanhar demandas vinculadas ao seu UID |
| Projetos | Receber apenas entregues/conferidas; consultar anexos e registrar conferência |
| Diretor / gerente | Consultar todas as demandas, filtros por estado e PDF |
| Admin | Abrir para um supervisor, distribuir para a equipe dele, consultar, entregar e conferir; regras não permitem apagar histórico pelo cliente |
| NOC / SAC / Suporte | Sem acesso à nova área; permissões dos rompimentos preservadas |

O supervisor é registrado na abertura; a equipe do técnico é validada no momento da alocação. A alocação registra usuário, nome e data/hora, e não pode ser trocada depois que a medição entrou em campo. Alterar uma equipe depois não muda o supervisor de demandas já registradas. Nome é exibido; autorização usa UID. Técnico pode consultar o perfil do próprio supervisor para registrar esse nome, sem listar todos os supervisores.

## Armazenamento do piloto gratuito

Cloud Storage for Firebase exige Blaze/faturamento vinculado desde 2026. Nenhum plano, conta de cobrança ou bucket foi criado/alterado nesta atualização. Para testar a funcionalidade na infraestrutura existente, originais pequenos são preservados como partes privadas no Firestore. **É uma solução limitada de piloto, não o armazenamento definitivo para coleta massiva nacional.**

- Metadados/status: `medicoes/{id}`.
- Fotos: `medicoesFotos/{id}-{tx|rx}-{indice}`. Apenas JPEG marcado, até 700.000 caracteres, seis posições por lado. Leitura vence em 15 dias; a rotina GitHub Actions **Limpar fotos antigas** remove esses documentos, além das fotos dos rompimentos.
- Originais: `medicoes/{id}/arquivos/{tx|rx}-{indice}` e subcoleção `partes/{0..3}`. Cada parte contém até 512 KiB binários em base64. Tamanho máximo original 2 MiB, três posições por lado. Dados são imutáveis. O download remonta os bytes, verifica tamanho e SHA-256 antes de oferecer o arquivo.
- Comprovantes: `medicoes/{id}/comprovantes/{txFotos|rxFotos|txArquivos|rxArquivos}`. A entrega exige os quatro comprovantes; fotos, arquivos e partes devem existir, respeitar limites e pertencer à demanda. Não basta declarar números de anexos.
- **Os arquivos OTDR não são excluídos após 15 dias.** Histórico, nomes, GPS, descrição e conferência também permanecem. SHA-256 detecta corrupção/troca de bytes no download; não certifica que o arquivo foi produzido por um equipamento real. A extensão é validada, mas a curva não é interpretada nem o formato interno certificado.
- Firestore gratuito: 1 GiB armazenado, 50 mil leituras/dia, 20 mil escritas/dia e 10 GiB/mês de saída, compartilhados com toda a aplicação. Base64 acrescenta aproximadamente 33% aos bytes; a entrega máxima pode ocupar cerca de **24 MiB**, mais índices/metadados. Poucas dezenas de entregas grandes já podem comprometer essa cota. Conferir **Firestore → Uso** antes de ampliar o piloto. O esgotamento pode interromper o serviço; não há promessa de armazenamento gratuito ilimitado.
- Listener consulta metadados acessíveis; paginação de 24 cartões é visual, não reduz a consulta inicial. Fotos/binários só são lidos ao abrir/baixar. A expansão exigirá agregações e paginação no servidor.

## Próxima evolução antes de escalar

1. Definir orçamento e armazenamento de objetos apropriado (Firebase Storage/Blaze com orçamento monitorado ou outro provedor autorizado), mantendo o contrato de metadados, permissões e hash. Não ligar cobrança automaticamente. Migrar originais e deixar apenas referências no Firestore.
2. Definir prazo de guarda dos arquivos nativos com a direção/Projetos, exportação/backup e tratamento de tentativas abandonadas. Nenhuma eliminação automática de originais foi implementada.
3. Homologar arquivos reais dos modelos VIAVI/EXFO utilizados, principalmente tamanho e formato. Se um original exceder 2 MiB, não comprimir ou converter para contornar o limite; planejar o armazenamento adequado.
4. Análise óptica/curvas, distâncias disponíveis, perdas, eventos e aprovação são trabalho posterior. O PDF atual é de **acompanhamento e rastreabilidade**, não um laudo óptico automático.
5. Estudar relatórios com anexos/curvas e exportação em lote; criação de demandas a partir de IXC/NOC Viewer continua futura e independente deste módulo.

## Verificação e publicação

- Testes unitários: `node --test tests/*.test.mjs`.
- Regras reais no emulador: `npm ci --prefix tests/security` e `npm test --prefix tests/security` (Java 21). Cobrem domínio/perfis, equipe, campos, TX/RX obrigatórios, contagem máxima, partes truncadas, anexos privados, conferência, imutabilidade e fotos vencidas, além da regressão dos rompimentos.
- Navegador com dados sintéticos: cadastro, marca/GPS, cancelamento, rascunho e retomada, envio multipartes, download byte a byte, ampliação em modal, Projetos, diretoria, temas e PDF paginado. Nenhum registro de teste foi inserido no banco real.
- Publicar pela integração GitHub/Netlify existente, numa única atualização consolidada. As regras são publicadas pelo workflow **Validar sem publicar / Publicar**, que já usa o segredo configurado. Não é necessário copiar código no Firebase manualmente se a etapa Publicar terminar com sucesso.

Referências oficiais consultadas em 19/10/2026:
- [Requisito Blaze para Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024?hl=pt-BR)
- [Cotas gratuitas Firestore](https://firebase.google.com/docs/firestore/pricing)
- [VIAVI: SOR e MSOR](https://www.viavisolutions.com/en-us/support/knowledge-base/solution/sor-file-versus-msor-file)
- [EXFO: exportação SOR de iOLM](https://www.exfo.com/en/resources/videos/how-to-videos/how-to-generate-sor-file-iolm-results/)

## Laboratório de Medições (sem alterar a operação real)

1. Entrar no menu do nome → **Testar setores**. Em **Serviço**, escolher **Medições OTDR · etapa única**.
2. Usar **Administração** para abrir uma demanda sem técnico e sem fibras; escolher Supervisor A. As amostras SIM-MED-001 e SIM-MED-002 também permitem testar direto a distribuição.
3. Trocar **Testar como** para **Supervisor A**, clicar na fila e **Alocar técnico**. Somente Técnico A pertence a essa equipe. Supervisor B/Técnico B pertencem à outra equipe de teste. Conferir que as demandas alheias não aparecem.
4. Trocar para **Técnico A**, abrir o cartão e **Continuar coleta**. Preencher só a descrição e tentar entregar sem fotos/arquivos/GPS para conferir as validações. Usar **Preencher evidências fictícias** para receber fotos marcadas, GPS e arquivos de exemplo. Eles não contêm uma curva óptica real.
5. Opcional: antes de confirmar, clicar em **Simular falha no próximo envio**. Tentar enviar, ler a mensagem e usar **Retomar envio para Projetos**. Depois que o envio começou, os anexos ficam congelados, como na operação real.
6. Trocar para **Projetos**, ampliar fotos, baixar os arquivos fictícios, preencher observação e confirmar conferência. Trocar para **Diretor**, ver estados/filas e exportar o PDF. Ele traz **SIMULAÇÃO / DADOS FICTÍCIOS** e nome de arquivo começando por SIMULACAO.
7. **Reiniciar teste** limpa os dados desse serviço fictício. Escolher **Rompimentos** retorna ao laboratório anterior. Atualizar a página também reinicia Medições.

O laboratório compartilha a tela, validação de entrega, galerias, relatório e fluxo de Medições com a operação real. Os serviços de dados são injetados: Firebase na operação; adaptador exclusivamente em memória no laboratório (`lib/measurement-lab.mjs`). O módulo de Medições não importa o SDK do Firebase. Não há escrita no banco real ou em rascunhos reais durante a simulação. A leitura de login/perfil do administrador continua real, apenas para proteger a entrada do laboratório. A simulação demonstra o fluxo; a autorização do servidor é validada separadamente nos testes do emulador.

A navegação da Diretoria usa um seletor centralizado com **Rompimentos** e **Medições OTDR**, ambos do mesmo tamanho e na mesma linha no computador e no celular. Ao escolher Medições por esse seletor, a aba Diretoria permanece ativa no menu principal.

## Correção de apresentação e responsável administrador — 19/10/2026

- A janela de detalhes/distribuição continua usando o mesmo fluxo. Recebeu o cabeçalho e o contêiner de leitura já usados nos modais do sistema, com posição fixa, margens automáticas, rolagem interna e limite de largura. Foi conferida no centro da tela a 1882×903, 1366×900, 390×844 e 844×390.
- A abertura e a coleta ficam centralizadas, com largura máxima de 860 px, seguindo o formulário técnico existente. Não foram alteradas as quatro etapas de rompimentos ou os requisitos de entrega de Medições.
- A confirmação de Projetos reutiliza `project-treatment` e `project-check`. Checkbox mantém 20×20 px, ao lado do texto, e a ação de confirmação fica centralizada.
- No laboratório, o botão Rompimentos usa o seletor de serviço já existente para retornar ao teste de rompimentos.

### Como usar seu acesso Admin como responsável nas medições

1. Abrir **Supervisão → Gerenciar equipe de técnicos**.
2. Em **Supervisor da equipe**, escolher seu próprio nome, identificado como **meu acesso admin**. Associar o técnico aprovado que fará parte da sua equipe. A indicação **transferir equipe** informa quando o técnico pertence a outro responsável; essa alteração deve ser feita conscientemente pelo administrador.
3. Abrir **Medições → Nova medição** e escolher seu nome em **Supervisor responsável**. É o mesmo UID e o mesmo perfil Admin, sem criar uma conta duplicada ou editar seu cadastro de acesso.
4. Na Supervisão ou nos detalhes da medição, distribuir ao técnico dessa equipe. O administrador continua podendo abrir a coleta e acompanhar/conferir a entrega com suas permissões existentes.

As regras permitem o Admin como responsável apenas para o seu próprio UID. Outros perfis não podem assumir sua identidade ou criar equipes sob ela. O ajuste não inclui administradores na correspondência automática de nomes/identidades IXC do NOC.

Validação desta correção: 22 testes unitários, 32 testes de regras no emulador, fluxo de Medições com envio/retomada/download/Projetos, administrador como responsável, verificação do posicionamento e checkbox, e regressão do laboratório de rompimentos nas quatro etapas, consulta SAC e entrega a Projetos. Os testes usam dados fictícios; não alteram a operação real.

## Visão de trabalho do técnico — 19/10/2026

A área do técnico segue a lista de trabalho dos IDs: mostra somente medições atribuídas ao seu UID que estão **Em campo**. Depois da entrega confirmada, a coleta fecha e o cartão sai dessa lista. Ao voltar ao mesmo perfil ou atualizar a página, a entrega concluída continua fora da tela de trabalho. Projetos recebe a entrega normalmente; supervisão e diretoria mantêm seu acompanhamento.

Os filtros de acompanhamento e os cinco indicadores de distribuição/Projetos não aparecem nessa visão técnica. A lista vazia informa **Nenhuma medição em andamento atribuída ao seu acesso**. A janela não abre detalhes de entregas concluídas para esse perfil. Essa é uma mudança de apresentação no módulo existente, com o mesmo comportamento de lista de trabalho dos rompimentos; não altera registros, regras ou a guarda do histórico.

O botão **Continuar coleta** usa o grupo de ações já existente nas etapas técnicas, centralizado, com até 360 px de largura, altura mínima de 48 px, separação de 24 px e espaço interno após o resumo. A tipografia da janela permanece na família do sistema, com texto de 14 px e título de 18 px.

Validação: entrega técnica deixa zero cartões e nenhum indicador/filtro administrativo nessa tela; reabertura do perfil e posterior conferência por Projetos não fazem a entrega reaparecer para o técnico. Mesmo cenário conferido no laboratório. Revalidados download, fotos ampliadas, retomada de envio, administrador responsável, temas, navegação e laboratório de rompimentos nas quatro etapas, consulta SAC e entrega a Projetos.
