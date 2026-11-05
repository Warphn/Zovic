"use client"

import * as React from "react"
import { Field, Loading, Notice, Section } from "@/components/admin/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { albumsOfArtists, MAX_AUDIO_BYTES, musicChanges, useAdminMusics, useRemoveMusic, useSaveMusic } from "@/lib/api/admin"
import { type Album, type CatalogMusic, type Genre, type NamedItem, useAlbums, useArtists, useGenres } from "@/lib/api/catalog"
import { apiErrorMessage } from "@/lib/api/client"
import { readAudioDuration } from "@/lib/audio-duration"
import { formatDuration } from "@/lib/format-duration"
import { cn } from "@/lib/utils"
import { AlbumsSection } from "./albums-section"
import { ArtistsSection } from "./artists-section"
import { AlbumPicker } from "./album-picker"
import { ConfirmDialog } from "./confirm-dialog"
import { FileInput } from "./file-input"
import { NewArtistField, NewGenreField } from "./new-catalog-item"
import { Picker } from "./picker"

// "Nova música" (null id) or the music being edited
type MusicDraft = { music: CatalogMusic | null }

export default function AdminContentPage() {
  const [search, setSearch] = React.useState("")
  const [query, setQuery] = React.useState("")
  const musics = useAdminMusics(query)
  const artists = useArtists()
  const albums = useAlbums()
  const genres = useGenres()
  const removeMusic = useRemoveMusic()
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
          {musics.isError && <Notice>{apiErrorMessage(musics.error)}</Notice>}
          {musics.isPending ? (
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
                          {music.isExplicit && (
                            <Badge variant="outline" className="text-[10px]" aria-label="Conteúdo explícito" title="Conteúdo explícito">
                              E
                            </Badge>
                          )}
                          {music.deletedAt && (
                            <Badge variant="destructive" className="text-[10px]">
                              Removida
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {music.artists.map((artist) => artist.name).join(", ")}
                          {music.album && ` · ${music.album.name}`}
                          {!music.hasAudio && " · sem áudio"}
                        </div>
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

      <AlbumsSection
        albums={albums.data ?? null}
        artists={artists.data ?? []}
        error={albums.isError ? apiErrorMessage(albums.error) : null}
      />

      <ArtistsSection artists={artists.data ?? null} error={artists.isError ? apiErrorMessage(artists.error) : null} />

      <MusicDialog
        draft={editing}
        artists={artists.data ?? []}
        albums={albums.data ?? []}
        genres={genres.data ?? []}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        title={`Remover “${removing?.name}”?`}
        description="A música some do catálogo para os assinantes. Para os admins ela continua listada, marcada como removida, e as reproduções antigas seguem nas estatísticas."
        confirmLabel="Remover música"
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await removeMusic.mutateAsync(removing.id)
        }}
      />
    </div>
  )
}

function MusicDialog({
  draft,
  artists,
  albums,
  genres,
  onClose,
}: {
  draft: MusicDraft | null
  artists: NamedItem[]
  albums: Album[]
  genres: Genre[]
  onClose: () => void
}) {
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{draft?.music ? "Editar música" : "Nova música"}</DialogTitle>
          <DialogDescription>Os artistas e gêneros escolhidos substituem os anteriores.</DialogDescription>
        </DialogHeader>
        {/* DialogContent unmounts while closed, so the form starts from the music on every open */}
        {draft && <MusicForm music={draft.music} artists={artists} albums={albums} genres={genres} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function MusicForm({
  music,
  artists,
  albums,
  genres,
  onClose,
}: {
  music: CatalogMusic | null
  artists: NamedItem[]
  albums: Album[]
  genres: Genre[]
  onClose: () => void
}) {
  const [name, setName] = React.useState(music?.name ?? "")
  const [artistIds, setArtistIds] = React.useState<number[]>(music?.artists.map((a) => a.id) ?? [])
  const [genreIds, setGenreIds] = React.useState<number[]>(music?.genres.map((g) => g.id) ?? [])
  const [albumId, setAlbumId] = React.useState<number | null>(music?.album?.id ?? null)
  const [isExplicit, setIsExplicit] = React.useState(music?.isExplicit ?? false)
  // Only a new music takes a file: editing keeps the audio, and so the duration, it already has
  const [audio, setAudio] = React.useState<File | null>(null)
  const [audioDuration, setAudioDuration] = React.useState<number | null>(null)
  const [isReadingAudio, setIsReadingAudio] = React.useState(false)
  // The last file chosen: a slow read of an earlier one must not overwrite its duration
  const latestAudio = React.useRef<File | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const saveMusic = useSaveMusic()

  // The album must have one of the music's artists: unchecking its artist takes the album out too
  const changeArtists = (nextArtistIds: number[]) => {
    setArtistIds(nextArtistIds)
    if (albumId !== null && !albumsOfArtists(albums, nextArtistIds).some((album) => album.id === albumId)) setAlbumId(null)
  }

  const chooseAudio = async (file: File | null) => {
    latestAudio.current = file
    setAudio(file)
    setAudioDuration(null)
    setError(null)
    if (!file) return
    setIsReadingAudio(true)
    const seconds = await readAudioDuration(file)
    if (latestAudio.current !== file) return
    setIsReadingAudio(false)
    if (seconds === null) setError("Não deu para ler a duração. Confira se o arquivo é um MP3.")
    setAudioDuration(seconds)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError("Dê um nome para a música.")
    if (artistIds.length === 0) return setError("Escolha pelo menos um artista.")
    // The API checks both again; this only spares uploading 20 MB to get the same answer
    if (!music && !audio) return setError("Escolha o arquivo de áudio da música.")
    if (audio && audio.size > MAX_AUDIO_BYTES) return setError("O áudio pode ter no máximo 20 MB.")
    const duration = music ? music.duration : audioDuration
    if (duration === null) return setError("Não deu para ler a duração. Confira se o arquivo é um MP3.")
    setSaving(true)
    try {
      const input = { name: name.trim(), duration, artistIds, genreIds, albumId, isExplicit }
      if (music) {
        const changes = musicChanges(music, input, artists.map((artist) => artist.id))
        if (Object.keys(changes).length > 0) await saveMusic.mutateAsync({ id: music.id, input: changes })
      } else if (audio) {
        await saveMusic.mutateAsync({ id: null, input: { ...input, audio } })
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
      <Field label="Nome" id="music-name">
        <Input id="music-name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {!music && (
        <Field label="Arquivo de áudio (MP3, até 20 MB)" id="music-audio">
          <FileInput id="music-audio" file={audio} accept="audio/mpeg,.mp3" onChange={chooseAudio} describedBy="music-audio-status" />
          <p id="music-audio-status" className="mt-1 text-xs text-muted-foreground" aria-live="polite">
            {isReadingAudio
              ? "Lendo a duração do arquivo…"
              : audioDuration !== null
                ? `Duração: ${formatDuration(audioDuration)}, lida do arquivo`
                : "A duração é lida do arquivo."}
          </p>
        </Field>
      )}
      <Picker label="Artistas" items={artists} selected={artistIds} onChange={changeArtists} />
      <NewArtistField onCreated={(artistId) => setArtistIds((selected) => [...selected, artistId])} />
      <Picker label="Gêneros" items={genres} selected={genreIds} onChange={setGenreIds} />
      <NewGenreField onCreated={(genreId) => setGenreIds((selected) => [...selected, genreId])} />
      <AlbumPicker albums={albums} artistIds={artistIds} selected={albumId} onChange={setAlbumId} />
      <div className="flex items-center justify-between gap-4">
        <span id="music-explicit-label" className="text-sm font-medium">
          Conteúdo explícito
        </span>
        <Switch checked={isExplicit} onCheckedChange={setIsExplicit} aria-labelledby="music-explicit-label" />
      </div>
      {error && <Notice>{error}</Notice>}
      <DialogFooter>
        <Button type="button" variant="ghost" size="lg" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={saving || isReadingAudio}>
          {saving ? "Salvando…" : music ? "Salvar" : "Criar música"}
        </Button>
      </DialogFooter>
    </form>
  )
}
