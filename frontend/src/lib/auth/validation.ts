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

// Same limits as the API (api/adapters/auth/create-auth.ts), so the form catches them first
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128
const NAME_MAX_LENGTH = 150
const EMAIL_MAX_LENGTH = 254
const MAX_AGE_YEARS = 120
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Informe seu email."
  if (!EMAIL_PATTERN.test(email.trim()) || email.trim().length > EMAIL_MAX_LENGTH) return "Email inválido."
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

function validateName(name: string): string | undefined {
  if (!name.trim()) return "Informe seu nome."
  if (name.trim().length > NAME_MAX_LENGTH) return `O nome pode ter no máximo ${NAME_MAX_LENGTH} caracteres.`
  return undefined
}

function validateNewPassword(password: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
  if (password.length > MAX_PASSWORD_LENGTH) return `A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`
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
    name: validateName(input.name),
    email: validateEmail(input.email),
    password: validateNewPassword(input.password),
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
