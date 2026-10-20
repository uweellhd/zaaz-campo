# Fase 3 — dados, cópia de segurança e vínculo IXC

Implementação de 20/10/2026, seguindo a base aprovada. A limpeza da fase 2 não é repetida e nenhuma conta ou equipe real é alterada automaticamente.

## Para usar

### Diretoria e Coordenação de Operações

A visão de Rompimentos abre nos **últimos 30 dias**, com as duas datas visíveis. O filtro por abertura é enviado ao banco: não é preciso baixar todo o histórico para depois descartá-lo. Indicadores, gráficos e PDF usam o período selecionado; não representam apenas os cartões da página.

Para buscar um registro antigo, altere as datas ou use **Limpar filtros** para todo o histórico. Não houve exclusão de registros históricos. O acesso da Coordenação de Operações continua limitado aos supervisores vinculados.

Há uma exceção de compatibilidade: **Conclusão técnica** ainda precisa consultar os metadados históricos para interpretar a data da etapa 4 dos registros antigos. Ela não é filtrada por abertura no servidor, porque isso esconderia atendimentos abertos antes do período e concluídos dentro dele. Um futuro timestamp de conclusão, com migração e validação, permitirá otimizar também essa base.

### Acompanhamento → Medições

A consulta agora busca **uma página de até 24 registros no banco**, com **Próximas medições / Página anterior**. Ao trocar de página/filtros, encerra os ouvintes anteriores. A página carregada recebe as etapas ao vivo, e os detalhes continuam permitindo fotos e arquivos.

Estado, situação, período e **referência/OS exata** são aplicados no servidor. A pesquisa nesta consulta exige a referência inteira e a mesma escrita cadastrada; não promete busca textual aproximada em todo o banco. As telas de gestão mantêm a busca local anterior. Para localizar algo antigo, use período ou referência.

O contador desta tela informa a página, sem apresentar 24 registros como total da operação. Um ouvinte pequeno detecta mudança no começo da lista e informa quando usar **Atualizar lista** para trazer novas demandas. Isso não interrompe as atualizações das etapas já visíveis. Não há polling contínuo de todo o histórico.

As filas de gestão de Medições e Projetos ainda usam os metadados autorizados para seus indicadores e análises. Não foram substituídas por totais incompletos de páginas. Esta fase não anuncia agregações executivas permanentes no backend, busca textual completa, relatórios assíncronos nacionais ou capacidade ilimitada no plano gratuito.

## Índices e armazenamento

`firestore.indexes.json` declara os índices das combinações de referência, situação, estado e data usadas pela consulta paginada, além do índice de supervisor/período de Rompimentos. O workflow prepara e aguarda os índices **antes** de integrar a nova interface em main. Isso evita publicar consultas que ainda dependem de um índice em construção.

Campos grandes que não são usados para pesquisa deixam de gerar índices: imagens em base64, partes dos arquivos, timeline completa, texto bruto, descrições e listas de evidências. As consultas por data da retenção, por dono/estado/ID e os arquivos originais continuam funcionando. É uma redução de trabalho/espaço dos índices; não aumenta a cota do plano.

Não foi habilitado faturamento nem migrado nenhum arquivo. Cloud Storage para Firebase exige plano Blaze conforme as regras atuais; portanto não é ativado silenciosamente como se fosse armazenamento gratuito sem condições. Os originais OTDR continuam com o limite de 2 MiB por arquivo no Firestore. Fotos continuam disponíveis por 15 dias.

Referências oficiais consultadas em 20/10/2026:

- [Boas práticas do Firestore: campos grandes e índices](https://firebase.google.com/docs/firestore/best-practices).
- [Índices do Firestore](https://firebase.google.com/docs/firestore/query-data/index-overview).
- [Requisitos do Cloud Storage](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024?hl=pt-BR).
- [Agregações e sua cobrança](https://firebase.google.com/docs/firestore/pricing).

## Cópia de segurança protegida

Menu do seu nome → **Gerenciar acessos → Cópia de segurança dos registros**. Exclusivo do Admin.

1. Se quiser, selecione um período pela abertura. Sem datas, busca os registros operacionais acessíveis ao Admin.
2. Escolha e confirme uma senha de 12 a 256 caracteres **para a cópia**, diferente da senha de acesso.
3. Clique em **Baixar cópia protegida** e aguarde o arquivo JSON.
4. Guarde arquivo e senha em lugares separados. A senha não é enviada ao servidor nem salva pelo aplicativo. Sem ela não existe recuperação dessa cópia.

Inclui `incidentes`, `projetosEvidencias` associados e `medicoes`, seus arquivos originais entregues, partes e comprovantes das etapas confirmadas. Exclui fotos, inclusive imagens antigas embutidas na timeline; as referências e os registros textuais permanecem. Não exporta Firebase Auth, usuários, permissões, equipes ou vínculos IXC. Esses cadastros precisam de uma estratégia administrativa separada; esta não é uma cópia completa do projeto Firebase.

A cópia usa AES-256-GCM, chave derivada da senha com PBKDF2-SHA256/600.000 iterações, salt e IV aleatórios por arquivo. Não há senha mestra no JavaScript. A cifra verifica integridade ao abrir. Os arquivos OTDR entregues também são verificados por tamanho e SHA256 antes de concluir. A ferramenta exige leituras do servidor, sem usar uma lista parcial do cache como cópia completa. Parte ausente ou leitura falhada interrompe a exportação; não baixa um arquivo parcial como se fosse completo.

Limites explícitos: 30 MiB de conteúdo antes da cifra e 20 mil documentos por arquivo. Caso ultrapasse, escolha um período menor. O período selecionado não elimina todas as leituras de inventário dessa ferramenta administrativa; não é um backup para executar a cada clique ou por todos os cargos.

A exportação lê o sistema em funcionamento, **não é um snapshot transacional global**. Medições alteradas durante a leitura interrompem a operação. Para um ponto de recuperação rigoroso, o próximo passo é backup no servidor com armazenamento privado, retenção e restauração monitorados. Nenhum backup automático recorrente foi ativado. A exportação manual só existe depois de baixar e guardar o arquivo.

### Restauração

A interface não possui um botão que sobrescreva dados. A ferramenta está em `maintenance/restaurar-copia.mjs` e só pode escrever com credencial administrativa ou no emulador local.

- Sem `--aplicar`, descriptografa, valida estrutura/arquivos e confere conflitos, sem gravar.
- Confere projeto e aceita apenas os caminhos operacionais previstos. Não restaura contas, equipes, fotos ou regras de acesso.
- Não exclui nem sobrescreve documentos existentes. Se encontrar os mesmos IDs, interrompe antes do primeiro write.
- Confere os hashes OTDR e preserva os timestamps originais. Usa criação com precondição de ausência, em lotes até 200 documentos/4 MiB.
- Falha depois de um lote pode deixar restauração parcial; não é uma transação global e não deve ser repetida cegamente. O operador precisa conferir quais IDs foram restaurados. A ferramenta recusa sobrescrever na repetição.
- Não foi feita restauração na produção. O ensaio automatizado restaura uma cópia fictícia no emulador, confirma o original e a data e verifica a recusa da segunda execução.

Uso administrativo, quando necessário, com ajuda técnica:

```bash
# A senha fica em NEXTFLOW_BACKUP_PASSWORD; não colocar na linha de comando.
# A credencial administrativa existente fica em FIREBASE_SERVICE_ACCOUNT_JSON.
node maintenance/restaurar-copia.mjs /caminho/copia.json --projeto=nextflow-telecom
# Somente depois de conferir a simulação e os conflitos:
node maintenance/restaurar-copia.mjs /caminho/copia.json --projeto=nextflow-telecom --aplicar
```

## IXC explicado sem confundir os números

O cadastro fica em **nome da conta → Gerenciar acessos → Vínculo do supervisor: IXC → NEXTFLOW**.

| Informação | Significado |
|---|---|
| ID do incidente | Número do atendimento/rompimento. Não é o número pedido neste cadastro. |
| Número da OS | Ordem de serviço. Também não é o número pedido aqui. |
| ID do usuário supervisor no IXC | Código da pessoa dentro do IXC. É o número que deve ser cadastrado. Peça ao NOC se não souber. |
| Supervisor no NEXTFLOW | Conta aprovada, ativa e com função Supervisor, selecionada na lista. |
| E-mail | Usado para login. O cadastro atual não vincula automaticamente pelo e-mail. |

**Exemplo fictício:** no IXC, Ana é a usuária 123. No NEXTFLOW, você escolhe a conta de Ana. Salva **123 → Ana**. Um novo comunicado com a linha `ID USUÁRIO IXC: 123` será destinado à Ana, que atribui o técnico da sua equipe. O sistema usa o UID interno da conta; não é preciso copiá-lo manualmente.

Campos de comunicado reconhecidos: `ID USUÁRIO IXC`, `ID USUARIO IXC` e `ID SUPERVISOR IXC`.

Prioridade de reconhecimento:

1. Se existe número IXC no comunicado, procura o vínculo exato e confirma que o destino ainda é um Supervisor ativo.
2. Se esse número é inválido, não cadastrado ou aponta para conta inativa/outro cargo, mantém o atendimento **pendente de identificação**. Não troca silenciosamente para o nome.
3. Somente quando não há número IXC tenta o nome completo de `RESPONSÁVEL`, com correspondência exata e única entre Supervisores ativos. Não usa apelidos ou semelhança.
4. Se não puder decidir, o Admin usa **Correção de responsável** para aquele atendimento específico. O ID e o histórico não são perdidos.

**Revisar vínculo** preenche o cadastro existente. Mudar o Supervisor exige confirmação e altera os próximos comunicados; não muda automaticamente IDs já registrados, seus históricos, equipes ou técnicos. Um vínculo alterado por outro usuário durante a revisão é reavaliado em transação.

Esse cadastro **não é uma integração com a API do IXC**, não busca OS, não lê o grupo WhatsApp e não precisa de senha/token IXC. Não há comunicação de volta ao IXC. Esses recursos exigem backend autenticado e acordo com NOC/TI sobre origem, campos, autenticação, ID estável, duplicidade e tentativas. Não inserir tokens IXC no HTML ou JavaScript público.

## Verificação e próximos limites

Testes de lógica/cifra/consultas, regras reais no emulador e navegador com os fluxos aprovados, PDFs, cargos, paginação, backup cifrado, arquivos faltantes, temas e celular. Nada desses ensaios cria atendimentos na base real.

Ainda a definir: backup automático com destino privado, recuperação das contas/configurações, storage de objetos com custo aprovado, sumários executivos no backend, relatórios grandes assíncronos, observabilidade sem dados sensíveis e contrato real da integração IXC/NOC Viewer. Não foram anunciados como recursos já conectados.
