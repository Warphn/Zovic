"use client"

import * as React from "react"
import { Field, Loading, Notice, Section } from "@/components/admin/panel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { albumChanges, useCreateAlbum, useRemoveAlbum, useUpdateAlbum } from "@/lib/api/admin"
import type { Album, NamedItem } from "@/lib/api/catalog"
import { apiErrorMessage } from "@/lib/api/client"
import { ConfirmDialog } from "./confirm-dialog"
import { Picker } from "./picker"

/** The API's lower bound (Album.MIN_YEAR); the upper one is the current year. */
const MIN_ALBUM_YEAR = 1900
// Read once when the page loads: the year does not change while the form is open
const CURRENT_YEAR = new Date().getFullYear()

// "Novo álbum" (null) or the album being edited
type AlbumDraft = { album: Album | null }

export function AlbumsSection({ albums, artists, error }: { albums: Album[] | null; artists: NamedItem[]; error: string | null }) {
  const removeAlbum = useRemoveAlbum()
  const [editing, setEditing] = React.useState<AlbumDraft | null>(null)
  const [removing, setRemoving] = React.useState<Album | null>(null)
  const [filter, setFilter] = React.useState("")

  const visible = (albums ?? []).filter((album) => album.name.toLowerCase().includes(filter.trim().toLowerCase()))

  return (
    <Section
      title="Álbuns"
      description="Cada música fica em um álbum, ou em nenhum. Remover um álbum não remove as músicas dele."
      actions={
        <Button size="lg" onClick={() => setEditing({ album: null })}>
          Novo álbum
        </Button>
      }
    >
      <div className="space-y-4">
        <Input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar álbuns" aria-label="Filtrar álbuns" className="max-w-[14rem]" />
        {error && <Notice>{error}</Notice>}
        {!albums ? (
          <Loading />
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum álbum encontrado.</p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {visible.map((album) => (
              <li key={album.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/20">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {album.name}
                    {album.year && <span className="font-normal text-muted-foreground"> · {album.year}</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{album.artists.map((artist) => artist.name).join(", ")}</div>
                </div>
                <Button variant="ghost" onClick={() => setEditing({ album })}>
                  Editar
                </Button>
                <Button variant="ghost" className="text-destructive" onClick={() => setRemoving(album)}>
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.album ? "Editar álbum" : "Novo álbum"}</DialogTitle>
            <DialogDescription>Os artistas escolhidos substituem os anteriores.</DialogDescription>
          </DialogHeader>
          {/* DialogContent unmounts while closed, so the form starts from the album on every open */}
          {editing && <AlbumForm album={editing.album} artists={artists} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        title={`Remover “${removing?.name}”?`}
        description="O álbum some das listas. As músicas do álbum continuam no catálogo."
        confirmLabel="Remover álbum"
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await removeAlbum.mutateAsync(removing.id)
        }}
      />
    </Section>
  )
}

function AlbumForm({ album, artists, onClose }: { album: Album | null; artists: NamedItem[]; onClose: () => void }) {
  const [name, setName] = React.useState(album?.name ?? "")
  const [artistIds, setArtistIds] = React.useState<number[]>(album?.artists.map((artist) => artist.id) ?? [])
  const [year, setYear] = React.useState(album?.year ? String(album.year) : "")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const createAlbum = useCreateAlbum()
  const updateAlbum = useUpdateAlbum()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedYear = Number(year)
    if (!name.trim()) return setError("Dê um nome para o álbum.")
    if (artistIds.length === 0) return setError("Escolha pelo menos um artista.")
    if (!Number.isInteger(parsedYear) || parsedYear < MIN_ALBUM_YEAR || parsedYear > CURRENT_YEAR) {
      return setError(`O ano vai de ${MIN_ALBUM_YEAR} até ${CURRENT_YEAR}.`)
    }
    setSaving(true)
    try {
      const input = { name: name.trim(), artistIds, year: parsedYear }
      if (album) {
        const changes = albumChanges(album, input, artists.map((artist) => artist.id))
        if (Object.keys(changes).length > 0) await updateAlbum.mutateAsync({ id: album.id, input: changes })
      } else {
        await createAlbum.mutateAsync(input)
      }
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <Field label="Nome" id="album-name">
          <Input id="album-name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Ano" id="album-year">
          <Input id="album-year" type="number" required min={MIN_ALBUM_YEAR} max={CURRENT_YEAR} value={year} onChange={(e) => setYear(e.target.value)} />
        </Field>
      </div>
      <Picker label="Artistas" items={artists} selected={artistIds} onChange={setArtistIds} />
      {error && <Notice>{error}</Notice>}
      <DialogFooter>
        <Button type="button" variant="ghost" size="lg" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Salvando…" : album ? "Salvar" : "Criar álbum"}
        </Button>
      </DialogFooter>
    </form>
  )
}
