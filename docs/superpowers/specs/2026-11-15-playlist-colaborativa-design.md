# Playlist colaborativa (HU-19) — design

Issue: #93 · Épico: Playlists (#78) · Responsável: Victor · Prioridade: P1

## Intenção

O dono de uma playlist quer montá-la junto com outros assinantes. A história na issue é a fonte da verdade:

- O dono adiciona um colaborador pelo email de uma conta existente.
- O colaborador adiciona, remove e reordena músicas. Ele não renomeia, não exclui a playlist e não gerencia colaboradores.
- O dono pode remover um colaborador, e o colaborador pode sair.
- Para um colaborador menor de idade, as músicas explícitas ficam escondidas (HU-09).

Critérios de aceite:

1. O dono adiciona o email de um assinante, e a playlist aparece em "Minhas playlists" do colaborador.
2. O colaborador adiciona uma música, e o dono e os outros colaboradores a veem.
3. O colaborador tenta renomear ou excluir a playlist, e o pedido é recusado.
4. Um colaborador removido tenta mudar a playlist, e o pedido é recusado. Se a playlist for privada, ele deixa de vê-la.

## Não objetivos

- **Convites com aceite:** o colaborador entra direto, sem convite.
- **Mais de um dono:** a promoção a dono não é exposta.
- **Notificação ao colaborador:** não há envio de email.
- **Regra de menores:** a HU-09 já a cobre para qualquer pessoa que veja a playlist, no PR #129, e esta história não refaz.

## Abordagens consideradas

1. **Colaborador como membro sem `is_admin` em `playlist_user`, com entrada direta (aprovada).** Não exige migração. A entidade `Playlist` já tem `addMember` e `removeMember`, e o repositório já regrava os membros ao salvar. A "Minhas playlists" já lista as playlists de que a conta é membro.
2. **Convite com aceite, como no plano familiar.** Exigiria uma tabela, um token e uma tela de aceite. Foi descartada porque a história pede que o dono adicione direto.

## Como funciona

### Permissões

| Ação | Dono (admin) | Colaborador (membro) | Outro assinante |
| --- | --- | --- | --- |
| Ver a playlist e as músicas | sim | sim | só se for pública |
| Adicionar, remover e reordenar músicas | sim | **sim (novo)** | 403 na pública, 404 na privada |
| Renomear, mudar a visibilidade ou a cor, excluir | sim | 403 | 403 ou 404 |
| Adicionar e remover colaboradores | sim | 403 (só pode sair) | 403 ou 404 |

### Domínio (`api/domain`)

- **Novo `findMusicEditablePlaylist`**, ao lado do `findEditablePlaylist`. Exige ver a playlist (senão `NotFoundError`) e ser membro dela (senão `ForbiddenError`). Os casos de uso de adicionar, remover e reordenar músicas passam a usá-lo.
- **A porta `UserRepository`** ganha `findByEmail(email): Promise<UserProfile | null>`, só para conta ativa e com o email em minúsculas.
- **`AddCollaborator`:**
  - Só o dono pode adicionar. Os outros recebem `ForbiddenError`, e quem não vê a playlist recebe `NotFoundError`.
  - Um email sem conta ativa dá `NotFoundError("Account not found")`.
  - Uma conta sem assinatura ativa dá `BusinessRuleError` (409).
  - Uma conta que já é membro dá `BusinessRuleError` (409), pela regra da entidade.
  - Devolve a lista nova de colaboradores.
- **`RemoveCollaborator`:**
  - O dono remove qualquer colaborador.
  - Um colaborador só remove a si mesmo, que é o "sair". Os outros recebem `ForbiddenError`.
  - Remover o dono dá `BusinessRuleError`, pela regra do último admin da entidade.
  - Um alvo que não é membro dá `NotFoundError`.
- **`ListCollaborators`:** quem vê a playlist recebe `[{ userId, name, isOwner }]`, com o dono primeiro e o resto pelo nome. Não inclui email.
- **A saída da playlist (`playlist-output.ts`)** ganha `canEditMusics` (é membro), além do `isAdmin` de hoje.

### API

- `GET /api/playlists/:id/collaborators`, que responde 200.
- `POST /api/playlists/:id/collaborators` com `{ email }`, que responde 201 com a lista.
- `DELETE /api/playlists/:id/collaborators/:userId`, que responde 204.
- As respostas de playlist ganham `canEditMusics`.

### Front

- **`playlist-store`:** o `canEdit` vira dois campos. `canManage` (renomear, excluir e colaboradores) vem de `isAdmin`, e `canEditMusics` (adicionar, remover e reordenar músicas) vem de `canEditMusics`. O menu "Adicionar à playlist" passa a filtrar por `canEditMusics`.
- **Página da playlist:** o botão "Colaboradores" abre um diálogo.
  - O dono vê a lista, o campo de email com "Adicionar" e um "Remover" em cada colaborador.
  - O colaborador vê a lista e "Sair da playlist", que leva a "Minhas playlists".
  - Os erros da API aparecem no diálogo.

## Testes por critério

| Critério | Teste |
| --- | --- |
| 1. Aparece em "Minhas playlists" | Integração: depois do `POST …/collaborators`, o `GET /playlists` do colaborador inclui a playlist |
| 2. Colaborador adiciona música e todos veem | Domínio: `AddMusicToPlaylist` aceita um membro. Integração: o colaborador põe uma música e o `GET …/musics` do dono a mostra |
| 3. Colaborador não renomeia nem exclui | Integração: `PATCH` e `DELETE` do colaborador dão 403 |
| 4. Removido perde a edição e a privada some | Integração: depois do `DELETE …/collaborators/:id`, o `POST …/musics` dá 404 na privada e 403 na pública, e o `GET` da privada dá 404 |

## Documentação no mesmo PR

`openapi.ts`, o Bruno (`api/bruno/playlists/`), `docs/api.md`, `docs/models.md` (os casos de uso e o `findByEmail`), `frontend/src/lib/api/README.md` e `docs/prompts/prompts.md`. Não há migração.

## Decisões tomadas por mim (Claude), para conferir

- A conta precisa ter assinatura ativa (409 sem ela), porque a história diz "assinantes" e sem plano a pessoa não acessa as playlists.
- Um email sem conta dá 404. Proposto antes como 422, mudou para os códigos que o `error-handler` já usa.
- A lista de colaboradores mostra só o nome, sem o email.
- O dono não pode sair. Para deixar a playlist, ele a exclui.
- No front, o `canEdit` é renomeado para `canManage`, em vez de ganhar um segundo sentido.
