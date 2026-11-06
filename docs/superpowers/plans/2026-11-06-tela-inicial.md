# Tela inicial, páginas de gênero e de álbum, e capas no player: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** depois do login, o assinante cai em `/inicio`, uma tela com o que tocar mesmo sem playlists nem histórico. Junto entram as páginas `/genero/[id]` e `/album/[id]`, e a capa do álbum na barra e nas cartas do player.

**Architecture:** só o front, com as consultas que já existem (`GET /musics`, `/albums`, `/genres`, `/history`, `/playlists`). As regras de seleção e ordem ficam em funções puras testadas (`lib/home.ts` e `lib/track-cover.ts`). As páginas só exibem e chamam a fila da HU-14 (`playQueue`).

**Tech Stack:** Next.js (App Router), React 19, TanStack Query, Tailwind v4, `bun test`, oxlint.

**Spec:** [docs/superpowers/specs/2026-11-06-tela-inicial-design.md](../specs/2026-11-06-tela-inicial-design.md)

## Global Constraints

- **Branch:** `feat/HU-33-tela-inicial`, a partir da `feat/HU-13-player-audio`. Commits em Conventional Commits, em português, com `Refs #76` e o rodapé `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Use `git add` com caminhos explícitos e **nunca** `api/bruno/auth/*.bru`.
- **Nomes:** identificadores em inglês e descritivos (nunca uma letra só, nem em callbacks). Comentários e textos de tela em português. Os testes do front seguem o inglês dos vizinhos.
- **Regra de negócio fica na API:** as funções puras só selecionam e ordenam dados que a API já filtrou. A única exceção é tirar as músicas com `deletedAt` (só o admin as recebe), como o `useCatalogTracks` já faz.
- **Textos fixos:**
  - "Bom dia" das 5h às 11h59, "Boa tarde" das 12h às 17h59 e "Boa noite" no resto;
  - "Mais tocadas", "Ouvidas recentemente" e "Ver histórico →";
  - "Suas playlists", "Ver todas →", "+ Nova playlist" e "Criar sua primeira playlist";
  - "Novidades", "Gêneros", "Gênero", "Álbum" e "Tocar";
  - "Gênero não encontrado", "Álbum não encontrado" e "Nenhuma música neste gênero ainda".
- **Quantidades:** `TOP_PLAYED_COUNT = 10`, `RECENT_COUNT = 5`, `PLAYLIST_TILE_COUNT = 4` e `NEWEST_ALBUM_COUNT = 4`.
- **Lint:**
  - nada de `new Date()` na renderização: a hora da saudação é lida num efeito;
  - helpers ficam no escopo do módulo, nunca dentro de `describe`;
  - nada de `role="radio"`.
- **Verificação antes de cada commit**, em `frontend/`: `bun run lint`, `bun run test` e `bunx tsc --noEmit`. O erro de `LayoutProps` em `layout.tsx` já existia.
- **Conferência visual:** por script com o Chrome do PC (`puppeteer-core` no scratchpad). O ambiente sobe com `bun start full`, depois de conferir com `docker ps` que os containers `zovic-*` da produção estão parados. O cookie de sessão é reaproveitado entre as execuções, porque o login tem limite de 5 tentativas a cada 15 minutos.

## Review Focus

1. **Música removida para o admin:** ela não pode aparecer na parada, no gênero nem no álbum. Testes de `topPlayed`, `musicsOfGenre` e `tracksOfAlbum` com `deletedAt` (Task 1).
2. **Música do histórico removida pelo admin (`isAvailable: false`):** ela não entra em "Ouvidas recentemente", que não pode ter um item que não toca. Teste de `recentlyPlayed` (Task 1).
3. **Id inválido ou inexistente na URL** (`/genero/abc`, `/album/999`): a página mostra "não encontrado", nunca quebra. Teste de `parseRouteId` (Task 1), usado pelas duas páginas.
4. **Faixa sem capa:** a faixa de busca ou de histórico (sem álbum no objeto) acha o álbum pelo catálogo, e a faixa de amostra (id `t1`) e o álbum sem capa dão `null`, com o visual de cor e iniciais. Testes de `coverUrlOfTrack` (Task 6).
5. **A barra em páginas sem assinatura** (`/planos`, por exemplo): o hook da capa só consulta o catálogo quando há uma faixa com id numérico tocando, para não gerar pedidos que a API recusa (403). Conferido pelo `enabled` no código (Task 6) e pela aba Rede no roteiro final.

---

### Task 1: Funções puras da tela inicial

**Files:**
- Create: `frontend/src/lib/home.ts`
- Test: `frontend/src/lib/home.test.ts`

**Interfaces:**
- Consumes: `CatalogMusic`, `Album` e `Genre` de `@/lib/api/catalog`; `HistoryEntry` de `@/lib/api/history`.
- Produces:

```ts
export const TOP_PLAYED_COUNT = 10
export const RECENT_COUNT = 5
export const PLAYLIST_TILE_COUNT = 4
export const NEWEST_ALBUM_COUNT = 4
export function topPlayed(musics: CatalogMusic[], count: number): CatalogMusic[]
export function recentlyPlayed(entries: HistoryEntry[], count: number): HistoryEntry[]
export function newestAlbums(albums: Album[], count: number): Album[]
export function musicsOfGenre(musics: CatalogMusic[], genreId: number): CatalogMusic[]
export function tracksOfAlbum(musics: CatalogMusic[], albumId: number): CatalogMusic[]
export function countByGenre(musics: CatalogMusic[]): Map<number, number>
export function greetingFor(hour: number): "Bom dia" | "Boa tarde" | "Boa noite"
export function firstName(name: string): string
export function parseRouteId(param: string | string[] | undefined): number | null
```

- [ ] **Step 1: Escrever os testes**, com um helper de módulo `music(id, overrides)` que monta um `CatalogMusic` mínimo:

| Teste | Espera |
| --- | --- |
| `topPlayed orders by plays, then by name` | plays [3, 9, 9] com nomes ["C", "B", "A"] dá os ids na ordem de "A", "B", "C" |
| `topPlayed keeps at most count and skips removed musics` | 12 músicas, uma com `deletedAt`: 10 resultados, sem a removida |
| `recentlyPlayed keeps the history order and skips unavailable` | `isAvailable` [true, false, true]: o 1º e o 3º, na ordem |
| `newestAlbums takes the highest ids first` | ids [2, 9, 5] e count 2 dá [9, 5] |
| `musicsOfGenre keeps the genre's musics, most played first` | só as que têm o gênero, ordenadas por `plays` decrescente, sem as removidas |
| `tracksOfAlbum keeps the album's musics in id order` | `album.id` igual, ids crescentes, sem as removidas |
| `countByGenre counts active musics per genre` | duas músicas no gênero 1 e uma no 2, mais uma removida no 1: `{1 → 2, 2 → 1}` |
| `greetingFor follows the hour` | 4 dá "Boa noite", 5 "Bom dia", 11 "Bom dia", 12 "Boa tarde", 17 "Boa tarde", 18 "Boa noite" |
| `firstName takes the first word` | `"  Ana Andrade "` dá "Ana"; `""` dá "" |
| `parseRouteId accepts positive integers only` | "7" dá 7; "abc", "0", "-1", "1.5", `undefined` e `["7"]` dão `null` |

- [ ] **Step 2:** `bun test src/lib/home.test.ts` em `frontend/`. Esperado: FAIL, porque o módulo não existe.
- [ ] **Step 3:** implementar `lib/home.ts`. As ordenações copiam o array (`toSorted`) e não alteram a entrada.
- [ ] **Step 4:** rodar o teste de novo. Esperado: PASS.
- [ ] **Step 5: Commit.** `feat(catalogo): adiciona as regras de seleção da tela inicial`

### Task 2: Componentes compartilhados

Esta tarefa não muda comportamento. Ela só prepara os componentes que as telas novas reaproveitam.

**Files:**
- Create: `frontend/src/components/album-cover-image.tsx`, para onde vai o `AlbumCoverImage` de `app/admin/conteudo/album-cover.tsx`. O `CoverField`, o `COVER_ACCEPT` e o `useObjectUrl` ficam no admin. A `<img>` ganha `decoding="async"`.
- Modify: `app/admin/conteudo/album-cover.tsx`, `album-picker.tsx` e `albums-section.tsx`, para importar de `@/components/album-cover-image`.
- Create: `frontend/src/components/track-row.tsx`, com o `TrackResult` de `app/busca/page.tsx` renomeado para `TrackRow`, com as mesmas props e o mesmo visual.
- Modify: `app/busca/page.tsx`, para usar o `TrackRow`.

**Interfaces:**
- Produces:
  - `AlbumCoverImage({ album, previewUrl?, className? })`, igual ao de hoje;
  - `TrackRow({ isPlaying, onClick, title, actions, children })`, igual ao `TrackResult`.

- [ ] **Step 1:** fazer a mudança e rodar as verificações das Global Constraints. Esperado: tudo verde, sem teste novo.
- [ ] **Step 2: Commit.** `refactor(frontend): compartilha a capa do álbum e a linha de faixa`

### Task 3: `/inicio` e o redirecionamento depois do login

**Files:**
- Modify: `frontend/src/lib/auth/auth.test.ts:44-47`, para esperar `"/inicio"`.
- Modify: `frontend/src/lib/auth/validation.ts:71`, com `DEFAULT_AFTER_LOGIN = "/inicio"`.
- Modify: `frontend/src/components/header.tsx`. O link "Zovic" leva a `session ? "/inicio" : "/"`, e o comentário acima dele também muda.
- Modify: `frontend/src/components/admin/require-admin.tsx`, com `router.replace("/inicio")`.
- Modify: `frontend/src/app/page.tsx`, com um efeito que, havendo sessão (`useSession`), chama `router.replace("/inicio")`. Enquanto a sessão carrega, a landing aparece normalmente.
- Create: `frontend/src/app/inicio/layout.tsx`, com o `RequireSubscription`, como `app/playlist/layout.tsx`.
- Create: `frontend/src/app/inicio/page.tsx`
- Create: `frontend/src/components/playlist-tile.tsx`

**Interfaces:**
- Consumes:
  - Task 1 (todas as funções e constantes) e Task 2 (`AlbumCoverImage` e `TrackRow`);
  - `useCatalogMusics`, `useAlbums` e `useGenres` (`@/lib/api/catalog`);
  - `useHistory` (`@/lib/api/history`) e `useMyPlaylistsData` (`@/lib/playlist-store`);
  - `useSession` (`@/lib/auth/client`);
  - `playQueue`, `playOrToggleTrack`, `currentTrackOf`, `usePlayback` e `useCatalogTracks` (`@/lib/playback-store`);
  - `musicToTrack`, `getPlaylistInitials` e `getContrastTextColor`;
  - `AddToQueueButton`; `formatDuration`.
- Produces: `PlaylistTile({ playlist }: { playlist: PlaylistData })`, um quadrado na cor da playlist, com a moldura impressa, as iniciais e o nome, levando para `/playlist/[id]`.

- [ ] **Step 1:** mudar `auth.test.ts` para `"/inicio"` e rodar `bun test src/lib/auth/auth.test.ts`. Esperado: FAIL nas 4 asserções.
- [ ] **Step 2:** mudar o `DEFAULT_AFTER_LOGIN` e rodar de novo. Esperado: PASS.
- [ ] **Step 3: Montar a página `/inicio`**, com `Header`, `max-w-6xl` e as seções na ordem da spec:
  - **Saudação:** a hora fica num `useState<number | null>` preenchido num efeito. Antes disso, aparece só o nome.
  - **"Mais tocadas":** a lista vem de `topPlayed(musics, TOP_PLAYED_COUNT)`. O número da posição fica em mono (`01`…`10`).
    - O clique numa linha chama `playQueue(lista.map(musicToTrack), índice)`.
    - A faixa atual aparece marcada com `currentTrackOf(playback)?.id`.
  - **"Ouvidas recentemente":** a lista vem de `recentlyPlayed(history, RECENT_COUNT)`, e o clique chama `playOrToggleTrack`, como em `/historico`.
    - Sem histórico, a seção não é renderizada.
    - Nesse caso a grade passa a uma coluna, com `max-w-3xl` na parada.
  - **"Suas playlists":** até `PLAYLIST_TILE_COUNT` `PlaylistTile`, mais o cartão "+ Nova playlist" para `/playlist`. Sem playlists, só o cartão "Criar sua primeira playlist".
  - **"Novidades":** os cartões vêm de `newestAlbums(albums, NEWEST_ALBUM_COUNT)`, cada um com `AlbumCoverImage`, nome, artistas e ano, levando para `/album/[id]`.
    - O botão ▶ tem `aria-label` `Tocar ${album.name}` e chama `playQueue(tracksOfAlbum(musics, album.id).map(musicToTrack), 0)`.
    - Ele aparece no hover e no foco, como o × da playlist.
  - **"Gêneros":** um `Link` para `/genero/[id]` por gênero, com fundo `color-mix(in oklab, cor 14%, transparent)`, borda da cor, o nome e "N músicas", contadas por `countByGenre`.
  - **Estados:** cada seção mostra "Carregando…" e o `apiErrorMessage` por conta própria, e as outras continuam.
  - **Anúncios:** os `AddToQueueButton` anunciam numa região `<output>` do topo, como em `/busca`.
- [ ] **Step 4:** rodar as verificações das Global Constraints. Esperado: tudo verde.
- [ ] **Step 5: Conferência visual.**
  - Captura de `/inicio` com a `ana.andrade@zovic.test` e com uma conta nova assinante, criada pela API e assinada com `POST /api/plans`.
  - Esperado: a conta nova não tem a coluna de ouvidas e vê o cartão "Criar sua primeira playlist"; a Ana vê as duas colunas.
- [ ] **Step 6: Commit.** `feat(catalogo): adiciona a tela inicial depois do login (HU-33)`

### Task 4: `/genero/[id]`

**Files:**
- Create: `frontend/src/app/genero/layout.tsx`, com o `RequireSubscription`.
- Create: `frontend/src/app/genero/[id]/page.tsx`

**Interfaces:**
- Consumes:
  - Task 1 (`parseRouteId` e `musicsOfGenre`) e Task 2 (`TrackRow`);
  - `useGenres` e `useCatalogMusics`; `AddToQueueButton` e `AddToPlaylistMenu`;
  - `playQueue`, `currentTrackOf` e `usePlayback`;
  - `formatTotalDuration` e `sumDurationSec`.

- [ ] **Step 1: Montar a página**, com o id de `useParams()`:
  - **Topo:**
    - o rótulo "Gênero" em mono;
    - o nome num `h1` com um círculo na cor do gênero;
    - `N músicas · duração total`;
    - o botão "Tocar", que chama `playQueue(faixas, 0)` e fica desligado sem músicas.
  - **Linhas:** usam o `TrackRow`, com `AddToQueueButton` e `AddToPlaylistMenu` nas `actions` e o anúncio num `<output>`, como em `/busca`. O clique chama `playQueue(faixas, índice)`.
  - **Gênero não encontrado:** quando `parseRouteId` dá `null`, ou quando os gêneros carregaram e o id não está entre eles, a página mostra "Gênero não encontrado" e um link para `/inicio`.
  - **Gênero vazio:** "Nenhuma música neste gênero ainda".
- [ ] **Step 2:** rodar as verificações e capturar `/genero/<id do Samba>`. Capturar também `/genero/abc`, que deve mostrar "Gênero não encontrado".
- [ ] **Step 3: Commit.** `feat(catalogo): adiciona a página do gênero`

### Task 5: `/album/[id]`

**Files:**
- Create: `frontend/src/app/album/layout.tsx`, com o `RequireSubscription`.
- Create: `frontend/src/app/album/[id]/page.tsx`

**Interfaces:**
- Consumes:
  - Task 1 (`parseRouteId` e `tracksOfAlbum`) e Task 2 (`AlbumCoverImage` e `TrackRow`);
  - `useAlbums` e `useCatalogMusics`; `AddToQueueButton`;
  - `playQueue`, `currentTrackOf` e `usePlayback`;
  - `formatTotalDuration` e `sumDurationSec`.

- [ ] **Step 1: Montar a página:**
  - **Topo:**
    - `AlbumCoverImage` de `size-48 sm:size-56`;
    - o rótulo "Álbum" em mono;
    - o nome num `h1`, os artistas e, em mono, `ano · N faixas · duração`, sem o ano quando ele é `null`;
    - o botão "Tocar".
  - **Faixas:** numeradas a partir de 1, cada uma com `AddToQueueButton` e o anúncio num `<output>`. O clique chama `playQueue(faixas, índice)`.
  - **Álbum não encontrado:** "Álbum não encontrado" e um link para `/inicio`, com a mesma regra do gênero.
- [ ] **Step 2:** rodar as verificações e capturar `/album/<id de um álbum com capa>` e `/album/999`.
- [ ] **Step 3: Commit.** `feat(catalogo): adiciona a página do álbum`

### Task 6: Capa do álbum na barra e nas cartas do player

**Files:**
- Create: `frontend/src/lib/track-cover.ts`
- Test: `frontend/src/lib/track-cover.test.ts`
- Modify: `frontend/src/lib/api/catalog.ts`. O `useCatalogMusics` e o `useAlbums` aceitam `options: { enabled?: boolean } = {}` e repassam ao `useQuery`, e as chamadas atuais não mudam.
- Modify: `frontend/src/components/playback-bar.tsx`, na miniatura.
- Modify: `frontend/src/app/player/page.tsx`, no `TrackCard`.

**Interfaces:**
- Consumes: `CatalogMusic` e `Album`; `apiUrl`.
- Produces:

```ts
/** API path of the cover of the track's album; null for sample tracks, tracks without album, albums without cover. */
export function coverUrlOfTrack(trackId: string, musics: CatalogMusic[], albums: Album[]): string | null
/** Same, from the cached catalog; queries only while a catalog track (numeric id) is given. */
export function useTrackCover(trackId: string | null | undefined): string | null
```

- [ ] **Step 1: Escrever os testes:**

| Teste | Espera |
| --- | --- |
| `finds the cover through the music's album` | música 7 no álbum 3, e o álbum 3 com `coverUrl` "/api/albums/3/cover?v=1": devolve esse caminho |
| `sample tracks have no cover` | "t1" dá `null` |
| `a music without album has no cover` | `album: null` dá `null` |
| `an album without cover has no cover` | `coverUrl: null` dá `null` |
| `an unknown music has no cover` | id que não está no catálogo dá `null` |

- [ ] **Step 2:** `bun test src/lib/track-cover.test.ts`. Esperado: FAIL, porque o módulo não existe.
- [ ] **Step 3:** implementar `coverUrlOfTrack`, e o `useTrackCover` com `enabled: /^\d+$/.test(trackId ?? "")` nos dois hooks do catálogo. Rodar o teste de novo. Esperado: PASS.
- [ ] **Step 4: Barra.** A miniatura de `size-10` mostra `<img src={apiUrl(capa)} alt="" decoding="async" className="size-10 rounded-lg object-cover">` quando `useTrackCover(track?.id)` não é nulo. Sem capa, fica a cor e as iniciais de hoje.
- [ ] **Step 5: Cartas do `/player`.**
  - O `TrackCard` recebe `coverUrl: string | null`, resolvido no `PlayerPage` para cada faixa, com uma única leitura do catálogo e uma chamada de `coverUrlOfTrack` por carta. Não use um hook por carta.
  - Com capa: uma `<img>` `absolute inset-0 size-full object-cover`, com `decoding="async"`, fica atrás do conteúdo. Por cima vai um degradê `bg-gradient-to-t from-black/75 via-black/20 to-transparent`, e o texto passa a branco.
  - As iniciais do topo somem quando há capa.
- [ ] **Step 6:** rodar as verificações. Depois, com o `bun start full` e uma música com capa e áudio (cadastrada pelo admin), capturar a barra e o `/player`.
- [ ] **Step 7: Commit.** `feat(player): mostra a capa do álbum na barra e nas cartas do player`

### Task 7: Documentação, revisão final e roteiro

**Files:**
- Modify: `README.md`.
  - A frase "Quem tem assinatura (ou é admin) vê as músicas já ouvidas…" passa a citar a tela inicial (`/inicio`) como a entrada depois do login.
  - A seção "Demo do player" ganha um passo: tocar um álbum pelas Novidades.
- Modify: `docs/prompts/prompts.md`, com a seção `### 06/11/2026: tela inicial e páginas de gênero e álbum (HU-33)`, no formato das anteriores.

- [ ] **Step 1:** escrever a doc e rodar as verificações. Commit: `docs(catalogo): documenta a tela inicial e o uso de IA`.
- [ ] **Step 2:** revisão final da branch por um subagente com modelo `opus`, contra a spec e este plano. Corrigir o que for Crítico ou Importante, com teste.
- [ ] **Step 3:** deixar o `bun start full` no ar e passar ao Victor o roteiro de conferência no Opera:
  - entrar com uma conta nova e confirmar que cai em `/inicio`;
  - tocar a parada;
  - abrir um gênero e um álbum;
  - conferir a capa na barra e no `/player`;
  - em `/planos`, com uma conta sem assinatura, ver na aba Rede que não sai nenhum `GET /musics`.
- [ ] **Step 4:** mostrar ao Victor o texto da issue HU-33 e o comentário da #88 (da spec), e só publicar com o OK dele.
