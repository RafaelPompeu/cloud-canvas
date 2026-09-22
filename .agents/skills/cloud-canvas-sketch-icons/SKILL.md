---
name: cloud-canvas-sketch-icons
description: Crie ou ajuste ícones SVG de AWS, GCP e Gerais no Cloud Canvas com acabamento desenhado à mão. Use para variantes e símbolos locais do editor, não para montar diagramas ou provisionar infraestrutura.
---

# Ícones desenhados à mão

Todos os caminhos abaixo são relativos à raiz do repositório.

- Consulte `AGENTS.md`, `static/icons/README.md` e somente os trechos relevantes de `scripts/build_sketch_icons.py`. O gerador é a referência atual de acabamento; mantenha contornos de lápis, irregularidade sutil, hachuras discretas e cores reconhecíveis, legíveis em tamanho pequeno.
- Identifique o `iconAsset` em `static/catalog.json` e seu original em `static/icons/sketch-sources.json`. Originais e fontes ficam em `static/icons/aws/`, `static/icons/gcp/` e `static/icons/shared/`; derivados ficam nas pastas correspondentes com sufixo `-sketch`. Preserve os originais e seus registros de origem.
- Faça ajustes reproduzíveis em `scripts/build_sketch_icons.py`, usando `build(source, destination)`. Regenere somente os arquivos afetados: `main()` regenera todos os provedores e reescreve o manifesto. Use os pares do manifesto para selecionar destinos; não derive um novo ícone de uma variante já estilizada.
- Preserve proporções, cores de identificação, transparências, máscaras, recortes e detalhes internos. Confira especialmente olhos, boca e viseiras; preenchimentos opacos não devem encobrir rostos. Mantenha margem no `viewBox` para evitar cortes do traçado.
- Símbolos genéricos e agrupamentos sem `iconAsset` ficam em `static/app.js`. Ajuste sua geometria/acabamento no mesmo ponto usado por biblioteca e canvas. Evite refatorações ou mudanças globais de tema para corrigir um ícone.
- Mantenha SVGs independentes, sem recursos externos, com referências `url(#id)` e `href="#id"` válidas. `static/icons.mjs` prepara os assets locais para exportação; preserve a incorporação das mesmas variantes em SVG/PNG.
- Ao adicionar arquivos, atualize catálogo e manifestos pertinentes sem mudar os tipos existentes. Registre a origem e descreva derivados como adaptações visuais, não como arquivos oficiais.

## Verificação

Execute `.venv/Scripts/python.exe -m unittest discover -s tests -p test_sketch_icons.py -v`. Se alterar catálogo, API ou persistência, execute a suíte completa conforme `AGENTS.md`, usando banco temporário.

Confira no navegador os ícones afetados na biblioteca e no canvas, inclusive pequenos, e compare detalhes com os originais. Confira SVG/PNG quando o renderizador ou a exportação mudar. Acrescente teste apenas para regressões estruturais relevantes; a aparência exige inspeção visual. Relate somente verificações executadas.
