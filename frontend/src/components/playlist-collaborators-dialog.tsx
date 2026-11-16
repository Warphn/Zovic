"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Notice } from "@/components/ui/notice"
import { useSession } from "@/lib/auth/client"
import { apiErrorMessage } from "@/lib/api/client"
import { useAddCollaborator, useLeavePlaylist, usePlaylistCollaborators, useRemoveCollaborator } from "@/lib/api/playlists"

// Who builds a playlist (HU-19). The owner adds people by email and removes them; a collaborator
// sees the list and can leave. The API owns the rules (account, subscription, who may do what).
export function PlaylistCollaboratorsDialog({
  playlistId,
  isOwner,
  open,
  onOpenChange,
}: {
  playlistId: number
  isOwner: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const viewerId = Number(session?.user.id)
  const { data: collaborators, isPending, isError } = usePlaylistCollaborators(open ? playlistId : null)
  const remove = useRemoveCollaborator()
  const leave = useLeavePlaylist()
  const failedAction = remove.isError ? remove : leave.isError ? leave : null

  const removeCollaborator = (userId: number) => {
    if (userId !== viewerId) {
      remove.mutate({ id: playlistId, userId })
      return
    }
    // Leaving: straight back to "Minhas playlists", where it no longer is
    leave.mutate({ id: playlistId, userId }, { onSuccess: () => router.push("/playlist") })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        remove.reset()
        leave.reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Colaboradores</DialogTitle>
          <DialogDescription>
            {isOwner
              ? "Quem você adicionar põe, tira e reordena as músicas. Só você renomeia e exclui a playlist."
              : "Você põe, tira e reordena as músicas desta playlist. Quem a criou cuida do resto."}
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : isError ? (
          <Notice>Não foi possível carregar os colaboradores. Feche e abra de novo.</Notice>
        ) : (
          <ul className="divide-y divide-border">
            {collaborators.map((collaborator) => {
              const isViewer = collaborator.userId === viewerId
              // The owner removes anyone else; a collaborator only leaves
              const canRemove = !collaborator.isOwner && (isOwner || isViewer)
              return (
                <li key={collaborator.userId} className="flex items-center justify-between gap-2 py-2">
                  <p className="min-w-0 truncate text-sm font-semibold">
                    {collaborator.name}
                    {collaborator.isOwner && <span className="font-normal text-muted-foreground"> · dono</span>}
                    {isViewer && !collaborator.isOwner && <span className="font-normal text-muted-foreground"> · você</span>}
                  </p>
                  {canRemove && (
                    <Button
                      variant="ghost"
                      size="lg"
                      className="text-destructive"
                      disabled={remove.isPending || leave.isPending}
                      onClick={() => removeCollaborator(collaborator.userId)}
                      aria-label={isViewer ? "Sair da playlist" : `Remover ${collaborator.name}`}
                    >
                      {isViewer ? "Sair da playlist" : "Remover"}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {failedAction && <Notice>{apiErrorMessage(failedAction.error)}</Notice>}

        {isOwner && <AddCollaboratorForm playlistId={playlistId} />}
      </DialogContent>
    </Dialog>
  )
}

function AddCollaboratorForm({ playlistId }: { playlistId: number }) {
  const add = useAddCollaborator()
  const [email, setEmail] = React.useState("")

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await add.mutateAsync({ id: playlistId, email: email.trim() })
    } catch {
      return // the form shows add.error
    }
    setEmail("")
  }

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-border pt-4">
      <Label htmlFor="collaborator-email">Adicionar pelo email</Label>
      <div className="flex gap-2">
        <Input
          id="collaborator-email"
          type="email"
          value={email}
          onChange={(event) => {
            add.reset()
            setEmail(event.target.value)
          }}
          placeholder="email@exemplo.com"
          required
        />
        <Button type="submit" size="lg" disabled={!email.trim() || add.isPending}>
          {add.isPending ? "Adicionando…" : "Adicionar"}
        </Button>
      </div>
      {add.isError && (
        <p role="alert" className="text-sm text-destructive">
          {apiErrorMessage(add.error)}
        </p>
      )}
    </form>
  )
}
