# Reprodução com áudio real e fila: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o assinante ouve o MP3 real das músicas pelo player, com controles de verdade, e monta uma fila no navegador (HU-13 e HU-14, issue #90).

**Architecture:**
- **API:** um caso de uso `GetMusicAudio` decide se o arquivo pode ser entregue. A rota `GET /api/musics/:id/audio`, atrás do `subscriberOnly`, entrega o arquivo com `res.sendFile`, que já responde a `Range`.
- **Fila no front:** passa a ser uma lista própria no `playback-store`, com um `listenId` para registrar uma reprodução por audição.
- **Motor de áudio:** um `<audio>` único no layout raiz toca a faixa atual e publica o progresso num store separado (`audio-player`), que a barra e o player leem.

**Tech Stack:** Bun, Express 5, PostgreSQL, Better Auth (API); Next.js, React 19, TanStack Query, `bun test`, oxlint (front).

**Spec:** [docs/superpowers/specs/2026-11-06-reproducao-design.md](../specs/2026-11-06-reproducao-design.md)

## Global Constraints

- **Branch:** `feat/HU-13-player-audio`, criada a partir da `feat/HU-28-cadastro-musica-audio`. O PR depende do da HU-28.
- **Commits:** Conventional Commits em português, com `Refs #90` e o rodapé `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Use `git add` com caminhos explícitos e **nunca** inclua `api/bruno/auth/cadastro.bru` nem `api/bruno/auth/login.bru`, que têm a senha real.
- **Nomes:**
  - identificadores em inglês e descritivos, nunca de uma letra só, nem em callbacks;
  - comentários e mensagens para o usuário em português;
  - os testes do front seguem o idioma do arquivo de teste vizinho, que é o inglês.
- **API em portas e adaptadores:** `api/domain` não importa Express.
- **Valores fixos:**
  - `Cache-Control` do áudio: `private, max-age=86400`;
  - mensagem do 403: `"Música explícita: só para maiores de 18 anos"`;
  - `UNAVAILABLE_SKIP_DELAY_MS = 1500`;
  - volume inicial `DEFAULT_VOLUME = 0.7`;
  - passo das setas na barra: `SEEK_STEP_SECONDS = 5`;
  - chave do `sessionStorage`: `zovic_playback_v2`;
  - sugestões depois de uma faixa avulsa: `SUGGESTION_COUNT = 8`, sem mudança.
- **Textos da interface:**
  - `"Indisponível"`;
  - `"Adicionar à fila"`, com `aria-label` `Adicionar ${title} à fila`;
  - `Tirar ${title} da fila`;
  - o anúncio `“${title}” entrou na fila`.
- **Verificação antes de cada commit:**
  - na API (`api/`): `bun run test`, `bun run lint` e `bun run typecheck`. Com o banco no ar, também `bun run test:integration`;
  - no front (`frontend/`): `bun run lint`, `bun run test` e `bunx tsc --noEmit`. O erro de `LayoutProps` em `layout.tsx` já existia e pode ser ignorado.
- **Lint (oxlint):**
  - helpers no escopo do módulo, nunca dentro de `describe`;
  - nada de `new Date()` durante a renderização no React;
  - nada de `role="radio"`.
- **Shell:** Git Bash no Windows. Use `MSYS_NO_PATHCONV=1` em comandos do `docker compose exec` que recebem caminhos.

## Review Focus

1. **Tirar uma faixa que vem antes da atual, com a música tocando.** A música que toca não pode mudar, e pausar e voltar não pode registrar outra reprodução. Teste em `removeFromQueue` (Task 4), sobre o `currentIndex` e o `listenId`.
2. **Erro de áudio na última faixa da fila.** O player para na última faixa, sem voltar ao começo e sem pular em ciclo. Teste em `skipUnavailable` (Task 4).
3. **Estado `v1` antigo no `sessionStorage`** depois do deploy. Ele é ignorado, sem quebrar a página. Teste de `parsePlaybackState` (Task 4).
4. **Arquivo registrado no banco, mas ausente do disco.** A rota responde 404, nunca 500. Teste de integração na Task 3.
5. **Id malformado na URL** (`/api/musics/abc/audio`). A rota responde 404, pelo `idParam`. Teste de integração na Task 3.

---

### Task 1: Mover `TIME_ZONE` para `domain/shared/age.ts`

O valor `"America/Sao_Paulo"` está repetido em `api/domain/use-cases/subscribe-plan.ts:7` e em `api/adapters/auth/create-auth.ts:34`. A Task 2 seria o terceiro uso.

**Files:**
- Modify: `api/domain/shared/age.ts`: `export const TIME_ZONE = "America/Sao_Paulo"`, com um comentário de uma linha: o dia do calendário de quem usa o Zovic.
- Modify: `api/domain/use-cases/subscribe-plan.ts` e `api/adapters/auth/create-auth.ts`: remover a constante local e importar a de `age.ts`.

- [ ] **Step 1:** fazer a troca e rodar `bun run typecheck`, `bun run lint` e `bun run test` em `api/`. Esperado: tudo verde, sem teste novo.
- [ ] **Step 2: Commit.** `refactor(api): centraliza o fuso horário do calendário em age.ts`

### Task 2: Caso de uso `GetMusicAudio`

**Files:**
- Create: `api/domain/use-cases/get-music-audio.ts`
- Test: `api/domain/use-cases/get-music-audio.test.ts`

**Interfaces:**
- Consumes: `MusicRepository.findById(id): Promise<Music | null>`, que devolve `null` para inexistente ou removida; `Music.audioFile: string | null`; `Music.isExplicit: boolean`; `isAdult`, `calendarDateIn` e `TIME_ZONE` de `domain/shared/age.ts`; `NotFoundError` e `ForbiddenError` de `domain/errors/domain-error.ts`.
- Produces: `class GetMusicAudio { constructor(musics: MusicRepository); execute(input: { musicId: number; birthdate: string | null; now: Date }): Promise<{ audioFile: string }> }`.

- [ ] **Step 1: Escrever os testes.** O repositório em memória fica no escopo do módulo, com `findById` sobre um `Map<number, Music>`. `nextId`, `save` e `findByIds` são mínimos. Crie as músicas com `Music.create({ id, name, duration: 180, artistIds: [1], audioFile: "faixa.mp3", isExplicit })`. Para "sem arquivo", use `Music.restore({ ...Music.create(...).toData(), audioFile: null })`, como em `manage-catalog.test.ts:195`. Para "removida", não ponha a música no mapa: é o que o repositório real devolve. Use `NOW = new Date("2026-11-06T15:00:00Z")`.

| Teste | Espera |
| --- | --- |
| `entrega o arquivo da música ativa` | `{ audioFile: "faixa.mp3" }` |
| `recusa a música inexistente ou removida` | rejeita com `NotFoundError` |
| `recusa a música sem arquivo de áudio` | `NotFoundError` |
| `recusa a música explícita para menor de idade` | birthdate `"2010-01-01"`: `ForbiddenError` com a mensagem `"Música explícita: só para maiores de 18 anos"` |
| `recusa a música explícita sem data de nascimento` | birthdate `null`: `ForbiddenError` |
| `entrega a música explícita para quem faz 18 anos hoje` | birthdate `"2008-11-06"`: `{ audioFile }` |
| `entrega a música não explícita para menor de idade` | birthdate `"2010-01-01"`, `isExplicit: false`: `{ audioFile }` |

- [ ] **Step 2:** `bun test domain/use-cases/get-music-audio.test.ts` em `api/`. Esperado: FAIL, porque o módulo ainda não existe.
- [ ] **Step 3:** implementar `GetMusicAudio`. A ordem das checagens é inexistente ou sem arquivo (404) antes de explícita (403), para não revelar que existe um arquivo que a pessoa não pode ouvir.
- [ ] **Step 4:** rodar o teste de novo. Esperado: PASS.
- [ ] **Step 5: Commit.** `feat(player): adiciona o caso de uso que libera o áudio da música`

### Task 3: Rota `GET /api/musics/:id/audio` com testes de integração e doc

**Files:**
- Modify: `api/adapters/http/admin-controller.ts`:
  - `CatalogController.musicAudio`;
  - `makeCatalogController(queries, plays, covers, audio: LocalFileStorage, getMusicAudio: GetMusicAudio)`;
  - a constante `AUDIO_CACHE_CONTROL = "private, max-age=86400"`.
- Modify: `api/adapters/http/routes.ts`: `router.get("/musics/:id/audio", subscriberOnly, catalog.musicAudio)`, ao lado de `/musics/:id/plays`.
- Modify: `api/infra/composition-root.ts`: passar `storages.audio` e `new GetMusicAudio(new PostgresMusicRepository(db))`, reaproveitando a instância do repositório que o `ManageCatalog` já recebe.
- Create: `api/adapters/http/music-audio-routes.test.ts`
- Modify: `api/adapters/http/openapi.ts`: entrada `"/api/musics/{id}/audio"`, ao lado de `"/api/albums/{id}/cover"`, com 200 `audio/mpeg` (binário), 206, 401, 403 e 404.
- Modify: `api/bruno/admin/cadastrar-musica.bru`: na resposta, `bru.setVar("musicId", res.getBody().id)`.
- Create: `api/bruno/admin/pegar-audio.bru`: `seq` logo depois de `cadastrar-musica`, renumerando as requisições seguintes. Testa 200 e `content-type` `audio/mpeg`.
- Create: `api/bruno/admin/pegar-audio-trecho.bru`: o mesmo pedido com o cabeçalho `Range: bytes=0-9`. Espera 206 e `content-length` 10.
- Modify: `docs/api.md`: a linha da rota na tabela, dizendo que pede assinatura, aceita `Range` e que explícita para menor dá 403.

**Interfaces:**
- Consumes: `GetMusicAudio` (Task 2); `LocalFileStorage.pathOf(fileName)`; `res.locals.birthdate`, preenchido pelo `authenticate` como `"AAAA-MM-DD"` ou `null`.
- Produces: a rota da tabela "Rota" da spec, que o front da Task 5 usa como `apiUrl(\`/api/musics/${id}/audio\`)`.

- [ ] **Step 1: Escrever o teste de integração**, no padrão de `admin-flow.test.ts` e `history-routes.test.ts`:
  - `mkdtemp` para `audioDir` e `coverDir` e `composeApp(auth, null, [ORIGIN], pool, storages)`;
  - `signUp` com `birthdate: "1995-03-12"` e `subscribeAccount` de `./testing/subscriptions.ts`;
  - a limpeza com `deletePlansOfAccounts` e com os ids das músicas criadas.
  - Grave um arquivo `audioDir/<uuid>.mp3` com 64 bytes conhecidos e crie as músicas por SQL: `INSERT INTO musics (name, duration, audio_file, is_explicit) VALUES ($1, 180, $2, $3) RETURNING id`.
  - O menor é um assinante adulto que depois passa por `UPDATE "user" SET birthdate = '2012-05-01' WHERE id = $1`. A sessão relê o usuário a cada pedido, porque o `cookieCache` está desligado. Confira isso se o teste falhar.

| Teste | Espera |
| --- | --- |
| `entrega o áudio ao assinante` | 200, `content-type` `audio/mpeg`, `cache-control` `private, max-age=86400`, corpo igual aos 64 bytes |
| `entrega um trecho pedido com Range` | `Range: bytes=0-9`: 206, `content-range` `bytes 0-9/64`, 10 bytes |
| `recusa quem não está logado` | sem cookie: 401 |
| `não entrega o arquivo a quem não tem assinatura` | conta sem `subscribeAccount`: 403 |
| `não entrega a música removida` | `UPDATE musics SET deleted_at = now()`: 404 |
| `não entrega a música sem arquivo` | `audio_file` NULL: 404 |
| `responde 404 quando o arquivo sumiu do disco` | `audio_file` com nome que não existe no `audioDir`: 404 |
| `responde 404 para id malformado` | `/api/musics/abc/audio`: 404 |
| `não entrega música explícita a menor de idade` | 403, `message` `"Música explícita: só para maiores de 18 anos"` |

- [ ] **Step 2:** com o banco no ar (`bun start` na raiz, depois de conferir com `docker ps` que os containers `zovic-*` da produção estão parados), rodar `bun test adapters/http/music-audio-routes.test.ts` em `api/`. Esperado: FAIL, porque a rota não existe e responde 404.
- [ ] **Step 3:** implementar o `musicAudio` igual ao `albumCover`:
  - `idParam(req)`;
  - `getMusicAudio.execute({ musicId, birthdate: res.locals.birthdate ?? null, now: new Date() })`;
  - `res.set("Cache-Control", AUDIO_CACHE_CONTROL)`;
  - `res.sendFile(audio.pathOf(audioFile), (error) => { if (error) next(new NotFoundError("Audio not found")) })`.
- [ ] **Step 4:** rodar o teste de novo, e depois `bun run test:integration`, `bun run typecheck` e `bun run lint`. Esperado: tudo PASS.
- [ ] **Step 5: Bruno.** Com a API no ar, rodar `cd api/bruno && bunx @usebruno/cli@2 run admin -r --env local`. Esperado: tudo verde.
- [ ] **Step 6: Commit.** `feat(player): entrega o áudio da música só para assinante`, com a rota, o teste, o `openapi.ts`, os `.bru` e o `docs/api.md`.

### Task 4: Fila como lista própria no `playback-store`

**Files:**
- Modify: `frontend/src/lib/playback-store.ts`
- Modify: `frontend/src/lib/playback-store.test.ts`. Os testes de `resolveQueue` e `nextPlayRecord` são substituídos pelos novos, e os de `pickRandomTracks` ficam.
- Modify (chamadas):
  - `frontend/src/components/playback-bar.tsx`;
  - `frontend/src/app/player/page.tsx`;
  - `frontend/src/app/playlist/[id]/page.tsx` (`playAt`, linhas 235-241, 557 e 565);
  - `frontend/src/app/busca/page.tsx:123`;
  - `frontend/src/app/historico/page.tsx:91`;
  - `frontend/src/components/search/search-bar.tsx`.

**Interfaces:**
- Produces, exportado de `playback-store.ts`:

```ts
export interface PlaybackState {
  queue: Track[]
  origin: { kind: "playlist"; playlistId: string } | null
  currentIndex: number
  isPlaying: boolean
  /** Muda sempre que a reprodução vai para uma posição da fila; o motor registra uma audição por listenId. */
  listenId: number
}
// Puras (testadas)
export function startQueue(previous: PlaybackState | null, tracks: Track[], startIndex: number, origin: PlaybackState["origin"], playing?: boolean): PlaybackState | null // null se tracks vazio
export function appendToQueue(previous: PlaybackState | null, track: Track): PlaybackState
export function removeFromQueue(previous: PlaybackState, index: number): PlaybackState // index === currentIndex: devolve o mesmo estado
export function moveTo(previous: PlaybackState, index: number, playing?: boolean): PlaybackState // listenId + 1
export function nextOnEnded(previous: PlaybackState): PlaybackState // última: mesma posição, isPlaying false, mesmo listenId
export function skipUnavailable(previous: PlaybackState): PlaybackState // = nextOnEnded; nome próprio para o motor
export function currentTrackOf(state: PlaybackState | null): Track | null
export function parsePlaybackState(raw: unknown): PlaybackState | null // valida a forma v2; isPlaying sempre false
export function listenToRecord(lastRecordedListenId: number | null, state: PlaybackState): { listenId: number; musicId: number | null } | null
// Ações (mexem no store)
export function playPlaylist(playlist: { id: string; tracks: Track[] }, trackIndex: number, playing?: boolean): void
export function playQueue(tracks: Track[], startIndex: number): void // a futura página de álbum usa esta
export function playOrToggleTrack(trackId: string, catalog: Track[]): void // mantém: faixa + SUGGESTION_COUNT sugestões
export function selectTrackAt(index: number, playing?: boolean): void
export function addToQueue(track: Track): void
export function removeFromQueueAt(index: number): void
export function advanceAfterEnd(): void       // aplica nextOnEnded
export function setPlaying(playing: boolean): void
export function togglePlayback(): void
export function stopPlayback(): void
export function isPlayingFrom(state: PlaybackState | null, playlistId: string): boolean // lê origin
export function usePlayback(): PlaybackState | null
```

- `listenId`: `startQueue` usa `(previous?.listenId ?? 0) + 1`. `moveTo` e `nextOnEnded` incrementam o valor quando mudam de posição. `appendToQueue`, `removeFromQueue` e `togglePlayback` não mexem nele.
- `listenToRecord` devolve `null` quando `state.listenId === lastRecordedListenId`. Senão devolve o `listenId`, e `musicId` vem só de um id numérico positivo, a regra do `nextPlayRecord` de hoje. As amostras da landing dão `null`.
- O que sai do arquivo: `PlaybackSource`, `resolveQueue`, `selectTrack`, `PlayRecord`, `nextPlayRecord` e `useRecordPlays`. O `useRecordPlays` é substituído na Task 5. Até lá, a barra para de chamá-lo, e a Task 5 religa o registro.

- [ ] **Step 1: Escrever os testes**, com `DEFAULT_TRACKS` de `playlist-store`:

| Teste | Espera |
| --- | --- |
| `a playlist of 5 tracks gives a queue of 5, in order` | `startQueue(null, five, 0, origin)` tem `queue` com os 5 ids na ordem e `origin` da playlist |
| `the next track starts on its own when one ends` | `nextOnEnded` de `currentIndex` 0 tocando: `currentIndex` 1, `isPlaying` true e `listenId` + 1 |
| `the queue stops at its last track` | `nextOnEnded` na última: mesmo índice, `isPlaying` false |
| `adding puts the track at the end` | `appendToQueue` de uma fila de 3: o novo id é o último, e o `currentIndex` não muda |
| `adding with nothing playing starts a paused queue` | `appendToQueue(null, track)`: `queue` com `[track]`, `isPlaying` false |
| `a removed track does not play when the previous one ends` | fila A B C tocando A; `removeFromQueue(…, 1)` e depois `nextOnEnded`: a faixa atual é C |
| `removing a track before the current one keeps the same track and listen` | fila A B C em `currentIndex` 2; remove 0: a faixa atual continua C, `currentIndex` 1 e `listenId` igual |
| `the current track cannot be removed` | `removeFromQueue(state, state.currentIndex)` devolve um estado igual |
| `a track can be in the queue twice` | `appendToQueue` de uma faixa já presente: `queue.length` + 1 |
| `skipping an unavailable last track stops there` | `skipUnavailable` na última: `isPlaying` false, mesmo índice |
| `records each listen once` | `listenToRecord(null, s)` dá `{ listenId: s.listenId, musicId: 10 }` (faixa de id `"10"`); `listenToRecord(s.listenId, s)` dá `null` |
| `sample tracks are not counted` | faixa `"t1"`: `musicId` null |
| `an old v1 state is ignored` | `parsePlaybackState({ source: { kind: "track", queue: [] }, currentTrackId: "1", isPlaying: true })` dá `null` |
| `a restored state comes back paused` | `parsePlaybackState` de um v2 com `isPlaying: true` dá `isPlaying` false |
| `isPlayingFrom reads the origin` | true para o `playlistId` do `origin`; false com `origin` null |

- [ ] **Step 2:** `bun test src/lib/playback-store.test.ts` em `frontend/`. Esperado: FAIL nas funções novas.
- [ ] **Step 3: Implementar o store.**
  - O `load` usa `parsePlaybackState` com `STORAGE_KEY = "zovic_playback_v2"`.
  - Se `startQueue` receber `tracks` vazio, `playPlaylist` e `playQueue` não fazem nada.
  - `playOrToggleTrack` compara com `currentTrackOf(getSnapshot())?.id`.
- [ ] **Step 4: Atualizar as chamadas.**
  - Onde se lia `playback?.currentTrackId`, use `currentTrackOf(playback)?.id`.
  - **Barra e player:** leem `playback.queue` e `playback.currentIndex`. Para nome e cor, usam `usePlaylistData(playback?.origin?.playlistId ?? null)`.
  - **Player:** as `key` das cartas passam a ser `${index}-${track.id}`. Os passos de navegação usam `selectTrackAt(currentIndex ± 1)` e o clique na carta usa `selectTrackAt(index, true)`.
  - **Barra sem nada tocando, numa página de playlist:** `goTo` chama `playPlaylist(pagePlaylist, index)`.
  - **Página da playlist:** `playAt(index, playing)` chama `playPlaylist(currentPlaylist, index, playing)`.
- [ ] **Step 5:** `bun run test`, `bun run lint` e `bunx tsc --noEmit` em `frontend/`. Esperado: tudo verde.
- [ ] **Step 6: Commit.** `feat(player): transforma a fila de reprodução em lista própria`

### Task 5: Motor de áudio e registro da audição

**Files:**
- Create: `frontend/src/lib/audio-player.ts`
- Test: `frontend/src/lib/audio-player.test.ts`
- Create: `frontend/src/components/playback-audio.tsx`
- Modify: `frontend/src/lib/api/catalog.ts`: `musicAudioPath: (musicId: number) => \`/api/musics/${musicId}/audio\``, a ser carregado por `apiUrl`, como o `coverUrl`.
- Modify: `frontend/src/app/layout.tsx`: `<PlaybackAudio />` dentro do `QueryProvider`, antes da `<AppPlaybackBar />`.

**Interfaces:**
- Consumes: Task 4 (`usePlayback`, `currentTrackOf`, `listenToRecord`, `advanceAfterEnd`, `setPlaying`, `skipUnavailable` aplicado por uma ação `skipUnavailableTrack()`, exportada pela Task 5 em `playback-store.ts`); `apiUrl`; `catalogApi.recordPlay`; `adminKeys` e `historyKeys`.
- Produces, de `audio-player.ts`:

```ts
export const DEFAULT_VOLUME = 0.7
export interface AudioSnapshot { currentTime: number; duration: number | null; volume: number; isMuted: boolean; unavailableTrackIds: ReadonlySet<string> }
export function useAudioPlayer(): AudioSnapshot
export function registerAudioElement(element: HTMLAudioElement | null): void // aplica volume/mudo atuais ao registrar
export function reportProgress(currentTime: number, duration: number | null): void
export function markUnavailable(trackId: string): void
export function seekTo(seconds: number): void   // limita a [0, duration]; sem elemento, só atualiza currentTime
export function setVolume(value: number): void  // limita a [0, 1] e tira o mudo
export function toggleMute(): void
```

O store é de módulo, com um `Set` de ouvintes próprio, sem `window`, para o `bun test` rodar sem DOM. O snapshot é um objeto novo a cada mudança, por causa do `useSyncExternalStore`.

- [ ] **Step 1: Escrever os testes**, sem elemento registrado:
  - `setVolume clamps to 0..1 and unmutes`: `toggleMute()`, depois `setVolume(1.4)`, dá `volume` 1 e `isMuted` false;
  - `seekTo stays inside the track`: `reportProgress(0, 100)`, depois `seekTo(150)`, dá `currentTime` 100, e `seekTo(-3)` dá 0;
  - `marks a track unavailable once`: `markUnavailable("7")` duas vezes dá um `Set` de tamanho 1;
  - `starts at the default volume`: `volume` igual a `DEFAULT_VOLUME`.
- [ ] **Step 2:** `bun test src/lib/audio-player.test.ts`. Esperado: FAIL, porque o módulo não existe.
- [ ] **Step 3:** implementar o `audio-player.ts`. Rodar o teste de novo. Esperado: PASS.
- [ ] **Step 4: Implementar o `PlaybackAudio`**, que renderiza `<audio preload="metadata" ref={registerAudioElement} src={src} />`:
  - `src`: `apiUrl(catalogApi.musicAudioPath(Number(track.id)))` quando o id da faixa atual é numérico, e `undefined` nos outros casos;
  - efeito em `[src, isPlaying]`: `isPlaying` chama `play()`. Se o `play()` rejeitar com `NotAllowedError`, chama `setPlaying(false)`, e o `AbortError` da troca de `src` é ignorado. Sem `isPlaying`, chama `pause()`;
  - `onTimeUpdate` e `onDurationChange`: `reportProgress(element.currentTime, Number.isFinite(element.duration) ? element.duration : null)`. Na troca de faixa, `reportProgress(0, null)`;
  - `onEnded`: `advanceAfterEnd()`;
  - `onPlaying`: `listenToRecord(lastRecordedRef.current, state)`. Quando o resultado não é nulo, guarda o `listenId` no ref. Com `musicId`, chama `recordPlay(musicId)`, invalida `adminKeys.all` e `historyKeys.all` e ignora o erro, o mesmo `.then` e `.catch` do `useRecordPlays` de antes;
  - `onError`: só quando há `src`. Chama `markUnavailable(track.id)` e guarda se estava tocando. Depois chama `setPlaying(false)`. Se estava tocando, agenda `skipUnavailableTrack()` para daqui a `UNAVAILABLE_SKIP_DELAY_MS` e cancela o timer se o `listenId` mudar ou o componente desmontar. O `skipUnavailableTrack` só age se o `listenId` ainda for o do erro.
- [ ] **Step 5:** `bun run test`, `bun run lint` e `bunx tsc --noEmit` em `frontend/`. Esperado: tudo verde.
- [ ] **Step 6: Commit.** `feat(player): toca o áudio real e registra a audição quando o som começa`

### Task 6: Barra e player com progresso, volume, indisponível e "Tirar da fila"

**Files:**
- Modify: `frontend/src/components/playback-bar.tsx`
- Modify: `frontend/src/app/player/page.tsx`

**Interfaces:**
- Consumes: `useAudioPlayer`, `seekTo`, `setVolume` e `toggleMute` (Task 5); `removeFromQueueAt` e `selectTrackAt` (Task 4).

- [ ] **Step 1: Barra.**
  - **Estado local que sai:** `playbackProgress`, `volume` e `isMuted`.
  - **Progresso:** a duração mostrada é `duration ?? track.durationSec`. A barra preenche `currentTime / duração`.
  - **Clique na barra:** `seekTo(fração × duração)`.
  - **Setas:** `ArrowRight` e `ArrowLeft` chamam `seekTo(currentTime ± SEEK_STEP_SECONDS)`.
  - **Tempo decorrido:** sempre visível, com `formatDuration` de `lib/format-duration`. Some a condição `isPlaying ?`.
  - **Volume:** o slider vai de 0 a 100 e chama `setVolume(valor / 100)`. O botão de mudo chama `toggleMute()`.
  - **Faixa indisponível** (`unavailableTrackIds.has(track.id)`): a linha do artista mostra `"Indisponível"`, e o botão tocar/pausar fica `disabled`.
- [ ] **Step 2: Player.**
  - O `TrackCard` ganha `isUnavailable: boolean` e `onRemove?: () => void`.
  - **Selo:** a carta indisponível mostra `"Indisponível"` no canto, em `font-mono text-xs`.
  - **Botão de tirar:** as cartas com `distance > 0` ganham um botão × com `CloseIcon`, `aria-label` `Tirar ${track.title} da fila` e `onClick` que chama `removeFromQueueAt(index)`.
    - O botão fica acima do botão da carta (`z-20`, `pointer-events-auto`) e aparece no hover e no foco: `opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100`, como o "Tirar da playlist".
    - O `onClick` chama `stopPropagation()` para não tocar a carta.
- [ ] **Step 3:** `bun run lint`, `bun run test` e `bunx tsc --noEmit`. Esperado: tudo verde.
- [ ] **Step 4: Commit.** `feat(player): liga progresso, volume e a fila do player ao áudio real`

### Task 7: "Adicionar à fila" na busca, na playlist e no histórico

**Files:**
- Create: `frontend/src/components/add-to-queue-button.tsx`
- Modify:
  - `frontend/src/app/busca/page.tsx`: nas `actions` do `TrackResult`, antes do `AddToPlaylistMenu`, com o mesmo `setAdded`;
  - `frontend/src/app/playlist/[id]/page.tsx`: na fileira de botões da linha (por volta da linha 443), antes do botão de curtir. O anúncio sai por uma região `aria-live="polite"` nova, no padrão do `added` da busca;
  - `frontend/src/app/historico/page.tsx`: o `PlayableRow` é um botão inteiro, então o botão de fila fica ao lado dele, como irmão no `<li>`, nunca aninhado. O anúncio também sai por uma região `aria-live`.

**Interfaces:**
- Consumes: `addToQueue(track)` (Task 4); `QueueIcon` de `components/icons`, que é o mesmo ícone do botão de fila da barra. O `ListPlusIcon` já é do menu de playlist, e os dois botões precisam ficar distintos.
- Produces: `export function AddToQueueButton({ track, onResult }: { track: Track; onResult: (message: string, ok: boolean) => void })`. O clique chama `addToQueue(track)` e depois `onResult(\`“${track.title}” entrou na fila\`, true)`, com `aria-label` `Adicionar ${track.title} à fila` e `title` `"Adicionar à fila"`.

- [ ] **Step 1:** implementar o componente e ligá-lo nas três páginas. Na busca, a faixa é `result.track`. No histórico, é `musicToTrack({ id, name, duration, artists })`, igual ao `onClick` de hoje.
- [ ] **Step 2:** `bun run lint`, `bun run test` e `bunx tsc --noEmit`. Esperado: tudo verde.
- [ ] **Step 3: Commit.** `feat(player): adiciona músicas ao fim da fila pela busca, playlist e histórico`

### Task 8: Documentação, registro de IA e conferência

**Files:**
- Modify: `frontend/src/lib/api/README.md`: o `musicAudioPath`, carregado por `apiUrl` no `<audio>`, que manda o cookie por ser o mesmo site.
- Modify: `docs/prompts/prompts.md`: uma seção `### 06/11/2026: reprodução com áudio e fila (HU-13 e HU-14)`, no formato da tabela que já existe, com o pedido inicial, a spec e o plano como resultados.
- Modify: `docs/superpowers/specs/2026-11-06-reproducao-design.md`: a chave da audição passa a ser o `listenId`, e o Bruno fica em `api/bruno/admin/`.

- [ ] **Step 1:** escrever a doc. Rodar todas as verificações das "Global Constraints", na API e no front. Esperado: tudo verde.
- [ ] **Step 2: Commit.** `docs(player): documenta a rota de áudio no cliente e o uso de IA`
- [ ] **Step 3: Revisão final** da branch inteira, por um subagente com modelo `opus`, contra a spec e este plano. Corrigir o que for Crítico ou Importante, com teste.
- [ ] **Step 4:** deixar o `bun start full` no ar e passar ao Victor o roteiro de conferência:
  - cadastrar uma música com um MP3 real pelo painel do admin;
  - critério 1 da HU-13: tocar, ouvir o som e ver a barra andar;
  - critério 2: pausar e voltar continua do mesmo ponto;
  - arrastar a barra de progresso e mexer no volume e no mudo;
  - critério 4: uma música do seed aparece como "Indisponível" e a fila pula para a próxima;
  - tocar uma playlist e conferir a ordem da fila;
  - adicionar à fila pela busca e tirar uma música pelo × no `/player`;
  - conferir que a música indo para a próxima sozinha no fim aparece no histórico.
