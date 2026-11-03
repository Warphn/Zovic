import { describe, expect, it } from "bun:test"
import { NETWORK_ERROR, toAuthError } from "./errors"
import { safeRedirectPath, validateSignIn, validateSignUp } from "./validation"

const TODAY = new Date("2026-10-20T12:00:00Z")

describe("auth validation", () => {
  it("requires a valid email and a password on sign in", () => {
    expect(validateSignIn({ email: "", password: "" })).toEqual({
      email: "Informe seu email.",
      password: "Informe sua senha.",
    })
    expect(validateSignIn({ email: "ana@", password: "x" }).email).toBe("Email inválido.")
    expect(validateSignIn({ email: "ana@zovic.dev", password: "x" })).toEqual({})
  })

  it("validates every sign up field", () => {
    const errors = validateSignUp({ name: " ", email: "nope", password: "1234567", birthdate: "" }, TODAY)
    expect(Object.keys(errors).toSorted()).toEqual(["birthdate", "email", "name", "password"])
    expect(errors.password).toBe("A senha precisa de pelo menos 8 caracteres.")
  })

  it("applies the same length limits as the API", () => {
    const base = { name: "Ana", email: "ana@zovic.dev", password: "12345678", birthdate: "1995-03-12" }
    expect(validateSignUp({ ...base, password: "a".repeat(129) }, TODAY).password).toBe(
      "A senha pode ter no máximo 128 caracteres."
    )
    expect(validateSignUp({ ...base, password: "a".repeat(128) }, TODAY)).toEqual({})
    expect(validateSignUp({ ...base, name: "a".repeat(151) }, TODAY).name).toBe("O nome pode ter no máximo 150 caracteres.")
    expect(validateSignUp({ ...base, email: `${"a".repeat(250)}@x.io` }, TODAY).email).toBe("Email inválido.")
  })

  it("rejects birthdates in the future or impossibly old", () => {
    const base = { name: "Ana", email: "ana@zovic.dev", password: "12345678" }
    expect(validateSignUp({ ...base, birthdate: "2027-01-01" }, TODAY).birthdate).toBe(
      "A data de nascimento não pode estar no futuro."
    )
    expect(validateSignUp({ ...base, birthdate: "1890-01-01" }, TODAY).birthdate).toBe("Data de nascimento inválida.")
    expect(validateSignUp({ ...base, birthdate: "2010-06-28" }, TODAY)).toEqual({})
  })

  it("only follows same-site relative redirects", () => {
    expect(safeRedirectPath("/playlist/pl-1")).toBe("/playlist/pl-1")
    expect(safeRedirectPath(null)).toBe("/playlist")
    expect(safeRedirectPath("https://evil.example")).toBe("/playlist")
    expect(safeRedirectPath("//evil.example")).toBe("/playlist")
    expect(safeRedirectPath("/\\evil.example")).toBe("/playlist")
  })
})

// Codes and messages as the API really sends them (collected from a running API)
describe("API errors shown to the user", () => {
  it("does not say whether the email exists on a failed sign in", () => {
    expect(toAuthError({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" })).toEqual({
      message: "Email ou senha incorretos.",
      field: "password",
    })
  })

  it("points sign up errors at their field", () => {
    expect(toAuthError({ status: 422, code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" })).toEqual({
      message: "Já existe uma conta com esse email.",
      field: "email",
    })
    expect(toAuthError({ status: 400, code: "PASSWORD_TOO_SHORT" }).field).toBe("password")
    expect(toAuthError({ status: 400, code: "PASSWORD_TOO_LONG" }).field).toBe("password")
    expect(toAuthError({ status: 400, code: "INVALID_NAME" }).field).toBe("name")
    expect(
      toAuthError({ status: 400, code: "VALIDATION_ERROR", message: "[body.email] Invalid email address" }).field
    ).toBe("email")
    expect(
      toAuthError({ status: 400, code: "VALIDATION_ERROR", message: "birthdate must be a valid date that is not in the future" })
        .field
    ).toBe("birthdate")
  })

  it("explains the rate limit", () => {
    expect(toAuthError({ status: 429 })).toEqual({ message: "Muitas tentativas. Aguarde alguns minutos e tente de novo." })
  })

  it("never shows the raw server message for anything unexpected", () => {
    const error = toAuthError({ status: 403, code: "INVALID_ORIGIN", message: "Invalid origin" })
    expect(error.message).toBe("Algo deu errado. Tente de novo em instantes.")
    expect(error.field).toBeUndefined()
    expect(toAuthError({ status: 500, message: "relation \"user\" does not exist" }).message).not.toContain("relation")
  })

  it("has a message for when the API cannot be reached", () => {
    expect(NETWORK_ERROR.message).toContain("servidor")
  })
})
