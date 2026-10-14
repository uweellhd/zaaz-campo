# Campo: conferência, localização e futuro NOC VIEWER

## Alterações desta versão

- As quatro etapas solicitam confirmação depois da validação e antes de enviar qualquer foto ou dado. Cancelar mantém a etapa e suas fotos no rascunho. As etapas enviadas continuam bloqueadas.
- Etapa 2 exige capturar a localização do rompimento. Coordenadas e posição numérica ficam no evento do histórico; os setores recebem a atualização pelos ouvintes existentes. O histórico tem um link para abrir esse ponto no mapa.
- Fotos das etapas 2, 3 e 4 recebem, no canto oposto do rodapé, o GPS do celular ao adicionar a imagem e a precisão estimada em metros. Cada seleção de fotos solicita uma posição nova; não reutilizamos o local do rompimento como se fosse a posição atual. Em um lote, as imagens compartilham a posição desse registro.
- O horário e o GPS representam o registro no app, não uma autenticação do momento original da fotografia. Uma imagem da galeria pode ter sido tirada em outra data ou local. Não lemos EXIF nem certificamos a captura original.
- Sem GPS disponível, a foto registra essa condição. Isso não dispensa a localização obrigatória do rompimento ou das caixas. Autorize a localização no navegador e capture junto ao ponto correto. GPS não exige uma integração com serviço de mapas para ser salvo; o link externo só abre quando alguém o seleciona.
- SAC/Suporte abre os detalhes em até 1440px, com adaptação ao celular.
- NOC mantém a publicação manual do comunicado e não confirma mais supervisor em um seletor. O ID IXC cadastrado identifica a conta; na ausência de identificação válida, aceitamos somente nome completo exato e único de supervisor ativo. Não usamos nome parcial ou semelhança.
- Sem correspondência única, preservamos o ID pendente e avisamos quem publicou. O administrador pode corrigir em Gerenciar acessos → Correção de responsável. IDs existentes não são alterados automaticamente. O supervisor continua distribuindo para seu time.

## Como testar

1. Abra um ID atribuído e adicione uma foto. Clique em avançar e cancele. Confirme que continua na mesma etapa e pode remover/substituir a imagem antes de enviá-la.
2. Na etapa 2, tente enviar sem GPS. Capture o ponto, preencha causa, fotos e previsão. Confirme o envio. SAC/Supervisor devem enxergar imediatamente as coordenadas e o link.
3. Amplie uma foto das etapas 2–4 para conferir nome, data/hora e GPS em lados distintos. Recuse GPS em uma seleção para conferir a indicação de indisponibilidade.
4. Publique um comunicado manual com RESPONSÁVEL igual ao nome completo de um supervisor ativo, ou um ID USUÁRIO IXC já cadastrado. O ID chega à sua fila sem confirmação NOC. Use um nome incompleto ou duplicado: o sistema deve preservar o ID sem encaminhar a um time incorreto.
5. Supervisor distribui o ID para um técnico de sua equipe como antes.

## Integração NOC VIEWER / IXC - futura, não ativada

Antes de implementar, obter com a equipe NOC a documentação de API/webhook/exportação do NOC VIEWER, exemplo real autorizado da mensagem/payload e acesso de teste. Não sabemos ainda qual integração o produto oferece. Nenhuma credencial deve ser colocada no frontend ou GitHub público.

Contrato sugerido para eventos: sistemaOrigem, idEvento, idIncidente, idOs, idUsuarioIxcSupervisor, emailSupervisor (se disponível), nomeSupervisor, criadoEm, tipoEvento, dados da ocorrência. Os nomes são uma proposta, não campos confirmados pelo fornecedor.

Um receptor no backend deve autenticar e validar a origem, deduplicar por sistemaOrigem/idEvento, relacionar o ID IXC ao UID Firebase e gravar o incidente. O UID deve ser a identidade interna estável. E-mail compartilhado ajuda na associação inicial, mas pode mudar; não basta conferir o domínio para conceder acesso. Hoje os perfis usuarios não guardam o e-mail da Authentication, portanto esse cruzamento exige implementação no backend, sem expor a lista da Authentication ao NOC.

Manter o nome original do comunicado, registrar qual identificador produziu o vínculo e enviar divergências/identidades desconhecidas a uma fila de revisão do administrador. Não liberar um supervisor apenas pela chegada de uma mensagem externa. Novos eventos devem atualizar o mesmo incidente, sem duplicar IDs ou apagar etapas técnicas.

NOC VIEWER → receptor autenticado → validação/deduplicação → vínculo IXC/UID → Firestore → acompanhamento ao vivo → supervisor distribui ao técnico.

O envio das devolutivas técnicas ao sistema do NOC será uma integração separada: caixa de saída, chave por incidente/etapa, tentativas registradas e tratamento de falhas. Não presumir que a gravação no Firestore já chegou ao IXC/NOC VIEWER.

## Sugestões para a próxima fase

- Priorizar identificador IXC estável, usando nomes completos só no teste manual.
- Criar correção excepcional de foto pelo administrador com motivo, autoria e histórico; preservar o bloqueio das etapas para o técnico.
- Decidir com a operação se imagens da galeria podem ser usadas como evidência ou se a captura direta deve ser exigida. O atributo capture do navegador não impede a galeria em todos os aparelhos.
- Exibir a precisão GPS do rompimento no histórico quando esse dado passar a ser armazenado de forma estruturada; coordenada do aparelho pode ter margem de erro.

Fotos continuam com retenção de 15 dias; coordenadas e registros textuais permanecem no histórico. A publicação é agrupada no GitHub. Quem tiver uma versão antiga aberta deve recarregar antes de enviar a nova etapa 2 com GPS.
