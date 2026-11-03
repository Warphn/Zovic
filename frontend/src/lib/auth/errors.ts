import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./validation"

export interface AuthError {
  message: string
  /** Form field the error belongs to, so the form can show it under that input */
  field?: "name" | "email" | "password" | "birthdate"
}

/** Result of a sign in, sign up or sign out: only whether it worked, and why not */
export interface AuthOutcome {
  error: AuthError | null
}

/** What the API answers on failure: Better Auth sends { code, message } with the HTTP status. */
export interface ApiFailure {
  status?: number
  code?: string
  message?: string
}

export const NETWORK_ERROR: AuthError = {
  message: "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.",
}
const UNKNOWN_ERROR: AuthError = { message: "Algo deu errado. Tente de novo em instantes." }

// Server messages are in English and may carry internals, so the user only ever sees one of
// these. Anything unexpected falls back to a generic message.
export function toAuthError(failure: ApiFailure): AuthError {
  if (failure.status === 429) {
    return { message: "Muitas tentativas. Aguarde alguns minutos e tente de novo." }
  }
  switch (failure.code) {
    // Same answer for unknown email, wrong password and removed account: the API does not
    // reveal which one it was, and neither does the form.
    case "INVALID_EMAIL_OR_PASSWORD":
      return { message: "Email ou senha incorretos.", field: "password" }
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return { message: "Já existe uma conta com esse email.", field: "email" }
    case "PASSWORD_TOO_SHORT":
      return { message: `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`, field: "password" }
    case "PASSWORD_TOO_LONG":
      return { message: `A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`, field: "password" }
    case "INVALID_EMAIL":
      return { message: "Email inválido.", field: "email" }
    case "INVALID_NAME":
      return { message: "Nome inválido.", field: "name" }
    case "VALIDATION_ERROR":
      // One code for every invalid field; the message names the field
      if (failure.message?.includes("birthdate")) return { message: "Data de nascimento inválida.", field: "birthdate" }
      if (failure.message?.includes("email")) return { message: "Email inválido.", field: "email" }
      return UNKNOWN_ERROR
    default:
      return UNKNOWN_ERROR
  }
}
