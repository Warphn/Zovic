"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Notice } from "@/components/ui/notice"
import { apiErrorMessage } from "@/lib/api/client"
import { useLeavePlan } from "@/lib/api/subscriptions"
import { stopPlayback } from "@/lib/playback-store"

// A family plan member's way out. The manager has no such button: they cancel the plan instead.
export function LeavePlan() {
  const router = useRouter()
  const leave = useLeavePlan()
  const [isConfirming, setIsConfirming] = React.useState(false)

  const close = () => {
    leave.reset()
    setIsConfirming(false)
  }

  // mutateAsync, not mutate's onSuccess: reloading the subscription unmounts this dialog, and
  // React Query skips the callbacks of an unmounted component
  const confirm = async () => {
    try {
      await leave.mutateAsync()
    } catch {
      return // the dialog shows leave.error
    }
    stopPlayback()
    router.push("/planos")
  }

  return (
    <>
      <Button variant="ghost" className="text-destructive" size="lg" onClick={() => setIsConfirming(true)}>
        Sair do plano
      </Button>
      <Dialog open={isConfirming} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sair do plano?</DialogTitle>
            <DialogDescription>
              Você perde o acesso ao catálogo agora. A sua conta continua, e só entra de novo com um novo convite.
            </DialogDescription>
          </DialogHeader>
          {leave.isError && <Notice>{apiErrorMessage(leave.error)}</Notice>}
          <DialogFooter>
            <Button variant="ghost" size="lg" onClick={close}>
              Voltar
            </Button>
            <Button variant="destructive" size="lg" onClick={confirm} disabled={leave.isPending}>
              Sair do plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
