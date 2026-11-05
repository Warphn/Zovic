"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FamilyManager } from "@/components/plan/family-manager"
import { LeavePlan } from "@/components/plan/leave-plan"
import { Notice } from "@/components/ui/notice"
import { apiErrorMessage } from "@/lib/api/client"
import { type Subscription, useCancelSubscription, useSubscription } from "@/lib/api/subscriptions"
import { stopPlayback } from "@/lib/playback-store"
import { planType } from "@/lib/subscription/rules"

const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const since = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" })

export default function MyPlanPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground">
      <Header />
      <main className="flex-1 pt-16">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 md:px-8 py-10">
          <MyPlan />
        </div>
      </main>
    </div>
  )
}

function MyPlan() {
  const { subscription, isPending, isError } = useSubscription()
  const [isConfirming, setIsConfirming] = React.useState(false)

  if (isPending) return null

  return (
    <>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Meu plano</h1>

      {isError && (
        <div className="mt-3">
          <Notice>Não foi possível verificar a sua assinatura. Recarregue a página para tentar de novo.</Notice>
        </div>
      )}

      {!isError && !subscription && (
        <p className="mt-3 text-sm text-muted-foreground">
          Você ainda não tem uma assinatura.{" "}
          <Link href="/planos" className="font-semibold text-foreground underline underline-offset-2">
            Ver planos
          </Link>
        </p>
      )}

      {subscription && (
        <>
          <PlanSummary subscription={subscription} />
          {subscription.kind === "family" && subscription.isManager && <FamilyManager />}
          <div className="mt-6 flex flex-wrap gap-2">
            {subscription.isManager && (
              <Button variant="ghost" className="text-destructive" size="lg" onClick={() => setIsConfirming(true)}>
                Cancelar assinatura
              </Button>
            )}
            {subscription.kind === "family" && !subscription.isManager && <LeavePlan />}
            <Link href="/planos" className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium hover:bg-muted">
              Ver planos
            </Link>
          </div>
          <ConfirmCancel subscription={subscription} isOpen={isConfirming} onClose={() => setIsConfirming(false)} />
        </>
      )}
    </>
  )
}

function PlanSummary({ subscription }: { subscription: Subscription }) {
  const type = planType(subscription.kind)
  return (
    <section className="mt-6 rounded-2xl bg-surface/70 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold tracking-tight">Plano {type.name}</h2>
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{price.format(type.price)}</span>
          <span className="text-muted-foreground"> /mês</span>
        </p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Desde {since.format(new Date(subscription.startedAt))}</p>
      {!subscription.isManager && (
        <p className="mt-3 text-sm text-muted-foreground">Você é membro deste plano. Só quem o gerencia pode cancelar a assinatura.</p>
      )}
    </section>
  )
}

function ConfirmCancel({
  subscription,
  isOpen,
  onClose,
}: {
  subscription: Subscription
  isOpen: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const cancel = useCancelSubscription()

  const close = () => {
    cancel.reset()
    onClose()
  }

  // mutateAsync, not mutate's onSuccess: reloading the subscription unmounts this dialog, and
  // React Query skips the callbacks of an unmounted component
  const confirm = async () => {
    try {
      await cancel.mutateAsync()
    } catch {
      return // the dialog shows cancel.error
    }
    stopPlayback()
    router.push("/planos")
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar a assinatura?</DialogTitle>
          <DialogDescription>
            {subscription.kind === "family"
              ? "O acesso ao catálogo termina agora para todas as pessoas do plano. As contas continuam."
              : "O acesso ao catálogo termina agora. Você pode assinar de novo quando quiser."}
          </DialogDescription>
        </DialogHeader>
        {cancel.isError && <Notice>{apiErrorMessage(cancel.error)}</Notice>}
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={close}>
            Voltar
          </Button>
          <Button variant="destructive" size="lg" onClick={confirm} disabled={cancel.isPending}>
            Cancelar assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
