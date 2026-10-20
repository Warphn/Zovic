# Autenticação da API — design

Data: 2026-10-20 · Branch: `auth`

## Intenção

Hoje a API identifica o usuário pelo header `x-user-id`
(`api/adapters/http/middlewares/authenticate.ts`), em que qualquer um pode se passar
por qualquer usuário. O objetivo é trocar isso por autenticação de verdade, **segura e
simples**: cadastro e login com email e senha, e a API passa a saber quem está logado.

O desenho precisa deixar espaço para crescer depois, a começar por "esqueci minha senha",
sem refazer o que for construído agora.

## O que mudou: Better Auth no lugar da implementação própria

A primeira versão deste design tinha autenticação escrita à mão (entidades, use cases,
repositórios, hasher Argon2id, controller, cookie e rate limit próprios). Ela foi
**substituída pela biblioteca [Better Auth](https://www.better-auth.com)**. Os objetivos
e os anti-objetivos abaixo não mudaram; mudou quem os cumpre.

Por que a troca:

- Segurança de autenticação é um terreno em que código próprio costuma errar em detalhes
  (comparação de tempo constante, enumeração de contas, renovação de sessão, atributos
  do cookie, proteção contra CSRF). Uma biblioteca mantida e muito usada reduz esse risco.
- Os recursos que o projeto quer adiar (esqueci minha senha, confirmação de email, login
  social) já existem na biblioteca e usam as tabelas `account` e `verification`, que o
  schema já tem. Crescer vira ligar opções, não escrever outra camada.
- Sai bastante código a manter: nenhuma regra de autenticação fica em `domain/`.

O que a troca custou ou alterou em relação ao design original:

- As rotas passaram a ser as do Better Auth (`/api/auth/sign-up/email`,
  `/sign-in/email`, `/sign-out`, `/get-session`) e os erros dessas rotas têm o formato
  `{ code, message }`, não `{ error, message }`. As rotas do projeto mantêm o formato
  antigo.
- O hash de senha é **scrypt** (padrão do Better Auth, atrás de `node:crypto`), não
  Argon2id. É um hash de senha adequado e dispensa dependência nativa.
- O cookie guarda o token **assinado** (HMAC com `BETTER_AUTH_SECRET`), e o banco guarda
  o token em si, não o SHA-256 dele. Quem lê o banco consegue forjar o valor do cookie só
  se também tiver o segredo, mas o token em si está legível no banco. Aceitamos essa
  diferença em troca de usar a biblioteca sem adaptações.
- O rate limit é o embutido do Better Auth: **por IP e por rota**, contando todas as
  tentativas (acertos e erros), e não "5 falhas por IP + email". Também não devolve
  `Retry-After`, e sim `X-Retry-After`.
- Os ids continuam inteiros (`advanced.database.generateId = "serial"`), mas o Better
  Auth os expõe como **texto** nas respostas (`"id": "1"`). O middleware converte para
  número antes de preencher `res.locals.userId`.
- Usuário com soft delete: as sessões dele deixam de valer (o middleware responde 401),
  mas as linhas não são apagadas, como o design original previa.

## Objetivos

- Cadastro com nome, email e senha. O usuário já sai logado.
- Login com email e senha, e logout.
- Rota que devolve o usuário logado.
- Substituir o `x-user-id` por **sessão guardada no banco + cookie `httpOnly`**
  (decisão do usuário, preferida a JWT).
- As rotas atuais (`POST /api/playlists`) continuam funcionando sem mudar o controller:
  o middleware continua preenchendo `res.locals.userId`.

## Não-objetivos (agora)

- Telas de login/cadastro no frontend e integração do frontend com a API (decisão do
  usuário: **só a API por enquanto**). O frontend continua com `localStorage`.
- Esqueci minha senha, confirmação de email, login social, 2FA, troca de senha e de email.
  O Better Auth tem todos; **não estão ligados**, e nada do que existe os bloqueia.
- Configuração de CORS (middleware `cors`). Fica para quando o frontend passar a chamar
  a API. `CORS_ORIGIN` já alimenta as origens confiáveis do Better Auth.
- Papéis/permissões além de "logado ou não".

## Anti-objetivos (seria falha mesmo funcionando)

- Senha guardada em texto puro no banco.
- Token de sessão legível pelo JavaScript da página.
- Resposta de login que revele se o email existe.
- Logout que não invalida a sessão no servidor.
- Quebrar a arquitetura hexagonal: `domain/` importando o Better Auth, Express, `pg` ou
  Bun.
- Manter o `x-user-id` funcionando em paralelo, porque isso deixaria a porta aberta.
- O Better Auth alterando o banco: o schema continua sendo só do Flyway.

## Contexto do projeto (restrições)

- Backend em `api/`: TypeScript + Bun + Express 5 + Joi, arquitetura hexagonal:
  `domain/` (entidades, use cases, ports, erros), `adapters/` (db com `pg` puro, http),
  `infra/` (composition root, server, pool).
- O banco é do **Flyway**: mudanças entram como migration nova em `db/migrations/`
  (`V<AAMMDD>_<HHMMSS>__...sql`, padrão do projeto). Nunca editar o `V1`. Depois rodar
  `bun run db:sync` para atualizar o `prisma/schema.prisma` (o Prisma é usado só nos
  seeds).
- Testes: unitários em `domain/` (`bun test domain`), integração contra o banco real em
  `adapters/` (`bun run test:integration`). Há coleção Bruno em `api/bruno/` e
  documentação OpenAPI em `adapters/http/openapi.ts`.

## Como funciona

### Onde o Better Auth mora

- `api/adapters/auth/create-auth.ts`: `createAuth(pool, options)` monta a instância do
  Better Auth sobre o `Pool` do `pg`. Toda a configuração fica aqui.
- `api/infra/auth.ts`: a instância real, com a configuração lida do ambiente.
- `api/adapters/http/create-app.ts`: monta o Express e monta o handler do Better Auth em
  `/api/auth/*splat` **antes** do `express.json()`, como a documentação manda no Express 5.
- `api/adapters/http/middlewares/authenticate.ts`: valida a sessão com
  `auth.api.getSession` e preenche `res.locals.userId` (número). Sem sessão, responde 401
  `{ error: "UNAUTHENTICATED", message }`. O `x-user-id` não existe mais.
- `domain/` não conhece o Better Auth. Autenticação é um adapter; o domínio só recebe o
  `creatorId` já resolvido, como antes.

### Rotas (prefixo `/api/auth`, do Better Auth)

| Rota | Entrada | Sucesso | Falhas |
| --- | --- | --- | --- |
| `POST /sign-up/email` | `{ name, email, password, birthdate? }` | 200, `{ token, user }` + cookie de sessão | 400 validação, 422 email já cadastrado, 429 tentativas demais |
| `POST /sign-in/email` | `{ email, password }` | 200, `{ token, user }` + cookie de sessão | 401 `INVALID_EMAIL_OR_PASSWORD`, 429 tentativas demais |
| `POST /sign-out` | `{}` | 200 `{ success: true }`, sessão apagada e cookie limpo (também 200 sem sessão) | — |
| `GET /get-session` | — | 200 `{ session, user }`, ou `null` sem sessão | — |

Não há `GET /me` próprio: `get-session` cumpre esse papel. O usuário devolvido nunca
inclui senha (o hash fica em `account.password`).

### Senhas

- Hash do Better Auth (scrypt). Mínimo de 8 e máximo de 128 caracteres
  (`minPasswordLength` / `maxPasswordLength`). O máximo evita que senhas gigantes
  sejam usadas para sobrecarregar o hash.
- Email guardado em minúsculas (o Better Auth normaliza e a coluna tem CHECK).
- Nome: não vazio após `trim` e no máximo 150 caracteres (limite da coluna), validado em
  `databaseHooks.user.create.before`.
- `birthdate` opcional, `AAAA-MM-DD`, data real e não futura. É um campo adicional
  (`user.additionalFields`) validado com Joi pelo `validator.input` do Better Auth.

### Sessões

- Sessão na tabela `session`, cookie `zovic.session_token`. Validade de **30 dias**
  (`expiresIn`), com renovação deslizante: com mais de 15 dias (`updateAge`) desde a
  última atualização, o uso da sessão a empurra para +30 dias. O middleware repassa o
  `Set-Cookie` da renovação para a resposta, senão o navegador manteria a validade
  antiga do cookie.
- Sessão expirada é tratada como inexistente.
- Um login novo **não** apaga as sessões antigas: a pessoa pode ficar logada em vários
  dispositivos. Só o logout apaga, e apenas a sessão atual.

### Cookie

- Nome `zovic.session_token` (`cookiePrefix: "zovic"`), `httpOnly`, `SameSite=Lax`,
  `Path=/`, `Max-Age` de 30 dias, assinado com `BETTER_AUTH_SECRET`.
- `Secure` controlado por `COOKIE_SECURE` (`advanced.useSecureCookies`), **ligado por
  padrão**: só `"false"` desliga. Quando ligado, o Better Auth também acrescenta o prefixo
  `__Secure-` ao nome. O `.env.example` e o serviço `api` do `docker-compose.yml` usam
  `false` porque o ambiente local roda em `http://`. Assim, um deploy que esqueça a
  variável fica seguro.
- **`trust proxy`**: continua desligado por padrão, e `TRUST_PROXY` (número de proxies)
  é repassado para `app.set("trust proxy", n)`. O Better Auth não lê `req.ip`; por isso o
  Express copia `req.ip` para o cabeçalho interno `x-zovic-client-ip` (sobrescrevendo o
  que o cliente mandar), e esse é o único cabeçalho que o Better Auth usa para descobrir
  o IP. Sem isso, o rate limit confiaria num `X-Forwarded-For` forjável, ou cairia num
  balde único para todos.
- Proteção contra CSRF: `SameSite=Lax` mais a checagem de `Origin` do Better Auth.
  POST com cookie e sem `Origin` é recusado (403), e a origem precisa estar em
  `trustedOrigins`, que vem de `CORS_ORIGIN`. Clientes sem navegador (curl, Bruno)
  precisam mandar `Origin`.

### Login seguro

- Email inexistente, senha errada e conta removida devolvem a **mesma** resposta: 401
  `INVALID_EMAIL_OR_PASSWORD`. O Better Auth roda o hash mesmo quando o email não existe,
  para o tempo de resposta não revelar a conta.
- Rate limit embutido (memória, `rateLimit.customRules`): `sign-in/email` com **5
  tentativas por 15 minutos** e `sign-up/email` com **10 por hora**, por IP. Passou do
  limite, devolve 429. Os contadores zeram quando a API reinicia e não são
  compartilhados entre instâncias, já que hoje só existe uma. Como o limite é por IP,
  vale também para tentativas de email diferentes.
- O cadastro **revela** se o email já existe (422). É um trade-off aceito pela
  simplicidade, comum na maioria dos sites. Com `requireEmailVerification` ligado no
  futuro, o Better Auth passa a responder igual nos dois casos.

### Soft delete

Usuário com `deleted_at` preenchido não loga e não usa sessão:

- `databaseHooks.session.create.before` recusa criar sessão para ele, com a resposta
  idêntica à de senha errada.
- O campo adicional `deletedAt` é lido pelo middleware `authenticate`, que responde 401
  para sessões que já existiam antes da remoção.

### Banco: migration `V261020_162546__Adota_Better_Auth.sql`

- A tabela `"user"` existente é a tabela de usuário do Better Auth. Ganha `email`
  (`varchar(254)`, único, em minúsculas), `email_verified`, `image` e `updated_at`.
  `email` é **nullable**: os usuários anteriores ao Better Auth não têm email nem
  senha; o `UNIQUE` do Postgres aceita vários `NULL`, então não foi preciso inventar
  emails. Eles só passam a logar quando ganharem email e conta.
- Tabelas novas `session`, `account` e `verification`, com constraints nomeadas, `timestamptz`
  e `ON DELETE CASCADE`. As senhas ficam em `account.password` (provider `credential`).
- Ids inteiros por `GENERATED BY DEFAULT AS IDENTITY` em todas as tabelas
  (`advanced.database.generateId = "serial"`). Os nomes em snake_case são mapeados pelas
  opções `modelName` e `fields` do Better Auth.
- O Better Auth não altera o banco (`better-auth migrate` não é usado). O SQL de
  referência foi gerado com `bunx @better-auth/cli generate` e adaptado às convenções.
- O email de um usuário com soft delete continua reservado.

### Seeds, Bruno, OpenAPI, docs

- **Seed LOCAL**: os usuários fictícios ganham email `nome.sobrenome@zovic.test` e a
  senha `zovic123`, com a conta de credencial criada como o Better Auth espera (hash da
  própria biblioteca, calculado uma vez). Os usuários com soft delete também ganham
  credenciais, para dar para testar que "usuário deletado não loga". O seed PROD não cria
  credenciais.
- **Bruno**: pasta `auth/` (cadastro, login, login errado, sessão com e sem login,
  logout). As requisições de playlist dependem do login (cookie).
- **OpenAPI**: rotas de auth do Better Auth usadas pelo projeto e esquema de segurança
  `cookieAuth` com o nome real do cookie.
- **Docs**: README (seção Autenticação), `docs/banco-de-dados.md` e `docs/modelo-er.md`.

## Como crescer depois

- **Esqueci minha senha**: implementar `emailAndPassword.sendResetPassword` (precisa de
  um envio de email, por exemplo atrás de uma port `Mailer`). A tabela `verification` já
  existe. Considerar `revokeSessionsOnPasswordReset: true`.
- **Confirmação de email**: `emailVerification.sendVerificationEmail` e
  `emailAndPassword.requireEmailVerification: true`. `user.email_verified` já existe.
- **Login social**: `socialProviders`. Cada provedor vira uma linha em `account`, sem
  mudar o schema.
- **Vários servidores**: trocar o armazenamento do rate limit para `database` ou
  `secondary-storage`.

## Testes

- Integração pela app Express real (`api/adapters/http/auth-flow.test.ts`): cadastro e
  cookie, sessão válida em `POST /api/playlists`, sem cookie ou com `x-user-id` (401),
  logout invalida, senha errada, usuário removido (não loga e perde a sessão), renovação
  deslizante, atributos do cookie com `Secure` ligado e desligado, e rate limit.
- Unitários de domínio: continuam só os da playlist; não há mais regra de autenticação
  no domínio.
- Bruno cobrindo o fluxo HTTP de ponta a ponta.
