import { beforeEach, describe, expect, it } from "bun:test"
import { createMockAuthClient, type KeyValueStorage } from "./mock-client"
import { safeRedirectPath, validateSignIn, validateSignUp } from "./validation"

function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

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

describe("mock auth client", () => {
  let auth: ReturnType<typeof createMockAuthClient>

  beforeEach(() => {
    auth = createMockAuthClient(memoryStorage())
  })

  it("signs up a subscriber and starts a session", async () => {
    const { data, error } = await auth.signUp.email({
      name: "Ana Andrade",
      email: "Ana@Zovic.dev",
      password: "12345678",
      birthdate: "1995-03-12",
    })
    expect(error).toBeNull()
    expect(data?.user).toMatchObject({ name: "Ana Andrade", email: "ana@zovic.dev", role: "assinante" })
    expect(auth.getSession()?.user.email).toBe("ana@zovic.dev")
  })

  it("refuses a duplicate email", async () => {
    const input = { name: "Ana", email: "ana@zovic.dev", password: "12345678", birthdate: "1995-03-12" }
    await auth.signUp.email(input)
    const { data, error } = await auth.signUp.email(input)
    expect(data).toBeNull()
    expect(error).toEqual({ message: "Já existe uma conta com esse email.", field: "email" })
  })

  it("signs in with the right password only, and signs out", async () => {
    await auth.signUp.email({ name: "Ana", email: "ana@zovic.dev", password: "12345678", birthdate: "1995-03-12" })
    await auth.signOut()
    expect(auth.getSession()).toBeNull()

    const wrong = await auth.signIn.email({ email: "ana@zovic.dev", password: "errada123" })
    expect(wrong.error).toEqual({ message: "Email ou senha incorretos.", field: "password" })
    expect(auth.getSession()).toBeNull()

    const right = await auth.signIn.email({ email: "ANA@zovic.dev", password: "12345678" })
    expect(right.error).toBeNull()
    expect(auth.getSession()?.user.name).toBe("Ana")
  })

  it("does not store the password in clear text", async () => {
    const storage = memoryStorage()
    const client = createMockAuthClient(storage)
    await client.signUp.email({ name: "Ana", email: "ana@zovic.dev", password: "segredo-123", birthdate: "1995-03-12" })
    expect(storage.getItem("zovic_auth_users")).not.toContain("segredo-123")
  })
})
