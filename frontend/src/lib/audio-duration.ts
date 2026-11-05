// The music's duration comes from its audio file, read by the browser before the upload.

/** Whole seconds, at least 1 (the API needs a positive duration); null when there is no duration. */
export function durationFromSeconds(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return Math.max(1, Math.round(seconds))
}

/**
 * Reads the duration from the file's metadata in an <audio> element. Resolves to null when the
 * browser cannot decode the file (it is not really audio), so the form can say so before uploading.
 */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    const finish = (seconds: number | null) => {
      URL.revokeObjectURL(url)
      resolve(seconds)
    }
    audio.preload = "metadata"
    audio.addEventListener("loadedmetadata", () => finish(durationFromSeconds(audio.duration)), { once: true })
    audio.addEventListener("error", () => finish(null), { once: true })
    audio.src = url
  })
}
