import * as React from "react"
import { useCatalogMusics } from "@/lib/api/catalog"
import { musicToTrack, type Track } from "./playlist-store"

// What is playing right now, shared by every page (playlist page, search, player). The queue is
// always a list of its own: playing a playlist copies its tracks, so editing the playlist later
// does not change what plays; a track picked on its own is followed by suggestions. The queue
// lives in the browser only (HU-14).

export interface PlaybackOrigin {
  kind: "playlist"
  playlistId: string
}

export interface PlaybackState {
  queue: Track[]
  /** Where the queue came from: lends the player its title, color and link. */
  origin: PlaybackOrigin | null
  /** Position in the queue, not a track id: the same music can be queued twice. */
  currentIndex: number
  isPlaying: boolean
  /** Changes whenever playback moves to a position of the queue; the audio engine records one listen per listenId. */
  listenId: number
}

export const SUGGESTION_COUNT = 8

const STORAGE_KEY = "zovic_playback_v2"
const CHANGE_EVENT = "zovic_playback_updated"

/** Up to `count` tracks from `catalog` in random order, without `excludeId`. */
export function pickRandomTracks(
  catalog: Track[],
  excludeId: string,
  count: number,
  random: () => number = Math.random
): Track[] {
  const pool = catalog.filter((track) => track.id !== excludeId)
  // Partial Fisher-Yates: shuffle only the first `count` positions
  for (let position = 0; position < Math.min(count, pool.length); position++) {
    const swapWith = position + Math.floor(random() * (pool.length - position))
    const picked = pool[swapWith]
    const current = pool[position]
    if (picked && current) {
      pool[position] = picked
      pool[swapWith] = current
    }
  }
  return pool.slice(0, count)
}

// ---------------------------------------------------------------------------------------
// Queue rules: pure functions over the state
// ---------------------------------------------------------------------------------------

/** A new queue with a copy of `tracks`, from `startIndex`; null when there is nothing to play. */
export function startQueue(
  previous: PlaybackState | null,
  tracks: Track[],
  startIndex: number,
  origin: PlaybackOrigin | null,
  playing = true
): PlaybackState | null {
  if (tracks.length === 0) return null
  const currentIndex = Math.min(Math.max(0, startIndex), tracks.length - 1)
  return { queue: [...tracks], origin, currentIndex, isPlaying: playing, listenId: (previous?.listenId ?? 0) + 1 }
}

/** Puts `track` at the end of the queue; with nothing queued, starts a queue with it, paused. */
export function appendToQueue(previous: PlaybackState | null, track: Track): PlaybackState {
  if (!previous) return { queue: [track], origin: null, currentIndex: 0, isPlaying: false, listenId: 1 }
  return { ...previous, queue: [...previous.queue, track] }
}

/** Takes the track at `index` out of the queue. The current track stays: it is the one playing. */
export function removeFromQueue(previous: PlaybackState, index: number): PlaybackState {
  if (index === previous.currentIndex || index < 0 || index >= previous.queue.length) return previous
  const queue = previous.queue.filter((_track, position) => position !== index)
  // A track removed before the current one shifts it one place left; it is still the same listen
  const currentIndex = index < previous.currentIndex ? previous.currentIndex - 1 : previous.currentIndex
  return { ...previous, queue, currentIndex }
}

/** Goes to the position `index`, as a new listen, keeping play/pause unless told. */
export function moveTo(previous: PlaybackState, index: number, playing?: boolean): PlaybackState {
  return {
    ...previous,
    currentIndex: index,
    isPlaying: playing ?? previous.isPlaying,
    listenId: previous.listenId + 1,
  }
}

/** When a track ends: the next one starts on its own; after the last one, playback stops there. */
export function nextOnEnded(previous: PlaybackState): PlaybackState {
  const nextIndex = previous.currentIndex + 1
  if (nextIndex >= previous.queue.length) return { ...previous, isPlaying: false }
  return moveTo(previous, nextIndex, true)
}

/** A track whose audio failed is skipped like one that ended: the queue never wraps around. */
export function skipUnavailable(previous: PlaybackState): PlaybackState {
  return nextOnEnded(previous)
}

export function currentTrackOf(state: PlaybackState | null): Track | null {
  return state?.queue[state.currentIndex] ?? null
}

/** True when this state plays from the playlist `playlistId`. */
export function isPlayingFrom(state: PlaybackState | null, playlistId: string): boolean {
  return state?.origin?.kind === "playlist" && state.origin.playlistId === playlistId
}

/**
 * Whether the listen now sounding is a new one to record. Pausing and resuming is the same
 * listen (same listenId); sample tracks (landing preview) have no catalog id: nothing to count.
 */
export function listenToRecord(
  lastRecordedListenId: number | null,
  state: PlaybackState
): { listenId: number; musicId: number | null } | null {
  if (state.listenId === lastRecordedListenId) return null
  const trackId = currentTrackOf(state)?.id ?? ""
  const musicId = Number(trackId)
  const isCatalogMusic = /^\d+$/.test(trackId) && musicId > 0
  return { listenId: state.listenId, musicId: isCatalogMusic ? musicId : null }
}

function isTrack(value: unknown): value is Track {
  return Boolean(value) && typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"
}

function isOrigin(value: unknown): value is PlaybackOrigin | null {
  if (value === null) return true
  if (!value || typeof value !== "object" || !("kind" in value) || !("playlistId" in value)) return false
  return value.kind === "playlist" && typeof value.playlistId === "string"
}

/** A saved state, when it has this version's shape. A reload stops the sound, so it comes back paused. */
export function parsePlaybackState(raw: unknown): PlaybackState | null {
  if (!raw || typeof raw !== "object") return null
  const saved = raw as Partial<Record<keyof PlaybackState, unknown>>
  const { queue, origin, currentIndex, listenId } = saved
  if (!Array.isArray(queue) || queue.length === 0 || !queue.every(isTrack)) return null
  if (!isOrigin(origin) || typeof listenId !== "number") return null
  if (typeof currentIndex !== "number" || !Number.isInteger(currentIndex)) return null
  if (currentIndex < 0 || currentIndex >= queue.length) return null
  return { queue, origin, currentIndex, isPlaying: false, listenId }
}

// ---------------------------------------------------------------------------------------
// Store: module state mirrored to sessionStorage, read through useSyncExternalStore
// ---------------------------------------------------------------------------------------

let state: PlaybackState | null = null
let loaded = false

function load() {
  loaded = true
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    state = parsePlaybackState(raw ? JSON.parse(raw) : null)
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

/** Applies `change` to the current state, when there is one. */
function update(change: (current: PlaybackState) => PlaybackState) {
  const current = getSnapshot()
  if (current) setState(change(current))
}

export function usePlayback(): PlaybackState | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => null)
}

/** The catalog as tracks: a track played on its own is followed by tracks drawn from it. */
export function useCatalogTracks(): Track[] {
  const { data } = useCatalogMusics()
  // An admin also gets the removed musics, which cannot be played
  return React.useMemo(() => (data ?? []).filter((music) => music.deletedAt === null).map(musicToTrack), [data])
}

// ---------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------

/** Plays the playlist from its track at `trackIndex` (or just moves there, paused, with playing=false). */
export function playPlaylist(playlist: { id: string; tracks: Track[] }, trackIndex: number, playing = true) {
  const next = startQueue(getSnapshot(), playlist.tracks, trackIndex, { kind: "playlist", playlistId: playlist.id }, playing)
  if (next) setState(next)
}

/** Plays `tracks` in order from `startIndex`, outside any playlist (an album page, for one). */
export function playQueue(tracks: Track[], startIndex: number) {
  const next = startQueue(getSnapshot(), tracks, startIndex, null)
  if (next) setState(next)
}

/** Plays `track` on its own, followed by tracks drawn at random from `catalog`. */
export function playTrack(track: Track, catalog: Track[]) {
  playQueue([track, ...pickRandomTracks(catalog, track.id, SUGGESTION_COUNT)], 0)
}

/** Clicking a track: pauses or resumes it when it is the current one, otherwise plays it alone. */
export function playOrToggleTrack(trackId: string, catalog: Track[]) {
  if (currentTrackOf(getSnapshot())?.id === trackId) {
    togglePlayback()
    return
  }
  const track = catalog.find((candidate) => candidate.id === trackId)
  if (track) playTrack(track, catalog)
}

/** Moves to another position of the queue, keeping the queue. */
export function selectTrackAt(index: number, playing?: boolean) {
  update((current) => (current.queue[index] ? moveTo(current, index, playing) : current))
}

export function addToQueue(track: Track) {
  setState(appendToQueue(getSnapshot(), track))
}

export function removeFromQueueAt(index: number) {
  update((current) => removeFromQueue(current, index))
}

/** The current track ended: the next one starts, or playback stops at the end of the queue. */
export function advanceAfterEnd() {
  update(nextOnEnded)
}

export function setPlaying(playing: boolean) {
  update((current) => (current.isPlaying === playing ? current : { ...current, isPlaying: playing }))
}

export function togglePlayback() {
  update((current) => ({ ...current, isPlaying: !current.isPlaying }))
}

/** Clears the queue: without a subscription there is nothing left to play. */
export function stopPlayback() {
  setState(null)
}
