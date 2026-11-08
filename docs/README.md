# Documentação do Zovic

Para subir o projeto e ver os comandos do dia a dia, comece pelo [README da raiz](../README.md).

| Documento | O que tem |
| --- | --- |
| [API](api.md) | Login, variáveis do `.env`, rotas e regras da busca e das playlists |
| [Banco de dados](banco-de-dados.md) | Migrations, Prisma, seed e como acessar o banco local e o de produção |
| [Ambiente com Docker](docker.md) | O que o `bun start` sobe e como adicionar uma biblioteca, uma variável ou um serviço |
| [Servidor de produção](servidor.md) | Como o servidor funciona, como operá-lo e os problemas comuns |
| [Modelo ER](modelo-er.md) | O diagrama do banco e o que cada tabela guarda |
| [Models](models.md) | As entidades do domínio, as portas e os repositórios da API |
| [Uso de IA](prompts/prompts.md) | Os prompts usados nas partes feitas com ajuda de IA |

## Tecnologias

| Parte | Tecnologia |
| --- | --- |
| Backend | TypeScript, Express e Joi |
| Frontend | TypeScript e Next.js |
| Banco de dados | PostgreSQL, com migrations no Flyway e o client do Prisma |
| Autenticação | Better Auth |
| Ferramentas | Bun (runtime e pacotes), Docker e Oxlint |
