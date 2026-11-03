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

    user ||--o{ session : "abre"
    user ||--o{ account : "autentica por"
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
        string email
        bool email_verified
        string image
        datetime deleted_at
        datetime created_at
        datetime updated_at
    }
    session {
        int id PK
        int user_id FK
        string token
        datetime expires_at
        string ip_address
        string user_agent
        datetime created_at
        datetime updated_at
    }
    account {
        int id PK
        int user_id FK
        string account_id
        string provider_id
        string password
        string access_token
        string refresh_token
        string id_token
        datetime access_token_expires_at
        datetime refresh_token_expires_at
        string scope
        datetime created_at
        datetime updated_at
    }
    verification {
        int id PK
        string identifier
        string value
        datetime expires_at
        datetime created_at
        datetime updated_at
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
| `user` | `id`, `name`, `birthdate`, `email`, `email_verified`, `image`, `deleted_at`, `created_at`, `updated_at` | Também é a tabela de usuário do Better Auth (ver [Autenticação](#autenticação)) |
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

### Autenticação

Tabelas exigidas pelo [Better Auth](https://www.better-auth.com), adicionadas pela migration `V261020_162546__Adota_Better_Auth.sql`. O Flyway continua dono do schema; o Better Auth só lê e grava. Os ids são inteiros gerados pelo banco, e as colunas em snake_case são mapeadas no código (`api/adapters/auth/create-auth.ts`).

| Tabela | Colunas | Relacionamentos |
|---|---|---|
| `user` (colunas novas) | `email`, `email_verified`, `image`, `updated_at` | `email` é único e sempre em minúsculas (CHECK). É `NULL` nos usuários anteriores ao Better Auth, que não têm credenciais e por isso não conseguem entrar. O email de um usuário com soft delete continua reservado |
| `session` | `id`, `user_id`, `token`, `expires_at`, `ip_address`, `user_agent`, `created_at`, `updated_at` | `user_id` → `user.id` (`ON DELETE CASCADE`); `token` é único e é o valor (assinado) do cookie de sessão |
| `account` | `id`, `user_id`, `account_id`, `provider_id`, `password`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `created_at`, `updated_at` | `user_id` → `user.id` (`ON DELETE CASCADE`); uma linha por forma de login. Email e senha usam `provider_id = 'credential'` e `account_id` igual ao id do usuário, com o hash em `password`; (`provider_id`, `account_id`) é único. Login social entra como outra linha, sem mudar o schema |
| `verification` | `id`, `identifier`, `value`, `expires_at`, `created_at`, `updated_at` | Sem FK. Guarda os tokens de confirmação de email e de recuperação de senha, que ainda não são usados |

## Convenções

- Tabelas com `deleted_at` usam *soft delete*.
- As tabelas registram só `created_at` (e `deleted_at`, quando aplicável); o modelo não tem `updated_at`. As exceções são as tabelas do Better Auth (`user`, `session`, `account` e `verification`), que têm `updated_at` porque o Better Auth atualiza esses registros.
- Tabelas associativas (N:N) não têm `id` próprio; a chave primária é composta pelas duas FKs.
- As estatísticas de uma música (`streams` e `rating`, a média das avaliações) ficam na própria `musics`, e não numa tabela separada.
- `system_data` é uma tabela de linha única: guarda os totais agregados do sistema (usuários, músicas e playlists) e é sempre atualizada no lugar, nunca recebe novas linhas. Por isso não tem `id` de negócio nem relacionamentos. No banco, ela ganhou uma coluna `singleton`, sempre `true`, que é a chave primária: um CHECK impede outro valor, então um segundo `INSERT` falha. A coluna também serve de identificador para o Prisma, que exige um em toda tabela. A migration já cria a linha, com os totais zerados.

## Pontos em aberto

- Letras: `musics.lyrics_id` existe, mas ainda não há tabela de letras. A forma de armazenar o texto das letras ainda não foi decidida.
