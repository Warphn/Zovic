# Models (entidades de domínio)

As models da API são as **entidades de domínio**, em `api/domain/entities/`. Elas guardam as regras de negócio: o que é um nome válido, quem pode sair de uma playlist, que toda música precisa de um artista etc. Não sabem nada de banco nem de HTTP.

Não confunda com os `model` do `schema.prisma`: aqueles só espelham as tabelas do banco (ver [Banco de dados](banco-de-dados.md)). Uma entidade pode juntar várias tabelas: a `Music`, por exemplo, cuida da tabela `musics` e também das associativas `artist_music` e `genre_music`.

## Como as peças se encaixam

| Camada | Pasta | Papel |
| --- | --- | --- |
| **Entidade** | `api/domain/entities/` | Regras de negócio. Valida os dados e só muda de estado por métodos. |
| **Porta** | `api/domain/ports/` | Interface do repositório: diz *o que* o domínio precisa do banco (`save`, `findById`…), sem dizer *como*. |
| **Repositório** | `api/adapters/db/` | Implementa a porta com SQL no Postgres. Converte linha do banco ↔ entidade. |
| **Caso de uso** | `api/domain/use-cases/` | Orquestra: pede um id, cria/carrega a entidade, chama os métodos e salva. |
| **Porta de consulta** | `api/domain/ports/` | Para leituras que cruzam muitas tabelas e não têm regra de negócio: devolve os dados já no formato da resposta, sem montar entidades. Veja [Portas de consulta](#portas-de-consulta). |
| **Controller e rotas** | `api/adapters/http/` | Validam a requisição com Joi (`schemas/` e `middlewares/validate-request.ts`), chamam o caso de uso e respondem. A ligação das peças fica em `api/infra/composition-root.ts`. |

O fluxo típico de um caso de uso:

```ts
const id = await repository.nextId();             // reserva o id no banco
const music = Music.create({ id, name, duration, artistIds }); // valida as regras
await repository.save(music);                      // grava tudo numa transação
```

## Funcionamento comum a todas as entidades

Toda entidade segue o mesmo formato:

| Função | O que faz |
| --- | --- |
| `Entidade.create(dados)` | Cria uma entidade **nova**, validando todas as regras. Preenche os padrões (`createdAt` = agora, `deletedAt` = `null`). Aceita `now` para fixar a data nos testes. |
| `Entidade.restore(dados)` | Reconstrói uma entidade **que já existe no banco**. Não valida de novo: é usado só pelos repositórios. |
| getters (`id`, `name`…) | Leitura dos campos. Listas e datas saem como **cópia**: mexer nelas não altera a entidade. |
| `toData()` | Devolve todos os dados como objeto simples (cópia). É o que o repositório grava. |
| `delete(now?)` | **Soft delete**: preenche `deletedAt`. A linha continua no banco. |

Regras gerais:

- **Os campos não são alterados diretamente.** Toda mudança passa por um método, que valida antes de aplicar.
- **Entidade apagada não muda mais.** Qualquer método de alteração (inclusive um segundo `delete`) lança `BusinessRuleError`.
- **Nomes** perdem os espaços das pontas e não podem ficar vazios nem passar do limite da coluna.
- **Listas de ids** (`artistIds`, `genreIds`…) aceitam só inteiros positivos e têm os repetidos removidos.

### Erros

Ficam em `api/domain/errors/domain-error.ts`. O `error-handler` da API converte cada um num status HTTP e responde `{ error: code, message }`.

| Erro | HTTP | Quando acontece |
| --- | --- | --- |
| `ValidationError` | 400 | Dado inválido: nome vazio, cor fora do formato, duração negativa, id que não é inteiro positivo. |
| `ForbiddenError` | 403 | Ação não permitida para o usuário, por exemplo editar uma playlist de que ele não é admin. |
| `NotFoundError` | 404 | Algo referenciado não existe, por exemplo um artista inexistente ao salvar uma música. |
| `BusinessRuleError` | 409 | Regra de negócio violada: remover o último artista, membro repetido, alterar algo apagado, nome de gênero já usado. |

### Helpers compartilhados (`api/domain/shared/`)

| Função | Arquivo | O que faz |
| --- | --- | --- |
| `validateName(name, max, label)` | `name.ts` | Tira os espaços das pontas e confere se o nome não está vazio nem passa de `max`. |
| `normalizeHexColor(color)` | `hex-color.ts` | Confere o formato `#RRGGBB` e devolve em maiúsculas (`#ff8800` → `#FF8800`). |
| `normalizeIds(ids, label)` | `ids.ts` | Confere se são inteiros positivos e tira os repetidos, mantendo a ordem. |
| `addId(ids, id, label)` | `ids.ts` | Devolve a lista com o id a mais; recusa id que já está nela. |
| `removeId(ids, id, label)` | `ids.ts` | Devolve a lista sem o id; recusa id que não está nela. |

## Entidades

### Playlist

Arquivo: `api/domain/entities/playlist.ts` · Tabelas: `playlists`, `playlist_user`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | `number` | |
| `name` | `string` | Até 150 caracteres. |
| `isPrivate` | `boolean` | Padrão `false`. |
| `color` | `string \| null` | Hex `#RRGGBB`, opcional. |
| `members` | `{ userId, isAdmin }[]` | Quem cria vira o primeiro membro, como admin. |
| `createdAt` / `deletedAt` | `Date` / `Date \| null` | |

| Função | O que faz |
| --- | --- |
| `create({ id, creatorId, name, isPrivate?, color?, now? })` | Cria a playlist com o criador como admin. |
| `restore(dados)` | Reconstrói a partir do banco. |
| `toData()` | Dados da playlist, com cópia da lista de membros. |
| `isMember(userId)` | `true` se o usuário é membro. |
| `isAdmin(userId)` | `true` se o usuário é membro **e** admin. |
| `addMember(userId)` | Adiciona como membro comum. Recusa quem já é membro. |
| `removeMember(userId)` | Remove o membro. Recusa quem não é membro e **não deixa sair o último admin**. |
| `promote(userId)` | Torna o membro admin. |
| `rename(name)` | Troca o nome. |
| `changeColor(color)` | Troca a cor (`null` tira a cor). |
| `setPrivate(isPrivate)` | Torna a playlist privada ou pública. |
| `delete(now?)` | Soft delete. |

### Genre

Arquivo: `api/domain/entities/genre.ts` · Tabela: `genre`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | `number` | |
| `name` | `string` | Até 100 caracteres. Único entre os gêneros ativos (regra do banco). |
| `color` | `string` | Hex `#RRGGBB`, **obrigatória**. |
| `createdAt` / `deletedAt` | `Date` / `Date \| null` | |

| Função | O que faz |
| --- | --- |
| `create({ id, name, color, now? })` | Cria o gênero, com a cor normalizada. |
| `restore(dados)` | Reconstrói a partir do banco. |
| `toData()` | Dados do gênero. |
| `rename(name)` | Troca o nome. |
| `changeColor(color)` | Troca a cor. |
| `delete(now?)` | Soft delete. |

### Artist

Arquivo: `api/domain/entities/artist.ts` · Tabela: `artist`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | `number` | |
| `name` | `string` | Até 255 caracteres. |
| `createdAt` / `deletedAt` | `Date` / `Date \| null` | |

| Função | O que faz |
| --- | --- |
| `create({ id, name, now? })` | Cria o artista. |
| `restore(dados)` | Reconstrói a partir do banco. |
| `toData()` | Dados do artista. |
| `rename(name)` | Troca o nome. |
| `delete(now?)` | Soft delete. |

### Album

Arquivo: `api/domain/entities/album.ts` · Tabelas: `album`, `album_artist`, `album_genre`

As faixas do álbum não ficam aqui: cada música diz o próprio álbum (`Music.albumId`), e é o repositório de músicas que grava o `album_music`. Ele também dá o número da faixa: a música entra como a última do álbum e mantém o número enquanto não muda de álbum.

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | `number` | |
| `name` | `string` | Até 255 caracteres. |
| `artistIds` | `number[]` | **Ao menos um.** |
| `genreIds` | `number[]` | Pode ser vazio. |
| `year` | `number \| null` | Ano de lançamento, de 1900 (`Album.MIN_YEAR`) até o ano atual. Obrigatório no `create`. `null` só nos álbuns anteriores à coluna. |
| `coverFile` | `string \| null` | Nome da imagem de capa no armazenamento. Obrigatório no `create`. `null` só nos álbuns anteriores à capa. |
| `createdAt` / `deletedAt` | `Date` / `Date \| null` | |

| Função | O que faz |
| --- | --- |
| `create({ id, name, artistIds, year, coverFile, genreIds?, now? })` | Cria o álbum. Recusa lista de artistas vazia, ano fora do intervalo e capa vazia. |
| `restore(dados)` | Reconstrói a partir do banco. |
| `toData()` | Dados do álbum, com cópia das listas. |
| `rename(name)` | Troca o nome. |
| `addArtist(artistId)` / `removeArtist(artistId)` | Vincula / desvincula um artista. **Não remove o último.** |
| `addGenre(genreId)` / `removeGenre(genreId)` | Vincula / desvincula um gênero. |
| `changeYear(year, now?)` | Troca o ano, com a mesma regra do `create`. |
| `changeCover(coverFile)` | Troca a capa. |
| `delete(now?)` | Soft delete. |

### Music

Arquivo: `api/domain/entities/music.ts` · Tabelas: `musics`, `artist_music`, `genre_music`, `album_music`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | `number` | |
| `name` | `string` | Até 255 caracteres. |
| `duration` | `number` | Segundos, inteiro maior que zero. |
| `lyricsId` | `number \| null` | Ainda não aponta para nenhuma tabela (letras em aberto no [Modelo ER](modelo-er.md)). |
| `streams` | `number` | **Só leitura.** Começa em 0. |
| `rating` | `number \| null` | **Só leitura.** Média das avaliações; `null` sem avaliações. |
| `artistIds` | `number[]` | **Ao menos um.** |
| `genreIds` | `number[]` | Pode ser vazio. |
| `audioFile` | `string \| null` | Nome do MP3 no armazenamento (`<uuid>.mp3`). **Obrigatório no `create`.** `null` só nas músicas anteriores ao upload. |
| `isExplicit` | `boolean` | Conteúdo explícito. Padrão `false`. |
| `albumId` | `number \| null` | Zero ou um álbum. O repositório de músicas grava esse vínculo no `album_music`. |
| `createdAt` / `deletedAt` | `Date` / `Date \| null` | |

`streams` e `rating` são estatísticas calculadas fora da entidade: ela não tem métodos para alterá-las e o repositório **não as sobrescreve** ao salvar.

| Função | O que faz |
| --- | --- |
| `create({ id, name, duration, artistIds, audioFile, genreIds?, albumId?, isExplicit?, lyricsId?, now? })` | Cria a música com as estatísticas zeradas. Recusa lista de artistas vazia e `audioFile` vazio. |
| `restore(dados)` | Reconstrói a partir do banco, com as estatísticas. |
| `toData()` | Dados da música, com cópia das listas. |
| `rename(name)` | Troca o nome. |
| `changeDuration(duration)` | Troca a duração. |
| `addArtist(artistId)` / `removeArtist(artistId)` | Vincula / desvincula um artista. **Não remove o último.** |
| `addGenre(genreId)` / `removeGenre(genreId)` | Vincula / desvincula um gênero. |
| `changeAlbum(albumId)` | Troca o álbum; `null` tira a música do álbum. |
| `setExplicit(isExplicit)` | Marca ou desmarca o conteúdo explícito. |
| `delete(now?)` | Soft delete. |

## Repositórios

As portas ficam em `api/domain/ports/` e as implementações em `api/adapters/db/postgres-<entidade>-repository.ts`.

| Função | Disponível em | O que faz |
| --- | --- | --- |
| `nextId()` | Todos | Reserva o próximo id da tabela (antes do `create`). |
| `save(entidade)` | Todos | Insere ou atualiza (upsert pelo `id`). Quando há vínculos, regrava as tabelas associativas na **mesma transação**: se algo falhar, nada é gravado. |
| `findById(id)` | Todos | Carrega a entidade com seus vínculos. Devolve `null` se não existir **ou estiver apagada**. |
| `findByIds(ids)` | Music | Carrega várias músicas ativas, **na ordem dos ids pedidos**. Ids inexistentes são ignorados. |
| `listByUser(userId)` | Playlist | As playlists ativas de que o usuário é membro, da mais nova para a mais antiga. |

Erros do banco traduzidos para erros de domínio:

| Repositório | Situação | Erro |
| --- | --- | --- |
| Playlist | Membro com usuário inexistente | `NotFoundError` |
| Genre | Nome igual ao de outro gênero ativo | `BusinessRuleError` |
| Album | Artista ou gênero inexistente | `NotFoundError` |
| Music | Artista, gênero ou álbum inexistente | `NotFoundError` |

Os helpers comuns aos repositórios ficam em `api/adapters/db/sql.ts`:

| Função | O que faz |
| --- | --- |
| `nextId(pool, table)` | Pega o próximo valor da sequência do `id` da tabela. |
| `inTransaction(pool, work)` | Roda `work` entre `BEGIN` e `COMMIT`; faz `ROLLBACK` e relança o erro se algo falhar. |
| `replaceLinks(client, link, ownerId, ids)` | Apaga os vínculos do dono numa tabela associativa e insere os novos. |
| `translateConstraintError(error, map)` | Troca o erro do Postgres pelo erro de domínio mapeado para a constraint violada. |

## Armazenamento de arquivos

A porta `FileStorage` (`api/domain/ports/file-storage.ts`) guarda os arquivos enviados pelo painel: os MP3 das músicas e as capas dos álbuns. O domínio só conhece o nome que ela devolve, e é esse nome que fica em `Music.audioFile` e em `Album.coverFile`.

| Função | O que faz |
| --- | --- |
| `save(bytes, extension)` | Grava o arquivo e devolve o nome com que ele foi guardado, como `<uuid>.mp3`. |
| `remove(fileName)` | Apaga o arquivo. Um nome que não existe não é erro. |

A implementação, `LocalFileStorage` (`api/adapters/storage/local-file-storage.ts`), grava num diretório (`AUDIO_DIR` para os áudios, `COVER_DIR` para as capas) com um nome gerado e descarta o nome enviado pelo admin. As regras conferem os primeiros bytes, sem confiar na extensão:

- **Áudio** (`api/domain/shared/audio.ts`): `validateAudio(bytes)`, MP3 de até 20 MB.
- **Capa** (`api/domain/shared/cover-image.ts`): `validateCover(bytes)`, JPEG, PNG ou WebP de até 2 MB. Ela devolve a extensão com que a imagem é guardada (`.jpg`, `.png` ou `.webp`).

No `ManageCatalog.createMusic` e no `createAlbum`, o arquivo só vai para o disco depois das conferências. Se a música ou o álbum não chegar a ser salvo, o arquivo é apagado. No `changeAlbumCover`, a capa antiga só é apagada depois que o álbum foi salvo com a nova.

## Portas de consulta

Leituras prontas para a tela, que cruzam várias tabelas sem passar pelas entidades. Quem decide se o usuário pode ver ou editar algo é o caso de uso, antes de chamar a porta.

| Porta | Arquivo | O que faz |
| --- | --- | --- |
| `SearchQuery` | `search-query.ts` | A busca de músicas, artistas e playlists (`GET /api/search`) |
| `PlaylistMusics` | `playlist-musics.ts` | Lista, põe, tira e reordena as músicas de uma playlist. As escritas mexem só em `music_playlist`. |
| `CatalogQueries` | `admin-queries.ts` | Lista músicas, artistas e gêneros |
| `PlayLog` | `admin-queries.ts` | Registra uma reprodução |
| `AdminQueries` | `admin-queries.ts` | Os números do painel e as reproduções recentes de um usuário |
| `UserAccounts` | `admin-queries.ts` | Cria e remove contas e conta os admins ativos, para o painel de admin |

As implementações ficam em `api/adapters/db/` (`postgres-search-query.ts`, `postgres-playlist-musics.ts` e `postgres-admin-queries.ts`). A `UserAccounts` é a exceção: ela fica em `api/adapters/auth/better-auth-user-accounts.ts`, porque cria as contas pelo Better Auth.

## Criando uma entidade nova

1. **Entidade** em `api/domain/entities/<nome>.ts`, seguindo o formato acima: `ExistingXData`, `NewXData`, `create`, `restore`, getters, `toData`, métodos de alteração e `ensureNotDeleted`.
2. **Testes de domínio** em `<nome>.test.ts`, ao lado: `bun run test`.
3. **Porta** em `api/domain/ports/<nome>-repository.ts`.
4. **Repositório** em `api/adapters/db/postgres-<nome>-repository.ts`, usando os helpers de `sql.ts`. Os nomes das constraints seguem o padrão do Prisma (`<tabela>_<coluna>_fkey`, `<tabela>_<coluna>_key`), definido na migration.
5. **Teste de integração** em `api/adapters/db/`, apagando no `afterAll` o que criou: `bun run test:integration` (precisa do banco no ar).
6. **Atualize esta página** com os campos e as funções da entidade.
