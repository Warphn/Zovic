# Ambiente com Docker

O Docker roda os **serviços** de que o projeto precisa (Postgres, Flyway) e, quando necessário, as próprias **aplicações** (API e frontend), com as mesmas versões para toda a equipe.

## O que cada peça controla

| O quê | Quem define a versão | Onde |
| --- | --- | --- |
| Bibliotecas (`express`, `next`, `joi`…) | `bun.lock` | `api/bun.lock` e `frontend/bun.lock` |
| Bun | campo `packageManager` e a imagem `oven/bun` | os três `package.json` (raiz, `api/`, `frontend/`) e os dois `Dockerfile` |
| Postgres e Flyway | tag da imagem | `docker-compose.yml` |

Os `Dockerfile` não escolhem versões de biblioteca: eles rodam `bun install --frozen-lockfile`, que instala exatamente o que está no `bun.lock` e falha se ele estiver desatualizado.

## Primeira vez

1. Instale um runtime de Docker: [Docker Desktop](https://www.docker.com/products/docker-desktop/), [OrbStack](https://orbstack.dev) ou [Colima](https://github.com/abiosoft/colima). Os comandos são os mesmos em todos. Confira a licença de cada um antes de escolher.
2. Instale o [Bun](https://bun.sh) na versão do campo `packageManager`.
3. Na raiz do repositório:

   ```bash
   cp .env.example .env   # o .env não vai para o git; ajuste os valores se quiser
   bun install            # raiz: só os hooks de git (husky, lint-staged)
   (cd api && bun install)
   (cd frontend && bun install)
   ```

O repositório tem dois projetos independentes, `api/` e `frontend/`, cada um com seu `package.json`, `bun.lock`, `tsconfig.json` e `Dockerfile`. A raiz guarda só o que é do repositório inteiro: o `docker-compose.yml`, o `.env` e os hooks de git.

## Subindo o ambiente

A regra: **o que você está editando roda na sua máquina, com `bun dev`; o resto roda no Docker.**

| Você está trabalhando em… | No Docker | Na sua máquina |
| --- | --- | --- |
| Backend | `docker compose up` | `bun dev` em `api/` (lê o `.env` da raiz) |
| Frontend | `docker compose --profile frontend up --build` | `bun dev` em `frontend/` |
| Nada — só quer ver o sistema rodando | `docker compose --profile full up --build` | — |

Cada profile adiciona uma camada: sem profile sobem o banco e as migrations; `frontend` acrescenta a API, que é o que o frontend consome; `full` acrescenta o próprio frontend, para ver o sistema inteiro.

| Serviço | Endereço |
| --- | --- |
| Postgres | `localhost:5432` |
| API | `http://localhost:3333` |
| Frontend | `http://localhost:3000` |

### Comandos do dia a dia

| Comando | O que faz |
| --- | --- |
| `docker compose ps` | mostra o que está rodando |
| `docker compose logs -f api` | acompanha os logs de um serviço |
| `docker compose down` | para tudo; os dados do banco continuam no volume |
| `docker compose down -v` | para tudo **e apaga o banco** |

Rode `up -d` para deixar os serviços em segundo plano.

## Adicionando coisas

### Uma biblioteca nova

**Não precisa mexer em nenhum arquivo do Docker.**

```bash
cd frontend          # ou api/, se a lib for do backend
bun add nome-da-lib  # atualiza package.json e bun.lock
```

Faça commit do `package.json` **e** do `bun.lock` juntos. Quem roda as aplicações pelo Docker passa a receber a lib nova ao subir com `--build`, que refaz a imagem:

```bash
docker compose --profile full up --build
```

Quem roda `bun dev` na própria máquina só precisa de um `bun install` depois do `git pull`.

> Se o build da imagem falhar com erro de lockfile, alguém commitou o `package.json` sem o `bun.lock` atualizado. Rode `bun install` e commite o `bun.lock`.

### Uma variável de ambiente nova

1. Acrescente a variável ao `.env.example`, com um valor de exemplo e um comentário.
2. Se uma aplicação **dentro do Docker** precisa dela, repasse-a no `environment:` do serviço em `docker-compose.yml`:

   ```yaml
   api:
     environment:
       NOVA_VARIAVEL: ${NOVA_VARIAVEL}
   ```

3. Avise a equipe para atualizar o próprio `.env`.

### Um serviço novo (Redis, fila, storage…)

Acrescente uma entrada em `services:` no `docker-compose.yml`, sempre com uma **tag de versão exata**, nunca `latest`:

```yaml
  redis:
    image: redis:7.4.2
    ports: ["127.0.0.1:6379:6379"]
```

- Se só a API usa o serviço, coloque-o nos mesmos profiles dela: `profiles: [frontend, full]`.
- Se a aplicação precisa esperar o serviço subir, use `depends_on` na aplicação.
- Dentro do compose, os serviços se encontram **pelo nome**: a API acessa `redis:6379`, não `localhost:6379`.

### Atualizando uma versão (Bun, Postgres, Flyway)

Troque a tag em todos os lugares listados na tabela do início, e no mesmo commit. A versão do Bun, por exemplo, aparece no `packageManager` dos três `package.json` e no `FROM` dos dois `Dockerfile`.

> **Cuidado com o Postgres:** subir a versão *maior* (16 → 17) não aproveita o volume antigo. Rode `docker compose down -v` (apagando o banco local) depois da troca.
