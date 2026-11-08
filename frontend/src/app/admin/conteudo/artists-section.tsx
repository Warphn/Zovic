"use client"

import * as React from "react"
import { Loading, Notice, Section } from "@/components/admin/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCreateArtist, useRemoveArtist, useRenameArtist } from "@/lib/api/admin"
import type { NamedItem } from "@/lib/api/catalog"
import { apiErrorMessage } from "@/lib/api/client"
import { ConfirmDialog } from "./confirm-dialog"

// Every change here refreshes the artist list and the musics (their credits) on its own
export function ArtistsSection({ artists, error }: { artists: NamedItem[] | null; error: string | null }) {
  const createArtist = useCreateArtist()
  const renameArtist = useRenameArtist()
  const removeArtist = useRemoveArtist()
  const [newName, setNewName] = React.useState("")
  const [editing, setEditing] = React.useState<{ id: number; name: string } | null>(null)
  const [removing, setRemoving] = React.useState<NamedItem | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState("")

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null)
    try {
      await action()
      return true
    } catch (err) {
      setActionError(apiErrorMessage(err))
      return false
    }
  }

  const visible = (artists ?? []).filter((a) => a.name.toLowerCase().includes(filter.trim().toLowerCase()))

  return (
    <Section title="Artistas" description="Renomear um artista muda o nome em todas as músicas dele.">
      <div className="space-y-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (newName.trim() && (await run(() => createArtist.mutateAsync(newName.trim())))) setNewName("")
          }}
        >
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do novo artista" aria-label="Nome do novo artista" maxLength={255} className="max-w-xs" />
          <Button type="submit" size="lg" disabled={!newName.trim()}>
            Adicionar artista
          </Button>
          <Input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar artistas" aria-label="Filtrar artistas" className="ml-auto max-w-[14rem]" />
        </form>
        {(error || actionError) && <Notice>{actionError ?? error}</Notice>}
        {!artists ? (
          <Loading />
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((artist) => (
              <li key={artist.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/20">
                {editing?.id === artist.id ? (
                  <form
                    className="flex flex-1 gap-1.5"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (editing.name.trim() && (await run(() => renameArtist.mutateAsync({ id: artist.id, name: editing.name.trim() })))) setEditing(null)
                    }}
                  >
                    <Input value={editing.name} onChange={(e) => setEditing({ id: artist.id, name: e.target.value })} aria-label={`Novo nome de ${artist.name}`} maxLength={255} />
                    <Button type="submit">Salvar</Button>
                    <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">{artist.name}</span>
                    <Button variant="ghost" onClick={() => setEditing({ id: artist.id, name: artist.name })}>
                      Renomear
                    </Button>
                    <Button variant="ghost" className="text-destructive" onClick={() => setRemoving(artist)}>
                      Remover
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        title={`Remover ${removing?.name}?`}
        description="O artista some das listas de escolha. As músicas que já estão ligadas a ele continuam como estão."
        confirmLabel="Remover artista"
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await removeArtist.mutateAsync(removing.id)
        }}
      />
    </Section>
  )
}
