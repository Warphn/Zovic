# Playlist colaborativa (HU-19) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** o dono adiciona e remove colaboradores pelo email. O colaborador mexe nas músicas e pode sair, mas não gerencia a playlist.

**Arquitetura:**
- **Banco:** o colaborador é um membro sem `is_admin` em `playlist_user`, então não há migração.
- **Domínio:** um `findMusicEditablePlaylist` (é membro) troca o `findEditablePlaylist` (é admin) nos três casos de uso de música. Três casos de uso novos gerenciam os colaboradores, com `UserRepository.findByEmail` e `SubscriptionRepository.findActiveByUser`.
- **Front:** o `canEdit` se divide em `canManage` e `canEditMusics`, e um diálogo "Colaboradores" entra na página da playlist.

**Tecnologias:** Bun, Express, Joi, PostgreSQL, Next.js com React Query, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-11-15-playlist-colaborativa-design.md`

## Restrições globais

- **Códigos de erro, pelo `error-handler`:** `ForbiddenError` dá 403, `NotFoundError` dá 404, `BusinessRuleError` dá 409 e `ValidationError` dá 400.
- **Portas e adaptadores:** `api/domain` não importa Express nem `pg`.
- **Nomes:** os identificadores ficam em inglês e descritivos, nunca de uma letra. Comentários e mensagens da API ficam em português.
- **Escopo:** nada de `console.log` nem dependência nova. Não há migração.
- **Commits:** em português, no Conventional Commits, com `Refs #93` e o rodapé `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Integração:** `bun run test:integration` usa o banco do `.env`, que é a porta da produção. Antes, peça ao Victor um `bun server down` e suba o banco com `bun start backend`. No fim, rode `bun stop`.

## Pontos de atenção na revisão

1. **O dono tenta remover a si mesmo:** recebe 409 e continua dono. O teste fica na Tarefa 2.
2. **Adicionar alguém que já é colaborador, ou o próprio dono:** recebe 409. O teste fica na Tarefa 2.
3. **Email com maiúsculas ou espaços:** acha a conta (`trim` e minúsculas). O teste fica na Tarefa 3.
4. **Conta removida (`deleted_at`):** recebe 404, como se não existisse. O teste fica na Tarefa 3.
5. **O colaborador sai de uma playlist privada:** deixa de vê-la (404) e ela some da "Minhas playlists" dele. O teste fica na Tarefa 3.

---

### Tarefa 1: Colaborador mexe nas músicas (domínio)

**Arquivos:**
- Criar: `api/domain/use-cases/find-music-editable-playlist.ts`
- Modificar: `add-music-to-playlist.ts`, `remove-music-from-playlist.ts` e `reorder-playlist-musics.ts`, para usar o finder novo.
- Modificar: `api/domain/use-cases/playlist-output.ts`, que ganha `canEditMusics: playlist.isMember(viewerId)`.
- Testar: `api/domain/use-cases/playlist-musics.test.ts` e o teste de `get-playlist`.

**Interfaces:** produz `findMusicEditablePlaylist(playlists, playlistId, userId, message): Promise<Playlist>`, que reaproveita o `findVisiblePlaylist` e exige `isMember` (senão `ForbiddenError(message)`). Produz também o `canEditMusics: boolean` na saída da playlist.

- [ ] **Passo 1: Testes que falham**
  - Em `playlist-musics.test.ts`, crie `"deixa o colaborador pôr, tirar e reordenar músicas"`. Com `playlist.addMember(BRUNO)` salvo, o Bruno põe, tira e reordena sem erro.
  - Os testes que hoje dizem "quem não é admin" passam a usar um não membro que vê a pública, e o nome deles troca "admin" por "membro".
  - No teste do `get-playlist`, o membro recebe `canEditMusics: true` e `isAdmin: false`, e quem só vê recebe `canEditMusics: false`.
- [ ] **Passo 2:** rode `cd api && bun test domain/use-cases/playlist-musics domain/use-cases/get-playlist`. O esperado é falhar.
- [ ] **Passo 3:** implemente. As mensagens viram `"Only playlist members can add musics"` e as equivalentes.
- [ ] **Passo 4:** rode `cd api && bun run test && bun run typecheck`. O esperado é tudo passando.
- [ ] **Passo 5:** faça o commit junto com a Tarefa 2.

### Tarefa 2: Casos de uso dos colaboradores (domínio)

**Arquivos:**
- Modificar: `api/domain/ports/user-repository.ts`, que ganha `findByEmail(email: string): Promise<UserProfile | null>`.
- Criar: `api/domain/testing/in-memory-user-repository.ts`. Ele recebe `{ profile: UserProfile; email: string }[]` e responde por email exato (minúsculas) e por id.
- Criar: `api/domain/use-cases/playlist-collaborators.ts`, com as classes `ListCollaborators`, `AddCollaborator` e `RemoveCollaborator` e as interfaces `…UseCase`. São três casos de uso pequenos e do mesmo assunto, como os de músicas em `playlist-musics.test.ts`.
- Testar: `api/domain/use-cases/playlist-collaborators.test.ts`.

**Interfaces:**
```ts
export interface Collaborator { userId: number; name: string; isOwner: boolean }
ListCollaborators(playlists: PlaylistRepository, users: UserRepository)
  .execute({ userId, playlistId }): Promise<Collaborator[]>   // dono primeiro, depois por nome
AddCollaborator(playlists, users, subscriptions: SubscriptionRepository)
  .execute({ userId, playlistId, email }): Promise<Collaborator[]>
RemoveCollaborator(playlists, users)
  .execute({ userId, playlistId, collaboratorId }): Promise<void>
```

- [ ] **Passo 1: Testes que falham** (Ana é a dona, Bruno tem plano, Carla não tem plano e Diego é um terceiro com plano)
  - `"lista o dono primeiro e os colaboradores pelo nome, sem email"`
  - `"o dono adiciona um assinante pelo email"`: o resultado inclui o Bruno com `isOwner: false`, e a playlist salva tem o Bruno como membro.
  - `"recusa quem não é dono com ForbiddenError"`: o Bruno, já colaborador, tenta adicionar o Diego.
  - `"dá NotFoundError para email sem conta"`.
  - `"recusa conta sem assinatura ativa com BusinessRuleError"`: a Carla.
  - `"recusa quem já é membro com BusinessRuleError"`: o Bruno de novo, e a própria Ana.
  - `"o dono remove um colaborador"`.
  - `"o colaborador sai da playlist"`: o Bruno remove a si mesmo.
  - `"o colaborador não remove outro colaborador"`: dá `ForbiddenError`.
  - `"o dono não sai da própria playlist"`: dá `BusinessRuleError`.
  - `"dá NotFoundError para quem não é membro"`.
  - `"esconde a playlist privada de quem não é membro"`: dá `NotFoundError` em listar e em adicionar.
- [ ] **Passo 2:** rode `cd api && bun test domain/use-cases/playlist-collaborators`. O esperado é falhar.
- [ ] **Passo 3: Implementar**
  - O email chega com `trim().toLowerCase()`.
  - O `AddCollaborator` faz os passos nesta ordem: `findVisiblePlaylist`, depois `isAdmin` (senão `ForbiddenError("Only the playlist owner manages collaborators")`), `findByEmail` (`NotFoundError("Account not found")`), `findActiveByUser` (`BusinessRuleError("This account has no active subscription")`), `playlist.addMember`, `playlists.save` e por fim `ListCollaborators`.
  - O `RemoveCollaborator`:
    - Se `collaboratorId === userId`, é o "sair".
    - Senão, exige `isAdmin`.
    - Se o alvo não é membro, dá `NotFoundError("Collaborator not found")`.
    - Depois chama `playlist.removeMember`, que já recusa o último admin, e salva.
- [ ] **Passo 4:** rode `cd api && bun run test`. O esperado é tudo passando. O typecheck acusa o `PostgresUserRepository` sem `findByEmail`, e isso se resolve na Tarefa 3.
- [ ] **Passo 5:** faça o commit junto com a Tarefa 3.

### Tarefa 3: Adaptadores, rotas e documentação da API

**Arquivos:**
- Modificar: `api/adapters/db/postgres-user-repository.ts` (`findByEmail` com `WHERE email = $1 AND deleted_at IS NULL`).
- Modificar: `api/adapters/http/playlist-controller.ts`, que ganha `listCollaborators` (200), `addCollaborator` (201) e `removeCollaborator` (204).
- Criar: `api/adapters/http/schemas/playlist-collaborators-schemas.ts`:
  - `addCollaboratorSchema = Joi.object({ email: Joi.string().trim().email().required() })`
  - `playlistCollaboratorParamsSchema = Joi.object({ id: positiveIntParam("id"), userId: positiveIntParam("userId") })`
- Modificar: `api/adapters/http/routes.ts`, com as três rotas sob `subscriberOnly` e a validação de params e body.
- Modificar: `api/infra/composition-root.ts`.
- Testar: criar `api/adapters/http/playlist-collaborators-routes.test.ts`, no molde de `playlist-routes.test.ts`.
- Documentação:
  - `api/adapters/http/openapi.ts`: as três rotas, o schema `Collaborator` e o `canEditMusics` na `Playlist`.
  - Bruno: `api/bruno/playlists/` (listar, adicionar e remover colaborador).
  - `docs/api.md`: a tabela de rotas e o parágrafo sobre as permissões.
  - `docs/models.md`.

- [ ] **Passo 1: Testes de integração que falham** (Ana dona, Bruno assinante, Carla sem plano)
  - `"exigem sessão"`.
  - `"critério 1: o colaborador adicionado vê a playlist em Minhas playlists"`.
  - `"critério 2: a música que o colaborador põe aparece para o dono"`.
  - `"critério 3: o colaborador não renomeia nem exclui"`: `PATCH` e `DELETE` dão 403.
  - `"critério 4: o colaborador removido perde a edição e a privada some"`: na privada, `POST …/musics` dá 404 e `GET /playlists/:id` dá 404.
  - `"o colaborador sai e a playlist some da lista dele"`.
  - `"acha a conta pelo email com maiúsculas e espaços"`: `"  BRUNO…@…  "`.
  - `"recusa email sem conta ou de conta removida com 404, sem plano com 409 e repetido com 409"`.
  - `"recusa email inválido e ids inválidos com 400"`.
  - `"a resposta da playlist traz canEditMusics"`: `true` para o colaborador e `false` para quem só vê.
- [ ] **Passo 2:** suba o banco (restrições globais) e rode `cd api && bun test --env-file=../.env adapters/http/playlist-collaborators-routes`. O esperado é falhar com 404 nas rotas.
- [ ] **Passo 3:** implemente.
- [ ] **Passo 4:** rode `cd api && bun run test && bun run test:integration && bun run lint && bun run typecheck`. O esperado é tudo passando.
- [ ] **Passo 5: Commit** (Tarefas 1 a 3)

  ```text
  feat(playlist): colaboradores editam as músicas da playlist (HU-19)
  ```

### Tarefa 4: Front — permissões e diálogo de colaboradores

**Arquivos:**
- Modificar: `frontend/src/lib/api/playlists.ts`:
  - o tipo ganha `canEditMusics: boolean`, e o `Collaborator` também entra;
  - entram `playlistsApi.listCollaborators(id)`, `addCollaborator(id, email)` e `removeCollaborator(id, userId)`;
  - entram os hooks `usePlaylistCollaborators(id)`, `useAddCollaborator()` e `useRemoveCollaborator()`, que invalidam os colaboradores e as playlists.
- Modificar: `frontend/src/lib/playlist-store.ts`. O `canEdit` vira `canManage` (`isAdmin`), e entra o `canEditMusics`. O teste `playlist-store.test.ts` muda junto.
- Modificar os usos:
  - `app/playlist/page.tsx`, linhas 301 e 388: `canManage`.
  - `app/playlist/[id]/page.tsx`: a 184 vira `canManage`, e as 255, 272, 289 e 362 viram `canEditMusics`.
  - `components/add-to-playlist-menu.tsx`: `canEditMusics`.
- Criar: `frontend/src/components/playlist-collaborators-dialog.tsx`.
  - Segue o diálogo de edição que já existe na página da playlist.
  - Para o dono: a lista, o campo de email com "Adicionar" (desabilitado durante o envio) e "Remover" em cada colaborador.
  - Para o colaborador: a lista e "Sair da playlist", que depois de sair leva a `/playlist`.
  - Os erros da API aparecem com `role="alert"`.
- Modificar: `app/playlist/[id]/page.tsx`, com o botão "Colaboradores" no cabeçalho para todo membro (`canEditMusics`).
- Documentação: `frontend/src/lib/api/README.md`.

- [ ] **Passo 1:** atualize o `playlist-store.test.ts` (`canManage` e `canEditMusics`) e rode. O esperado é falhar.
- [ ] **Passo 2:** implemente o cliente, a store, os usos e o diálogo.
- [ ] **Passo 3:** rode `cd frontend && bun run test && bun run lint && bunx tsc --noEmit -p .`. O esperado é tudo passando.
- [ ] **Passo 4:** confira na tela, com `bun start full`. A Ana adiciona o Bruno, e o Bruno vê a playlist, põe uma música e sai. Os botões de renomear e excluir não aparecem para ele.
- [ ] **Passo 5: Commit**

  ```text
  feat(frontend): gerencia os colaboradores da playlist (HU-19)
  ```

### Tarefa 5: Fechar a história

- [ ] **Passo 1:** registre o uso de IA em `docs/prompts/prompts.md`. Rode todas as verificações e uma revisão independente da branch.
- [ ] **Passo 2:** mostre ao Victor o PR, `feat(playlist): playlist colaborativa (HU-19)`, com os critérios, os testes de cada um e `Closes #93`. Só depois do OK dele: push, PR e os checkboxes da #93.
