# Cadastro de música com áudio pelo painel de admin — design

Data: 2026-11-05 · Branch: `feat/HU-28-cadastro-musica-audio` · Issue: #99 (HU-28)

## Intenção

Hoje o admin cadastra uma música pelo painel (`POST /api/admin/musics`) só com nome, duração, artistas e gêneros. A música não tem áudio, álbum nem a marca de conteúdo explícito, e por isso não dá para tocá-la.

O objetivo é o admin cadastrar a música completa, com o arquivo de áudio, pela aba **Conteúdo** do painel de admin. A API guarda o arquivo no servidor e a música passa a ter álbum (opcional), conteúdo explícito e o arquivo de áudio. O álbum ganha o ano e passa a ser gerenciado no painel.

É o primeiro passo para a música tocar de ponta a ponta. A entrega do áudio ao player (HU-13, #90) usa o que esta entrega guarda, mas fica para outro PR.

### Critérios de sucesso

- O admin cadastra, no painel, uma música com um MP3, álbum, gêneros, artistas e a marca de explícito, e ela aparece na lista do catálogo.
- O cadastro sem áudio, com um arquivo que não é MP3 ou com mais de 20 MB é recusado, e nada é gravado (nem a música, nem o arquivo).
- O admin cadastra, edita e remove álbuns, com nome, artistas e ano.

## Decisões

| Decisão | Escolha | Por quê |
| --- | --- | --- |
| Escopo | Upload do áudio e os campos novos da HU-28. O stream fica para a HU-13. | A HU-28 precisa do arquivo guardado. A entrega ao player tem regras próprias (assinatura ativa, menores). |
| Migração | Esta entrega cria o áudio, o explícito e o ano do álbum | A HU-28 fecha de uma vez. A #88 (Carlos) deixa de criar o ano e o explícito, e isso precisa ser combinado com ele. |
| Álbum | Opcional na música, com zero ou um álbum. O CRUD de álbuns entra no painel. | Aceita singles. A regra da HU-28 muda para "álbum (opcional)", e uma música sem álbum fica sem ano na ficha (HU-11). |
| Arquivo | Só MP3, até 20 MB | Todo navegador toca MP3, e 20 MB cobrem uma faixa de cerca de 10 minutos a 256 kbps |
| Envio | Uma requisição `multipart/form-data`, com o `multer` | Os dados e o arquivo vão juntos, e a música nunca existe sem áudio. Pede uma dependência nova, que precisa ser combinada com o time. |

## Fora do escopo

- Trocar o áudio de uma música que já existe.
- Entregar o áudio ao player (HU-13) e esconder as explícitas para menores (HU-09).
- Remoção em cascata de álbum e artista (HU-29). Remover um álbum só o marca como removido, e as músicas dele continuam no ar.
- Limpar arquivos órfãos no disco. Pelo fluxo abaixo, eles não aparecem: o arquivo só é gravado depois de conferir as referências e o áudio, e é apagado se algum passo seguinte falhar. Só sobraria um órfão se a API caísse entre gravar o arquivo e gravar a música.
- Backup dos arquivos de áudio no servidor, que segue a mesma pendência do backup do banco.

## Banco

Uma migration nova, `V<AAMMDD>_<HHMMSS>__Adiciona_audio_explicito_e_ano_do_album.sql`, com a data e a hora em que for criada:

```sql
ALTER TABLE musics
    ADD COLUMN audio_file  varchar(255),
    ADD COLUMN is_explicit boolean NOT NULL DEFAULT false;

ALTER TABLE album
    ADD COLUMN year smallint,
    ADD CONSTRAINT album_year_check CHECK (year >= 1900);
```

- `audio_file` é o nome do arquivo no armazenamento (`<uuid>.mp3`), não um caminho absoluto. Assim, o diretório pode mudar sem migrar os dados. A coluna fica `NULL` nas músicas que já existem, como as do seed.
- `year` é opcional porque os álbuns que já existem não têm ano. O limite "até o ano atual" não cabe num CHECK, porque o valor muda com o tempo, então o domínio o garante.
- `album_music` continua N:N no banco. O domínio limita a música a um álbum.

Depois da migration: `bun run db:sync` em `api/`. O seed passa a dar um ano a cada álbum fictício (`catalog-data.ts`).

## Domínio

### `Music` (`api/domain/entities/music.ts`)

| Campo novo | Tipo | Regra |
| --- | --- | --- |
| `audioFile` | `string \| null` | Obrigatório no `create` (`ValidationError("Music must have an audio file")`). Pode ser `null` no `restore`, para as músicas antigas. |
| `isExplicit` | `boolean` | Padrão `false` |
| `albumId` | `number \| null` | Zero ou um álbum. Inteiro positivo quando preenchido. |

Métodos novos: `changeAlbum(albumId: number | null)` e `setExplicit(isExplicit: boolean)`. Os dois recusam uma música removida, como os outros métodos.

### `Album` (`api/domain/entities/album.ts`)

- Ganha `year: number | null`. No `create`, ele é obrigatório e vai de `Album.MIN_YEAR = 1900` até o ano atual (o `now` do `create` permite fixar a data nos testes). No `restore`, pode ser `null`.
- Ganha `changeYear(year)`, com a mesma regra.
- **Perde `musicIds`, `addMusic` e `removeMusic`.** A ligação `album_music` passa a ser da música: o repositório de músicas grava o álbum dela, e as faixas de um álbum saem de uma consulta. Assim, só uma entidade escreve na tabela. Hoje nenhum caso de uso usa o `musicIds` do álbum, só o seed e os testes.

### Regra do áudio (`api/domain/shared/audio.ts`)

- `MAX_AUDIO_BYTES = 20 * 1024 * 1024`.
- `validateAudio(bytes: Uint8Array): void` lança `ValidationError` se o arquivo estiver vazio, passar do limite ou não for MP3.
- `isMp3(bytes)` olha o começo do arquivo, sem confiar na extensão nem no `Content-Type`. Um MP3 começa com a tag `ID3` (`0x49 0x44 0x33`) ou com o sincronismo de quadro MPEG (11 bits ligados: `0xFF` e depois um byte com `& 0xE0 === 0xE0`).

### Porta `AudioStorage` (`api/domain/ports/audio-storage.ts`)

```ts
export interface AudioStorage {
  /** Grava o arquivo e devolve o nome com que ele foi guardado. */
  save(bytes: Uint8Array): Promise<string>;
  remove(fileName: string): Promise<void>;
}
```

### Caso de uso (`ManageCatalog`)

`createMusic(input, audio)`, em que `audio` é `Uint8Array | null`:

1. Confere se os artistas, os gêneros e o álbum existem e não foram removidos (`NotFoundError`).
2. `validateAudio(audio)` (`ValidationError`).
3. `audioStorage.save(audio)`, que devolve o nome do arquivo.
4. `Music.create` com esse nome e `musics.save(music)`. Se qualquer um dos dois falhar, `audioStorage.remove(nome)` e relança o erro.

Os campos da música (nome, duração) já chegam validados pelo Joi, então o passo 4 quase nunca falha por validação. Mesmo assim, o arquivo é apagado em qualquer falha depois de gravado.

`updateMusic` passa a aceitar `albumId` (incluindo `null`) e `isExplicit`. Os métodos `createAlbum`, `updateAlbum` e `deleteAlbum` seguem o padrão dos de artista.

`ManageCatalog` passa a receber também o `AlbumRepository` e o `AudioStorage`.

## Armazenamento

`api/adapters/storage/local-audio-storage.ts` implementa o `AudioStorage` em disco:

- **Nome:** `crypto.randomUUID()` mais `.mp3`. O nome original enviado pelo admin é descartado, o que evita caminho malicioso e colisão.
- **Gravação:** com `Bun.write`, em `AUDIO_DIR`. O diretório é criado na subida da API, se ainda não existir.
- **Remoção:** um arquivo que não existe não é erro.

`AUDIO_DIR` entra no `api/infra/config.ts`:

| Onde | Valor |
| --- | --- |
| `bun dev` | Padrão `api/storage/audio`, resolvido a partir da pasta da API. `api/storage/` entra no `.gitignore`. |
| Docker (profiles `frontend`, `full` e `prod`) | `AUDIO_DIR=/data/audio`, com o volume nomeado `audio:/data/audio` no serviço `api` |

## Rotas

### `POST /api/admin/musics` (muda)

`multipart/form-data` com duas partes:

| Parte | Conteúdo |
| --- | --- |
| `data` | Texto JSON: `{ name, duration, artistIds, genreIds?, albumId?, isExplicit? }` |
| `audio` | O arquivo MP3 |

A requisição segue estes passos, e cada um para a requisição se falhar:

| Passo | Quem | Falha |
| --- | --- | --- |
| Lê a requisição em memória, com no máximo um arquivo de `MAX_AUDIO_BYTES` e nenhuma outra parte de arquivo | `multer` (`memoryStorage`, `limits.fileSize`, `files: 1`) | 413 `AUDIO_TOO_LARGE`. Um arquivo numa parte que não é `audio` dá 400. |
| Interpreta o `data` como JSON e o valida com o Joi | middleware novo, `parseMultipartData(schema)` | 400 `INVALID_JSON` ou 400 `VALIDATION_ERROR` |
| Confere as referências, o áudio, e grava | `ManageCatalog.createMusic` | 404 (artista, gênero ou álbum) ou 400 (sem áudio, não é MP3) |

A resposta é `201` com o `MusicOutput`, que ganha `albumId`, `isExplicit` e `hasAudio`. O nome do arquivo não sai na resposta.

Isso quebra quem mandava JSON para essa rota. Hoje, só o painel de admin usa a rota, e ele muda no mesmo PR. O commit leva `feat(admin)!` e o rodapé `BREAKING CHANGE`.

O `errorHandler` passa a traduzir os erros do `multer` (`MulterError`): `LIMIT_FILE_SIZE` vira 413, e os outros viram 400.

### Outras rotas

| Rota | Mudança |
| --- | --- |
| `PATCH /api/admin/musics/:id` | Continua em JSON. Aceita `albumId` (inclusive `null`) e `isExplicit`. |
| `GET /api/musics` | Cada item ganha `album` (`{ id, name, year } \| null`, só um álbum ativo), `isExplicit` e `hasAudio` |
| `GET /api/albums` | Nova, com os mesmos middlewares da `GET /api/artists` (`subscriberOnly`): `{ id, name, year, artists }[]` dos álbuns ativos, por nome |
| `POST /api/admin/albums` | Nova: `{ name, artistIds, year }` dá 201 com o álbum |
| `PATCH /api/admin/albums/:id` | Nova: qualquer subconjunto de `{ name, artistIds, year }` |
| `DELETE /api/admin/albums/:id` | Nova: soft delete, responde 204 |

## Front (painel de admin)

### Cliente da API

- `frontend/src/lib/api/client.ts`: o `request` só põe `Content-Type: application/json` quando o corpo é texto. Com `FormData`, quem define o cabeçalho é o navegador, com o separador das partes.
- `frontend/src/lib/api/admin.ts`: o `createMusic` monta um `FormData` com `data` (o JSON) e `audio` (o `File`). Entram também os serviços de álbum.
- As mensagens dos erros novos entram no `MESSAGES` do cliente:
  - "O áudio precisa ser um MP3."
  - "O áudio pode ter no máximo 20 MB."
  - "Escolha o arquivo de áudio da música."

### Tela Conteúdo (`frontend/src/app/admin/conteudo/`)

- **Formulário de música:**
  - um campo de arquivo (`accept="audio/mpeg,.mp3"`), obrigatório no cadastro e escondido na edição;
  - uma seleção de álbum, com a opção "Sem álbum";
  - uma caixa "Conteúdo explícito".

  O tamanho e a extensão são conferidos no navegador antes do envio, só para avisar mais cedo. Quem garante a regra é a API.
- **Lista de músicas:** uma marca "E" nas explícitas e um aviso "sem áudio" nas músicas antigas.
- **Seção de álbuns,** num arquivo novo, `albums-section.tsx`: lista com filtro, cadastro, edição e remoção, com nome, artistas e ano.
- A seção de artistas, que já existe, sai do `page.tsx` para `artists-section.tsx`, para cada arquivo ter uma seção só. O `page.tsx` hoje tem 441 linhas.

## Testes

| Arquivo | Casos |
| --- | --- |
| `api/domain/entities/music.test.ts` | O `create` sem `audioFile` é recusado. `isExplicit` tem padrão `false`. `changeAlbum` e `setExplicit` funcionam e recusam uma música removida. O `restore` aceita `audioFile` nulo. |
| `api/domain/entities/album.test.ts` | O ano vai de 1900 até o ano atual (1899 e o ano seguinte são recusados). `changeYear` funciona. O `restore` aceita ano nulo. |
| `api/domain/shared/audio.test.ts` | `isMp3` aceita um arquivo com `ID3` e outro com sincronismo de quadro, e recusa um PNG e um arquivo vazio. `validateAudio` recusa um arquivo acima de 20 MB. |
| `api/domain/use-cases/manage-catalog.test.ts` | O cadastro sem áudio não cria a música nem grava o arquivo. Um álbum inexistente dá `NotFoundError`. Se o `save` da música falhar, o arquivo gravado é removido. CRUD de álbuns. |
| `api/adapters/http/admin-flow.test.ts` (integração) | Admin cadastra com todos os campos: 201, com o arquivo em `AUDIO_DIR`. Sem áudio: 400. Acima de 20 MB: 413. Um arquivo que não é MP3: 400. `data` inválido: 400. Quem não é admin: 403. CRUD de álbuns e `GET /api/albums`. |
| `api/adapters/db/postgres-catalog-repositories.test.ts` (integração) | O repositório de músicas grava e lê `audio_file`, `is_explicit` e o álbum. O de álbuns grava e lê o ano. |
| `api/adapters/storage/local-audio-storage.test.ts` | Grava num diretório temporário, devolve um nome `.mp3` e remove. Remover um arquivo que não existe não é erro. |
| `frontend/src/lib/api/client.test.ts` | Um `FormData` não recebe o `Content-Type` de JSON |

Nos testes de integração, o `AUDIO_DIR` aponta para um diretório temporário, apagado no `afterAll`.

Critérios de aceite da HU-28 e o que esta entrega cobre:

| Critério | Situação |
| --- | --- |
| A música cadastrada com todos os campos aparece no catálogo | Coberto |
| A música cadastrada com todos os campos toca | Depende do stream (HU-13) |
| O cadastro sem título ou sem áudio não cria a música | Coberto |
| Uma música explícita não aparece para um menor | Depende da HU-09 (#87). Esta entrega só grava a marca. |
| Ao corrigir o ano de um álbum, a ficha mostra o ano novo | O ano é editável. A ficha é da HU-11 (#88). |

Por isso, o PR usa `Refs #99`, e não `Closes`.

## Documentação no mesmo PR

| Arquivo | Mudança |
| --- | --- |
| `api/adapters/http/openapi.ts` | O multipart em `POST /api/admin/musics`, os campos novos e as rotas de álbum |
| `api/bruno/` | Uma requisição de cadastro multipart com um MP3 pequeno de teste e as requisições de álbum |
| `docs/banco-de-dados.md`, `docs/modelo-er.md` | As colunas novas. A imagem `docs/assets/modelo-er.png` precisa ser exportada de novo à mão. |
| `docs/models.md` | `Music`, `Album`, a porta `AudioStorage` e a regra do áudio |
| `docs/api.md` | As rotas de música e de álbum |
| `README.md`, `docs/docker.md` | `AUDIO_DIR` e o volume `audio` |
| `docs/servidor.md` | O volume `audio` e a pendência de backup |
| `frontend/src/lib/api/README.md` | O envio de `FormData` pelo `request` |
| `docs/prompts/prompts.md` | O registro do uso de IA |

## Pendências de coordenação

São ações no GitHub ou com o time, e cada uma é confirmada antes de ser feita.

1. **Dependência nova:** combinar o `multer` e o `@types/multer` com o time, antes do merge.
2. **#88 (Carlos):** avisar que a migração do ano no álbum e do explícito vem desta entrega, e tirar esse item da checklist dele.
3. **#99 (HU-28):** mudar a regra para "a música tem título, artista, álbum (opcional), …".
4. **Felipe:** é o responsável pelo épico de administração (#81) e revisa a mudança na HU-28.
