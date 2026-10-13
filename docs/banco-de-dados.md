# Banco de dados

O banco é um PostgreSQL. Duas ferramentas cuidam dele, cada uma com um papel:

| Ferramenta | Papel | Onde |
| --- | --- | --- |
| **Flyway** | Cria e altera a **estrutura** do banco (tabelas, colunas, constraints), por migrations em SQL | `db/migrations/` |
| **Prisma** | Gera o **client tipado** que a API usa para ler e gravar dados | `api/prisma/` |

Quem manda na estrutura é o Flyway. O Prisma só espelha o que existe no banco: **nunca use `prisma migrate` nem `prisma db push`**, que criariam um segundo histórico de migrations, fora do Flyway.

O modelo de dados está em [Modelo ER](modelo-er.md).

## Migrations (Flyway)

O Flyway roda sozinho a cada `docker compose up`: aplica, em ordem, as migrations de `db/migrations/` que o banco ainda não tem, e registra cada uma na tabela `flyway_schema_history`.

### Nome do arquivo

```
V<AAMMDD>_<HHMMSS>__<Descricao_do_que_a_migration_faz>.sql
```

Exemplo: `V261013_143000__Cria_tabela_de_letras.sql`, criada em 13/10/2026 às 14:30:00.

- Comece com **`V`** maiúsculo.
- Use **dois** underscores (`__`) entre o horário e a descrição: é assim que o Flyway separa a versão do nome.
- A versão vira `261013.143000`, então as migrations rodam na ordem em que foram criadas.
- O `docker-compose.yml` liga o `validateMigrationNaming`: um arquivo fora do padrão faz o Flyway **falhar com erro**, em vez de ser ignorado em silêncio.

A primeira migration, `V1__create_schema.sql`, é anterior a esse padrão e fica com esse nome: renomear uma migration já aplicada quebra os bancos existentes. Como `1` é menor que qualquer data, a ordem continua certa.

### Regras

- **Nunca edite uma migration que já está no `main`.** O Flyway guarda um checksum de cada arquivo aplicado e recusa subir se ele mudar. Para corrigir algo, crie uma migration nova.
- **Dados de teste não entram em migration.** Migrations rodam em todos os ambientes, inclusive produção. Dados fictícios ficam no [seed](#seed).
- **Toda migration nova exige atualizar o Prisma** (próxima seção).

### Criando uma migration

1. Crie o arquivo em `db/migrations/` com o nome no padrão.
2. Aplique no seu banco local:

   ```bash
   docker compose up flyway
   ```

   Se falhar, o log mostra o erro. Corrija o arquivo e rode de novo; se a migration chegou a ser aplicada pela metade, recrie o banco local com `docker compose down -v`.
3. Atualize o Prisma: `bun run db:sync`, em `api/` (próxima seção).

## Prisma

O schema fica em `api/prisma/schema.prisma` e a configuração em `api/prisma.config.ts`, que lê o `DATABASE_URL` do `.env` da raiz. O client gerado vai para `api/generated/prisma/`, que não é versionado.

O `schema.prisma` **é gerado a partir do banco**, pelo `db:sync`. Não é preciso escrever nele as tabelas e colunas novas.

Rode os comandos dentro de `api/`, com o banco no ar:

| Comando | O que faz |
| --- | --- |
| `bun run db:sync` | Lê o banco, atualiza o `schema.prisma` e gera o client. Rode depois de toda migration nova. |
| `bun run db:sync --check` | Só confere: diz se o `schema.prisma` está diferente do banco, mostra a diferença e sai com erro. Bom para rodar antes de abrir um PR. |
| `bun run db:generate` | Só gera o client, sem consultar o banco. Rode depois do `bun install`. |
| `bun run db:format` | Formata o `schema.prisma` (alinhamento e espaços) e valida. |
| `bun run db:validate` | Só valida o `schema.prisma`, sem alterar nada. |

### O que o `db:sync` faz

1. Roda o `prisma db pull`, que lê o banco e reescreve o schema, mantendo os nomes e comentários `///` que já estão no arquivo.
2. Tira o model `flyway_schema_history`, que é do Flyway.
3. Converte o que for novo para o padrão do projeto: a tabela `user_follow` vira `model UserFollow` com `@@map("user_follow")`, e a coluna `created_at` vira `createdAt` com `@map("created_at")`.
4. Formata o arquivo e gera o client.

O script fica em `api/scripts/db-sync.ts`.

### O que continua à mão (opcional)

O `db:sync` lista no terminal os nomes que criou. Dois casos costumam valer um ajuste:

- **Singular/plural:** a tabela `follows` vira `model Follows`. Se preferir `Follow`, renomeie no arquivo.
- **Nomes de relações:** são gerados pelo Prisma e às vezes ficam longos. Quando há duas relações para a mesma tabela, por exemplo, o nome fica parecido com `userFollowUserFollowFollowedIdTouser`; algo como `followers` é mais legível.

Renomeie direto no `schema.prisma` e rode `bun run db:sync` de novo: **o nome escolhido é mantido nos próximos syncs**.

### Comentários

Use `///` para documentar models e campos. Eles são mantidos pelo `db:sync` e aparecem no autocomplete do editor. Comentários com `//` são apagados a cada sync; só o cabeçalho do arquivo, que o próprio script escreve, usa `//`.

## Seed

O seed popula o banco. Fica em `api/prisma/seed/`, com um arquivo por grupo de dados, e roda dentro de `api/`:

| Comando | O que faz |
| --- | --- |
| `bun run db:seed` | **Banco local.** Apaga todos os dados, reinicia os ids e roda os seeders `LOCAL` e `ALL`. Recusa rodar se o `DATABASE_URL` não apontar para `localhost`. |
| `bun run db:seed --env=prod` | **Produção.** Roda só os seeders `PROD` e `ALL`, **sem apagar nada**: insere o que falta e atualiza o que mudou. |

Tudo roda numa transação: se um seeder falhar, nada é gravado.

### Onde cada seeder roda

O arquivo `api/prisma/seed/seeders.ts` lista os seeders, na ordem em que rodam, e o ambiente de cada um:

| Ambiente | Quando roda | Para quê |
| --- | --- | --- |
| `LOCAL` | Só no banco local | Dados fictícios para desenvolver e testar |
| `PROD` | Só em produção | Dados que só fazem sentido em produção |
| `ALL` | Nos dois | Dados reais do produto, como tipos de plano e gêneros |

Os seeders `ALL` e `PROD` comparam pelo nome: inserem o que falta e atualizam o que mudou. Eles **nunca apagam**, então um item retirado da lista continua no banco. Eles também não podem depender de dados criados por um seeder `LOCAL`.

### O que o seed local gera

| Grupo | Ambiente | Conteúdo |
| --- | --- | --- |
| Tipos de plano | `ALL` | Individual, Universitário, Duo e Família, com preço e limite de usuários |
| Gêneros | `ALL` | 10 gêneros, com cor |
| Usuários | `LOCAL` | 20 usuários, 2 com soft delete |
| Planos | `LOCAL` | 11 planos assinados; todo usuário em ao menos um, todo plano com admin e dentro do limite do tipo |
| Catálogo | `LOCAL` | 12 artistas, 12 álbuns e 63 músicas fictícios, com participações (feat) e um álbum em parceria |
| Playlists | `LOCAL` | 10 playlists, públicas e privadas, todas com admin |
| Interações | `LOCAL` | Músicas salvas, avaliações, comentários e eventos |
| Totais do sistema | `ALL` | Recalcula a `system_data` a partir do banco |

Os dados são sempre os mesmos, com os mesmos ids, em todas as máquinas: o que precisa de sorteio usa um gerador com semente fixa. A única exceção é o `created_at` dos dados `ALL`, que registra o momento real da inserção.

`musics.rating` recebe a média das avaliações ativas. Algumas avaliações aparecem trocadas: a antiga com soft delete e uma nova no lugar.

### Criando um seeder

1. Crie o arquivo em `api/prisma/seed/` exportando uma função `Seeder["run"]`, que recebe a transação e devolve um resumo de uma linha.
2. Registre-o em `seeders.ts`, na posição certa da ordem e com o ambiente.
3. Para ligar registros, busque os ids pelo nome (`byName` e `idOf`, em `support.ts`), em vez de fixar ids no código.
4. Rode `bun run db:seed` duas vezes seguidas: o resultado tem que ser o mesmo.

## Vendo o banco

Com o banco no ar (`docker compose up`), use o `psql` de dentro do container:

```bash
docker compose exec db psql -U zovic -d zovic
```

Comandos úteis: `\dt` lista as tabelas, `\d musics` mostra a estrutura de uma tabela e `\q` sai.

Para usar uma interface gráfica (PhpStorm, DataGrip, DBeaver, TablePlus), conecte com os valores do `.env`:

| Campo | Valor padrão |
| --- | --- |
| Host | `localhost` |
| Porta | `5432` |
| Banco | `zovic` |
| Usuário | `zovic` |
| Senha | `zovic` |

No PhpStorm: **View → Tool Windows → Database → + → Data Source → PostgreSQL**. Se as tabelas não aparecerem, abra **Properties → Schemas** na conexão e marque `public`.

Para começar do zero, com o banco vazio e todas as migrations reaplicadas:

```bash
docker compose down -v && docker compose up
```
