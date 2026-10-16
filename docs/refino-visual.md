# Refinamento visual - outubro de 2026

Pedido: dar mais identidade ao NEXTFLOW, com ajustes discretos, preservando a estrutura apresentada à direção.

- Fonte de interface nativa: Segoe UI no Windows, Roboto no Android, Helvetica Neue/Arial nas alternativas disponíveis. Não baixamos mais Inter do Google Fonts no login e no painel.
- Ícones vetoriais de traço consistente na navegação e no menu de conta; rótulos continuam acessíveis como texto.
- Menos caixa alta e espaçamento entre letras; títulos menores, pesos moderados e números tabulares.
- Bordas e cantos mais discretos; sombras concentradas no menu flutuante e no login.
- Textos do login e das seções mais diretos, usando termos da operação.
- Fibra animada, identificação NEXTFLOW/ZAAZ, temas e estrutura das telas preservados.
- Tipografia e cores dos gráficos acompanham o tema em js/appearance.js, sem alterar dados ou filtros. Contrastes do tema escuro ajustados para textos azuis, ações secundárias e campos nativos.
- Regras, banco, IDs HTML, ações dos botões, etapas técnicas, relatórios e permissões mantidos. Duas mensagens de botão em JavaScript foram atualizadas para os mesmos rótulos da tela.

A camada está em refinement.css, carregada depois dos estilos existentes. A fonte final depende das fontes disponíveis no aparelho. Não introduzimos bibliotecas, chamadas de dados ou outros serviços.

Verificação: IDs e ações HTML comparados antes/depois; testes existentes; renderização de login, painel e menu em 390, 768 e 1440px e nos três temas. Dados dos screenshots de validação são fictícios e não entram no sistema.
