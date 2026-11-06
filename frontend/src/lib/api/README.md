# Integração com a API

Toda chamada ao backend passa por três camadas. Uma integração nova é um arquivo `lib/api/<domínio>.ts`.

| Camada | Onde | O que faz |
| --- | --- | --- |
| Cliente HTTP | `client.ts` | O único lugar que chama `fetch`. Manda o cookie de sessão, converte falha em `ApiError` com mensagem pronta para a tela, e tem os helpers `queryString`, `json` e `apiErrorMessage`. |
| Service | `<domínio>.ts` | Os tipos que a API devolve (espelhando `api/domain/ports` e `use-cases`) e uma função por endpoint (`searchApi.search`, …). Sem React: dá para testar e usar fora de componente. |
| Hooks | mesmo `<domínio>.ts` | `useQuery`/`useMutation` do [TanStack Query](https://tanstack.com/query) sobre o service. Cache, deduplicação, cancelamento, loading e erro vêm dele. |

O `QueryProvider` (`query-provider.tsx`) fica no layout raiz: dados valem por 30 s, não há refetch ao voltar para a aba e respostas 4xx não são repetidas.

## Receita para um endpoint novo

```ts
// lib/api/playlists.ts
export interface Playlist { id: number; name: string /* … o que a API devolve */ }

export const playlistsApi = {
  list: (signal?: AbortSignal) => request<Playlist[]>("/playlists", { signal }),
  update: (id: number, input: Partial<Playlist>) => request<Playlist>(`/playlists/${id}`, json("PATCH", input)),
}

// Chaves hierárquicas: invalidar `playlistKeys.all` derruba lista e detalhes juntos
export const playlistKeys = {
  all: ["playlists"] as const,
  list: () => [...playlistKeys.all, "list"] as const,
}

export function useMyPlaylists() {
  return useQuery({ queryKey: playlistKeys.list(), queryFn: ({ signal }) => playlistsApi.list(signal) })
}

export function useUpdatePlaylist(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<Playlist>) => playlistsApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playlistKeys.all }),
  })
}
```

Na tela: `const { data, isPending, error } = useMyPlaylists()` e `apiErrorMessage(error)` para a mensagem.

## Regras

- Componente não chama `fetch` nem `request`: usa um hook (ou, fora de React, o service).
- Passe o `signal` do `queryFn` adiante, para a consulta cancelar o request que ficou para trás.
- Mutação invalida as chaves que mudam. Se o nome de uma playlist muda, a busca também pode mudar (`searchKeys.all`).
- Formato de tela (ex.: `Track` do player) é convertido perto de quem usa, não no service. O service devolve o que a API devolve.
- O cache é do usuário logado: o `QueryProvider` limpa tudo quando a sessão troca de pessoa (logout, login de outra conta).
- Para enviar arquivo, passe um `FormData` como `body`, sem `json()`. O `request` só põe `Content-Type: application/json` quando o corpo é texto. Com `FormData`, o navegador define o cabeçalho multipart, com o separador das partes. Exemplo: `request("/admin/musics", { method: "POST", body: musicFormData(input) })`, em que `musicFormData` (em `admin.ts`) põe os campos em JSON na parte `data` e o MP3 na parte `audio`. O cadastro de álbum faz o mesmo com `albumFormData`, com a imagem na parte `cover`.
- Um caminho que a API devolve, como o `coverUrl` de um álbum, vira um endereço para o `<img src>` com `apiUrl(path)` (em `client.ts`), que põe o endereço da API na frente.
- O áudio do player segue a mesma regra: `apiUrl(catalogApi.musicAudioPath(id))` é o `src` do `<audio>` em `components/playback-audio.tsx`. O navegador manda o cookie de sessão porque o front e a API são do mesmo site (`localhost` em dev, `zovic.com.br` e `api.zovic.com.br` em produção), então o `<audio>` não usa `crossOrigin`.

## O que já está integrado

| Arquivo | Rotas |
| --- | --- |
| `search.ts` | `GET /search` |
| `playlists.ts` | `GET/POST /playlists`, `GET/PATCH/DELETE /playlists/:id` (a API ainda não devolve as músicas da playlist) |
| `catalog.ts` | `GET /musics`, `GET /artists`, `GET /albums` (`useAlbums`), `GET /genres`, `POST /musics/:id/plays` (chamado pelo `PlaybackAudio` quando o som começa, uma vez por audição) e o caminho de `GET /musics/:id/audio` (`musicAudioPath`) |
| `subscriptions.ts` | `GET /plans/me`, `POST /plans` (com o `kind`: `individual` ou `family`), `DELETE /plans/me`, o plano familiar (`GET /plans/me/members`, `POST /plans/me/invitations`, `DELETE /plans/me/invitations/:id`, `DELETE /plans/me/members/:userId`, `DELETE /plans/me/membership`) e os convites (`GET /invitations/:token`, `POST /invitations/:token/accept`). Veja os hooks abaixo. |
| `history.ts` | `GET /history`: o histórico de reprodução da conta, uma entrada por música (`useHistory`). O `PlaybackAudio` invalida `historyKeys.all` a cada audição registrada. |
| `admin.ts` | todas as de `/admin`: stats, usuários, reproduções por usuário, músicas (o cadastro em multipart, com o MP3), álbuns (o cadastro em multipart, com a capa, e a troca de capa), gêneros (só a criação) e artistas |
| `lib/auth/client.ts` | `/auth/*` pelo cliente do Better Auth (cadastro, login, logout, sessão) |

### Hooks de `subscriptions.ts`

| Hook | O que faz |
| --- | --- |
| `useSubscription` | Junta a sessão e a assinatura: `account`, `subscription`, `isPending` e `isError` |
| `useSubscribe`, `useCancelSubscription` | Assinar e cancelar. Reiniciam todas as consultas, porque a assinatura decide o que a API responde no catálogo. |
| `usePlanMembers(enabled)` | Membros, convites pendentes, `limit` e `freeSlots`, só para o gestor. Passe `enabled: false` nos outros planos. |
| `useInviteToPlan`, `useCancelInvitation`, `useRemoveMember` | Ações do gestor. Só invalidam a lista de membros. `useInviteToPlan` devolve o `token`, que a API não mostra de novo. |
| `useAcceptInvitation`, `useLeavePlan` | Mudam o acesso de quem está logado, então reiniciam as consultas. Chame com `mutateAsync`: o reinício pode desmontar o componente, e o React Query não roda os callbacks de um componente desmontado. O aceite poupa as consultas de convite, porque o link já usado responderia 404. |
| `useInvitation(token)` | O convite de um link, público. `isInvalidInvitation(error)` é verdadeiro só para o 404 (inválido, expirado, usado ou cancelado). Uma falha de rede é outra coisa. |
