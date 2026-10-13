import { describe, expect, it } from "bun:test"
import {
  API_URL,
  DEV_USER_ID,
  type FetchLike,
  PlaylistApiError,
  createPlaylist,
} from "./playlists-api"

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit; body: string }[] = []
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init, body: typeof init.body === "string" ? init.body : "" })
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }
  return { impl, calls }
}

const offline: FetchLike = async () => {
  throw new TypeError("fetch failed")
}

async function captureError(promise: Promise<unknown>): Promise<PlaylistApiError> {
  const error = await promise.catch((e: unknown) => e)
  if (!(error instanceof PlaylistApiError)) {
    throw new Error("expected a PlaylistApiError")
  }
  return error
}

describe("createPlaylist", () => {
  it("envia o POST com o usuário de desenvolvimento e devolve a playlist criada", async () => {
    const created = { id: 42, name: "Rock", color: "#1DB954", isPrivate: false, createdAt: "2026-10-13T19:25:03.445Z" }
    const { impl, calls } = fakeFetch(201, created)

    const result = await createPlaylist({ name: "Rock", color: "#1db954" }, impl)

    expect(result).toEqual(created)
    expect(calls[0]?.url).toBe(`${API_URL}/api/playlists`)
    expect(calls[0]?.init.method).toBe("POST")
    expect(calls[0]?.init.headers).toMatchObject({ "x-user-id": DEV_USER_ID })
    expect(JSON.parse(calls[0]?.body ?? "")).toEqual({ name: "Rock", color: "#1db954" })
  })

  it("traduz o 400 da validação em erros por campo", async () => {
    const { impl } = fakeFetch(400, {
      error: "VALIDATION_ERROR",
      fields: [
        { field: "name", message: '"name" is required' },
        { field: "color", message: "fails to match" },
      ],
    })

    const error = await captureError(createPlaylist({ name: "", color: "azul" }, impl))

    expect(Object.keys(error.fieldErrors).toSorted()).toEqual(["color", "name"])
  })

  it("explica o 404 de usuário inexistente", async () => {
    const { impl } = fakeFetch(404, { error: "NOT_FOUND", message: "User not found" })

    const error = await captureError(createPlaylist({ name: "Rock" }, impl))

    expect(error.message).toContain("NEXT_PUBLIC_DEV_USER_ID")
    expect(error.fieldErrors).toEqual({})
  })

  it("dá uma mensagem genérica para o 500", async () => {
    const { impl } = fakeFetch(500, { error: "INTERNAL_ERROR", message: "Internal server error" })

    const error = await captureError(createPlaylist({ name: "Rock" }, impl))

    expect(error.message).toBe("Não foi possível criar a playlist. Tente de novo.")
  })

  it("recusa um 201 fora do formato do contrato", async () => {
    const { impl } = fakeFetch(201, { id: "42" })

    const error = await captureError(createPlaylist({ name: "Rock" }, impl))

    expect(error.message).toContain("formato inesperado")
  })

  it("avisa quando a API está fora do ar", async () => {
    const error = await captureError(createPlaylist({ name: "Rock" }, offline))

    expect(error.message).toContain("conectar à API")
  })
})
