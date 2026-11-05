# API

A referência completa das rotas (corpo, respostas e exemplos) fica no Swagger UI, em http://localhost:3333/docs, e na coleção do Bruno, em `api/bruno/`. Este documento explica o que o Swagger não mostra: como o login funciona, as variáveis do `.env` e as regras das rotas.

## Login

A autenticação usa o [Better Auth](https://www.better-auth.com), com email e senha. As rotas ficam em `/api/auth/*`: `sign-up/email`, `sign-in/email`, `sign-out` e `get-session`.

- **Sessão:** o login grava o cookie `zovic.session_token` (httpOnly, SameSite=Lax). Em produção, com HTTPS, ele se chama `__Secure-zovic.session_token`.
- **Token só no cookie:** a API tira o token do corpo das respostas de `/api/auth/*` (`api/adapters/http/hide-session-tokens.ts`), então o JavaScript da página nunca o vê.
- **Duração:** a sessão dura 30 dias e é renovada a cada 15 dias de uso.
- **Senha:** de 8 a 128 caracteres, guardada com hash scrypt.
- **Limites:** 5 tentativas de login a cada 15 minutos e 10 cadastros por hora, por IP.
- **Conta removida:** um usuário com soft delete (`deleted_at`) não entra e perde as sessões abertas.
- **Ainda não existem:** recuperação de senha, confirmação de email e login social.

Testando pelo terminal, com uma conta do seed LOCAL:

```bash
curl -i -c cookies.txt -X POST http://localhost:3333/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"ana.andrade@zovic.test","password":"zovic123"}'
curl -b cookies.txt http://localhost:3333/api/auth/get-session
curl -b cookies.txt -X POST http://localhost:3333/api/auth/sign-out \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3000" -d '{}'
```

Todo POST com cookie precisa do header `Origin`, que o navegador já manda. Essa origem precisa estar no `CORS_ORIGIN`.

> **Diferença em relação à spec.** O Better Auth guarda o token de sessão em texto puro no banco, e a [spec de autenticação](superpowers/specs/2026-10-20-autenticacao-design.md) pedia só o hash. Quem ler o banco consegue usar as sessões abertas. A senha também usa scrypt, e não Argon2id, como a spec previa. A implementação própria, que segue a spec, está na branch local `auth-propria`.

### Papel e maioridade

- **Papel:** toda conta tem um papel em `user.role`, `assinante` (o padrão) ou `admin`. O visitante é quem não tem conta.
- **Nenhuma rota muda o papel:** o cadastro ignora o campo e a rota `update-user` do Better Auth está desligada. O papel só muda com o `bun admin:promote <email>`, que recusa email inexistente, conta removida e a retirada do último admin ativo. A mudança vale na próxima requisição.
- **Maioridade:** a data de nascimento é obrigatória no cadastro e não pode ser trocada depois. O `get-session` devolve `user.isAdult`, que é `true` para quem já fez 18 anos no fuso de São Paulo (`api/domain/shared/age.ts`). Sem data de nascimento, o valor é `false`.

### Login no front

As telas `/entrar` e `/cadastro` usam o cliente do Better Auth (`frontend/src/lib/auth/client.ts`). O navegador chama a API direto, sem passar pelo servidor do Next. Para o cookie funcionar:

- a origem do front (como `http://localhost:3000`) precisa estar no `CORS_ORIGIN`;
- o front e a API precisam estar no mesmo site, porque o navegador não envia um cookie SameSite=Lax entre sites diferentes. `localhost:3000` com `localhost:3333` funciona, assim como `zovic.com.br` com `api.zovic.com.br`;
- o endereço da API vem do `NEXT_PUBLIC_API_URL` (o padrão é `http://localhost:3333`), lido no build do Next. Para mudá-lo, crie um `frontend/.env.local`.

O front manda para `/entrar` quem não tem sessão, mas isso é só a interface: quem protege os dados é a API, que confere o cookie em toda requisição.

## Variáveis do `.env`

O `.env.example` traz valores prontos para o desenvolvimento local.

| Variável | Para que serve |
| --- | --- |
| `DATABASE_URL` | Endereço do banco usado pela API, pelo Prisma, pelo seed e pelos scripts |
| `PORT` | Porta da API (padrão `3333`) |
| `BETTER_AUTH_SECRET` | **Obrigatória.** Segredo de 32 ou mais caracteres que assina o cookie. Em produção, gere um com `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | URL pública da API, sem o `/api/auth` |
| `CORS_ORIGIN` | Origens do front liberadas para chamar a API com cookie, separadas por vírgula. Vazia, nenhuma é liberada. |
| `COOKIE_SECURE` | `false` em desenvolvimento (HTTP). Se faltar, a API liga o `Secure`, e o navegador não guarda o cookie em `http://`. |
| `TRUST_PROXY` | Número de proxies na frente da API, para o limite de login ver o IP real. Vazia em desenvolvimento e `1` em produção. |
| `NEXT_PUBLIC_API_URL` | Endereço da API para o front no Docker. Vazio vale `http://localhost:3333`. |
| `AUDIO_DIR` | Diretório dos MP3 das músicas. Vazio vale `api/storage/audio`. No Docker, o compose passa `/data/audio`, o volume `audio`. |
| `CLOUDFLARE_TUNNEL_TOKEN` | Só no servidor de produção |

## Rotas

Fora `/api/auth/*`, toda rota exige sessão: sem um cookie válido, a resposta é 401.

As rotas de playlists, histórico, busca e catálogo também exigem assinatura ativa: sem ela, a resposta é 403 com `SUBSCRIPTION_REQUIRED`. Admins da plataforma não precisam de assinatura.

### Planos

| Rota | O que faz |
| --- | --- |
| `POST /api/plans` | Assina um plano. O corpo é opcional: `{ "kind": "individual" }` (o padrão) ou `{ "kind": "family" }`. Quem assina o Família vira o gestor. Menor de idade recebe 403, e quem já tem assinatura ativa recebe 409. |
| `GET /api/plans/me` | Mostra a assinatura ativa da conta, inclusive como membro de um plano familiar, ou `null` |
| `DELETE /api/plans/me` | Cancela a assinatura na hora. Só o assinante do individual ou o gestor do familiar (o membro recebe 403). |
| `GET /api/plans/me/members` | Só o gestor. Devolve os membros, os convites pendentes, o `limit` (4) e as vagas livres (`freeSlots`). |
| `POST /api/plans/me/invitations` | Só o gestor. Corpo `{ "email" }`. Cria o convite e devolve o `token` do link. |
| `DELETE /api/plans/me/invitations/:id` | Só o gestor. Cancela um convite pendente: o link deixa de valer e a vaga volta. |
| `DELETE /api/plans/me/members/:userId` | Só o gestor. Remove um membro. O gestor não remove a si mesmo (409). |
| `DELETE /api/plans/me/membership` | O membro sai do plano. O gestor recebe 409: ele cancela o plano. |
| `GET /api/invitations/:token` | **Pública.** Mostra o email, o nome do gestor e a validade do convite, para a tela do link funcionar antes de a pessoa ter conta. |
| `POST /api/invitations/:token/accept` | A conta logada aceita o convite e vira membro. Devolve a assinatura. |

**Plano familiar.**

- O plano tem até 4 pessoas, contando o gestor. Um convite pendente ocupa uma vaga.
- Só o gestor convida, cancela convites e remove membros. O membro que tenta recebe 403, e quem não tem assinatura ativa recebe 404. Nenhuma dessas rotas passa pelo `requireSubscription`.
- O convite vale por 7 dias e é de uso único. Convidar um plano individual, um plano cheio, um email que já é membro ou que já tem convite pendente responde 409.
- O email do convite é comparado sem diferenciar maiúsculas.
- **O token aparece só na resposta de criação.** O banco guarda apenas o hash SHA-256, e nem `GET /api/plans/me/members` o devolve. Se o link se perder, o gestor cancela o convite e cria outro.
- Convite usado, expirado, cancelado, de plano cancelado ou com token inexistente ou malformado dá sempre o mesmo 404 (`Invitation not found`), em `GET /api/invitations/:token` e no aceite.
- No aceite, só a conta com o email do convite aceita (outra recebe 403), e quem já tem assinatura ativa recebe 409. Menor de idade também aceita.
- Contas removidas pela plataforma (soft delete) não aparecem na lista de membros nem ocupam vaga.
- Quem sai ou é removido perde o acesso na próxima requisição e mantém a conta, o histórico e as playlists.

**Cadastro pelo convite.** Quem não tem conta se cadastra em `POST /api/auth/sign-up/email` com o campo extra `invitationToken`, que precisa ser de um convite enviado para o mesmo email do cadastro. A conta já nasce como membro do plano. O campo não é guardado.

- **Menor de idade só se cadastra por convite.** Sem o `invitationToken`, o cadastro responde 403 com `MINOR_NEEDS_INVITATION` e a conta não é criada. A recusa vale só para o cadastro em `/sign-up/email`: as contas criadas pelo admin não passam por ela.
- Um `invitationToken` que não vale (inexistente, expirado, usado, cancelado, de plano cancelado ou de outro email) responde 400 com `INVALID_INVITATION`, também para maiores de idade.
- Se o convite for cancelado entre a criação da conta e a entrada no plano, a conta existe, mas sem plano.

Exemplo, com a conta de um gestor que tenha vaga livre (as duas famílias do seed estão cheias):

```bash
curl -b cookies.txt -X POST http://localhost:3333/api/plans/me/invitations \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3000" \
  -d '{"email":"filho@exemplo.com"}'
# {"id":12,"email":"filho@exemplo.com","expiresAt":"...","token":"K3o1g8m2..."}
# o link é http://localhost:3000/convite/<token>
```

### Playlists e busca

| Rota | O que faz |
| --- | --- |
| `GET /api/playlists` | Lista as playlists de que o usuário é membro, da mais nova para a mais antiga |
| `POST /api/playlists` | Cria uma playlist. Quem cria vira o primeiro membro, como admin. |
| `GET /api/playlists/:id` | Mostra uma playlist pública para qualquer usuário e uma privada só para os membros. A privada de outra pessoa responde 404. |
| `PATCH /api/playlists/:id` | Edita nome, privacidade ou cor. Só para admins da playlist (os outros recebem 403). |
| `DELETE /api/playlists/:id` | Apaga com soft delete. Só para admins da playlist. |
| `GET /api/playlists/:id/musics` | Músicas da playlist, na ordem dela. Quem vê a playlist vê as músicas. |
| `POST /api/playlists/:id/musics` | Põe uma música (`{ musicId }`) no fim. Só para admins. A mesma música não entra duas vezes (409). |
| `PUT /api/playlists/:id/musics/order` | Reordena com `{ musicIds }`, a lista inteira na ordem nova. Só para admins. |
| `DELETE /api/playlists/:id/musics/:musicId` | Tira uma música da playlist. Só para admins. |
| `GET /api/history` | Histórico de reprodução da conta: cada música uma vez, com a data da última reprodução, da mais recente para a mais antiga. Música removida pelo admin continua, com `isAvailable: false`. |
| `GET /api/search?q=&limit=` | Busca músicas, artistas e playlists, até `limit` itens por grupo (de 1 a 50, padrão 5) |

**Ordem das músicas.** A ordem é da playlist, então todos os membros veem a mesma. Ela fica em `music_playlist.position`. Para reordenar, o cliente manda a lista inteira. Se faltar ou sobrar uma música (porque outro admin mexeu na playlist depois que a lista foi carregada), a API responde 409 e não muda nada. As rotas que mudam as músicas respondem com a lista atualizada.

**Busca.**

- Não diferencia acentos nem maiúsculas: `agua` acha `Águas`. Isso usa a extensão `unaccent` do Postgres.
- Em cada grupo, vêm primeiro os nomes que começam com o termo, depois os que têm uma palavra que começa com ele e por último os que só o contêm. Os empates ficam em ordem alfabética.
- Uma música também é encontrada pelo nome dos artistas.
- Aparecem as playlists públicas e as privadas de que o usuário é membro. Nada apagado aparece.
- `%` e `_` contam como texto, não como curinga.
- Ainda não há índice. O plano para quando o catálogo crescer está no comentário da migration `V261103_151718__Ativa_unaccent_para_busca.sql`.

### Catálogo

| Rota | O que faz |
| --- | --- |
| `GET /api/musics?q=` | Lista as músicas, com o álbum ativo (`album`, com o ano), `isExplicit` e `hasAudio`. As removidas só aparecem para admins, marcadas. |
| `GET /api/artists` | Lista os artistas |
| `GET /api/albums` | Lista os álbuns ativos, com o ano e os artistas |
| `GET /api/genres` | Lista os gêneros |
| `POST /api/musics/:id/plays` | Registra uma reprodução: um evento em `user_event` e `streams + 1`. É ela que alimenta o `GET /api/history`. |

O player do front chama essa rota quando uma música começa a tocar, e a página `/historico` atualiza a lista depois de cada reprodução registrada.

### Admin

As rotas de `/api/admin/*` respondem 401 sem sessão e 403 para quem não é admin.

| Rota | O que faz |
| --- | --- |
| `GET /api/admin/stats` | Números do painel: usuários, reproduções, músicas mais tocadas e reproduções por gênero |
| `GET /api/admin/users` e `POST /api/admin/users` | Lista todas as contas, inclusive as removidas, e cria uma conta com email, senha, data de nascimento e papel |
| `DELETE /api/admin/users/:id` | Remove a conta com soft delete e derruba as sessões. Ninguém remove a própria conta nem o último admin ativo. |
| `GET /api/admin/users/:id/plays` | As últimas 50 reproduções da conta |
| `POST /api/admin/musics` | Cadastra uma música com o arquivo de áudio, em multipart (veja abaixo) |
| `PATCH` e `DELETE` em `/api/admin/musics/:id` | Edita (nome, duração, artistas, gêneros, álbum e explícito) e remove músicas. O `PATCH` é em JSON e não troca o áudio. |
| `POST`, `PATCH` e `DELETE` em `/api/admin/albums` | Cria, edita (nome, artistas e ano) e remove álbuns |
| `POST /api/admin/genres` | Cria um gênero, com nome e cor `#RRGGBB`. Um nome que já existe dá 409. |
| `POST`, `PATCH` e `DELETE` em `/api/admin/artists` | Cria, renomeia e remove artistas |

Remover é sempre soft delete. Remover um álbum não remove as músicas dele.

**Cadastro de música com áudio.** O `POST /api/admin/musics` recebe `multipart/form-data` com duas partes:

| Parte | Conteúdo |
| --- | --- |
| `data` | Texto JSON: `{ name, duration, artistIds, genreIds?, albumId?, isExplicit? }` |
| `audio` | O arquivo MP3, de até 20 MB |

```bash
curl -b cookies.txt -H "Origin: http://localhost:3000" http://localhost:3333/api/admin/musics \
  -F 'data={"name":"Ressaca","duration":214,"artistIds":[1],"albumId":3}' \
  -F 'audio=@faixa.mp3;type=audio/mpeg'
```

- **Formato:** a API confere os primeiros bytes do arquivo (a tag ID3 ou o sincronismo de quadro MPEG), e não a extensão.
- **Nome:** o arquivo é guardado em `AUDIO_DIR` como `<uuid>.mp3`. A resposta traz `hasAudio`, e nunca o nome do arquivo.
- **Álbum:** zero ou um. Um álbum novo precisa de ano, de 1900 até o ano atual.
- **Erros:**

  | Situação | Resposta |
  | --- | --- |
  | Sem a parte `audio`, ou o arquivo não é MP3 | 400, com `"Music must have an audio file"` ou `"Audio file must be an MP3"` |
  | A parte `data` não é JSON | 400 `INVALID_JSON` |
  | O arquivo veio numa parte com outro nome, mais de um arquivo, ou o multipart está malformado (sem o separador das partes, ou cortado no meio do envio) | 400 `INVALID_UPLOAD` |
  | O arquivo passa de 20 MB | 413 `AUDIO_TOO_LARGE` |
  | Artista, gênero ou álbum inexistente | 404 |

O arquivo só é gravado depois dessas conferências. Se a música não chegar a ser salva, ele é apagado.

## Assinaturas

- Só quem tem assinatura ativa, própria ou como membro de um plano familiar, acessa o catálogo. A API verifica isso em cada rota, e o front leva a conta sem assinatura para `/planos`. Admins da plataforma não precisam de assinatura.
- Só maiores de 18 anos assinam. O pagamento é simulado, então a assinatura fica ativa na hora.
- A API cria os dois planos, Individual e Família (`POST /api/plans`). O Família tem até 4 pessoas e é gerenciado por convites (veja [Planos](#planos)).
- Cancelar é imediato, em `/meu-plano`. No plano familiar, todos perdem o acesso, mas as contas continuam.
- Menor de idade só se cadastra por convite do plano familiar.
- A restrição de conteúdo para menores ainda não existe, porque a API não marca conteúdo explícito.
