"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthLink, AuthShell, FormError, FormField, focusFirstInvalid } from "@/components/auth-form"
import { Button } from "@/components/ui/button"
import { authClient, useSession } from "@/lib/auth/client"
import {
  type FieldErrors,
  MIN_PASSWORD_LENGTH,
  type SignUpInput,
  safeRedirectPath,
  validateSignUp,
} from "@/lib/auth/validation"

function SignUpForm() {
  const router = useRouter()
  const next = useSearchParams().get("next")
  const destination = safeRedirectPath(next)
  const { data: session } = useSession()

  const formRef = React.useRef<HTMLFormElement>(null)
  const [values, setValues] = React.useState<SignUpInput>({ name: "", email: "", password: "", birthdate: "" })
  const [errors, setErrors] = React.useState<FieldErrors<SignUpInput>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Signing up also signs in: once the session exists, continue to the destination
  React.useEffect(() => {
    if (session) router.replace(destination)
  }, [session, destination, router])

  const update = (field: keyof SignUpInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const fieldErrors = validateSignUp(values)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) {
      focusFirstInvalid(formRef.current)
      return
    }
    setIsSubmitting(true)
    const { error } = await authClient.signUp.email(values)
    setIsSubmitting(false)
    if (!error) return
    // Errors tied to a field show under that input; anything else goes in the form-level box
    if (error.field) {
      setErrors({ [error.field]: error.message })
      focusFirstInvalid(formRef.current)
    } else {
      setFormError(error.message)
    }
  }

  const signInHref = next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar"
  // Upper bound for the date picker; computed once per visit
  const [today] = React.useState(() => new Date().toISOString().slice(0, 10))

  return (
    <AuthShell
      title="Criar conta"
      description="Sua data de nascimento define os conteúdos adequados à sua faixa etária."
      footer={
        <>
          Já tem conta? <AuthLink href={signInHref}>Entrar</AuthLink>
        </>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormField
          id="signup-name"
          label="Nome"
          autoComplete="name"
          value={values.name}
          onChange={update("name")}
          error={errors.name}
        />
        <FormField
          id="signup-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update("email")}
          error={errors.email}
        />
        <FormField
          id="signup-password"
          label="Senha"
          type="password"
          autoComplete="new-password"
          placeholder={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`}
          value={values.password}
          onChange={update("password")}
          error={errors.password}
        />
        <FormField
          id="signup-birthdate"
          label="Data de nascimento"
          type="date"
          autoComplete="bday"
          max={today}
          value={values.birthdate}
          onChange={update("birthdate")}
          error={errors.birthdate}
        />
        <FormError message={formError} />
        <Button type="submit" size="lg" disabled={isSubmitting} className="h-10 w-full text-sm font-semibold">
          {isSubmitting ? "Criando conta…" : "Criar conta"}
        </Button>
      </form>
    </AuthShell>
  )
}

export default function SignUpPage() {
  // useSearchParams needs a Suspense boundary so the page can still prerender
  return (
    <React.Suspense fallback={null}>
      <SignUpForm />
    </React.Suspense>
  )
}
