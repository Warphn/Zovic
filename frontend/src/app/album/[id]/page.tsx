"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AddToQueueButton } from "@/components/add-to-queue-button"
import { AlbumCoverImage } from "@/components/album-cover-image"
import Header from "@/components/header"
import { PlayIcon } from "@/components/icons"
import { TrackRow } from "@/components/track-row"
import { Button, buttonVariants } from "@/components/ui/button"
import { useAlbums, useCatalogMusics } from "@/lib/api/catalog"
import { apiErrorMessage } from "@/lib/api/client"
import { formatDuration, formatTotalDuration, sumDurationSec } from "@/lib/format-duration"
import { parseRouteId, tracksOfAlbum } from "@/lib/home"
import { currentTrackOf, playOrToggleQueueTrack, playQueue, usePlayback } from "@/lib/playback-store"
import { musicToTrack } from "@/lib/playlist-store"

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

function AlbumNotFound() {
  return (
    <PageShell>
      <h1 className="text-2xl font-medium">Álbum não encontrado</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ele pode ter sido removido, ou o link está incorreto.</p>
      <Link href="/inicio" className={`${buttonVariants({ size: "lg" })} mt-6`}>
        Voltar ao início
      </Link>
    </PageShell>
  )
}

export default function AlbumPage() {
  const albumId = parseRouteId(useParams<{ id: string }>()?.id)
  const albums = useAlbums()
  const musics = useCatalogMusics()
  const playback = usePlayback()
  // What the last "Adicionar à fila" did, announced to screen readers too
  const [announcement, setAnnouncement] = React.useState<{ message: string; ok: boolean } | null>(null)
  const announce = React.useCallback((message: string, ok: boolean) => setAnnouncement({ message, ok }), [])

  const album = albums.data?.find((candidate) => candidate.id === albumId)
  const albumMusics = React.useMemo(
    () => (albumId === null ? [] : tracksOfAlbum(musics.data ?? [], albumId)),
    [musics.data, albumId]
  )
  const tracks = React.useMemo(() => albumMusics.map(musicToTrack), [albumMusics])

  if (albumId === null || (albums.isSuccess && !album)) return <AlbumNotFound />
  const error = albums.error ?? musics.error
  if (error) {
    return (
      <PageShell>
        <p role="alert" className="text-sm text-destructive">
          {apiErrorMessage(error)}
        </p>
      </PageShell>
    )
  }
  if (!album || musics.isPending) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </PageShell>
    )
  }

  const artists = album.artists.map((artist) => artist.name).join(", ")
  const meta = [
    album.year,
    `${tracks.length} ${tracks.length === 1 ? "faixa" : "faixas"}`,
    formatTotalDuration(sumDurationSec(tracks)),
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <PageShell>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <AlbumCoverImage album={album} className="size-48 shrink-0 text-5xl sm:size-56" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted-foreground">Álbum</p>
          <h1 className="mt-2 text-3xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-4xl">{album.name}</h1>
          {artists && <p className="mt-2 text-sm text-muted-foreground">{artists}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="font-mono text-xs text-muted-foreground tabular-nums">{meta}</p>
            <Button size="lg" className="gap-2" disabled={tracks.length === 0} onClick={() => playQueue(tracks, 0)}>
              <PlayIcon size={16} /> Tocar
            </Button>
          </div>
        </div>
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

      <ol className="mt-8 space-y-1">
        {albumMusics.map((music, index) => {
          const track = tracks[index]
          if (!track) return null
          return (
            <li key={music.id}>
              <TrackRow
                isPlaying={Boolean(playback?.isPlaying) && currentTrackOf(playback)?.id === track.id}
                onClick={() => playOrToggleQueueTrack(tracks, index)}
                title={music.name}
                actions={<AddToQueueButton track={track} onResult={announce} />}
              >
                <span className="flex items-center gap-3">
                  <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                  <span className="block min-w-0">
                    <span className="block truncate text-sm font-medium">{music.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[track.artist, formatDuration(music.duration)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </span>
              </TrackRow>
            </li>
          )
        })}
      </ol>
    </PageShell>
  )
}
