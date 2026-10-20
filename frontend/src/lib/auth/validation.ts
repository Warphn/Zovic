export interface SignInInput {
  email: string
  password: string
}

export interface SignUpInput extends SignInInput {
  name: string
  /** ISO date (YYYY-MM-DD), as an <input type="date"> gives it */
  birthdate: string
}

export type FieldErrors<T> = Partial<Record<keyof T, string>>

export const MIN_PASSWORD_LENGTH = 8
const MAX_AGE_YEARS = 120
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Informe seu email."
  if (!EMAIL_PATTERN.test(email.trim())) return "Email inválido."
  return undefined
}

function validateBirthdate(birthdate: string, today: Date): string | undefined {
  if (!birthdate) return "Informe sua data de nascimento."
  const date = new Date(`${birthdate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return "Data de nascimento inválida."
  if (date > today) return "A data de nascimento não pode estar no futuro."
  const oldest = new Date(today)
  oldest.setUTCFullYear(today.getUTCFullYear() - MAX_AGE_YEARS)
  if (date < oldest) return "Data de nascimento inválida."
  return undefined
}

function withoutEmpty<T>(errors: FieldErrors<T>): FieldErrors<T> {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message)) as FieldErrors<T>
}

export function validateSignIn(input: SignInInput): FieldErrors<SignInInput> {
  return withoutEmpty<SignInInput>({
    email: validateEmail(input.email),
    password: input.password ? undefined : "Informe sua senha.",
  })
}

export function validateSignUp(input: SignUpInput, today: Date = new Date()): FieldErrors<SignUpInput> {
  return withoutEmpty<SignUpInput>({
    name: input.name.trim() ? undefined : "Informe seu nome.",
    email: validateEmail(input.email),
    password:
      input.password.length >= MIN_PASSWORD_LENGTH
        ? undefined
        : `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    birthdate: validateBirthdate(input.birthdate, today),
  })
}

export const DEFAULT_AFTER_LOGIN = "/playlist"

// `next` comes from the URL, so only same-site paths are followed (no open redirect).
export function safeRedirectPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN
  }
  return next
}
