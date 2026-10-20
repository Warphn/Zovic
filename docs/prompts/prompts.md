# Uso de IA no projeto

## Por que usamos IA

Usamos um assistente de IA (Claude Code) para acelerar tarefas repetitivas e mecânicas, como transcrever diagramas, escrever código de configuração e gerar o schema do banco. Assim, a equipe gasta o tempo nas decisões de modelagem e de produto.

A IA não decide nada sozinha:

- as decisões de modelagem são da equipe; a IA só transcreve e implementa o que foi definido;
- todo resultado é revisado por alguém da equipe antes de entrar no repositório;
- os prompts ficam registrados aqui, para deixar claro o que foi gerado com IA e a partir de quê.

## Registro de prompts

### 06/10/2026: modelo ER e banco de dados

Ponto de partida: o diagrama ER que a equipe fez no draw.io. A imagem abaixo é a versão atual (`Zovic2.drawio`); os prompts desta data partiram da primeira versão (`Zovic.drawio`).

![Diagrama ER do Zovic](../assets/modelo-er.png)

| # | Prompt | Resultado |
|---|---|---|
| 1 | Consegue transformar essa relação de ER em um arquivo .md para colocar no repositório? *(com a imagem acima anexada)* | [`docs/modelo-er.md`](../modelo-er.md) |
| 2 | Atualize o md: `album_genre` tem `album_id`; trocamos `gender` por `genre`; `lyrics` não tem coluna de conteúdo (ex.: `text`), porque ainda não decidimos como armazenar essa informação; `system_data` não tem `id`; se for tabela de linha única, documente essa escolha. | Correções em [`docs/modelo-er.md`](../modelo-er.md) |

O conteúdo gerado não foi o resultado final, apenas um passo intermediário para a criação do banco de dados

### 13/10/2026: seeders do banco

| # | Prompt | Resultado |
|---|---|---|
| 1 | Escreva os seeders em `api/prisma/seed/`, com um arquivo por grupo: planos, usuários, catálogo, interações e playlists. O seed deve poder rodar várias vezes (limpa as tabelas e zera os IDs antes de inserir), gerar sempre os mesmos dados e se recusar a rodar se o `DATABASE_URL` não apontar para `localhost`. Respeite as regras do modelo: toda música e todo álbum com ao menos um artista; todo plano com ao menos um usuário, e todo usuário com ao menos um plano; toda playlist com ao menos um membro e um admin; notas de 1 a 5, com uma avaliação ativa por usuário e música; cores no formato `#RRGGBB`. `musics.rating` deve ser a média real das avaliações, e `system_data` deve terminar com os totais corretos. Os dados do catálogo são fictícios e escritos à mão. Planos e gêneros também vão para produção: deixe em um arquivo as opções `LOCAL`, `PROD` e `ALL` para definirmos onde cada seeder roda. | [`api/prisma/seed/`](../../api/prisma/seed/) |
| 2 | Escreva a documentação do banco de dados em `docs/banco-de-dados.md`: o papel do Flyway e do Prisma, o padrão de nome das migrations, como criar uma migration e atualizar o Prisma, como rodar o seed e como ver o banco. | [`docs/banco-de-dados.md`](../banco-de-dados.md) |
| 3 | Revise a documentação do projeto e atualize o que estiver desatualizado em relação ao que foi feito. | Ajustes no [`README.md`](../../README.md), em [`docs/README.md`](../README.md), [`docs/docker.md`](../docker.md), [`docs/modelo-er.md`](../modelo-er.md) e no `.env.example` |

Depois, a equipe revisou e ajustou os dados gerados: os tipos de plano e os preços (ficaram Individual e Família), a lista de gêneros e suas cores, e os planos de cada usuário.

### 20/10/2026: entidades do catálogo, documentação das models e testes

| # | Prompt                                                                                                                                                                                                               | Resultado |
|---|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---|
| 1 | Vamos começar um `models.md` para explicar como funcionam as models e todas as funções de cada model (tabela com o nome e a explicação).                                                                             | [`docs/models.md`](../models.md) |
| 2 | Configure para que todo push rode os testes antes, para conferir se eles estão quebrando, e mostre no terminal que os testes passaram.                                                                               | Hook [`.husky/pre-push`](../../.husky/pre-push), script `test` no `frontend/package.json` e seção "Testes" no [`README.md`](../../README.md) |
| 3 | Faltam testes de soft delete: só o Genre confere que `findById` não devolve registro apagado. Cubra também Music (`findById` e `findByIds`), Album e Artist com base no código que eu já fiz para as outras classes. | Novos testes em [`postgres-catalog-repositories.test.ts`](../../api/adapters/db/postgres-catalog-repositories.test.ts) |
| 4 | Crie um CI no GitHub Actions que rode os testes da api e do frontend em todo push e PR para a `main`, incluindo os testes de integração com Postgres e as migrations do Flyway. Aproveite e remova o que sobrou do GitBook. | Workflow [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) e remoção do `docs/SUMMARY.md` (o índice foi para o [`docs/README.md`](../README.md)) |
