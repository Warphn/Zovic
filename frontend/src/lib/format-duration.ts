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
