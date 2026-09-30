# NEXTFLOW · Acessos, supervisão e escala

Documento de trabalho para revisar a próxima publicação com o administrador. Não ativa permissões por si só.

## Estado desta versão

O administrador já alterou seu e-mail e confirmou o novo login corporativo. O código desta proposta inclui solicitação de acesso com confirmação de e-mail, aprovação e revisão de perfis pelo admin, atribuição de técnico e supervisor pelo NOC/admin, consulta paginada para SAC, painel próprio do supervisor e relatório CSV filtrável. **Nada disso deve ser considerado ativo até a publicação coordenada das regras e do site.**

## Perfis

| Perfil | Área e dados | Pode alterar incidentes? |
| --- | --- | --- |
| Admin | Todas as áreas, perfis e solicitações | Sim, inclusive correções e exclusões controladas |
| NOC | Registro e consulta geral, com devolutivas | Cria e atualiza comunicados |
| SAC / Suporte | Consulta geral, busca e histórico | Não |
| Técnico | Fila autorizada e atendimento que assumiu | Somente etapas e fotos do atendimento atribuído |
| Supervisor | Seus IDs e pendências fotográficas, histórico | Não |
| Gerente / Diretor | Painel executivo, consulta e relatórios | Não |

As etapas 1, 2 e 3 do técnico continuam permitindo avanço sem foto. Na etapa 4, fotos e coordenadas são obrigatórias. As regras do Firestore precisam validar que um técnico só modifica um incidente atribuído ao seu UID e não altera campos administrativos.

## Cadastro e aprovação

1. O candidato informa um e-mail `@zaaztelecom.com.br`, cria sua senha e confirma o e-mail.
2. Sua conta fica **pendente**, sem acesso aos incidentes. Uma solicitação aparece na caixa de entrada do administrador no próprio dashboard.
3. O administrador escolhe perfil e estado e ativa a conta. O usuário nunca escolhe suas próprias permissões. NOC/admin vincula os IDs ao UID do técnico e do supervisor.
4. Um bloqueio ou troca de função revoga o acesso nas regras do Firestore. Não basta esconder botões.

No plano Spark, a validação no formulário e nas regras dos dados impede acesso aos registros, mas **não impede tecnicamente a criação de uma conta Firebase Authentication por outro cliente**. Bloquear antes da criação exige o recurso de funções de bloqueio do Firebase Authentication with Identity Platform. Antes de ativar a regra de domínio para todos, atualizar o e-mail do administrador existente preservando seu UID; nunca apagar e recriar a conta, pois o perfil está vinculado a esse UID.

A notificação inicial é uma caixa de entrada dentro do dashboard, visível quando o administrador entra. Aviso por e-mail ou WhatsApp requer um serviço de envio adicional e não deve depender de senha ou token exposto no navegador.

## Supervisor e histórico

Usar `supervisorUid` como vínculo definitivo em cada incidente. Exibir só nome e sobrenome, mas preservar o UID para distinguir pessoas homônimas. Incidentes anteriores guardam o campo textual `responsavel`: apresentar uma tela de vinculação para o administrador revisar nomes antigos e preencher `supervisorUid` em lotes, sem sobrescrever o histórico original.

O indicador fotográfico deve contar **IDs atribuídos ao supervisor cuja etapa 4 ainda não contém as duas fotos obrigatórias ou as coordenadas**. Também mostrar concluídos e pendentes por período, com links para o histórico e o técnico responsável. Contar quatro etapas por si só não prova que existem fotos.

## Dezenas a milhares de IDs

- A consulta operacional usa páginas pequenas; pesquisa exata por ID e OS consulta o Firestore, sem carregar a coleção inteira no navegador.
- Busca livre por cidade, OLT e descrição requer campos de busca preparados e índices próprios ou um serviço de pesquisa. Não prometer que uma busca local em 24 resultados cobre os 9 mil IDs.
- O painel executivo hoje lê todos os incidentes para contar KPIs e gerar CSV. Antes de chegar a milhares de IDs, criar contadores consolidados mantidos no servidor, relatório paginado por período/estado/status e exportação em lotes. Os gráficos não devem depender da lista visível.
- O relatório de reunião deve ter filtros de período, estado, supervisor e status, cabeçalho NEXTFLOW / ZAAZ, data de geração e totais, com CSV para análise e PDF para apresentação.

## Ordem segura de publicação

1. E-mail do admin: concluído e novo login confirmado.
2. Integrar a proposta ao ramo principal uma única vez para acionar um deploy Netlify. Durante os minutos até a publicação das regras, novos cadastros ainda não conseguirão criar solicitações; o login do administrador e os IDs existentes continuam com as regras atuais.
3. No GitHub Actions, executar **Validar ou publicar regras do Firestore** com `publicar=false`, conferir a execução, depois com `publicar=true`. Conferir login admin e IDs existentes. Se a credencial não tiver permissão de publicar regras, interromper e corrigir a permissão antes de repetir.
4. Testar uma conta corporativa não verificada, uma pendente e uma aprovada (SAC primeiro). Testar bloqueio de conta e reentrada.
5. Testar um técnico de um estado, atribuir um ID pelo NOC/admin e confirmar que IDs sem atribuição e de outros técnicos não aparecem. Testar as quatro etapas.
6. Vincular um supervisor a um ID antigo, conferir contagem e leitura sem edição. Conferir exportação CSV filtrada.
7. Revisar vínculo dos nomes antigos em lote com o administrador; consolidar indicadores do painel e busca textual antes de importar milhares de IDs.

Não publicar regras que removam o acesso do administrador antes de testar seu novo e-mail.
