import * as React from "react"
import { useSession } from "@/lib/auth/client"

export interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: string
  durationSec: number
  year: string
  quality?: "FLAC" | "HI-RES" | "VINYL-RIP"
  /** Explicit content: hidden from minors. Missing means "look it up in EXPLICIT_TRACK_IDS". */
  explicit?: boolean
}

export interface PlaylistData {
  id: string
  name: string
  color: string
  isPrivate: boolean
  createdAt: string
  tracks: Track[]
}

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

export const STORAGE_KEY = "zovic_playlists_bento_v2"
const PLAYLISTS_CHANGE_EVENT = "zovic_playlists_updated"

export function isPlaylistDataArray(items: unknown): items is PlaylistData[] {
  if (!Array.isArray(items)) return false
  return items.every((item) => {
    return Boolean(
      item &&
      typeof item === "object" &&
      "name" in item &&
      typeof item.name === "string" &&
      "color" in item &&
      typeof item.color === "string" &&
      "tracks" in item &&
      Array.isArray(item.tracks)
    )
  })
}

/** Every track across `playlists`, each once (the same track can sit in several playlists). */
export function uniqueTracks(playlists: PlaylistData[]): Track[] {
  const byId = new Map<string, Track>()
  for (const playlist of playlists) {
    for (const track of playlist.tracks) {
      if (!byId.has(track.id)) byId.set(track.id, track)
    }
  }
  return [...byId.values()]
}

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

// Demo tracks marked explicit. Stored playlists carry copies of the tracks made before the flag
// existed, so the flag is looked up by id instead of trusting the stored copy.
export const EXPLICIT_TRACK_IDS: ReadonlySet<string> = new Set(["t4", "t5"])

export function isExplicit(track: Track): boolean {
  return track.explicit ?? EXPLICIT_TRACK_IDS.has(track.id)
}

/** The playlists as a minor sees them: without explicit tracks. */
export function hideExplicit(playlists: PlaylistData[]): PlaylistData[] {
  return playlists.map((playlist) => ({ ...playlist, tracks: playlist.tracks.filter((t) => !isExplicit(t)) }))
}

/**
 * Saving what a minor edited (with the explicit tracks hidden) must not drop those tracks:
 * each playlist gets back the hidden tracks it had, after the visible ones.
 */
export function restoreHidden(updated: PlaylistData[], stored: PlaylistData[]): PlaylistData[] {
  const storedById = new Map(stored.map((p) => [p.id, p]))
  return updated.map((playlist) => {
    const hidden = (storedById.get(playlist.id)?.tracks ?? []).filter(isExplicit)
    return hidden.length ? { ...playlist, tracks: [...playlist.tracks, ...hidden] } : playlist
  })
}

// In-memory cache for useSyncExternalStore referential stability
let cachedRawValue: string | null = null
let cachedPlaylistsSnapshot: PlaylistData[] = INITIAL_PLAYLISTS

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener("storage", callback)
  window.addEventListener(PLAYLISTS_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(PLAYLISTS_CHANGE_EVENT, callback)
  }
}

function getClientSnapshot(): PlaylistData[] {
  if (typeof window === "undefined") {
    return INITIAL_PLAYLISTS
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === cachedRawValue) {
      return cachedPlaylistsSnapshot
    }
    cachedRawValue = raw
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isPlaylistDataArray(parsed) && parsed.length > 0) {
        cachedPlaylistsSnapshot = parsed
        return cachedPlaylistsSnapshot
      }
    }
  } catch {
    // fallback to initial
  }
  cachedPlaylistsSnapshot = INITIAL_PLAYLISTS
  return cachedPlaylistsSnapshot
}

function getServerSnapshot(): PlaylistData[] {
  return INITIAL_PLAYLISTS
}

export function persistPlaylists(updated: PlaylistData[]) {
  if (typeof window === "undefined") return
  try {
    const serialized = JSON.stringify(updated)
    cachedRawValue = serialized
    cachedPlaylistsSnapshot = updated
    localStorage.setItem(STORAGE_KEY, serialized)
    window.dispatchEvent(new Event(PLAYLISTS_CHANGE_EVENT))
  } catch {
    // ignore
  }
}

// Explicit tracks are hidden unless the session says the account is an adult (visitors and a
// session still loading included). The API will filter on its side; this is the simulated catalog.
export function useStoredPlaylists() {
  const stored = React.useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
  const { data: session } = useSession()
  const restricted = !session?.user.isAdult

  return React.useMemo(() => {
    if (!restricted) return { playlists: stored, persistPlaylists }
    return {
      playlists: hideExplicit(stored),
      persistPlaylists: (updated: PlaylistData[]) => persistPlaylists(restoreHidden(updated, getClientSnapshot())),
    }
  }, [stored, restricted])
}
