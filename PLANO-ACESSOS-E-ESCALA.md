# NEXTFLOW · Acessos, supervisão e escala

Documento de trabalho para revisar a próxima publicação com o administrador. Não ativa permissões por si só.

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
3. O administrador escolhe perfil e estado, associa supervisor quando aplicável e ativa a conta. O usuário nunca escolhe suas próprias permissões.
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

1. Paginar a consulta geral e ajustar o espaço visual. Verificar busca exata nos dados existentes.
2. Migrar o e-mail do administrador mantendo o UID; confirmar novo login.
3. Criar solicitação de acesso, aprovação interna e regras de domínio/perfil; testar uma conta pendente e uma aprovada.
4. Revisar vínculo dos nomes de supervisor antigos e ativar a área de supervisão.
5. Consolidar indicadores e relatórios para volume grande antes de colocar milhares de IDs em produção.

Não publicar regras que removam o acesso do administrador antes de testar seu novo e-mail.
