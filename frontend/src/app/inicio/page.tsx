"use client"

import * as React from "react"
import Link from "next/link"
import { AddToQueueButton } from "@/components/add-to-queue-button"
import { AlbumCoverImage } from "@/components/album-cover-image"
import Header from "@/components/header"
import { PlayIcon } from "@/components/icons"
import { PlaylistTile } from "@/components/playlist-tile"
import { TrackRow } from "@/components/track-row"
import { type Album, type CatalogMusic, useAlbums, useCatalogMusics, useGenres } from "@/lib/api/catalog"
import { apiErrorMessage } from "@/lib/api/client"
import { useHistory } from "@/lib/api/history"
import { useSession } from "@/lib/auth/client"
import { formatDuration } from "@/lib/format-duration"
import {
  countByGenre,
  firstName,
  greetingFor,
  NEWEST_ALBUM_COUNT,
  newestAlbums,
  PLAYLIST_TILE_COUNT,
  RECENT_COUNT,
  recentlyPlayed,
  TOP_PLAYED_COUNT,
  topPlayed,
  tracksOfAlbum,
} from "@/lib/home"
import {
  currentTrackOf,
  playOrToggleQueueTrack,
  playOrToggleTrack,
  playQueue,
  useCatalogTracks,
  usePlayback,
} from "@/lib/playback-store"
import { musicToTrack, useMyPlaylistsData } from "@/lib/playlist-store"

type Announce = (message: string, ok: boolean) => void

const SECTION_TITLE_CLASSES = "text-xl font-medium tracking-[-0.02em]"
const SEE_ALL_CLASSES =
  "rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"

function artistNames(artists: { name: string }[]): string {
  return artists.map((artist) => artist.name).join(", ")
}

/** A section with its title and, on the right, an optional link to the full list. */
function HomeSection({
  id,
  title,
  link,
  className,
  children,
}: {
  id: string
  title: string
  link?: { href: string; label: string }
  className?: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id={id} className={SECTION_TITLE_CLASSES}>
          {title}
        </h2>
        {link && (
          <Link href={link.href} className={SEE_ALL_CLASSES}>
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/** "Carregando…" or the error of a section's query; null once its data arrived. */
function QueryStatus({ isPending, error }: { isPending: boolean; error: unknown }) {
  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {apiErrorMessage(error)}
      </p>
    )
  }
  if (isPending) return <p className="text-sm text-muted-foreground">Carregando…</p>
  return null
}

function TrackText({ title, meta }: { title: string; meta: string }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate text-sm font-medium">{title}</span>
      <span className="block truncate text-xs text-muted-foreground">{meta}</span>
    </span>
  )
}

// The hour is the visitor's clock, read in the browser only: the server render has none, so the
// first paint matches it and the greeting appears right after
function subscribeToNothing() {
  return () => {}
}

function currentHour() {
  return new Date().getHours()
}

function noHourOnServer() {
  return null
}

function Greeting() {
  const { data: session } = useSession()
  const musics = useCatalogMusics()
  const albums = useAlbums()
  const genres = useGenres()
  const hour = React.useSyncExternalStore(subscribeToNothing, currentHour, noHourOnServer)

  const name = firstName(session?.user.name ?? "")
  const greeting = hour === null ? name : name ? `${greetingFor(hour)}, ${name}` : greetingFor(hour)
  const musicCount = musics.data?.filter((music) => music.deletedAt === null).length
  const albumCount = albums.data?.length
  const genreCount = genres.data?.length

  return (
    <div>
      <h1 className="min-h-[1.05em] text-3xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-4xl">{greeting}</h1>
      {musicCount !== undefined && albumCount !== undefined && genreCount !== undefined && (
        <p className="mt-3 font-mono text-xs text-muted-foreground tabular-nums">
          {musicCount} {musicCount === 1 ? "música" : "músicas"} · {albumCount} {albumCount === 1 ? "álbum" : "álbuns"} ·{" "}
          {genreCount} {genreCount === 1 ? "gênero" : "gêneros"}
        </p>
      )}
    </div>
  )
}

function TopPlayed({ onAnnounce }: { onAnnounce: Announce }) {
  const { data: musics, isPending, error } = useCatalogMusics()
  const playback = usePlayback()
  const chart = React.useMemo(() => topPlayed(musics ?? [], TOP_PLAYED_COUNT), [musics])
  const tracks = React.useMemo(() => chart.map(musicToTrack), [chart])

  return (
    <HomeSection id="inicio-mais-tocadas" title="Mais tocadas">
      <QueryStatus isPending={isPending} error={error} />
      <ol className="space-y-1">
        {chart.map((music, index) => {
          const track = tracks[index]
          if (!track) return null
          return (
            <li key={music.id}>
              <TrackRow
                isPlaying={Boolean(playback?.isPlaying) && currentTrackOf(playback)?.id === track.id}
                onClick={() => playOrToggleQueueTrack(tracks, index)}
                title={music.name}
                actions={<AddToQueueButton track={track} onResult={onAnnounce} />}
              >
                <span className="flex items-center gap-3">
                  <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <TrackText title={music.name} meta={[artistNames(music.artists), formatDuration(music.duration)].filter(Boolean).join(" · ")} />
                </span>
              </TrackRow>
            </li>
          )
        })}
      </ol>
    </HomeSection>
  )
}

function RecentlyPlayed({ onAnnounce }: { onAnnounce: Announce }) {
  const { data: entries, isPending, error } = useHistory()
  const catalogTracks = useCatalogTracks()
  const playback = usePlayback()
  const recent = recentlyPlayed(entries ?? [], RECENT_COUNT)

  return (
    <HomeSection id="inicio-ouvidas" title="Ouvidas recentemente" link={{ href: "/historico", label: "Ver histórico →" }}>
      <QueryStatus isPending={isPending} error={error} />
      <ul className="space-y-1">
        {recent.map((entry) => {
          const track = musicToTrack({ id: entry.musicId, name: entry.name, duration: entry.duration, artists: entry.artists })
          return (
            <li key={entry.musicId}>
              <TrackRow
                isPlaying={Boolean(playback?.isPlaying) && currentTrackOf(playback)?.id === track.id}
                onClick={() => playOrToggleTrack(track.id, [track, ...catalogTracks])}
                title={entry.name}
                actions={<AddToQueueButton track={track} onResult={onAnnounce} />}
              >
                <TrackText title={entry.name} meta={artistNames(entry.artists)} />
              </TrackRow>
            </li>
          )
        })}
      </ul>
    </HomeSection>
  )
}

const NEW_PLAYLIST_CARD_CLASSES =
  "flex aspect-square items-center justify-center rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"

function YourPlaylists() {
  const { data: playlists, isPending, error } = useMyPlaylistsData()
  const shown = playlists.slice(0, PLAYLIST_TILE_COUNT)

  return (
    <HomeSection id="inicio-playlists" title="Suas playlists" link={{ href: "/playlist", label: "Ver todas →" }}>
      <QueryStatus isPending={isPending} error={error} />
      {!isPending && !error && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((playlist) => (
            <PlaylistTile key={playlist.id} playlist={playlist} />
          ))}
          <Link href="/playlist" className={NEW_PLAYLIST_CARD_CLASSES}>
            {shown.length === 0 ? "Criar sua primeira playlist" : "+ Nova playlist"}
          </Link>
        </div>
      )}
    </HomeSection>
  )
}

function AlbumCard({ album, musics }: { album: Album; musics: CatalogMusic[] }) {
  const tracks = tracksOfAlbum(musics, album.id).map(musicToTrack)
  const meta = [artistNames(album.artists), album.year].filter(Boolean).join(" · ")

  return (
    <div className="group relative">
      <Link
        href={`/album/${album.id}`}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        <AlbumCoverImage album={album} className="aspect-square w-full text-3xl" />
        <span className="mt-3 block truncate text-sm font-medium">{album.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </Link>
      {/* Beside the link, never inside it: the card opens the album, the button plays it */}
      {tracks.length > 0 && (
        <button
          type="button"
          onClick={() => playQueue(tracks, 0)}
          aria-label={`Tocar ${album.name}`}
          title={`Tocar ${album.name}`}
          className="absolute top-3 right-3 flex size-10 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [@media(hover:none)]:opacity-100"
        >
          <PlayIcon size={16} />
        </button>
      )}
    </div>
  )
}

function NewestAlbums() {
  const albums = useAlbums()
  const musics = useCatalogMusics()
  const newest = newestAlbums(albums.data ?? [], NEWEST_ALBUM_COUNT)

  return (
    <HomeSection id="inicio-novidades" title="Novidades">
      <QueryStatus isPending={albums.isPending} error={albums.error} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {newest.map((album) => (
          <AlbumCard key={album.id} album={album} musics={musics.data ?? []} />
        ))}
      </div>
    </HomeSection>
  )
}

function Genres() {
  const genres = useGenres()
  const musics = useCatalogMusics()
  const counts = React.useMemo(() => countByGenre(musics.data ?? []), [musics.data])

  return (
    <HomeSection id="inicio-generos" title="Gêneros">
      <QueryStatus isPending={genres.isPending} error={genres.error} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(genres.data ?? []).map((genre) => {
          const count = counts.get(genre.id) ?? 0
          return (
            <Link
              key={genre.id}
              href={`/genero/${genre.id}`}
              className="rounded-xl border px-4 py-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
              style={{
                borderColor: genre.color,
                background: `color-mix(in oklab, ${genre.color} 14%, transparent)`,
              }}
            >
              <span className="block truncate text-sm font-medium">{genre.name}</span>
              <span className="mt-1 block font-mono text-xs text-muted-foreground tabular-nums">
                {count} {count === 1 ? "música" : "músicas"}
              </span>
            </Link>
          )
        })}
      </div>
    </HomeSection>
  )
}

export default function HomePage() {
  const history = useHistory()
  // What the last "Adicionar à fila" did, announced to screen readers too
  const [announcement, setAnnouncement] = React.useState<{ message: string; ok: boolean } | null>(null)
  const announce = React.useCallback<Announce>((message, ok) => setAnnouncement({ message, ok }), [])
  // A new account has no history: the chart then takes the reading width on its own
  const hasNoHistory = history.isSuccess && recentlyPlayed(history.data, RECENT_COUNT).length === 0

  return (
    <div className="flex flex-1 flex-col bg-background font-sans text-foreground selection:bg-primary/20 selection:text-foreground">
      <Header />
      <main className="flex-1 pt-16">
        <div className="mx-auto w-full max-w-6xl space-y-14 px-6 py-10 md:px-8">
          <div>
            <Greeting />
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
          </div>

          {hasNoHistory ? (
            <div className="max-w-3xl">
              <TopPlayed onAnnounce={announce} />
            </div>
          ) : (
            <div className="grid gap-14 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
              <TopPlayed onAnnounce={announce} />
              <RecentlyPlayed onAnnounce={announce} />
            </div>
          )}

          <YourPlaylists />
          <NewestAlbums />
          <Genres />
        </div>
      </main>
    </div>
  )
}
