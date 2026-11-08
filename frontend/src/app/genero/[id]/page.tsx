"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AddToPlaylistMenu } from "@/components/add-to-playlist-menu"
import { AddToQueueButton } from "@/components/add-to-queue-button"
import Header from "@/components/header"
import { PlayIcon } from "@/components/icons"
import { TrackRow } from "@/components/track-row"
import { Button, buttonVariants } from "@/components/ui/button"
import { useCatalogMusics, useGenres } from "@/lib/api/catalog"
import { apiErrorMessage } from "@/lib/api/client"
import { formatDuration, formatTotalDuration, sumDurationSec } from "@/lib/format-duration"
import { musicsOfGenre, parseRouteId } from "@/lib/home"
import { currentTrackOf, playOrToggleQueueTrack, playQueue, usePlayback } from "@/lib/playback-store"
import { musicToTrack } from "@/lib/playlist-store"
import { TrackLikeButton } from "@/components/track-like-button"
import { TrackCommentsButton } from "@/components/comments/track-comments-button"

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background font-sans text-foreground selection:bg-primary/20 selection:text-foreground">
      <Header />
      <main className="flex-1 pt-16">
        <div className="mx-auto w-full max-w-3xl px-6 py-10 md:px-8">{children}</div>
      </main>
    </div>
  )
}

function GenreNotFound() {
  return (
    <PageShell>
      <h1 className="text-2xl font-medium">Gênero não encontrado</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ele pode ter sido removido, ou o link está incorreto.</p>
      <Link href="/inicio" className={`${buttonVariants({ size: "lg" })} mt-6`}>
        Voltar ao início
      </Link>
    </PageShell>
  )
}

export default function GenrePage() {
  const genreId = parseRouteId(useParams<{ id: string }>()?.id)
  const genres = useGenres()
  const musics = useCatalogMusics()
  const playback = usePlayback()
  // What the last "Adicionar à fila" or "Adicionar à playlist" did, announced to screen readers too
  const [announcement, setAnnouncement] = React.useState<{ message: string; ok: boolean } | null>(null)
  const announce = React.useCallback((message: string, ok: boolean) => setAnnouncement({ message, ok }), [])

  const genre = genres.data?.find((candidate) => candidate.id === genreId)
  const genreMusics = React.useMemo(
    () => (genreId === null ? [] : musicsOfGenre(musics.data ?? [], genreId)),
    [musics.data, genreId]
  )
  const tracks = React.useMemo(() => genreMusics.map(musicToTrack), [genreMusics])

  if (genreId === null || (genres.isSuccess && !genre)) return <GenreNotFound />
  const error = genres.error ?? musics.error
  if (error) {
    return (
      <PageShell>
        <p role="alert" className="text-sm text-destructive">
          {apiErrorMessage(error)}
        </p>
      </PageShell>
    )
  }
  if (!genre || musics.isPending) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <p className="font-mono text-xs text-muted-foreground">Gênero</p>
      <h1 className="mt-2 flex items-center gap-3 text-3xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-4xl">
        <span aria-hidden="true" className="size-4 shrink-0 rounded-full" style={{ backgroundColor: genre.color }} />
        {genre.name}
      </h1>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          {tracks.length} {tracks.length === 1 ? "música" : "músicas"} · {formatTotalDuration(sumDurationSec(tracks))}
        </p>
        <Button size="lg" className="gap-2" disabled={tracks.length === 0} onClick={() => playQueue(tracks, 0)}>
          <PlayIcon size={16} /> Tocar
        </Button>
      </div>

      {/* Always rendered, so the live region exists before the first message */}
      <output
        className={
          announcement
            ? `mt-3 block text-sm ${announcement.ok ? "text-muted-foreground" : "text-destructive"}`
            : "sr-only"
        }
      >
        {announcement?.message}
      </output>

      {tracks.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nenhuma música neste gênero ainda</p>
      ) : (
        <ul className="mt-8 space-y-1">
          {genreMusics.map((music, index) => {
            const track = tracks[index]
            if (!track) return null
            return (
              <li key={music.id}>
                <TrackRow
                  isPlaying={Boolean(playback?.isPlaying) && currentTrackOf(playback)?.id === track.id}
                  onClick={() => playOrToggleQueueTrack(tracks, index)}
                  title={music.name}
                  actions={
                    <>
                      <AddToQueueButton track={track} onResult={announce} />
                      <TrackCommentsButton track={track} />
                      <TrackLikeButton trackId={track.id} />
                      <AddToPlaylistMenu musicId={music.id} title={music.name} onResult={announce} />
                    </>
                  }
                >
                  <span className="block min-w-0">
                    <span className="block truncate text-sm font-medium">{music.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[track.artist, formatDuration(music.duration)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </TrackRow>
              </li>
            )
          })}
        </ul>
      )}
    </PageShell>
  )
}
