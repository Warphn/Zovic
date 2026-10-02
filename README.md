# Zovic

O projeto consiste em um site para streaming de músicas.

## Tecnologias

- **Backend:** TypeScript, Express, Joi
- **Frontend:** TypeScript, Next.js
- **Banco de dados:** PostgreSQL
- **Migrations:** Flyway
- **Ferramentas:** Bun (runtime e pacotes), Docker, Oxlint

## Rodando o projeto

Pré-requisitos: [Bun](https://bun.sh) e um runtime de Docker (OrbStack, Docker Desktop ou Colima).

O repositório tem dois projetos independentes, `api/` e `frontend/`. O `docker compose` roda sempre **na raiz**; o `bun dev` roda **dentro da pasta** do projeto.

### Jeito rápido

Na raiz:

```bash
bun start    # escolhe frontend, backend ou full e diz se é o primeiro acesso
bun stop     # para todos os containers (o banco continua salvo)
```

No primeiro acesso, o `bun start` cria o `.env`, roda o `bun install` do que for preciso e sobe o Docker. Nos outros, só sobe o Docker. Também dá para pular as perguntas: `bun start backend` ou `bun start backend --first`.

Logo depois de clonar, rode `bun install` na raiz uma vez antes do `bun start`: o próprio script depende da biblioteca do menu.

As seções abaixo mostram o que o script faz por baixo, para quem preferir rodar à mão.

### Primeira vez

```bash
cp .env.example .env
bun install                      # só os hooks de git; uma vez e pronto
```

### Backend

```bash
cd api && bun install            # 1ª vez e quando o api/bun.lock mudar
```

```bash
docker compose up                # terminal 1, na raiz: banco + migrations
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

O `--build` refaz a imagem da API; sem mudanças no backend, pode omitir.

### Endereços

| Serviço  | URL                     |
| -------- | ----------------------- |
| Frontend | http://localhost:3000   |
| API      | http://localhost:3333   |
| Postgres | localhost:5432          |

Mais detalhes (adicionar libs, variáveis e serviços): [docs/docker.md](docs/docker.md).

### Lint

Os dois projetos usam [Oxlint](https://oxc.rs), configurado no `.oxlintrc.json` de cada pasta. Ele roda sozinho no pre-commit, só nos arquivos do commit, e bloqueia o commit se houver erro.

```bash
bun run lint       # em api/ ou frontend/
bun run lint:fix   # corrige o que for automático
```
