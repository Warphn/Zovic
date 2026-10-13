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
- **Dados de teste não entram em migration.** Migrations rodam em todos os ambientes, inclusive produção. Dados fictícios ficam no seed do Prisma (em construção).
- **Toda migration nova exige atualizar o Prisma** (próxima seção).

### Criando uma migration

1. Crie o arquivo em `db/migrations/` com o nome no padrão.
2. Aplique no seu banco local:

   ```bash
   docker compose up flyway
   ```

   Se falhar, o log mostra o erro. Corrija o arquivo e rode de novo; se a migration chegou a ser aplicada pela metade, recrie o banco local com `docker compose down -v`.
3. Atualize o Prisma, como abaixo.

## Prisma

O schema fica em `api/prisma/schema.prisma` e a configuração em `api/prisma.config.ts`, que lê o `DATABASE_URL` do `.env` da raiz. O client gerado vai para `api/generated/prisma/`, que não é versionado.

Rode os comandos dentro de `api/`:

| Comando | O que faz |
| --- | --- |
| `bun run db:generate` | Gera o client tipado a partir do `schema.prisma`. Rode depois do `bun install` e sempre que o schema mudar. |
| `bun run db:format` | Formata o `schema.prisma` (alinhamento e espaços) e valida. |
| `bun run db:validate` | Só valida o `schema.prisma`, sem alterar nada. Não consulta o banco. |
| `bun run db:pull` | Lê o banco e imprime o schema equivalente, **sem sobrescrever** o arquivo. Serve para conferir se o `schema.prisma` está igual ao banco. |

### Depois de uma migration nova

1. Edite o `schema.prisma` com a mudança, mantendo o padrão do arquivo: models em PascalCase e campos em camelCase, ligados aos nomes reais com `@@map` e `@map`.
2. Rode `bun run db:format`.
3. Rode `bun run db:pull` e compare com o seu arquivo. A saída sempre traz três coisas que **não** são diferenças:
   - o model `flyway_schema_history`, que é do Flyway e não entra no `schema.prisma`;
   - avisos de que o Prisma reaproveitou os `@map`/`@@map` do arquivo atual;
   - a lista de CHECK constraints, que o Prisma não representa e existem só no SQL.

   Qualquer outra diferença é algo que faltou no `schema.prisma`.
4. Rode `bun run db:generate`.

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
