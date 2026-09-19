# Ícones oficiais

Os SVGs desta pasta têm origem nos arquivos oficiais dos respectivos fornecedores. Cores, formas e proporções são preservadas. Os ícones são carregados localmente e incorporados como imagens em base64 no SVG exportado, sem dependências externas.

| Origem | Biblioteca | Registro dos arquivos |
| --- | --- | --- |
| AWS | [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/) — pacote de 31/07/2026 | [aws/sources.json](aws/sources.json) |
| Google Cloud | [Biblioteca oficial](https://cloud.google.com/icons) — sistema atual de produtos e categorias | [gcp/sources.json](gcp/sources.json) |
| Apache Airflow | [Materiais oficiais](https://airflow.apache.org/community/#resources) | [shared/sources.json](shared/sources.json) |
| Aplicações de dados | Sites e repositórios oficiais de cada projeto | [shared/data-sources.json](shared/data-sources.json) |

O [guia do Google Cloud](https://services.google.com/fh/files/misc/google-cloud-product-icons.pdf) orienta usar o ícone da categoria quando um produto não tem ícone próprio. Por isso alguns serviços GCP compartilham o mesmo símbolo, com o nome do serviço ao lado.

Elementos genéricos e agrupamentos sem marcador oficial correspondente mantêm símbolos próprios do editor. A subnet genérica da AWS não recebe o marcador de subnet pública ou privada. O componente `aws-ecs` usa o ícone do ECS.

Os nomes, ícones e marcas pertencem aos respectivos titulares; a inclusão no editor não indica patrocínio ou endosso. Os manifestos registram as fontes, os arquivos e as observações de uso fornecidas pelos publicadores.

Para acrescentar um ícone, guarde o SVG original em uma subpasta, registre a fonte e associe `iconAsset: "/static/icons/provedor/arquivo.svg"` ao tipo em `static/catalog.json`. Mantenha imagens independentes e sem referências externas; não cole seus estilos no SVG principal do editor.

O ícone do Apache Flink isola o esquilo colorido da prancha oficial de logos, mantendo os caminhos e as cores originais e ajustando apenas o enquadramento. O Redis usa o símbolo compacto oficial, sem o nome por extenso.
