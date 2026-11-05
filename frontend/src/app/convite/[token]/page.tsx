"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Notice } from "@/components/ui/notice"
import { apiErrorMessage } from "@/lib/api/client"
import {
  type InvitationPreview,
  isInvalidInvitation,
  useAcceptInvitation,
  useInvitation,
  useSubscription,
} from "@/lib/api/subscriptions"
import { authClient } from "@/lib/auth/client"

const expiry = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" })

const linkButtonClasses =
  "inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold"

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>()
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-xl mx-auto w-full px-4 sm:px-6 md:px-8 py-10">
          <Invitation token={token} />
        </div>
      </main>
    </div>
  )
}

function Invitation({ token }: { token: string }) {
  const invitation = useInvitation(token)

  if (invitation.isPending) return null

  if (invitation.isError) {
    return (
      <>
        <h1 className="text-3xl font-black tracking-tight">Convite para o plano Família</h1>
        <div className="mt-4">
          <Notice>
            {isInvalidInvitation(invitation.error)
              ? "Este convite é inválido, expirou ou já foi usado. Peça um novo link a quem gerencia o plano."
              : "Não foi possível verificar o convite. Recarregue a página para tentar de novo."}
          </Notice>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="text-3xl font-black tracking-tight">Convite para o plano Família</h1>
      <section className="mt-6 rounded-2xl bg-surface/70 p-6">
        <p className="text-sm">
          <span className="font-semibold">{invitation.data.managerName}</span> convidou{" "}
          <span className="font-semibold">{invitation.data.email}</span> para o plano Família do Zovic.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          O convite vale até {expiry.format(new Date(invitation.data.expiresAt))}.
        </p>
        <div className="mt-6">
          <InvitationActions token={token} invitation={invitation.data} />
        </div>
      </section>
    </>
  )
}

// What the visitor can do depends on who they are. The API decides on accept; this only avoids
// offering a button that is sure to fail.
function InvitationActions({ token, invitation }: { token: string; invitation: InvitationPreview }) {
  const { account, subscription, isPending, isError } = useSubscription()
  const returnPath = `/convite/${token}`

  if (isPending) return null

  if (!account) {
    return (
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/entrar?next=${encodeURIComponent(returnPath)}`}
          className={`${linkButtonClasses} bg-primary text-primary-foreground hover:bg-primary/85`}
        >
          Entrar
        </Link>
        <Link
          href={`/cadastro?convite=${encodeURIComponent(token)}`}
          className={`${linkButtonClasses} border border-border hover:bg-muted/30`}
        >
          Criar conta
        </Link>
      </div>
    )
  }

  if (account.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return <WrongAccount accountEmail={account.email} />
  }

  if (isError) {
    return <Notice>Não foi possível verificar a sua assinatura. Recarregue a página para tentar de novo.</Notice>
  }

  if (subscription) {
    return (
      <div className="space-y-3">
        <Notice tone="info">Você já tem uma assinatura ativa. Saia ou cancele o plano atual antes de aceitar este convite.</Notice>
        <Link href="/meu-plano" className={`${linkButtonClasses} border border-border hover:bg-muted/30`}>
          Ir para Meu plano
        </Link>
      </div>
    )
  }

  return <AcceptInvitation token={token} />
}

function WrongAccount({ accountEmail }: { accountEmail: string }) {
  const [signOutError, setSignOutError] = React.useState<string | null>(null)

  // Signing out turns this page into the visitor's view, with the sign in and sign up buttons
  const signOut = async () => {
    const { error } = await authClient.signOut()
    setSignOutError(error ? error.message : null)
  }

  return (
    <div className="space-y-3">
      <Notice tone="info">
        Este convite é de outro email. Você está com a conta {accountEmail}. Entre com a conta do email convidado para aceitar.
      </Notice>
      {signOutError && <Notice>{signOutError}</Notice>}
      <Button variant="outline" size="lg" onClick={signOut}>
        Sair desta conta
      </Button>
    </div>
  )
}

function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter()
  const accept = useAcceptInvitation()

  // mutateAsync, not mutate's onSuccess: reloading the subscription unmounts this button, and
  // React Query skips the callbacks of an unmounted component
  const confirm = async () => {
    try {
      await accept.mutateAsync(token)
    } catch {
      return // the page shows accept.error
    }
    router.push("/meu-plano")
  }

  return (
    <div className="space-y-3">
      {accept.isError && <Notice>{apiErrorMessage(accept.error)}</Notice>}
      <Button size="lg" onClick={confirm} disabled={accept.isPending}>
        {accept.isPending ? "Aceitando…" : "Aceitar convite"}
      </Button>
    </div>
  )
}
