"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthLink, AuthShell, FormError, FormField, focusFirstInvalid } from "@/components/auth-form"
import { Button } from "@/components/ui/button"
import { authClient, useSession } from "@/lib/auth/client"
import { type FieldErrors, type SignInInput, safeRedirectPath, validateSignIn } from "@/lib/auth/validation"

function SignInForm() {
  const router = useRouter()
  const next = useSearchParams().get("next")
  const destination = safeRedirectPath(next)
  const { data: session } = useSession()

  const formRef = React.useRef<HTMLFormElement>(null)
  const [values, setValues] = React.useState<SignInInput>({ email: "", password: "" })
  const [errors, setErrors] = React.useState<FieldErrors<SignInInput>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Already signed in (or just signed in): go where the visitor was heading
  React.useEffect(() => {
    if (session) router.replace(destination)
  }, [session, destination, router])

  const update = (field: keyof SignInInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const fieldErrors = validateSignIn(values)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) {
      focusFirstInvalid(formRef.current)
      return
    }
    setIsSubmitting(true)
    const { error } = await authClient.signIn.email(values)
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

  const signUpHref = next ? `/cadastro?next=${encodeURIComponent(next)}` : "/cadastro"

  return (
    <AuthShell
      title="Entrar"
      description="Acesse suas playlists e continue ouvindo de onde parou."
      footer={
        <>
          Não tem conta? <AuthLink href={signUpHref}>Criar conta</AuthLink>
        </>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormField
          id="signin-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update("email")}
          error={errors.email}
        />
        <FormField
          id="signin-password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={update("password")}
          error={errors.password}
        />
        <FormError message={formError} />
        <Button type="submit" size="lg" disabled={isSubmitting} className="h-10 w-full text-sm font-semibold">
          {isSubmitting ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  )
}

export default function SignInPage() {
  // useSearchParams needs a Suspense boundary so the page can still prerender
  return (
    <React.Suspense fallback={null}>
      <SignInForm />
    </React.Suspense>
  )
}
