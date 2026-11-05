"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Notice } from "@/components/ui/notice"
import Header from "@/components/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { safeRedirectPath } from "@/lib/auth/validation"
import { apiErrorMessage } from "@/lib/api/client"
import { useSubscribe, useSubscription } from "@/lib/api/subscriptions"
import { PLAN_TYPES, type PlanType } from "@/lib/subscription/rules"
import { cn } from "@/lib/utils"

const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

const PERKS: Record<PlanType["id"], string[]> = {
  individual: ["1 perfil de acesso", "Todo o catálogo", "Histórico e recomendações só seus"],
  family: [
    "Até 4 pessoas, cada uma com o próprio perfil",
    "Menores de 18 anos entram com conta infantil",
    "Quem assina gerencia quem entra e sai",
  ],
}

function PlansContent() {
  const router = useRouter()
  const next = useSearchParams().get("next")
  const { account, subscription, isPending, isError } = useSubscription()
  const subscribe = useSubscribe()
  const [choosing, setChoosing] = React.useState<PlanType | null>(null)

  const confirm = async () => {
    if (!choosing) return
    try {
      await subscribe.mutateAsync(choosing.id)
    } catch {
      return // the dialog shows subscribe.error
    }
    setChoosing(null)
    router.push(next ? safeRedirectPath(next) : "/meu-plano")
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 md:px-8 py-10">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Planos</h1>
      <p className="mt-2 text-sm text-muted-foreground">Escolha como você quer ouvir. Dá para cancelar quando quiser.</p>

      <div className="mt-6 space-y-3">
        {next && !subscription && account && <Notice tone="info">Para ouvir, você precisa de uma assinatura.</Notice>}
        {isError && <Notice>Não foi possível verificar a sua assinatura. Recarregue a página para tentar de novo.</Notice>}
        {account && !account.isAdult && !subscription && !isPending && !isError && (
          <Notice tone="info">Só maiores de 18 anos podem assinar.</Notice>
        )}
        {subscription && (
          <Notice tone="info">
            Você já tem uma assinatura.{" "}
            <Link href="/meu-plano" className="font-semibold underline underline-offset-2">
              Ver meu plano
            </Link>
          </Notice>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {PLAN_TYPES.map((plan) => {
          const current = subscription?.kind === plan.id
          return (
            <section
              key={plan.id}
              aria-labelledby={`plan-${plan.id}`}
              className={cn(
                "flex flex-col rounded-2xl bg-surface/70 p-6",
                current && "ring-2 ring-[var(--color-red)]"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 id={`plan-${plan.id}`} className="text-lg font-bold tracking-tight">
                  {plan.name}
                </h2>
                {current && <Badge className="text-[10px]">Seu plano</Badge>}
              </div>
              <p className="mt-3">
                <span className="text-3xl font-black tabular-nums tracking-tight">{price.format(plan.price)}</span>
                <span className="text-sm text-muted-foreground"> /mês</span>
              </p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                {PERKS[plan.id].map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <span aria-hidden="true" className="text-[var(--color-red)]">
                      ✓
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isPending ? null : !account ? (
                  <Link
                    href={`/cadastro?next=${encodeURIComponent("/planos")}`}
                    className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/85"
                  >
                    Criar conta para assinar
                  </Link>
                ) : current ? (
                  <Link
                    href="/meu-plano"
                    className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border text-sm font-semibold hover:bg-muted/30"
                  >
                    Gerenciar plano
                  </Link>
                ) : (
                  <Button
                    size="lg"
                    className="h-9 w-full text-sm font-semibold"
                    disabled={!account.isAdult || Boolean(subscription) || isError}
                    onClick={() => {
                      subscribe.reset()
                      setChoosing(plan)
                    }}
                  >
                    Assinar {plan.name}
                  </Button>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <Dialog open={choosing !== null} onOpenChange={(open) => !open && setChoosing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinar o plano {choosing?.name}?</DialogTitle>
            <DialogDescription>
              {choosing && `${price.format(choosing.price)} por mês.`} O pagamento ainda é simulado: a assinatura começa na hora.
            </DialogDescription>
          </DialogHeader>
          {subscribe.isError && <Notice>{apiErrorMessage(subscribe.error)}</Notice>}
          <DialogFooter>
            <Button variant="ghost" size="lg" onClick={() => setChoosing(null)}>
              Cancelar
            </Button>
            <Button size="lg" onClick={confirm} disabled={subscribe.isPending}>
              {subscribe.isPending ? "Assinando…" : "Confirmar assinatura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 selection:text-foreground">
      <Header />
      <main className="flex-1 pt-16">
        {/* useSearchParams needs a Suspense boundary so the page can still prerender */}
        <React.Suspense fallback={null}>
          <PlansContent />
        </React.Suspense>
      </main>
    </div>
  )
}
