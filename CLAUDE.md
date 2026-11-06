# Zovic

Plataforma de streaming de música feita para a disciplina de Engenharia de Software (Poli-USP) por 5 integrantes. A entrega final e a apresentação são em **24/11/2026**. Stack: API em Bun + Express + PostgreSQL (migrações Flyway em `db/migrations`, auth com Better Auth) e front em Next.js (`frontend/`).

## Organização do projeto (board, issues, branches e commits)

Esta seção vale para qualquer integrante que use o Claude para mexer no board, escrever issues, commitar ou abrir PRs. O board não é só controle interno: o `main.pdf` de histórias de usuário, avaliado pela professora, é gerado a partir das issues. Uma issue fora do padrão vira um erro no documento entregue.

### Hierarquia

| Nível | Onde fica | Exemplo |
| --- | --- | --- |
| Milestone | "Entrega final" (24/11) | Toda issue nova entra nele |
| Épico | Issue com label `épico`. É uma seção do `main.pdf` | #75 Épico: Autenticação e assinaturas |
| Funcionalidade | Issue com label `história`, sub-issue do épico. Contém as histórias | #86 Plano familiar (HU-04 a HU-07) |
| História | Seção `#### HU-NN · Nome` dentro da funcionalidade | HU-05 · Convidar membros para o plano |
| Tarefa técnica | Sub-issue opcional da funcionalidade. Não vai para o PDF | Migração da tabela de convites |
| PR | Fecha a funcionalidade com `Closes #N`, ou entrega parte com `Refs #N` | |

Épicos atuais: #75 Autenticação e assinaturas, #76 Catálogo e pesquisa, #77 Reprodução, #78 Playlists, #79 Comentários e avaliações, #80 Perfil e recomendações, #81 Plataforma de administração, #82 Letras (P2), #83 Entregáveis da disciplina. As funcionalidades vão de #84 a #101, e os entregáveis (`chore`) de #102 a #106.

### Labels

Só existem seis: `épico`, `história`, `chore`, `bug`, `bloqueado` e `acessibilidade`. Não crie labels novas, nem de camada (frontend/backend) nem de domínio. A área já aparece no épico pai.

### Formato das histórias

O script do `main.pdf` depende deste formato. Não mude a estrutura:

```markdown
#### HU-NN · Nome curto no infinitivo

Como **papel**, quero ação, para benefício.

**Regras**

- Uma regra de negócio por item.

**Critérios de aceite**

- [ ] Dado um contexto, quando uma ação acontece, então um resultado verificável.
```

- **IDs:** `HU-NN` é sequencial e único. Uma história nova recebe o próximo número livre (hoje, HU-33). Um ID nunca é reutilizado nem renumerado, mesmo se a história sair do escopo.
- **Papéis:** use só os do glossário: visitante, usuário, assinante, gestor do plano, membro do plano e admin.
- **Critérios:** cada um vira pelo menos um teste, unitário no domínio ou de integração na API. Marque o checkbox quando o teste existir ou o critério tiver sido conferido na tela.
- **Mudança de regra:** edite a história na issue e avise o time. A issue é a fonte da verdade, e o documento de planejamento é só o histórico das decisões.

O corpo de uma funcionalidade tem, nesta ordem: a linha `**Épico:** … · **Responsável:** … · **Prioridade:** …`, um resumo de uma ou duas frases, as histórias, `### Checklist técnica` e, se houver, `### Fora do escopo`.

### Project (board)

- **Endereço:** https://github.com/users/Warphn/projects/1. O `gh` precisa do escopo `project`: `gh auth refresh -h github.com -s project`.
- **Campos:** Status (Backlog, Pronto, Em andamento, Em revisão, Feito), Prioridade (P0 = requisito da disciplina, P1 = decidido pelo time, P2 = só se sobrar tempo), Sprint (semanal, de terça a segunda) e Assignees.
- **Views:** Issues (tabela geral), Board (sprint atual por Status) e Epic (funcionalidades agrupadas por épico). A API não edita views: mudanças nelas são feitas no navegador.
- **Automações já ativas:** toda issue ou PR do repositório entra no board sozinha, e as sub-issues também. PR ligado vai para Em revisão, issue fechada ou PR mergeado vai para Feito, e reaberta volta para Em andamento. Não mova o Status à mão quando a automação já faz isso.
- **Quando mudar o Status à mão:** Backlog → Pronto (critérios escritos, responsável definido, nada bloqueando) e Pronto → Em andamento (alguém começou).

Para mudar um campo pelo terminal, busque os IDs na hora, porque as opções mudam de ID se alguém editar o campo:

```sh
# IDs dos campos e das opções
gh api graphql -f query='query{node(id:"PVT_kwHOCpTh2c4BiJh9"){... on ProjectV2{fields(first:30){nodes{... on ProjectV2FieldCommon{id name} ... on ProjectV2SingleSelectField{options{id name}} ... on ProjectV2IterationField{configuration{iterations{id title}}}}}}}}'

# ID do item de uma issue no board
gh api graphql -f query='query{repository(owner:"Warphn",name:"Zovic"){issue(number:86){projectItems(first:5){nodes{id}}}}}'

# Mudar um campo de seleção (para Sprint, use {iterationId:"..."})
gh api graphql -f query='mutation{updateProjectV2ItemFieldValue(input:{projectId:"PVT_kwHOCpTh2c4BiJh9",itemId:"<item>",fieldId:"<campo>",value:{singleSelectOptionId:"<opção>"}}){clientMutationId}}'

# Ligar uma sub-issue ao pai
gh api -X POST repos/Warphn/Zovic/issues/<pai>/sub_issues -F sub_issue_id=$(gh api repos/Warphn/Zovic/issues/<filha> -q .id)
```

### Responsáveis por épico

| Épico | Pessoa | GitHub |
| --- | --- | --- |
| Autenticação e assinaturas, Perfil e recomendações | Gabriel | z0cal |
| Catálogo e pesquisa | Carlos | caduvt |
| Reprodução, Playlists | Victor | Warphn |
| Comentários e avaliações | Caio | CaioNassar |
| Plataforma de administração, Entregáveis | Felipe | Felarg |

Todos podem trabalhar em qualquer área. O responsável é a referência para dúvidas e revisa as mudanças nas histórias da área dele.

### Branches, commits e PRs

- **Branch:** `tipo/HU-NN-descricao-curta`, como `feat/HU-05-convite-plano`. Sem história: `fix/player-volume` ou `chore/dump-banco`.
- **Commit:** todo commit segue o [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/), em português (veja "Commits" logo abaixo).
- **PR:** o título segue o formato do commit e termina com as histórias, como `feat(plano): convite de uso único (HU-05)`. O corpo diz o que muda, lista os critérios de aceite entregues e traz `Closes #N` (funcionalidade inteira) ou `Refs #N` (parte dela). Cada PR precisa da aprovação de outra pessoa, de preferência em até 24 horas.
- **Merge:** squash, para o `main` ficar com um commit por PR, com o número do PR no fim.
- **Documentação no mesmo PR:** o PR que entrega uma task também atualiza a documentação que ela afeta (veja "Documentação junto com o código"). Um PR que muda comportamento sem atualizar a doc não está pronto para revisão.

### Commits (Conventional Commits)

Formato:

```text
tipo(escopo): descrição curta

Corpo opcional: por que a mudança foi feita e o que muda para quem usa.

Refs #86
```

| Tipo | Quando usar |
| --- | --- |
| `feat` | Funcionalidade nova ou comportamento novo para o usuário |
| `fix` | Correção de bug |
| `refactor` | Mudança de código sem mudar o comportamento |
| `test` | Só testes: novos ou corrigidos |
| `docs` | Só documentação |
| `style` | Só formatação, sem mudar a lógica |
| `perf` | Melhoria de desempenho |
| `build` | Dependências, Docker, configuração de build |
| `ci` | Workflows do GitHub Actions e hooks |
| `chore` | Manutenção que não se encaixa nos outros tipos (scripts, seed, limpeza) |

- **Escopo:** a área que a mudança toca, em minúsculas: `api`, `frontend`, `db`, `auth`, `plano`, `catalogo`, `busca`, `player`, `playlist`, `comentarios`, `historico`, `recomendacao`, `admin`, `infra`. Use um escopo só. Se a mudança precisa de dois escopos, provavelmente são dois commits.
- **Descrição:** no presente, começando com letra minúscula e sem ponto final, em até 72 caracteres. Ela completa a frase "este commit…": `adiciona`, `corrige`, `remove`.
- **Corpo:** opcional, separado da primeira linha por uma linha em branco. Explica o porquê, não repete o diff.
- **Rodapé:** `Refs #N` liga o commit à issue. O `Closes #N` fica no corpo do PR, porque o merge é squash. Uma mudança que quebra quem usa a API ou o banco leva `!` depois do tipo (`feat(api)!: …`) e um rodapé `BREAKING CHANGE: o que quebrou e como migrar`.
- **Um commit, uma mudança:** um commit não mistura refatoração, funcionalidade e formatação. Um commit "wip" ou "ajustes" não entra no `main`: reescreva a mensagem antes do PR, ou deixe o squash resolver com um título de PR correto.

Exemplos:

| Certo | Errado |
| --- | --- |
| `feat(plano): adiciona convite de uso único com validade de 7 dias` | `convites` |
| `fix(player): corrige marca de ouvida antes dos 30 segundos` | `Fix: Bug no player.` |
| `refactor(busca): extrai a consulta de álbuns para o adaptador` | `refactor e nova busca de álbum` |
| `docs(api): atualiza openapi com as rotas de convite` | `update docs` |
| `test(plano): cobre o limite de 4 pessoas no plano familiar` | `testes` |

### Instruções para o Claude

- **Antes de qualquer ação no GitHub, confirme com quem pediu e mostre o que será feito.** Isso vale para criar, editar ou fechar issues, mudar o board, criar ou apagar labels, commitar e abrir PRs. O board é compartilhado pelos 5 integrantes.
- **Ao implementar uma história:** leia a issue da funcionalidade (`gh issue view <N>`), use os critérios de aceite como lista de testes e respeite as regras escritas. Se o código exigir mudar uma regra, pare e proponha a mudança na história em vez de divergir dela em silêncio.
- **Ao escrever código:** siga "Padrões de código" e rode as verificações de "Antes de commitar". Ao preparar um commit, confira na tabela de "Documentação junto com o código" o que precisa ser atualizado, e inclua essas mudanças.
- **Ao commitar:** escreva a mensagem no formato de "Commits (Conventional Commits)" e mostre a mensagem antes de commitar. Se as mudanças pedem mais de um tipo ou escopo, proponha dividir em mais de um commit.
- **Ao criar uma issue:** use o formato desta seção, coloque o milestone "Entrega final", uma das seis labels e o épico pai (como sub-issue). Bug não precisa de HU, mas precisa dos passos para reproduzir e do resultado esperado.
- **Ao fechar uma issue duplicada ou substituída:** comente com o link da issue que fica e feche como "not planned".
- **Escopo:** modo offline, Kafka, filtros dedicados na busca, pagamento real e envio de email estão fora do escopo desta entrega. Não crie issues para eles sem o time decidir.

## Documentação junto com o código

Ao commitar uma task, atualize no mesmo PR a documentação que ela muda. A doc desatualizada também vale nota: o README, o ER e o modelo de arquitetura são entregáveis da disciplina.

| Se a task muda… | Atualize |
| --- | --- |
| Uma rota da API (nova, removida, ou com outro corpo, resposta ou erro) | `api/adapters/http/openapi.ts`, a requisição correspondente em `api/bruno/` e a tabela de rotas em `docs/api.md` |
| O banco (migração nova em `db/migrations`) | `docs/banco-de-dados.md`, `docs/modelo-er.md`, a imagem `docs/assets/modelo-er.png` e, se houver tabela nova, a área dela em `GROUPS` no `api/scripts/db-erd.ts` (o `.d2` e o `.svg` são gerados e commitados pelo CI no push) |
| Uma entidade do domínio | `docs/models.md` |
| Como subir, configurar ou rodar o projeto (variável de ambiente, script, Docker) | `README.md` e `docs/docker.md` |
| O servidor de produção (profile `prod`, Cloudflare, `bun server`, `db:member`, `db:connect`) | `docs/servidor.md` |
| O fluxo do admin ou as contas de teste do seed | A seção do fluxo do admin no `README.md` |
| O cliente da API no front | `frontend/src/lib/api/README.md` |
| Uma regra de negócio ou um critério de aceite | A história na issue da funcionalidade |
| Um arquivo novo em `docs/` | O índice em `docs/README.md` |

- **Uso de IA:** se a task foi feita com ajuda de IA num trecho relevante (schema, módulo inteiro, diagrama), registre o prompt e o resultado em `docs/prompts/prompts.md`, no formato que já está lá.
- **Escrita:** a doc diz o que o código faz hoje, não o histórico de mudanças. Ela é escrita em português, com frases curtas e exemplos reais.

## Padrões de código

Programe priorizando os fundamentos de engenharia de software. Na revisão de PR, estes pontos pesam tanto quanto o código funcionar.

### Legibilidade

- **Nomes descritivos, nunca de uma letra só.** Isso vale também em callbacks, laços e `catch`: `users.map((user) => user.email)`, `for (const playlist of playlists)`, `catch (error)`. Evite abreviações (`usr`, `pl`, `tmp`, `res2`).
- **O nome diz o que a coisa é ou faz:** `isAdult`, `countActiveMembers`, `invitationExpiresAt`. Booleanos começam com `is`, `has` ou `can`.
- **Idioma:** os identificadores ficam em inglês, como no resto do código. Comentários, mensagens de erro para o usuário e documentação ficam em português.
- **Comentários explicam o porquê, não o quê.** Se for preciso comentar o que um trecho faz, renomeie ou extraia uma função.
- **Números e textos com significado viram constantes nomeadas:** `MAX_FAMILY_MEMBERS = 4` e `LISTENED_THRESHOLD_SECONDS = 30`, não `4` e `30` soltos.

### Organização

- **A API segue portas e adaptadores.** As regras de negócio ficam em `api/domain` (entidades, casos de uso, erros e portas) e não importam Express, Prisma nem Better Auth. O HTTP, o banco e a autenticação ficam em `api/adapters`. A rota só valida a entrada, chama o caso de uso e traduz a resposta.
- **No front, a regra de negócio fica na API.** Um componente só exibe e coleta dados. Uma restrição como idade ou limite do plano é verificada na API, mesmo quando a tela também a mostra.
- **Uma responsabilidade por função e por arquivo.** Uma função que precisa de "e" para ser descrita ("valida e salva e notifica") deve ser dividida.
- **Siga o padrão que já existe na pasta.** Antes de criar um arquivo, veja como os vizinhos se organizam e se nomeiam.

### Simplicidade

- **Escreva a solução mais simples que atende aos critérios de aceite.** Não crie abstração, configuração ou parâmetro para um uso futuro hipotético.
- **Prefira repetir duas linhas a criar uma abstração prematura.** Extraia quando o mesmo trecho aparecer pela terceira vez, ou quando a regra precisar ter um lugar só.
- **Nenhuma dependência nova sem combinar com o time.**
- **Nada de código morto, comentado ou de debug** (`console.log`) no PR.

### Antes de commitar

- Na API: `bun run test`, `bun run lint` e `bun run typecheck`, dentro de `api/`. Se a task mexe no banco ou nas rotas, rode também `bun run test:integration`.
- No front: `bun run lint` e `bun run test`, dentro de `frontend/`.
- Cada critério de aceite da história tem pelo menos um teste: unitário em `api/domain` ou de integração em `api/adapters`.
