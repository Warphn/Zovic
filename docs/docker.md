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
   (cd api && bun install && bun run db:generate)   # db:generate: client do Prisma
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

Migrations, Prisma e como acessar o banco estão em [Banco de dados](banco-de-dados.md).

## Produção (desktop)

O servidor roda o profile `prod`: banco, migrations, API e o `cloudflared`, que publica a API pelo Cloudflare Tunnel sem abrir portas no roteador. O frontend não sobe ali; ele fica na Vercel.

No servidor, a partir do clone com o `.env` de produção:

| Comando | O que faz |
| --- | --- |
| `bun server` | menu com as opções abaixo |
| `bun server up` | sobe (ou aplica mudanças), espera tudo ficar de pé e testa o endereço público |
| `bun server down` | derruba tudo, inclusive o túnel; o banco continua no volume |
| `bun server status` | estado dos containers e do endereço público |
| `bun server logs [db\|flyway\|api\|cloudflared]` | acompanha os logs (Ctrl+C para sair) |
| `bun server update` | `git pull` e sobe a versão nova |

O `bun server up` se recusa a rodar sem o `.env` ou com o token do túnel, a senha do banco ou o segredo do login vazios. Por baixo, ele roda `docker compose --profile prod up -d --build --wait`.

- O `.env` do servidor é diferente do de desenvolvimento: senhas e segredos fortes, `COOKIE_SECURE=true`, `TRUST_PROXY=1` e o `CLOUDFLARE_TUNNEL_TOKEN`. Ele só existe no servidor e nunca vai para o git.
- A API e o banco só aceitam conexões da própria máquina (`127.0.0.1`). De fora, a API chega pelo túnel em `api.zovic.com.br`; o banco chega pelo túnel em `db.zovic.com.br`, só para a equipe, atrás do Cloudflare Access (veja abaixo).
- O `cloudflared` fica numa rede com a API e o banco. O que ele publica é o que está cadastrado como rota do túnel na Cloudflare.
- Cada container tem um teto de recursos, para um pico não disputar a máquina inteira: `db` 2 CPUs e 2 GiB, `api` 2 CPUs e 1 GiB, `cloudflared` 0,5 CPU e 256 MiB, além de um limite de processos.
- `db`, `api` e `cloudflared` têm `restart: unless-stopped` e voltam sozinhos depois de um reinício, desde que o Docker Desktop abra no login. Depois de um `bun server down` (ou `bun stop`), eles só voltam com `bun server up`.

### Acesso da equipe ao banco de produção

Cada integrante tem um usuário próprio no Postgres. O grupo `equipe` lê e altera dados de todas as tabelas, mas não muda o schema (quem muda é o Flyway), não lê as tabelas com segredos do Better Auth (`session`, `account`, `verification`) e só lê o `flyway_schema_history`. Cada usuário tem no máximo 3 conexões e consultas de até 60 s. Como conectar está em [Banco de dados](banco-de-dados.md#banco-de-produção).

No servidor, a partir do clone com o `.env` de produção e com o servidor no ar:

| Comando | O que faz |
| --- | --- |
| `bun db:member add <nome>` | cria o usuário e mostra a senha uma única vez |
| `bun db:member reset <nome>` | gera uma senha nova |
| `bun db:member remove <nome>` | encerra as conexões e apaga o usuário |
| `bun db:member list` | lista os usuários da equipe |

Envie a senha a cada pessoa por um canal privado. Ela não é guardada em lugar nenhum. Do lado de cada integrante, `bun db:connect` (na raiz do repositório) faz o login no Access e abre o caminho até o banco em `localhost:15432`.

Na Cloudflare, uma vez:

1. **Zero Trust → Access → Applications → Add an application → Self-hosted**, com o domínio `db.zovic.com.br`. Política **Allow** com a regra **Emails**, listando o e-mail de cada integrante; login por **One-time PIN**. Crie a aplicação **antes** da rota, para o banco nunca ficar exposto sem ela.
2. No túnel `zovic-desktop`: **Routes → Add route → Published application**, subdomínio `db`, domínio `zovic.com.br`, Service URL `tcp://db:5432`.

Para tirar alguém: `bun db:member remove <nome>` e o e-mail da pessoa sai da política do Access.

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
