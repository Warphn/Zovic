"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react"
import { Field, Notice } from "@/components/admin/panel"
import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { FilesInput } from "@/components/file-input"
import { SortableList } from "@/components/sortable-list"
import { Switch } from "@/components/ui/switch"
import { albumsOfArtists, MAX_AUDIO_BYTES, useCreateMusics } from "@/lib/api/admin"
import type { Album, Genre, NamedItem } from "@/lib/api/catalog"
import { apiErrorMessage } from "@/lib/api/client"
import { readAudioDuration } from "@/lib/audio-duration"
import { formatDuration } from "@/lib/format-duration"
import { moveItem, musicNameFromFileName, orderByIds, sortByFileName } from "@/lib/music-batch"
import { AlbumPicker } from "./album-picker"
import { NewArtistField, NewGenreField } from "./new-catalog-item"
import { cn } from "@/lib/utils"
import { Picker } from "./picker"

/** One file of the batch: its own name, duration and explicit mark; the rest is shared. */
interface TrackDraft {
  /** The file's identity in the list: the same file chosen twice is one track. */
  id: string
  file: File
  name: string
  /** Null while the file is being read, or when it could not be read. */
  duration: number | null
  isReading: boolean
  isExplicit: boolean
}

/** SortableList rows have a fixed height: the controls line plus the file name or problem line. */
const TRACK_ROW_HEIGHT = 64

function trackIdOf(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`
}

// O cadastro de músicas: um MP3 ou vários de uma vez, como as faixas de um álbum (HU-28 e HU-41).
// Artistas, gêneros e álbum valem para todas; o nome e a marca de explícito são de cada faixa.
export function NewMusicForm({
  artists,
  albums,
  genres,
  onClose,
}: {
  artists: NamedItem[]
  albums: Album[]
  genres: Genre[]
  onClose: () => void
}) {
  const [tracks, setTracks] = React.useState<TrackDraft[]>([])
  const [artistIds, setArtistIds] = React.useState<number[]>([])
  const [genreIds, setGenreIds] = React.useState<number[]>([])
  const [albumId, setAlbumId] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState<{ created: number; total: number } | null>(null)
  const createMusics = useCreateMusics()

  const updateTrack = (file: File, changes: Partial<TrackDraft>) =>
    setTracks((current) => current.map((track) => (track.file === file ? { ...track, ...changes } : track)))

  const changeArtists = (nextArtistIds: number[]) => {
    setArtistIds(nextArtistIds)
    if (albumId !== null && !albumsOfArtists(albums, nextArtistIds).some((album) => album.id === albumId)) setAlbumId(null)
  }

  const addFiles = (files: File[]) => {
    setError(null)
    const listedIds = new Set(tracks.map((track) => track.id))
    const newFiles = files.filter((file) => !listedIds.has(trackIdOf(file)))
    // The new files come in file-name order after the ones already listed, keeping any order the admin set
    const added = sortByFileName(newFiles, (file) => file.name).map((file) => ({
      id: trackIdOf(file),
      file,
      name: musicNameFromFileName(file.name),
      duration: null,
      isReading: true,
      isExplicit: false,
    }))
    setTracks((current) => [...current, ...added])
    for (const track of added) {
      // readAudioDuration never rejects: an unreadable file resolves to null and shows as a problem
      void readAudioDuration(track.file).then((duration) => updateTrack(track.file, { duration, isReading: false }))
    }
  }

  const problemWith = (track: TrackDraft): string | null => {
    if (!track.name.trim()) return "Dê um nome para a faixa."
    if (track.file.size > MAX_AUDIO_BYTES) return "O áudio pode ter no máximo 20 MB."
    if (!track.isReading && track.duration === null) return "Não é um MP3 válido."
    return null
  }

  const moveTrack = (fromIndex: number, toIndex: number) => setTracks((current) => moveItem(current, fromIndex, toIndex))

  // Grip, arrows and the hint only make sense with more than one track
  const canReorder = tracks.length > 1
  const isReadingAny = tracks.some((track) => track.isReading)
  const isSaving = progress !== null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (tracks.length === 0) return setError("Escolha pelo menos um MP3.")
    if (artistIds.length === 0) return setError("Escolha pelo menos um artista.")
    if (tracks.some((track) => problemWith(track) !== null)) return setError("Corrija as faixas marcadas.")
    setError(null)
    setProgress({ created: 0, total: tracks.length })
    const inputs = tracks.map((track) => ({
      name: track.name.trim(),
      duration: track.duration ?? 0,
      artistIds,
      genreIds,
      albumId,
      isExplicit: track.isExplicit,
      audio: track.file,
    }))
    const result = await createMusics(inputs, (input) => {
      // The created track leaves the list, so a retry after a failure sends only the rest
      setTracks((current) => current.filter((track) => track.file !== input.audio))
      setProgress((current) => current && { ...current, created: current.created + 1 })
    })
    setProgress(null)
    if (result.error === null) return onClose()
    // The created tracks already left the list: the one that failed is now the first
    const failedName = inputs[result.createdCount]?.name
    setError(`“${failedName}” não foi enviada: ${apiErrorMessage(result.error)}`)
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Áudio (MP3, até 20 MB cada)" id="new-music-audio">
        <FilesInput
          id="new-music-audio"
          accept="audio/mpeg,.mp3"
          text={tracks.length === 0 ? "Escolher um ou mais arquivos" : "Adicionar arquivos"}
          disabled={isSaving}
          onChange={addFiles}
        />
      </Field>

      {tracks.length > 0 && (
        <fieldset>
          <legend className="sr-only">Faixas, na ordem do álbum</legend>
          {/* Column titles for sighted users; each field already has its own accessible name */}
          <div aria-hidden="true" className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-medium text-muted-foreground">
            {canReorder && <span className="w-[2.625rem] shrink-0 text-right">Faixa</span>}
            <span className="flex-1 pl-1">Nome da música</span>
            <span className="w-10 shrink-0 text-right">Duração</span>
            <span className="w-14 shrink-0 text-center">Explícita</span>
            {canReorder && <span className="w-[3.875rem] shrink-0" />}
            <span className="w-7 shrink-0" />
          </div>
          <SortableList
            ids={tracks.map((track) => track.id)}
            rowHeight={TRACK_ROW_HEIGHT}
            gap={6}
            disabled={isSaving}
            onReorder={(ids) => setTracks((current) => orderByIds(current, ids, (track) => track.id))}
          >
            {tracks.map((track, index) => {
              const problem = problemWith(track)
              const trackLabel = `faixa ${index + 1}`
              return (
                <div key={track.id} className="flex h-full cursor-grab flex-col justify-center rounded-lg border border-border/70 bg-surface px-2 active:cursor-grabbing">
                  <div className="flex items-center gap-1.5">
                    {canReorder && (
                      <>
                        <GripVertical aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                      </>
                    )}
                    <Input
                      value={track.name}
                      maxLength={255}
                      disabled={isSaving}
                      placeholder="Nome da música"
                      aria-label={`Nome da ${trackLabel}`}
                      aria-invalid={problem !== null}
                      onChange={(event) => updateTrack(track.file, { name: event.target.value })}
                      className="h-8"
                    />
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {track.isReading ? "…" : track.duration !== null ? formatDuration(track.duration) : "—"}
                    </span>
                    <span className="flex w-14 shrink-0 justify-center">
                      <Switch
                        checked={track.isExplicit}
                        disabled={isSaving}
                        onCheckedChange={(isExplicit) => updateTrack(track.file, { isExplicit })}
                        aria-label={`Conteúdo explícito na ${trackLabel}`}
                      />
                    </span>
                    {/* Dragging needs a pointer; these move the track from the keyboard too */}
                    {canReorder && (
                      <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isSaving || index === 0}
                        aria-label={`Subir a ${trackLabel}`}
                        onClick={() => moveTrack(index, index - 1)}
                      >
                        <ChevronUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isSaving || index === tracks.length - 1}
                        aria-label={`Descer a ${trackLabel}`}
                        onClick={() => moveTrack(index, index + 1)}
                      >
                        <ChevronDown />
                      </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isSaving}
                      aria-label={`Tirar a ${trackLabel} da lista`}
                      onClick={() => setTracks((current) => current.filter((item) => item.id !== track.id))}
                    >
                      <X />
                    </Button>
                  </div>
                  {problem ? (
                    <p className={cn("mt-1 truncate text-[11px] text-destructive", canReorder ? "pl-11" : "pl-1")}>{problem}</p>
                  ) : (
                    <p className={cn("mt-1 truncate text-[11px] text-muted-foreground", canReorder ? "pl-11" : "pl-1")} title={track.file.name}>
                      {track.file.name}
                    </p>
                  )}
                </div>
              )
            })}
          </SortableList>
          {canReorder && <p className="mt-1 text-xs text-muted-foreground">Arraste para mudar a ordem das faixas.</p>}
        </fieldset>
      )}

      <Picker label="Artistas" items={artists} selected={artistIds} onChange={changeArtists} />
      <NewArtistField onCreated={(artistId) => setArtistIds((selected) => [...selected, artistId])} />
      <Picker label="Gêneros" items={genres} selected={genreIds} onChange={setGenreIds} />
      <NewGenreField onCreated={(genreId) => setGenreIds((selected) => [...selected, genreId])} />
      <AlbumPicker albums={albums} artistIds={artistIds} selected={albumId} onChange={setAlbumId} />

      {error && <Notice>{error}</Notice>}
      <DialogFooter>
        <Button type="button" variant="ghost" size="lg" disabled={isSaving} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={isSaving || isReadingAny}>
          {progress
            ? `Enviando ${progress.created + 1} de ${progress.total}…`
            : canReorder
              ? `Criar ${tracks.length} músicas`
              : "Criar música"}
        </Button>
      </DialogFooter>
    </form>
  )
}
