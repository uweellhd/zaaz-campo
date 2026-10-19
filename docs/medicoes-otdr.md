# Medições OTDR — NEXTFLOW Campo

Atualização de 19/10/2026. Serviço separado dos rompimentos; não altera as quatro etapas existentes.

## Como usar

1. Técnico: abrir **Medições**, ao lado de **Técnico**, e tocar em **Nova medição**. Informar referência/OS, cidade, estado, ponto A/TX, ponto B/RX e identificação das fibras. O técnico deve estar cadastrado e vinculado a uma equipe em Supervisão. Administrador e supervisor também podem registrar a demanda e escolher o técnico (supervisor apenas da própria equipe).
2. Registrar a demanda com internet. A diretoria já passa a enxergá-la como **Em campo**. Não é preciso finalizar o serviço para ele aparecer no acompanhamento.
3. Coletar **TX e RX**, em uma única etapa: pelo menos uma foto e um arquivo original em cada lado, GPS e descrição da medição. Limites: seis fotos por lado, três arquivos por lado, **2 MiB por arquivo original**. Fotos originais de até 20 MiB são reduzidas com a mesma rotina de imagem do Campo. Formatos de arquivo: `.sor`, `.msor`, `.trc`, `.iolm`.
4. A foto recebe NEXTFLOW/ZAAZ, nome do usuário que está registrando, data/hora do aparelho, lado TX/RX e GPS com precisão informada. Permitir câmera/fotos e localização no celular. O GPS é do registro, não comprova o local de captura de um arquivo antigo; os metadados EXIF não são certificados.
5. Conferir as miniaturas (toque para ampliar), remover anexos incorretos e preencher a descrição. **Conferir e entregar para Projetos** pede confirmação antes de transmitir. O cancelamento mantém tudo editável. Após iniciar a transmissão, anexos ficam congelados: uma falha deve ser retomada com o mesmo rascunho, evitando trocar evidências já recebidas.
6. Projetos: na sua aba, abrir **Medições OTDR · conferir entregas**. Clicar na demanda para ver GPS, ampliar fotos e baixar os originais. Conferir os arquivos no software apropriado, preencher a observação/referência, marcar a confirmação e salvar. Ficam registrados usuário, nome e data/hora de conferência. A confirmação é imutável no cliente.
7. Diretoria/Gerência: na aba Diretoria, escolher **Medições OTDR**. Filtrar estado, situação, abertura e busca. A tela e o **Relatório PDF** usam o mesmo recorte. O PDF contém resumo, distribuição por estado, inventário e ficha por demanda. Datas de recorte e apresentação são de Brasília. Voltar retorna aos rompimentos.

## O que fica salvo e quando aparece

- `EM_CAMPO`: demanda registrada/atribuída. Coleta em elaboração no aparelho do técnico.
- `ENTREGUE`: fotos TX/RX, arquivos TX/RX, GPS e descrição confirmados no servidor. Projetos passa a receber a demanda.
- `CONFERIDA`: Projetos registrou o tratamento e o responsável. Entrega e conferência são indicadores distintos; nenhuma aprovação óptica é inferida automaticamente.
- `onSnapshot` atualiza os setores com conexão. A lista e o modal aberto acompanham mudanças de situação. Não há envio por e-mail ou WhatsApp nesta atualização.
- Coleta em IndexedDB com chave de UID e demanda, incluindo arquivos originais. Depois de uma falha/reabertura, continuar a mesma demanda no mesmo aparelho e usar **Retomar envio**. **A reconexão não envia sozinha**. O cadastro inicial da demanda exige internet. Limpeza do navegador, modo anônimo, falta de espaço ou perda do aparelho podem remover o rascunho.
- Uma entrega longa só é confirmada depois que todos os comprovantes foram validados. O envio parcial não aparece como entregue. Os comprovantes de foto precisam ser recentes; não retomar uma transmissão que ficou abandonada por mais de 14 dias. Em caso de perda do rascunho depois de iniciar a transmissão, acionar a administração para recuperação assistida; não substituir silenciosamente arquivos de uma tentativa anterior.

## Acesso

| Perfil | Acesso a Medições |
|---|---|
| Técnico | Criar para si, visualizar e entregar somente as próprias demandas |
| Supervisor | Criar para técnico da própria equipe; acompanhar demandas vinculadas ao seu UID |
| Projetos | Receber apenas entregues/conferidas; consultar anexos e registrar conferência |
| Diretor / gerente | Consultar todas as demandas, filtros por estado e PDF |
| Admin | Registrar/atribuir, consultar, entregar e conferir; regras não permitem apagar histórico pelo cliente |
| NOC / SAC / Suporte | Sem acesso à nova área; permissões dos rompimentos preservadas |

O vínculo da equipe é fotografado no cadastro da demanda. Alterar uma equipe depois não muda o supervisor de demandas já registradas. Nome é exibido; autorização usa UID. Técnico pode consultar o perfil do próprio supervisor para registrar esse nome, sem listar todos os supervisores.

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
