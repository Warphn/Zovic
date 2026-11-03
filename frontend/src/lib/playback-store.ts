import * as React from "react"
import type { PlaylistData, Track } from "./playlist-store"

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
