# Músicas Curtidas (HU-34) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** toda conta tem a playlist "Músicas Curtidas", alimentada pela curtida. Curtir põe a música no topo, e descurtir a tira.

**Arquitetura:**
- **Banco:** a coluna `playlists.liked_by_user_id` (UNIQUE) marca a playlist especial.
- **Domínio:** a entidade `Playlist` recusa o que não vale para ela. `EnsureLikedSongs`, `LikeMusic` e `UnlikeMusic` são a entrada que a HU-20 vai chamar.
- **API e front:** as rotas `/me/liked-musics/:musicId` atendem o coração do front até lá.

**Tecnologias:** Bun, Express, Joi, PostgreSQL com Flyway, Next.js com React Query, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-11-15-musicas-curtidas-design.md` · **Issue:** #136 · **Base:** `feat/HU-19-playlist-colaborativa`

## Restrições globais

- Os erros seguem o `error-handler`: `BusinessRuleError` dá 409, `NotFoundError` dá 404 e `ForbiddenError` dá 403.
- O nome é exatamente `"Músicas Curtidas"`, e a cor, `"#D33A2C"`. Ficam nas constantes `LIKED_SONGS_NAME` e `LIKED_SONGS_COLOR`, na entidade.
- Nada de dependência nova, `console.log` ou identificador de uma letra. Commits com `Refs #136`.
- A integração usa o banco do `.env`, na porta da produção. Antes de rodar, peça ao Victor `bun server down`.

## Pontos de atenção na revisão

1. **Curtir duas vezes a mesma música:** a segunda não faz nada, e a música não duplica nem muda de posição. O teste fica na Tarefa 2.
2. **Descurtir uma música que não está na playlist:** responde 204 sem erro. O teste fica na Tarefa 3.
3. **Duas chamadas criando a playlist ao mesmo tempo:** fica uma só, pelo `UNIQUE` e pelo `ON CONFLICT`. O teste fica na Tarefa 3.
4. **Música removida pelo admin:** some da lista, como em qualquer playlist (já coberto). Curtir uma música removida dá 404. O teste fica na Tarefa 3.
5. **A playlist de outra pessoa:** continua privada, com 404 para os outros. O teste fica na Tarefa 3.

---

### Tarefa 1: Regras da entidade

**Arquivos:** `api/domain/entities/playlist.ts` e `playlist.test.ts`.

**Interfaces:**
- O `ExistingPlaylistData` ganha `likedByUserId?: number | null`, opcional para não mexer nos dados de teste que já existem.
- A entidade ganha o getter `isLikedSongs`.
- A fábrica é `static createLikedSongs({ id, userId, now }: { id: number; userId: number; now?: Date }): Playlist`, que monta uma playlist privada, com o nome e a cor das constantes, o `userId` como admin e `likedByUserId: userId`.

- [ ] **Passo 1: Testes que falham**
  - `"cria a Músicas Curtidas privada, com o nome, a cor e o dono"`.
  - `"a Músicas Curtidas não é renomeada, não muda de cor nem de visibilidade, não é apagada e não recebe membros"`: cada um lança `BusinessRuleError`.
  - `"uma playlist comum não é a Músicas Curtidas"`.
- [ ] **Passo 2:** rode `cd api && bun test domain/entities/playlist`. O esperado é falhar.
- [ ] **Passo 3: Implementar.** O guarda `ensureNotLikedSongs()` é chamado em `rename`, `changeColor`, `setPrivate`, `delete` e `addMember`. A mensagem é `"Músicas Curtidas cannot be changed"`.
- [ ] **Passo 4:** rode `cd api && bun run test`. O esperado é tudo passando.

### Tarefa 2: Casos de uso

**Arquivos:**
- Portas: `playlist-repository.ts` (`findLikedSongs(userId): Promise<Playlist | null>` e `createLikedSongs(playlist): Promise<Playlist>`, que devolve a que ficou gravada) e `playlist-musics.ts` (`addToTop(playlistId, musicId, now?): Promise<AddMusicResult>`, em que `already_in_playlist` não muda nada).
- Fakes: `in-memory-playlist-repository.ts` e `in-memory-playlist-musics.ts`.
- Criar: `api/domain/use-cases/liked-songs.ts`, com `EnsureLikedSongs`, `LikeMusic` e `UnlikeMusic` e as interfaces `…UseCase`.
- Modificar: `list-my-playlists.ts`, que garante a playlist e a põe primeiro. `add-music-to-playlist.ts` e `reorder-playlist-musics.ts` recusam com `BusinessRuleError("Músicas Curtidas only changes through likes")`. `playlist-output.ts` ganha `isLikedSongs`.
- Testar: `liked-songs.test.ts` e os testes de `list-my-playlists` e `playlist-musics`.

**Interfaces:**
```ts
EnsureLikedSongs(playlists, ids: { nextId(): Promise<number> } = playlists).execute({ userId }): Promise<Playlist>
LikeMusic(ensure: EnsureLikedSongs, musics: PlaylistMusics).execute({ userId, musicId, now? }): Promise<void>  // 404 se a música não existe
UnlikeMusic(playlists: PlaylistRepository, musics: PlaylistMusics).execute({ userId, musicId }): Promise<void>   // sem erro se não estava
```

- [ ] **Passo 1: Testes que falham**
  - `"cria a Músicas Curtidas na primeira vez e devolve a mesma depois"`.
  - `"curtir põe no topo, da mais recente para a mais antiga"`.
  - `"curtir de novo não duplica nem muda a ordem"`.
  - `"curtir música fora do catálogo dá NotFoundError"`.
  - `"descurtir tira a música; descurtir o que não está não dá erro"`.
  - `"ListMyPlaylists cria a Músicas Curtidas e a põe primeiro"`.
  - `"não deixa pôr música pelo menu nem reordenar a Músicas Curtidas"`: dá `BusinessRuleError`.
- [ ] **Passo 2:** rode os testes. O esperado é falhar.
- [ ] **Passo 3:** implemente.
- [ ] **Passo 4:** rode `cd api && bun run test`. O esperado é tudo passando. O typecheck fica pendente até a Tarefa 3, então o commit vem junto com ela.

### Tarefa 3: Banco, rotas e documentação da API

**Arquivos:**
- Criar: `db/migrations/V261115_200000__Adiciona_playlist_de_musicas_curtidas.sql`, com `ALTER TABLE playlists ADD COLUMN liked_by_user_id integer CONSTRAINT playlists_liked_by_user_id_key UNIQUE REFERENCES "user"(id) ON DELETE CASCADE`.
- Modificar: `postgres-playlist-repository.ts`:
  - ler e gravar a coluna;
  - `findLikedSongs`;
  - `createLikedSongs`, com `INSERT … ON CONFLICT (liked_by_user_id) DO NOTHING` e, em seguida, `findLikedSongs`. Os membros só entram se a linha for nova.
- Modificar: `postgres-playlist-musics.ts` (`addToTop`, sob o `lockPlaylist`: confere a música, sai se ela já estiver lá, faz `UPDATE … position = position + 1` e insere na posição 0).
- Criar: `api/adapters/http/liked-musics-controller.ts`, com `like` e `unlike`, as duas respondendo 204.
- Modificar: `routes.ts` (`PUT` e `DELETE /me/liked-musics/:id`, com `subscriberOnly` e `musicIdParamsSchema`) e `composition-root.ts`.
- Testar: criar `api/adapters/http/liked-musics-routes.test.ts`. Ajustar a expectativa do `toData()` em `postgres-playlist-repository.test.ts` (`likedByUserId: null`).
- Documentação:
  - `openapi.ts` (as rotas e `isLikedSongs` na Playlist), Bruno (`api/bruno/playlists/curtidas/`) e `docs/api.md`;
  - `docs/models.md`, `docs/banco-de-dados.md` (a migração) e `docs/modelo-er.md` (a coluna);
  - `api/prisma/schema.prisma`, gerado com `bun run db:sync`.

- [ ] **Passo 1: Testes de integração que falham**
  - `"exigem sessão"`.
  - `"conta nova vê Músicas Curtidas primeiro e vazia"`.
  - `"curtir põe no topo e descurtir tira"`.
  - `"curtir duas vezes não duplica"`.
  - `"descurtir o que não está responde 204"`.
  - `"curtir música removida ou inexistente dá 404"`.
  - `"renomear, excluir, reordenar, pôr pelo menu e adicionar colaborador dão 409"`.
  - `"tirar pela rota da playlist funciona"`.
  - `"outra conta não vê a Músicas Curtidas de ninguém (404)"`.
  - `"duas chamadas simultâneas criam uma playlist só"`: duas `GET /playlists` em `Promise.all`.
- [ ] **Passo 2:** rode o arquivo novo. O esperado é falhar.
- [ ] **Passo 3:** implemente e rode `bun run db:sync`.
- [ ] **Passo 4:** rode `bun run test && bun run test:integration && bun run lint && bun run typecheck`. O esperado é tudo passando.
- [ ] **Passo 5: Commit** das Tarefas 1 a 3.

  ```text
  feat(playlist): playlist Músicas Curtidas alimentada pela curtida (HU-34)
  ```

### Tarefa 4: Front

**Arquivos:**
- `lib/api/playlists.ts`: o tipo ganha `isLikedSongs`, e entram `likedMusicsApi.like(musicId)` e `likedMusicsApi.unlike(musicId)`.
- `lib/playlist-store.ts`: o `PlaylistData` ganha `isLikedSongs`. Ajuste o `playlist-store.test.ts`.
- `components/track-like-button.tsx`: depois de mudar o `localStorage`, se o id for do catálogo, chama `like` ou `unlike` e invalida as playlists, engolindo a falha como no player.
- `app/playlist/[id]/page.tsx`: quando `isLikedSongs`:
  - sem "Editar playlist" nem "Colaboradores";
  - o `SortableList` fica desabilitado;
  - tirar a música também descurte no `localStorage`;
  - o encarte mostra um coração.
- `app/playlist/page.tsx`: o cartão da Músicas Curtidas vem primeiro (a API já ordena), com coração e sem lixeira (`canManage` continua verdadeiro, então a lixeira passa a depender também de `!isLikedSongs`).
- `components/add-to-playlist-menu.tsx`: filtra `!playlist.isLikedSongs`.
- `frontend/src/lib/api/README.md`.

- [ ] **Passo 1:** atualize o `playlist-store.test.ts` com o `isLikedSongs` e rode. O esperado é falhar.
- [ ] **Passo 2:** implemente.
- [ ] **Passo 3:** rode `cd frontend && bun run test && bun run lint && bunx tsc --noEmit -p .`. O esperado é tudo passando.
- [ ] **Passo 4: Commit**

  ```text
  feat(frontend): mostra a playlist Músicas Curtidas e liga o coração (HU-34)
  ```

### Tarefa 5: Fechar

Registre em `prompts.md` e faça a revisão independente da branch. Mostre o PR ao Victor antes de abrir. A base do PR é a `feat/HU-19-playlist-colaborativa`, que passa a ser a `main` depois que o #135 entrar.
