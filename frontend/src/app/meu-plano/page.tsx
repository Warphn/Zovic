"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Notice } from "@/components/ui/notice"
import { subscriptionClient, subscriptionMessage, useSubscription } from "@/lib/subscription/client"
import { type Account, isAdultOn, type Member, planType, todayInSaoPaulo } from "@/lib/subscription/rules"

const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const since = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" })

type Pending = { kind: "remove"; member: Member } | { kind: "leave" } | { kind: "cancel" }

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
  const router = useRouter()
  const { account, subscription } = useSubscription()
  const [pending, setPending] = React.useState<Pending | null>(null)

  if (!account) return null
  if (!subscription) {
    return (
      <>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Meu plano</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Você ainda não tem uma assinatura.{" "}
          <Link href="/planos" className="font-semibold text-foreground underline underline-offset-2">
            Ver planos
          </Link>
        </p>
      </>
    )
  }

  const type = planType(subscription.typeId)
  const today = todayInSaoPaulo()
  const me = subscription.members.find((m) => m.email === account.email.toLowerCase())
  const isOwner = Boolean(me?.isOwner)
  const isFamily = type.id === "familia"
  const full = subscription.members.length >= type.maxMembers

  const confirm = async () => {
    if (!pending) return
    if (pending.kind === "remove") await subscriptionClient.removeMember(account, pending.member.email)
    if (pending.kind === "leave") await subscriptionClient.leave(account)
    if (pending.kind === "cancel") await subscriptionClient.cancel(account)
    if (pending.kind !== "remove") router.push("/planos")
  }

  return (
    <>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Meu plano</h1>

      <section className="mt-6 rounded-2xl bg-surface/70 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight">Plano {type.name}</h2>
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{price.format(type.price)}</span>
            <span className="text-muted-foreground"> /mês</span>
          </p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Desde {since.format(new Date(subscription.createdAt))}</p>
      </section>

      <section className="mt-4 rounded-2xl bg-surface/70 p-6" aria-labelledby="members-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="members-title" className="text-base font-bold tracking-tight">
            {isFamily ? "Pessoas no plano" : "Perfil"}
          </h2>
          {isFamily && (
            <span className="text-sm tabular-nums text-muted-foreground">
              {subscription.members.length} de {type.maxMembers}
            </span>
          )}
        </div>
        <ul className="mt-3 divide-y divide-border/70">
          {subscription.members.map((member) => {
            const adult = isAdultOn(member.birthdate, today)
            const isMe = member.email === me?.email
            return (
              <li key={member.email} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {member.name}
                    {isMe && <span className="text-muted-foreground"> (você)</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {member.isOwner && <Badge className="text-[10px]">Titular</Badge>}
                  {!adult && (
                    <Badge variant="outline" className="text-[10px]">
                      Menor de idade
                    </Badge>
                  )}
                  {isOwner && !member.isOwner && (
                    <Button variant="ghost" className="text-destructive" onClick={() => setPending({ kind: "remove", member })}>
                      Remover
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        {isFamily && isOwner && !full && <AddMemberForm account={account} />}
        {isFamily && isOwner && full && (
          <p className="mt-3 text-xs text-muted-foreground">O plano está completo. Remova alguém para incluir outra pessoa.</p>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {isOwner ? (
          <Button variant="ghost" className="text-destructive" size="lg" onClick={() => setPending({ kind: "cancel" })}>
            Cancelar assinatura
          </Button>
        ) : (
          <Button variant="ghost" className="text-destructive" size="lg" onClick={() => setPending({ kind: "leave" })}>
            Sair do plano
          </Button>
        )}
        <Link href="/planos" className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium hover:bg-muted">
          Ver planos
        </Link>
      </div>

      <ConfirmPending pending={pending} onClose={() => setPending(null)} onConfirm={confirm} />
    </>
  )
}

function AddMemberForm({ account }: { account: Account }) {
  const empty = { name: "", email: "", birthdate: "" }
  const [form, setForm] = React.useState(empty)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const set = (field: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [field]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await subscriptionClient.addMember(account, form)
      setForm(empty)
    } catch (err) {
      setError(subscriptionMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t border-border/70 pt-4">
      <div>
        <h3 className="text-sm font-semibold">Incluir uma pessoa</h3>
        <p className="text-xs text-muted-foreground">
          Ela entra com a própria conta, pelo mesmo email. Menores de idade não veem conteúdo explícito.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem]">
        <Field label="Nome" id="member-name">
          <Input id="member-name" required maxLength={150} value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Email" id="member-email">
          <Input id="member-email" type="email" required value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Data de nascimento" id="member-birthdate">
          <Input id="member-birthdate" type="date" required value={form.birthdate} onChange={set("birthdate")} />
        </Field>
      </div>
      {error && <Notice>{error}</Notice>}
      <Button type="submit" size="lg" disabled={saving}>
        {saving ? "Incluindo…" : "Incluir no plano"}
      </Button>
    </form>
  )
}

const CONFIRM_TEXT: Record<Pending["kind"], { title: string; description: string; action: string }> = {
  remove: {
    title: "Remover do plano?",
    description: "A pessoa perde o acesso ao catálogo até entrar em outro plano.",
    action: "Remover",
  },
  leave: {
    title: "Sair do plano?",
    description: "Você perde o acesso ao catálogo até assinar ou entrar em outro plano.",
    action: "Sair do plano",
  },
  cancel: {
    title: "Cancelar a assinatura?",
    description: "O acesso ao catálogo termina agora. Você pode assinar de novo quando quiser.",
    action: "Cancelar assinatura",
  },
}

function ConfirmPending({
  pending,
  onClose,
  onConfirm,
}: {
  pending: Pending | null
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const text = pending ? CONFIRM_TEXT[pending.kind] : null

  const close = () => {
    setError(null)
    onClose()
  }

  const confirm = async () => {
    setSaving(true)
    try {
      await onConfirm()
      close()
    } catch (err) {
      setError(subscriptionMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {pending?.kind === "remove" ? `Remover ${pending.member.name} do plano?` : text?.title}
          </DialogTitle>
          <DialogDescription>{text?.description}</DialogDescription>
        </DialogHeader>
        {error && <Notice>{error}</Notice>}
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={close}>
            Voltar
          </Button>
          <Button variant="destructive" size="lg" onClick={confirm} disabled={saving}>
            {text?.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
