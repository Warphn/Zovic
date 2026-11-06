# Reprodução com áudio real e fila (HU-13 e HU-14)

Issue #90. Branch `feat/HU-13-player-audio`, criada a partir da `feat/HU-28-cadastro-musica-audio`: o PR depende do da HU-28, que traz `musics.audio_file`, o `LocalFileStorage` e o volume `audio`.

## Objetivo

O assinante ouve o áudio real das músicas, com tocar, pausar, barra de progresso, volume, próxima e anterior, e monta uma fila no navegador. A HU-13 é P0 e a HU-14 é P1. Cada critério de aceite da #90 vira um teste ou um item do roteiro de conferência na tela.

## Decisões

| Pergunta | Decisão |
| --- | --- |
| Música explícita para menor | A rota de áudio já recusa (403). A HU-09 (#87) continua com o filtro da busca e do catálogo. |
| Como o front sabe que uma música não toca | Pelo erro do `<audio>`. As rotas de busca, playlist e histórico não mudam. |
| Quando a audição conta | No primeiro evento `playing` do `<audio>` em cada audição. |
| Modelo da fila | Tocar uma playlist copia as faixas dela para uma fila própria. Editar a playlist durante a reprodução não muda a fila. |
| Botões da fila | "Adicionar à fila" nas linhas da busca, da playlist e do histórico; "Tirar da fila" num × nas cartas que ainda vão tocar no `/player`. |
| Tocar um álbum | Não há página de álbum no front. O store expõe `startQueue`, que a futura página vai chamar. |

## API

### Rota `GET /api/musics/:id/audio`

Protegida pelo `subscriberOnly` (`authenticate` + `requireSubscription`). O admin passa sem assinatura, como nas outras rotas.

| Situação | Resposta |
| --- | --- |
| Assinante, música ativa com arquivo | 200, `Content-Type: audio/mpeg`, o arquivo inteiro |
| O mesmo, com `Range: bytes=0-9` | 206, 10 bytes, `Content-Range` |
| Sem sessão | 401 |
| Sem assinatura ativa | 403 (critério 3 da HU-13) |
| Música inexistente, removida ou sem arquivo | 404 (critério 4 da HU-13) |
| Música explícita para quem não é maior de idade | 403 `ForbiddenError`, mensagem "Música explícita: só para maiores de 18 anos" |
| Arquivo registrado no banco, mas ausente do disco | 404 |

### Domínio

- **Caso de uso** `GetMusicAudio` em `api/domain/use-cases/get-music-audio.ts`. Entrada: `{ musicId, birthdate, now }`. Saída: o nome do arquivo de áudio.
  - Usa `MusicRepository.findById`, que já devolve `null` para música inexistente ou removida. `null` ou `audioFile === null` dão `NotFoundError`.
  - `isExplicit` e `!isAdult(birthdate, calendarDateIn(now, TIME_ZONE))` dão `ForbiddenError`. Sem data de nascimento, `isAdult` é falso, a regra mais restritiva que o resto do código já usa.
- **Fuso:** `TIME_ZONE = "America/Sao_Paulo"` já se repete em `subscribe-plan.ts` e `create-auth.ts`. Com este terceiro uso, a constante vai para `api/domain/shared/age.ts`, num commit de refatoração separado.

### Adaptador HTTP

- `makeCatalogController` ganha `musicAudio`, ao lado de `albumCover`, e passa a receber o storage de áudio. O `composeApp` passa `storages.audio`.
- O controller lê `res.locals.birthdate`, chama o caso de uso, define `Cache-Control: private, max-age=86400` (o arquivo nunca muda, mas o acesso depende da assinatura) e responde com `res.sendFile(audio.pathOf(arquivo))`, que trata o `Range` e define o tipo pela extensão. O erro do `sendFile` segue o tratamento da capa.
- **Cookie:** em dev (`localhost:3000` para `localhost:3333`) e em produção (`zovic.com.br` para `api.zovic.com.br`), front e API são do mesmo site. O `<audio>` sem `crossOrigin` envia o cookie de sessão, como a `<img>` da capa já faz. O CORS não muda.

### Testes da API

- **Unitários** do `GetMusicAudio`, com repositório em memória: sucesso; inexistente; removida; sem arquivo; explícita para menor; explícita sem data de nascimento; explícita para adulto; quem faz 18 anos hoje.
- **Integração**, com `mkdtemp` e `new LocalFileStorage(dir)`, no padrão de `admin-flow.test.ts`: cada linha da tabela de respostas acima.

## Front

### Estado da fila (`frontend/src/lib/playback-store.ts`)

```ts
interface PlaybackState {
  queue: Track[]
  origin: { kind: "playlist"; playlistId: string } | null
  currentIndex: number
  isPlaying: boolean
}
```

- A fila é sempre uma lista própria. O `origin` serve só para a cor, o título e o link da playlist no player e na barra.
- `currentIndex` substitui `currentTrackId`, porque a mesma música pode entrar duas vezes na fila.
- A chave do `sessionStorage` passa a `zovic_playback_v2`. Um estado antigo (`v1`) é ignorado.

**Funções puras**, testadas uma a uma:

| Função | Comportamento |
| --- | --- |
| `startQueue(tracks, startIndex, origin)` | Fila nova com uma cópia de `tracks`, tocando a partir de `startIndex`. É o que a playlist usa e o que a futura página de álbum vai usar. |
| `appendToQueue(state, track)` | Põe `track` no fim. Sem estado, cria a fila só com `track`, pausada. |
| `removeFromQueue(state, index)` | Tira a faixa `index`. Não tira a faixa atual. Ajusta `currentIndex` quando a faixa tirada vinha antes dela. |
| `nextOnEnded(state)` | Avança para a próxima, tocando. Na última, fica nela e pausa: o fim da fila não volta ao começo. |

As ações que já existem passam a usar essas funções:

- `playPlaylist(playlist, trackIndex, playing)` recebe as faixas da playlist e chama `startQueue`;
- `playOrToggleTrack` mantém a música seguida de 8 sugestões do catálogo;
- `isPlayingFrom` lê o `origin`;
- `selectTrack` passa a receber o índice;
- as ações novas são `addToQueue(track)` e `removeFromQueueAt(index)`.

Próxima e anterior pelos botões continuam dando a volta na fila, como hoje.

### Estado do áudio (`frontend/src/lib/audio-player.ts`)

Um store separado, sem persistência, porque muda várias vezes por segundo:

- `currentTime`, `duration`, `volume` (0 a 1, começa em 0,7), `isMuted`;
- `unavailableTrackIds`: as faixas cujo áudio falhou nesta página;
- comandos `seekTo(seconds)`, `setVolume(value)` e `toggleMute()`, que agem sobre o `<audio>` registrado pelo motor.

### Motor (`frontend/src/components/playback-audio.tsx`)

Montado uma vez no layout raiz, fora da regra que esconde a barra no `/`, no `/entrar` e no `/cadastro`, para a música não parar nessas páginas.

- Um `<audio preload="metadata">` com `src = apiUrl("/api/musics/:id/audio")` da faixa atual. Uma faixa sem id numérico (as amostras da landing) não tem `src`.
- O `isPlaying` do store chama `play()` ou `pause()`. Se o navegador recusar o `play()` (por exemplo, depois de recarregar a página sem clique), o `isPlaying` volta para falso.
- `timeupdate` e `durationchange` atualizam o `audio-player`.
- `ended` chama `nextOnEnded`.
- `playing` registra a audição: chama `catalogApi.recordPlay` e invalida as consultas do painel e do histórico, como hoje. A chave da audição é `índice:id`: pausar e voltar é a mesma audição; ir para outra posição da fila e tocar é outra. A lógica fica numa função pura, a sucessora do `nextPlayRecord`, e o `useRecordPlays` sai.
- `error` põe a faixa em `unavailableTrackIds` e pausa. Se ela estava tocando e há uma próxima, a próxima começa depois de `UNAVAILABLE_SKIP_DELAY_MS = 1500`, para dar tempo de ver o aviso.

### Interface

- **Barra** (`playback-bar.tsx`):
  - o progresso vem do `audio-player`, com `durationSec` da faixa como reserva enquanto os metadados não chegam;
  - o clique na barra e as setas (±5 s) chamam `seekTo`;
  - o tempo decorrido aparece também com a música pausada;
  - volume e mudo agem sobre o `<audio>`;
  - uma faixa indisponível mostra "Indisponível" no lugar do artista, e o botão de tocar fica desligado.
- **Player** (`app/player/page.tsx`):
  - as cartas que ainda vão tocar ganham um botão × ("Tirar *título* da fila"), visível no hover e no foco;
  - a carta indisponível ganha o selo "Indisponível";
  - as chaves da lista passam a usar o índice, por causa das músicas repetidas.
- **"Adicionar à fila"**: um botão de ícone, `AddToQueueButton`, ao lado do "Adicionar à playlist" nas linhas da busca, e nas linhas da playlist e do histórico. A página anuncia "“*título*” entrou na fila" pelo mesmo `onResult` do menu de playlist.

### Testes do front

- **Unitários** (`bun run test`) das funções da fila, com os critérios da HU-14:
  - uma playlist de 5 músicas dá uma fila de 5, na ordem;
  - no fim de uma música, a próxima começa sozinha;
  - adicionar põe no fim;
  - uma música tirada não toca quando a anterior acaba.
- Também da chave da audição e do fim da fila.
- **Conferência na tela** (critérios 1, 2 e 4 da HU-13, que dependem do `<audio>`): roteiro para o Victor, com o `bun start full` no ar e um MP3 real cadastrado pelo painel do admin.

## Documentação

- `api/adapters/http/openapi.ts`: a rota nova, com 200, 206, 401, 403 e 404.
- `api/bruno/catalogo/`: requisição do áudio, com casos sem cookie e com `Range`.
- `docs/api.md`: tabela de rotas.
- `frontend/src/lib/api/README.md`: a URL do áudio no cliente.
- `docs/prompts/prompts.md`: o uso de IA nesta entrega.

## Fora desta entrega

- Página de álbum e o "tocar álbum" (épico Catálogo, #76). Nota para o Carlos sobre o `startQueue`, a publicar com o OK do Victor.
- Campo `isPlayable` nas listas da busca, da playlist e do histórico.
- Contar a audição só depois de 30 s.
- Guardar a posição da música ou o volume entre recarregamentos.

## Riscos

- **Banda em produção:** o áudio passa pelo túnel da Cloudflare. Os termos do plano gratuito não permitem usar o proxy principalmente para servir áudio, e cada ouvinte usa cerca de 0,3 Mbps do upload da casa. Para a demo de 24/11, poucos ouvintes ao mesmo tempo.
- **Músicas do seed sem áudio:** todas aparecem como indisponíveis ao tocar. A demo precisa de músicas cadastradas pelo painel com MP3 real.
