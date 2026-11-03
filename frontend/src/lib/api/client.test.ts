import { describe, expect, it } from "bun:test"
import { ApiError, apiErrorMessage, json, queryString } from "./client"

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
