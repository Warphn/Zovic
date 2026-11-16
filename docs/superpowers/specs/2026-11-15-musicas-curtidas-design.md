# Músicas Curtidas (HU-34) — design

Issue: a criar (HU-34) · Épico: Playlists (#78) · Responsável: Victor · Relacionada: HU-20 (#94, curtidas, do Caio)

## Intenção

Como no Spotify, toda conta tem uma playlist fixa "Músicas Curtidas". Curtir uma música a põe lá, e descurtir a tira. A curtida em si é da HU-20 (Caio) e ainda não existe na API: hoje o coração do front grava só no `localStorage`. Esta história entrega o lado da playlist pronto. A curtida da API, quando existir, chama os mesmos casos de uso. Até lá, o coração do front chama duas rotas desta história.

## Regras (aprovadas pelo Victor)

- Toda conta tem exatamente uma "Músicas Curtidas". Ela é privada, e a conta é a dona.
- Ela não pode ser renomeada, nem mudar de visibilidade ou de cor, nem ser excluída, nem receber colaboradores.
- Uma música só entra pela curtida. Ela não aparece no menu "Adicionar à playlist", e a API recusa pôr música nela por outra rota.
- Tirar uma música dela pela página da playlist também descurte a música.
- A ordem é da curtida mais recente para a mais antiga. Reordenar fica desligado na tela e é recusado pela API.
- Ela aparece primeiro em "Minhas playlists", com visual próprio (coração).

## Critérios de aceite (propostos para a issue)

1. Dado uma conta nova, quando ela abre "Minhas playlists", então "Músicas Curtidas" aparece primeiro, vazia.
2. Dado uma música, quando o assinante a curte, então ela entra no topo de "Músicas Curtidas". Quando ele descurte, ela sai.
3. Dado "Músicas Curtidas", quando o dono tenta renomear, excluir, reordenar, pôr música pelo menu ou adicionar colaborador, então o pedido é recusado.
4. Dado uma música em "Músicas Curtidas", quando o dono a tira pela página da playlist, então ela também deixa de estar curtida.

## Abordagens consideradas

1. **Uma playlist de verdade, marcada como especial (escolhida).** Ela reaproveita a página, o player, a fila e a busca de playlists, e dá para entregar sem a tabela de votos da HU-20.
2. **Uma playlist "virtual" montada da tabela de votos da HU-20.** Não duplica a informação, mas depende de uma tabela que ainda não existe.

## Como funciona

### Banco

- **Migração:** `playlists.liked_by_user_id integer UNIQUE REFERENCES "user"(id) ON DELETE CASCADE`.
- **Significado:** é nula nas playlists comuns. Na "Músicas Curtidas", guarda o dono, e o `UNIQUE` garante uma por conta, mesmo com duas criações ao mesmo tempo.
- **Membros:** os membros continuam em `playlist_user`, com o dono como admin.

### Domínio

- **Entidade `Playlist`:**
  - Ganha `likedByUserId: number | null` e `isLikedSongs`.
  - Ganha a fábrica `Playlist.createLikedSongs({ id, userId, now })`, que monta o nome "Músicas Curtidas", privada e com a cor fixa `#D33A2C`.
  - `rename`, a troca de visibilidade e de cor, `delete` e `addMember` recusam com `BusinessRuleError` quando `isLikedSongs`.
- **`PlaylistRepository`:** ganha `findLikedSongs(userId)` e `createLikedSongs(playlist)`. O segundo insere sem erro se outra chamada já criou e devolve a que ficou.
- **`PlaylistMusics`:** ganha `addToTop(playlistId, musicId, now)`. Ele desloca as posições em +1 e insere na 0, numa transação. Se a música já está lá, não faz nada.
- **Casos de uso:**
  - `EnsureLikedSongs(userId)` acha ou cria a playlist.
  - `LikeMusic(userId, musicId)` garante a playlist e põe a música no topo. Música inexistente dá 404.
  - `UnlikeMusic(userId, musicId)` tira a música se ela estiver lá.
  - `ListMyPlaylists` garante a "Músicas Curtidas" e a põe primeiro.
  - `AddMusicToPlaylist` e `ReorderPlaylistMusics` recusam na "Músicas Curtidas" (409).
  - `RemoveMusicFromPlaylist` continua valendo nela. Quem descurte no front é a página.
- **Saída da playlist:** ganha `isLikedSongs`.

### API

- `PUT /api/me/liked-musics/:musicId` responde 204 e põe a música.
- `DELETE /api/me/liked-musics/:musicId` responde 204 e tira a música.
- Quando a HU-20 tiver a curtida na API, a rota de voto chama `LikeMusic` e `UnlikeMusic`, e estas duas podem sair.

### Front

- **Coração (`TrackLikeButton`):** além do `localStorage`, chama `PUT` ou `DELETE` para as músicas do catálogo e atualiza as playlists.
- **Página da playlist, quando é a "Músicas Curtidas":**
  - Sem "Editar playlist", "Colaboradores" e reordenar.
  - Tirar uma música também descurte no `localStorage`.
  - O encarte mostra um coração.
- **"Minhas playlists":** o cartão dela vem primeiro e não tem lixeira.
- **Menu "Adicionar à playlist":** não a lista.

## Fora do escopo

Dislike, número de likes na ficha e curtida guardada no servidor, que são da HU-20. A sincronização entre navegadores também fica fora: o coração continua no `localStorage` até a HU-20.

## Testes por critério

| Critério | Teste |
| --- | --- |
| 1 | Domínio: `ListMyPlaylists` cria e põe primeiro. Integração: `GET /playlists` de conta nova |
| 2 | Domínio: `LikeMusic` e `UnlikeMusic`. Integração: `PUT` e `DELETE /me/liked-musics/:id` e a ordem (a mais recente no topo) |
| 3 | Domínio: as regras da entidade. Integração: `PATCH`, `DELETE`, `PUT …/order`, `POST …/musics` e `POST …/collaborators` dão 409 |
| 4 | Integração: `DELETE /playlists/:id/musics/:musicId` na "Músicas Curtidas" funciona. O descurtir no front é conferido na tela |

## Documentação

`openapi.ts`, o Bruno, `docs/api.md`, `docs/models.md`, `docs/banco-de-dados.md`, `docs/modelo-er.md` (a coluna nova; a imagem do ER também, por ser coluna nova em tabela existente), `frontend/src/lib/api/README.md` e `docs/prompts/prompts.md`.

## Decisões tomadas por mim (Claude)

- A playlist é criada sob demanda (`EnsureLikedSongs`), em vez de num gancho do cadastro. Assim ela existe para contas antigas e do seed sem migração de dados, ao custo de o `GET /playlists` poder criar uma linha.
- A coluna é `liked_by_user_id`, e não um booleano, para o `UNIQUE` garantir uma por conta.
- A cor é fixa (`#D33A2C`, o vermelho do site).
- A branch sai da `feat/HU-19-playlist-colaborativa`, que já tem `canManage`, `canEditMusics` e `addMember` no repositório.
