"use client"

import * as React from "react"
import { Check, Plus } from "lucide-react"
import { Field, Notice } from "@/components/admin/panel"
import { AlbumCoverImage } from "@/components/album-cover-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { albumsOfArtists, MAX_COVER_BYTES, useCreateAlbum } from "@/lib/api/admin"
import type { Album } from "@/lib/api/catalog"
import { apiErrorMessage } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import { CoverField } from "./album-cover"

/** The API's lower bound for an album year (Album.MIN_YEAR); the upper one is the current year. */
const MIN_ALBUM_YEAR = 1900
// Read once when the page loads: the year does not change while the form is open
const CURRENT_YEAR = new Date().getFullYear()

const TILE = "flex flex-col gap-1.5 rounded-xl border p-1.5 text-left transition-colors"
/** The radio inside a tile is hidden; its focus ring goes on the whole tile. */
const TILE_FOCUS = "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/40"
const RADIO_GROUP = "music-album"

/**
 * The music's album, as a grid of covers: only the albums of the artists chosen above, plus
 * "Sem álbum" and "Novo álbum", which creates one with those artists without leaving the form.
 */
export function AlbumPicker({
  albums,
  artistIds,
  selected,
  onChange,
}: {
  albums: Album[]
  artistIds: number[]
  selected: number | null
  onChange: (albumId: number | null) => void
}) {
  const [isCreating, setIsCreating] = React.useState(false)
  const available = albumsOfArtists(albums, artistIds)

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium tracking-wide text-foreground/80">Álbum</legend>
      {artistIds.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          Escolha o artista para ver os álbuns dele.
        </p>
      ) : (
        <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto py-1 sm:grid-cols-4">
          <AlbumTile label="Sem álbum" isSelected={selected === null} onSelect={() => onChange(null)}>
            <div className="grid aspect-square place-items-center rounded-lg bg-muted/30 text-lg text-muted-foreground">—</div>
          </AlbumTile>
          {available.map((album) => (
            <AlbumTile
              key={album.id}
              label={album.name}
              detail={album.year ? String(album.year) : undefined}
              isSelected={selected === album.id}
              onSelect={() => onChange(album.id)}
            >
              <AlbumCoverImage album={album} className="aspect-square w-full text-lg" />
            </AlbumTile>
          ))}
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            aria-expanded={isCreating}
            className={cn(TILE, "border-dashed border-border hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40")}
          >
            <div className="grid aspect-square place-items-center rounded-lg bg-muted/20 text-muted-foreground">
              <Plus aria-hidden="true" className="size-6" />
            </div>
            <span className="truncate text-xs font-medium">Novo álbum</span>
          </button>
        </div>
      )}
      {isCreating && artistIds.length > 0 && (
        <NewAlbumPanel
          artistIds={artistIds}
          onCreated={(albumId) => {
            onChange(albumId)
            setIsCreating(false)
          }}
          onCancel={() => setIsCreating(false)}
        />
      )}
    </fieldset>
  )
}

function AlbumTile({
  label,
  detail,
  isSelected,
  onSelect,
  children,
}: {
  label: string
  detail?: string
  isSelected: boolean
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <label
      title={detail ? `${label} (${detail})` : label}
      className={cn(TILE, TILE_FOCUS, "cursor-pointer", isSelected ? "border-foreground bg-muted/20" : "border-border/70 hover:bg-muted/20")}
    >
      <input type="radio" name={RADIO_GROUP} checked={isSelected} onChange={onSelect} className="sr-only" />
      <div className="relative">
        {children}
        {isSelected && (
          <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-foreground text-background">
            <Check aria-hidden="true" className="size-3.5" />
          </span>
        )}
      </div>
      <span className="truncate text-xs font-medium">{label}</span>
      {detail && <span className="-mt-1 text-[11px] text-muted-foreground tabular-nums">{detail}</span>}
    </label>
  )
}

/** Creates an album with the music's artists; it lives inside the music form, so it has no <form> of its own. */
function NewAlbumPanel({
  artistIds,
  onCreated,
  onCancel,
}: {
  artistIds: number[]
  onCreated: (albumId: number) => void
  onCancel: () => void
}) {
  const createAlbum = useCreateAlbum()
  const [name, setName] = React.useState("")
  const [year, setYear] = React.useState("")
  const [cover, setCover] = React.useState<File | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const create = async () => {
    const parsedYear = Number(year)
    if (!name.trim()) return setError("Dê um nome para o álbum.")
    if (!Number.isInteger(parsedYear) || parsedYear < MIN_ALBUM_YEAR || parsedYear > CURRENT_YEAR) {
      return setError(`O ano vai de ${MIN_ALBUM_YEAR} até ${CURRENT_YEAR}.`)
    }
    if (!cover) return setError("Escolha a imagem de capa do álbum.")
    if (cover.size > MAX_COVER_BYTES) return setError("A capa pode ter no máximo 2 MB.")
    setError(null)
    try {
      const album = await createAlbum.mutateAsync({ input: { name: name.trim(), artistIds, year: parsedYear }, cover })
      onCreated(album.id)
    } catch (createError) {
      setError(apiErrorMessage(createError))
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-surface/60 p-3">
      <div className="text-sm font-medium">Novo álbum, com os artistas marcados acima</div>
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <Field label="Nome do álbum" id="new-album-name">
          <Input id="new-album-name" maxLength={255} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Ano" id="new-album-year">
          <Input id="new-album-year" type="number" min={MIN_ALBUM_YEAR} max={CURRENT_YEAR} value={year} onChange={(event) => setYear(event.target.value)} />
        </Field>
      </div>
      <CoverField id="new-album-cover" file={cover} onChange={setCover} album={{ id: 0, name: name || "?", coverUrl: null }} />
      {error && <Notice>{error}</Notice>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={create} disabled={createAlbum.isPending}>
          {createAlbum.isPending ? "Criando…" : "Criar álbum"}
        </Button>
      </div>
    </div>
  )
}
