// HTTP client for the API (/api/...): the one place that calls fetch. The session cookie goes
// along (credentials: "include"), and any failure comes back as an ApiError whose message can be
// shown as is. Services in lib/api/<domain>.ts build on `request`; see lib/api/README.md.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

// Messages for the error codes the UI can trigger; anything else falls back to a generic one
const MESSAGES: Record<string, string> = {
  "Email already in use": "Já existe uma conta com esse email.",
  "Admins cannot remove their own account": "Você não pode remover a sua própria conta.",
  "The last platform admin cannot be removed": "Não dá para remover o último admin da plataforma.",
  "Music must have at least one artist": "A música precisa de pelo menos um artista.",
  // Playlists (api/domain/use-cases): only the playlist's admins can change it
  "Only playlist admins can edit it": "Só quem administra a playlist pode editá-la.",
  "Only playlist admins can delete it": "Só quem administra a playlist pode apagá-la.",
  "Only playlist admins can add musics": "Só quem administra a playlist pode adicionar músicas.",
  "Only playlist admins can remove musics": "Só quem administra a playlist pode tirar músicas.",
  "Only playlist admins can reorder musics": "Só quem administra a playlist pode mudar a ordem.",
  "Music is already in this playlist": "Essa música já está na playlist.",
  "Music is not in this playlist": "Essa música já tinha saído da playlist.",
  "Music not found": "Essa música não está mais no catálogo.",
  "Playlist not found": "A playlist não existe mais ou é privada.",
  "The new order must have exactly the playlist's musics; reload it and try again":
    "A playlist mudou enquanto você ordenava. Recarregue e tente de novo.",
  // Subscriptions (api/domain/use-cases and the requireSubscription middleware)
  "Only adults can subscribe": "Só maiores de 18 anos podem assinar.",
  "Account already has an active subscription": "Você já tem uma assinatura ativa.",
  "Only the plan manager can cancel it": "Só quem gerencia o plano pode cancelar a assinatura.",
  "No active subscription": "Você não tem uma assinatura ativa.",
  "Active subscription required": "Para ouvir, você precisa de uma assinatura.",
  // Family plans and invitations
  "Only the plan manager can list members": "Só quem gerencia o plano vê os membros.",
  "Only the plan manager can invite": "Só quem gerencia o plano pode convidar.",
  "Only the plan manager can cancel invitations": "Só quem gerencia o plano pode cancelar convites.",
  "Only the plan manager can remove members": "Só quem gerencia o plano pode remover membros.",
  "This invitation was sent to another email": "Este convite foi enviado para outro email.",
  "Invitation not found": "Convite inválido, expirado ou já usado.",
  "Member not found": "Essa pessoa já não está no plano.",
  "The plan has no free slots": "O plano não tem vagas livres. Remova alguém ou cancele um convite.",
  "Only family plans accept invitations": "Só o plano Família tem convites.",
  "This email is already a member of the plan": "Esse email já faz parte do plano.",
  "This email already has a pending invitation": "Esse email já tem um convite pendente.",
  "Leave or cancel your current plan before accepting an invitation":
    "Saia ou cancele o seu plano atual antes de aceitar um convite.",
  "The manager cannot leave the plan: cancel it instead":
    "Quem gerencia o plano não pode sair dele. Cancele a assinatura.",
  "The manager cannot be removed: cancel the plan instead":
    "Quem gerencia o plano não pode ser removido. Cancele a assinatura.",
}

/** Message to show for any error thrown by a request (or by anything else). */
export function apiErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Algo deu errado. Tente de novo."
}

/** `{ q: "x", limit: 5, skip: undefined }` → "?q=x&limit=5"; "" when nothing is set. */
export function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ""
}

/** JSON body with the given method, for mutations: `request(path, json("PATCH", body))`. */
export const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    const headers = new Headers(init.headers)
    if (init.body) headers.set("Content-Type", "application/json")
    res = await fetch(`${API_URL}/api${path}`, { ...init, headers, credentials: "include" })
  } catch (error) {
    // A cancelled request (the query was superseded) is not a connection problem
    if (init.signal?.aborted) throw error
    throw new ApiError(0, "Não foi possível falar com a API. Verifique a conexão.")
  }
  // The API's JSON shape is the contract the caller types; 204 is for the void calls
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  if (res.status === 204) return undefined as T
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, body))
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return body as T
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    if ("message" in body && typeof body.message === "string" && MESSAGES[body.message]) {
      return MESSAGES[body.message]
    }
    if ("fields" in body && Array.isArray(body.fields)) return "Confira os campos: algum valor é inválido."
  }
  if (status === 401) return "Sua sessão expirou. Entre de novo."
  if (status === 403) return "Só admins da plataforma podem fazer isso."
  if (status === 404) return "Registro não encontrado (pode já ter sido removido)."
  return "Algo deu errado. Tente de novo."
}
