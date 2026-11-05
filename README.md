# Zovic

Plataforma de streaming de música. API em Bun + Express + PostgreSQL e front em Next.js.

O repositório tem dois projetos, `api/` e `frontend/`. A raiz guarda o que é comum aos dois: o `docker-compose.yml`, o `.env` e os scripts `bun start` e `bun stop`.

## Pré-requisitos

- [Bun](https://bun.sh), na versão do campo `packageManager` do `package.json`.
- Um runtime de Docker aberto: Docker Desktop, OrbStack ou Colima.

## Primeira vez

Na raiz, logo depois de clonar:

```bash
bun install          # instala os hooks de git e o menu do bun start
bun start            # responda "Sim" em "É o seu primeiro acesso?"
```

No primeiro acesso, o `bun start` cria o `.env` a partir do `.env.example`, roda o `bun install` em `api/` e `frontend/`, gera o client do Prisma, sobe o Docker e popula o banco com dados de teste.

## Dia a dia

```bash
bun start            # sobe o ambiente
bun stop             # para todos os containers (o banco continua salvo)
```

O `bun start` pergunta três coisas:

1. **O que você vai fazer?** Escolha o que vai editar. Isso roda na sua máquina, e o resto roda no Docker:

   | Opção | O Docker sobe | Você roda depois |
   | --- | --- | --- |
   | `backend` | banco e migrations | `cd api && bun dev` |
   | `frontend` | banco, migrations e API | `cd frontend && bun dev` |
   | `full` | o sistema inteiro | nada, é só abrir o site |
   | `banco de produção` | nada: abre o acesso ao banco do servidor (o mesmo que `bun db:connect`) | o DBeaver ou o `psql` |

2. **É o seu primeiro acesso?** "Sim" cria o `.env` (se ainda não existir), roda o `bun install` e gera o client do Prisma. Nas outras vezes, responda "Não".
3. **Quer popular o banco?** **Não** mantém os dados. **LOCAL** apaga o banco local e insere os dados de teste. **PROD** insere só os dados reais (tipos de plano e gêneros), sem apagar nada.

Para pular as perguntas, passe as respostas como argumentos: `bun start backend`, `bun start frontend --seed=local` ou `bun start full --first`.

### Endereços

| Serviço | Endereço |
| --- | --- |
| Frontend | http://localhost:3000 |
| API | http://localhost:3333 |
| Swagger (documentação das rotas) | http://localhost:3333/docs |
| Postgres | `localhost:5432` (usuário, senha e banco: `zovic`) |

Em produção, o site fica em https://zovic.com.br e a API em https://api.zovic.com.br.

## Comandos

### Na raiz

| Comando | O que faz |
| --- | --- |
| `bun start` | Sobe o ambiente de desenvolvimento (veja [Dia a dia](#dia-a-dia)) |
| `bun stop` | Para todos os containers. Os dados do banco continuam salvos. |
| `bun admin:promote <email>` | Torna um usuário admin. Com `--revoke`, volta a ser assinante. Grava no banco do `.env`. |
| `bun db:connect` | Abre o acesso ao banco de produção em `localhost:15432` (veja [Banco de produção](docs/banco-de-dados.md#banco-de-produção)) |
| `bun server` | Opera o servidor de produção. Só faz sentido no servidor (veja [Servidor de produção](docs/servidor.md)). |
| `bun db:member` | Cria e remove os usuários da equipe no banco de produção. Também só roda no servidor. |

### Em `api/`

| Comando | O que faz | Quando rodar |
| --- | --- | --- |
| `bun dev` | Sobe a API em http://localhost:3333 e reinicia a cada mudança | Para trabalhar no backend |
| `bun install` | Instala as dependências | Depois de um `git pull` que muda o `api/bun.lock` |
| `bun run db:sync` | Lê o banco, atualiza o `schema.prisma` e gera o client do Prisma | Depois de criar ou receber uma migration |
| `bun run db:generate` | Só gera o client do Prisma, sem consultar o banco | Depois do `bun install` |
| `bun run db:seed` | Apaga o banco local e insere os dados de teste | Para ter dados para testar ou para voltar a um estado limpo |
| `bun run test` | Testes do domínio, sem banco | Antes de commitar |
| `bun run test:integration` | Testes das rotas e dos repositórios, no Postgres (precisa do banco no ar) | Antes de commitar uma mudança no banco ou nas rotas |
| `bun run typecheck` | Confere os tipos do TypeScript | Antes de commitar |
| `bun run lint` | Procura problemas no código. `lint:fix` corrige o que for automático. | Antes de commitar |

### Em `frontend/`

| Comando | O que faz | Quando rodar |
| --- | --- | --- |
| `bun dev` | Sobe o Next em http://localhost:3000, com hot reload | Para trabalhar no front |
| `bun install` | Instala as dependências | Depois de um `git pull` que muda o `frontend/bun.lock` |
| `bun run test` | Testes do front | Antes de commitar |
| `bun run lint` | Procura problemas no código. `lint:fix` corrige o que for automático. | Antes de commitar |

### Docker (na raiz)

O `bun start` e o `bun stop` já chamam o Docker por você. Estes comandos servem para investigar algum problema:

| Comando | O que faz |
| --- | --- |
| `docker compose ps` | Mostra o que está rodando |
| `docker compose logs -f api` | Acompanha os logs de um serviço (`db`, `flyway`, `api` ou `web`) |
| `docker compose up flyway` | Aplica as migrations novas no banco local |
| `docker compose down -v` | Para tudo e **apaga o banco local**. O próximo `bun start` recria o banco do zero. |

## Situações comuns

**Fiz `git pull` e algo parou de funcionar.** Rode `bun install` na pasta cujo `bun.lock` mudou. Se chegou uma migration nova, rode `bun start`, que a aplica no banco, e depois `bun run db:generate` em `api/`, para o client do Prisma acompanhar o `schema.prisma` novo. Se a mudança foi no backend e você usa o `frontend`, rode `bun start frontend` de novo, porque ele refaz a imagem da API.

**Quero o banco limpo, com os dados de teste.** Rode `bun start` e escolha **LOCAL**. Se o banco estiver quebrado (uma migration que falhou pela metade, por exemplo), rode `docker compose down -v` antes.

**Criei uma migration.** Crie o arquivo em `db/migrations/` com o nome no padrão, rode `docker compose up flyway` e depois `bun run db:sync` em `api/`. As regras estão em [Banco de dados](docs/banco-de-dados.md#migrations-flyway).

**Vou adicionar uma biblioteca.** Na pasta do projeto, `bun add nome-da-lib`, e commite o `package.json` e o `bun.lock` juntos. Combine a dependência nova com o time antes.

**O `git push` foi cancelado.** Antes de todo push, o hook roda o typecheck e os testes. Os testes de integração só rodam se o banco estiver no ar. Corrija o que falhou e tente de novo. O `git push --no-verify` pula o hook, mas é só para emergências.

**O commit foi bloqueado.** O pre-commit roda o lint nos arquivos do commit. Rode `bun run lint:fix` na pasta do projeto e corrija o resto à mão.

## Contas de teste e fluxo do admin

Depois do seed LOCAL, toda conta de teste entra com o email `nome.sobrenome@zovic.test`, em minúsculas e sem acentos, e a senha `zovic123`.

| Conta | Para que serve |
| --- | --- |
| `admin@zovic.test`, senha `admin` | Admin padrão, sem plano. Só existe no seed LOCAL. |
| `elisa.andrade@zovic.test` | Admin com plano |
| `ana.andrade@zovic.test` | Assinante maior de idade |
| `heitor.costa@zovic.test` e `isabela.costa@zovic.test` | Menores de idade |

Um admin vê **Painel de admin** no menu da conta, que abre `/admin` com três abas:

- **Visão geral:** usuários, reproduções, as 10 músicas mais tocadas e as reproduções por gênero.
- **Usuários:** cria e remove contas e mostra as últimas 50 reproduções de cada uma.
- **Conteúdo:** cria, edita e remove músicas e artistas.

Para tornar outra conta admin, rode `bun admin:promote pessoa@exemplo.com` na raiz.

Para demonstrar o plano familiar, entre como `ana.andrade@zovic.test`, assine o Família e inclua `heitor.costa@zovic.test`. Depois entre como Heitor no mesmo navegador: ele acessa o catálogo pelo plano da Ana. As assinaturas ainda ficam só no navegador.

## Documentação

| Documento | O que tem |
| --- | --- |
| [API](docs/api.md) | Login, variáveis do `.env`, rotas e regras da busca e das playlists |
| [Banco de dados](docs/banco-de-dados.md) | Migrations, Prisma, seed e como acessar o banco local e o de produção |
| [Ambiente com Docker](docs/docker.md) | Como adicionar uma biblioteca, uma variável de ambiente ou um serviço |
| [Servidor de produção](docs/servidor.md) | Como o servidor funciona e como operá-lo |
| [Modelo ER](docs/modelo-er.md) e [Models](docs/models.md) | O modelo de dados e as entidades do domínio |
| [CLAUDE.md](CLAUDE.md) | Padrões de código, commits, branches, PRs e o board |
