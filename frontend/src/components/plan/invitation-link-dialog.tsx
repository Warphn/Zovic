"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Notice } from "@/components/ui/notice"
import type { CreatedInvitation } from "@/lib/api/subscriptions"

const COPIED_FEEDBACK_MS = 2500

// Shown once, right after inviting: the API keeps only a hash of the token, so the link cannot be
// shown again. The system sends no email, so the manager is the one who delivers it.
export function InvitationLinkDialog({
  invitation,
  onClose,
}: {
  invitation: CreatedInvitation | null
  onClose: () => void
}) {
  const [copyState, setCopyState] = React.useState<"idle" | "copied" | "failed">("idle")
  const link = invitation ? `${window.location.origin}/convite/${invitation.token}` : ""

  React.useEffect(() => {
    if (copyState !== "copied") return undefined
    const timer = setTimeout(() => setCopyState("idle"), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [copyState])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    }
  }

  const close = () => {
    setCopyState("idle")
    onClose()
  }

  return (
    <Dialog open={invitation !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convite criado</DialogTitle>
          <DialogDescription>
            O Zovic não envia email: envie este link você mesmo para {invitation?.email}. Ele só funciona para esse email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="invitation-link">Link do convite</Label>
          <div className="flex gap-2">
            <Input id="invitation-link" readOnly value={link} onFocus={(event) => event.target.select()} />
            <Button size="lg" variant="outline" onClick={copy} className="shrink-0">
              {copyState === "copied" ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <output className="block min-h-4 text-xs text-muted-foreground">
            {copyState === "copied" && "Link copiado para a área de transferência."}
          </output>
        </div>
        {copyState === "failed" && <Notice>Não foi possível copiar. Selecione o link e copie à mão.</Notice>}
        <Notice tone="info">
          Este link não será mostrado de novo. Se você perder, cancele o convite e convide de novo.
        </Notice>
        <DialogFooter>
          <Button size="lg" onClick={close}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
