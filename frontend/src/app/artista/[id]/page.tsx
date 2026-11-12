"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AddToPlaylistMenu } from "@/components/add-to-playlist-menu"
import { AddToQueueButton } from "@/components/add-to-queue-button"
import { AlbumCard } from "@/components/album-card"
import { TrackCommentsButton } from "@/components/comments/track-comments-button"
import Header from "@/components/header"
import { TrackLikeButton } from "@/components/track-like-button"
import { TrackRow } from "@/components/track-row"
import { buttonVariants } from "@/components/ui/button"
import { useAlbums, useArtists, useCatalogMusics } from "@/lib/api/catalog"
import { apiErrorMessage } from "@/lib/api/client"
import { formatDuration } from "@/lib/format-duration"
import { albumsOfArtist, parseRouteId, singlesOfArtist } from "@/lib/home"
import { currentTrackOf, playOrToggleQueueTrack, usePlayback } from "@/lib/playback-store"
import { musicToTrack } from "@/lib/playlist-store"

const SECTION_TITLE_CLASSES = "text-xl font-medium tracking-[-0.02em]"

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

function ArtistNotFound() {
  return (
    <PageShell>
      <h1 className="text-2xl font-medium">Artista não encontrado</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ele pode ter sido removido, ou o link está incorreto.</p>
      <Link href="/inicio" className={`${buttonVariants({ size: "lg" })} mt-6`}>
        Voltar ao início
      </Link>
    </PageShell>
  )
}

export default function ArtistPage() {
  const artistId = parseRouteId(useParams<{ id: string }>()?.id)
  const artists = useArtists()
  const albums = useAlbums()
  const musics = useCatalogMusics()
  const playback = usePlayback()
  // What the last "Adicionar à fila" or "Adicionar à playlist" did, announced to screen readers too
  const [announcement, setAnnouncement] = React.useState<{ message: string; ok: boolean } | null>(null)
  const announce = React.useCallback((message: string, ok: boolean) => setAnnouncement({ message, ok }), [])

  const artist = artists.data?.find((candidate) => candidate.id === artistId)
  const artistAlbums = React.useMemo(
    () => (artistId === null ? [] : albumsOfArtist(albums.data ?? [], artistId)),
    [albums.data, artistId]
  )
  const singles = React.useMemo(
    () => (artistId === null ? [] : singlesOfArtist(musics.data ?? [], artistId)),
    [musics.data, artistId]
  )
  const singleTracks = React.useMemo(() => singles.map(musicToTrack), [singles])

  if (artistId === null || (artists.isSuccess && !artist)) return <ArtistNotFound />
  const error = artists.error ?? albums.error ?? musics.error
  if (error) {
    return (
      <PageShell>
        <p role="alert" className="text-sm text-destructive">
          {apiErrorMessage(error)}
        </p>
      </PageShell>
    )
  }
  if (!artist || albums.isPending || musics.isPending) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </PageShell>
    )
  }

  const meta = [
    `${artistAlbums.length} ${artistAlbums.length === 1 ? "álbum" : "álbuns"}`,
    singles.length > 0 && `${singles.length} fora de álbum`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <PageShell>
      <p className="font-mono text-xs text-muted-foreground">Artista</p>
      <h1 className="mt-2 text-3xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-4xl">{artist.name}</h1>
      <p className="mt-4 font-mono text-xs text-muted-foreground tabular-nums">{meta}</p>

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

      <section aria-labelledby="artista-albuns" className="mt-10">
        <h2 id="artista-albuns" className={`${SECTION_TITLE_CLASSES} mb-4`}>
          Álbuns
        </h2>
        {artistAlbums.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum álbum deste artista ainda</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {artistAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} musics={musics.data ?? []} />
            ))}
          </div>
        )}
      </section>

      {/* Singles and features have no album to open, so they are listed here */}
      {singles.length > 0 && (
        <section aria-labelledby="artista-fora-de-album" className="mt-12">
          <h2 id="artista-fora-de-album" className={`${SECTION_TITLE_CLASSES} mb-4`}>
            Fora de álbum
          </h2>
          <ul className="space-y-1">
            {singles.map((music, index) => {
              const track = singleTracks[index]
              if (!track) return null
              return (
                <li key={music.id}>
                  <TrackRow
                    isPlaying={Boolean(playback?.isPlaying) && currentTrackOf(playback)?.id === track.id}
                    onClick={() => playOrToggleQueueTrack(singleTracks, index)}
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
        </section>
      )}
    </PageShell>
  )
}
