# Ambiente com Docker

O Docker roda os **serviços** de que o projeto precisa (Postgres, Flyway) e, quando necessário, as próprias **aplicações** (API e frontend), com as mesmas versões para toda a equipe.

## O que cada peça controla

| O quê | Quem define a versão | Onde |
| --- | --- | --- |
| Bibliotecas (`express`, `next`, `joi`…) | `bun.lock` | `api/bun.lock` e `frontend/bun.lock` |
| Bun | campo `packageManager` e a imagem `oven/bun` | os três `package.json` (raiz, `api/`, `frontend/`) e os dois `Dockerfile` |
| Postgres e Flyway | tag da imagem | `docker-compose.yml` |

Os `Dockerfile` não escolhem versões de biblioteca: eles rodam `bun install --frozen-lockfile`, que instala exatamente o que está no `bun.lock` e falha se ele estiver desatualizado.

## O que o `bun start` sobe

Para subir o ambiente, use o `bun start` (veja o [README](../README.md#dia-a-dia)). Por baixo, ele roda um destes comandos, conforme a opção:

| Opção | Comando | O que sobe |
| --- | --- | --- |
| `backend` | `docker compose up -d` | Banco e migrations |
| `frontend` | `docker compose --profile frontend up -d --build` | Banco, migrations e API |
| `full` | `docker compose --profile full up -d --build` | Banco, migrations, API e front |

Cada profile acrescenta uma camada à anterior. O `--build` refaz as imagens, para a API e o front no Docker ficarem com o código atual. O `bun stop` roda `docker compose --profile full --profile prod down`, que para os serviços de todos os profiles.

Os containers e o banco de desenvolvimento ficam no projeto `zovic-dev`, definido pelo `COMPOSE_PROJECT_NAME` do `.env`. Sem essa variável, o Compose usa o nome da pasta, e um clone numa pasta `Zovic` cairia no mesmo projeto do servidor de produção (`~/zovic`), com os mesmos containers e o mesmo banco. Isso só importa na máquina que também roda o servidor. Um `.env` antigo, sem a variável, continua funcionando como antes.

Migrations, Prisma e como acessar o banco estão em [Banco de dados](banco-de-dados.md).

## Produção

O servidor de produção roda no desktop da equipe com o profile `prod`: banco, migrations, API, frontend e o `cloudflared`, que publica tudo pelo Cloudflare Tunnel. Ele é operado com `bun server` (`up`, `down`, `status`, `logs`, `update`).

Como ele funciona, os comandos, o `.env` de produção, a configuração da Cloudflare, o acesso da equipe ao banco e os problemas comuns estão em [Servidor de produção](servidor.md).

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

- Se só a API usa o serviço, coloque-o nos mesmos profiles dela: `profiles: [frontend, full, prod]`.
- Se a aplicação precisa esperar o serviço subir, use `depends_on` na aplicação.
- Dentro do compose, os serviços se encontram **pelo nome**: a API acessa `redis:6379`, não `localhost:6379`.

### Atualizando uma versão (Bun, Postgres, Flyway)

Troque a tag em todos os lugares listados na tabela do início, e no mesmo commit. A versão do Bun, por exemplo, aparece no `packageManager` dos três `package.json` e no `FROM` dos dois `Dockerfile`.

> **Cuidado com o Postgres:** subir a versão *maior* (16 → 17) não aproveita o volume antigo. Rode `docker compose down -v` (apagando o banco local) depois da troca.
