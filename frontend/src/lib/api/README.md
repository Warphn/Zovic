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

## O que já está integrado

| Arquivo | Rotas |
| --- | --- |
| `search.ts` | `GET /search` |
| `playlists.ts` | `GET/POST /playlists`, `GET/PATCH/DELETE /playlists/:id` (a API ainda não devolve as músicas da playlist) |
| `catalog.ts` | `GET /musics`, `GET /artists`, `GET /genres`, `POST /musics/:id/plays` (chamado por `useRecordPlays`, uma vez por audição) |
| `subscriptions.ts` | `GET /plans/me`, `POST /plans`, `DELETE /plans/me`. O hook `useSubscription` junta a sessão e a assinatura; assinar ou cancelar reinicia todas as consultas, porque a assinatura decide o que a API responde no catálogo |
| `admin.ts` | todas as de `/admin`: stats, usuários, reproduções por usuário, músicas e artistas |
| `lib/auth/client.ts` | `/auth/*` pelo cliente do Better Auth (cadastro, login, logout, sessão) |
