"use client"

import * as React from "react"
import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"
import { type ApiFailure, type AuthOutcome, NETWORK_ERROR, toAuthError } from "./errors"
import { type Session, toSession } from "./session"
import type { SignInInput, SignUpInput } from "./validation"

// The browser talks to the API directly: Better Auth lives at <API_URL>/api/auth, the session is
// an httpOnly cookie set by the API, and the API allows this site through CORS_ORIGIN.
// Inlined at build time; the default matches `bun dev` and the docker compose setup.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"

const betterAuth = createAuthClient({
  baseURL: API_URL,
  // Additional user fields on the API (api/adapters/auth/create-auth.ts); role is read-only
  plugins: [
    inferAdditionalFields({
      user: {
        birthdate: { type: "string", required: true },
        role: { type: "string", input: false },
      },
    }),
  ],
})

export type { Role, Session, SessionUser } from "./session"

// Only the outcome leaves this module: the response body also carries the session token, and
// nothing in the page needs it (the cookie is what authenticates).
async function run(request: () => Promise<{ error: ApiFailure | null }>): Promise<AuthOutcome> {
  try {
    const { error } = await request()
    return { error: error ? toAuthError(error) : null }
  } catch {
    // fetch itself failed: API down, offline, or blocked by CORS
    return { error: NETWORK_ERROR }
  }
}

export const authClient = {
  signIn: {
    email: ({ email, password }: SignInInput) =>
      run(() => betterAuth.signIn.email({ email: email.trim(), password })),
  },

  signUp: {
    email: ({ name, email, password, birthdate }: SignUpInput) =>
      run(() => betterAuth.signUp.email({ name: name.trim(), email: email.trim(), password, birthdate })),
  },

  // On failure the session stays as it was, so the header keeps showing the account
  signOut: () => run(() => betterAuth.signOut()),
}

// Signing in, up or out refreshes this on its own. The server cannot see the session, so it
// renders "pending"; the client resolves it after hydration.
export function useSession(): { data: Session | null; isPending: boolean } {
  const { data, isPending } = betterAuth.useSession()
  // Memoized so pages that depend on the session object do not re-run effects on every render
  const session = React.useMemo(() => (data ? toSession(data) : null), [data])
  return { data: session, isPending }
}
