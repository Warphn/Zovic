# Zovic

O projeto consiste em um site para streaming de músicas.

## Tecnologias

- **Backend:** TypeScript, Express, Joi
- **Frontend:** TypeScript, Next.js
- **Banco de dados:** PostgreSQL
- **Migrations:** Flyway
- **ORM:** Prisma (só o client; a estrutura do banco é do Flyway)
- **Ferramentas:** Bun (runtime e pacotes), Docker, Oxlint

## Rodando o projeto

Pré-requisitos: [Bun](https://bun.sh) e um runtime de Docker (OrbStack, Docker Desktop ou Colima).

O repositório tem dois projetos independentes, `api/` e `frontend/`. O `docker compose` roda sempre **na raiz**; o `bun dev` roda **dentro da pasta** do projeto.

### Jeito rápido

Logo depois de clonar, na raiz, uma vez só:

```bash
bun install    # hooks de git e o menu do bun start
```

Depois, sempre que for trabalhar, também na raiz:

```bash
bun start      # pergunta o ambiente, se é o primeiro acesso e se quer popular o banco
bun stop       # para todos os containers (o banco continua salvo)
```

O `bun start` faz três perguntas:

| Pergunta | Opções |
| --- | --- |
| Cê vai fazer o que, Zé? | `frontend`, `backend` ou `full` |
| É o seu primeiro acesso? | Se sim, cria o `.env`, roda o `bun install` do que for preciso e gera o client do Prisma |
| Quer popular o banco? | **Não**, **LOCAL** (dados de teste; apaga o banco local antes) ou **PROD** (só os dados reais, sem apagar nada) |

Depois ele sobe o Docker e, se você escolheu um seed, espera as migrations terminarem e popula o banco. No primeiro acesso, a resposta padrão do seed é LOCAL, já que o banco começa vazio.

Para pular as perguntas, passe tudo nos argumentos: `bun start backend`, `bun start backend --first` ou `bun start frontend --seed=local`. Sem `--seed`, nada é populado.

As seções abaixo mostram o que o script faz por baixo, para quem preferir rodar à mão.

### Primeira vez

```bash
cp .env.example .env
bun install                      # na raiz: hooks de git e o menu do bun start
```

### Backend

```bash
cd api && bun install            # 1ª vez e quando o api/bun.lock mudar
bun run db:generate              # em api/: gera o client do Prisma (1ª vez e quando o schema mudar)
```

```bash
docker compose up                # terminal 1, na raiz: banco + migrations
bun run db:seed                  # terminal 2, em api/ (opcional): popula o banco com dados de teste
bun dev                          # terminal 2, em api/: API com reload
```

### Frontend

```bash
cd frontend && bun install       # 1ª vez e quando o frontend/bun.lock mudar
```

```bash
docker compose --profile frontend up --build   # terminal 1, na raiz: banco + migrations + API
bun dev                                        # terminal 2, em frontend/: Next com hot reload
```

Para ter dados no banco, popule pela `api/`. Isso exige instalar as dependências dela uma vez:

```bash
cd api && bun install && bun run db:generate && bun run db:seed
```

O `--build` refaz a imagem da API; sem mudanças no backend, pode omitir.

### Endereços

| Serviço  | URL                     |
| -------- | ----------------------- |
| Frontend | http://localhost:3000   |
| API      | http://localhost:3333   |
| Postgres | localhost:5432          |

Mais detalhes (adicionar libs, variáveis e serviços): [docs/docker.md](docs/docker.md).

Migrations, Prisma, seed e como ver o banco: [docs/banco-de-dados.md](docs/banco-de-dados.md).

### Lint

Os dois projetos usam [Oxlint](https://oxc.rs), configurado no `.oxlintrc.json` de cada pasta. Ele roda sozinho no pre-commit, só nos arquivos do commit, e bloqueia o commit se houver erro.

```bash
bun run lint       # em api/ ou frontend/
bun run lint:fix   # corrige o que for automático
```

### Testes

```bash
bun run test               # em api/ ou frontend/: testes rápidos, sem banco
bun run test:integration   # em api/: repositórios no Postgres (precisa do banco no ar)
bun run typecheck          # em api/
```

Antes de todo `git push`, o hook `.husky/pre-push` roda o typecheck e os testes da API e os testes do frontend, e **cancela o push se algo falhar**. Os testes de integração só rodam se o container `db` estiver no ar; senão, o hook avisa e segue. Numa emergência, `git push --no-verify` pula o hook.
