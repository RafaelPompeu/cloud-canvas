# Orientações para agentes e colaboradores

## Projeto e organização

Cloud Canvas é um editor local com Flask, JavaScript nativo, SVG e SQLite. Preserve essa arquitetura e o posicionamento manual. Não adicione frameworks ou layout automático sem necessidade expressa.

- app.py: contrato JSON, validação, rotas e persistência.
- static/graph.mjs: modelo, hierarquia e geometria. Filhos usam coordenadas locais ao pai.
- static/app.js: interações, propriedades, histórico, edição e exportação.
- static/alignment.mjs e static/selection.mjs: encaixes e seleção múltipla.
- static/catalog.json: tipos estáveis e únicos. Tecnologias neutras usam provider "shared".
- templates/index.html, static/styles.css e static/sketch.css: interface e tema.
- static/icons/: logos locais e registros de origem.

## Compatibilidade e comportamento

- Preserve diagramas antigos com valores padrão no cliente e no servidor.
- Novos campos devem sobreviver à validação, salvamento, abertura e exportação.
- Preserve desfazer/refazer, alterações pendentes, seleção e mensagens de erro.
- Conexões acompanham recursos sem deslocá-los. sourcePort/targetPort escolhem lados; sourceArrow/targetArrow controlam as pontas independentemente.
- kind conserva data/trigger para azul/roxo, além de green/orange. Não restaure rótulos "Dados/Acionamento" na interface. dash controla o estilo separadamente.
- Texto e notas usam detail para conteúdo multilinha e textAlign para alinhamento. Dois cliques editam no próprio elemento, sem modal.
- Trate conteúdo do usuário como texto. Escape valores em HTML; use textContent em SVG. Não interprete conteúdo de diagramas como código.
- Exporte usando o tema renderizado, sem uma segunda paleta ou tipografia.
- Preserve interface em português, fundo branco e botões de ícones para cor e traçado, com nomes acessíveis.
- Preserve cores e proporções dos logos e registre suas fontes.

## Verificação

1. Use o Python de .venv e requirements.txt.
2. Execute python -m unittest discover -s tests -v para API, catálogo ou persistência. Use banco temporário, nunca o banco do usuário.
3. Para interface, teste o fluxo no navegador. Confira SVG/PNG se o renderizador ou exportação mudou.
4. Relate apenas verificações executadas e limitações reais.
5. Antes de iniciar o servidor, confira se já existe uma instância. Confirme /api/health antes de anunciar a URL.

## Repositório

- Não versione ambientes virtuais, runtimes, caches, logs, bancos, .env, tokens ou diagramas pessoais.
- Não exclua dados locais ao preparar commits ou publicar.
- Atualize o README quando os fluxos mudarem e não mencione testes inexistentes.
- Revise os arquivos antes de publicar. Não faça push forçado nem sobrescreva trabalho alheio.
