"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Notice } from "@/components/ui/notice"
import { apiErrorMessage } from "@/lib/api/client"
import {
  type CreatedInvitation,
  type PendingInvitation,
  type PlanMember,
  type PlanMembers,
  useCancelInvitation,
  useInviteToPlan,
  usePlanMembers,
  useRemoveMember,
} from "@/lib/api/subscriptions"
import { InvitationLinkDialog } from "./invitation-link-dialog"

const expiry = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" })

// The family plan as its manager runs it: who is in, who was invited, and the invite form.
// The API owns the rules (limit, duplicates, who may do what); this only shows and asks.
export function FamilyManager() {
  const { data, isPending, isError } = usePlanMembers(true)

  if (isPending) return null
  if (isError) return <Notice>Não foi possível carregar os membros do plano. Recarregue a página para tentar de novo.</Notice>

  return (
    <section aria-labelledby="family-members" className="mt-6 rounded-2xl bg-surface/70 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="family-members" className="text-xl font-bold tracking-tight">
          Pessoas do plano
        </h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">
            {data.limit - data.freeSlots} de {data.limit}
          </span>{" "}
          vagas ocupadas
        </p>
      </div>
      <MemberList members={data.members} />
      <PendingInvitations invitations={data.pendingInvitations} />
      <InviteForm plan={data} />
    </section>
  )
}

function MemberList({ members }: { members: PlanMember[] }) {
  const [memberToRemove, setMemberToRemove] = React.useState<PlanMember | null>(null)
  return (
    <>
      <ul className="mt-4 divide-y divide-border">
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {member.name}
                {member.isManager && <span className="font-normal text-muted-foreground"> · gestor</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{member.email}</p>
            </div>
            {!member.isManager && (
              <Button variant="ghost" className="text-destructive" size="lg" onClick={() => setMemberToRemove(member)}>
                Remover
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmRemoveMember member={memberToRemove} onClose={() => setMemberToRemove(null)} />
    </>
  )
}

function ConfirmRemoveMember({ member, onClose }: { member: PlanMember | null; onClose: () => void }) {
  const remove = useRemoveMember()

  const close = () => {
    remove.reset()
    onClose()
  }

  const confirm = async () => {
    if (!member) return
    try {
      await remove.mutateAsync(member.id)
    } catch {
      return // the dialog shows remove.error
    }
    close()
  }

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover {member?.name}?</DialogTitle>
          <DialogDescription>
            Essa pessoa perde o acesso ao catálogo agora. A conta dela continua, e a vaga fica livre para um novo convite.
          </DialogDescription>
        </DialogHeader>
        {remove.isError && <Notice>{apiErrorMessage(remove.error)}</Notice>}
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={close}>
            Voltar
          </Button>
          <Button variant="destructive" size="lg" onClick={confirm} disabled={remove.isPending}>
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PendingInvitations({ invitations }: { invitations: PendingInvitation[] }) {
  const cancel = useCancelInvitation()

  if (invitations.length === 0) return null

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold">Convites pendentes</h3>
      <ul className="mt-1 divide-y divide-border">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm">{invitation.email}</p>
              <p className="text-xs text-muted-foreground">Vale até {expiry.format(new Date(invitation.expiresAt))}</p>
            </div>
            <Button
              variant="ghost"
              className="text-destructive"
              size="lg"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(invitation.id)}
            >
              Cancelar
            </Button>
          </li>
        ))}
      </ul>
      {cancel.isError && (
        <div className="mt-2">
          <Notice>{apiErrorMessage(cancel.error)}</Notice>
        </div>
      )}
    </div>
  )
}

function InviteForm({ plan }: { plan: PlanMembers }) {
  const invite = useInviteToPlan()
  const [email, setEmail] = React.useState("")
  const [created, setCreated] = React.useState<CreatedInvitation | null>(null)
  const hasFreeSlot = plan.freeSlots > 0

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setCreated(await invite.mutateAsync(email.trim()))
    } catch {
      return // the form shows invite.error
    }
    setEmail("")
  }

  return (
    <>
      <form onSubmit={submit} className="mt-6 space-y-1.5">
        <Label htmlFor="invite-email">Convidar por email</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="invite-email"
            type="email"
            autoComplete="off"
            required
            className="min-w-0 flex-1"
            value={email}
            disabled={!hasFreeSlot}
            onChange={(event) => {
              invite.reset()
              setEmail(event.target.value)
            }}
          />
          <Button type="submit" size="lg" disabled={!hasFreeSlot || invite.isPending}>
            {invite.isPending ? "Convidando…" : "Convidar"}
          </Button>
        </div>
        {!hasFreeSlot && (
          <p className="text-xs text-muted-foreground">
            O plano está cheio. Remova alguém ou cancele um convite para liberar uma vaga.
          </p>
        )}
        {invite.isError && <Notice>{apiErrorMessage(invite.error)}</Notice>}
      </form>
      <InvitationLinkDialog invitation={created} onClose={() => setCreated(null)} />
    </>
  )
}
