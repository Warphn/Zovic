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

### Autenticação

A autenticação é feita pelo [Better Auth](https://www.better-auth.com), com email e senha e sessão guardada no banco. O login define o cookie `zovic.session_token` (httpOnly, SameSite=Lax); o navegador o envia nas próximas requisições. As rotas ficam em `/api/auth/*`: `sign-up/email`, `sign-in/email`, `sign-out` e `get-session`. A documentação OpenAPI (Swagger UI) está em http://localhost:3333/docs e a coleção do Bruno (`api/bruno/`) tem exemplos prontos.

Depois de `bun run db:seed` (LOCAL), todo usuário de teste entra com a senha `zovic123` e o email `nome.sobrenome@zovic.test`, minúsculo e sem acentos. Por exemplo:

```bash
curl -i -c cookies.txt -X POST http://localhost:3333/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"ana.andrade@zovic.test","password":"zovic123"}'
curl -b cookies.txt http://localhost:3333/api/auth/get-session
curl -b cookies.txt -X POST http://localhost:3333/api/auth/sign-out \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3000" -d '{}'
```

O `sign-out` (e qualquer POST feito com cookie) precisa do header `Origin`, que o navegador já manda; a origem tem de estar em `CORS_ORIGIN`. Os usuários que existiam antes do Better Auth não têm email nem senha e não conseguem entrar. O seed PROD não cria credenciais.

Segurança: a senha tem de 8 a 128 caracteres e é guardada com hash scrypt (do Better Auth); a sessão dura 30 dias, renovada a cada 15 dias de uso; o login permite 5 tentativas por 15 minutos por IP e o cadastro 10 por hora. Usuário com soft delete (`deleted_at`) não loga e perde as sessões que tinha. Esqueci minha senha, confirmação de email e login social ainda não estão ligados, mas o schema já tem as tabelas `account` e `verification`.

> **Atenção: diferença em relação à spec.** O Better Auth guarda o **token de sessão em texto puro** no banco (coluna `token` da tabela de sessões). A spec ([docs/superpowers/specs/2026-10-20-autenticacao-design.md](docs/superpowers/specs/2026-10-20-autenticacao-design.md)) tinha isso como anti-objetivo, e a implementação própria anterior guardava só o hash SHA-256 do token. Na prática, quem conseguir ler o banco consegue usar as sessões abertas. A senha também passou a usar o hash **scrypt**, padrão do Better Auth, no lugar do **Argon2id**. Isso é o comportamento padrão da biblioteca. Dá para mitigar depois, por exemplo com armazenamento secundário de sessões ou criptografia do token. A implementação própria, que atende à spec, está guardada na branch local `auth-propria`.

Variáveis do `.env`:

| Variável | Para que serve |
| --- | --- |
| `BETTER_AUTH_SECRET` | **Obrigatória.** Segredo (32+ caracteres) que assina o cookie de sessão. O `.env.example` traz um valor só para desenvolvimento; em produção gere um segredo forte (`openssl rand -base64 32`). **Quem já tem um `.env` precisa acrescentar essa linha.** |
| `BETTER_AUTH_URL` | URL pública da API, sem o `/api/auth`. Padrão: `http://localhost:<PORT>`. |
| `CORS_ORIGIN` | Origens do frontend (separadas por vírgula) aceitas pelo Better Auth nas requisições com cookie. |
| `COOKIE_SECURE` | Se a variável faltar, a API (fora do docker compose) emite o cookie com `Secure` (e o nome ganha o prefixo `__Secure-`), e o navegador (ou o curl) não o guarda em `http://`. Em desenvolvimento use `COOKIE_SECURE=false`; o docker compose já assume `false` quando ela falta. Em produção, com HTTPS, deixe ligado. |
| `TRUST_PROXY` | Opcional. Número de proxies confiáveis (inteiro >= 1) para quando a API roda atrás de um proxy reverso com TLS: sem isso o rate limit vê o IP do proxy, não o do cliente. Deixe vazio se a API for exposta direto. |

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
