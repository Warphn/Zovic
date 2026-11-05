# Uso de IA no projeto

## Por que usamos IA

Usamos um assistente de IA (Claude Code) para acelerar tarefas repetitivas e mecânicas, como transcrever diagramas, escrever código de configuração e gerar o schema do banco. Assim, a equipe gasta o tempo nas decisões de modelagem e de produto.

A IA não decide nada sozinha:

- as decisões de modelagem são da equipe; a IA só transcreve e implementa o que foi definido;
- todo resultado é revisado por alguém da equipe antes de entrar no repositório;
- os prompts ficam registrados aqui, para deixar claro o que foi gerado com IA e a partir de quê.

## Registro de prompts

### 06/10/2026: modelo ER e banco de dados

Ponto de partida: o diagrama ER que a equipe fez no draw.io. A imagem abaixo é a versão atual (`Zovic2.drawio`); os prompts desta data partiram da primeira versão (`Zovic.drawio`).

![Diagrama ER do Zovic](../assets/modelo-er.png)

| # | Prompt | Resultado |
|---|---|---|
| 1 | Consegue transformar essa relação de ER em um arquivo .md para colocar no repositório? *(com a imagem acima anexada)* | [`docs/modelo-er.md`](../modelo-er.md) |
| 2 | Atualize o md: `album_genre` tem `album_id`; trocamos `gender` por `genre`; `lyrics` não tem coluna de conteúdo (ex.: `text`), porque ainda não decidimos como armazenar essa informação; `system_data` não tem `id`; se for tabela de linha única, documente essa escolha. | Correções em [`docs/modelo-er.md`](../modelo-er.md) |

O conteúdo gerado não foi o resultado final, apenas um passo intermediário para a criação do banco de dados

### 13/10/2026: seeders do banco

| # | Prompt | Resultado |
|---|---|---|
| 1 | Escreva os seeders em `api/prisma/seed/`, com um arquivo por grupo: planos, usuários, catálogo, interações e playlists. O seed deve poder rodar várias vezes (limpa as tabelas e zera os IDs antes de inserir), gerar sempre os mesmos dados e se recusar a rodar se o `DATABASE_URL` não apontar para `localhost`. Respeite as regras do modelo: toda música e todo álbum com ao menos um artista; todo plano com ao menos um usuário, e todo usuário com ao menos um plano; toda playlist com ao menos um membro e um admin; notas de 1 a 5, com uma avaliação ativa por usuário e música; cores no formato `#RRGGBB`. `musics.rating` deve ser a média real das avaliações, e `system_data` deve terminar com os totais corretos. Os dados do catálogo são fictícios e escritos à mão. Planos e gêneros também vão para produção: deixe em um arquivo as opções `LOCAL`, `PROD` e `ALL` para definirmos onde cada seeder roda. | [`api/prisma/seed/`](../../api/prisma/seed/) |
| 2 | Escreva a documentação do banco de dados em `docs/banco-de-dados.md`: o papel do Flyway e do Prisma, o padrão de nome das migrations, como criar uma migration e atualizar o Prisma, como rodar o seed e como ver o banco. | [`docs/banco-de-dados.md`](../banco-de-dados.md) |
| 3 | Revise a documentação do projeto e atualize o que estiver desatualizado em relação ao que foi feito. | Ajustes no [`README.md`](../../README.md), em [`docs/README.md`](../README.md), [`docs/docker.md`](../docker.md), [`docs/modelo-er.md`](../modelo-er.md) e no `.env.example` |

Depois, a equipe revisou e ajustou os dados gerados: os tipos de plano e os preços (ficaram Individual e Família), a lista de gêneros e suas cores, e os planos de cada usuário.

### 20/10/2026: entidades do catálogo, documentação das models e testes

| # | Prompt                                                                                                                                                                                                               | Resultado |
|---|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---|
| 1 | Vamos começar um `models.md` para explicar como funcionam as models e todas as funções de cada model (tabela com o nome e a explicação).                                                                             | [`docs/models.md`](../models.md) |
| 2 | Configure para que todo push rode os testes antes, para conferir se eles estão quebrando, e mostre no terminal que os testes passaram.                                                                               | Hook [`.husky/pre-push`](../../.husky/pre-push), script `test` no `frontend/package.json` e seção "Testes" no [`README.md`](../../README.md) |
| 3 | Faltam testes de soft delete: só o Genre confere que `findById` não devolve registro apagado. Cubra também Music (`findById` e `findByIds`), Album e Artist com base no código que eu já fiz para as outras classes. | Novos testes em [`postgres-catalog-repositories.test.ts`](../../api/adapters/db/postgres-catalog-repositories.test.ts) |
| 4 | Crie um CI no GitHub Actions que rode os testes da api e do frontend em todo push e PR para a `main`, incluindo os testes de integração com Postgres e as migrations do Flyway. Aproveite e remova o que sobrou do GitBook. | Workflow [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) e remoção do `docs/SUMMARY.md` (o índice foi para o [`docs/README.md`](../README.md)) |

### 20/10/2026: frontend (landing, catálogo de playlists, login e busca)

| # | Prompt | Resultado |
|---|---|---|
| 1 | Na tela de uma playlist, tire o card de waveforms, os filtros, os chips de qualidade (FLAC, vinil 180g…), o "Zovic Curadoria" e o nome da cor. Mantenha só as informações objetivas (número de faixas e duração), use a cor da playlist como fundo em toda a largura da tela e troque o texto "STEREO" por um controle de volume. | [`frontend/src/app/playlist/[id]/page.tsx`](../../frontend/src/app/playlist/[id]/page.tsx) |
| 2 | O bento grid de playlists está ruim: use uma lib melhor. O tamanho deve ficar preso à posição do card, e não à playlist, e quero um botão que sorteie os tamanhos mantendo a ordem, sem deixar nenhum espaço vazio nas linhas. | Grid com `react-grid-layout` em [`frontend/src/app/playlist/page.tsx`](../../frontend/src/app/playlist/page.tsx) e [`frontend/src/lib/playlist-layout.ts`](../../frontend/src/lib/playlist-layout.ts) |
| 3 | Adicione uma opção de ver as playlists em lista, parecida com a lista de faixas, com um único botão que alterna entre grade e lista. Quero poder arrastar para reordenar tanto a lista de playlists quanto as faixas dentro de uma playlist, e clicar em qualquer ponto de uma faixa deve tocá-la. | [`frontend/src/components/sortable-list.tsx`](../../frontend/src/components/sortable-list.tsx) |
| 4 | Use a cor da playlist e variações dela como cor de destaque e de seleção de texto na tela da playlist, inclusive no fundo que aparece ao arrastar uma faixa. No resto do app, a seleção de texto e o foco devem usar o vermelho principal. | Variáveis de cor em [`frontend/src/app/playlist/[id]/page.tsx`](../../frontend/src/app/playlist/[id]/page.tsx) e [`frontend/src/app/globals.css`](../../frontend/src/app/globals.css) |
| 5 | Faça uma landing page com seções abaixo do hero (como funciona, chamada final e rodapé). Os links de seção do header e o botão "Ver como funciona" devem rolar até a seção sem deixar `#` na URL, para continuarem funcionando depois de voltar ao topo. | [`frontend/src/app/page.tsx`](../../frontend/src/app/page.tsx) e [`frontend/src/components/section-link.tsx`](../../frontend/src/components/section-link.tsx) |
| 6 | Coloque um glass leve no header, sem borda e com um pequeno feather embaixo. Quando o header passar sobre uma seção escura, o texto e a logo devem ficar claros. | Classe `glass` em [`frontend/src/app/globals.css`](../../frontend/src/app/globals.css) e [`frontend/src/components/header.tsx`](../../frontend/src/components/header.tsx) |
| 7 | Leia a issue #1 do repositório e planeje o fluxo de login no frontend. Como a API ainda não tem autenticação, implemente as telas de entrar e de cadastro com uma autenticação simulada no navegador, com a mesma API do cliente do BetterAuth, para trocar depois pela API real. Proteja as telas de playlist para quem não estiver logado. | [`frontend/src/lib/auth/`](../../frontend/src/lib/auth/), [`frontend/src/app/entrar/`](../../frontend/src/app/entrar/) e [`frontend/src/app/cadastro/`](../../frontend/src/app/cadastro/) |
| 8 | Nos formulários de login e cadastro, deixe o label no meio do campo, subindo com animação ao selecionar. Mostre cada erro embaixo do campo, com um indicador no próprio campo, e leve o foco automaticamente ao primeiro erro. | [`frontend/src/components/auth-form.tsx`](../../frontend/src/components/auth-form.tsx) |
| 9 | Troque a biblioteca de ícones por uma de ícones animados, de um jeito que dê para voltar aos ícones antigos se eu não gostar. | [`frontend/src/components/icons/`](../../frontend/src/components/icons/) (a troca é uma linha em `icons/index.ts`) |
| 10 | Implemente uma barra de pesquisa no centro do header, parecida com a do Spotify: ao digitar, ela sugere textos para completar, músicas, artistas e playlists. Mostre a barra só fora da landing page, e lá não mostre os links das seções. Mantenha modular, porque depois vamos criar a tela de resultados e as páginas de música e de artista. | [`frontend/src/lib/search/`](../../frontend/src/lib/search/) e [`frontend/src/components/search/`](../../frontend/src/components/search/) |
| 11 | Troque o indicador de conta do header por uma pílula com um ícone genérico de usuário; ao clicar, ela abre a opção de sair. | Menu de conta em [`frontend/src/components/header.tsx`](../../frontend/src/components/header.tsx) |
| 12 | Faça commits agrupando as principais mudanças desta sessão e abra um único PR. | Commits e PR desta entrega |

Durante a sessão, a equipe também pediu vários ajustes pequenos de visual (alinhamentos, tamanho do feather, cursores, remoção de cores e de rótulos), revisou cada mudança no navegador e voltou atrás em ideias que não funcionaram, como um tema escuro para o app inteiro.

### 03/11/2026: admin da plataforma e painel de admin

| # | Prompt                                                                                                                                                                                                                                                                                                                                                                                                                                         | Resultado |
|---|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---|
| 1 | Hoje há admins de contas (planos) e de playlists, mas não admins da plataforma como um todo. Confira isso no código e veja se a minha proposta de criar uma tabela de roles e uma pivot é a mais eficaz.                                                                                                                                                                                                                                       | Proposta: papel global em `user.role`, middleware de autorização e script para promover o primeiro admin |
| 2 | Me ajude a implementar um comando para promover um usuário pelo terminal.                                                                                                                                                                                                                                                                                                                                                                      | Script `bun run admin:promote <email> [--revoke]` em [`api/scripts/admin-promote.ts`](../../api/scripts/admin-promote.ts), que não retira o último admin |
| 3 | Tire o segundo "Zovic", aumente o título "Painel de admin", acabe com o scroll sem sentido na barra de abas e tire a borda dos cartões de dados. Depois, remova a linha que atravessa a página embaixo das abas e coloque labels nos gêneros da aba Conteúdo.                                                                                                                                                                                  | Ajustes em [`frontend/src/app/admin/`](../../frontend/src/app/admin/) e [`frontend/src/components/admin/`](../../frontend/src/components/admin/) |
| 4 | Me ajude com os conflitos ao mergear a `main` na minha branch.                                                                                                                                                                                                                                                                                                                                                                                 | Conflitos em [`routes.ts`](../../api/adapters/http/routes.ts) e [`composition-root.ts`](../../api/infra/composition-root.ts) resolvidos mantendo os dois lados; a migration de reproduções foi renomeada para depois da migration da `main`, para o Flyway não recusar uma versão fora de ordem |

O primeiro desenho do papel de admin foi revertido porque a `main` já tinha uma versão parecida; o trabalho seguiu sobre a versão da `main`. A equipe testou o cadastro e o painel no navegador, pediu os ajustes de visual da linha 6 depois de ver as telas e decidiu manter o registro de reproduções na API mesmo com o player do frontend ainda simulado.

### 03/11/2026: rotas de playlist e busca

| # | Prompt | Resultado |
|---|---|---|
| 1 | Separe as requisições de playlist no Bruno por escopo, para facilitar a visualização. | Subpastas em [`api/bruno/playlists/`](../../api/bruno/playlists/) |
| 2 | Como implementar no back a busca do header, no estilo do Spotify, que mostra playlists, músicas e artistas que correspondem ao termo? Isso é uma rota de listagem? E ela só acha o que o usuário já ouviu? | Explicação do desenho da rota, sem código: consulta que cruza recursos, no catálogo inteiro, e não listagem |
| 3 | Verifique o estado do repositório e atualize as documentações. | Seção "Rotas da API" no [`README.md`](../../README.md), [`docs/models.md`](../models.md), [`docs/banco-de-dados.md`](../banco-de-dados.md) e este registro |

A equipe revisou o desenho da busca antes da implementação e fez os merges dos dois PRs.

### 26/10 a 04/11/2026: servidor de produção

| # | Prompt | Resultado |
|---|---|---|
| 1 | Preciso fazer o setup do servidor do projeto no meu desktop: leia a seção de setup do mapa de implementação e me dê o passo a passo. | Roteiro guiado: WSL2 e Docker Desktop, repositório em `~/zovic`, domínio `zovic.com.br` na Cloudflare, túnel `zovic-desktop` e `.env` de produção |
| 2 | Implemente as mudanças no compose para o servidor de produção. | Profile `prod`, healthcheck da API, porta em `127.0.0.1` e serviço `cloudflared` numa rede só com a API, em [`docker-compose.yml`](../../docker-compose.yml) (PR #57) |
| 3 | Escreva um script simples, como o `bun start`, para subir e derrubar o servidor quando eu quiser. | [`scripts/server.ts`](../../scripts/server.ts) (`bun server`), que recusa subir sem o `.env` de produção (PR #60) |
| 4 | Deixe o servidor funcional para usuários autenticados e admins, diga o hardware reservado para cada container e crie perfis para os outros integrantes consultarem o banco de produção. | Limites de CPU, memória e processos no compose e [`api/scripts/db-member.ts`](../../api/scripts/db-member.ts) (`bun db:member`), com um usuário do Postgres por integrante atrás do Cloudflare Access (PR #74) |
| 5 | Crie um script para facilitar o login na Cloudflare e o acesso ao banco, e coloque-o no menu do `bun start`. | [`scripts/db-connect.ts`](../../scripts/db-connect.ts) (`bun db:connect` e a opção "banco de produção" do `bun start`) (PR #108) |
| 6 | Quero acessar o front pelo meu domínio, servido pelo próprio servidor. | Serviço `web` no profile `prod`, com a URL da API no build e uma rede só com o `cloudflared` (PR #109) |
| 7 | Atualize as documentações e o README para a equipe ter onde recorrer em caso de dúvidas. | [`docs/servidor.md`](../servidor.md) e os links no [`README.md`](../../README.md), em [`docs/docker.md`](../docker.md) e em [`docs/banco-de-dados.md`](../banco-de-dados.md) |

A configuração da Cloudflare (domínio, túnel, rotas, Access e redirecionamento do `www`) foi feita no painel, com a IA guiando cada tela. Cada mudança de código foi testada num ambiente descartável do Docker antes do PR, e o servidor foi conferido de fora: a API, o site e o banco atrás do Access. A equipe escolheu servir o front pelo desktop, e não pela Vercel, para front e API ficarem sempre na mesma versão.

### 04/11/2026: reorganização da documentação

| # | Prompt | Resultado |
|---|---|---|
| 1 | Sinto que as documentações do projeto estão muito verbosas e confusas. Gostaria de algo mais direto, mas explicativo, para a equipe, com os comandos que devemos rodar para tudo funcionar e o que cada um faz. | [`README.md`](../../README.md) reescrito como guia de comandos e [`docs/api.md`](../api.md) com o login, as variáveis e as rotas que estavam no README |
| 2 | Veja se dá para melhorar as outras documentações também. | Resumo dos comandos em [`docs/banco-de-dados.md`](../banco-de-dados.md), tipos reais e a coluna `role` no [`docs/modelo-er.md`](../modelo-er.md), as portas de consulta em [`docs/models.md`](../models.md), o environment `prod` do Bruno em [`docs/servidor.md`](../servidor.md) e o índice em [`docs/README.md`](../README.md) |

A IA conferiu os comandos, os caminhos e as constraints citados contra o código e as migrations antes de escrever.

### 05/11/2026: assinatura individual pela API

| # | Prompt | Resultado |
|---|---|---|
| 1 | Tenho algumas mudanças não commitadas e gostaria de terminar essa issue. Acha necessário fazer um plano? Perceba que ainda não tenho um banco de dados povoado. | Levantamento do que faltava na issue #85 e plano de implementação. O seed já existente resolveu o banco local |
| 2 | Decisões da equipe sobre o plano: desativar o plano Família até a #86 e exigir a assinatura também na API. | Middleware [`require-subscription.ts`](../../api/adapters/http/middlewares/require-subscription.ts) nas rotas de playlists, busca e catálogo, e cliente [`subscriptions.ts`](../../frontend/src/lib/api/subscriptions.ts) no lugar do `localStorage` |

A equipe escolheu o escopo e as duas decisões acima antes da implementação.

### 05/11/2026: plano familiar (#86, HU-04 a HU-07)

Forma de trabalho: o Claude Opus fez o plano, preparou a tarefa de cada fase, leu o diff, rodou as verificações e conduziu os testes no navegador. A implementação ficou com subagentes Claude Sonnet, um por fase, em sequência na mesma branch, sem commitar. Cada subagente começou sem contexto e recebeu o plano, as seções do `CLAUDE.md` e os critérios de aceite da fase.

| # | Prompt (resumo) | Resultado |
|---|---|---|
| 1 | Planejar a #86 a partir da issue e do código da #85: decisões de desenho (token de 32 bytes com só o hash no banco, vagas contando convites pendentes, trava por plano contra convites simultâneos, cadastro pelo convite com `invitationToken`) e as quatro fases | Plano da issue, aprovado pelo Gabriel (responsável pela issue) antes da implementação |
| 2 | Fase 1, banco e domínio: migração de `plan_invitation` e do limite de 4 no Família, ajuste do seed (Elisa em plano próprio, Gabriela na Família Costa), casos de uso de convidar, cancelar, consultar, aceitar, remover e sair, com testes unitários | [`V261105_151000__Adiciona_convites_do_plano.sql`](../../db/migrations/V261105_151000__Adiciona_convites_do_plano.sql), casos de uso em [`api/domain/use-cases/`](../../api/domain/use-cases/) |
| 3 | Fase 2, HTTP e cadastro: rotas de plano e de convite, `invitationToken` no cadastro, recusa de menor sem convite, testes de integração, `openapi.ts` e requisições do Bruno | [`subscription-controller.ts`](../../api/adapters/http/subscription-controller.ts), [`create-auth.ts`](../../api/adapters/auth/create-auth.ts) e [`api/bruno/assinaturas/`](../../api/bruno/assinaturas/) |
| 4 | Fase 3, front: assinar o Família, "Meu plano" do gestor e do membro, tela `/convite/[token]`, cadastro e entrada com convite, mensagens de erro | [`subscriptions.ts`](../../frontend/src/lib/api/subscriptions.ts), [`frontend/src/components/plan/`](../../frontend/src/components/plan/) e [`frontend/src/app/convite/`](../../frontend/src/app/convite/) |
| 5 | Fase 4, documentação: rotas, tabela `plan_invitation`, demo do README, hooks do cliente da API e este registro | [`docs/api.md`](../api.md), [`docs/modelo-er.md`](../modelo-er.md), [`README.md`](../../README.md) e [`frontend/src/lib/api/README.md`](../../frontend/src/lib/api/README.md) |

A revisão do Opus e os testes no navegador pegaram quatro erros, que voltaram aos subagentes para correção:

- uma conta removida pela plataforma continuava ocupando vaga no plano;
- a tela mostrava "convite inválido" logo depois de aceitar, porque a consulta do link, já usado, era refeita e respondia 404;
- o token do convite se perdia no caminho Entrar, depois Criar conta;
- um teste de integração novo dependia de uma música do seed LOCAL e quebraria no banco do CI, o que apareceu ao rodar a suíte num banco temporário só com migrações e seed de produção.

No fim, a coleção do Bruno passou 29/29 contra a API real, e o fluxo no navegador passou 34/34 checagens.

A diagramação do `docs/assets/modelo-er.png` não foi refeita: a imagem atual vem do draw.io, e a saída do mermaid ficou menos legível.

