import { afterEach, describe, expect, it, mock, spyOn } from "bun:test"
import { ApiError, apiErrorMessage, apiUrl, json, queryString, request } from "./client"

describe("api client helpers", () => {
  it("builds a query string from the set params only", () => {
    expect(queryString({ q: "águas de março", limit: 5, skip: undefined })).toBe("?q=%C3%A1guas+de+mar%C3%A7o&limit=5")
    expect(queryString({ q: undefined })).toBe("")
  })

  it("serializes a JSON body with its method", () => {
    expect(json("PATCH", { color: null })).toEqual({ method: "PATCH", body: '{"color":null}' })
  })

  it("shows the ApiError message, and a generic one for anything else", () => {
    expect(apiErrorMessage(new ApiError(401, "Sua sessão expirou. Entre de novo."))).toBe("Sua sessão expirou. Entre de novo.")
    expect(apiErrorMessage(new Error("boom"))).toBe("Algo deu errado. Tente de novo.")
  })
})

/** Spies on fetch, answering 200, and returns the headers of each call. */
function captureHeaders(): Headers[] {
  const sent: Headers[] = []
  spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    sent.push(new Headers(init?.headers))
    return new Response("{}", { status: 200 })
  })
  return sent
}

describe("request", () => {
  afterEach(() => {
    mock.restore()
  })

  it("lets the browser set the multipart Content-Type for a FormData body", async () => {
    const sent = captureHeaders()
    await request("/x", { method: "POST", body: new FormData() })
    expect(sent[0]?.has("Content-Type")).toBe(false)
  })

  it("keeps the JSON Content-Type for a json() body", async () => {
    const sent = captureHeaders()
    await request("/x", json("POST", {}))
    expect(sent[0]?.get("Content-Type")).toBe("application/json")
  })

  // HU-19: what the collaborators dialog and the playlist page show for each refusal
  it("translates the playlist collaborators errors", async () => {
    const translations: [number, string, string][] = [
      [404, "Account not found", "Não há conta com esse email."],
      [409, "This account has no active subscription", "Essa conta não tem assinatura ativa, então não pode colaborar."],
      [409, "User is already a member of this playlist", "Essa pessoa já está na playlist."],
      [403, "Only the playlist owner manages collaborators", "Só quem criou a playlist gerencia os colaboradores."],
      [404, "Collaborator not found", "Essa pessoa já não está na playlist."],
      [409, "The last admin cannot leave the playlist", "Quem criou a playlist não pode sair dela. Para deixá-la, exclua a playlist."],
      [403, "Only playlist members can add musics", "Só quem monta a playlist pode adicionar músicas."],
      [403, "Only playlist members can remove musics", "Só quem monta a playlist pode tirar músicas."],
      [403, "Only playlist members can reorder musics", "Só quem monta a playlist pode mudar a ordem."],
    ]
    for (const [status, apiMessage, shown] of translations) {
      spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "ERROR", message: apiMessage }), { status })
      )
      await expect(request("/x")).rejects.toThrow(shown)
      mock.restore()
    }
  })

  // What the comments panel and the admin's artist form show for each refusal
  it("translates the comments and repeated artist errors", async () => {
    const translations: [number, string, string][] = [
      [403, "Underage users cannot comment", "Só maiores de 18 anos podem comentar."],
      [404, "Comment not found", "Esse comentário já foi apagado."],
      [403, "You can only delete your own comments", "Você só pode apagar os seus próprios comentários."],
      [409, "You have already reported this comment", "Você já denunciou este comentário."],
      [409, "An artist with this name already exists", "Já existe um artista com esse nome."],
    ]
    for (const [status, apiMessage, shown] of translations) {
      spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "ERROR", message: apiMessage }), { status })
      )
      await expect(request("/x")).rejects.toThrow(shown)
      mock.restore()
    }
  })
})

describe("apiUrl", () => {
  it("turns a path the API returns (like a coverUrl) into a full address", () => {
    expect(apiUrl("/api/albums/3/cover?v=abc")).toBe("http://localhost:3333/api/albums/3/cover?v=abc")
  })
})
