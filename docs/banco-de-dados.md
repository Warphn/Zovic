# Banco de dados

O banco é um PostgreSQL. Duas ferramentas cuidam dele:

- **Flyway** cria e altera a estrutura (tabelas, colunas, constraints) com as migrations em SQL de `db/migrations/`.
- **Prisma** gera o client tipado que a API usa para ler e gravar, a partir de `api/prisma/schema.prisma`.

Quem manda na estrutura é o Flyway. O Prisma só espelha o banco: **nunca rode `prisma migrate` nem `prisma db push`**, que criariam um segundo histórico de migrations.

O modelo de dados está em [Modelo ER](modelo-er.md).

## Resumo dos comandos

Os comandos `bun run` rodam em `api/`, e os `docker compose` na raiz. Todos precisam do banco no ar, menos o `db:generate`.

| Comando | O que faz |
| --- | --- |
| `docker compose up flyway` | Aplica no banco local as migrations que ele ainda não tem |
| `bun run db:sync` | Atualiza o `schema.prisma` a partir do banco e gera o client. Rode depois de criar uma migration. |
| `bun run db:sync --check` | Só confere se o `schema.prisma` está igual ao banco. Mostra a diferença e sai com erro se não estiver. |
| `bun run db:generate` | Gera o client a partir do `schema.prisma`, sem consultar o banco. Rode depois do `bun install` e quando o `schema.prisma` mudar num `git pull`. |
| `bun run db:format` e `bun run db:validate` | Formatam e validam o `schema.prisma` |
| `bun run db:seed` | Apaga o banco local e insere os dados de teste |
| `bun run db:seed --env=prod` | Insere só os dados reais, sem apagar nada |
| `docker compose exec db psql -U zovic -d zovic` | Abre o `psql` no banco local |
| `docker compose down -v` | Apaga o banco local. O próximo `bun start` o recria e reaplica todas as migrations. |

## Migrations (Flyway)

O Flyway roda a cada `docker compose up` (e, portanto, a cada `bun start`). Ele aplica, em ordem, as migrations que o banco ainda não tem e registra cada uma na tabela `flyway_schema_history`.

### Criando uma migration

1. Crie o arquivo em `db/migrations/` com o nome no padrão (veja abaixo).
2. Aplique no banco local com `docker compose up flyway`. Se falhar, o log mostra o erro: corrija o arquivo e rode de novo. Se a migration foi aplicada pela metade, apague o banco com `docker compose down -v` e suba de novo.
3. Rode `bun run db:sync` em `api/` e commite o `schema.prisma` junto com a migration.
4. Atualize o [Modelo ER](modelo-er.md), a imagem `docs/assets/modelo-er.png` e esta página, se ela mencionar a tabela.

### Nome do arquivo

```text
V<AAMMDD>_<HHMMSS>__<Descricao_do_que_a_migration_faz>.sql
```

Exemplo: `V261013_143000__Cria_tabela_de_letras.sql`, criada em 13/10/2026 às 14:30:00.

- O nome começa com `V` maiúsculo e tem **dois** underscores (`__`) antes da descrição. É assim que o Flyway separa a versão do nome.
- Como a versão é a data e a hora, as migrations rodam na ordem em que foram criadas.
- Um nome fora do padrão faz o Flyway falhar com erro, em vez de ignorar o arquivo em silêncio (`validateMigrationNaming`, no `docker-compose.yml`).
- A primeira migration, `V1__create_schema.sql`, é de antes do padrão. Ela não pode ser renomeada, porque já foi aplicada. Como `1` é menor que qualquer data, a ordem continua certa.

### Regras

- **Nunca edite uma migration que já está no `main`.** O Flyway guarda um checksum de cada arquivo aplicado e se recusa a subir se ele mudar. Para corrigir algo, crie uma migration nova.
- **Dados de teste não entram em migration**, porque as migrations rodam também em produção. Os dados fictícios ficam no [seed](#seed).
- **O Better Auth não altera o banco.** Nunca rode `better-auth migrate`. Se um recurso novo do Better Auth precisar de tabelas ou colunas, gere o SQL de referência com `bunx @better-auth/cli generate` e escreva uma migration com as convenções do projeto.
- **Extensões do Postgres também entram por migration**, com `CREATE EXTENSION IF NOT EXISTS`. Hoje há uma só, a `unaccent`, que a busca usa para não diferenciar acentos (`V261103_151718__Ativa_unaccent_para_busca.sql`).

## Prisma

O schema fica em `api/prisma/schema.prisma`, e a configuração em `api/prisma.config.ts`, que lê o `DATABASE_URL` do `.env` da raiz. O client gerado vai para `api/generated/prisma/`, que não é versionado.

O `schema.prisma` **é gerado a partir do banco** pelo `db:sync`: não escreva nele as tabelas e colunas novas à mão. O `db:sync` roda o `prisma db pull`, tira o model do Flyway, converte os nomes novos para o padrão do projeto (a tabela `user_follow` vira `model UserFollow`, e a coluna `created_at` vira `createdAt`), formata e gera o client. O script fica em `api/scripts/db-sync.ts`.

### Ajustes à mão (opcionais)

O `db:sync` lista no terminal os nomes que criou. Dois casos costumam valer um ajuste:

- **Singular e plural:** a tabela `follows` vira `model Follows`, e você pode preferir `Follow`.
- **Nomes de relações:** às vezes ficam longos, como `userFollowUserFollowFollowedIdTouser`. Algo como `followers` é mais legível.

Renomeie direto no `schema.prisma` e rode `bun run db:sync` de novo: o nome que você escolheu é mantido nos próximos syncs.

### Comentários

Use `///` para documentar models e campos: eles são mantidos e aparecem no autocomplete do editor. Comentários com `//` são apagados a cada sync.

## Seed

O seed popula o banco. Ele fica em `api/prisma/seed/`, com um arquivo por grupo de dados.

| Comando | O que faz |
| --- | --- |
| `bun run db:seed` | **Banco local.** Apaga todos os dados, reinicia os ids e roda os seeders `LOCAL` e `ALL`. Recusa rodar se o `DATABASE_URL` não apontar para `localhost`. |
| `bun run db:seed --env=prod` | Roda só os seeders `PROD` e `ALL`, **sem apagar nada**: insere o que falta e atualiza o que mudou. |

- **Tudo ou nada:** o seed roda numa transação. Se um seeder falhar, nada é gravado.
- **O `--env` escolhe os seeders, não o banco.** O seed grava sempre no banco do `DATABASE_URL`. Para popular a produção, rode com o `DATABASE_URL` de produção. A opção PROD do `bun start` grava no banco local, e serve para ver o banco como a produção começaria.
- **Sempre igual:** os dados e os ids são os mesmos em todas as máquinas, porque o que precisa de sorteio usa uma semente fixa. A exceção é o `created_at` dos dados `ALL`, que registra o momento real da inserção.

### Onde cada seeder roda

A lista de seeders, na ordem em que rodam e com o ambiente de cada um, fica em `api/prisma/seed/seeders.ts`.

| Ambiente | Onde roda | Para quê |
| --- | --- | --- |
| `LOCAL` | Só no banco local | Dados fictícios para desenvolver e testar |
| `PROD` | Só em produção | Dados que só fazem sentido em produção |
| `ALL` | Nos dois | Dados reais do produto, como os tipos de plano e os gêneros |

Os seeders `ALL` e `PROD` comparam pelo nome e **nunca apagam**: um item tirado da lista continua no banco. Eles também não podem depender de dados de um seeder `LOCAL`.

### O que o seed local cria

| Grupo | Ambiente | Conteúdo |
| --- | --- | --- |
| Tipos de plano | `ALL` | Os tipos do produto, com preço e limite de pessoas (`plan-types.ts`) |
| Gêneros | `ALL` | Os gêneros do produto, com cor (`genres.ts`) |
| Usuários | `LOCAL` | Usuários fictícios, alguns removidos. Todos entram com `nome.sobrenome@zovic.test` e a senha `zovic123`. |
| Planos | `LOCAL` | Todo usuário em ao menos um plano, e todo plano com titular e dentro do limite do tipo |
| Catálogo | `LOCAL` | Artistas, álbuns e músicas fictícios, com participações e um álbum em parceria (`catalog-data.ts`) |
| Playlists | `LOCAL` | Playlists públicas e privadas, todas com admin |
| Interações | `LOCAL` | Músicas salvas, avaliações, comentários e eventos. `musics.rating` recebe a média das avaliações ativas. |
| Admin padrão | `LOCAL` | `admin@zovic.test`, senha `admin`, sem plano. A senha é curta demais para o cadastro e só funciona porque o hash é gravado direto. |
| Totais do sistema | `ALL` | Recalcula a `system_data` a partir do banco |

Os seeders `LOCAL` usam os dados dos `ALL` pelo nome. Se você tirar um gênero de `genres.ts`, por exemplo, troque-o também nas músicas de `catalog-data.ts`. Se um nome ficar sem par, o seed para e diz qual é.

### Criando um seeder

1. Crie o arquivo em `api/prisma/seed/`, exportando uma função `Seeder["run"]`. Ela recebe a transação e devolve um resumo de uma linha.
2. Registre-o em `seeders.ts`, na posição certa da ordem e com o ambiente.
3. Para ligar registros, busque os ids pelo nome (`byName` e `idOf`, em `support.ts`), em vez de fixar ids no código.
4. Rode `bun run db:seed` duas vezes seguidas: o resultado tem de ser o mesmo.

## Vendo o banco local

Pelo terminal, com o banco no ar:

```bash
docker compose exec db psql -U zovic -d zovic
```

No `psql`, `\dt` lista as tabelas, `\d musics` mostra a estrutura de uma tabela e `\q` sai.

Numa interface gráfica (DBeaver, DataGrip, PhpStorm ou TablePlus), conecte em `localhost:5432`, banco `zovic`, usuário `zovic` e senha `zovic`, os valores do `.env`. No PhpStorm, se as tabelas não aparecerem, abra **Properties → Schemas** na conexão e marque `public`.

## Banco de produção

O banco de produção roda no servidor da equipe e só é acessível pelo Cloudflare Access, que libera os emails da equipe. Ele só responde enquanto o servidor estiver no ar.

Peça a quem administra o servidor (Victor) o seu **usuário e senha do Postgres** e a inclusão do seu **email** no Access.

1. Instale o `cloudflared`. No Windows: `winget install --id Cloudflare.cloudflared`. No macOS: `brew install cloudflared`. Para outros sistemas, veja os [downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
2. Na raiz do repositório, rode `bun db:connect` e deixe o terminal aberto enquanto usar o banco. Na primeira vez, ele abre o navegador: informe o seu email e o código que chegar nele. O login vale por 24 horas. Ctrl+C fecha o acesso.
3. Conecte o DBeaver, o DataGrip ou o `psql` em `localhost:15432`, banco `zovic`, com o seu usuário e a sua senha:

   ```bash
   psql -h localhost -p 15432 -U <seu-usuario> -d zovic
   ```

Sem o repositório, o mesmo acesso é aberto com `cloudflared access tcp --hostname db.zovic.com.br --url localhost:15432`.

O que o seu usuário pode fazer:

- Ler e alterar dados (`SELECT`, `INSERT`, `UPDATE` e `DELETE`) em todas as tabelas, menos `session`, `account` e `verification`, que guardam tokens e hashes de senha.
- Não pode mudar o schema (`CREATE`, `ALTER` e `DROP`). Isso é papel das migrations.
- Até 3 conexões ao mesmo tempo, consultas de até 60 segundos e transações paradas por até 5 minutos.

> **Cuidado:** são os dados reais dos usuários. Um `UPDATE` ou `DELETE` sem `WHERE` não tem volta. Teste a consulta com um `SELECT` antes e, para mudar várias linhas, use uma transação (`BEGIN`, depois `COMMIT`, ou `ROLLBACK` para desistir).

Se algo não funcionar, veja os [problemas comuns](servidor.md#problemas-comuns) do guia do servidor.
