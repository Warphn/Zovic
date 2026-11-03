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
