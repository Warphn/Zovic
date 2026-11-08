"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { adminKeys } from "@/lib/api/admin"
import { catalogApi } from "@/lib/api/catalog"
import { apiUrl } from "@/lib/api/client"
import { historyKeys } from "@/lib/api/history"
import { markUnavailable, registerAudioElement, reportProgress } from "@/lib/audio-player"
import {
  advanceAfterEnd,
  currentTrackOf,
  getPlaybackSnapshot,
  listenToRecord,
  setPlaying,
  skipUnavailableTrack,
  usePlayback,
} from "@/lib/playback-store"

/** How long an unavailable track stays on screen before the queue moves past it. */
export const UNAVAILABLE_SKIP_DELAY_MS = 1500

// Catalog tracks have the music's numeric id; the landing's sample tracks have no audio
const CATALOG_TRACK_ID = /^\d+$/

/** Errors of play() that mean the sound will not start: the browser blocked it, or the file failed. */
const STOPPING_PLAY_ERRORS = new Set(["NotAllowedError", "NotSupportedError"])

function reportElementProgress(element: HTMLAudioElement) {
  reportProgress(element.currentTime, Number.isFinite(element.duration) ? element.duration : null)
}

// The one <audio> of the app, mounted in the root layout so the sound survives page changes. It
// plays the queue's current track (playback-store) and reports progress to audio-player, which
// the playback bar reads. The file comes from the API with the session cookie (same site).
export function PlaybackAudio() {
  const playback = usePlayback()
  const queryClient = useQueryClient()
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const lastRecordedListenId = React.useRef<number | null>(null)
  const startedListenId = React.useRef<number | null>(null)
  const skipTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const track = currentTrackOf(playback)
  const isPlaying = Boolean(playback?.isPlaying)
  const listenId = playback?.listenId ?? null
  const src = track && CATALOG_TRACK_ID.test(track.id) ? apiUrl(catalogApi.musicAudioPath(Number(track.id))) : undefined

  React.useEffect(() => () => clearTimeout(skipTimer.current), [])

  React.useEffect(() => {
    const element = audioRef.current
    if (!element) return
    // A new listen starts from the beginning, even when it is the same file again
    if (startedListenId.current !== listenId) {
      startedListenId.current = listenId
      if (element.currentTime > 0) element.currentTime = 0
      reportProgress(0, null)
    }
    if (!isPlaying || !src) {
      element.pause()
      return
    }
    element.play().catch((error: unknown) => {
      // AbortError only means another track took its place; the error event handles a failed file
      if (error instanceof DOMException && STOPPING_PLAY_ERRORS.has(error.name)) setPlaying(false)
    })
  }, [src, isPlaying, listenId])

  // Stable, so React attaches the element once instead of on every render
  const attachAudio = React.useCallback((element: HTMLAudioElement | null) => {
    audioRef.current = element
    registerAudioElement(element)
  }, [])

  // Counts the listen when the sound actually starts: pausing and resuming is the same listen
  const recordListen = () => {
    const current = getPlaybackSnapshot()
    if (!current) return
    const listen = listenToRecord(lastRecordedListenId.current, current)
    if (!listen) return
    lastRecordedListenId.current = listen.listenId
    if (listen.musicId === null) return
    catalogApi
      .recordPlay(listen.musicId)
      // The panel's stats, per-user plays and the account's history now have one more
      .then(() =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: adminKeys.all }),
          queryClient.invalidateQueries({ queryKey: historyKeys.all }),
        ])
      )
      // A play that could not be counted must not get in the way of listening
      .catch(() => {})
  }

  // Removed, without a file or not allowed (explicit for a minor): the API refuses the file
  const handleError = () => {
    if (!track || !src || listenId === null) return
    markUnavailable(track.id)
    const wasPlaying = isPlaying
    setPlaying(false)
    if (!wasPlaying) return
    clearTimeout(skipTimer.current)
    skipTimer.current = setTimeout(() => skipUnavailableTrack(listenId), UNAVAILABLE_SKIP_DELAY_MS)
  }

  return (
    // Music has no speech to caption; the lyrics are another story (Letras, #82)
    // oxlint-disable-next-line jsx-a11y/media-has-caption
    <audio
      ref={attachAudio}
      src={src}
      preload="metadata"
      onTimeUpdate={(event) => reportElementProgress(event.currentTarget)}
      onDurationChange={(event) => reportElementProgress(event.currentTarget)}
      onPlaying={recordListen}
      onEnded={advanceAfterEnd}
      onError={handleError}
      hidden
    />
  )
}
