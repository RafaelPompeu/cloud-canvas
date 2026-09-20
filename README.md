# Cloud Canvas

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="static/brand/cloud-canvas-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="static/brand/cloud-canvas-logo.svg">
    <img src="static/brand/cloud-canvas-logo.svg" alt="Cloud Canvas" width="420">
  </picture>
</p>

Editor visual de arquiteturas cloud e fluxos de dados, com **Flask, JavaScript nativo, SVG e SQLite**. Monte diagramas AWS, Google Cloud e de tecnologias como Oracle, MariaDB, Kafka e Airflow no navegador. Funciona localmente, sem provisionar infraestrutura.

## Exemplo da aplicação

![Demonstracao do Cloud Canvas](docs/images/cloud-canvas-demo.gif)

## Recursos

- Biblioteca pesquisável com serviços cloud, bancos e fontes externas, incluindo API.
- Contêineres aninhados, seleção múltipla, guias de alinhamento e redimensionamento.
- Conexões curvas, retas ou ortogonais, quatro cores e linhas contínuas, tracejadas ou pontilhadas.
- Pontas de seta opcionais na origem e no destino e escolha dos lados de entrada e saída.
- Texto livre e blocos de notas com várias linhas, alinhamento e edição direta por dois cliques.
- Desfazer/refazer, salvamento local e exportação em JSON, SVG e PNG.
- Exemplos de arquitetura multicloud e ingestão de dados.

## Executar

Requer **Python 3.10 ou superior**. Node.js não é necessário para executar.

### Windows / PowerShell

```powershell
git clone https://github.com/RafaelPompeu/cloud-canvas.git
cd cloud-canvas
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

Depois de instalar as dependências, também é possível iniciar com `./run.ps1`.

### Linux / macOS

```bash
git clone https://github.com/RafaelPompeu/cloud-canvas.git
cd cloud-canvas
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

Abra **http://127.0.0.1:5000**. Pressione **Ctrl+C** no terminal para encerrar. A variável de ambiente `PORT` permite escolher outra porta.

## Como usar

1. Em **Novo**, escolha canvas em branco ou um exemplo.
2. Busque componentes e clique para adicionar ou arraste para o canvas.
3. Organize os recursos nos contêineres. **Alt + arraste** ou **Dentro de** troca o contêiner.
4. Ative **Conectar (C)** e clique na origem e no destino. Selecione a linha para editar cor, traçado, estilo, pontas e lados.
5. Procure **Texto** ou **Bloco de notas** para anotar. Dois cliques permitem escrever no elemento. **Enter** insere uma linha, clicar fora aplica e **Esc** cancela. **Ctrl+Enter** também aplica.
6. Use **Salvar diagrama** e **Abrir** para recuperar projetos. A URL do diagrama salvo pode ser reutilizada enquanto o banco local estiver disponível.
7. Em **Exportar**, escolha JSON editável, SVG ou PNG. As imagens incluem o diagrama e seus logos, sem controles de edição.

Textos e notas aceitam até 2.000 caracteres. Aumente o elemento para mostrar conteúdos longos. Segure **Shift** ao mover ou redimensionar para encaixar nas guias. **Agrupar** organiza filhos do contêiner selecionado quando há espaço.

O PNG amplia a resolução até 2×, limitado a 8.192 pixels por lado e 16 megapixels. SVG e PNG usam o tema do canvas. A fonte do SVG em outro computador depende de sua disponibilidade; o PNG preserva a renderização do computador que exportou.

### Atalhos

| Ação | Atalho |
| --- | --- |
| Selecionar / mover canvas / conectar | V / H / C |
| Mover canvas temporariamente | Espaço + arraste |
| Enquadrar / zoom | F / roda do mouse |
| Selecionar todos | Ctrl+A |
| Adicionar ou remover da seleção | Shift + clique |
| Salvar | Ctrl+S |
| Desfazer / refazer | Ctrl+Z / Ctrl+Shift+Z |
| Excluir / cancelar | Delete / Esc |
| Ver atalhos | ? |

## Dados locais

Os diagramas ficam em `instance/diagrams.sqlite3`, criado automaticamente. Faça backup desse arquivo para preservar seus projetos. Banco, logs e ambiente virtual não são versionados.

O editor foi projetado para uso local individual: escuta em `127.0.0.1`, sem autenticação ou edição colaborativa. Publicar o código no GitHub não hospeda a aplicação.

## Publicar no Render

O repositório inclui `render.yaml` para um Web Service no plano **Free**, servido por Gunicorn. No [painel do Render](https://dashboard.render.com), escolha **New > Blueprint**, conecte este repositório, selecione a branch com esse arquivo e confira o plano Free antes de criar o serviço.

Para configurar por **New > Web Service**, use:

| Campo | Valor |
| --- | --- |
| Language | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 4 --forwarded-allow-ips='*' --access-logfile - 'app:create_app()'` |
| Instance Type | Free |
| Health Check Path | `/api/health` |

Após o deploy, `/api/health` deve responder `{"status":"ok"}`. O comando usa a fábrica `create_app()`; este projeto não expõe uma variável global `app`.

O parâmetro `--forwarded-allow-ips='*'` permite que o Gunicorn reconheça o HTTPS informado pelo proxy do Render, mantendo a validação de origem ao salvar. Use esse comando somente atrás do proxy da plataforma; não exponha diretamente essa configuração de Gunicorn à internet.

**Armazenamento:** no Render, Salvar diagrama grava no servidor. No plano gratuito, o SQLite é temporário e seus dados são perdidos em reinícios, novos deploys ou suspensão por inatividade. Use **Exportar > JSON** para guardar o arquivo no computador e a importação de JSON para restaurá-lo. Links de diagramas salvos deixam de funcionar quando o banco é recriado. O serviço gratuito suspende após 15 minutos sem tráfego e pode demorar a atender o próximo acesso. Consulte as [limitações oficiais](https://render.com/docs/free).

**Acesso público:** o editor não tem autenticação nem isolamento entre usuários. Qualquer pessoa pode listar, consultar e alterar diagramas salvos pela API. Essa configuração serve para demonstrações com dados não confidenciais. Não envie o banco local `instance/diagrams.sqlite3` ao repositório ou ao Render. Uso privado com armazenamento permanente exige outra configuração.

## Estrutura

| Arquivo | Responsabilidade |
| --- | --- |
| app.py | API Flask, validação e SQLite |
| templates/index.html | Estrutura da interface |
| static/app.js | Interações, propriedades, edição e exportações |
| static/graph.mjs | Modelo, geometria e hierarquia |
| static/alignment.mjs | Guias e encaixes |
| static/selection.mjs | Seleção múltipla |
| static/catalog.json | Catálogo de componentes |
| static/catalog.mjs | Busca e filtros |
| static/icons.mjs e static/icons/ | Carregamento, logos e fontes |
| static/styles.css e static/sketch.css | Estilos base e tema |
| static/examples/ | Exemplos adicionais |
| run.ps1 | Inicialização no Windows |
| tests/ | Testes da API e persistência |
| AGENTS.md | Orientações para manutenção |

## Desenvolvimento

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Em Linux/macOS, use `.venv/bin/python`. Para mudanças visuais, verifique o fluxo no navegador e as exportações afetadas. Leia [AGENTS.md](AGENTS.md) antes de alterar o projeto.

## Ícones e marcas

As marcas pertencem aos respectivos titulares e não indicam afiliação ou patrocínio. As fontes estão em [static/icons/README.md](static/icons/README.md) e nos manifestos dessa pasta. Oracle e MariaDB usam arquivos da biblioteca Devicon, conforme o [registro de origem](static/icons/shared/oracle-mariadb-sources.json).
