"use client"

import * as React from "react"
import { Field, Loading, Notice, Section } from "@/components/admin/panel"
import { AlbumCoverImage } from "@/components/album-cover-image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { albumChanges, MAX_COVER_BYTES, useChangeAlbumCover, useCreateAlbum, useRemoveAlbum, useUpdateAlbum } from "@/lib/api/admin"
import type { Album, NamedItem } from "@/lib/api/catalog"
import { apiErrorMessage } from "@/lib/api/client"
import { CoverField } from "./album-cover"
import { ConfirmDialog } from "./confirm-dialog"
import { NewArtistField } from "./new-catalog-item"
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
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((album) => (
              <AlbumCard key={album.id} album={album} onEdit={() => setEditing({ album })} onRemove={() => setRemoving(album)} />
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

function trackCountLabel(count: number): string {
  if (count === 0) return "Sem faixas"
  return count === 1 ? "1 faixa" : `${count} faixas`
}

function AlbumCard({ album, onEdit, onRemove }: { album: Album; onEdit: () => void; onRemove: () => void }) {
  const artistNames = album.artists.map((artist) => artist.name).join(", ")

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface/60 p-3">
      <div className="flex items-start gap-3">
        <AlbumCoverImage album={album} className="size-14 shrink-0 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium" title={album.name}>
            {album.name}
          </div>
          <div className="truncate text-xs text-muted-foreground" title={artistNames}>
            {artistNames}
          </div>
          <div className="mt-1 text-xs tabular-nums text-muted-foreground">
            {album.year ?? "Sem ano"} · {trackCountLabel(album.musicCount)}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-1.5">
        <Button variant="outline" onClick={onEdit} aria-label={`Editar ${album.name}`}>
          Editar
        </Button>
        <Button variant="ghost" className="text-destructive" onClick={onRemove} aria-label={`Remover ${album.name}`}>
          Remover
        </Button>
      </div>
    </li>
  )
}

function AlbumForm({ album, artists, onClose }: { album: Album | null; artists: NamedItem[]; onClose: () => void }) {
  const [name, setName] = React.useState(album?.name ?? "")
  const [artistIds, setArtistIds] = React.useState<number[]>(album?.artists.map((artist) => artist.id) ?? [])
  const [year, setYear] = React.useState(album?.year ? String(album.year) : "")
  // Required for a new album; when editing, a file here replaces the current cover
  const [cover, setCover] = React.useState<File | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const createAlbum = useCreateAlbum()
  const updateAlbum = useUpdateAlbum()
  const changeAlbumCover = useChangeAlbumCover()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedYear = Number(year)
    if (!name.trim()) return setError("Dê um nome para o álbum.")
    if (artistIds.length === 0) return setError("Escolha pelo menos um artista.")
    if (!Number.isInteger(parsedYear) || parsedYear < MIN_ALBUM_YEAR || parsedYear > CURRENT_YEAR) {
      return setError(`O ano vai de ${MIN_ALBUM_YEAR} até ${CURRENT_YEAR}.`)
    }
    if (!album && !cover) return setError("Escolha a imagem de capa do álbum.")
    if (cover && cover.size > MAX_COVER_BYTES) return setError("A capa pode ter no máximo 2 MB.")
    setSaving(true)
    try {
      const input = { name: name.trim(), artistIds, year: parsedYear }
      if (album) {
        const changes = albumChanges(album, input, artists.map((artist) => artist.id))
        if (Object.keys(changes).length > 0) await updateAlbum.mutateAsync({ id: album.id, input: changes })
        if (cover) await changeAlbumCover.mutateAsync({ id: album.id, cover })
      } else if (cover) {
        await createAlbum.mutateAsync({ input, cover })
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
      <CoverField
        id="album-cover"
        file={cover}
        onChange={setCover}
        album={album ?? { id: 0, name: name || "?", coverUrl: null }}
        label={album ? "Trocar a capa (JPEG, PNG ou WebP, até 2 MB)" : "Imagem de capa (JPEG, PNG ou WebP, até 2 MB)"}
      />
      <Picker label="Artistas" items={artists} selected={artistIds} onChange={setArtistIds} />
      <NewArtistField onCreated={(artistId) => setArtistIds((selected) => [...selected, artistId])} />
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
