// "Músicas Curtidas" (HU-34) lives in the API, but the hearts still live in this browser (HU-20 will
// move them). Hearts given before the playlist existed are sent once, so the two start in agreement.

const CATALOG_TRACK_ID = /^\d+$/

/** The catalog musics among the liked track ids, oldest like first: sent in this order, the newest ends on top. */
export function musicIdsToSync(likedTrackIds: readonly string[]): number[] {
  return likedTrackIds
    .filter((trackId) => CATALOG_TRACK_ID.test(trackId))
    .map(Number)
    .filter((musicId) => musicId > 0)
}
