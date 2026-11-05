"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AuthLink, AuthShell, FormError, FormField, focusFirstInvalid } from "@/components/auth-form"
import { Button } from "@/components/ui/button"
import { Notice } from "@/components/ui/notice"
import { isInvalidInvitation, useInvitation } from "@/lib/api/subscriptions"
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
  const searchParams = useSearchParams()
  const next = searchParams.get("next")
  const invitationToken = searchParams.get("convite")
  // Signing up with an invitation puts the new account in the plan, so it lands on the plan page
  const destination = invitationToken ? "/meu-plano" : safeRedirectPath(next)
  const invitation = useInvitation(invitationToken)
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
    const input = { ...values, email }
    const fieldErrors = validateSignUp(input)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) {
      focusFirstInvalid(formRef.current)
      return
    }
    setIsSubmitting(true)
    const { error } = await authClient.signUp.email(input, invitationToken ?? undefined)
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

  // The invitation fixes the email: the API only accepts the invited one
  const email = invitation.data ? invitation.data.email : values.email
  const canSubmit = !invitationToken || invitation.isSuccess
  const returnPath = invitationToken ? `/convite/${invitationToken}` : next
  const signInHref = returnPath ? `/entrar?next=${encodeURIComponent(returnPath)}` : "/entrar"
  // Upper bound for the date picker; computed once per visit
  const [today] = React.useState(() => new Date().toISOString().slice(0, 10))

  return (
    <AuthShell
      title="Criar conta"
      description="Sua data de nascimento define os conteúdos adequados à sua faixa etária"
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
          value={email}
          readOnly={Boolean(invitation.data)}
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
        {invitationToken && invitation.isError && (
          <Notice>
            {isInvalidInvitation(invitation.error)
              ? "Este convite é inválido, expirou ou já foi usado. Peça um novo link a quem gerencia o plano."
              : "Não foi possível verificar o convite. Recarregue a página para tentar de novo."}
          </Notice>
        )}
        {invitation.data && (
          <Notice tone="info">
            Você foi convidado por {invitation.data.managerName} para o plano Família. Este cadastro usa o email do convite.
          </Notice>
        )}
        <FormError message={formError} />
        <Button type="submit" size="lg" disabled={isSubmitting || !canSubmit} className="h-12 w-full text-sm">
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
