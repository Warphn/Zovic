# Cadastro de música com áudio — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O admin cadastra, pelo painel, uma música com o arquivo MP3, álbum opcional e a marca de explícito, e gerencia os álbuns, que passam a ter ano.

**Architecture:** Uma migration acrescenta `musics.audio_file`, `musics.is_explicit` e `album.year`. A ligação `album_music` passa a ser da `Music` (zero ou um álbum), e o `Album` perde o `musicIds`. O upload chega em `multipart/form-data` pelo `multer`, em memória. O domínio valida o MP3 e grava o arquivo por uma porta `AudioStorage`, que tem uma implementação em disco (`AUDIO_DIR`).

**Tech Stack:** Bun 1.4.2, Express 5, Joi, PostgreSQL 16 + Flyway, Prisma (só no seed), `multer` 2, Next.js 16 + TanStack Query, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-11-05-cadastro-de-musica-com-audio-design.md`

## Antes de começar

1. **Neste PC, o servidor de produção usa as mesmas portas do desenvolvimento.** Antes de subir o banco de desenvolvimento, rode `cd ~/zovic && bun server down` no Ubuntu e, no fim, `bun server up`.
2. **O `.env` do clone do Windows precisa ter `COMPOSE_PROJECT_NAME=zovic-dev`.** O PR `fix/infra-projeto-dev-separado` ainda não está nesta branch. Crie o `.env` a partir do `.env.example` e acrescente essa linha à mão **antes** do primeiro `bun start`. Sem ela, o Compose usa o projeto `zovic`, o mesmo da produção.
3. `bun install` na raiz, em `api/` e em `frontend/`. Depois, `bun run db:generate` em `api/`.
4. `bun start backend --seed=local` sobe o banco de desenvolvimento com os dados de teste. Os testes de integração precisam dele.

## Global Constraints

- A única dependência nova é `multer` (e `@types/multer` como dependência de desenvolvimento), só em `api/`. O time precisa aprová-la antes do merge.
- Só MP3, com até `MAX_AUDIO_BYTES = 20 * 1024 * 1024` bytes. O tipo é conferido pelos bytes do começo do arquivo, e não pela extensão nem pelo `Content-Type`.
- O ano do álbum vai de `Album.MIN_YEAR = 1900` até o ano atual.
- A música tem zero ou um álbum. A ligação `album_music` é gravada só pelo repositório de músicas.
- O arquivo é guardado como `<crypto.randomUUID()>.mp3` em `AUDIO_DIR`, e o nome original é descartado. A resposta da API traz `hasAudio`, e nunca o nome do arquivo.
- `AUDIO_DIR` tem o padrão `api/storage/audio` (resolvido a partir de `api/infra/config.ts`) e vale `/data/audio` no Docker, com o volume nomeado `audio`.
- As mensagens de erro do domínio ficam em inglês, como no resto da API, e o front as traduz no `MESSAGES` de `frontend/src/lib/api/client.ts`.
- Os identificadores ficam em inglês. Os comentários, as mensagens para o usuário e a documentação ficam em português.
- Todo commit segue o Conventional Commits e termina com `Refs #99` e com o `Co-Authored-By` da sessão.
- Antes de cada commit da API: `bun run test`, `bun run lint` e `bun run typecheck` em `api/`, e `bun run test:integration` quando a tarefa mexe no banco ou nas rotas. Antes de cada commit do front: `bun run lint` e `bun run test` em `frontend/`.

## Review Focus

1. **Editar uma música antiga, sem áudio** (as do seed): o `PATCH` tem de funcionar sem exigir arquivo. É testado na Tarefa 5.
2. **Multipart sem a parte `data`**, só com o áudio: a resposta tem de ser 400 `VALIDATION_ERROR`, e não 500. É testado na Tarefa 6.
3. **O arquivo numa parte com outro nome** (`arquivo` em vez de `audio`) ou dois arquivos: a resposta tem de ser 400 `INVALID_UPLOAD`, e não 500. É testado na Tarefa 6.
4. **Escolher um álbum removido** para a música nova: a resposta tem de ser 404 `Album not found`, e nada é gravado. É testado na Tarefa 5.
5. **O limite exato:** um arquivo de exatamente 20 MB passa, e um de 20 MB + 1 byte é recusado. É testado na Tarefa 1 (domínio) e na Tarefa 6 (413).

---

### Task 1: Regra do áudio no domínio

**Files:**
- Create: `api/domain/shared/audio.ts`
- Test: `api/domain/shared/audio.test.ts`

**Interfaces:**
- Produces: `MAX_AUDIO_BYTES: number`, `isMp3(bytes: Uint8Array): boolean` e `validateAudio(bytes: Uint8Array | null): asserts bytes is Uint8Array`. Esta última lança `ValidationError` com uma destas mensagens: `"Music must have an audio file"` (nulo ou vazio), `"Audio file must be at most 20 MB"` ou `"Audio file must be an MP3"`.

- [ ] **Step 1: Write the failing test**

Em `audio.test.ts`, monte os arquivos de teste com `Uint8Array`:
- `isMp3` aceita `[0x49, 0x44, 0x33, 0x04, ...]` (tag `ID3`) e `[0xff, 0xfb, 0x90, ...]` (sincronismo de quadro);
- `isMp3` recusa o cabeçalho de um PNG (`[0x89, 0x50, 0x4e, 0x47]`), `new Uint8Array(0)` e `[0xff, 0x1f]` (o segundo byte não tem os 3 bits altos ligados);
- `validateAudio(null)` e `validateAudio(new Uint8Array(0))` lançam `"Music must have an audio file"`;
- um MP3 de exatamente `MAX_AUDIO_BYTES` bytes passa, e um de `MAX_AUDIO_BYTES + 1` lança `"Audio file must be at most 20 MB"` (Review Focus 5);
- um PNG lança `"Audio file must be an MP3"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && bun test domain/shared/audio.test.ts`
Expected: FAIL, porque o módulo `./audio.ts` não existe.

- [ ] **Step 3: Implement `api/domain/shared/audio.ts`**

`isMp3`: `true` se os 3 primeiros bytes forem `0x49 0x44 0x33`, ou se `bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0`. A ordem do `validateAudio` é: vazio, tamanho, formato.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && bun test domain/shared/audio.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/domain/shared/audio.ts api/domain/shared/audio.test.ts
git commit -m "feat(admin): adiciona a regra de áudio mp3 de até 20 mb" -m "Refs #99"
```

### Task 2: Migration, Prisma e seed

**Files:**
- Create: `db/migrations/V<AAMMDD>_<HHMMSS>__Adiciona_audio_explicito_e_ano_do_album.sql` (com a data e a hora em que for criada)
- Modify: `api/prisma/schema.prisma` (gerado pelo `db:sync`), `api/prisma/seed/catalog-data.ts` e `api/prisma/seed/catalog.ts`
- Docs: `docs/banco-de-dados.md`, `docs/modelo-er.md`

**Interfaces:**
- Produces: as colunas `musics.audio_file varchar(255) NULL`, `musics.is_explicit boolean NOT NULL DEFAULT false` e `album.year smallint NULL` (`CHECK (year >= 1900)`, constraint `album_year_check`). Cada álbum de `ALBUMS`, em `catalog-data.ts`, ganha `year: number`.

- [ ] **Step 1: Write the migration**

O SQL está na seção "Banco" da spec. O comentário de cabeçalho explica por que `year` é opcional e por que o limite superior fica no domínio, no mesmo estilo das outras migrations.

- [ ] **Step 2: Apply and sync**

Run: `docker compose up flyway`, depois `cd api && bun run db:sync`
Expected: o Flyway termina com "Successfully applied 1 migration", e o `schema.prisma` ganha `audioFile String? @map("audio_file") @db.VarChar(255)`, `isExplicit Boolean @default(false) @map("is_explicit")` e `year Int? @db.SmallInt`.

- [ ] **Step 3: Give each seed album a year**

Em `catalog-data.ts`, cada álbum fictício ganha um `year` entre 1960 e 2025. Em `catalog.ts`, o `tx.album.create` passa o `year`.

- [ ] **Step 4: Verify the seed is stable**

Run: `cd api && bun run db:seed && bun run db:seed && bun run db:sync --check`
Expected: os dois seeds terminam iguais e o `--check` não mostra diferença.

- [ ] **Step 5: Update the database docs**

- `docs/banco-de-dados.md`: o seed passa a dar um ano a cada álbum.
- `docs/modelo-er.md`: o diagrama Mermaid e as tabelas ganham `audio_file`, `is_explicit` e `year`, e a frase do topo cita a migration nova. Anote na descrição do PR que `docs/assets/modelo-er.png` precisa ser exportada de novo à mão.

- [ ] **Step 6: Commit**

```bash
git add db/migrations api/prisma docs/banco-de-dados.md docs/modelo-er.md
git commit -m "feat(db): adiciona áudio e explícito na música e ano no álbum" -m "Refs #99"
```

### Task 3: `Album` com ano e sem `musicIds`

**Files:**
- Modify: `api/domain/entities/album.ts`, `api/adapters/db/postgres-album-repository.ts`
- Test: `api/domain/entities/album.test.ts`, `api/adapters/db/postgres-catalog-repositories.test.ts` (o trecho de álbum, perto da linha 189)
- Docs: `docs/models.md` (seção Album)

**Interfaces:**
- Consumes: a coluna `album.year` (Tarefa 2).
- Produces:
  - `Album.MIN_YEAR = 1900`;
  - `ExistingAlbumData.year: number | null` e `NewAlbumData.year: number`;
  - getter `year: number | null` e método `changeYear(year: number, now?: Date): void`;
  - `ValidationError` com a mensagem `` `Album year must be between 1900 and ${currentYear}` ``.

  Saem `musicIds`, `addMusic` e `removeMusic`.

- [ ] **Step 1: Write the failing tests**

`album.test.ts`:
- o `create` com `year: 1900` e com o ano de `now` passa;
- `1899` e o ano de `now` mais 1 lançam `ValidationError`;
- `changeYear` troca o ano, valida igual e recusa um álbum removido (`BusinessRuleError`);
- o `restore` aceita `year: null`.

Tire os testes de `addMusic` e `removeMusic`. No teste de integração do repositório: um álbum salvo com `year: 1998` volta com `year: 1998`. Tire o `album.addMusic` e o `musicIds` do teste.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && bun test domain/entities/album.test.ts`
Expected: FAIL nos casos de ano.

- [ ] **Step 3: Implement the year and remove `musicIds`**

Use uma função `validateYear(year, now)` privada e estática, com `now.getFullYear()`. No repositório: tire o `MUSICS` e o `replaceLinks` dele, e acrescente `year` no `INSERT … ON CONFLICT DO UPDATE` e no `SELECT`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd api && bun run test && bun run test:integration && bun run typecheck`
Expected: PASS, sem nenhuma referência a `musicIds` de álbum.

- [ ] **Step 5: Update `docs/models.md`**

Na tabela do Album: o campo `year`, a função `changeYear`, e as tabelas sem `album_music`.

- [ ] **Step 6: Commit**

```bash
git add api/domain/entities/album.ts api/domain/entities/album.test.ts api/adapters/db/postgres-album-repository.ts api/adapters/db/postgres-catalog-repositories.test.ts docs/models.md
git commit -m "refactor(catalogo): adiciona o ano ao álbum e passa o album_music para a música" -m "Refs #99"
```

### Task 4: `Music` com áudio, explícito e álbum

**Files:**
- Modify: `api/domain/entities/music.ts`, `api/adapters/db/postgres-music-repository.ts`
- Test: `api/domain/entities/music.test.ts`, `api/adapters/db/postgres-catalog-repositories.test.ts`
- Docs: `docs/models.md` (seção Music)

**Interfaces:**
- Consumes: as colunas `musics.audio_file` e `musics.is_explicit` (Tarefa 2).
- Produces:
  - `ExistingMusicData` ganha `audioFile: string | null`, `isExplicit: boolean` e `albumId: number | null`;
  - `NewMusicData` ganha `audioFile: string` (obrigatório), `albumId?: number | null` e `isExplicit?: boolean`;
  - getters `audioFile`, `isExplicit` e `albumId`;
  - métodos `changeAlbum(albumId: number | null): void` e `setExplicit(isExplicit: boolean): void`;
  - mensagens: `"Music must have an audio file"` (`audioFile` vazio no `create`) e `"Album id must be a positive integer"`;
  - no repositório, o `LinkTable` `ALBUM = { table: "album_music", owner: "music_id", other: "album_id" }`, e a FK `album_music_album_id_fkey` vira `NotFoundError("Album not found")`.

- [ ] **Step 1: Write the failing tests**

`music.test.ts`:
- o `create` sem `audioFile` (string vazia) lança `"Music must have an audio file"`;
- `isExplicit` tem padrão `false` e `albumId` tem padrão `null`;
- `changeAlbum(7)`, `changeAlbum(null)` e `setExplicit(true)` mudam o estado, e os três recusam uma música removida;
- `changeAlbum(0)` lança `ValidationError`;
- o `restore` com `audioFile: null` funciona.

No teste de integração: uma música salva com `audioFile: "abc.mp3"`, `isExplicit: true` e o `albumId` de um álbum volta com os três valores. Salva de novo com `changeAlbum(null)`, ela volta sem álbum. Com um `albumId` inexistente, o `save` lança `NotFoundError`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && bun test domain/entities/music.test.ts`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Implement the fields and the repository**

- Entidade: siga o padrão do `validateLyricsId` para o `albumId`.
- Repositório:
  - `INSERT` e `ON CONFLICT` com `audio_file` e `is_explicit`;
  - `replaceLinks(client, ALBUM, data.id, data.albumId === null ? [] : [data.albumId])`;
  - no `SELECT`, `(SELECT album_id FROM album_music WHERE music_id = m.id ORDER BY album_id LIMIT 1) AS album_id`.

  Corrija também quem chama `Music.create` sem `audioFile`: os testes existentes e o `manage-catalog.ts`. Neste último, a correção é provisória e é refeita na Tarefa 5.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd api && bun run test && bun run test:integration && bun run typecheck`
Expected: PASS

- [ ] **Step 5: Update `docs/models.md`**

Na tabela da Music: os três campos, os dois métodos e a tabela `album_music`.

- [ ] **Step 6: Commit**

```bash
git add api/domain/entities/music.ts api/domain/entities/music.test.ts api/adapters/db/postgres-music-repository.ts api/adapters/db/postgres-catalog-repositories.test.ts docs/models.md
git commit -m "feat(catalogo): adiciona áudio, explícito e álbum à música" -m "Refs #99"
```

### Task 5: Armazenamento e caso de uso `ManageCatalog`

**Files:**
- Create: `api/domain/ports/audio-storage.ts`, `api/adapters/storage/local-audio-storage.ts`
- Modify: `api/domain/use-cases/manage-catalog.ts`, `api/infra/config.ts`, `docker-compose.yml`, `.gitignore`, `.env.example`
- Test: `api/domain/use-cases/manage-catalog.test.ts`, `api/adapters/storage/local-audio-storage.test.ts`
- Docs: `README.md`, `docs/docker.md`, `docs/servidor.md`, `docs/models.md` (a porta)

**Interfaces:**
- Consumes: `validateAudio` (Tarefa 1), `Album` (Tarefa 3) e `Music` (Tarefa 4).
- Produces:
  - **Porta:** `interface AudioStorage { save(bytes: Uint8Array): Promise<string>; remove(fileName: string): Promise<void> }`.
  - **Adaptador:** `class LocalAudioStorage implements AudioStorage`, com `constructor(directory: string)`.
  - **Configuração:** `Config.audioDir: string`.
  - **Construtor:** `new ManageCatalog(musics, artists, genres, albums: AlbumRepository, audioStorage: AudioStorage)`.
  - **Música:** `createMusic(input: CreateMusicInput, audio: Uint8Array | null): Promise<MusicOutput>`.
    - `CreateMusicInput` ganha `albumId?: number | null` e `isExplicit?: boolean`.
    - `UpdateMusicInput` ganha os mesmos dois campos.
    - `MusicOutput` ganha `albumId: number | null`, `isExplicit: boolean` e `hasAudio: boolean`.
  - **Álbum:** `createAlbum(input: CreateAlbumInput): Promise<AlbumOutput>`, `updateAlbum(id: number, input: UpdateAlbumInput): Promise<AlbumOutput>` e `deleteAlbum(id: number): Promise<void>`.
    - `CreateAlbumInput = { name: string; artistIds: number[]; year: number }`.
    - `UpdateAlbumInput` é o mesmo com todos os campos opcionais.
    - `AlbumOutput = { id, name, year, artistIds, createdAt, deletedAt }`.
  - **Erro:** `NotFoundError("Album not found")`.

- [ ] **Step 1: Write the failing tests**

`manage-catalog.test.ts` ganha um `InMemoryAlbums` e um `FakeAudioStorage`. O fake guarda os nomes salvos e removidos, e pode falhar quando o teste pedir.
- O cadastro com `null` lança `"Music must have an audio file"`. Nada vai para o storage nem para `musics.items`.
- O cadastro com um PNG lança `"Audio file must be an MP3"`, e o storage não é chamado.
- O cadastro válido grava um arquivo. A música sai com `hasAudio: true`, `isExplicit` e `albumId`.
- **Álbum removido (Review Focus 4):** o cadastro com um álbum que sofreu `delete()` lança `"Album not found"`, e o storage não é chamado.
- Se o `musics.save` falhar (um `InMemoryMusics` que lança), o arquivo gravado aparece em `removed`, e o erro original é relançado.
- **Música antiga (Review Focus 1):** o `updateMusic` de uma música restaurada com `audioFile: null`, com `{ name: "Novo" }`, funciona e mantém `hasAudio: false`.
- O `updateMusic` com `albumId: null` tira o álbum, e com `isExplicit: true` marca.
- `createAlbum`, `updateAlbum` (nome, ano e troca de artistas) e `deleteAlbum` funcionam. Um artista inexistente dá `NotFoundError`.

`local-audio-storage.test.ts`, num diretório de `mkdtemp`:
- o `save` devolve um nome que casa com `/^[0-9a-f-]{36}\.mp3$/`, e o arquivo tem os mesmos bytes;
- o `remove` apaga o arquivo;
- remover um nome que não existe não lança erro;
- o `save` cria o diretório se ele não existir.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && bun test domain/use-cases/manage-catalog.test.ts adapters/storage`
Expected: FAIL

- [ ] **Step 3: Implement the port, the adapter and the use case**

- **Adaptador:** `mkdir(directory, { recursive: true })` no `save`, `Bun.write` e `rm(path, { force: true })` no `remove`.
- **`createMusic`**, em ordem:
  1. `ensureArtistsExist`, `ensureGenresExist` e `ensureAlbumExists`;
  2. `validateAudio(audio)`;
  3. `audioStorage.save`;
  4. num `try`, `Music.create` e `musics.save`;
  5. no `catch`, `audioStorage.remove(fileName)` e `throw error`.
- **`updateAlbum`:** a troca de artistas segue o padrão de "acrescenta antes de tirar" do `updateMusic`.

- [ ] **Step 4: Wire the configuration**

- `config.ts`: `audioDir: env.AUDIO_DIR || DEFAULT_AUDIO_DIR`, com `const DEFAULT_AUDIO_DIR = join(import.meta.dir, "..", "storage", "audio")`.
- `docker-compose.yml`, serviço `api`: `AUDIO_DIR: /data/audio` em `environment`, `volumes: [audio:/data/audio]`, e `audio:` no bloco `volumes:` do fim do arquivo.
- `.gitignore`: `api/storage/`.
- `.env.example`: `# AUDIO_DIR=` comentado, explicando o padrão.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd api && bun run test && bun run typecheck && bun run lint`
Expected: PASS. O `composition-root.ts` ainda não compila com o construtor novo, então passe um `LocalAudioStorage(config.audioDir)` e um `PostgresAlbumRepository(db)` provisórios para o typecheck passar. A Tarefa 6 refaz essa ligação.

- [ ] **Step 6: Update the docs**

- `README.md`: o `AUDIO_DIR` e onde os áudios ficam no `bun dev`.
- `docs/docker.md`: o volume `audio`.
- `docs/servidor.md`:
  - o volume `audio` na tabela de containers;
  - `AUDIO_DIR` na tabela do `.env` ("não defina: o compose já passa `/data/audio`");
  - em Pendências: "backup dos áudios", junto com o do banco.
- `docs/models.md`: a porta `AudioStorage`.

- [ ] **Step 7: Commit**

```bash
git add api/domain/ports/audio-storage.ts api/adapters/storage api/domain/use-cases/manage-catalog.ts api/domain/use-cases/manage-catalog.test.ts api/infra/config.ts api/infra/composition-root.ts docker-compose.yml .gitignore .env.example README.md docs/docker.md docs/servidor.md docs/models.md
git commit -m "feat(admin): grava o áudio e gerencia os álbuns no catálogo" -m "Refs #99"
```

### Task 6: Rotas HTTP com multipart

**Files:**
- Create: `api/adapters/http/middlewares/audio-upload.ts`, `api/bruno/admin/` (as requisições) e `api/bruno/fixtures/teste.mp3`
- Modify:
  - `api/package.json` e `api/bun.lock` (`multer`);
  - `api/adapters/http/middlewares/validate-request.ts`, `middlewares/error-handler.ts`, `schemas/admin-schemas.ts`, `routes.ts` e `admin-controller.ts`;
  - `api/domain/ports/admin-queries.ts`, `api/adapters/db/postgres-admin-queries.ts` e `api/infra/composition-root.ts`;
  - `api/adapters/http/openapi.ts` e `.gitignore`.
- Test: `api/adapters/http/admin-flow.test.ts`
- Docs: `docs/api.md`

**Interfaces:**
- Consumes: `ManageCatalog` (Tarefa 5), `MAX_AUDIO_BYTES` (Tarefa 1) e `LocalAudioStorage` (Tarefa 5).
- Produces:
  - `receiveAudio: RequestHandler`, que é `multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AUDIO_BYTES, files: 1 } }).single("audio")`;
  - `validateMultipartData(schema: Schema): RequestHandler`. Ele lê `req.body.data`: se for texto, faz o `JSON.parse`, e um JSON inválido dá 400 `{ error: "INVALID_JSON", message: "The data part is not valid JSON" }`. Sem a parte, valida `{}`. Depois, aplica o schema como o `validateBody`;
  - no `errorHandler`, o `MulterError`:
    - `LIMIT_FILE_SIZE` dá 413 `{ error: "AUDIO_TOO_LARGE", message: "Audio file must be at most 20 MB" }`;
    - qualquer outro dá 400 `{ error: "INVALID_UPLOAD", message: error.message }`;
  - `createAlbumSchema` e `updateAlbumSchema` (este com `.min(1)`). `year` usa `Joi.number().integer().min(Album.MIN_YEAR)`. `createMusicSchema` e `updateMusicSchema` ganham `albumId: Joi.number().integer().positive().allow(null)` e `isExplicit: Joi.boolean()`, este com `.default(false)` só no cadastro;
  - `CatalogQueries.listAlbums(): Promise<AlbumListItem[]>`, com `AlbumListItem = { id: number; name: string; year: number | null; artists: { id: number; name: string }[] }`. `MusicListItem` ganha `album: { id: number; name: string; year: number | null } | null` (só um álbum ativo), `isExplicit: boolean` e `hasAudio: boolean`;
  - as rotas:
    - `POST /api/admin/musics` com `receiveAudio` e `validateMultipartData(createMusicSchema)`;
    - `POST /api/admin/albums`, `PATCH /api/admin/albums/:id` e `DELETE /api/admin/albums/:id`;
    - `GET /api/albums`, com `subscriberOnly`;
  - `composeApp(auth, trustProxy, corsOrigins = [], db = pool, audioStorage: AudioStorage = new LocalAudioStorage(config.audioDir))`.

- [ ] **Step 1: Add the dependency**

Pré-condição: o time aprovou o `multer`. Rode `cd api && bun add multer && bun add -d @types/multer`.

- [ ] **Step 2: Write the failing integration tests**

Em `admin-flow.test.ts`:
- O `composeApp` passa a receber `new LocalAudioStorage(audioDir)`, com `audioDir` de `mkdtemp`, apagado no `afterAll` junto com os álbuns criados.
- Um helper `postMusic(cookie, data: unknown | undefined, audio?: { field: string; bytes: Uint8Array })` monta o `FormData`, e os MP3 de teste começam com `ID3`.

Os casos:
- o admin cadastra com nome, duração, artista, gênero, álbum e `isExplicit: true` e recebe 201 com `hasAudio: true`. O diretório tem um `.mp3`, e o `GET /api/musics?q=` mostra o `album`, o `isExplicit` e o `hasAudio`;
- sem a parte `audio`, a resposta é 400, e o diretório continua vazio;
- **(Review Focus 2)** só com o áudio, sem a parte `data`, a resposta é 400 `VALIDATION_ERROR`;
- com `data` igual a `"{nope"`, a resposta é 400 `INVALID_JSON`;
- **(Review Focus 3)** com o arquivo na parte `arquivo`, a resposta é 400 `INVALID_UPLOAD`;
- **(Review Focus 5)** com `MAX_AUDIO_BYTES + 1` bytes, a resposta é 413 `AUDIO_TOO_LARGE`;
- com um PNG, a resposta é 400 e `"Audio file must be an MP3"`;
- o assinante recebe 403;
- o CRUD de álbuns: POST dá 201, PATCH do ano dá 200, DELETE dá 204, e o `GET /api/albums` deixa de listar o álbum removido;
- o `PATCH /api/admin/musics/:id` com `{ albumId: null, isExplicit: false }` dá 200.

O teste antigo que fazia POST em JSON passa a usar o `postMusic`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd api && bun test --env-file=../.env adapters/http/admin-flow.test.ts`
Expected: FAIL. A rota ainda espera JSON, e as rotas de álbum dão 404.

- [ ] **Step 4: Implement the middlewares, routes, controllers, queries and wiring**

- **Controller:** `createMusic` chama `catalog.createMusic(req.body, req.file?.buffer ?? null)`. Entram também `listAlbums`, `createAlbum`, `updateAlbum` e `removeAlbum`.
- **`listMusics`:** acrescente as colunas `is_explicit`, `audio_file IS NOT NULL AS has_audio` e o álbum ativo, com `json_build_object` e `LIMIT 1`, por `album_music`.
- **`composeApp`:** substitui a ligação provisória da Tarefa 5.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd api && bun run test && bun run test:integration && bun run typecheck && bun run lint`
Expected: PASS

- [ ] **Step 6: Document the routes**

- **`openapi.ts`:**
  - `POST /api/admin/musics`, com o `requestBody` em `multipart/form-data` (`data` como texto JSON e `audio` como `binary`) e as respostas 201, 400, 403, 404 e 413;
  - `PATCH /api/admin/musics/{id}`;
  - as três rotas de `/api/admin/albums`;
  - `GET /api/albums`;
  - os campos novos em `MusicListItem`.
- **Bruno:**
  - a pasta `api/bruno/admin/`, com `folder.bru` e um login de admin;
  - `cadastrar-musica.bru`, com `body:multipart-form` e `audio: @file(../fixtures/teste.mp3)`;
  - `cadastrar-musica-sem-audio.bru` e `criar-album.bru`, `editar-album.bru` e `remover-album.bru`;
  - o arquivo `api/bruno/fixtures/teste.mp3`, com alguns bytes começando por `ID3`;
  - no `.gitignore`, a exceção `!api/bruno/fixtures/*.mp3`.
- **`docs/api.md`:** a seção Catálogo ganha `GET /api/albums` e os campos novos. A seção Admin ganha o multipart, os erros 413 e 400 e as rotas de álbum.

- [ ] **Step 7: Commit**

```bash
git add api/package.json api/bun.lock api/adapters api/domain/ports/admin-queries.ts api/infra/composition-root.ts api/bruno .gitignore docs/api.md
git commit -m "feat(admin)!: recebe o áudio no cadastro de música e adiciona as rotas de álbum" -m "BREAKING CHANGE: POST /api/admin/musics passa a receber multipart/form-data, com o JSON na parte data e o MP3 na parte audio. Quem mandava JSON precisa montar um FormData." -m "Refs #99"
```

### Task 7: Cliente da API no front

**Files:**
- Modify: `frontend/src/lib/api/client.ts`, `frontend/src/lib/api/admin.ts`, `frontend/src/lib/api/catalog.ts`
- Test: `frontend/src/lib/api/client.test.ts`, `frontend/src/lib/api/admin.test.ts` (novo)
- Docs: `frontend/src/lib/api/README.md`

**Interfaces:**
- Consumes: as rotas e os campos da Tarefa 6.
- Produces:
  - `request` só põe `Content-Type: application/json` quando `typeof init.body === "string"`;
  - `MusicInput` ganha `albumId: number | null` e `isExplicit: boolean`, e entra `NewMusicInput = MusicInput & { audio: File }`;
  - `musicFormData(input: NewMusicInput): FormData`, exportada;
  - `adminApi.createMusic(input: NewMusicInput)`, `createAlbum(input: AlbumInput)`, `updateAlbum(id, input: Partial<AlbumInput>)` e `removeAlbum(id)`, com `AlbumInput = { name: string; artistIds: number[]; year: number }`;
  - os hooks `useSaveMusic` (que aceita `NewMusicInput` quando `id === null`), `useCreateAlbum`, `useUpdateAlbum` e `useRemoveAlbum`;
  - `Album = { id; name; year: number | null; artists: NamedItem[] }`, `catalogApi.albums(signal?)`, `catalogKeys.albums()` e `useAlbums()`;
  - `CatalogMusic` ganha `album`, `isExplicit` e `hasAudio`;
  - `MAX_AUDIO_BYTES = 20 * 1024 * 1024` em `admin.ts`, só para avisar antes do envio;
  - no `MESSAGES`, as traduções:

    | Mensagem da API | Texto na tela |
    | --- | --- |
    | `"Music must have an audio file"` | "Escolha o arquivo de áudio da música." |
    | `"Audio file must be an MP3"` | "O áudio precisa ser um MP3." |
    | `"Audio file must be at most 20 MB"` | "O áudio pode ter no máximo 20 MB." |
    | `"Album not found"` | "Esse álbum não está mais no catálogo." |

- [ ] **Step 1: Write the failing tests**

- `client.test.ts`: com o `globalThis.fetch` trocado por um `mock` do `bun:test`, um `request("/x", { method: "POST", body: new FormData() })` chama o `fetch` sem `Content-Type` nos headers, e um `json("POST", {})` continua com `application/json`.
- `admin.test.ts`: `musicFormData` gera um `FormData` em que `get("data")` é o JSON sem o campo `audio` e `get("audio")` é o `File`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bun test src/lib/api`
Expected: FAIL

- [ ] **Step 3: Implement the client changes**

- [ ] **Step 4: Run tests and lint**

Run: `cd frontend && bun run test && bun run lint`
Expected: PASS

- [ ] **Step 5: Update `frontend/src/lib/api/README.md`**

Explique que o `request` aceita `FormData` sem `json()`, com o exemplo do `musicFormData`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api
git commit -m "feat(frontend): envia o áudio da música e adiciona o cliente de álbuns" -m "Refs #99"
```

### Task 8: Tela Conteúdo do painel de admin

**Files:**
- Create: `frontend/src/app/admin/conteudo/albums-section.tsx`, `artists-section.tsx` e `confirm-dialog.tsx`
- Modify: `frontend/src/app/admin/conteudo/page.tsx`
- Docs: `README.md` (a seção do fluxo do admin)

**Interfaces:**
- Consumes: os hooks e os tipos da Tarefa 7.
- Produces: `AlbumsSection({ albums, artists, error })`, `ArtistsSection({ artists, error })`, que sai do `page.tsx` sem mudar o comportamento, e `ConfirmDialog`, que sai do `page.tsx` com as mesmas props.

- [ ] **Step 1: Extract the existing sections**

Mova `ArtistsSection` e `ConfirmDialog` para os arquivos novos, sem mudar o comportamento.

Run: `cd frontend && bun run lint && bun run test`
Expected: PASS, e a tela continua igual. Confira em http://localhost:3000/admin/conteudo, com `bun start frontend` e `cd frontend && bun dev`.

- [ ] **Step 2: Commit the extraction**

```bash
git add frontend/src/app/admin/conteudo
git commit -m "refactor(frontend): separa as seções de artistas e a confirmação da tela de conteúdo" -m "Refs #99"
```

- [ ] **Step 3: Add the new fields to the music form**

- **Campo de áudio:** `<Input type="file" accept="audio/mpeg,.mp3">`, só no cadastro (`music === null`). Ele mostra "Escolha o arquivo de áudio da música." se estiver vazio, e "O áudio pode ter no máximo 20 MB." se o arquivo passar de `MAX_AUDIO_BYTES`, sem enviar.
- **Álbum:** um `<select>`, com a opção "Sem álbum" (`null`) e os álbuns de `useAlbums()`.
- **Explícito:** uma caixa "Conteúdo explícito".
- **Lista de músicas:**
  - uma marca "E" (`Badge`, com `aria-label="Conteúdo explícito"`) quando `isExplicit`;
  - o texto "sem áudio", em `text-muted-foreground`, quando `!hasAudio`;
  - o nome do álbum, depois dos artistas.

- [ ] **Step 4: Add the albums section**

O `AlbumsSection` segue o padrão do `ArtistsSection`: uma lista com filtro, "Novo álbum" e, para cada álbum, Editar e Remover. O formulário tem nome, artistas (o `Picker` que já existe) e um ano (`type="number"`, `min=1900`, `max` igual ao ano atual). Remover usa o `ConfirmDialog`, com o aviso "As músicas do álbum continuam no catálogo."

- [ ] **Step 5: Verify in the browser**

Com `bun start frontend` e `cd frontend && bun dev`, entre como `admin@zovic.test` e confira:
1. Criar o álbum "Teste" (2020) funciona.
2. Cadastrar uma música com um MP3, o álbum "Teste" e "Conteúdo explícito" funciona, e a lista mostra o "E" e o álbum.
3. Tentar um arquivo `.png` renomeado para `.mp3` mostra "O áudio precisa ser um MP3."
4. Editar uma música do seed (sem áudio) funciona.
5. Remover o álbum funciona, e a música continua na lista.

Run: `cd frontend && bun run lint && bun run test`
Expected: PASS

- [ ] **Step 6: Update the admin flow in the README**

Na aba **Conteúdo**: "cria, edita e remove músicas (com o arquivo MP3 de até 20 MB, o álbum e a marca de explícito), álbuns (com o ano) e artistas".

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/admin/conteudo README.md
git commit -m "feat(frontend): adiciona áudio, álbum e explícito ao cadastro de música no painel" -m "Refs #99"
```

### Task 9: Verificação final e registro

**Files:**
- Modify: `docs/prompts/prompts.md`

- [ ] **Step 1: Run every check**

Run: em `api/`, `bun run test && bun run test:integration && bun run lint && bun run typecheck && bun run db:sync --check`. Em `frontend/`, `bun run lint && bun run test`.
Expected: tudo PASS e nenhuma diferença no `db:sync --check`.

- [ ] **Step 2: Check the Docker path**

Run: `bun start full`. Cadastre uma música com áudio pelo painel em http://localhost:3000/admin/conteudo e rode `docker compose exec api ls /data/audio`.
Expected: um arquivo `<uuid>.mp3`. Depois de `bun stop` e de um novo `bun start full`, o arquivo continua lá, porque está no volume.

- [ ] **Step 3: Record the AI usage**

Acrescente a entrada de 05/11/2026 em `docs/prompts/prompts.md`, no formato das outras, com os prompts do design, do plano e da implementação.

- [ ] **Step 4: Commit**

```bash
git add docs/prompts/prompts.md
git commit -m "docs(admin): registra o uso de ia no cadastro de música com áudio" -m "Refs #99"
```

## Antes do PR

São ações no GitHub ou com o time, e cada uma é confirmada antes de ser feita:

1. O time aprovou o `multer`.
2. Comentar na #88 (Carlos) que a migração do ano e do explícito veio nesta entrega, e propor tirar o item da checklist dele.
3. Editar a regra da HU-28, na #99, para "A música tem título, artista, álbum (opcional), gênero, duração, marca de explícito e o caminho do arquivo de áudio no servidor privado." Avisar o Felipe.
4. Exportar de novo o `docs/assets/modelo-er.png`.

O título do PR é `feat(admin)!: cadastro de música com áudio, álbum e explícito (HU-28)`, e o corpo usa `Refs #99`. O "toca" da HU-28 depende da HU-13, e o "menor não vê explícita" depende da HU-09.
