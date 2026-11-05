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
| Cê vai fazer o que, Zé? | `frontend`, `backend`, `full` ou `banco de produção` (abre o acesso ao banco do servidor, como o `bun db:connect`, e pula as outras perguntas) |
| É o seu primeiro acesso? | Se sim, cria o `.env`, roda o `bun install` do que for preciso e gera o client do Prisma |
| Quer popular o banco? | **Não**, **LOCAL** (dados de teste; apaga o banco local antes) ou **PROD** (só os dados reais, sem apagar nada) |

Depois ele sobe o Docker e, se você escolheu um seed, espera as migrations terminarem e popula o banco. No primeiro acesso, a resposta padrão do seed é LOCAL, já que o banco começa vazio.

Para pular as perguntas, passe tudo nos argumentos: `bun start backend`, `bun start backend --first` ou `bun start frontend --seed=local`. Sem `--seed`, nada é populado.

Para consultar o banco de produção (usuário e senha próprios, enviados por quem administra o servidor), `bun db:connect` (ou `bun start banco`) faz o login no Cloudflare Access e deixa o banco em `localhost:15432`. O passo a passo está em [Banco de dados](docs/banco-de-dados.md#banco-de-produção).

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

Em produção, o site está em https://zovic.com.br e a API em https://api.zovic.com.br, os dois servidos pelo desktop da equipe (`bun server`, veja a seção "Produção" de [docs/docker.md](docs/docker.md)).

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

Segurança: a senha tem de 8 a 128 caracteres e é guardada com hash scrypt (do Better Auth); a sessão dura 30 dias, renovada a cada 15 dias de uso; o login permite 5 tentativas por 15 minutos por IP e o cadastro 10 por hora. Usuário com soft delete (`deleted_at`) não loga e perde as sessões que tinha. O token da sessão só circula no cookie: a API o tira do corpo de todas as respostas de `/api/auth/*` (`api/adapters/http/hide-session-tokens.ts`), para o JavaScript da página nunca lê-lo. Esqueci minha senha, confirmação de email e login social ainda não estão ligados, mas o schema já tem as tabelas `account` e `verification`.

> **Atenção: diferença em relação à spec.** O Better Auth guarda o **token de sessão em texto puro** no banco (coluna `token` da tabela de sessões). A spec ([docs/superpowers/specs/2026-10-20-autenticacao-design.md](docs/superpowers/specs/2026-10-20-autenticacao-design.md)) tinha isso como anti-objetivo, e a implementação própria anterior guardava só o hash SHA-256 do token. Na prática, quem conseguir ler o banco consegue usar as sessões abertas. A senha também passou a usar o hash **scrypt**, padrão do Better Auth, no lugar do **Argon2id**. Isso é o comportamento padrão da biblioteca. Dá para mitigar depois, por exemplo com armazenamento secundário de sessões ou criptografia do token. A implementação própria, que atende à spec, está guardada na branch local `auth-propria`.

**Papel e maioridade** (issue #1). Toda conta tem um papel em `user.role`: `assinante` (padrão) ou `admin`; visitante é quem não tem conta. **Nenhuma rota da API muda o papel**: o cadastro ignora o campo e a rota `update-user` do Better Auth está desligada. Para promover alguém, use o script, que grava direto no banco do `DATABASE_URL` do `.env` (roda da raiz ou de `api/`):

```bash
bun run admin:promote pessoa@exemplo.com
```

```bash
bun run admin:promote pessoa@exemplo.com --revoke
```

O `--revoke` volta a pessoa a `assinante`. O script recusa email inexistente, usuário com soft delete e a retirada do último admin ativo. A mudança vale na próxima requisição, sem precisar entrar de novo.

O `--revoke` volta a pessoa a `assinante`. O script recusa email inexistente, usuário com soft delete e a retirada do último admin ativo. A mudança vale na próxima requisição, sem precisar entrar de novo.

A data de nascimento é obrigatória no cadastro e não pode ser trocada depois (senão um menor viraria maior de idade). O `get-session` devolve `user.role` e `user.isAdult`: maior de idade é quem já completou 18 anos, pelo dia de São Paulo, calculado a cada requisição a partir de `birthdate` (`api/domain/shared/age.ts`). Sem data de nascimento (usuários antigos), `isAdult` é `false`. No seed LOCAL, `elisa.andrade@zovic.test` é admin, há um **admin padrão `admin@zovic.test` com senha `admin`** (só no seed LOCAL: a senha é curta demais para o cadastro e nunca vai para produção) e `heitor.costa@zovic.test` e `isabela.costa@zovic.test` são menores. O frontend mostra o papel e a faixa etária no menu da conta; quem garante as regras é a API.

**Painel de admin.** Para quem tem `role = 'admin'`, o menu da conta (botão laranja no header) mostra **Painel de admin**, em `/admin`, com três abas:

- **Visão geral**: usuários ativos, admins, contas removidas, reproduções e catálogo; acessos por conteúdo (as 10 músicas mais tocadas) e por categoria (reproduções por gênero).
- **Usuários**: todas as contas, inclusive as removidas. O admin cria contas (com email, senha, data de nascimento e papel), remove contas (soft delete, que também derruba as sessões abertas) e vê as últimas 50 reproduções de cada uma. Ninguém remove a própria conta nem o último admin ativo.
- **Conteúdo**: cria, edita (nome, duração, artistas, gêneros) e remove músicas; cria, renomeia e remove artistas. Remover é soft delete. As músicas removidas aparecem para o admin, marcadas, e somem para os demais usuários em `GET /api/musics`.

As rotas ficam em `/api/admin/*` (sem sessão: 401; sem o papel: 403): `GET stats`, `GET|POST users`, `DELETE users/:id`, `GET users/:id/plays`, `POST musics`, `PATCH|DELETE musics/:id`, `POST artists`, `PATCH|DELETE artists/:id`. Para quem tem assinatura ativa ou é admin da plataforma: `GET /api/musics?q=`, `GET /api/artists`, `GET /api/genres` e `POST /api/musics/:id/plays`, que registra uma reprodução (o evento em `user_event`, com a música, e `streams + 1`). As estatísticas contam esses eventos; o player do frontend ainda é simulado e não chama essa rota.

**Assinaturas.** O catálogo (playlists, busca e player) é só para quem tem assinatura ativa, própria ou como membro de um plano familiar. A API verifica isso em cada rota: sem assinatura, responde **403** com `SUBSCRIPTION_REQUIRED`, e o frontend leva a conta para `/planos`. Admins da plataforma passam sem assinatura.

- **Assinar:** só o plano individual, e só maiores de 18 anos. O pagamento é simulado, então a assinatura fica ativa na hora.
- **Plano Família:** aparece em `/planos` como "Em breve", porque a API ainda não cria planos familiares nem convites. Os planos familiares do seed funcionam: quem é membro acessa o catálogo, e quem gerencia pode cancelar.
- **Cancelar:** é imediato, em `/meu-plano`. No plano familiar, todos perdem o acesso, mas as contas continuam. Só o assinante do individual ou o gestor do familiar vê a opção.
- **Ainda não existe:** a restrição de conteúdo para menores, porque a API não tem a marcação de conteúdo explícito.

Para demonstrar, cadastre uma conta nova, porque todo usuário do seed já tem plano: ela cai em `/planos` ao abrir o catálogo, assina e passa a acessá-lo. Para ver os dois papéis do plano familiar, entre como `ana.andrade@zovic.test` (gestora) ou `bruno.andrade@zovic.test` (membro).

**Painel de admin.** Para quem tem `role = 'admin'`, o menu da conta (botão laranja no header) mostra **Painel de admin**, em `/admin`, com três abas:

- **Visão geral**: usuários ativos, admins, contas removidas, reproduções e catálogo; acessos por conteúdo (as 10 músicas mais tocadas) e por categoria (reproduções por gênero).
- **Usuários**: todas as contas, inclusive as removidas. O admin cria contas (com email, senha, data de nascimento e papel), remove contas (soft delete, que também derruba as sessões abertas) e vê as últimas 50 reproduções de cada uma. Ninguém remove a própria conta nem o último admin ativo.
- **Conteúdo**: cria, edita (nome, duração, artistas, gêneros) e remove músicas; cria, renomeia e remove artistas. Remover é soft delete. As músicas removidas aparecem para o admin, marcadas, e somem para os demais usuários em `GET /api/musics`.

As rotas ficam em `/api/admin/*` (sem sessão: 401; sem o papel: 403): `GET stats`, `GET|POST users`, `DELETE users/:id`, `GET users/:id/plays`, `POST musics`, `PATCH|DELETE musics/:id`, `POST artists`, `PATCH|DELETE artists/:id`. Para quem tem assinatura ativa ou é admin da plataforma: `GET /api/musics?q=`, `GET /api/artists`, `GET /api/genres` e `POST /api/musics/:id/plays`, que registra uma reprodução (o evento em `user_event`, com a música, e `streams + 1`). As estatísticas contam esses eventos; o player do frontend ainda é simulado e não chama essa rota.

**No frontend**, as telas `/entrar` e `/cadastro` usam o cliente do Better Auth (`frontend/src/lib/auth/client.ts`), e as áreas logadas (`/playlist`, `/busca`) mandam para `/entrar` quem não tem sessão. O navegador chama a API **direto** (não passa pelo servidor do Next): a API libera a origem do frontend por CORS (`CORS_ORIGIN`) e o cookie é dela, então o JavaScript da página nunca vê a sessão. Para isso funcionar:

- a origem do frontend (ex.: `http://localhost:3000`) precisa estar em `CORS_ORIGIN`;
- frontend e API precisam estar no **mesmo site** (mesmo domínio, portas e subdomínios podem mudar: `localhost:3000` + `localhost:3333`, ou `zovic.com` + `api.zovic.com`), senão o navegador não envia o cookie `SameSite=Lax`;
- o endereço da API vem de `NEXT_PUBLIC_API_URL` (padrão `http://localhost:3333`), lido **no build** do Next. Para mudar, crie `frontend/.env.local` ou passe `--build-arg NEXT_PUBLIC_API_URL=...` na imagem.

O redirecionamento para `/entrar` é só de interface: quem protege os dados é a API, que confere o cookie em toda requisição.

Variáveis do `.env`:

| Variável | Para que serve |
| --- | --- |
| `BETTER_AUTH_SECRET` | **Obrigatória.** Segredo (32+ caracteres) que assina o cookie de sessão. O `.env.example` traz um valor só para desenvolvimento; em produção gere um segredo forte (`openssl rand -base64 32`). **Quem já tem um `.env` precisa acrescentar essa linha.** |
| `BETTER_AUTH_URL` | URL pública da API, sem o `/api/auth`. Padrão: `http://localhost:<PORT>`. |
| `CORS_ORIGIN` | Origens do frontend (separadas por vírgula, exatas) liberadas no CORS da API e aceitas pelo Better Auth nas requisições com cookie. Vazia, nenhuma origem é liberada. |
| `COOKIE_SECURE` | Se a variável faltar, a API (fora do docker compose) emite o cookie com `Secure` (e o nome ganha o prefixo `__Secure-`), e o navegador (ou o curl) não o guarda em `http://`. Em desenvolvimento use `COOKIE_SECURE=false`; o docker compose já assume `false` quando ela falta. Em produção, com HTTPS, deixe ligado. |
| `TRUST_PROXY` | Opcional. Número de proxies confiáveis (inteiro >= 1) para quando a API roda atrás de um proxy reverso com TLS: sem isso o rate limit vê o IP do proxy, não o do cliente. Deixe vazio se a API for exposta direto. |

### Rotas da API

Fora `/api/auth/*`, toda rota exige a sessão (sem cookie válido, responde 401). As rotas de playlists, busca e catálogo também exigem assinatura ativa (sem ela, responde 403 com `SUBSCRIPTION_REQUIRED`); admins da plataforma passam sem assinatura. Os detalhes de cada uma (corpo, respostas e exemplos) estão no Swagger UI, em http://localhost:3333/docs, e na coleção do Bruno (`api/bruno/`), com uma pasta por assunto.

| Método e rota | O que faz |
| --- | --- |
| `POST /api/plans` | Assina o plano individual. Menor de idade recebe 403, e quem já tem assinatura ativa recebe 409. |
| `GET /api/plans/me` | A assinatura ativa da conta, inclusive como membro de um plano familiar, ou `null`. |
| `DELETE /api/plans/me` | Cancela a assinatura na hora. Só o assinante do individual ou o gestor do familiar (o membro recebe 403). |
| `GET /api/playlists` | Lista as playlists de que o usuário é membro, da mais nova para a mais antiga. |
| `POST /api/playlists` | Cria uma playlist; quem cria vira o primeiro membro, como admin. |
| `GET /api/playlists/:id` | Mostra uma playlist pública a qualquer usuário e uma privada só aos membros. A privada de outra pessoa responde 404, como se não existisse. |
| `PATCH /api/playlists/:id` | Edita nome, privacidade ou cor. Só admins da playlist (os outros recebem 403). |
| `DELETE /api/playlists/:id` | Apaga com soft delete. Só admins da playlist. |
| `GET /api/playlists/:id/musics` | As músicas da playlist, na ordem dela, com artistas, álbum e data de entrada. Quem vê a playlist vê as músicas. |
| `POST /api/playlists/:id/musics` | Põe uma música (`{ musicId }`) no fim da playlist. Só admins da playlist; a mesma música não entra duas vezes (409). |
| `PUT /api/playlists/:id/musics/order` | Reordena: `{ musicIds }` com todas as músicas da playlist, na ordem nova. Só admins da playlist. |
| `DELETE /api/playlists/:id/musics/:musicId` | Tira uma música da playlist. Só admins da playlist. |
| `GET /api/search?q=&limit=` | Busca músicas, artistas e playlists no catálogo inteiro, até `limit` itens por grupo (de 1 a 50, padrão 5). |

**Ordem das músicas na playlist.**
- **A ordem é da playlist:** todos que a veem enxergam a mesma. Ela fica em `music_playlist.position`.
- **Reordenar pede a lista inteira**, que precisa ter exatamente as músicas da playlist. Se faltar ou sobrar música (outro admin mexeu depois que a lista foi carregada), a API responde **409** e não muda nada; o cliente deve recarregar a lista.
- **As rotas que mudam as músicas** (pôr, reordenar) respondem com a lista inteira atualizada.

**Como a busca funciona.**
- **Acentos e maiúsculas:** a busca não diferencia nenhum dos dois, então `agua` acha `Águas`. A comparação usa a extensão `unaccent` do Postgres.
- **Ordem em cada grupo:**
  1. os nomes que começam com o termo;
  2. depois, os que têm uma palavra começando com ele;
  3. por último, os que só o contêm.
  Empates ficam em ordem alfabética. É a mesma regra das sugestões do frontend.
- **Músicas** também são encontradas pelo nome dos artistas.
- **Playlists:** aparecem as públicas de qualquer pessoa e as privadas de que o usuário é membro.
- **Nada apagado aparece.**
- **`%` e `_`** contam como texto, não como curinga.
- **Sem índice, por enquanto:** com o catálogo atual, ler a tabela inteira é instantâneo. O caminho previsto para quando ele crescer está no comentário da migration `V261103_151718__Ativa_unaccent_para_busca.sql`.

### Lint

Os dois projetos usam [Oxlint](https://oxc.rs), configurado no `.oxlintrc.json` de cada pasta. Ele roda sozinho no pre-commit, só nos arquivos do commit, e bloqueia o commit se houver erro.

```bash
bun run lint       # em api/ ou frontend/
bun run lint:fix   # corrige o que for automático
```

### Testes

```bash
bun run test               # em api/ ou frontend/: testes rápidos, sem banco
bun run test:integration   # em api/: repositórios e rotas HTTP no Postgres (precisa do banco no ar)
bun run typecheck          # em api/
```

Antes de todo `git push`, o hook `.husky/pre-push` roda o typecheck e os testes da API e os testes do frontend, e **cancela o push se algo falhar**. Os testes de integração só rodam se o container `db` estiver no ar; senão, o hook avisa e segue. Numa emergência, `git push --no-verify` pula o hook.
