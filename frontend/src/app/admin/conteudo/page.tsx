"use client"

import * as React from "react"
import { Field, Loading, Notice, Section } from "@/components/admin/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  adminApi,
  ApiError,
  type CatalogMusic,
  formatDuration,
  type Genre,
  type NamedItem,
  parseDuration,
} from "@/lib/admin/api"
import { useResource } from "@/lib/admin/use-resource"
import { cn } from "@/lib/utils"

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Algo deu errado. Tente de novo."
}

// "Nova música" (null id) or the music being edited
type MusicDraft = { music: CatalogMusic | null }

export default function AdminContentPage() {
  const [search, setSearch] = React.useState("")
  const [query, setQuery] = React.useState("")
  const musics = useResource(() => adminApi.listMusics(query), [query])
  const artists = useResource(() => adminApi.listArtists(), [])
  const genres = useResource(() => adminApi.listGenres(), [])
  const [editing, setEditing] = React.useState<MusicDraft | null>(null)
  const [removing, setRemoving] = React.useState<CatalogMusic | null>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="space-y-6">
      <Section
        title="Músicas"
        description="As removidas continuam aqui, marcadas, e somem para os demais usuários. Elas não podem ser editadas nem tocadas."
        actions={
          <Button size="lg" onClick={() => setEditing({ music: null })}>
            Nova música
          </Button>
        }
      >
        <div className="space-y-4">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por música ou artista"
            aria-label="Buscar músicas"
            className="max-w-sm"
          />
          {musics.error && <Notice>{musics.error}</Notice>}
          {musics.loading && !musics.data ? (
            <Loading />
          ) : musics.data && musics.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma música encontrada.</p>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Música</th>
                    <th className="px-2 py-2 font-medium">Gêneros</th>
                    <th className="px-2 py-2 text-right font-medium">Duração</th>
                    <th className="px-2 py-2 text-right font-medium">Reproduções</th>
                    <th className="px-2 py-2">
                    <span className="sr-only">Ações</span>
                  </th>
                  </tr>
                </thead>
                <tbody>
                  {musics.data?.map((music) => (
                    <tr key={music.id} className={cn("border-t border-border/70", music.deletedAt && "bg-destructive/[0.04]")}>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={music.deletedAt ? "font-medium text-muted-foreground line-through" : "font-medium"}>
                            {music.name}
                          </span>
                          {music.deletedAt && (
                            <Badge variant="destructive" className="text-[10px]">
                              Removida
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{music.artists.map((a) => a.name).join(", ")}</div>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {music.genres.map((genre) => (
                            // Label tinted with the genre color; the text stays in the ink token so it reads on any hue
                            <span
                              key={genre.id}
                              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold text-foreground"
                              style={{
                                background: `color-mix(in oklab, ${genre.color} 14%, transparent)`,
                                borderColor: `color-mix(in oklab, ${genre.color} 35%, transparent)`,
                              }}
                            >
                              <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: genre.color }} />
                              {genre.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{formatDuration(music.duration)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{music.plays.toLocaleString("pt-BR")}</td>
                      <td className="px-2 py-2.5">
                        {!music.deletedAt && (
                          <div className="flex justify-end gap-1.5">
                            <Button variant="outline" onClick={() => setEditing({ music })}>
                              Editar
                            </Button>
                            <Button variant="destructive" onClick={() => setRemoving(music)}>
                              Remover
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      <ArtistsSection artists={artists.data} error={artists.error} reload={() => {
        artists.reload()
        musics.reload()
      }} />

      <MusicDialog
        draft={editing}
        artists={artists.data ?? []}
        genres={genres.data ?? []}
        onClose={() => setEditing(null)}
        onSaved={musics.reload}
      />
      <ConfirmDialog
        title={`Remover “${removing?.name}”?`}
        description="A música some do catálogo para os assinantes. Para os admins ela continua listada, marcada como removida, e as reproduções antigas seguem nas estatísticas."
        confirmLabel="Remover música"
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await adminApi.removeMusic(removing.id)
          musics.reload()
        }}
      />
    </div>
  )
}

function MusicDialog({
  draft,
  artists,
  genres,
  onClose,
  onSaved,
}: {
  draft: MusicDraft | null
  artists: NamedItem[]
  genres: Genre[]
  onClose: () => void
  onSaved: () => void
}) {
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{draft?.music ? "Editar música" : "Nova música"}</DialogTitle>
          <DialogDescription>Os artistas e gêneros escolhidos substituem os anteriores.</DialogDescription>
        </DialogHeader>
        {/* DialogContent unmounts while closed, so the form starts from the music on every open */}
        {draft && <MusicForm music={draft.music} artists={artists} genres={genres} onClose={onClose} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function MusicForm({
  music,
  artists,
  genres,
  onClose,
  onSaved,
}: {
  music: CatalogMusic | null
  artists: NamedItem[]
  genres: Genre[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = React.useState(music?.name ?? "")
  const [duration, setDuration] = React.useState(music ? formatDuration(music.duration) : "")
  const [artistIds, setArtistIds] = React.useState<number[]>(music?.artists.map((a) => a.id) ?? [])
  const [genreIds, setGenreIds] = React.useState<number[]>(music?.genres.map((g) => g.id) ?? [])
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const seconds = parseDuration(duration)
    if (!name.trim()) return setError("Dê um nome para a música.")
    if (seconds === null) return setError("Duração inválida. Use minutos:segundos, como 3:45.")
    if (artistIds.length === 0) return setError("Escolha pelo menos um artista.")
    setSaving(true)
    try {
      const input = { name: name.trim(), duration: seconds, artistIds, genreIds }
      await (music ? adminApi.updateMusic(music.id, input) : adminApi.createMusic(input))
      onSaved()
      onClose()
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <Field label="Nome" id="music-name">
          <Input id="music-name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Duração" id="music-duration">
          <Input id="music-duration" required placeholder="3:45" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
      </div>
      <Picker label="Artistas" items={artists} selected={artistIds} onChange={setArtistIds} />
      <Picker label="Gêneros" items={genres} selected={genreIds} onChange={setGenreIds} />
      {error && <Notice>{error}</Notice>}
      <DialogFooter>
        <Button type="button" variant="ghost" size="lg" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Salvando…" : music ? "Salvar" : "Criar música"}
        </Button>
      </DialogFooter>
    </form>
  )
}

// Multi-select as toggle chips, with a filter when the list is long
function Picker({
  label,
  items,
  selected,
  onChange,
}: {
  label: string
  items: (NamedItem & { color?: string })[]
  selected: number[]
  onChange: (ids: number[]) => void
}) {
  const [filter, setFilter] = React.useState("")
  const visible = items.filter((item) => selected.includes(item.id) || item.name.toLowerCase().includes(filter.trim().toLowerCase()))
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium tracking-wide text-foreground/80">
        {label} <span className="text-muted-foreground">({selected.length} selecionado{selected.length === 1 ? "" : "s"})</span>
      </legend>
      {items.length > 12 && (
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Filtrar ${label.toLowerCase()}`} aria-label={`Filtrar ${label.toLowerCase()}`} />
      )}
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto py-1">
        {visible.map((item) => {
          const on = selected.includes(item.id)
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(item.id)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted/30"
              )}
            >
              {item.color && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: item.color }} />}
              {item.name}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function ArtistsSection({ artists, error, reload }: { artists: NamedItem[] | null; error: string | null; reload: () => void }) {
  const [newName, setNewName] = React.useState("")
  const [editing, setEditing] = React.useState<{ id: number; name: string } | null>(null)
  const [removing, setRemoving] = React.useState<NamedItem | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState("")

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null)
    try {
      await action()
      reload()
      return true
    } catch (err) {
      setActionError(messageOf(err))
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
            if (newName.trim() && (await run(() => adminApi.createArtist(newName.trim())))) setNewName("")
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
                      if (editing.name.trim() && (await run(() => adminApi.renameArtist(artist.id, editing.name.trim())))) setEditing(null)
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
          if (removing) await adminApi.removeArtist(removing.id)
          reload()
        }}
      />
    </Section>
  )
}

function ConfirmDialog({
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
                setError(messageOf(err))
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
