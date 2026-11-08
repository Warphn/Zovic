// Total length as a record sleeve prints it: "48 min", or "1 h 12 min" past the hour.
// Rounds to whole minutes first, so 59 min 40 s reads "1 h", never "60 min"
export function formatTotalDuration(totalSec: number): string {
  const totalMin = Math.round(totalSec / 60)
  if (totalMin < 60) return `${totalMin} min`
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
}

export function sumDurationSec(tracks: { durationSec: number }[]): number {
  return tracks.reduce((acc, t) => acc + t.durationSec, 0)
}

/** 258 → "4:18". */
export function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/** "4:18" or "258" → 258; null when it is neither. */
export function parseDuration(value: string): number | null {
  const text = value.trim()
  const match = /^(\d+):([0-5]\d)$/.exec(text)
  const seconds = match ? Number(match[1]) * 60 + Number(match[2]) : /^\d+$/.test(text) ? Number(text) : NaN
  return Number.isInteger(seconds) && seconds > 0 ? seconds : null
}
