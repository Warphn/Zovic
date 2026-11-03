import * as React from "react"
import { type Playlist, type PlaylistMusic, parsePlaylistId, useMyPlaylists, usePlaylist, usePlaylistMusics } from "@/lib/api/playlists"
import { apiErrorMessage } from "@/lib/api/client"
import type { SearchMusic } from "@/lib/api/search"
import { formatDuration } from "@/lib/format-duration"

// What the pages draw for a playlist (sleeve, tracklist, playback queue), built from the API.
// INITIAL_PLAYLISTS/DEFAULT_TRACKS are sample data for the landing preview only.

export interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: string
  durationSec: number
  year: string
  quality?: "FLAC" | "HI-RES" | "VINYL-RIP"
}

export interface PlaylistData {
  id: string
  name: string
  color: string
  isPrivate: boolean
  createdAt: string
  /** In the playlist's order; empty until its musics load. */
  tracks: Track[]
  /** Whether the viewer can edit and delete it (the API's isAdmin). */
  canEdit?: boolean
}

/** Cover color of a playlist that has none. */
export const DEFAULT_PLAYLIST_COLOR = "#565043"

export const DEFAULT_TRACKS: Track[] = [
  {
    id: "t1",
    title: "Construção",
    artist: "Chico Buarque",
    album: "Construção",
    duration: "4:18",
    durationSec: 258,
    year: "1971",
    quality: "FLAC",
  },
  {
    id: "t2",
    title: "Águas de Março",
    artist: "Elis Regina, Tom Jobim",
    album: "Elis & Tom",
    duration: "3:32",
    durationSec: 212,
    year: "1974",
    quality: "HI-RES",
  },
  {
    id: "t3",
    title: "Clube da Esquina Nº 2",
    artist: "Milton Nascimento, Lô Borges",
    album: "Clube da Esquina",
    duration: "3:38",
    durationSec: 218,
    year: "1972",
    quality: "VINYL-RIP",
  },
  {
    id: "t4",
    title: "Resonance",
    artist: "HOME",
    album: "Odyssey",
    duration: "3:32",
    durationSec: 212,
    year: "2014",
    quality: "HI-RES",
  },
  {
    id: "t5",
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up, We're Dreaming",
    duration: "4:03",
    durationSec: 243,
    year: "2011",
    quality: "FLAC",
  },
  {
    id: "t6",
    title: "Tudo o Que Você Podia Ser",
    artist: "Lô Borges",
    album: "Clube da Esquina",
    duration: "2:57",
    durationSec: 177,
    year: "1972",
    quality: "VINYL-RIP",
  },
]

export const INITIAL_PLAYLISTS: PlaylistData[] = [
  {
    id: "pl-1",
    name: "MPB dos Anos Dourados",
    color: "#1e7f82",
    isPrivate: false,
    createdAt: "Hoje",
    tracks: DEFAULT_TRACKS,
  },
  {
    id: "pl-2",
    name: "Tropicália & Psicodelia",
    color: "#d33a2c",
    isPrivate: false,
    createdAt: "Ontem",
    tracks: DEFAULT_TRACKS.slice(0, 3),
  },
  {
    id: "pl-3",
    name: "Ecos Analógicos & Fita",
    color: "#1db954",
    isPrivate: false,
    createdAt: "3 dias atrás",
    tracks: DEFAULT_TRACKS.slice(1, 5),
  },
  {
    id: "pl-4",
    name: "Sintetizadores & Neon",
    color: "#4f46e5",
    isPrivate: true,
    createdAt: "Esta semana",
    tracks: DEFAULT_TRACKS.slice(3, 5),
  },
  {
    id: "pl-5",
    name: "Café & Bossa Dourada",
    color: "#f59e0b",
    isPrivate: false,
    createdAt: "Semana passada",
    tracks: DEFAULT_TRACKS.slice(0, 4),
  },
  {
    id: "pl-6",
    name: "Tangerina Tropical",
    color: "#ea580c",
    isPrivate: false,
    createdAt: "Há 2 semanas",
    tracks: DEFAULT_TRACKS,
  },
  {
    id: "pl-7",
    name: "Estúdio Minimalista",
    color: "#334155",
    isPrivate: true,
    createdAt: "Há 3 semanas",
    tracks: DEFAULT_TRACKS.slice(0, 2),
  },
  {
    id: "pl-8",
    name: "Jazz no Crepúsculo",
    color: "#7c3aed",
    isPrivate: false,
    createdAt: "Há 1 mês",
    tracks: DEFAULT_TRACKS.slice(1, 4),
  },
]

export function getPlaylistInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean)
  if (parts.length === 0) return "Z"
  if (parts.length === 1) {
    const single = parts[0]
    return (single ? single.slice(0, 2) : "Z").toUpperCase()
  }
  const first = parts[0]
  const second = parts[1]
  const initialA = first ? first[0] : "Z"
  const initialB = second ? second[0] : ""
  return `${initialA ?? "Z"}${initialB ?? ""}`.toUpperCase()
}

/**
 * A catalog music (from a playlist or the search) as a track the player can queue. The API has
 * no year yet, and the search no album: those stay empty, and covers fall back to the title.
 */
export function musicToTrack(music: SearchMusic & { album?: PlaylistMusic["album"] }): Track {
  return {
    id: String(music.id),
    title: music.name,
    artist: music.artists.map((a) => a.name).join(", "),
    album: music.album?.name ?? "",
    duration: formatDuration(music.duration),
    durationSec: music.duration,
    year: "",
  }
}

export function toPlaylistData(playlist: Playlist, musics: PlaylistMusic[] = []): PlaylistData {
  return {
    id: String(playlist.id),
    name: playlist.name,
    color: playlist.color ?? DEFAULT_PLAYLIST_COLOR,
    isPrivate: playlist.isPrivate,
    createdAt: playlist.createdAt,
    tracks: musics.map(musicToTrack),
    canEdit: playlist.isAdmin,
  }
}

export interface PlaylistsView<T> {
  data: T
  isPending: boolean
  error: string | null
}

/** The viewer's playlists, newest first. */
export function useMyPlaylistsData(): PlaylistsView<PlaylistData[]> {
  const query = useMyPlaylists()
  const data = React.useMemo(() => (query.data ?? []).map((playlist) => toPlaylistData(playlist)), [query.data])
  return { data, isPending: query.isPending, error: query.isError ? apiErrorMessage(query.error) : null }
}

/**
 * The playlist with this route id, with its tracks; null while loading, when not found, or for a
 * non-numeric id. `tracksError` says why the tracks did not load when the playlist itself did.
 */
export function usePlaylistData(
  idParam: string | null | undefined
): PlaylistsView<PlaylistData | null> & { tracksError: string | null } {
  const id = parsePlaylistId(idParam)
  const playlist = usePlaylist(id)
  const musics = usePlaylistMusics(id)
  const data = React.useMemo(
    () => (playlist.data ? toPlaylistData(playlist.data, musics.data) : null),
    [playlist.data, musics.data]
  )
  return {
    data,
    isPending: id !== null && (playlist.isPending || (musics.isPending && !musics.isError)),
    error: playlist.isError ? apiErrorMessage(playlist.error) : null,
    tracksError: musics.isError ? apiErrorMessage(musics.error) : null,
  }
}
