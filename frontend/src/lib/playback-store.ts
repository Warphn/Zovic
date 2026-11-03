import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { adminKeys } from "@/lib/api/admin"
import { catalogApi, useCatalogMusics } from "@/lib/api/catalog"
import { musicToTrack, type PlaylistData, type Track } from "./playlist-store"

// What is playing right now, shared by every page (playlist page, search, player).
// A playlist plays its own tracks, read live so reordering it reorders the queue; a track
// picked on its own plays with a queue of suggestions fixed when it started.

export type PlaybackSource =
  | { kind: "playlist"; playlistId: string }
  | { kind: "track"; queue: Track[] }

export interface PlaybackState {
  source: PlaybackSource
  currentTrackId: string
  isPlaying: boolean
}

export const SUGGESTION_COUNT = 8

const STORAGE_KEY = "zovic_playback_v1"
const CHANGE_EVENT = "zovic_playback_updated"

/** Up to `count` tracks from `catalog` in random order, without `excludeId`. */
export function pickRandomTracks(
  catalog: Track[],
  excludeId: string,
  count: number,
  random: () => number = Math.random
): Track[] {
  const pool = catalog.filter((t) => t.id !== excludeId)
  // Partial Fisher-Yates: shuffle only the first `count` positions
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const j = i + Math.floor(random() * (pool.length - i))
    const picked = pool[j]
    const current = pool[i]
    if (picked && current) {
      pool[i] = picked
      pool[j] = current
    }
  }
  return pool.slice(0, count)
}

/** The queue the state plays, plus its playlist when it comes from one. */
export function resolveQueue(
  state: PlaybackState | null,
  playlists: PlaylistData[]
): { tracks: Track[]; playlist: PlaylistData | null } {
  if (!state) return { tracks: [], playlist: null }
  if (state.source.kind === "track") return { tracks: state.source.queue, playlist: null }
  const { playlistId } = state.source
  const playlist = playlists.find((p) => p.id === playlistId) ?? null
  return { tracks: playlist?.tracks ?? [], playlist }
}

/** True when this state plays from the playlist `playlistId`. */
export function isPlayingFrom(state: PlaybackState | null, playlistId: string): boolean {
  return state?.source.kind === "playlist" && state.source.playlistId === playlistId
}

// ---------------------------------------------------------------------------------------
// Store: module state mirrored to sessionStorage, read through useSyncExternalStore
// ---------------------------------------------------------------------------------------

let state: PlaybackState | null = null
let loaded = false

function isPlaybackState(value: unknown): value is PlaybackState {
  if (!value || typeof value !== "object" || !("currentTrackId" in value) || !("source" in value)) return false
  const { currentTrackId, source } = value
  if (typeof currentTrackId !== "string" || !source || typeof source !== "object" || !("kind" in source)) return false
  if (source.kind === "playlist") return "playlistId" in source && typeof source.playlistId === "string"
  return source.kind === "track" && "queue" in source && Array.isArray(source.queue)
}

function load() {
  loaded = true
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    // A reload stops the sound, so a restored playback comes back paused
    state = isPlaybackState(parsed) ? { ...parsed, isPlaying: false } : null
  } catch {
    state = null
  }
}

function setState(next: PlaybackState | null) {
  state = next
  if (typeof window === "undefined") return
  try {
    if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage full or blocked: playback still works for this page view
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

function getSnapshot(): PlaybackState | null {
  if (!loaded && typeof window !== "undefined") load()
  return state
}

/** The catalog as tracks: a track played on its own is followed by tracks drawn from it. */
export function useCatalogTracks(): Track[] {
  const { data } = useCatalogMusics()
  // An admin also gets the removed musics, which cannot be played
  return React.useMemo(() => (data ?? []).filter((m) => m.deletedAt === null).map(musicToTrack), [data])
}

// ---------------------------------------------------------------------------------------
// Play count: POST /musics/:id/plays once per listen
// ---------------------------------------------------------------------------------------

export interface PlayRecord {
  trackId: string | null
  recorded: boolean
}

/**
 * Whether the playback now starts a new listen. A listen starts when a track begins playing:
 * pausing and resuming it is the same listen; moving to another track (even paused) and then
 * playing starts a new one.
 */
export function nextPlayRecord(
  previous: PlayRecord,
  trackId: string | null,
  isPlaying: boolean
): { record: PlayRecord; musicId: number | null } {
  const current = previous.trackId === trackId ? previous : { trackId, recorded: false }
  if (!isPlaying || trackId === null || current.recorded) return { record: current, musicId: null }
  const musicId = Number(trackId)
  // Sample tracks (landing preview) have no catalog id: nothing to count
  const isCatalogMusic = /^\d+$/.test(trackId) && musicId > 0
  return { record: { trackId, recorded: true }, musicId: isCatalogMusic ? musicId : null }
}

/** Records every listen started on this page; mounted once, by the app's playback bar. */
export function useRecordPlays() {
  const playback = usePlayback()
  const queryClient = useQueryClient()
  const record = React.useRef<PlayRecord>({ trackId: null, recorded: false })
  const trackId = playback?.currentTrackId ?? null
  const isPlaying = Boolean(playback?.isPlaying)

  React.useEffect(() => {
    const next = nextPlayRecord(record.current, trackId, isPlaying)
    record.current = next.record
    if (next.musicId === null) return
    catalogApi
      .recordPlay(next.musicId)
      // The panel's stats and per-user plays now have one more
      .then(() => queryClient.invalidateQueries({ queryKey: adminKeys.all }))
      // A play that could not be counted must not get in the way of listening
      .catch(() => {})
  }, [trackId, isPlaying, queryClient])
}

export function usePlayback(): PlaybackState | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => null)
}

// ---------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------

/** Plays `trackId` from the playlist `playlistId` (or just moves to it, paused, with playing=false). */
export function playPlaylist(playlistId: string, trackId: string, playing = true) {
  setState({ source: { kind: "playlist", playlistId }, currentTrackId: trackId, isPlaying: playing })
}

/** Plays `track` on its own, followed by tracks drawn at random from `catalog`. */
export function playTrack(track: Track, catalog: Track[]) {
  const queue = [track, ...pickRandomTracks(catalog, track.id, SUGGESTION_COUNT)]
  setState({ source: { kind: "track", queue }, currentTrackId: track.id, isPlaying: true })
}

/** Clicking a track: pauses or resumes it when it is the current one, otherwise plays it alone. */
export function playOrToggleTrack(trackId: string, catalog: Track[]) {
  if (getSnapshot()?.currentTrackId === trackId) {
    togglePlayback()
    return
  }
  const track = catalog.find((t) => t.id === trackId)
  if (track) playTrack(track, catalog)
}

/** Moves to another track of the current queue, keeping the source. */
export function selectTrack(trackId: string, playing?: boolean) {
  const current = getSnapshot()
  if (!current) return
  setState({ ...current, currentTrackId: trackId, isPlaying: playing ?? current.isPlaying })
}

export function togglePlayback() {
  const current = getSnapshot()
  if (current) setState({ ...current, isPlaying: !current.isPlaying })
}
