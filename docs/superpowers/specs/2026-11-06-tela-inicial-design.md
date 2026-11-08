# Tela inicial, páginas de gênero e de álbum, e capas no player (HU-33)

Branch `feat/HU-33-tela-inicial`, criada a partir da `feat/HU-13-player-audio`. Ela usa o `playQueue` da fila (HU-14) e as capas dos álbuns (HU-28), então o PR depende dos PRs da HU-28 e da HU-13, nessa ordem.

## Objetivo

Depois do login, o assinante cai numa tela inicial que tem o que tocar mesmo para uma conta nova, sem playlists nem histórico. Hoje ele cai em `/playlist`, vazia para quem acabou de assinar. A tela inicial é também a "home" que a HU-25 (#97) cita para a seção "Recomendadas para você".

Junto vão duas páginas da HU-10 (#88, do Carlos), que a tela inicial usa: a do gênero e a do álbum. E a miniatura da música no player passa a ser a capa do álbum.

## Decisões

| Pergunta | Decisão |
| --- | --- |
| Seções | Mais tocadas, Ouvidas recentemente, Suas playlists, Novidades e Gêneros |
| Endereço | `/inicio`. A landing em `/` continua para visitantes |
| Registro no board | HU-33, nova funcionalidade sub-issue do #76 (Catálogo e pesquisa), criada só com o OK do texto |
| Layout | Editorial: saudação, parada numerada ao lado das ouvidas, e capas e blocos de cor abaixo |
| Gênero e álbum | Páginas novas `/genero/[id]` e `/album/[id]`. A página de artista e o número da faixa ficam com o Carlos |
| Dados | Só o front, com as rotas que já existem |
| Capas no player | A barra e as cartas do `/player` mostram a capa do álbum da música |

## Dados

Todas as telas leem as consultas que o front já tem em cache. Nenhuma rota da API muda.

| Bloco | Origem |
| --- | --- |
| Mais tocadas | `GET /musics`, ordenado por `plays` (desempate pelo nome), as 10 primeiras |
| Ouvidas recentemente | `GET /history`, as 5 primeiras disponíveis |
| Suas playlists | `GET /playlists`, as 4 primeiras |
| Novidades | `GET /albums`, os 4 de id mais alto (cadastro mais recente) |
| Gêneros | `GET /genres`, com a quantidade de músicas de cada um contada em `GET /musics` |
| Página de gênero | `GET /genres` e `GET /musics` com o gênero, das mais tocadas para as menos tocadas |
| Página de álbum | `GET /albums` e `GET /musics` com o álbum, na ordem de cadastro (id da música) |
| Capa da faixa | O álbum da música em `GET /musics` e a `coverUrl` dele em `GET /albums` |

O admin recebe também as músicas removidas. O front as tira de todas estas telas, como o `useCatalogTracks` já faz. A regra das músicas explícitas para menores é da HU-09 e fica fora.

## Funções puras

Ficam em `frontend/src/lib/home.ts`, com testes em `home.test.ts`:

- `topPlayed(musics, count)`: as `count` mais tocadas, sem as removidas, por `plays` decrescente e depois pelo nome;
- `newestAlbums(albums, count)`: os `count` álbuns de id mais alto;
- `musicsOfGenre(musics, genreId)`: as músicas do gênero, sem as removidas, das mais tocadas para as menos tocadas;
- `tracksOfAlbum(musics, albumId)`: as músicas do álbum, sem as removidas, por id crescente;
- `countByGenre(musics)`: um mapa do id do gênero para a quantidade de músicas ativas;
- `greetingFor(hour)`: "Bom dia" das 5h às 11h59, "Boa tarde" das 12h às 17h59 e "Boa noite" no resto;
- `firstName(name)`: a primeira palavra do nome.

A capa de uma faixa é resolvida por `coverUrlOfTrack(trackId, musics, albums)`, também pura e testada: ela devolve `null` para uma faixa sem id numérico, sem álbum ou com álbum sem capa. O hook `useTrackCover(trackId)` só a aplica às consultas em cache.

## Rotas e redirecionamentos

- **Rotas novas:** `/inicio`, `/genero/[id]` e `/album/[id]`, cada uma com um `layout.tsx` que usa o `RequireSubscription`, como `/playlist`.
- **`DEFAULT_AFTER_LOGIN`:** passa a `/inicio`.
- **"Zovic" do cabeçalho:** quem está logado vai para `/inicio`.
- **`require-admin`:** quem não é admin vai para `/inicio`.
- **`/` com sessão:** leva para `/inicio`. Enquanto a sessão carrega, a landing aparece como hoje, para não atrasar o visitante.

## Telas

### `/inicio`

- **Topo:** `greetingFor(hora atual)` e o primeiro nome ("Boa noite, Ana"). A hora é lida num efeito, não durante a renderização. Embaixo, em mono, "N músicas · N álbuns · N gêneros".
- **Mais tocadas** (coluna da esquerda): parada de 01 a 10, com o número em mono, o título, os artistas e a duração.
  - O clique numa linha toca a parada a partir dela (`playQueue(dez, índice)`).
  - Cada linha tem o `AddToQueueButton`.
  - A faixa atual aparece marcada, como na busca.
- **Ouvidas recentemente** (coluna da direita): as 5 últimas disponíveis do histórico, com "Ver histórico →" para `/historico`.
  - O clique usa o `playOrToggleTrack`, como na página de histórico.
  - Sem histórico, a coluna não aparece, e a parada ocupa a faixa com largura de leitura (`max-w-3xl`).
- **Suas playlists:** até 4 capas coloridas com iniciais, no estilo de `/playlist`, cada uma levando para `/playlist/[id]`, mais o cartão "+ Nova playlist", que leva para `/playlist`. Também há "Ver todas →". Uma conta sem playlists vê só o cartão "Criar sua primeira playlist".
- **Novidades:** os 4 álbuns com a capa, o nome, os artistas e o ano.
  - O cartão leva para `/album/[id]`.
  - Um botão ▶ ("Tocar *álbum*"), que aparece no hover e no foco, toca o álbum direto.
- **Gêneros:** blocos na cor de cada gênero, com o nome e "N músicas", levando para `/genero/[id]`.
- **Carregando:** cada seção mostra "Carregando…" até os dados chegarem. **Erro:** uma seção que falhou mostra a mensagem do `apiErrorMessage`, e as outras continuam.

### `/genero/[id]`

- **Topo:** o rótulo "Gênero", o nome com um círculo na cor do gênero, "N músicas · duração total" e o botão **Tocar**, que chama `playQueue(lista, 0)`.
- **Lista:** as músicas, das mais tocadas para as menos tocadas, no formato de linha da busca.
  - O clique toca a lista a partir daquela música.
  - Cada linha tem "Adicionar à fila" e "Adicionar à playlist", com o anúncio na região `aria-live`, como na busca.
- **Gênero inexistente ou id inválido:** "Gênero não encontrado" e um link para `/inicio`.
- **Gênero sem músicas:** "Nenhuma música neste gênero ainda".

### `/album/[id]`

- **Topo:** a capa grande (`AlbumCoverImage`), o rótulo "Álbum", o nome, os artistas e, em mono, "2023 · 8 faixas · 32 min", com o botão **Tocar**.
- **Lista:** as faixas numeradas na ordem de cadastro.
  - O clique toca o álbum a partir daquela faixa.
  - Cada linha tem "Adicionar à fila".
- **Álbum inexistente:** "Álbum não encontrado" e um link para `/inicio`.

### Capa no player

- **Barra** (`playback-bar.tsx`): a miniatura mostra a capa do álbum da faixa atual. Sem capa, mantém a cor e as iniciais de hoje.
- **Cartas do `/player`:** a capa preenche a carta, e o título, o artista e o botão ficam sobre um degradê escuro na parte de baixo, para a leitura. Sem capa, a carta fica como hoje.
- As imagens usam `decoding="async"`, para não travar a animação das cartas.

## Componentes compartilhados

- `AlbumCoverImage` sai de `app/admin/conteudo/album-cover.tsx` para `components/album-cover-image.tsx`, porque passa a ter quatro usos (admin, seletor de álbum, tela inicial e página do álbum). O `CoverField` continua no admin.
- O cartão colorido de playlist da tela inicial é um componente pequeno novo, `components/playlist-tile.tsx`, com a cor e as iniciais (`getPlaylistInitials`). A grade de `/playlist` não muda.

## Testes

- Testes unitários (`bun run test` no front) de todas as funções puras acima.
- Conferência visual com o Chrome por script: `/inicio` com uma conta nova (sem histórico nem playlists) e com a `ana.andrade@zovic.test` do seed, `/genero/[id]`, `/album/[id]` e a barra e o `/player` tocando uma música com capa.

## Board (só com o OK do texto)

Issue "Tela inicial (HU-33)", com a label `história`, o milestone "Entrega final" e como sub-issue do #76:

```markdown
**Épico:** Catálogo e pesquisa · **Responsável:** Victor · **Prioridade:** P1

A tela que o assinante vê depois do login, com o que tocar mesmo sem playlists nem histórico.

#### HU-33 · Ver a tela inicial

Como **assinante**, quero uma tela inicial com o que tocar, para começar a ouvir mesmo sem playlists.

**Regras**

- Depois do login, o assinante cai na tela inicial. O visitante continua vendo a landing.
- A tela mostra as 10 músicas mais tocadas da plataforma, as últimas ouvidas pela conta, as playlists da conta, os álbuns mais recentes e os gêneros.
- As últimas ouvidas só aparecem quando a conta tem histórico. Sem playlists, a tela convida a criar a primeira.
- Músicas removidas não aparecem.
- O álbum e o gênero abrem a página deles (HU-10).

**Critérios de aceite**

- [ ] Dado um assinante novo, sem histórico nem playlists, quando ele entra, então cai na tela inicial e vê as mais tocadas, os álbuns mais recentes, os gêneros e o convite para criar a primeira playlist.
- [ ] Dado um assinante que já ouviu músicas, quando ele abre a tela inicial, então vê as últimas ouvidas, da mais recente para a mais antiga.
- [ ] Dado as músicas da plataforma, quando o assinante abre a tela inicial, então "Mais tocadas" lista as 10 com mais reproduções, em ordem.
- [ ] Dado um álbum das novidades, quando o assinante clica nele, então abre a página do álbum com as faixas.

### Checklist técnica

- [ ] Rota `/inicio` e redirecionamento depois do login
- [ ] Páginas de gênero e de álbum (parte da HU-10, #88)
- [ ] Capa do álbum na barra e no player
- [ ] Testes

### Fora do escopo

- A seção "Recomendadas para você" (HU-25, #97), que entra nesta tela.
- A página de artista e o número da faixa no álbum (HU-10, #88).
```

E um comentário na #88 para o Carlos: as páginas de gênero e de álbum entram pela HU-33, com as faixas na ordem de cadastro. A página de artista e o número da faixa (que pede migração) continuam com ele.

## Fora desta entrega

- Recomendações (HU-25): a tela deixa o espaço, e a seção é do Gabriel.
- Página de artista e número da faixa no álbum (HU-10).
- Esconder músicas explícitas de menores (HU-09).
