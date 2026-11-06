import * as React from "react"

// The sound itself: where the playing track is, how loud, and which tracks could not load. Kept
// apart from playback-store because it changes several times a second and is not saved. The
// <audio> element (components/playback-audio.tsx) registers itself here, so the controls steer it.

export const DEFAULT_VOLUME = 0.7

export interface AudioSnapshot {
  /** Seconds into the current track. */
  currentTime: number
  /** Seconds; null until the file's metadata loads. */
  duration: number | null
  /** 0 to 1. */
  volume: number
  isMuted: boolean
  /** Tracks whose audio failed on this page view: removed, without a file, or not allowed. */
  unavailableTrackIds: ReadonlySet<string>
}

let snapshot: AudioSnapshot = {
  currentTime: 0,
  duration: null,
  volume: DEFAULT_VOLUME,
  isMuted: false,
  unavailableTrackIds: new Set(),
}
let audioElement: HTMLAudioElement | null = null
const listeners = new Set<() => void>()

function publish(changes: Partial<AudioSnapshot>) {
  snapshot = { ...snapshot, ...changes }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getAudioSnapshot(): AudioSnapshot {
  return snapshot
}

export function useAudioPlayer(): AudioSnapshot {
  return React.useSyncExternalStore(subscribe, getAudioSnapshot, getAudioSnapshot)
}

/** Called by the <audio> element's ref: it takes the current volume and mute at once. */
export function registerAudioElement(element: HTMLAudioElement | null) {
  audioElement = element
  if (element) {
    element.volume = snapshot.volume
    element.muted = snapshot.isMuted
  }
}

export function reportProgress(currentTime: number, duration: number | null) {
  publish({ currentTime, duration })
}

export function markUnavailable(trackId: string) {
  if (snapshot.unavailableTrackIds.has(trackId)) return
  publish({ unavailableTrackIds: new Set([...snapshot.unavailableTrackIds, trackId]) })
}

/** Jumps to `seconds` into the track, kept inside it. */
export function seekTo(seconds: number) {
  const end = snapshot.duration ?? Number.POSITIVE_INFINITY
  const currentTime = Math.min(Math.max(0, seconds), end)
  if (audioElement) audioElement.currentTime = currentTime
  publish({ currentTime })
}

/** Sets the volume (0 to 1); moving the volume turns the sound back on. */
export function setVolume(value: number) {
  const volume = Math.min(Math.max(0, value), 1)
  if (audioElement) {
    audioElement.volume = volume
    audioElement.muted = false
  }
  publish({ volume, isMuted: false })
}

export function toggleMute() {
  const isMuted = !snapshot.isMuted
  if (audioElement) audioElement.muted = isMuted
  publish({ isMuted })
}
