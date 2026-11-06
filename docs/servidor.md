# Servidor de produção

O Zovic de produção roda no desktop do Victor (Warphn), um Windows 11 com WSL2 (Ubuntu) e Docker Desktop. A internet chega até ele pelo Cloudflare Tunnel, sem nenhuma porta aberta no roteador da casa.

Este guia é a referência da equipe para o servidor: o que roda, como operar, como a Cloudflare está configurada e o que fazer quando algo dá errado. Quem só quer consultar o banco de produção precisa apenas da seção [Banco de produção](banco-de-dados.md#banco-de-produção).

## Endereços

| Endereço | O que é | Quem acessa |
| --- | --- | --- |
| https://zovic.com.br | O site (Next.js, container `web`) | Qualquer pessoa |
| https://www.zovic.com.br | Redireciona para `https://zovic.com.br` | Qualquer pessoa |
| https://api.zovic.com.br | A API (container `api`) | Qualquer pessoa; as rotas pedem login |
| `db.zovic.com.br` | O Postgres de produção (container `db`) | Só a equipe, pelo Cloudflare Access |

O servidor fica no ar enquanto o desktop estiver ligado e acordado e quem administra tiver rodado `bun server up`. Fora disso, os endereços acima respondem com erro (veja [Problemas comuns](#problemas-comuns)).

## Como funciona

```text
navegador ──https──► Cloudflare ──► túnel ──► cloudflared ──► web:3000   (zovic.com.br)
                     (HTTPS, DNS,              (container)  ──► api:3333  (api.zovic.com.br)
                      Access, regras)                       ──► db:5432   (db.zovic.com.br, só com Access)
```

1. O container `cloudflared` usa o token do túnel (`CLOUDFLARE_TUNNEL_TOKEN`) para abrir conexões **de saída** até a Cloudflare. Como a conexão parte do desktop, o roteador deixa passar, e nada precisa ser aberto na rede da casa.
2. As rotas do túnel (`zovic.com.br → http://web:3000` e as outras) ficam cadastradas no painel da Cloudflare, não no repositório. O `cloudflared` recebe essa configuração ao conectar.
3. Quando alguém abre um endereço, a Cloudflare termina o HTTPS e manda a requisição pela conexão que o `cloudflared` já deixou aberta. Ele entrega ao container certo pelo nome do serviço na rede do Docker.
4. O site não chama a API por dentro do servidor: quem chama é o navegador, em `https://api.zovic.com.br`. Por isso o container `web` não alcança a API nem o banco.

### Containers e redes

O compose de produção é o profile `prod` do `docker-compose.yml`.

| Container | Rede | Teto de recursos | Memória em repouso (medida em 04/11) |
| --- | --- | --- | --- |
| `db` (Postgres 16) | `default`, `tunnel` | 2 CPUs, 2 GiB, 512 processos | 47 MiB |
| `flyway` | `default` | — (roda as migrations e termina) | — |
| `api` (Bun + Express) | `default`, `tunnel` | 2 CPUs, 1 GiB, 256 processos | 81 MiB |
| `web` (Next.js) | `site` | 1 CPU, 512 MiB, 128 processos | 70 MiB |
| `cloudflared` | `tunnel`, `site` | 0,5 CPU, 256 MiB, 128 processos | 23 MiB |

- **`tunnel`:** a rede onde o `cloudflared` alcança a API e o banco.
- **`site`:** só o `web` e o `cloudflared`.
- **Volumes:** `pgdata` guarda o banco, `audio` guarda os MP3 enviados pelo painel de admin e `covers` guarda as capas dos álbuns. Os dois últimos são montados em `/data/audio` e `/data/covers` no `api`.
- **Portas:** a API, o banco e o site só aceitam conexões da própria máquina (`127.0.0.1`). Da rede da casa, nenhuma porta responde.
- **Tetos:** se um container passa do teto de memória, o Docker o encerra (código 137) e o `restart: unless-stopped` o liga de novo. Acompanhe com `docker stats`.
- **Banda:** o limite mais apertado no caminho do áudio (fase 6) é o `cloudflared`, por onde passam todos os bytes. Mas o gargalo real deve ser a velocidade de **upload** da internet do desktop, de cerca de 0,3 Mbps por ouvinte.

## Operação

Tudo roda no Ubuntu do desktop, no clone `~/zovic`, onde está o `.env` de produção. Não use a cópia do repositório em `/mnt/c/...` (a pasta do Windows): ela não tem `.env`.

| Comando | O que faz |
| --- | --- |
| `bun server` | Menu com as opções abaixo |
| `bun server up` | Sobe (ou aplica mudanças), espera tudo ficar de pé e testa o endereço público da API |
| `bun server down` | Derruba tudo, inclusive o túnel; o banco continua no volume |
| `bun server status` | Estado dos containers e do endereço público |
| `bun server logs [db\|flyway\|api\|web\|cloudflared]` | Acompanha os logs (Ctrl+C para sair) |
| `bun server update` | `git pull` e sobe a versão nova |
| `bun admin:promote <email>` | Torna um usuário admin da plataforma (`--revoke` desfaz) |
| `bun db:member add\|reset\|remove\|list` | Usuários da equipe no banco (veja [Acesso da equipe ao banco](#acesso-da-equipe-ao-banco)) |

- **O que o `bun server up` recusa:** ele não sobe sem o `.env`, nem com a senha do banco, o segredo do login, a URL da API, o token do túnel ou o `NEXT_PUBLIC_API_URL` vazios. Por baixo, ele roda `docker compose --profile prod up -d --build --wait`.
- **Publicar uma versão nova:** depois de um merge na `main`, rode `bun server update`. O Flyway aplica as migrations novas antes de a API subir, e o front é recompilado. Front e API sobem sempre da mesma versão do código.
- **Depois de um `bun server down`:** os containers só voltam com `bun server up`. Depois de um reinício do Windows, eles voltam sozinhos, desde que o Docker Desktop abra no login e ninguém os tenha derrubado antes.

### O `.env` de produção

O `~/zovic/.env` só existe no servidor e nunca vai para o git. Não mostre o conteúdo dele (`cat .env`) numa tela compartilhada.

| Variável | Valor em produção |
| --- | --- |
| `POSTGRES_USER` / `POSTGRES_DB` | `zovic` |
| `POSTGRES_PASSWORD` | Aleatória, hexadecimal (`openssl rand -hex 24`) |
| `DATABASE_URL` | A mesma senha, em `localhost:5432`. É usada pelo seed e pelos scripts fora do Docker. |
| `BETTER_AUTH_SECRET` | Aleatório (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | `https://api.zovic.com.br` |
| `CORS_ORIGIN` | `https://zovic.com.br` |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY` | `1`, porque o `cloudflared` é o proxy à frente da API e o rate limit do login precisa do IP real |
| `CLOUDFLARE_TUNNEL_TOKEN` | O token do túnel `zovic-desktop` |
| `NEXT_PUBLIC_API_URL` | `https://api.zovic.com.br`. O Next embute o valor no build: se ele mudar, rode `bun server up` de novo. |
| `AUDIO_DIR` e `COVER_DIR` | Não defina. O compose já passa `/data/audio` e `/data/covers`, os volumes `audio` e `covers`. |

## Cloudflare

O domínio `zovic.com.br` foi registrado no Registro.br. O DNS dele está na Cloudflare, com os nameservers `rihana.ns.cloudflare.com` e `will.ns.cloudflare.com`.

| Onde no painel | O que está configurado |
| --- | --- |
| **Tunnels → `zovic-desktop` → Routes** | `zovic.com.br → http://web:3000`, `api.zovic.com.br → http://api:3333` e `db.zovic.com.br → tcp://db:5432`, todas do tipo *Published application* |
| **DNS → Records** | Os registros `zovic.com.br`, `api` e `db`, do tipo *Tunnel*, criados pelas rotas, e `www` (`CNAME` para `zovic.com.br`, *Proxied*). Os registros MX e TXT vieram do Registro.br e dizem que o domínio não envia e-mail. Não os apague. |
| **Rules → Redirect Rules** | *Redirect from WWW to root*: `https://www.*` → `https://${1}`, 301, mantendo a query string |
| **SSL/TLS → Edge Certificates** | *Always Use HTTPS* ligado |
| **Zero Trust → Access → Applications** | Aplicação *self-hosted* para `db.zovic.com.br`, com a política **Equipe Zovic**: *Allow*, regra *Emails* com o e-mail de cada integrante, login por *One-time PIN* e sessão de 24 horas. O plano é o Zero Trust Free. |

Cuidados ao mexer:

- **Rotas novas:** uma rota nova no túnel cria o registro DNS sozinha. No campo *Service URL*, use o nome do serviço no compose (`http://api:3333`), nunca `localhost`: para o `cloudflared`, `localhost` é o próprio container.
- **Rota sem Access:** antes de criar uma rota que não deve ser pública, crie a aplicação do Access para o mesmo endereço. Uma rota sem Access fica aberta para a internet.
- **Endereço único do site:** a API só aceita chamadas de `https://zovic.com.br` (`CORS_ORIGIN`). Por isso o `www` redireciona em vez de servir o site.
- **Termos do plano gratuito:** eles não permitem usar o proxy principalmente para servir arquivos grandes de áudio ou vídeo. Para a demonstração é aceitável, mas o modelo não escalaria assim.

## Acesso da equipe ao banco

Cada integrante tem um usuário próprio no Postgres, no grupo `equipe`. O grupo:

- lê e altera dados de todas as tabelas;
- não muda o schema, porque isso é papel do Flyway;
- não lê `session`, `account` e `verification`, que guardam tokens de sessão e hashes de senha;
- só lê o `flyway_schema_history`;
- tem no máximo 3 conexões por pessoa, consultas de até 60 s e transações paradas por até 5 min.

O caminho até o banco tem duas trancas independentes:

1. **Cloudflare Access:** o e-mail da pessoa precisa estar na política **Equipe Zovic**. O código chega por e-mail e o login vale 24 horas.
2. **Postgres:** cada pessoa entra com o próprio usuário e senha.

Para dar acesso a alguém, com o servidor no ar:

1. Inclua o e-mail da pessoa na política **Equipe Zovic** do Access.
2. Rode `bun db:member add <nome>` em `~/zovic` e mande a senha por um canal privado. Ela aparece uma única vez e não fica guardada em lugar nenhum.
3. Mande o link de [Banco de produção](banco-de-dados.md#banco-de-produção). Do lado da pessoa, `bun db:connect` faz o login e abre o banco em `localhost:15432`.

Para tirar o acesso, rode `bun db:member remove <nome>` e tire o e-mail da política. Para trocar a senha de alguém, rode `bun db:member reset <nome>`.

## Testando a API de produção pelo Bruno

1. No Bruno, escolha o environment `prod` (`api/bruno/environments/prod.bru`), que aponta para `https://api.zovic.com.br`.
2. Desligue o `baseUrl` da aba **Vars** nas requisições e pastas que o fixam em `http://localhost:3333`: `auth/cadastro.bru`, `auth/login.bru` e a pasta `playlists`. Esse valor passa por cima do environment, e aí o login e as outras chamadas vão para endereços diferentes, e o cookie não volta.
3. Em produção, o cookie de sessão se chama `__Secure-zovic.session_token`. Os testes da coleção que procuram `zovic.session_token` falham, e isso é esperado.

No desktop, o `localhost:3333` é a API de produção. Uma chamada por ali grava no banco de produção, mas com a origem e o cookie errados.

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Os endereços respondem **530** (erro 1033 da Cloudflare) | O túnel está desconectado: servidor parado, Docker Desktop fechado ou desktop dormindo | No Ubuntu, `bun server status`; depois `bun server up` |
| Os endereços respondem **502** | O túnel está no ar, mas o container de destino está parado ou ainda subindo | `bun server status` e `bun server logs web` (ou `api`) |
| `https://www.zovic.com.br` responde **404** | A regra de redirecionamento do `www` está desligada ou foi apagada | **Rules → Redirect Rules** no painel da Cloudflare |
| `bun server` diz "Não há .env em /mnt/c/..." | O terminal está na cópia do Windows, não no clone do servidor | `cd ~/zovic` |
| `docker: command not found` no Ubuntu | O Docker Desktop está fechado ou a integração com o WSL está desligada | Abra o Docker Desktop. Em *Settings → Resources → WSL integration*, ligue o Ubuntu. |
| `bun install` falha no `husky` com "could not open bin metadata file" | O Ubuntu está usando o Bun do Windows, que vem pelo PATH do Windows | `which bun` deve mostrar `~/.bun/bin/bun`. Se não mostrar, acrescente `export PATH="$HOME/.bun/bin:$PATH"` ao `~/.bashrc`, rode `exec $SHELL`, apague o `node_modules` e instale de novo. |
| Login responde 200, mas `get-session` volta `null` | O cookie foi salvo para outro endereço, ou o acesso foi por `http` | Veja [Testando a API de produção pelo Bruno](#testando-a-api-de-produção-pelo-bruno) |
| O site mostra erro de CORS ou o login não pega | O site foi aberto por um endereço que não é `https://zovic.com.br` | Use `https://zovic.com.br`. Confira o `CORS_ORIGIN` e a regra do `www`. |
| `cloudflared` não é reconhecido logo depois de instalar | O terminal, ou o VS Code inteiro, foi aberto antes da instalação | Feche e abra o VS Code ou o terminal |
| `bun db:connect` abre, mas o DBeaver não conecta | O servidor está parado | Peça a quem administra para rodar `bun server up` |
| O Access diz que o e-mail não tem acesso | O e-mail não está na política **Equipe Zovic** | Peça a inclusão a quem administra |
| Um endereço novo não resolve logo depois de criar a rota | O computador guardou em cache o "não existe" de antes | `ipconfig /flushdns` no Windows (e `wsl --shutdown` para o Ubuntu), ou espere até 30 minutos |
| Um container reinicia sozinho com código **137** | Ele passou do teto de memória (ou foi parado à força) | `docker stats` e, se for o caso, aumente o limite no `docker-compose.yml` |

## Pendências

- **Backup do banco, dos áudios e das capas:** ainda não existe. Os dados de produção (os volumes `pgdata`, `audio` e `covers`) estão só no disco do WSL do desktop.
- **Servidor sempre de pé:** o desktop suspende depois de 30 minutos parado, e o Docker Desktop e o login não abrem sozinhos depois de um reinício. Hoje o servidor fica no ar só enquanto quem administra o mantém ligado.
- **Rate limit geral da API:** só o login e o cadastro têm limite por IP.
- **Swagger público:** `https://api.zovic.com.br/docs` mostra todas as rotas para qualquer pessoa.
- **Áudio (fase 6):** ainda não há upload nem stream. Quando houver, faça um teste de carga (ouvintes simultâneos e um upload de 30 MB) olhando o `docker stats`, para conferir os tetos, principalmente o do `cloudflared`.
