"use client"

import * as React from "react"
import { Notice } from "@/components/admin/panel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { apiErrorMessage } from "@/lib/api/client"

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  open,
  onClose,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const close = () => {
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <Notice>{error}</Notice>}
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="lg"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                await onConfirm()
                close()
              } catch (err) {
                setError(apiErrorMessage(err))
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? "Removendo…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
