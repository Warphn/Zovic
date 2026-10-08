# Modelo Entidade-Relacionamento — Zovic

Documentação do modelo de dados, transcrita do diagrama `Zovic2.drawio`.

![Diagrama ER do Zovic](assets/modelo-er.png)

> Os tipos das colunas no diagrama Mermaid foram inferidos pelo nome do campo (o diagrama original não especifica tipos). Ajuste conforme a implementação real.

## Diagrama

```mermaid
erDiagram
    plan_type ||--|{ plan : "classifica"
    plan ||--|{ plan_user : "possui"
    user ||--|{ plan_user : "assina"

    user ||--o{ user_event : "gera"
    user ||--o{ playlist_user : "participa"
    playlists ||--|{ playlist_user : "tem membros"
    user ||--o{ music_user : "salva"
    musics ||--o{ music_user : "salva por"

    user ||--o{ rating : "avalia"
    musics ||--o{ rating : "recebe"
    user ||--o{ comments : "escreve"
    musics ||--o{ comments : "recebe"

    playlists ||--o{ music_playlist : "contém"
    musics ||--o{ music_playlist : "salva em"

    musics ||--o{ genre_music : "tem"
    genre ||--o{ genre_music : "classifica"
    genre ||--o{ album_genre : "classifica"
    album ||--o{ album_genre : "tem"

    musics ||--o{ album_music : "está em"
    album ||--o{ album_music : "lança"
    album ||--|{ album_artist : "de"
    artist ||--o{ album_artist : "lança"
    musics ||--|{ artist_music : "de"
    artist ||--o{ artist_music : "cria"

    plan_type {
        int id PK
        string name
        decimal price
        int user_amount
        datetime deleted_at
        datetime created_at
    }
    plan {
        int id PK
        string name
        int type_id FK
        datetime deleted_at
        datetime created_at
    }
    plan_user {
        int plan_id FK
        int user_id FK
        bool is_admin
    }
    user {
        int id PK
        string name
        date birthdate
        datetime deleted_at
        datetime created_at
    }
    user_event {
        int id PK
        int user_id FK
        enum event_type
        datetime created_at
    }
    playlist_user {
        int playlist_id FK
        int user_id FK
        bool is_admin
    }
    music_user {
        int music_id FK
        int user_id FK
        datetime created_at
        datetime deleted_at
    }
    system_data {
        int users "tabela de linha única"
        int songs
        int playlists
        datetime created_at
    }
    rating {
        int id PK
        int music_id FK
        int user_id FK
        int rating
        datetime deleted_at
        datetime created_at
    }
    comments {
        int id PK
        int music_id FK
        int user_id FK
        string comment
        int timestamp "segundos"
        datetime deleted_at
        datetime created_at
    }
    playlists {
        int id PK
        string name
        bool is_private
        string color
        datetime deleted_at
        datetime created_at
    }
    music_playlist {
        int music_id FK
        int playlist_id FK
    }
    musics {
        int id PK
        string name
        int duration
        int lyrics_id "armazenamento ainda não definido"
        int streams
        float rating
        datetime created_at
        datetime deleted_at
    }
    genre_music {
        int genre_id FK
        int music_id FK
    }
    genre {
        int id PK
        string name
        string color
        datetime created_at
        datetime deleted_at
    }
    album_genre {
        int genre_id FK
        int album_id FK
    }
    album {
        int id PK
        string name
        datetime created_at
        datetime deleted_at
    }
    album_music {
        int album_id FK
        int music_id FK
    }
    album_artist {
        int album_id FK
        int artist_id FK
    }
    artist {
        int id PK
        string name
        datetime created_at
        datetime deleted_at
    }
    artist_music {
        int artist_id FK
        int music_id FK
    }
```

## Entidades

### Planos e usuários

| Tabela | Colunas | Relacionamentos |
|---|---|---|
| `plan_type` | `id`, `name`, `price`, `user_amount`, `deleted_at`, `created_at` | 1:N com `plan` (todo tipo tem ao menos um plano) |
| `plan` | `id`, `name`, `type_id`, `deleted_at`, `created_at` | `type_id` → `plan_type.id` |
| `plan_user` | `plan_id`, `user_id`, `is_admin` | Associativa `plan` ↔ `user`; todo plano tem ao menos um usuário, e todo usuário assina ao menos um plano |
| `user` | `id`, `name`, `birthdate`, `deleted_at`, `created_at` | — |
| `user_event` | `id`, `user_id`, `event_type` (ENUM), `created_at` | `user_id` → `user.id` |
| `system_data` | `users`, `songs`, `playlists`, `created_at` | Tabela de linha única com contagens agregadas do sistema (sem `id` e sem FK) |

### Interações do usuário com músicas

| Tabela | Colunas | Relacionamentos |
|---|---|---|
| `music_user` | `music_id`, `user_id`, `created_at`, `deleted_at` | Associativa `musics` ↔ `user` (músicas salvas) |
| `rating` | `id`, `music_id`, `user_id`, `rating`, `deleted_at`, `created_at` | `music_id` → `musics.id`, `user_id` → `user.id` |
| `comments` | `id`, `music_id`, `user_id`, `comment`, `timestamp` (segundos), `deleted_at`, `created_at` | `music_id` → `musics.id`, `user_id` → `user.id` |

### Playlists

| Tabela | Colunas | Relacionamentos |
|---|---|---|
| `playlists` | `id`, `name`, `is_private`, `color`, `deleted_at`, `created_at` | — |
| `playlist_user` | `playlist_id`, `user_id`, `is_admin` | Associativa `playlists` ↔ `user`; toda playlist tem ao menos um membro |
| `music_playlist` | `music_id`, `playlist_id` | Associativa `musics` ↔ `playlists` |

### Catálogo musical

| Tabela | Colunas | Relacionamentos |
|---|---|---|
| `musics` | `id`, `name`, `duration`, `lyrics_id`, `streams`, `rating`, `created_at`, `deleted_at` | `streams` e `rating` são estatísticas da música; `lyrics_id` ainda não referencia nenhuma tabela |
| `genre` | `id`, `name`, `color`, `created_at`, `deleted_at` | — |
| `genre_music` | `genre_id`, `music_id` | Associativa `genre` ↔ `musics` |
| `album` | `id`, `name`, `created_at`, `deleted_at` | — |
| `album_genre` | `genre_id`, `album_id` | Associativa `genre` ↔ `album` |
| `album_music` | `album_id`, `music_id` | Associativa `album` ↔ `musics` |
| `artist` | `id`, `name`, `created_at`, `deleted_at` | — |
| `album_artist` | `album_id`, `artist_id` | Associativa `album` ↔ `artist`; todo álbum tem ao menos um artista |
| `artist_music` | `artist_id`, `music_id` | Associativa `artist` ↔ `musics`; toda música tem ao menos um artista |

## Convenções

- Tabelas com `deleted_at` usam *soft delete*.
- As tabelas registram só `created_at` (e `deleted_at`, quando aplicável); o modelo não tem `updated_at`.
- Tabelas associativas (N:N) não têm `id` próprio; a chave primária é composta pelas duas FKs.
- As estatísticas de uma música (`streams` e `rating`, a média das avaliações) ficam na própria `musics`, e não numa tabela separada.
- `system_data` é uma tabela de linha única: guarda os totais agregados do sistema (usuários, músicas e playlists) e é sempre atualizada no lugar, nunca recebe novas linhas. Por isso não tem `id` nem relacionamentos. Recomenda-se garantir a unicidade no próprio banco, por exemplo com uma constraint ou trigger que impeça um segundo `INSERT`.

## Pontos em aberto

- Letras: `musics.lyrics_id` existe, mas ainda não há tabela de letras. A forma de armazenar o texto das letras ainda não foi decidida.
