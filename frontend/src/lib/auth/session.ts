// Platform role (issue #1). Visitors have no account, so they have no session at all.
export type Role = "admin" | "assinante"

export interface SessionUser {
  id: string
  name: string
  email: string
  birthdate: string | null
  role: Role
  /** Decided by the API from the birthdate on every request (18 or older) */
  isAdult: boolean
}

export interface Session {
  user: SessionUser
}

/** The user as the API's get-session sends it, before checking the fields this app relies on */
interface ApiSessionUser {
  id: string
  name: string
  email: string
  birthdate?: string | null
  role?: unknown
  isAdult?: unknown
}

// Only an explicit "admin" or `true` grants anything: a missing or unexpected value falls back
// to the most restricted access. This is display only; the API enforces access on its side.
export function toSession({ user }: { user: ApiSessionUser }): Session {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      birthdate: user.birthdate ?? null,
      role: user.role === "admin" ? "admin" : "assinante",
      isAdult: user.isAdult === true,
    },
  }
}
