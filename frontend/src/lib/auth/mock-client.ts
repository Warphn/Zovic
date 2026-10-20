import type { SignInInput, SignUpInput } from "./validation"

// Stand-in for the real auth until the API has login (issue Warphn/Zovic#1).
// The surface mirrors BetterAuth's client (signIn.email, signUp.email, signOut, a session
// with a user), so switching to `createAuthClient` from better-auth/react stays local to
// src/lib/auth. Accounts live in this browser only: this is not security, just a dev mock.

export type Role = "admin" | "assinante"

export interface SessionUser {
  id: string
  name: string
  email: string
  birthdate: string
  role: Role
}

export interface Session {
  user: SessionUser
}

export interface AuthError {
  message: string
  /** Form field the error belongs to, so the form can show it under that input */
  field?: "email" | "password"
}

export type AuthResult<T> = { data: T; error: null } | { data: null; error: AuthError }

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface StoredUser extends SessionUser {
  salt: string
  passwordHash: string
}

const USERS_KEY = "zovic_auth_users"
const SESSION_KEY = "zovic_auth_session"

async function hashPassword(password: string, salt: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("")
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const toSessionUser = ({ id, name, email, birthdate, role }: StoredUser): SessionUser => ({
  id,
  name,
  email,
  birthdate,
  role,
})

export function createMockAuthClient(storage: KeyValueStorage) {
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())

  const readUsers = (): StoredUser[] => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(USERS_KEY) ?? "[]")
      return Array.isArray(parsed) ? (parsed as StoredUser[]) : []
    } catch {
      return []
    }
  }

  // Cached by raw value so useSyncExternalStore gets a stable snapshot between changes
  let cachedRaw: string | null = null
  let cachedSession: Session | null = null
  const getSession = (): Session | null => {
    const raw = storage.getItem(SESSION_KEY)
    if (raw === cachedRaw) return cachedSession
    cachedRaw = raw
    try {
      cachedSession = raw ? (JSON.parse(raw) as Session) : null
    } catch {
      cachedSession = null
    }
    return cachedSession
  }

  const startSession = (user: StoredUser): Session => {
    const session = { user: toSessionUser(user) }
    storage.setItem(SESSION_KEY, JSON.stringify(session))
    notify()
    return session
  }

  return {
    getSession,

    subscribe(listener: () => void) {
      listeners.add(listener)
      // Keeps other tabs in sync when the session changes there
      const onStorage = (e: StorageEvent) => {
        if (e.key === SESSION_KEY) listener()
      }
      if (typeof window !== "undefined") window.addEventListener("storage", onStorage)
      return () => {
        listeners.delete(listener)
        if (typeof window !== "undefined") window.removeEventListener("storage", onStorage)
      }
    },

    signUp: {
      async email(input: SignUpInput): Promise<AuthResult<Session>> {
        const users = readUsers()
        const email = normalizeEmail(input.email)
        if (users.some((user) => user.email === email)) {
          return { data: null, error: { message: "Já existe uma conta com esse email.", field: "email" } }
        }
        const salt = crypto.randomUUID()
        const user: StoredUser = {
          id: crypto.randomUUID(),
          name: input.name.trim(),
          email,
          birthdate: input.birthdate,
          role: "assinante",
          salt,
          passwordHash: await hashPassword(input.password, salt),
        }
        storage.setItem(USERS_KEY, JSON.stringify([...users, user]))
        return { data: startSession(user), error: null }
      },
    },

    signIn: {
      async email(input: SignInInput): Promise<AuthResult<Session>> {
        const user = readUsers().find((u) => u.email === normalizeEmail(input.email))
        const matches = user && (await hashPassword(input.password, user.salt)) === user.passwordHash
        if (!user || !matches) {
          return { data: null, error: { message: "Email ou senha incorretos.", field: "password" } }
        }
        return { data: startSession(user), error: null }
      },
    },

    async signOut(): Promise<void> {
      storage.removeItem(SESSION_KEY)
      notify()
    },
  }
}
