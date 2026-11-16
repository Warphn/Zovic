# Músicas ouvidas (HU-15) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** marcar como ouvida a música que tocou mais de 30 s numa reprodução, mostrar a marca nas listas de faixas e criar a aba "Já ouvidas" no histórico.

**Arquitetura:**
- **Front:** o `PlaybackAudio` soma o tempo de som de cada reprodução, num módulo puro, e chama `POST /musics/:id/listens` ao passar dos 30 s.
- **Domínio:** o caso de uso `MarkMusicListened` aplica a regra e grava um evento `music_listened` em `user_event` pela porta `PlayHistory`.
- **Leitura:** `GET /history/listened` devolve as marcadas. Essa lista alimenta a aba e o conjunto de ids dos ícones.

**Tecnologias:** Bun, Express, Joi, PostgreSQL com Flyway, Next.js com React Query, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-11-15-musicas-ouvidas-design.md`

## Restrições globais

- **Regra:** a música conta como ouvida com **mais de 30 s**. 30 s exatos não contam. O domínio usa `LISTENED_THRESHOLD_SECONDS = 30`, e o front tem uma constante com o mesmo nome e o mesmo valor.
- **Portas e adaptadores:** `api/domain` não importa Express, `pg` nem Better Auth.
- **Nomes:** os identificadores ficam em inglês e descritivos, nunca de uma letra (nem em callbacks). Comentários e mensagens ficam em português na API e seguem a língua do arquivo no front (em inglês nos arquivos do front que já estão em inglês).
- **Escopo:** nada de `console.log`, código morto ou dependência nova. O `POST /musics/:id/plays`, o `streams` e o `GET /history` não mudam.
- **Mensagens:** sem linha de commit "wip". Todo commit segue o Conventional Commits, em português, com `Refs #91` e o rodapé `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Banco de testes:** `bun run test:integration` usa o `DATABASE_URL` do `.env`, que no PC do Victor é o mesmo da produção. Antes de rodar, confira com `docker ps` que os containers `zovic-*` sem `-dev` estão parados (peça ao Victor um `bun server down` no Ubuntu) e suba o banco com `bun start backend` na raiz. No fim, rode `bun stop`.

## Pontos de atenção na revisão

1. **Busca na barra durante a reprodução:** pular para frente ou voltar na barra não soma o salto. Só conta o avanço de até `MAX_PROGRESS_STEP_SECONDS` entre dois `timeupdate`. O teste fica na Tarefa 3.
2. **Pausar e voltar:** a soma continua de onde parou e não volta a zero. O teste fica na Tarefa 3.
3. **Mesma faixa tocada de novo:** um `listenId` novo começa a soma do zero e pode avisar de novo. O teste fica na Tarefa 3.
4. **Música removida pelo admin depois de marcada:** continua na aba, com `isAvailable: false`. O teste fica na Tarefa 2.
5. **Faixas de exemplo da landing (id não numérico):** não chamam a API. O teste fica na Tarefa 3, com `musicIdToMark`.

---

### Tarefa 1: Regra e casos de uso no domínio

**Arquivos:**
- Modificar: `api/domain/ports/play-history.ts`
- Modificar: `api/domain/testing/in-memory-play-history.ts`
- Criar: `api/domain/use-cases/mark-music-listened.ts` e `mark-music-listened.test.ts`
- Criar: `api/domain/use-cases/list-my-listened-musics.ts` e `list-my-listened-musics.test.ts`

**Interfaces:**
- Produz, em `play-history.ts`:
  ```ts
  export interface ListenedEntry extends Omit<HistoryEntry, "lastPlayedAt"> {
    /** Quando a música passou dos 30 s pela última vez (ISO). */
    lastListenedAt: string;
  }
  // em PlayHistory:
  /** Grava a marca de ouvida. Devolve false se a música não existe ou foi removida. */
  markListened(userId: number, musicId: number): Promise<boolean>;
  /** As músicas marcadas da conta, cada uma uma vez, da marca mais recente para a mais antiga. A removida vem com isAvailable falso. */
  listListenedForUser(userId: number): Promise<ListenedEntry[]>;
  ```
- Produz `export const LISTENED_THRESHOLD_SECONDS = 30` e a classe `MarkMusicListened`, com `execute({ userId, musicId, playedSeconds }): Promise<void>` e a interface `MarkMusicListenedUseCase`, em `mark-music-listened.ts`.
- Produz a classe `ListMyListenedMusics`, com `execute({ userId }): Promise<ListenedEntry[]>` e a interface `ListMyListenedMusicsUseCase`, em `list-my-listened-musics.ts`.
- Os dois arquivos seguem o formato de `list-my-history.ts` (tipos `…Input`/`…Output`, interface `…UseCase` e a classe).

- [ ] **Passo 1: Escrever os testes que falham**

  No fake, acrescente `readonly listens: { userId: number; musicId: number; listenedAt: Date }[] = []`. O `markListened` empurra `{ userId, musicId, listenedAt: new Date() }` e devolve `false` se `catalog.get(musicId)` não existe ou tem `isAvailable` falso. O `listListenedForUser` agrupa e ordena como o `listForUser`.

  `mark-music-listened.test.ts` (com `ANA = 1` e `MUSIC_A = 10` disponível no `catalog`):
  - `"recusa 20 s e 30 s com BusinessRuleError e não marca nada"`: `execute` com `playedSeconds` igual a 20 e depois 30. Cada um rejeita com `BusinessRuleError`, e `history.listens` fica com tamanho 0.
  - `"marca a música com 31 s"`: depois do `execute` com 31, `history.listens` vira `[{ userId: ANA, musicId: MUSIC_A }]` (use `toMatchObject`).
  - `"dá NotFoundError para música inexistente ou removida"`: um id fora do `catalog` e um id com `isAvailable: false` rejeitam com `NotFoundError`.

  `list-my-listened-musics.test.ts`:
  - `"mostra cada música uma vez, da marca mais recente para a mais antiga"`: as marcas A 10:00, B 11:00 e A 12:00, inseridas direto em `listens`, voltam como `[[A, "…12:00…"], [B, "…11:00…"]]` em `musicId` e `lastListenedAt`.
  - `"mostra só as marcas da própria conta"`.

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `cd api && bun test domain/use-cases/mark-music-listened domain/use-cases/list-my-listened-musics`. O esperado é falhar, porque os módulos ainda não existem.

- [ ] **Passo 3: Implementar**

  O `MarkMusicListened` faz o seguinte:
  - Com `playedSeconds <= LISTENED_THRESHOLD_SECONDS`, lança `BusinessRuleError("A music counts as listened only after more than 30 seconds")`, sem chamar a porta.
  - Depois chama `markListened`. Se a porta devolver `false`, lança `NotFoundError("Music not found")`.

  O `ListMyListenedMusics` só repassa para a porta.

- [ ] **Passo 4: Rodar e ver passar**

  Rode `cd api && bun run test && bun run typecheck`. O esperado é tudo passando. O typecheck acusa o `PostgresPlayHistory` incompleto: isso é esperado e se resolve na Tarefa 2. Se quiser commitar com o typecheck limpo, junte as Tarefas 1 e 2 num commit só.

- [ ] **Passo 5: Commit (junto com a Tarefa 2)**

### Tarefa 2: Banco, rotas e documentação da API

**Arquivos:**
- Criar: `db/migrations/V261116_090000__Adiciona_evento_de_musica_ouvida.sql`, com `ALTER TYPE user_event_type ADD VALUE 'music_listened';` e um cabeçalho no estilo das outras migrações.
- Criar: `db/migrations/V261116_090100__Aceita_musica_no_evento_de_ouvida.sql`, que derruba `user_event_music_id_check` e recria a restrição com `event_type IN ('music_play', 'music_skip', 'music_listened')`. Fica separada porque o Postgres não deixa usar um valor de enum na mesma transação em que ele foi criado.
- Modificar: `api/adapters/db/postgres-play-history.ts`, com `markListened` e `listListenedForUser`.
- Criar: `api/adapters/http/schemas/listened-schemas.ts`, com `musicIdParamsSchema = Joi.object({ id: positiveIntParam("id") })` e `markListenedSchema = Joi.object({ playedSeconds: Joi.number().min(0).required() })`.
- Modificar: `api/adapters/http/history-controller.ts`, que ganha `markListened` (responde 204) e `listListened` (responde JSON). `HistoryUseCases` ganha `markMusicListened` e `listMyListenedMusics`.
- Modificar: `api/infra/composition-root.ts`, que passa a criar os dois casos de uso com o mesmo `PostgresPlayHistory`.
- Modificar: `api/adapters/http/routes.ts`:
  - `router.post("/musics/:id/listens", subscriberOnly, validateParams(musicIdParamsSchema), validateBody(markListenedSchema), history.markListened)`
  - `router.get("/history/listened", subscriberOnly, history.listListened)`, registrada **antes** de qualquer rota `/history/:algo`.
- Testar: `api/adapters/http/history-routes.test.ts`, com um `describe` novo.
- Documentação:
  - `api/adapters/http/openapi.ts`: as duas rotas, com 204/400/401/403/404/409 e o schema `ListenedEntry`.
  - Bruno: `api/bruno/historico/Marcar como ouvida.bru` e `Listar ouvidas.bru`, no formato das requisições vizinhas. Se a pasta tiver outro nome, siga o nome que já existe.
  - Tabela de rotas em `docs/api.md`.
  - `docs/banco-de-dados.md` (as duas migrações).
  - A linha de `user_event` em `docs/modelo-er.md`, que passa a citar `music_listened` e o CHECK.
  - `docs/models.md`: a porta e os dois casos de uso.

**Interfaces:**
- Consome a Tarefa 1.
- Produz o JSON de `GET /api/history/listened`: `[{ musicId, name, duration, artists, lastListenedAt, isAvailable }]`.

- [ ] **Passo 1: Escrever os testes de integração que falham**

  Os testes ficam em `describe("POST /musics/:id/listens e GET /history/listened")` e reaproveitam `createAccount`, `createSubscriber`, `insertMusic` e `call` do arquivo. Crie o helper `listened(account)`.
  - `"exigem sessão e assinatura"`: sem cookie, as duas rotas dão 401. Com conta sem plano, dão 403.
  - `"não marca com 20 s e marca com 31 s"`: o POST com `{ playedSeconds: 20 }` dá 409, e `listened` fica `[]`. Com `{ playedSeconds: 31 }` dá 204, e `listened` devolve `[musicA]`.
  - `"lista cada música uma vez, a marca mais recente primeiro"`: as marcas A, B e A (31 s cada) voltam como `[musicA, musicB]`.
  - `"separa as marcas de cada membro do mesmo plano"`: monta o plano familiar como o teste `"separa o histórico de cada membro do mesmo plano"`. A gestora marca A, e o membro marca B. A gestora vê `[musicA]`, e o membro vê `[musicB]`.
  - `"mantém a música removida pelo admin, marcada como indisponível"`: marca e depois roda `UPDATE musics SET deleted_at = now()`. O item vem com `isAvailable: false`. Um POST nessa música removida dá 404.
  - `"recusa corpo e id inválidos com 400 e música inexistente com 404"`: os corpos `{}`, `{ playedSeconds: -1 }` e `{ playedSeconds: "abc" }` dão 400. O id `abc` dá 400, e o id `2147483647` dá 404.

- [ ] **Passo 2: Rodar e ver falhar**

  Siga as restrições globais para subir o banco de desenvolvimento e rode `cd api && bun test --env-file=../.env adapters/http/history-routes`. O esperado é falhar com 404 nas rotas novas.

- [ ] **Passo 3: Implementar as migrações, o adaptador, o schema, o controller, as rotas e a composição**

  - **`markListened`:** um comando só, `INSERT INTO user_event (user_id, event_type, music_id) SELECT $1, 'music_listened', id FROM musics WHERE id = $2 AND deleted_at IS NULL`. Devolve `rowCount === 1`.
  - **`listListenedForUser`:** a mesma consulta de `LIST_HISTORY`, filtrando `event_type = 'music_listened'` e devolvendo `last_listened_at`. Extraia o trecho comum só se ele não ficar menos legível. Duas consultas parecidas são aceitáveis.

- [ ] **Passo 4: Rodar e ver passar**

  Rode `cd api && bun run test && bun run test:integration && bun run lint && bun run typecheck`. O esperado é tudo passando.

- [ ] **Passo 5: Commit**

  ```text
  feat(historico): marca músicas ouvidas por mais de 30 segundos (HU-15)
  ```

  Inclua os arquivos das Tarefas 1 e 2, as duas migrações e a documentação listada. O corpo explica a regra e a escolha do evento em `user_event`. Termine com `Refs #91`.

### Tarefa 3: Contagem dos 30 s no player

**Arquivos:**
- Criar: `frontend/src/lib/listen-tracker.ts` e `frontend/src/lib/listen-tracker.test.ts`
- Modificar: `frontend/src/lib/api/history.ts`
- Modificar: `frontend/src/components/playback-audio.tsx`
- Documentação: `frontend/src/lib/api/README.md`, na linha de `history.ts`.

**Interfaces:**
- Produz, em `listen-tracker.ts`:
  ```ts
  export const LISTENED_THRESHOLD_SECONDS = 30
  /** Largest gap between two timeupdate events still counted as sound; bigger jumps are seeks. */
  export const MAX_PROGRESS_STEP_SECONDS = 1.5
  export interface ListenProgress { listenId: number; playedSeconds: number; lastPosition: number; isReported: boolean }
  /** Adds the sound since the last position; a new listenId starts from zero at `position`. */
  export function trackListen(progress: ListenProgress | null, listenId: number, position: number): ListenProgress
  /** True once, when the listen passes the threshold and was not reported yet. */
  export function shouldReportListened(progress: ListenProgress): boolean
  /** The catalog music id of a track id, or null for sample tracks (non-numeric ids). */
  export function musicIdToMark(trackId: string): number | null
  ```
- Produz, em `history.ts`:
  - a interface `ListenedEntry`, que é `HistoryEntry` com `lastListenedAt` no lugar de `lastPlayedAt`;
  - `historyApi.listListened(signal?)`, para `GET /history/listened`;
  - `historyApi.markListened(musicId: number, playedSeconds: number)`, para `POST /musics/:id/listens` com corpo JSON;
  - `historyKeys.listened()`, que é `[...historyKeys.all, "listened"]`;
  - `useListenedMusics()`, com o `useQuery` da lista;
  - `useListenedMusicIds(): Set<number>`, feito com `useMemo` sobre os dados (um `Set` vazio enquanto carrega).

- [ ] **Passo 1: Escrever os testes que falham** (`listen-tracker.test.ts`)

  - `"soma o som de uma reprodução e avisa só depois de 30 s"`: os `timeupdate` de 0 a 30 em passos de 0,25 não avisam. O passo seguinte, que chega a 30,25, avisa.
  - `"avisa uma vez só"`: depois de `{ ...progress, isReported: true }`, `shouldReportListened` dá `false` mesmo com 40 s.
  - `"não conta o salto da barra"`: as posições 0, 0,25, 45 e 45,25 somam 0,5.
  - `"pausar não zera"`: as posições 0 a 20 com o mesmo `listenId`, sem eventos durante a pausa, e depois de 20,25 a 31 avisam.
  - `"uma reprodução nova começa do zero"`: depois de 25 s no `listenId` 1, o `trackListen` com `listenId` 2 na posição 0 dá `playedSeconds: 0`.
  - `"faixa de exemplo não tem id do catálogo"`: `musicIdToMark("sample-1")` dá `null`, e `musicIdToMark("42")` dá `42`.

- [ ] **Passo 2: Rodar e ver falhar**

  Rode `cd frontend && bun test src/lib/listen-tracker`. O esperado é falhar, porque o módulo não existe.

- [ ] **Passo 3: Implementar `listen-tracker.ts`, os acréscimos em `history.ts` e a ligação no `PlaybackAudio`**

  No `PlaybackAudio`:
  - Guarde o `ListenProgress` num `useRef`.
  - No `onTimeUpdate`, além do `reportElementProgress`, atualize o progresso com `trackListen(…, listenId, element.currentTime)`.
  - Quando `shouldReportListened` der verdadeiro e `musicIdToMark(track.id)` não for `null`, marque `isReported` e chame `historyApi.markListened`.
  - Depois, `invalidateQueries({ queryKey: historyKeys.all })`, e engula a falha com `.catch(() => {})`, como no `recordListen`.

- [ ] **Passo 4: Rodar e ver passar**

  Rode `cd frontend && bun run test && bun run lint && bunx tsc --noEmit -p .`. O esperado é tudo passando.

- [ ] **Passo 5: Commit**

  ```text
  feat(player): avisa a API quando a música passa de 30 segundos (HU-15)
  ```

### Tarefa 4: Ícone de "ouvida" nas listas de faixas

**Arquivos:**
- Modificar os ícones:
  - `frontend/src/components/icons/animated.tsx`: `export const HeadphonesIcon = staticLucide(Headphones)`, importando `Headphones` do `lucide-react`.
  - `frontend/src/components/icons/static.tsx`: `HeadphonesIcon = svg(<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />)`.
- Criar: `frontend/src/components/listened-mark.tsx`, com `export function ListenedMark({ musicId }: { musicId: number })`.
  - Lê `useListenedMusicIds()`.
  - Quando o id não está no conjunto, devolve `null`.
  - Quando está, desenha um `HeadphonesIcon` de tamanho 12 em `text-muted-foreground`, dentro de um `<span role="img" aria-label="Já ouvida" title="Já ouvida">`, alinhado ao texto e com `shrink-0`.
- Modificar as telas, pondo `<ListenedMark musicId={…} />` logo depois do título de cada faixa:
  - `frontend/src/app/album/[id]/page.tsx`
  - `frontend/src/app/genero/[id]/page.tsx`
  - `frontend/src/app/artista/[id]/page.tsx`
  - `frontend/src/app/inicio/page.tsx`, nas duas listas
  - `frontend/src/app/busca/page.tsx`, só nos resultados de faixa da página
  - `frontend/src/app/playlist/[id]/page.tsx`, com `Number(track.id)`
  - `frontend/src/app/historico/page.tsx`, na lista "Todas"
- Ficam de fora as sugestões da barra de busca.

**Interfaces:** consome `useListenedMusicIds` da Tarefa 3.

- [ ] **Passo 1: Implementar o ícone, o `ListenedMark` e a marca nas sete telas**

  Não há teste unitário de componente no projeto. A verificação desta tarefa é a da tela, no Passo 3.

- [ ] **Passo 2: Rodar as verificações**

  Rode `cd frontend && bun run test && bun run lint && bunx tsc --noEmit -p .`. O esperado é tudo passando.

- [ ] **Passo 3: Conferir na tela**

  Com o ambiente de desenvolvimento no ar (`bun start full` e uma conta com plano), toque uma música por mais de 30 s e volte ao álbum, à busca e à playlist dela. O fone aparece nas três. Uma música tocada por 20 s continua sem o fone.

- [ ] **Passo 4: Commit**

  ```text
  feat(frontend): mostra as músicas já ouvidas nas listas de faixas (HU-15)
  ```

### Tarefa 5: Aba "Já ouvidas" no histórico

**Arquivos:**
- Modificar: `frontend/src/app/historico/page.tsx`
- Documentação: `docs/prompts/prompts.md`, com o registro do uso de IA nesta história, no formato que já está lá.

**Interfaces:** consome `useListenedMusics` da Tarefa 3.

- [ ] **Passo 1: Implementar as abas**

  - **Abas:** "Todas" e "Já ouvidas", com estado local e "Todas" como padrão. Use `role="tablist"`, `role="tab"`, `aria-selected` e `role="tabpanel"`, e as setas esquerda e direita trocam de aba.
  - **Lista:** a `HistoryList` passa a receber `entries`, `isPending`, `error` e a mensagem de lista vazia, para servir às duas abas.
  - **Data:** na aba "Já ouvidas", a data mostrada é `lastListenedAt`.
  - **Lista vazia:** "Você ainda não ouviu nenhuma música por mais de 30 segundos."
  - **Ícone:** o fone da Tarefa 4 fica só na aba "Todas".

- [ ] **Passo 2: Rodar as verificações e conferir na tela**

  Rode `cd frontend && bun run test && bun run lint && bunx tsc --noEmit -p .`. Depois, na tela, a aba "Já ouvidas" mostra só as marcadas, da mais recente para a mais antiga.

- [ ] **Passo 3: Commit**

  ```text
  feat(historico): adiciona a aba de músicas já ouvidas (HU-15)
  ```

### Tarefa 6: Fechar a história

- [ ] **Passo 1:** rode todas as verificações da API e do front de novo e depois `bun stop`.
- [ ] **Passo 2:** mostre ao Victor o título do PR, `feat(historico): músicas já ouvidas (HU-15)`, e o corpo, com os critérios entregues, os testes de cada um e `Closes #91`. Só depois do OK dele: push, PR e os checkboxes da #91.
