import { afterEach, describe, expect, it, mock, spyOn } from "bun:test"
import { ApiError, apiErrorMessage, json, queryString, request } from "./client"

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
})
