// Counts how much sound a listen really played, for "Já ouvidas" (HU-15): a music counts as
// listened after more than 30 seconds of sound in one listen. The API checks the rule again;
// this only decides when to tell it.

/** Same value as the API's rule (api/domain/use-cases/mark-music-listened.ts). */
export const LISTENED_THRESHOLD_SECONDS = 30

/** Largest gap between two timeupdate events still counted as sound; bigger jumps are seeks. */
export const MAX_PROGRESS_STEP_SECONDS = 1.5

export interface ListenProgress {
  /** The playback-store listen this count belongs to. */
  listenId: number
  /** Seconds of sound played in this listen. */
  playedSeconds: number
  /** Position of the last timeupdate, to measure the next step. */
  lastPosition: number
  /** True once the API was told about this listen. */
  isReported: boolean
}

/** Adds the sound since the last position; a new listenId starts from zero at `position`. */
export function trackListen(progress: ListenProgress | null, listenId: number, position: number): ListenProgress {
  if (!progress || progress.listenId !== listenId) {
    return { listenId, playedSeconds: 0, lastPosition: position, isReported: false }
  }
  const step = position - progress.lastPosition
  // Backwards or a jump forward means the bar was dragged: move on without counting it
  const isPlayedSound = step > 0 && step <= MAX_PROGRESS_STEP_SECONDS
  return {
    ...progress,
    playedSeconds: isPlayedSound ? progress.playedSeconds + step : progress.playedSeconds,
    lastPosition: position,
  }
}

/** True once, when the listen passes the threshold and was not reported yet. */
export function shouldReportListened(progress: ListenProgress): boolean {
  return !progress.isReported && progress.playedSeconds > LISTENED_THRESHOLD_SECONDS
}

/** The catalog music id of a track id, or null for sample tracks (non-numeric ids). */
export function musicIdToMark(trackId: string): number | null {
  if (!/^\d+$/.test(trackId)) return null
  const musicId = Number(trackId)
  return musicId > 0 ? musicId : null
}
